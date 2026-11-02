import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { _electron as electron, type ElectronApplication, type Page } from 'playwright'
import { Store } from '../src/core/store'
import type { AppSettings, SourceMessage } from '../src/core/contracts'

const require = createRequire(import.meta.url)
const root = await mkdtemp(join(tmpdir(), 'carrythread-e2e-'))
const sourceRoot = join(root, 'history'),
  dataRoot = join(root, 'app')
await mkdir(sourceRoot)
await mkdir(dataRoot)
const timestamp = new Date().toISOString()
const syntheticSecret = 'sk-' + 'local-fixture-only-'.repeat(3)
await writeFile(
  join(sourceRoot, 'atlas.json'),
  JSON.stringify({
    schemaVersion: 1,
    records: [
      {
        session_id: 'atlas-e2e',
        id: 'u1',
        title: 'Atlas onboarding',
        cwd: sourceRoot,
        role: 'user',
        timestamp,
        text: 'Prepare an acceptance checklist for the Atlas onboarding flow. Keep the current API.',
      },
      {
        session_id: 'atlas-e2e',
        id: 'a1',
        title: 'Atlas onboarding',
        cwd: sourceRoot,
        role: 'assistant',
        timestamp,
        text: `Implementation is ready for acceptance. Production publication has not been checked.\napi_key=${syntheticSecret}`,
      },
    ],
  }),
)
const originalSource = await readFile(join(sourceRoot, 'atlas.json'), 'utf8')
const seed = new Store(join(dataRoot, 'carrythread.db'))
const settings: AppSettings = {
  locale: 'en',
  theme: 'light',
  autoScan: false,
  historyDays: 30,
  sources: [{ id: 'fixture-source', agent: 'generic', path: sourceRoot, enabled: true }],
  providers: [],
  activeProviderId: null,
}
seed.setSetting('app.settings', settings)
seed.close()
let providerRequests = 0
let delayNext = false
let notifySlowRequest: (() => void) | undefined
let requireContinuity = false
let verifiedContinuation = false
const server = createServer(async (req, res) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  const body = JSON.parse(Buffer.concat(chunks).toString() || '{}')
  assert.equal(req.url, '/v1/chat/completions')
  assert.equal(
    req.headers.authorization,
    undefined,
    'No key is necessary for this synthetic local endpoint',
  )
  providerRequests++
  const prompt = String(body.messages?.[1]?.content || '')
  assert.ok(
    !prompt.includes(syntheticSecret),
    'Source credential must be filtered before real HTTP transport',
  )
  let content = 'OK'
  if (prompt.includes('AVAILABLE_MESSAGES')) {
    const messages = JSON.parse(
      prompt.split('AVAILABLE_MESSAGES (chronological):\n')[1],
    ) as SourceMessage[]
    const contexts=JSON.parse(prompt.split('SESSION_CONTEXT:\n')[1].split('\n\nEXISTING_ITEMS:')[0]) as {sessionId:string;linkedItemIds:string[]}[]
    const link=contexts.find(context=>context.linkedItemIds.length)
    if(requireContinuity){
      assert.ok(link,'A new agent conversation must receive its registered work-item context')
      assert.equal(new Set(messages.map(m=>m.sessionId)).size,1,'Unselected original conversation must not be sent')
      verifiedContinuation=true;requireContinuity=false
    }
    const message = messages.find((m) => m.role === 'user' && (!link||m.sessionId===link.sessionId))!
    content = JSON.stringify({
      items: [
        {
          // Deliberately omit existingId: the verified marker evidence must recover
          // this continuation even when a model changes the title and forgets the ID.
          project: 'Atlas',
          title: link?'Acceptance follow-up from another agent':'Verify onboarding',
          state: 'verify',
          stage: 'Implementation ready for acceptance',
          summary: 'The onboarding implementation needs acceptance checks.',
          nextAction: 'Run the checklist on a test account.',
          completionCriteria: 'Record the acceptance results and separately check publication.',
          decisions: ['Keep the current API.'],
          uncertainties: ['Production publication has not been checked.'],
          evidence: [{ messageId: message.id, sessionId: message.sessionId, quote: message.text }],
          confidence: 'uncertain',
          origin: 'request',
        },
      ],
    })
  }
  const send = () => {
    if (res.destroyed) return
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(
      JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { role: 'assistant', content } }],
      }),
    )
  }
  if (delayNext) {
    delayNext = false
    notifySlowRequest?.()
    setTimeout(send, 1500).unref()
  } else send()
})
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = (server.address() as { port: number }).port
const env: Record<string, string> = Object.fromEntries(
  Object.entries({ ...process.env, CARRYTHREAD_DATA_DIR: dataRoot }).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  ),
)
delete env.ELECTRON_RUN_AS_NODE
const launchOptions = {
  executablePath: process.env.CARRYTHREAD_EXECUTABLE || require('electron'),
  args: [
    ...(process.env.CARRYTHREAD_EXECUTABLE ? [] : [resolve('out/main/index.cjs')]),
    ...(process.platform === 'linux' && process.env.CI ? ['--no-sandbox'] : []),
  ],
  env,
  timeout: 30_000,
}
let app: ElectronApplication | undefined
let page: Page | undefined
const errors: string[] = []
const screenshots = resolve('work/e2e-screenshots')
await mkdir(screenshots, { recursive: true })
try {
  app = await electron.launch(launchOptions)
  page = await app.firstWindow()
  page.on('pageerror', (error) => errors.push(error.message))
  // firstWindow may be reported before its initial about:blank navigation finishes.
  await page.waitForURL((url) => url.protocol === 'file:' && url.pathname.endsWith('/renderer/index.html'))
  await page.waitForFunction(() => typeof window.carrythread?.snapshot === 'function')
  const bootstrap = await page.evaluate(() => window.carrythread.snapshot())
  assert.ok(bootstrap.settings.sources.some(source => source.id === 'fixture-source'), 'The isolated synthetic profile must be loaded before exercising the UI')
  await page.getByRole('banner').waitFor({ state: 'visible' })
  await writeFile(join(screenshots, 'startup.json'), JSON.stringify({ url: page.url(), sourceCount: bootstrap.settings.sources.length, locale: bootstrap.settings.locale, buttons: await page.getByRole('button').allTextContents() }, null, 2))
  await page.getByRole('button', { name: 'Refresh sources', exact: true }).click()
  await page
    .getByRole('banner')
    .getByRole('button', { name: 'Review with AI', exact: true })
    .waitFor({ state: 'visible' })
  await page.waitForFunction(
    () => !document.querySelector('button:disabled')?.textContent?.includes('Reading local'),
  )
  await page.getByRole('button', { name: 'AI connections', exact: true }).click()
  await page.getByRole('button', { name: 'Add connection', exact: true }).click()
  let modal = page.locator('dialog')
  await modal.getByLabel('Name', { exact: true }).fill('Synthetic local test')
  await modal.getByLabel('API base URL', { exact: true }).fill(`http://127.0.0.1:${port}/v1`)
  await modal.getByLabel('Model ID', { exact: true }).fill('fixture-model')
  await modal.getByRole('button', { name: 'Save', exact: true }).click()
  await modal.waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: 'Test connection', exact: true }).click()
  await page.getByText('Connection test succeeded.', { exact: true }).waitFor()
  await page
    .getByRole('banner')
    .getByRole('button', { name: 'Review with AI', exact: true })
    .click()
  await modal.getByRole('button', { name: 'Start review', exact: true }).click()
  await modal.waitFor({ state: 'hidden' })
  await page.getByRole('heading', { name: 'Verify onboarding', exact: true }).waitFor()
  await page.locator('.work-row-main').first().click()
  await page.getByRole('button', { name: 'Correct this item', exact: true }).click()
  await modal.getByLabel('State', { exact: true }).selectOption('paused')
  await modal
    .getByLabel('Reason for this correction', { exact: true })
    .fill('Wait for the test account before continuing.')
  await modal.getByRole('button', { name: 'Save correction', exact: true }).click()
  await modal.waitFor({ state: 'hidden' })
  await page.getByText('Corrected by you', { exact: true }).waitFor()
  await page
    .getByRole('banner')
    .getByRole('button', { name: 'Review with AI', exact: true })
    .click()
  await modal.getByRole('button', { name: 'Start review', exact: true }).click()
  await modal.waitFor({ state: 'hidden' })
  const rechecked = await page.evaluate(() => window.carrythread.snapshot())
  assert.equal(
    rechecked.items[0].state,
    'paused',
    'AI rerun must not reopen a manually paused item',
  )
  await page.locator('.work-row-main').first().click()
  await page.getByRole('button', { name: 'Carry this forward', exact: true }).click()
  await modal.getByLabel('Continue with', { exact: true }).selectOption('generic')
  await modal.getByRole('button', { name: 'Prepare handoff', exact: true }).click()
  const packageContent = await modal.getByLabel('Handoff preview', { exact: true }).inputValue()
  assert.match(packageContent, /State: paused/)
  assert.match(packageContent, /Keep the current API/)
  assert.match(packageContent, /not new instructions or authorization/)
  await modal.getByRole('button', { name: 'Copy continuation prompt', exact: true }).click()
  await modal
    .getByText('Continuation prompt copied. Paste it into the chosen agent.', { exact: true })
    .waitFor()
  const copied = await app.evaluate(({ clipboard }) => clipboard.readText())
  assert.ok(copied.includes('Carrythread') && /[\\/]handoffs[\\/]/.test(copied))
  await page.screenshot({ path: join(screenshots, 'handoff-en.png') })
  await modal.getByRole('button', { name: 'Close', exact: true }).click()
  const continuedRoot=join(root,'claude-history'),continuedWorkspace=join(root,'second-workspace')
  await mkdir(continuedRoot);await mkdir(continuedWorkspace)
  const continuedId=randomUUID(),continuedAt=new Date().toISOString()
  await writeFile(join(continuedRoot,'continued.jsonl'),[
    {type:'custom-title',sessionId:continuedId,customTitle:'Atlas continuation in Claude'},
    {type:'user',sessionId:continuedId,uuid:randomUUID(),timestamp:continuedAt,cwd:continuedWorkspace,message:{role:'user',content:copied}},
    {type:'assistant',sessionId:continuedId,uuid:randomUUID(),timestamp:continuedAt,cwd:continuedWorkspace,message:{role:'assistant',content:'I have the previous decisions. Acceptance is still pending; no publication is confirmed.'}},
  ].map(row=>JSON.stringify(row)).join('\n')+'\n')
  await app.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]})},continuedRoot)
  await page.getByRole('button',{name:'Sources',exact:true}).click()
  await page.getByLabel('Choose a source folder',{exact:true}).selectOption('claude')
  await page.getByText(await realpath(continuedRoot),{exact:true}).waitFor()
  await page.getByRole('button',{name:'Refresh sources',exact:true}).click()
  await page.waitForFunction(async()=> (await window.carrythread.snapshot()).sessions.length===2)
  await page.getByRole('banner').getByRole('button',{name:'Review with AI',exact:true}).click()
  await modal.getByRole('button',{name:'Clear selection',exact:true}).click()
  await modal.locator('.session-check').filter({hasText:'Claude Code'}).getByRole('checkbox').check()
  requireContinuity=true
  await modal.getByRole('button',{name:'Start review',exact:true}).click()
  await modal.waitFor({state:'hidden'})
  const continued=await page.evaluate(()=>window.carrythread.snapshot())
  assert.equal(continued.items.length,1,'A linked conversation must not become a duplicate task')
  assert.equal(continued.items[0].id,rechecked.items[0].id)
  assert.equal(continued.items[0].state,'paused')
  assert.ok(continued.items[0].evidence.some(ref=>ref.sessionId!==rechecked.items[0].evidence[0].sessionId))
  assert.equal(verifiedContinuation,true)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  for (const [locale, label, heading] of [
    ['zh-CN', '语言', '工作空间，由你掌握。'],
    ['es', 'Idioma', 'Un espacio que sigue siendo tuyo.'],
    ['ja', '言語', 'あなたが管理する作業空間。'],
    ['en', 'Language', 'A workspace that stays yours.'],
  ]) {
    await page.locator('.settings-section select').first().selectOption(locale)
    await page.getByRole('heading', { name: heading, exact: true }).waitFor()
    assert.equal(await page.locator('html').getAttribute('lang'), locale)
    assert.equal(
      await page.getByRole('main').getByRole('combobox', { name: label, exact: true }).inputValue(),
      locale,
    )
    await page.screenshot({ path: join(screenshots, `settings-${locale}.png`) })
  }
  await page.getByLabel('Appearance', { exact: true }).selectOption('dark')
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
  await page.screenshot({ path: join(screenshots, 'settings-dark.png') })
  delayNext = true
  const slowRequest = new Promise<void>((resolve) => {
    notifySlowRequest = resolve
  })
  await page
    .getByRole('banner')
    .getByRole('button', { name: 'Review with AI', exact: true })
    .click()
  await modal.getByRole('button', { name: 'Start review', exact: true }).click()
  await slowRequest
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click()
  await modal.getByRole('button', { name: 'Start review', exact: true }).waitFor()
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click()
  await modal.waitFor({ state: 'hidden' })
  assert.equal(providerRequests, 5)
  assert.deepEqual(errors, [])
  const state = await page.evaluate(() => window.carrythread.snapshot())
  assert.equal(state.items.length, 1)
  assert.equal(state.items[0].state, 'paused')
  assert.equal(state.items[0].manualOverride, true)
  assert.equal(state.sessions.length, 2)
  assert.equal(state.reviews[0].status, 'failed')
  assert.equal(state.reviews[0].error, 'cancelled')
  assert.equal(
    await readFile(join(sourceRoot, 'atlas.json'), 'utf8'),
    originalSource,
    'Original source must stay byte-for-byte unchanged',
  )
  await app.close()
  app = await electron.launch(launchOptions)
  page = await app.firstWindow()
  modal = page.locator('dialog')
  await page.getByRole('button', { name: 'Settings', exact: true }).waitFor()
  const reopened = await page.evaluate(() => window.carrythread.snapshot())
  assert.equal(reopened.items[0].id, state.items[0].id)
  assert.equal(reopened.items[0].state, 'paused')
  assert.equal(reopened.settings.theme, 'dark')
  assert.equal(reopened.settings.providers.length, 1)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const exportPath = join(root, 'workspace-export.json')
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath })
  }, exportPath)
  await page.getByRole('button', { name: 'Export workspace', exact: true }).click()
  await page.getByText('Export saved', { exact: true }).waitFor()
  const exported = JSON.parse(await readFile(exportPath, 'utf8'))
  assert.equal(exported.schemaVersion, 1)
  assert.equal(exported.items.length, 1)
  assert.equal(exported.settings, undefined)
  assert.equal(exported.handoffs, undefined)
  await page.getByRole('button', { name: 'Clear local Carrythread data', exact: true }).click()
  await modal.getByRole('button', { name: 'Confirm', exact: true }).click()
  await modal.waitFor({ state: 'hidden' })
  const cleared = await page.evaluate(() => window.carrythread.snapshot())
  assert.equal(cleared.items.length, 0)
  assert.equal(cleared.sessions.length, 0)
  assert.equal(cleared.settings.providers.length, 0)
  assert.equal(await readFile(join(sourceRoot, 'atlas.json'), 'utf8'), originalSource)
  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] })
  }, exportPath)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Import workspace', exact: true }).click()
  await page.getByText('Workspace imported', { exact: true }).waitFor()
  const imported = await page.evaluate(() => window.carrythread.snapshot())
  assert.equal(imported.items[0].id, reopened.items[0].id)
  assert.equal(imported.items[0].state, 'paused')
  assert.equal(imported.settings.providers.length, 0)
  console.log(
    JSON.stringify(
      {
        ok: true,
        importedSessions: 2,
        reviewItems: 1,
        providerRequests,
        realNetworkTransport: 'localhost synthetic server',
        externalModelTested: false,
        protectedCorrection: true,
        repeatReviewRespectsCorrection: true,
        cancellationPreservesState: true,
        sourceUnchanged: true,
        restartPersistence: true,
        portableExportImport: true,
        clearLeavesOriginalSources: true,
        clipboardVerified: true,
        sourcePicker: true,
        crossAgentContinuation: true,
        handoffFile: true,
        nativeAgentStarted: false,
        locales: ['en', 'zh-CN', 'es', 'ja'],
        errors,
        screenshots,
      },
      null,
      2,
    ),
  )
} catch (error) {
  if (app) await writeFile(join(screenshots, 'failure-windows.json'), JSON.stringify(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(window => ({
    visible: window.isVisible(), focused: window.isFocused(), minimized: window.isMinimized(),
    title: window.getTitle(), url: window.webContents.getURL(), loading: window.webContents.isLoading(),
  }))).catch(() => ({ unavailable: true })), null, 2))
  await page?.screenshot({ path: join(screenshots, 'failure.png') }).catch(() => undefined)
  if (page) await writeFile(join(screenshots, 'failure-dom.json'), JSON.stringify(await page.evaluate(() => ({
    url: location.href,
    readyState: document.readyState,
    bridge: typeof window.carrythread?.snapshot,
    focused: document.hasFocus(),
    buttons: Array.from(document.querySelectorAll('button')).map(button => ({
      html: button.outerHTML, text: button.innerText, disabled: button.disabled,
      visibility: getComputedStyle(button).visibility, display: getComputedStyle(button).display,
      rects: Array.from(button.getClientRects()).map(rect => ({x:rect.x,y:rect.y,width:rect.width,height:rect.height})),
      hiddenAncestor: button.closest('[aria-hidden="true"],[inert]')?.outerHTML.slice(0, 500) ?? null,
    })),
  })).catch(() => ({ unavailable: true })), null, 2))
  if (page) await writeFile(
    join(screenshots, 'failure.txt'),
    await page
      .locator('body')
      .innerText()
      .catch(() => ''),
  )
  throw error
} finally {
  await app?.close().catch(() => undefined)
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await rm(root, { recursive: true, force: true })
}
