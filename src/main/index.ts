import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  nativeTheme,
  safeStorage,
  shell,
} from 'electron'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { join, dirname, isAbsolute, relative, sep } from 'node:path'
import { homedir } from 'node:os'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import type {
  AgentKind,
  AppSettings,
  HandoffRequest,
  ProviderConfig,
  ReviewRequest,
  ReviewRun,
} from '../core/contracts'
import { AGENTS } from '../core/contracts'
import { Store } from '../core/store'
import { discoverSources, SourceScanner } from '../core/sources'
import { PROVIDER_PRESETS, testConnection } from '../core/ai'
import { planReviewBatches, runReview } from '../core/review'
import {
  detectTargets,
  executablePath,
  launchPlan,
  prepareHandoff,
  terminalScript,
} from '../core/handoff'
import { providerDestinationChanged } from '../core/provider-policy'

const development = !app.isPackaged
if (development && process.env.CARRYTHREAD_DATA_DIR && isAbsolute(process.env.CARRYTHREAD_DATA_DIR))
  app.setPath('userData', process.env.CARRYTHREAD_DATA_DIR)
app.setName('Carrythread')
let window: BrowserWindow | null = null
let store: Store
let reviewController: AbortController | null = null
let scanInFlight: Promise<{
  coverage: Awaited<ReturnType<SourceScanner['scan']>>['coverage']
  sessions: number
  messages: number
}> | null = null
const scanner = new SourceScanner()
const sessionKeys = new Map<string, string>()
const approvedRoots = new Set<string>()
const approvedWorkspaces = new Set<string>()
const agentSchema = z.enum(AGENTS)
const idSchema = z.string().min(1).max(240)
const providerSchema = z.object({
  id: z.string().regex(/^[\w-]{1,80}$/),
  name: z.string().min(1).max(100),
  protocol: z.enum(['openai', 'anthropic', 'ollama']),
  baseUrl: z.string().url().max(2000),
  model: z.string().max(240),
  hasKey: z.boolean(),
  timeoutMs: z.number().int().min(5000).max(180000),
})
const settingsSchema = z.object({
  locale: z.enum(['en', 'zh-CN', 'es', 'ja']),
  theme: z.enum(['system', 'light', 'dark']),
  autoScan: z.boolean(),
  historyDays: z.number().int().min(0).max(3650),
  sources: z
    .array(
      z.object({
        id: idSchema,
        agent: agentSchema,
        path: z.string().min(1).max(4000),
        enabled: z.boolean(),
      }),
    )
    .max(50),
  providers: z.array(providerSchema).max(30),
  activeProviderId: z.string().nullable(),
})

function defaultSettings(): AppSettings {
  const language = app.getLocale().toLowerCase()
  return {
    locale: language.startsWith('zh')
      ? 'zh-CN'
      : language.startsWith('ja')
        ? 'ja'
        : language.startsWith('es')
          ? 'es'
          : 'en',
    theme: 'system',
    autoScan: false,
    historyDays: 30,
    sources: [],
    providers: [],
    activeProviderId: null,
  }
}
function settings(): AppSettings {
  return store.getSetting('app.settings', defaultSettings())
}
async function readableSettings(): Promise<AppSettings> {
  const value = settings()
  return {
    ...value,
    providers: await Promise.all(
      value.providers.map(async (p) => {
        const hasKey = Boolean(await keyFor(p.id))
        return {
          ...p,
          hasKey,
          keyStorage: sessionKeys.has(p.id)
            ? ('session' as const)
            : hasKey
              ? ('encrypted' as const)
              : ('missing' as const),
        }
      }),
    ),
  }
}
function saveSettings(value: AppSettings): void {
  store.setSetting('app.settings', value)
  nativeTheme.themeSource = value.theme
}

