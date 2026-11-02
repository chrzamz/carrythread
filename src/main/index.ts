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
import { PROVIDER_PRESETS, testConnection, validateProvider } from '../core/ai'
import { planReviewBatches, runReview } from '../core/review'
import { buildReviewContext } from '../core/continuity'
import {
  detectTargets,
  executablePath,
  launchPlan,
  prepareHandoff,
  terminalScript,
} from '../core/handoff'
import { providerDestinationChanged } from '../core/provider-policy'
import { ProviderKeyStorage } from '../core/key-storage'
import { assertExportDestination } from '../core/paths'
import { handoffEnvironment,PARENT_SESSION_VARIABLES } from '../core/launch-environment'

const development = !app.isPackaged
for(const name of PARENT_SESSION_VARIABLES)delete process.env[name]
if (process.env.CARRYTHREAD_DATA_DIR && isAbsolute(process.env.CARRYTHREAD_DATA_DIR))
  app.setPath('userData', process.env.CARRYTHREAD_DATA_DIR)
app.setName('Carrythread')
let window: BrowserWindow | null = null
let store: Store
let reviewController: AbortController | null = null
let providerChangesInFlight = 0
let scanInFlight: Promise<{
  coverage: Awaited<ReturnType<SourceScanner['scan']>>['coverage']
  sessions: number
  messages: number
}> | null = null
const scanner = new SourceScanner()
const sessionKeys = new Map<string, string>()
const providerKeys = new ProviderKeyStorage({
  sessionKeys,
  readEncrypted: id => store.getSetting<string | null>(`provider.key.${id}`, null),
  writeEncrypted: (id, value) => store.setSetting(`provider.key.${id}`, value),
  backend: {
    available: async () => {
      const available = await safeStorage.isAsyncEncryptionAvailable()
      return available && !(process.platform === 'linux' && ['basic_text', 'unknown'].includes(safeStorage.getSelectedStorageBackend()))
    },
    encrypt: async key => (await safeStorage.encryptStringAsync(key)).toString('base64'),
    decrypt: async cipher => (await safeStorage.decryptStringAsync(Buffer.from(cipher, 'base64'))).result,
  },
})
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

async function keyFor(id: string): Promise<string | undefined> {
  return providerKeys.get(id)
}
async function saveKey(id: string, key: string): Promise<void> {
  return providerKeys.set(id, key)
}
function provider(id: string): ProviderConfig {
  const result = settings().providers.find((p) => p.id === id)
  if (!result) throw new Error('PROVIDER_REQUIRED')
  return result
}

