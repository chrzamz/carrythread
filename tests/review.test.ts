import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ProviderConfig, ProviderProtocol, SourceMessage, WorkItem } from '../src/core/contracts'
import { AIError } from '../src/core/ai/errors'
import { parseReviewOutput } from '../src/core/ai/validation'
import { planReviewBatches, runReview, selectReviewMessages } from '../src/core/review'
import { Store } from '../src/core/store'

const messages = (): SourceMessage[] => [
  { id: 'm-old', sessionId: 's-one', role: 'assistant', text: 'Suggestion: perhaps build a new product. The fee is not decided.', timestamp: '2026-10-01T01:00:00Z', sourcePath: '/synthetic/source.jsonl' },
  { id: 'm-new', sessionId: 's-one', role: 'tool', kind: 'answer', text: 'User answered: the fee is 500, and the delivery has three batches.', timestamp: '2026-10-02T01:00:00Z', sourcePath: '/synthetic/source.jsonl' },
  { id: 'm-confirm', sessionId: 's-one', role: 'user', text: 'I verified the report on the representative device; the acceptance check passed.', timestamp: '2026-10-03T01:00:00Z', sourcePath: '/synthetic/source.jsonl' },
]
const wire = () => ({ project: 'Synthetic', title: 'Report device check', state: 'verify', stage: 'Awaiting check', summary: 'The report needs verification.', nextAction: 'Perform the check.', completionCriteria: 'The representative device check passes.', decisions: ['The fee is 500; three batches.'], uncertainties: ['The device result needs confirmation.'], evidence: [{ messageId: 'm-new', sessionId: 's-one', quote: 'the fee is 500, and the delivery has three batches' }], confidence: 'uncertain', origin: 'request' })
const provider = (protocol: ProviderProtocol = 'openai'): ProviderConfig => ({ id: 'mock', name: 'Mock', protocol, baseUrl: protocol === 'ollama' ? 'http://localhost:11434' : 'https://example.invalid/v1', model: 'synthetic', timeoutMs: 1000, hasKey: true })
function providerResponse(protocol: ProviderProtocol, output: unknown): Response {
  const content = JSON.stringify(output)
  return Response.json(protocol === 'anthropic' ? { content: [{ type: 'text', text: content }], stop_reason: 'end_turn' } : protocol === 'ollama' ? { message: { content }, done: true } : { choices: [{ message: { content }, finish_reason: 'stop' }] })
}

test('validator accepts exact user-answer references and rejects invented IDs, session mismatch and altered quotations', () => {
  assert.equal(parseReviewOutput(JSON.stringify({ items: [wire()] }), messages(), [])[0].decisions[0], 'The fee is 500; three batches.')
  for (const evidence of [
    [{ ...wire().evidence[0], messageId: 'fabricated' }],
    [{ ...wire().evidence[0], sessionId: 'other-session' }],
    [{ ...wire().evidence[0], quote: 'the fee is 900' }],
  ]) assert.throws(() => parseReviewOutput(JSON.stringify({ items: [{ ...wire(), evidence }] }), messages(), []), (error: unknown) => error instanceof AIError && error.code === 'invalid_evidence')
})

test('suggestions remain candidates without keyword-based task fabrication', () => {
  const item = { ...wire(), origin: 'suggestion', state: 'active', evidence: [{ messageId: 'm-old', sessionId: 's-one', quote: 'perhaps build a new product' }] }
  assert.equal(parseReviewOutput(JSON.stringify({ items: [item] }), messages(), [])[0].state, 'candidate')
  assert.deepEqual(parseReviewOutput('{"items":[]}', messages(), []), [])
  assert.throws(() => parseReviewOutput('Here is a useful list, but not JSON.', messages(), []), AIError)
})