async function secureStorageAvailable(): Promise<boolean> {
  if (
    process.platform === 'linux' &&
    ['basic_text', 'unknown'].includes(safeStorage.getSelectedStorageBackend())
  )
    return false
  try {
    return await safeStorage.isAsyncEncryptionAvailable()
  } catch {
    return false
  }
}
async function keyFor(id: string): Promise<string | undefined> {
  if (sessionKeys.has(id)) return sessionKeys.get(id)
  const encoded = store.getSetting<string | null>(`provider.key.${id}`, null)
  if (!encoded || !(await secureStorageAvailable())) return undefined
  try {
    return (await safeStorage.decryptStringAsync(Buffer.from(encoded, 'base64'))).result
  } catch {
    return undefined
  }
}
async function saveKey(id: string, key: string): Promise<void> {
  sessionKeys.delete(id)
  if (!key) {
    store.setSetting(`provider.key.${id}`, null)
    return
  }
  if (await secureStorageAvailable())
    store.setSetting(
      `provider.key.${id}`,
      (await safeStorage.encryptStringAsync(key)).toString('base64'),
    )
  else {
    sessionKeys.set(id, key)
    store.setSetting(`provider.key.${id}`, null)
  }
}
function provider(id: string): ProviderConfig {
  const result = settings().providers.find((p) => p.id === id)
  if (!result) throw new Error('PROVIDER_REQUIRED')
  return result
}

function register(channel: string, handler: (...args: any[]) => unknown): void {
  ipcMain.handle(`carrythread:${channel}`, async (event, ...args) => {
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    )
      throw new Error('IPC_DENIED')
    const url = event.senderFrame.url
    const allowed =
      development && process.env.ELECTRON_RENDERER_URL
        ? url.startsWith(new URL(process.env.ELECTRON_RENDERER_URL).origin + '/')
        : url.startsWith('file:') &&
          fileURLToPath(url.split('#')[0]) === join(__dirname, '../renderer/index.html')
    if (!allowed) throw new Error('IPC_DENIED')
    try {
      return await handler(...args)
    } catch (error) {
      if (error instanceof z.ZodError) throw new Error('INVALID_INPUT')
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : error instanceof Error
            ? error.message
            : 'OPERATION_FAILED'
      throw new Error(/^[A-Za-z_]{3,90}$/.test(code) ? code : 'OPERATION_FAILED')
    }
  })
}

async function scan(): Promise<{
  coverage: Awaited<ReturnType<SourceScanner['scan']>>['coverage']
  sessions: number
  messages: number
}> {
  if (scanInFlight) return scanInFlight
  const value = settings()
  if (!value.sources.some((s) => s.enabled)) throw new Error('SOURCE_REQUIRED')
  scanInFlight = (async () => {
    const since = value.historyDays
      ? new Date(Date.now() - value.historyDays * 86400000).toISOString()
      : undefined
    const result = await scanner.scan(value.sources, {
      since,
      maxFiles: 5000,
      maxFileBytes: 64 * 1024 * 1024,
    })
    const counts = store.upsertSessions(result)
    window?.webContents.send('carrythread:changed')
    return { coverage: result.coverage, ...counts }
  })()
  try {
    return await scanInFlight
  } finally {
    scanInFlight = null
  }
}

function launchDetached(executable: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { detached: true, stdio: 'ignore', shell: false })
    child.once('error', () => reject(new Error('HANDOFF_LAUNCH_FAILED')))
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

