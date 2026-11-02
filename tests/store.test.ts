import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { AgentSession, AppSettings, HandoffPackage, ReviewResult, WorkItemDraft } from '../src/core/contracts'
import { Store, StoreError } from '../src/core/store'

const session = (): AgentSession => ({
  id: 'session-1', sourceId: 'source-1', nativeId: 'native-1', agent: 'claude', title: 'Synthetic project', cwd: '/synthetic/project', sourcePath: '/synthetic/session.jsonl', startedAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z',
  messages: [
    { id: 'message-1', sessionId: 'session-1', role: 'user', text: 'Build a report and verify it on a real device.', timestamp: '2026-10-01T00:00:00Z', sourcePath: '/synthetic/session.jsonl', line: 1 },
    { id: 'message-2', sessionId: 'session-1', role: 'assistant', text: 'The implementation is ready; device verification is still missing. 50% is a literal search.', timestamp: '2026-10-02T00:00:00Z', sourcePath: '/synthetic/session.jsonl', line: 2 },
  ],
})
const draft = (): WorkItemDraft => ({ project: 'Synthetic', title: 'Verify report on device', state: 'verify', stage: 'Implemented', summary: 'Device verification remains.', nextAction: 'Run the device check.', completionCriteria: 'Representative device check passes.', decisions: [], uncertainties: ['Device result is unknown.'], evidence: [{ messageId: 'message-2', sessionId: 'session-1', quote: 'device verification is still missing' }], confidence: 'uncertain' })
const result = (items: WorkItemDraft[]): ReviewResult => ({ items, processedMessages: 2, omittedMessages: 0, provider: 'synthetic', model: 'test' })
const settings: AppSettings = { locale: 'en', theme: 'system', autoScan: false, historyDays: 30, sources: [], providers: [], activeProviderId: null }
function seeded(): Store { const db = new Store(':memory:'); db.upsertSessions({ sessions: [session()], coverage: [] }); return db }

test('persists sessions and revisions across reopening without changing source files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'carrythread-store-'))
  const path = join(dir, 'index.sqlite'); const original = join(dir, 'original.jsonl')
  writeFileSync(original, 'original source remains unchanged')
  let db = new Store(path)
  try {
    db.upsertSessions({ sessions: [session()], coverage: [] })
    const item = db.createItem(draft(), 'ai')
    const edited = db.patchItem({ id: item.id, expectedRevision: 1, changes: { state: 'paused', note: 'Waiting for hardware.' }, reason: 'Pause intentionally' })
    db.close(); db = new Store(path)
    assert.equal(db.getItem(item.id)?.revision, 2)
    assert.equal(db.getItem(item.id)?.state, 'paused')
    assert.equal(edited.manualOverride, true)
    assert.equal(db.itemHistory(item.id).length, 2)
    assert.equal(db.snapshot(settings).sessions.length, 1)
    db.clearAll()
    assert.equal(db.listItems().length, 0)
    assert.equal(readFileSync(original, 'utf8'), 'original source remains unchanged')
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }) }
})

test('incremental session upserts deduplicate and return newest limited messages chronologically', () => {
  const db = seeded()
  try {
    db.upsertSessions({ sessions: [session()], coverage: [] })
    assert.deepEqual(db.getMessages().map(message => message.id), ['message-1', 'message-2'])
    assert.deepEqual(db.getMessages(['session-1'], { limit: 1 }).map(message => message.id), ['message-2'])
    assert.equal(db.search('50%').length, 1)
    assert.equal(db.search('%').length, 1)
    assert.equal(db.search('_').length, 0)
    assert.equal(db.getMessages([]).length, 0)
  } finally { db.close() }
})

test('scan with cross-session message collision rolls back atomically', () => {
  const db = seeded()
  try {
    const other = session(); other.id = 'session-2'; other.messages = [{ ...other.messages[0], sessionId: 'session-2' }]
    assert.throws(() => db.upsertSessions({ sessions: [other], coverage: [] }), StoreError)
    assert.equal(db.getSession('session-2'), null)
    assert.equal(db.getMessages().length, 2)
  } finally { db.close() }
})

test('native sidechain identifiers survive indexing while internal IDs stay constrained', () => {
  const db = new Store(':memory:')
  try {
    const child = session(); child.nativeId = 'parent-native/subagent/child-native'
    db.upsertSessions({ sessions: [child], coverage: [] })
    assert.equal(db.getSession(child.id)?.nativeId, child.nativeId)
  } finally { db.close() }
})

test('optimistic revisions reject stale edits and AI preserves manual edits with new evidence', () => {
  const db = seeded()
  try {
    const item = db.applyReview(result([draft()]))[0]
    db.patchItem({ id: item.id, expectedRevision: 1, changes: { state: 'paused', summary: 'Do not resume automatically.' }, reason: 'User pause' })
    assert.throws(() => db.patchItem({ id: item.id, expectedRevision: 1, changes: { state: 'active' }, reason: '' }), (error: unknown) => error instanceof StoreError && error.code === 'STORE_REVISION_CONFLICT')
    const proposal = { ...draft(), existingId: item.id, state: 'active' as const, summary: 'Start again.', evidence: [...draft().evidence, { messageId: 'message-1', sessionId: 'session-1', quote: 'Build a report' }] }
    const updated = db.applyReview(result([proposal]))[0]
    assert.equal(updated.state, 'paused')
    assert.equal(updated.summary, 'Do not resume automatically.')
    assert.equal(updated.evidence.length, 2)
    assert.equal(updated.revision, 3)
  } finally { db.close() }
})