async function nativeTargets() {
  const targets = await detectTargets()
  for (const target of targets) {
    if (target.agent !== 'codex' && target.agent !== 'finch') continue
    try {
      const name = app.getApplicationNameForProtocol(
        target.agent === 'codex' ? 'codex://threads/new' : 'finch://chat',
      )
      if (name) {
        target.installed = true
        target.kind = 'desktop'
        target.openExisting = true
        target.newWithContext = true
        target.appendExisting = false
      }
    } catch {
      /* Keep the detected CLI or manual fallback. */
    }
  }
  return targets
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
    const child = spawn(executable, args, { detached: true, stdio: 'ignore', shell: false, env:handoffEnvironment(process.env) })
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
  register('previewReview', (input: unknown) => {
    const request = z
      .object({
        sessionIds: z.array(idSchema).min(1).max(1000),
        since: z.string().optional(),
        until: z.string().optional(),
      })
      .parse(input)
    const messages=store.getMessages(request.sessionIds)
    const plan = planReviewBatches({
      messages,
      since: request.since,
      until: request.until,
    })
    const existing=store.listItems()
    const context=buildReviewContext(messages,store.listSessions(),store.listHandoffs(),existing)
    const selectedSessions=new Set(plan.batches.flatMap(batch=>batch.map(m=>m.sessionId)))
    const linked=new Set(context.sessionContext.filter(c=>selectedSessions.has(c.sessionId)).flatMap(c=>c.linkedItemIds))
    const related=existing.filter(item=>linked.has(item.id)||item.evidence.some(ref=>selectedSessions.has(ref.sessionId)))
    return {
      batches: plan.batches.length,
      totalMessages: plan.totalMessages,
      eligibleMessages: plan.eligibleMessages,
      omittedMessages: plan.omittedMessages,
      relatedItems: related.length,
      relatedTitles: related.map(item=>item.title),
    }
  })
  register('saveProvider', async (config: unknown, key?: unknown) => {
    const p = providerSchema.parse(config)
    validateProvider(p)
    const secret = key === undefined ? undefined : z.string().max(8192).parse(key)
    providerChangesInFlight++
    try {
      const previous = settings().providers.find((existing) => existing.id === p.id)
      if (secret === undefined && providerDestinationChanged(previous, p)) await saveKey(p.id, '')
      if (secret !== undefined) await saveKey(p.id, secret)
      p.hasKey = Boolean(await keyFor(p.id))
      const value = settings()
      value.providers = [...value.providers.filter((x) => x.id !== p.id), p]
      value.activeProviderId ||= p.id
      saveSettings(value)
    } finally {
      providerChangesInFlight--
    }
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
      const messages=store.getMessages(request.sessionIds)
      const existingItems=store.listItems()
      const context=buildReviewContext(messages,store.listSessions(),store.listHandoffs(),existingItems)
      const result = await runReview({
        messages,
        existingItems,
        sessionContext:context.sessionContext,
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
  register('targets', nativeTargets)
  register('prepareHandoff', async (input: unknown) => {
    const request: HandoffRequest = z
      .object({
        locale: z.enum(['en', 'zh-CN', 'es', 'ja']).optional(),
        itemId: idSchema,
        target: agentSchema,
        mode: z.enum(['new', 'resume']),
        sessionId: idSchema.optional(),
        cwd: z.string().max(4000).optional(),
        instruction: z.string().min(1).max(4000),
        includeEvidence: z.boolean(),
      })
      .parse(input)
    request.locale ||= settings().locale
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
    if(request.mode==='resume'){
      const destination=sessions.find(s=>s.id===request.sessionId)
      const source=destination&&settings().sources.find(s=>s.id===destination.sourceId&&s.agent===destination.agent)
      if(!source||!destination||!(await stat(destination.sourcePath).catch(()=>null))?.isFile())throw new Error('HANDOFF_SESSION_NOT_LOCAL')
    }
    const pkg = await prepareHandoff(
      request,
      item,
      sessions,
      join(app.getPath('userData'), 'handoffs'),
    )
    const capability = (await nativeTargets()).find((t) => t.agent === pkg.target)!
    pkg.launchKind = capability.kind
    pkg.startsExecution = capability.installed ? launchPlan(pkg, capability).startsExecution : false
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
    const capability = (await nativeTargets()).find((t) => t.agent === pkg.target)!
    if (pkg.launchKind !== capability.kind) throw new Error('HANDOFF_TARGET_CHANGED')
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
    await assertExportDestination(
      result.filePath,
      [...settings().sources.map((s) => s.path), ...store.listSessions().map((s) => s.sourcePath)],
      app.getPath('userData'),
    )
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
    await assertExportDestination(
      result.filePath,
      [...settings().sources.map((s) => s.path), ...store.listSessions().map((s) => s.sourcePath)],
      app.getPath('userData'),
    )
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
    if (scanInFlight || reviewController || providerChangesInFlight > 0) throw new Error('OPERATION_IN_PROGRESS')
    const previous = settings()
    providerKeys.clearSessionKeys()
    store.clearAll()
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
  store
    .getSetting<string[]>('handoff.approvedWorkspaces', [])
    .forEach((path) => approvedWorkspaces.add(path))
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
}).catch(()=>{
  const locale=app.getLocale().toLowerCase()
  const message=locale.startsWith('zh')?'无法打开续迹的本地工作空间。请保留数据文件，关闭其他实例后重试。原始 Agent 历史没有被修改。':locale.startsWith('es')?'No se pudo abrir el espacio local. Conserva los archivos de datos, cierra otras instancias y vuelve a intentarlo. Los historiales originales no se modificaron.':locale.startsWith('ja')?'ローカル作業空間を開けませんでした。データを保管し、ほかの起動中のアプリを閉じて再試行してください。元の Agent 履歴は変更していません。':'The local workspace could not be opened. Keep the data files, close other instances, and try again. Original agent histories were not changed.'
  dialog.showErrorBox('Carrythread',message)
  app.quit()
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('before-quit', () => {
  reviewController?.abort()
  providerKeys.clearSessionKeys()
  store?.close()
})
