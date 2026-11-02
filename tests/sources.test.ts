import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { AgentKind, SourceConfig } from '../src/core/contracts'
import { discoverSources, scanSources, SourceScanner } from '../src/core/sources'

const fixture = (name: string) => resolve('tests/fixtures/sources', name)
const config = (agent: AgentKind, path: string): SourceConfig => ({ id: `test-${agent}`, agent, path, enabled: true })
async function temporary(t: { after(fn: () => Promise<void>): void }): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'carrythread-sources-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

test('Claude reads visible messages and question answers but excludes reasoning and tool noise', async () => {
  const r = await scanSources([config('claude', fixture('claude.jsonl'))])
  assert.equal(r.coverage[0].status, 'ok')
  const s = r.sessions[0]
  assert.equal(s.title, 'Atlas API review')
  assert.equal(s.messages.length, 4)
  assert.equal(s.messages.filter(m => m.kind === 'answer').length, 1)
  assert.equal(s.messages.filter(m => m.kind === 'context').length, 1)
  assert.ok(!JSON.stringify(s).includes('Private reasoning'))
  assert.ok(!JSON.stringify(s).includes('Ignored shell output'))
  assert.ok(!JSON.stringify(s).includes('Never import request'))
})

test('Codex removes event mirrors and inter-agent traffic while preserving repeated real requests', async () => {
  const r = await scanSources([config('codex', fixture('codex.jsonl'))])
  assert.equal(r.coverage[0].status, 'ok')
  const s = r.sessions[0]
  assert.equal(s.version, '0.166.0-alpha.5.1')
  assert.equal(s.messages.length, 3)
  assert.equal(s.messages.filter(m => m.role === 'user').length, 2)
  assert.ok(!JSON.stringify(s).includes('reasoning'))
  assert.ok(!JSON.stringify(s).includes('agent-to-agent'))
  assert.equal(s.messages.at(-1)?.turnId, 't2')
})

test('Pi retains branch parent relationships and marks compaction as context', async () => {
  const r = await scanSources([config('pi', fixture('pi.jsonl'))])
  const s = r.sessions[0]
  assert.equal(s.title, 'Atlas proposal options')
  assert.equal(s.messages.length, 4)
  assert.equal(s.messages[1].parentId, s.messages[0].id)
  assert.equal(s.messages[2].parentId, s.messages[0].id)
  assert.equal(s.messages[3].kind, 'context')
})

test('Finch runtime fallback does not manufacture event times from snapshot updates', async () => {
  const r = await scanSources([config('finch', fixture('finch-runtime.jsonl'))])
  assert.equal(r.coverage[0].status, 'partial')
  assert.equal(r.sessions[0].messages.length, 2)
  assert.equal(r.sessions[0].messages.find(m => m.role === 'assistant')?.timestamp, null)
  assert.ok(r.sessions[0].messages.every(m => m.kind === 'context'))
})

test('Finch prefers native Pi logs and does not duplicate runtime snapshots', async t => {
  const root = join(await temporary(t), '.finch')
  await mkdir(join(root, 'pi/sessions'), { recursive: true })
  await mkdir(join(root, 'session-runtime/sessions'), { recursive: true })
  await copyFile(fixture('pi.jsonl'), join(root, 'pi/sessions/native.jsonl'))
  await copyFile(fixture('finch-runtime.jsonl'), join(root, 'session-runtime/sessions/pi-synthetic-001.jsonl'))
  await writeFile(join(root, 'auth.json'), '{invalid credential file must not be opened}')
  const r = await scanSources([config('finch', root)])
  assert.equal(r.coverage[0].status, 'ok')
  assert.equal(r.sessions.length, 1)
  assert.equal(r.sessions[0].messages.length, 4)
  assert.ok(!JSON.stringify(r).includes('Older snapshot'))
})

test('generic JSON and Markdown preserve unknown dates and keep statements as evidence', async t => {
  const root = await temporary(t)
  await copyFile(fixture('generic.json'), join(root, 'import.json'))
  await writeFile(join(root, 'notes.md'), '# Delivery note\n\nThe draft is complete. Publication is unknown.')
  const r = await scanSources([config('generic', root)])
  assert.equal(r.coverage[0].status, 'ok')
  assert.equal(r.sessions.length, 2)
  assert.ok(r.sessions.flatMap(s => s.messages).some(m => m.timestamp === null))
  assert.equal(r.sessions.find(s => s.title === 'Delivery note')?.messages[0].timestamp, null)
  const ranged = await scanSources([config('generic', root)], { since: '2026-01-04T00:00:00Z', until: '2026-01-06T00:00:00Z' })
  assert.equal(ranged.coverage[0].status, 'partial')
  assert.ok(ranged.sessions.flatMap(s => s.messages).every(m => m.timestamp !== null))
})