test('paused or cancelled AI-origin state also stays protected and duplicate proposals do not create new items', () => {
  const db = seeded()
  try {
    const stopped = db.createItem({ ...draft(), state: 'cancelled' }, 'ai')
    const updated = db.applyReview(result([{ ...draft(), state: 'active' }]))[0]
    assert.equal(updated.id, stopped.id)
    assert.equal(updated.state, 'cancelled')
    assert.equal(db.listItems().length, 1)
  } finally { db.close() }
})

test('unchanged AI review does not manufacture a new revision or progress entry', () => {
  const db = seeded()
  try {
    const item = db.applyReview(result([draft()]))[0]
    const same = db.applyReview(result([{ ...draft(), existingId: item.id }]))[0]
    assert.equal(same.revision, item.revision)
    assert.equal(same.updatedAt, item.updatedAt)
    assert.equal(db.itemHistory(item.id).length, 1)
  } finally { db.close() }
})

test('AI completion cannot rely on an assistant assertion alone', () => {
  const db = seeded()
  try {
    assert.throws(() => db.applyReview(result([{ ...draft(), state: 'done', confidence: 'supported', uncertainties: [] }])), StoreError)
    assert.equal(db.listItems().length, 0)
  } finally { db.close() }
})

test('deleting an item hides it but retains a revisioned audit trail', () => {
  const db = seeded()
  try {
    const item = db.createItem(draft())
    assert.throws(() => db.deleteItem(item.id, 2), StoreError)
    db.deleteItem(item.id, 1, 'Remove duplicate record')
    assert.equal(db.getItem(item.id), null)
    assert.equal(db.listItems().length, 0)
    assert.equal(db.itemHistory(item.id)[0].reason, 'Remove duplicate record')
  } finally { db.close() }
})

test('merge and split preserve evidence and history without claiming split scopes are complete', () => {
  const db = seeded()
  try {
    const a = db.createItem(draft()); const b = db.createItem({ ...draft(), title: 'Check printing' })
    const merged = db.mergeItems([a.id, b.id], 'Review device and printing')
    assert.equal(db.listItems().length, 1)
    assert.equal(merged.manualOverride, true)
    assert.equal(db.getItem(a.id), null)
    assert.equal(db.itemHistory(a.id)[0].reason, `merged_into:${merged.id}`)
    const split = db.splitItem(merged.id, ['Device', 'Printing'])
    assert.equal(db.listItems().length, 2)
    assert.ok(split.every(item => item.state === 'candidate' && item.evidence.length === 1 && item.manualOverride))
  } finally { db.close() }
})

test('portable export excludes settings, encrypted keys and handoff packages', () => {
  const db = seeded(); const target = new Store(':memory:')
  try {
    const item = db.createItem(draft())
    db.patchItem({ id: item.id, expectedRevision: 1, changes: { note: 'A manual clarification.' }, reason: 'Clarify' })
    db.setSetting('provider-key:example', 'opaque-encrypted-value')
    db.setSetting('settings', { secretInternalMetadata: 'private-settings-value' })
    db.saveHandoff({ id: 'handoff-1', itemId: item.id, revision: 1, target: 'claude', mode: 'new', cwd: '/synthetic/project', path: '/synthetic/handoff.md', content: 'Private handoff body', prompt: 'Read handoff', createdAt: new Date().toISOString(), status: 'prepared' } satisfies HandoffPackage)
    const data = db.exportData(); const serialized = JSON.stringify(data)
    assert.equal(data.schemaVersion, 1)
    assert.ok(!serialized.includes('opaque-encrypted-value') && !serialized.includes('private-settings-value') && !serialized.includes('Private handoff body'))
    assert.deepEqual(target.importData(data), { sessions: 1, items: 1 })
    assert.equal(target.getItem(item.id)?.manualOverride, true)
    assert.ok(target.itemHistory(item.id).some(change => change.reason === 'Clarify'))
    assert.equal(target.getSetting('provider-key:example', null), null)
    assert.equal(target.importData(data).items, 0)
  } finally { db.close(); target.close() }
})

test('untrusted import rejects arbitrary URL paths, settings, and fake evidence with no partial writes', () => {
  const db = seeded(); const target = new Store(':memory:')
  try {
    db.createItem(draft())
    const original = db.exportData()
    assert.throws(() => target.importData({ ...original, settings: {} }), StoreError)
    const badPath = structuredClone(original); badPath.sessions[0].sourcePath = 'https://example.invalid/source'
    assert.throws(() => target.importData(badPath), StoreError)
    const badEvidence = structuredClone(original); badEvidence.items[0].evidence[0].messageId = 'invented'
    assert.throws(() => target.importData(badEvidence), StoreError)
    const secretId = structuredClone(original); secretId.items[0].id = 'sk-synthetic-only-key-1234567890abcdef'
    assert.throws(() => target.importData(secretId), (error: unknown) => error instanceof StoreError && error.code === 'STORE_INVALID_INPUT')
    assert.equal(target.listSessions().length, 0)
  } finally { db.close(); target.close() }
})