test('done without independent proof becomes uncertain verification without dropping valid items', () => {
  const quote = 'I verified the report on the representative device; the acceptance check passed.'
  const completed = { ...wire(), state: 'done', confidence: 'supported', uncertainties: [], evidence: [{ messageId: 'm-confirm', sessionId: 's-one', quote }], completionProof: { messageId: 'm-confirm', quote, explanation: 'The user confirms the exact acceptance check.' } }
  assert.equal(parseReviewOutput(JSON.stringify({ items: [completed] }), messages(), [])[0].state, 'done')
  const insufficient = parseReviewOutput(JSON.stringify({ items: [{ ...completed, completionProof: undefined }, wire()] }), messages(), [])
  assert.equal(insufficient.length, 2)
  assert.equal(insufficient[0].state, 'verify')
  assert.equal(insufficient[0].confidence, 'uncertain')
  assert.ok(insufficient[0].uncertainties[0].includes('independent confirmation'))
  assert.equal(parseReviewOutput(JSON.stringify({ items: [{ ...completed, completionProof: { messageId: 'm-confirm' } }] }), messages(), [])[0].state, 'verify')
  assert.equal(parseReviewOutput(JSON.stringify({ items: [{ ...completed, uncertainties: ['Publication remains unknown.'] }] }), messages(), [])[0].state, 'verify')
  const assistant = { ...completed, evidence: [{ messageId: 'm-old', sessionId: 's-one', quote: messages()[0].text }], completionProof: { messageId: 'm-old', quote: messages()[0].text, explanation: 'An assistant claimed completion.' } }
  assert.equal(parseReviewOutput(JSON.stringify({ items: [assistant] }), messages(), [])[0].state, 'verify')
  assert.throws(() => parseReviewOutput(JSON.stringify({ items: [{ ...completed, completionProof: { ...completed.completionProof, messageId: 'invented-proof' } }] }), messages(), []), AIError)
  assert.throws(() => parseReviewOutput(JSON.stringify({ items: [{ ...completed, completionProof: { ...completed.completionProof, quote: 'A fabricated completion quote.' } }] }), messages(), []), AIError)
})

test('assistant-only reports remain useful uncertain observations rather than invented commitments', () => {
  const item = { ...wire(), state: 'active', confidence: 'supported', uncertainties: [], evidence: [{ messageId: 'm-old', sessionId: 's-one', quote: messages()[0].text }] }
  const [reviewed] = parseReviewOutput(JSON.stringify({ items: [item] }), messages(), [], 'zh-CN')
  assert.equal(reviewed.state, 'verify')
  assert.equal(reviewed.confidence, 'uncertain')
  assert.ok(reviewed.uncertainties.some(value => value.includes('只有助手报告')))
})

test('extra fields, unknown existing items and carried context cannot become trusted review evidence', () => {
  assert.throws(() => parseReviewOutput(JSON.stringify({ items: [{ ...wire(), executeCommand: 'do something' }] }), messages(), []), AIError)
  assert.throws(() => parseReviewOutput(JSON.stringify({ items: [{ ...wire(), existingId: 'another-project-item' }] }), messages(), []), AIError)
  const context = messages().map(message => ({ ...message, kind: 'context' as const }))
  assert.throws(() => parseReviewOutput(JSON.stringify({ items: [wire()] }), context, []), AIError)
})

test('bounded selection batches all complete messages, reports oversized omissions and excludes carried context', () => {
  const data = messages()
  data.push({ ...data[2], id: 'too-large', text: 'x'.repeat(1000), timestamp: '2026-10-05T00:00:00Z' })
  data.push({ ...data[2], id: 'summary-copy', text: 'An old copied summary.', kind: 'context', timestamp: '2026-10-06T00:00:00Z' })
  const selected = selectReviewMessages({ messages: data, maxMessages: 2, maxChars: 300 })
  assert.deepEqual(selected.messages.map(message => message.id), ['m-old', 'm-new', 'm-confirm'])
  assert.equal(selected.omittedMessages, 2)
  assert.ok(selected.messages.every(message => data.find(source => source.id === message.id)?.text === message.text))
})