test('cache is incremental, invalidates changed files, and recovers an unfinished last line', async t => {
  const root = await temporary(t), file = join(root, 'session.jsonl')
  const first = { type: 'user', sessionId: 'cache-session', uuid: 'u1', timestamp: '2026-01-01T00:00:00Z', message: { role: 'user', content: 'First message.' } }
  await writeFile(file, JSON.stringify(first) + '\n')
  const scanner = new SourceScanner(), source = config('claude', root)
  assert.equal((await scanner.scan([source])).sessions[0].messages.length, 1)
  assert.equal(scanner.stats.filesRead, 1)
  await scanner.scan([source])
  assert.equal(scanner.stats.cacheHits, 1)
  await writeFile(file, JSON.stringify(first) + '\n{"type":"assistant"')
  const partial = await scanner.scan([source])
  assert.equal(partial.coverage[0].status, 'partial')
  assert.match(partial.coverage[0].errors.join(' '), /incomplete final/)
  const second = { ...first, type: 'assistant', uuid: 'a1', message: { role: 'assistant', content: 'The draft is ready.' } }
  await writeFile(file, JSON.stringify(first) + '\n' + JSON.stringify(second) + '\n')
  const complete = await scanner.scan([source])
  assert.equal(complete.coverage[0].status, 'ok')
  assert.equal(complete.sessions[0].messages.length, 2)
})

test('redaction runs before truncation and never mutates a source file', async t => {
  const root = await temporary(t), file = join(root, 'large.jsonl')
  const key = 'sk-' + 'synthetic_only_'.repeat(3)
  const text = 'a'.repeat(121_000) + ` api_key=${key}`
  const original = JSON.stringify({ session_id: 'redacted-session', role: 'user', text }) + '\n'
  await writeFile(file, original)
  const r = await scanSources([config('generic', root)])
  assert.ok(r.coverage[0].redacted > 0)
  assert.ok(!JSON.stringify(r.sessions).includes(key))
  assert.ok(r.sessions[0].messages[0].text.includes('[Text truncated]'))
  assert.equal(await readFile(file, 'utf8'), original)
})

test('missing, disabled, symlink, malformed, and file-limit coverage remain visible', async t => {
  const root = await temporary(t)
  const missing = await scanSources([{ ...config('pi', join(root, 'missing')), id: 'missing' }, { ...config('pi', root), id: 'disabled', enabled: false }])
  assert.deepEqual(missing.coverage.map(c => c.status), ['missing', 'disabled'])
  await writeFile(join(root, 'bad.jsonl'), '{bad}\n')
  await copyFile(fixture('pi.jsonl'), join(root, 'good.jsonl'))
  await symlink(fixture('pi.jsonl'), join(root, 'linked.jsonl'))
  const limited = await scanSources([config('pi', root)], { maxFiles: 1 })
  assert.equal(limited.coverage[0].status, 'partial')
  assert.match(limited.coverage[0].errors.join(' '), /File limit/)
  const full = await scanSources([config('pi', root)])
  assert.equal(full.sessions.length, 1)
  assert.match(full.coverage[0].errors.join(' '), /Symbolic links/)
  assert.match(full.coverage[0].errors.join(' '), /Invalid JSONL/)
})

test('discovery returns only existing known roots, without opening credential files', async t => {
  const root = await temporary(t)
  for (const path of ['.codex/sessions', '.claude/projects', '.local/share/opencode', '.pi/agent/sessions', '.finch']) await mkdir(join(root, path), { recursive: true })
  await writeFile(join(root, '.finch/auth.json'), 'not valid JSON')
  const found = await discoverSources(root)
  assert.deepEqual(found.map(s => s.agent), ['codex', 'claude', 'opencode', 'pi', 'finch'])
  assert.ok(found.every(s => s.path.startsWith(root)))
})