function registerHandlers(): void {
  register('snapshot', async () => store.snapshot(await readableSettings()))
  register('version', () => app.getVersion())
  register('detectSources', async () => {
    const sources = await discoverSources(homedir())
    sources.forEach((s) => approvedRoots.add(s.path))
    return sources
  })
  register('chooseSource', async (kind: AgentKind) => {
    agentSchema.parse(kind)
    const result = await dialog.showOpenDialog(window!, {
      properties: ['openDirectory', ...(kind === 'generic' ? ['openFile' as const] : [])],
    })
    if (result.canceled || !result.filePaths[0]) return null
    const path = await realpath(result.filePaths[0])
    approvedRoots.add(path)
    return { id: randomUUID(), agent: kind, path, enabled: true }
  })
  register('chooseWorkspace', async (current?: unknown) => {
    const initial = current === undefined ? undefined : z.string().max(4000).parse(current)
    const result = await dialog.showOpenDialog(window!, {
      properties: ['openDirectory'],
      ...(initial && isAbsolute(initial) ? { defaultPath: initial } : {}),
    })
    if (result.canceled || !result.filePaths[0]) return null
    const path = await realpath(result.filePaths[0])
    approvedWorkspaces.add(path)
    store.setSetting('handoff.approvedWorkspaces', [...approvedWorkspaces])
    return path
  })
  register('saveSettings', (value: unknown) => {
    const next = settingsSchema.parse(value),
      previous = settings()
    for (const source of next.sources)
      if (
        !isAbsolute(source.path) ||
        (!approvedRoots.has(source.path) &&
          !previous.sources.some(
            (s) => s.id === source.id && s.path === source.path && s.agent === source.agent,
          ))
      )
        throw new Error('SOURCE_PATH_NOT_APPROVED')
    next.providers = previous.providers
    if (next.activeProviderId && !previous.providers.some((p) => p.id === next.activeProviderId))
      throw new Error('PROVIDER_REQUIRED')
    saveSettings(next)
  })
  register('scan', scan)
  register('session', (id: unknown) => store.getSession(idSchema.parse(id)))
  register('search', (query: unknown) => store.search(z.string().min(1).max(500).parse(query), 100))
  register('providerPresets', () => PROVIDER_PRESETS)
  register('previewReview', (input:unknown) => {
    const request=z.object({sessionIds:z.array(idSchema).min(1).max(1000),since:z.string().optional(),until:z.string().optional()}).parse(input)
    const plan=planReviewBatches({messages:store.getMessages(request.sessionIds),since:request.since,until:request.until})
    return {batches:plan.batches.length,totalMessages:plan.totalMessages,eligibleMessages:plan.eligibleMessages,omittedMessages:plan.omittedMessages}
  })
  register('saveProvider', async (config: unknown, key?: unknown) => {
    const p = providerSchema.parse(config)
    const secret = key === undefined ? undefined : z.string().max(8192).parse(key)
    const previous = settings().providers.find((existing) => existing.id === p.id)
    if (secret === undefined && providerDestinationChanged(previous, p)) await saveKey(p.id, '')
    if (secret !== undefined) await saveKey(p.id, secret)
    p.hasKey = Boolean(await keyFor(p.id))
    const value = settings()
    value.providers = [...value.providers.filter((x) => x.id !== p.id), p]
    value.activeProviderId ||= p.id
    saveSettings(value)
  })
  register('removeProvider', async (id: unknown) => {
    const key = idSchema.parse(id)
    await saveKey(key, '')
    const value = settings()
    value.providers = value.providers.filter((p) => p.id !== key)
    if (value.activeProviderId === key) value.activeProviderId = value.providers[0]?.id || null
    saveSettings(value)
  })
  register('testProvider', async (id: unknown) => {
    const p = provider(idSchema.parse(id))
    return testConnection(p, await keyFor(p.id), undefined, settings().locale)
  })
  register('review', async (input: unknown) => {
    const request: ReviewRequest = z
      .object({
        sessionIds: z.array(idSchema).min(1).max(1000),
        providerId: idSchema,
        locale: z.enum(['en', 'zh-CN', 'es', 'ja']),
        since: z.string().optional(),
        until: z.string().optional(),
      })
      .parse(input)
    if (reviewController) throw new Error('REVIEW_IN_PROGRESS')
    const config = provider(request.providerId)
    reviewController = new AbortController()
    const id = randomUUID(),
      timestamp = new Date().toISOString()
    try {
      const result = await runReview({
        messages: store.getMessages(request.sessionIds, {
          since: request.since,
          until: request.until,
        }),
        existingItems: store.listItems(),
        provider: config,
        key: await keyFor(config.id),
        locale: request.locale,
        signal: reviewController.signal,
        since: request.since,
        until: request.until,
      })
      const updated = store.applyReview(result)
      const run: ReviewRun = {
        id,
        timestamp,
        sessionIds: request.sessionIds,
        provider: config.name,
        model: config.model,
        processedMessages: result.processedMessages,
        omittedMessages: result.omittedMessages,
        itemCount: updated.length,
        status: 'complete',
      }
      store.addReviewRun(run)
      return run
    } catch (error) {
      store.addReviewRun({
        id,
        timestamp,
        sessionIds: request.sessionIds,
        provider: config.name,
        model: config.model,
        processedMessages: 0,
        itemCount: 0,
        status: 'failed',
        error:
          error && typeof error === 'object' && 'code' in error
            ? String(error.code)
            : 'REVIEW_FAILED',
      })
      throw error
    } finally {
      reviewController = null
    }
  })
  register('cancelReview', () => {
    reviewController?.abort()
  })
  register('patchItem', (patch: unknown) => {
    const input = z
      .object({
        id: idSchema,
        expectedRevision: z.number().int().positive(),
        changes: z.record(z.string(), z.unknown()),
        reason: z.string().min(1).max(2000),
      })
      .parse(patch)
    return store.patchItem(input)
  })
  register('itemHistory', (id: unknown) => store.itemHistory(idSchema.parse(id)))
  register('mergeItems', (ids: unknown, title: unknown) =>
    store.mergeItems(
      z.array(idSchema).min(2).max(20).parse(ids),
      z.string().min(1).max(300).parse(title),
    ),
  )
  register('splitItem', (id: unknown, titles: unknown) =>
    store.splitItem(
      idSchema.parse(id),
      z.array(z.string().min(1).max(300)).min(2).max(10).parse(titles),
    ),
  )
  register('targets', detectTargets)
  register('prepareHandoff', async (input: unknown) => {
    const request: HandoffRequest = z
      .object({
        itemId: idSchema,
        target: agentSchema,
        mode: z.enum(['new', 'resume']),
        sessionId: idSchema.optional(),
        cwd: z.string().max(4000).optional(),
        instruction: z.string().min(1).max(4000),
        includeEvidence: z.boolean(),
      })
      .parse(input)
    const item = store.getItem(request.itemId)
    if (!item) throw new Error('STORE_NOT_FOUND')
    const ids = [
      ...new Set([
        ...item.evidence.map((e) => e.sessionId),
        ...(request.sessionId ? [request.sessionId] : []),
      ]),
    ]
    const sessions = ids
      .map((id) => store.getSession(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
    const pkg = await prepareHandoff(
      request,
      item,
      sessions,
      join(app.getPath('userData'), 'handoffs'),
    )
    store.saveHandoff(pkg)
    return pkg
  })
  register('launchHandoff', async (input: unknown) => {
    const pkg = store.getHandoff(idSchema.parse(input))
    if (!pkg) throw new Error('HANDOFF_NOT_FOUND')
    if (pkg.status === 'opened' || pkg.status === 'submitted')
      throw new Error('HANDOFF_ALREADY_OPENED')
    const item = store.getItem(pkg.itemId)
    if (!item || item.revision !== pkg.revision) throw new Error('HANDOFF_STALE')
    const capability = (await detectTargets()).find((t) => t.agent === pkg.target)!
    const plan = launchPlan(pkg, capability)
    try {
      if (
        plan.kind !== 'manual' &&
        (!pkg.cwd || !(await stat(pkg.cwd).catch(() => null))?.isDirectory())
      )
        throw new Error('HANDOFF_DIRECTORY_MISSING')
      if (plan.kind !== 'manual' && !approvedWorkspaces.has(await realpath(pkg.cwd)))
        throw new Error('HANDOFF_DIRECTORY_UNCONFIRMED')
      if (plan.copyPrompt) clipboard.writeText(pkg.prompt)
      if (plan.kind === 'url') await shell.openExternal(plan.url!)
      else if (plan.kind === 'command') {
        const windows = process.platform === 'win32',
          path = join(
            app.getPath('userData'),
            'handoffs',
            `${pkg.id}.${windows ? 'ps1' : 'command'}`,
          )
        await writeFile(path, terminalScript(plan, windows), { mode: 0o700 })
        if (process.platform === 'darwin')
          await launchDetached('/usr/bin/open', ['-a', 'Terminal', path])
        else if (windows)
          await launchDetached('powershell.exe', [
            '-NoExit',
            '-ExecutionPolicy',
            'RemoteSigned',
            '-File',
            path,
          ])
        else {
          const terminal =
            (await executablePath('x-terminal-emulator')) ||
            (await executablePath('gnome-terminal'))
          if (!terminal) throw new Error('TERMINAL_NOT_FOUND')
          await launchDetached(
            terminal,
            terminal.endsWith('gnome-terminal') ? ['--', '/bin/sh', path] : ['-e', '/bin/sh', path],
          )
        }
      }
      pkg.status = 'opened'
      pkg.warning =
        plan.kind === 'manual'
          ? 'HANDOFF_COPIED'
          : plan.copyPrompt
            ? 'HANDOFF_PASTE_REQUIRED'
            : plan.startsExecution
              ? 'HANDOFF_LAUNCH_UNCONFIRMED'
              : 'HANDOFF_PREFILLED'
      store.saveHandoff(pkg)
      return pkg
    } catch (error) {
      pkg.status = 'failed'
      pkg.warning = 'HANDOFF_LAUNCH_FAILED'
      store.saveHandoff(pkg)
      throw error
    }
  })
  register('exportHandoff', async (id: unknown) => {
    const pkg = store.getHandoff(idSchema.parse(id))
    if (!pkg) throw new Error('HANDOFF_NOT_FOUND')
    const result = await dialog.showSaveDialog(window!, {
      defaultPath: `carrythread-${pkg.id.slice(0, 8)}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, pkg.content, { mode: 0o600 })
    return result.filePath
  })
  register('openEvidence', async (id: unknown) => {
    const messageId = idSchema.parse(id)
    const message = store.getMessage(messageId)
    if (!message) throw new Error('EVIDENCE_NOT_FOUND')
    const path = await realpath(message.sourcePath)
    let allowed = false
    for (const source of settings().sources) {
      const root = await realpath(source.path).catch(() => '')
      const r = root ? relative(root, path) : '..'
      if (root && (r === '' || (!r.startsWith(`..${sep}`) && r !== '..' && !isAbsolute(r))))
        allowed = true
    }
    if (!allowed) throw new Error('SOURCE_PATH_NOT_APPROVED')
    shell.showItemInFolder(path)
  })
  register('exportData', async () => {
    const result = await dialog.showSaveDialog(window!, {
      defaultPath: `carrythread-workspace-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, JSON.stringify(store.exportData(), null, 2), { mode: 0o600 })
    return result.filePath
  })
  register('importData', async () => {
    const result = await dialog.showOpenDialog(window!, {
      properties: ['openFile'],
      filters: [{ name: 'Carrythread JSON', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePaths[0]) return null
    if ((await stat(result.filePaths[0])).size > 50 * 1024 * 1024)
      throw new Error('IMPORT_TOO_LARGE')
    return store.importData(JSON.parse(await readFile(result.filePaths[0], 'utf8')))
  })
  register('clearLocalData', async () => {
    if (scanInFlight || reviewController) throw new Error('OPERATION_IN_PROGRESS')
    const previous = settings()
    store.clearAll()
    sessionKeys.clear()
    scanner.clear()
    approvedRoots.clear()
    approvedWorkspaces.clear()
    await rm(join(app.getPath('userData'), 'handoffs'), { recursive: true, force: true })
    saveSettings({ ...defaultSettings(), locale: previous.locale, theme: previous.theme })
  })
  register('openExternal', async (input: unknown) => {
    const url = new URL(z.string().url().max(2000).parse(input))
    if (url.protocol !== 'https:') throw new Error('URL_NOT_ALLOWED')
    await shell.openExternal(url.toString())
  })
}

async function createWindow(): Promise<void> {
  window = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 940,
    minHeight: 660,
    title: 'Carrythread',
    backgroundColor: '#F7F5F0',
    show: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  )
  window.on('closed', () => {
    window = null
  })
  window.once('ready-to-show', () => window?.show())
  if (development && process.env.ELECTRON_RENDERER_URL)
    await window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else await window.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(async () => {
  await mkdir(app.getPath('userData'), { recursive: true, mode: 0o700 })
  store = new Store(join(app.getPath('userData'), 'carrythread.db'))
  settings().sources.forEach((s) => approvedRoots.add(s.path))
  store.getSetting<string[]>('handoff.approvedWorkspaces', []).forEach((path) => approvedWorkspaces.add(path))
  nativeTheme.themeSource = settings().theme
  registerHandlers()
  await createWindow()
  const interval = setInterval(
    () => {
      if (settings().autoScan) void scan().catch(() => undefined)
    },
    5 * 60 * 1000,
  )
  interval.unref()
  app.on('activate', () => {
    if (!window) void createWindow()
  })
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('before-quit', () => {
  reviewController?.abort()
  store?.close()
})