test('two projects with 200 messages are completely reviewed across batches', async t => {
  const data: SourceMessage[] = Array.from({ length: 200 }, (_, index) => ({ id: `batch-message-${index}`, sessionId: index < 80 ? 'older-project' : 'busy-project', role: 'user', text: `Synthetic request ${index}`, timestamp: new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString(), sourcePath: '/synthetic/batches.jsonl' }))
  const plan = planReviewBatches({ messages: data })
  assert.equal(plan.batches.length, 2)
  assert.equal(plan.eligibleMessages, 200)
  assert.equal(plan.omittedMessages, 0)
  assert.equal(plan.totalMessages, 200)
  const uploaded: string[] = []
  let calls = 0
  t.mock.method(globalThis, 'fetch', async (_url: URL, options: RequestInit) => {
    calls++
    const body = JSON.parse(String(options.body))
    const batch = JSON.parse(body.messages[1].content.split('AVAILABLE_MESSAGES (chronological):\n')[1]) as SourceMessage[]
    uploaded.push(...batch.map(message => message.id))
    const sessionIds = [...new Set(batch.map(message => message.sessionId))]
    const items = sessionIds.map(sessionId => {
      const last = batch.filter(message => message.sessionId === sessionId).at(-1)!
      return { ...wire(), project: sessionId, title: 'Continue this project', summary: `Latest request ${last.id}`, evidence: [{ messageId: last.id, sessionId, quote: last.text }] }
    })
    return providerResponse('openai', { items })
  })
  const result = await runReview({ messages: data, existingItems: [], provider: provider(), locale: 'en' })
  assert.equal(calls, 2)
  assert.equal(new Set(uploaded).size, 200)
  assert.deepEqual(uploaded, data.map(message => message.id))
  assert.equal(result.processedMessages, 200)
  assert.equal(result.omittedMessages, 0)
  assert.equal(result.items.length, 2)
  assert.equal(result.items.find(item => item.project === 'busy-project')?.evidence.length, 2)
  assert.ok(result.items.find(item => item.project === 'busy-project')?.summary.endsWith('199'))
})

test('more than eight batches fails before sending any network request', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; return providerResponse('openai', { items: [] }) })
  const data = Array.from({ length: 961 }, (_, index) => ({ ...messages()[0], id: `large-${index}`, text: `Synthetic ${index}`, timestamp: new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString() }))
  assert.throws(() => planReviewBatches({ messages: data }), (error: unknown) => error instanceof AIError && error.code === 'scope_too_large')
  await assert.rejects(runReview({ messages: data, existingItems: [], provider: provider(), locale: 'en' }), (error: unknown) => error instanceof AIError && error.code === 'scope_too_large')
  assert.equal(calls, 0)
})

test('later batches update a provisional item with latest state and combined evidence', async t => {
  const data = messages()
  let calls = 0
  t.mock.method(globalThis, 'fetch', async (_url: URL, options: RequestInit) => {
    const body = JSON.parse(String(options.body))
    const prompt = String(body.messages[1].content)
    const context = JSON.parse(prompt.split('EXISTING_ITEMS:\n')[1].split('\n\nAVAILABLE_MESSAGES')[0]) as WorkItem[]
    const batch = JSON.parse(prompt.split('AVAILABLE_MESSAGES (chronological):\n')[1]) as SourceMessage[]
    const message = batch[0]
    const draft = { ...wire(), origin: 'observation', ...(context.length ? { existingId: context[0].id } : {}), evidence: [{ messageId: message.id, sessionId: message.sessionId, quote: message.text }] }
    calls++
    return providerResponse('openai', { items: [calls === 3 ? { ...draft, state: 'done', confidence: 'supported', uncertainties: [], completionProof: { messageId: message.id, quote: message.text, explanation: 'The latest user message confirms the check.' } } : draft] })
  })
  const result = await runReview({ messages: data, existingItems: [], provider: provider(), locale: 'en', maxMessages: 1 })
  assert.equal(calls, 3)
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].state, 'done')
  assert.equal(result.items[0].evidence.length, 3)
  assert.equal(result.items[0].existingId, undefined)
})