test('scan cancellation is visible without discarding healthy source boundaries', async t => {
  const root = await temporary(t), controller = new AbortController()
  controller.abort()
  const r = await scanSources([config('pi', root)], { signal: controller.signal })
  assert.equal(r.coverage[0].status, 'error')
  assert.deepEqual(r.coverage[0].errors, ['Operation cancelled.'])
})

test('OpenCode SQLite and legacy JSON are joined read-only and deduplicated by native IDs', async t => {
  const root = join(await temporary(t), 'opencode')
  for (const d of ['storage/session/project', 'storage/message/s1', 'storage/part/m1']) await mkdir(join(root, d), { recursive: true })
  await writeFile(join(root, 'storage/session/project/s1.json'), JSON.stringify({ id: 's1', title: 'Legacy title', directory: '/work/atlas', version: '1.0', time: { created: 1767225600000 } }))
  await writeFile(join(root, 'storage/message/s1/m1.json'), JSON.stringify({ id: 'm1', sessionID: 's1', role: 'user', time: { created: 1767225601000 } }))
  await writeFile(join(root, 'storage/part/m1/p1.json'), JSON.stringify({ id: 'p1', sessionID: 's1', messageID: 'm1', type: 'text', text: 'Keep release paused.' }))
  const path = join(root, 'opencode.db'), db = new DatabaseSync(path)
  db.exec('CREATE TABLE session(id TEXT PRIMARY KEY,title TEXT,directory TEXT,version TEXT,time_created INTEGER,time_updated INTEGER); CREATE TABLE message(id TEXT PRIMARY KEY,session_id TEXT,time_created INTEGER,data TEXT); CREATE TABLE part(id TEXT PRIMARY KEY,message_id TEXT,session_id TEXT,data TEXT); CREATE TABLE credential(secret TEXT);')
  db.prepare('INSERT INTO session VALUES(?,?,?,?,?,?)').run('s1', 'Current title', '/work/atlas', '1.19.3', 1767225600000, 1767225601000)
  db.prepare('INSERT INTO message VALUES(?,?,?,?)').run('m1', 's1', 1767225601000, JSON.stringify({ role: 'user', time: { created: 1767225601000 } }))
  db.prepare('INSERT INTO part VALUES(?,?,?,?)').run('p1', 'm1', 's1', JSON.stringify({ type: 'text', text: 'Keep release paused.' }))
  db.prepare('INSERT INTO part VALUES(?,?,?,?)').run('p2', 'm1', 's1', JSON.stringify({ type: 'reasoning', text: 'Never import reasoning.' }))
  db.prepare('INSERT INTO credential VALUES(?)').run('Never read this table.')
  db.close()
  const before = await readFile(path)
  const r = await scanSources([config('opencode', root)])
  assert.equal(r.coverage[0].status, 'ok')
  assert.equal(r.sessions.length, 1)
  assert.equal(r.sessions[0].title, 'Current title')
  assert.equal(r.sessions[0].messages.length, 1)
  assert.equal(r.sessions[0].messages[0].text, 'Keep release paused.')
  assert.ok(!JSON.stringify(r).includes('Never import reasoning'))
  assert.ok(!JSON.stringify(r).includes('Never read this table'))
  assert.deepEqual(await readFile(path), before)
})

test('unsupported OpenCode and future Pi schemas are disclosed instead of empty success', async t => {
  const root = await temporary(t), path = join(root, 'opencode.db')
  const db = new DatabaseSync(path); db.exec('CREATE TABLE future_messages(id TEXT)'); db.close()
  const result = await scanSources([config('opencode', path)])
  assert.equal(result.coverage[0].status, 'partial')
  assert.match(result.coverage[0].errors.join(' '), /Unsupported OpenCode/)
  const pi = join(root, 'future.jsonl')
  await writeFile(pi, JSON.stringify({ type: 'session', version: 99, id: 'future' }) + '\n')
  const future = await scanSources([config('pi', pi)])
  assert.equal(future.coverage[0].status, 'partial')
  assert.match(future.coverage[0].errors.join(' '), /Unsupported Pi/)
})

