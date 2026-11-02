import { DatabaseSync } from 'node:sqlite'
import type { SourceConfig } from '../contracts'
import { safeError } from '../privacy'
import { addMessage, finish, makeSession, object, parsed, string, textBlocks, type LocatedRow, type ParsedSource, type Row } from './shared'

const ROW_LIMIT = 100_000
interface Bundle { info: Row; messages: { info: Row; parts: Row[]; path: string; line?: number }[]; path: string }

function decode(value: unknown): Row {
  return typeof value === 'string' ? object(JSON.parse(value)) : object(value)
}

function normalize(source: SourceConfig, bundles: Bundle[]): ParsedSource {
  const result = parsed()
  for (const bundle of bundles) {
    const info = bundle.info, time = object(info.time)
    const native = string(info.id)
    if (!native) { result.skipped++; continue }
    const s = makeSession(source, native, bundle.path, {
      title: info.title, cwd: info.directory, version: info.version,
      startedAt: time.created ?? info.time_created,
      updatedAt: time.updated ?? info.time_updated,
      parentId: info.parentID ?? info.parent_id,
    })
    for (const entry of bundle.messages) {
      const m = entry.info, role = string(m.role), mt = object(m.time)
      if (!['user', 'assistant'].includes(role)) { result.skipped++; continue }
      const content = textBlocks(entry.parts)
      if (!content.trim()) continue
      addMessage(result, s, { nativeId: string(m.id), role: role as 'user' | 'assistant', text: content,
        timestamp: mt.created ?? m.time_created, path: entry.path, line: entry.line,
        parentId: string(m.parentID) || undefined,
        kind: m.summary === true || entry.parts.some(p => p.type === 'compaction') ? 'context' : undefined })
    }
    result.sessions.push(s)
  }
  return finish(result)
}

export function parseOpenCodeLegacy(source: SourceConfig, rows: LocatedRow[]): ParsedSource {
  const sessions = new Map<string, Bundle>(), messages = new Map<string, Bundle['messages'][number]>()
  const pending: LocatedRow[] = []
  for (const row of rows) {
    const r = row.value
    if (Object.keys(object(r.info)).length && Array.isArray(r.messages)) {
      // Native `opencode export` format, accepted as an explicitly selected file.
      const info = object(r.info), bundle: Bundle = { info, path: row.path, messages: [] }
      for (const raw of r.messages) {
        const m = object(raw)
        bundle.messages.push({ info: object(m.info), parts: Array.isArray(m.parts) ? m.parts.map(object) : [], path: row.path, line: row.line })
      }
      sessions.set(string(info.id), bundle)
    } else if (r.directory !== undefined && r.id && !r.sessionID && !r.messageID) {
      sessions.set(string(r.id), { info: r, path: row.path, messages: [] })
    } else if (r.role && r.sessionID && r.id) {
      messages.set(string(r.id), { info: r, parts: [], path: row.path, line: row.line })
    } else if (r.type && r.messageID) pending.push(row)
  }
  let orphans = 0
  for (const row of pending) {
    const entry = messages.get(string(row.value.messageID))
    if (entry) entry.parts.push(row.value)
    else orphans++
  }
  for (const entry of messages.values()) {
    const session = sessions.get(string(entry.info.sessionID))
    if (session) session.messages.push(entry)
    else orphans++
  }
  const result = normalize(source, [...sessions.values()])
  result.skipped += orphans
  if (orphans) result.errors.push('OpenCode records with missing session or message metadata were skipped.')
  if (!sessions.size && rows.length) result.errors.push('No supported OpenCode session metadata was found.')
  return result
}

/** Opens the user's database in read-only mode. Never queries accounts or credentials. */
export function readOpenCodeDatabase(source: SourceConfig, path: string): ParsedSource {
  let db: DatabaseSync | undefined
  const result = parsed()
  try {
    db = new DatabaseSync(path, { readOnly: true, timeout: 1000, allowExtension: false })
    const tableNames = new Set((db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Row[]).map(r => string(r.name)))
    if (!['session', 'message', 'part'].every(name => tableNames.has(name))) {
      result.errors.push('Unsupported OpenCode database schema; use a supported session export.'); return result
    }
    const fields = (table: string) => new Set((db!.prepare(`PRAGMA table_info(${table})`).all() as Row[]).map(r => string(r.name)))
    if (!['id', 'title', 'directory'].every(k => fields('session').has(k)) || !fields('message').has('data') || !fields('part').has('data')) {
      result.errors.push('Unsupported OpenCode database schema; use a supported session export.'); return result
    }
    db.exec('BEGIN')
    const sessionColumns = ['id', 'title', 'directory', 'version', 'parent_id', 'time_created', 'time_updated'].filter(k => fields('session').has(k)).join(', ')
    const sessionRows = db.prepare(`SELECT ${sessionColumns} FROM session LIMIT ${ROW_LIMIT + 1}`).all() as Row[]
    const messageRows = db.prepare(`SELECT id, session_id, time_created, data FROM message LIMIT ${ROW_LIMIT + 1}`).all() as Row[]
    const partRows = db.prepare(`SELECT id, message_id, session_id, data FROM part LIMIT ${ROW_LIMIT + 1}`).all() as Row[]
    if ([sessionRows, messageRows, partRows].some(rows => rows.length > ROW_LIMIT)) result.errors.push('OpenCode row limit reached; coverage is incomplete.')
    const sessions = new Map<string, Bundle>()
    const messages = new Map<string, Bundle['messages'][number]>()
    for (const info of sessionRows.slice(0, ROW_LIMIT)) sessions.set(string(info.id), { info, path, messages: [] })
    for (const row of messageRows.slice(0, ROW_LIMIT)) {
      try {
        const info = { ...decode(row.data), id: row.id, sessionID: row.session_id, time_created: row.time_created }
        messages.set(string(row.id), { info, parts: [], path })
      } catch { result.skipped++; result.errors.push('Invalid OpenCode message JSON was skipped.') }
    }
    for (const row of partRows.slice(0, ROW_LIMIT)) {
      try {
        const entry = messages.get(string(row.message_id))
        if (entry) entry.parts.push({ ...decode(row.data), id: row.id })
        else result.skipped++
      } catch { result.skipped++; result.errors.push('Invalid OpenCode part JSON was skipped.') }
    }
    for (const entry of messages.values()) {
      const bundle = sessions.get(string(entry.info.sessionID))
      if (bundle) bundle.messages.push(entry)
      else result.skipped++
    }
    if (result.skipped) result.errors.push('Some OpenCode records could not be associated with their session or message.')
    // OpenCode v2 may preserve legacy tables but put new messages elsewhere.
    if (tableNames.has('session_message')) {
      const count = db.prepare('SELECT count(*) AS n FROM session_message').get() as Row
      if (Number(count.n) > 0) result.errors.push('Newer OpenCode session_message records are not supported; legacy records only.')
    }
    db.exec('COMMIT')
    const normalized = normalize(source, [...sessions.values()])
    result.sessions = normalized.sessions
    result.redacted += normalized.redacted; result.skipped += normalized.skipped
    result.errors.push(...normalized.errors)
  } catch (error) { result.errors.push(safeError(error)) }
  finally { try { db?.close() } catch { /* Closing must not hide a readable error. */ } }
  return finish(result)
}