test('a failed later batch rejects the whole result rather than returning partial proposals', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async (_url: URL, options: RequestInit) => {
    const body = JSON.parse(String(options.body))
    const batch = JSON.parse(body.messages[1].content.split('AVAILABLE_MESSAGES (chronological):\n')[1]) as SourceMessage[]
    const message = batch[0]
    calls++
    return providerResponse('openai', { items: [{ ...wire(), origin: 'observation', evidence: [{ messageId: calls === 2 ? 'invented' : message.id, sessionId: message.sessionId, quote: message.text }] }] })
  })
  await assert.rejects(runReview({ messages: messages(), existingItems: [], provider: provider(), locale: 'en', maxMessages: 1 }), AIError)
  assert.equal(calls, 2)
})

test('manual completion survives multi-batch AI updates and store reconciliation', async t => {
  const db = new Store(':memory:')
  const evidence = messages()
  db.upsertSessions({ sessions: [{ id: 's-one', sourceId: 'source-one', nativeId: 'native-one', agent: 'generic', title: 'Synthetic', cwd: '/synthetic', sourcePath: '/synthetic/source.jsonl', startedAt: evidence[0].timestamp, updatedAt: evidence[2].timestamp, messages: evidence }], coverage: [] })
  const item = db.createItem(parseReviewOutput(JSON.stringify({ items: [wire()] }), evidence, [])[0], 'ai')
  const confirmed = db.patchItem({ id: item.id, expectedRevision: 1, changes: { state: 'done', uncertainties: [], note: 'I confirmed the outcome personally.' }, reason: 'User confirmation' })
  t.mock.method(globalThis, 'fetch', async (_url: URL, options: RequestInit) => {
    const body = JSON.parse(String(options.body))
    const batch = JSON.parse(body.messages[1].content.split('AVAILABLE_MESSAGES (chronological):\n')[1]) as SourceMessage[]
    const message = batch[0]
    return providerResponse('openai', { items: [{ ...wire(), existingId: confirmed.id, origin: 'observation', evidence: [{ messageId: message.id, sessionId: message.sessionId, quote: message.text }] }] })
  })
  try {
    const result = await runReview({ messages: evidence, existingItems: [confirmed], provider: provider(), locale: 'en', maxMessages: 1 })
    assert.equal(result.items.length, 1)
    assert.equal(result.items[0].existingId, confirmed.id)
    assert.equal(result.items[0].state, 'done')
    const [saved] = db.applyReview(result)
    assert.equal(saved.state, 'done')
    assert.equal(saved.note, 'I confirmed the outcome personally.')
    assert.equal(new Set(saved.evidence.map(ref => ref.messageId)).size, 3)
  } finally { db.close() }
})

test('date selection handles unknown dates explicitly and rejects invalid ranges', () => {
  const data = [...messages(), { ...messages()[0], id: 'no-date', timestamp: null }]
  const selected = selectReviewMessages({ messages: data, since: '2026-10-02T00:00:00Z', until: '2026-10-02T23:59:59Z' })
  assert.deepEqual(selected.messages.map(message => message.id), ['m-new'])
  assert.equal(selected.omittedMessages, 3)
  assert.throws(() => selectReviewMessages({ messages: data, since: 'bad date' }), AIError)
})