test('older Pi versions, generic session exports, and native OpenCode exports remain readable', async t => {
  const root = await temporary(t)
  for (const version of [1, 2]) {
    const path = join(root, `pi-${version}.jsonl`)
    await writeFile(path, [
      { type: 'session', version, id: `old-${version}`, cwd: '/work/atlas' },
      { type: 'message', timestamp: '2026-01-01T00:00:00Z', message: { role: 'user', content: 'A legacy message.' } },
    ].map(r => JSON.stringify(r)).join('\n'))
    assert.equal((await scanSources([config('pi', path)])).sessions[0].messages[0].text, 'A legacy message.')
  }
  const generic = join(root, 'generic-export.json')
  await writeFile(generic, JSON.stringify({ sessions: [{ id: 'g1', title: 'Exported session', messages: [{ id: 'm1', role: 'user', timestamp: null, text: 'Keep this paused.' }] }] }))
  assert.equal((await scanSources([config('generic', generic)])).sessions[0].messages[0].timestamp, null)
  const exported = join(root, 'opencode-export.json')
  await writeFile(exported, JSON.stringify({ info: { id: 'e1', title: 'CLI export', directory: '/work/atlas' }, messages: [{ info: { id: 'm1', role: 'assistant', time: { created: 1767225601000 } }, parts: [{ type: 'text', text: 'Exported visible output.' }, { type: 'reasoning', text: 'Not public.' }] }] }))
  const read = await scanSources([config('opencode', exported)])
  assert.equal(read.sessions[0].messages[0].text, 'Exported visible output.')
  assert.ok(!JSON.stringify(read).includes('Not public.'))
})

test('Codex event-only histories and source size limits are explicit', async t => {
  const root = await temporary(t), path = join(root, 'events.jsonl')
  await writeFile(path, JSON.stringify({ type: 'event_msg', timestamp: '2026-01-01T00:00:00Z', payload: { type: 'user_message', message: 'An older event-only log.' } }) + '\n')
  assert.equal((await scanSources([config('codex', path)])).sessions[0].messages[0].role, 'user')
  const limited = await scanSources([config('codex', path)], { maxFileBytes: 8 })
  assert.equal(limited.coverage[0].status, 'partial')
  assert.equal(limited.sessions.length, 0)
  assert.match(limited.coverage[0].errors.join(' '), /size limit/)
})

test('event-only repeated user messages are not mistaken for mirrors and IDs survive rescanning', async t => {
  const root = await temporary(t), path = join(root, 'repeat.jsonl')
  const events = [0, 1].map(second => ({ type: 'event_msg', timestamp: `2026-01-01T00:00:0${second}Z`, payload: { type: 'user_message', message: 'Yes.' } }))
  await writeFile(path, events.map(r => JSON.stringify(r)).join('\n'))
  const first = await scanSources([config('codex', path)])
  const second = await scanSources([config('codex', path)])
  assert.equal(first.sessions[0].messages.length, 2)
  assert.deepEqual(first.sessions.map(s => [s.id, ...s.messages.map(m => m.id)]), second.sessions.map(s => [s.id, ...s.messages.map(m => m.id)]))
})

test('known metadata-only histories are empty success, while unknown schemas remain partial', async t => {
  const root = await temporary(t), meta = join(root, 'meta.jsonl'), unknown = join(root, 'unknown.jsonl')
  await writeFile(meta, JSON.stringify({ type: 'event_msg', timestamp: '2026-01-01T00:00:00Z', payload: { type: 'thread_settings_applied' } }))
  const known = await scanSources([config('codex', meta)])
  assert.equal(known.coverage[0].status, 'ok')
  assert.equal(known.sessions.length, 0)
  await writeFile(unknown, JSON.stringify({ type: 'unrecognized_new_format', body: 'unknown' }))
  const unsupported = await scanSources([config('codex', unknown)])
  assert.equal(unsupported.coverage[0].status, 'partial')
})

test('early Codex bare response items remain undated instead of inheriting the session date', async t => {
  const root = await temporary(t), path = join(root, 'legacy.jsonl')
  await writeFile(path, [
    { id: 'early-session', timestamp: '2026-01-01T00:00:00Z', instructions: 'Not imported.' },
    { record_type: 'metadata' },
    { type: 'message', id: 'u1', role: 'user', content: [{ type: 'input_text', text: 'An older request.' }] },
    { type: 'reasoning', summary: [{ text: 'Not imported.' }] },
  ].map(r => JSON.stringify(r)).join('\n'))
  const result = await scanSources([config('codex', path)])
  assert.equal(result.coverage[0].status, 'ok')
  assert.equal(result.sessions[0].nativeId, 'early-session')
  assert.equal(result.sessions[0].messages[0].timestamp, null)
  assert.ok(!JSON.stringify(result.sessions).includes('Not imported.'))
})
