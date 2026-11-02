import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { chromium, type Browser, type Page } from 'playwright'
import { Store } from '../src/core/store'
import type { AppSettings, HandoffPackage, SourceMessage } from '../src/core/contracts'

const root = await mkdtemp(join(tmpdir(), 'carrythread-packaged-e2e-'))
const sourceRoot = join(root, 'history'),
  dataRoot = join(root, 'app')
await mkdir(sourceRoot)
await mkdir(dataRoot)
const continuedRoot=join(root,'claude-history'), continuedWorkspace=join(root,'second-workspace')
await mkdir(continuedRoot); await mkdir(continuedWorkspace)
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
  sources: [{ id: 'fixture-source', agent: 'generic', path: sourceRoot, enabled: true }, { id: 'fixture-claude', agent: 'claude', path: continuedRoot, enabled: true }],
  providers: [],
  activeProviderId: null,
}
seed.setSetting('app.settings', settings)
seed.close()
const syntheticAuthKey = `synthetic-auth-${randomUUID()}`
let expectedAuth: string | undefined
let nativeKeyMode = 'not-exercised'
let helperRejectsNonAppParent: boolean | 'not-applicable' = process.platform === 'darwin' ? false : 'not-applicable'
let providerRequests = 0
const transportErrors: string[] = []
let delayNext = false
let notifySlowRequest: (() => void) | undefined
let requireContinuity = false
let verifiedContinuation = false
const server = createServer((req, res) => { void (async () => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  const body = JSON.parse(Buffer.concat(chunks).toString() || '{}')
  assert.equal(req.url, '/v1/chat/completions')
  assert.equal(
    req.headers.authorization,
    expectedAuth,
    'Only the expected synthetic authorization may reach the local endpoint',
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
})().catch(() => { transportErrors.push('SYNTHETIC_HTTP_ASSERTION_FAILED'); if (!res.destroyed) { res.writeHead(500); res.end('Synthetic test failed') } }) })
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = (server.address() as { port: number }).port
const env: Record<string, string> = Object.fromEntries(
  Object.entries({ ...process.env, CARRYTHREAD_DATA_DIR: dataRoot }).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  ),
)
delete env.ELECTRON_RUN_AS_NODE
delete env.NODE_OPTIONS
const executable = process.env.CARRYTHREAD_EXECUTABLE
assert.ok(executable, 'This test must run a packaged executable')
const argv = [
  '--remote-debugging-port=0',
  ...(process.platform === 'linux' && process.env.CI ? ['--no-sandbox'] : []),
  ...(process.platform === 'win32' && process.env.CI ? ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] : []),
]
assert.ok(!argv.some(arg => arg.startsWith('--inspect')))
type Exit = { code: number | null; signal: NodeJS.Signals | null }
type Running = { page: Page; browser: Browser; child: ChildProcess; exited: Promise<Exit>; close(): Promise<void> }
let app: Running | undefined
let page: Page | undefined
let lastStderr = ''
let forcedCleanup = false
let normalExits = 0
async function bounded<T>(promise: Promise<T>, milliseconds: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer=setTimeout(() => reject(new Error(label)), milliseconds) })]) }
  finally { if (timer) clearTimeout(timer) }
}
async function launch(): Promise<Running> {
  let endpointResolve!: (endpoint: string) => void
  let endpointReject!: (error: Error) => void
  const endpoint = new Promise<string>((resolve, reject) => { endpointResolve=resolve; endpointReject=reject })
  const child = spawn(executable!, argv, { env, stdio: ['ignore','pipe','pipe'] })
  let stderr = '', exitResult: Exit | undefined, browser: Browser | undefined
  const exited = new Promise<Exit>(resolve => child.once('exit', (code, signal) => { exitResult={code,signal}; resolve(exitResult); endpointReject(new Error('PACKAGED_EXITED_BEFORE_DEVTOOLS')) }))
  child.once('error', endpointReject)
  child.stderr!.on('data', chunk => {
    stderr=(stderr+String(chunk)).slice(-64_000); lastStderr=stderr
    const match=/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[^\s]+)/.exec(stderr)
    if (match) endpointResolve(match[1])
  })
  child.stdout!.resume()
  try {
    browser=await chromium.connectOverCDP(await bounded(endpoint,30_000,'PACKAGED_DEVTOOLS_TIMEOUT'),{timeout:30_000})
    const context=browser.contexts()[0]
    const surface=context.pages()[0] ?? await context.waitForEvent('page',{timeout:30_000})
    await surface.waitForURL(url=>url.protocol==='file:'&&url.pathname.endsWith('/renderer/index.html'))
    await surface.waitForFunction(()=>typeof window.carrythread?.snapshot==='function',undefined,{polling:100})
    surface.on('pageerror', error=>errors.push(error.message))
    return { page:surface,browser,child,exited,close:async()=>{
      if (!exitResult) await surface.evaluate(()=>{ void window.carrythread.quit() }).catch(()=>undefined)
      const result=await bounded(exited,10_000,'PACKAGED_NATIVE_QUIT_TIMEOUT')
      assert.equal(result.code,0);assert.equal(result.signal,null)
      assert.ok(!/^Debugger listening/m.test(stderr),'The Node inspector must stay disabled')
      await browser!.close(); normalExits++
    }}
  } catch(error) {
    if (!exitResult) { forcedCleanup=true; child.kill('SIGKILL'); await bounded(exited,5000,'PACKAGED_CLEANUP_TIMEOUT').catch(()=>undefined) }
    await browser?.close().catch(()=>undefined)
    throw error
  }
}
function storedHandoff(): HandoffPackage {
  const db = new DatabaseSync(join(dataRoot,'carrythread.db'), {readOnly:true})
  try { const row=db.prepare('SELECT data FROM handoffs ORDER BY rowid DESC LIMIT 1').get();assert.ok(row);return JSON.parse(String(row.data)) as HandoffPackage }
  finally {db.close()}
}
async function verifyHelperBoundary(): Promise<void> {
  if (process.platform !== 'darwin') return
  const directory=await mkdtemp(join(await realpath(tmpdir()),'carrythread-key-helper-'))
  const request={operation:'decrypt',value:Buffer.from('synthetic-invalid-cipher').toString('base64'),requestId:randomUUID()}
  const denied=spawn(executable!,['--carrythread-key-storage-helper',`--carrythread-key-storage-parent=${process.pid}`],{env:{...env,CARRYTHREAD_DATA_DIR:directory},stdio:['pipe','pipe','ignore']})
  let output=''
  const ended=new Promise<Exit>((resolve,reject)=>{denied.once('exit',(code,signal)=>resolve({code,signal}));denied.once('error',reject)})
  denied.stdout!.on('data',chunk=>{output+=String(chunk)})
  denied.stdin!.on('error',()=>undefined)
  denied.stdin!.end(JSON.stringify(request))
  try {
    const result=await bounded(ended,5000,'UNTRUSTED_HELPER_DID_NOT_EXIT')
    assert.equal(result.code,1);assert.equal(result.signal,null)
    assert.equal(output,'','An untrusted Node parent must be rejected before reading or processing a decrypt request')
    helperRejectsNonAppParent=true
  } finally {
    if(denied.exitCode===null&&denied.signalCode===null) {forcedCleanup=true;denied.kill('SIGKILL');await ended.catch(()=>undefined)}
    await rm(directory,{recursive:true,force:true})
  }
}
const errors: string[] = []
const screenshots = resolve('work/e2e-screenshots')
await mkdir(screenshots, { recursive: true })
try {
  app = await launch()
  page = app.page
  page.on('pageerror', (error) => errors.push(error.message))
  // firstWindow may be reported before its initial about:blank navigation finishes.
  await page.waitForURL((url) => url.protocol === 'file:' && url.pathname.endsWith('/renderer/index.html'))
  await writeFile(join(screenshots, 'startup-probe.json'), JSON.stringify(await page.evaluate(() => {
    const probe = { bridge: typeof window.carrythread?.snapshot, readyState: document.readyState, visibilityState: document.visibilityState, raf: false, timer: false }
    ;(window as unknown as { carrythreadE2EProbe: typeof probe }).carrythreadE2EProbe = probe
    requestAnimationFrame(() => { probe.raf = true })
    setTimeout(() => { probe.timer = true }, 100)
    return probe
  }), null, 2))
  await page.waitForFunction(() => typeof window.carrythread?.snapshot === 'function')
  const bootstrap = await page.evaluate(() => window.carrythread.snapshot())
  assert.ok(bootstrap.settings.sources.some(source => source.id === 'fixture-source'), 'The isolated synthetic profile must be loaded before exercising the UI')
  await verifyHelperBoundary()
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
  const handoff = storedHandoff()
  assert.equal(handoff.content, packageContent)
  assert.equal(await readFile(handoff.path, 'utf8'), packageContent)
  const copied = handoff.prompt
  assert.ok(copied.includes('Carrythread') && /[\\/]handoffs[\\/]/.test(copied))
  await page.screenshot({ path: join(screenshots, 'handoff-en.png') })
  await modal.getByRole('button', { name: 'Close', exact: true }).click()
  const continuedId=randomUUID(),continuedAt=new Date().toISOString()
  await writeFile(join(continuedRoot,'continued.jsonl'),[
    {type:'custom-title',sessionId:continuedId,customTitle:'Atlas continuation in Claude'},
    {type:'user',sessionId:continuedId,uuid:randomUUID(),timestamp:continuedAt,cwd:continuedWorkspace,message:{role:'user',content:copied}},
    {type:'assistant',sessionId:continuedId,uuid:randomUUID(),timestamp:continuedAt,cwd:continuedWorkspace,message:{role:'assistant',content:'I have the previous decisions. Acceptance is still pending; no publication is confirmed.'}},
  ].map(row=>JSON.stringify(row)).join('\n')+'\n')
  await page.getByRole('button',{name:'Sources',exact:true}).click()
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
  if (process.platform === 'darwin') {
    await page.getByRole('button',{name:'AI connections',exact:true}).click()
    await page.locator('.provider-card').getByRole('button',{name:'Correct this item',exact:true}).click()
    await modal.getByLabel('API key',{exact:true}).fill(syntheticAuthKey)
    const started=performance.now()
    await modal.getByRole('button',{name:'Save',exact:true}).click()
    await modal.waitFor({state:'hidden'})
    assert.ok(performance.now()-started<12_000,'Native key storage must have a bounded response')
    const connected=(await page.evaluate(()=>window.carrythread.snapshot())).settings.providers[0]
    assert.equal(connected.hasKey,true)
    nativeKeyMode=connected.keyStorage ?? 'unknown'
    assert.ok(['encrypted','session'].includes(nativeKeyMode))
    expectedAuth=`Bearer ${syntheticAuthKey}`
    const tested=await page.evaluate(id=>window.carrythread.testProvider(id),connected.id)
    assert.equal(tested.ok,true)
  }
  await app.close()
  app = await launch()
  page = app.page
  modal = page.locator('dialog')
  await page.getByRole('button', { name: 'Settings', exact: true }).waitFor()
  const reopened = await page.evaluate(() => window.carrythread.snapshot())
  assert.equal(reopened.items[0].id, state.items[0].id)
  assert.equal(reopened.items[0].state, 'paused')
  assert.equal(reopened.settings.theme, 'dark')
  assert.equal(reopened.settings.providers.length, 1)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  if (process.platform === 'darwin') {
    const connected=reopened.settings.providers[0]
    assert.equal(connected.hasKey,nativeKeyMode==='encrypted')
    expectedAuth=nativeKeyMode==='encrypted'?`Bearer ${syntheticAuthKey}`:undefined
    assert.equal((await page.evaluate(id=>window.carrythread.testProvider(id),connected.id)).ok,true)
  }
  await app.close()
  const offline = new Store(join(dataRoot,'carrythread.db'))
  const exported=offline.exportData()
  offline.close()
  assert.equal(exported.schemaVersion,1);assert.equal(exported.items.length,1)
  assert.ok(!JSON.stringify(exported).includes(syntheticAuthKey))
  assert.equal((exported as unknown as Record<string,unknown>).settings,undefined)
  assert.equal((exported as unknown as Record<string,unknown>).handoffs,undefined)
  for (const name of ['carrythread.db','carrythread.db-wal','carrythread.db-shm']) {
    const bytes=await readFile(join(dataRoot,name)).catch(()=>null)
    if (bytes) {assert.ok(!bytes.includes(Buffer.from(syntheticAuthKey)));assert.ok(!bytes.includes(Buffer.from(syntheticAuthKey,'utf16le')))}
  }
  app=await launch();page=app.page;modal=page.locator('dialog')
  await page.getByRole('button',{name:'Settings',exact:true}).click()
  await page.getByRole('button', { name: 'Clear local Carrythread data', exact: true }).click()
  await modal.getByRole('button', { name: 'Confirm', exact: true }).click()
  await modal.waitFor({ state: 'hidden' })
  const cleared = await page.evaluate(() => window.carrythread.snapshot())
  assert.equal(cleared.items.length, 0)
  assert.equal(cleared.sessions.length, 0)
  assert.equal(cleared.settings.providers.length, 0)
  assert.equal(await readFile(join(sourceRoot, 'atlas.json'), 'utf8'), originalSource)
  await app.close()
  const restored=new Store(join(dataRoot,'carrythread.db'))
  restored.importData(exported);restored.close()
  app=await launch();page=app.page
  const imported = await page.evaluate(() => window.carrythread.snapshot())
  assert.equal(imported.items[0].id, reopened.items[0].id)
  assert.equal(imported.items[0].state, 'paused')
  assert.equal(imported.settings.providers.length, 0)
  await page.getByRole('button',{name:'Settings',exact:true}).click()
  const quitClick=page.getByRole('button',{name:'Quit Carrythread',exact:true}).click()
  const finalExit=await bounded(app.exited,10_000,'QUIT_BUTTON_DID_NOT_EXIT')
  assert.equal(finalExit.code,0);assert.equal(finalExit.signal,null)
  await quitClick.catch(error=>{assert.match(String(error),/closed|destroyed/i)})
  await app.close(); app=undefined
  assert.deepEqual(transportErrors,[])
  assert.equal(forcedCleanup,false)
  const result = {
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
        portableDataRoundTrip: true,
        nativeDialogPath: 'Covered by source E2E; no main-process test hooks in the hardened binary',
        clearLeavesOriginalSources: true,
        clipboardCopyUi: true,
        handoffFileAndRegisteredPromptVerified: true,
        sourcePicker: 'Preselected synthetic sources; native chooser is covered by source E2E',
        crossAgentContinuation: true,
        handoffFile: true,
        nativeAgentStarted: false,
        nodeInspector: false,
        nativeKeyMode,
        helperRejectsNonAppParent,
        normalExits,
        forcedCleanup,
        transportErrors,
        locales: ['en', 'zh-CN', 'es', 'ja'],
        errors,
        screenshots,
  }
  await writeFile(resolve('work/packaged-e2e-result.json'),JSON.stringify(result,null,2)+'\n')
  console.log(JSON.stringify(result,null,2))
} catch (error) {
  await writeFile(join(screenshots,'failure-runtime.txt'),lastStderr)
  await page?.screenshot({ path: join(screenshots, 'failure.png') }).catch(() => undefined)
  if (page) await writeFile(join(screenshots, 'failure-dom.json'), JSON.stringify(await page.evaluate(() => ({
    url: location.href,
    readyState: document.readyState,
    visibilityState: document.visibilityState,
    timingProbe: (window as unknown as { carrythreadE2EProbe?: unknown }).carrythreadE2EProbe,
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
  if (app) await app.close().catch(async()=>{forcedCleanup=true;app!.child.kill('SIGKILL');await bounded(app!.exited,5000,'CLEANUP_TIMEOUT').catch(()=>undefined);await app!.browser.close().catch(()=>undefined)})
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await rm(root, { recursive: true, force: true })
}