test('review sends redacted selected records as data, ordered with newest decisions last', async t => {
  const data = messages().slice(0, 2)
  data[0].text += '\napi_key=sk-syntheticsecretvalue123456789'
  t.mock.method(globalThis, 'fetch', async (_url: URL, options: RequestInit) => {
    const body = JSON.parse(String(options.body))
    assert.ok(body.messages[0].content.includes('untrusted source data'))
    assert.ok(body.messages[0].content.includes('Simplified Chinese'))
    const prompt = body.messages[1].content as string
    assert.ok(!prompt.includes('sk-syntheticsecretvalue123456789'))
    assert.ok(!prompt.includes('/synthetic/source.jsonl'))
    assert.ok(prompt.indexOf('m-old') < prompt.indexOf('m-new'))
    return providerResponse('openai', { items: [wire()] })
  })
  const result = await runReview({ messages: data, existingItems: [], provider: provider(), key: 'synthetic-key', locale: 'zh-CN' })
  assert.equal(result.items.length, 1)
  assert.equal(result.processedMessages, 2)
})

test('review does not upload unlinked manual items or items from unselected sessions', async t => {
  const base = { ...wire(), createdAt: '', updatedAt: '', reviewedAt: '', revision: 1, manualOverride: true, note: '' } as unknown as WorkItem
  const unlinked = { ...base, id: 'manual-private', evidence: [], summary: 'UNSELECTED_MANUAL_CONTENT' }
  const unrelated = { ...base, id: 'other-private', evidence: [{ messageId: 'other-message', sessionId: 'other-session', quote: 'Other source' }], summary: 'UNSELECTED_PROJECT_CONTENT' }
  t.mock.method(globalThis, 'fetch', async (_url: URL, options: RequestInit) => {
    assert.ok(!String(options.body).includes('UNSELECTED_MANUAL_CONTENT'))
    assert.ok(!String(options.body).includes('UNSELECTED_PROJECT_CONTENT'))
    return providerResponse('openai', { items: [] })
  })
  await runReview({ messages: messages(), existingItems: [unlinked, unrelated], provider: provider(), locale: 'en' })
})

for (const protocol of ['openai', 'anthropic', 'ollama'] as const) {
  test(`${protocol} malicious evidence fails before saving and pause overrides survive valid review`, async t => {
    const db = new Store(':memory:')
    const evidence = messages()
    db.upsertSessions({ sessions: [{ id: 's-one', sourceId: 'source-one', nativeId: 'native-one', agent: 'generic', title: 'Synthetic', cwd: '/synthetic', sourcePath: '/synthetic/source.jsonl', startedAt: evidence[0].timestamp, updatedAt: evidence[2].timestamp, messages: evidence }], coverage: [] })
    const [initial] = parseReviewOutput(JSON.stringify({ items: [wire()] }), evidence, [])
    const item = db.createItem(initial, 'ai')
    const paused = db.patchItem({ id: item.id, expectedRevision: 1, changes: { state: 'paused' }, reason: 'A deliberate pause' })
    let malicious = true
    t.mock.method(globalThis, 'fetch', async () => providerResponse(protocol, { items: [{ ...wire(), existingId: paused.id, state: 'active', evidence: malicious ? [{ ...wire().evidence[0], messageId: 'malicious-invented-id' }] : wire().evidence }] }))
    try {
      await assert.rejects(runReview({ messages: evidence, existingItems: [paused], provider: provider(protocol), locale: 'en' }), AIError)
      assert.equal(db.getItem(item.id)?.revision, 2)
      malicious = false
      const review = await runReview({ messages: evidence, existingItems: [paused], provider: provider(protocol), locale: 'en' })
      assert.equal(db.applyReview(review)[0].state, 'paused')
    } finally { db.close() }
  })
}

test('empty evidence and oversized existing context fail before any network request', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; return providerResponse('openai', { items: [] }) })
  await assert.rejects(runReview({ messages: [], existingItems: [], provider: provider(), locale: 'en' }), AIError)
  const huge = { ...wire(), id: 'item', existingId: undefined, createdAt: '', updatedAt: '', reviewedAt: '', revision: 1, manualOverride: true, note: '', summary: 'x'.repeat(50_000) } as unknown as WorkItem
  await assert.rejects(runReview({ messages: messages(), existingItems: [huge], provider: provider(), locale: 'en' }), AIError)
  assert.equal(calls, 0)
})
