import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { _electron as electron } from 'playwright'
import { Store } from '../src/core/store'
import type { AppSettings, SourceMessage } from '../src/core/contracts'

const require = createRequire(import.meta.url)
const root = await mkdtemp(join(tmpdir(), 'carrythread-e2e-'))
const sourceRoot = join(root, 'history'),
  dataRoot = join(root, 'app')
await mkdir(sourceRoot)
await mkdir(dataRoot)
const timestamp = new Date().toISOString()
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
        text: 'Implementation is ready for acceptance. Production publication has not been checked.',
      },
    ],
  }),
)
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
  let content = 'OK'
  if (prompt.includes('AVAILABLE_MESSAGES')) {
    const messages = JSON.parse(
      prompt.split('AVAILABLE_MESSAGES (chronological):\n')[1],
    ) as SourceMessage[]
    const message = messages.find((m) => m.role === 'user')!
    content = JSON.stringify({
      items: [
        {
          project: 'Atlas',
          title: 'Verify onboarding',
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
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(
    JSON.stringify({
      choices: [{ finish_reason: 'stop', message: { role: 'assistant', content } }],
    }),
  )
})
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = (server.address() as { port: number }).port
const env: Record<string, string> = Object.fromEntries(
  Object.entries({ ...process.env, CARRYTHREAD_DATA_DIR: dataRoot }).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  ),
)
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({
  executablePath: require('electron'),
  args: [resolve('out/main/index.cjs')],
  env,
  timeout: 30_000,
})
const page = await app.firstWindow()
const errors: string[] = []
page.on('pageerror', (error) => errors.push(error.message))
const screenshots = resolve('work/e2e-screenshots')
await mkdir(screenshots, { recursive: true })
try {
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
  const modal = page.locator('dialog')
  await modal.getByLabel('Name', { exact: true }).fill('Synthetic local test')
  await modal.getByLabel('API base URL', { exact: true }).fill(`http://127.0.0.1:${port}/v1`)
  await modal.getByLabel('Model ID', { exact: true }).fill('fixture-model')
  await modal.getByRole('button', { name: 'Save', exact: true }).click()
  await modal.waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: 'Test connection', exact: true }).click()
  await page.getByText('Connection test succeeded.', { exact: true }).waitFor()
  await page.getByRole('banner').getByRole('button', { name: 'Review with AI', exact: true }).click()
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
  await page.screenshot({ path: join(screenshots, 'handoff-en.png') })
  await modal.getByRole('button', { name: 'Close', exact: true }).click()
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
    assert.equal(await page.getByRole('combobox', { name: label, exact: true }).inputValue(), locale)
    await page.screenshot({ path: join(screenshots, `settings-${locale}.png`) })
  }
  await page.getByLabel('Appearance', { exact: true }).selectOption('dark')
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
  await page.screenshot({ path: join(screenshots, 'settings-dark.png') })
  assert.equal(providerRequests, 2)
  assert.deepEqual(errors, [])
  const state = await page.evaluate(() => window.carrythread.snapshot())
  assert.equal(state.items.length, 1)
  assert.equal(state.items[0].state, 'paused')
  assert.equal(state.items[0].manualOverride, true)
  assert.equal(state.sessions.length, 1)
  console.log(
    JSON.stringify(
      {
        ok: true,
        importedSessions: 1,
        reviewItems: 1,
        providerRequests,
        realNetworkTransport: 'localhost synthetic server',
        externalModelTested: false,
        protectedCorrection: true,
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
} catch(error) {
  await page.screenshot({path:join(screenshots,'failure.png')}).catch(()=>undefined)
  await writeFile(join(screenshots,'failure.txt'),await page.locator('body').innerText().catch(()=>''))
  throw error
} finally {
  await app.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await rm(root, { recursive: true, force: true })
}
