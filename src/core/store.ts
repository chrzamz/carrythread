import { randomUUID } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, isAbsolute, win32 } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { AGENTS, type AgentSession, type AppSettings, type AppSnapshot, type HandoffPackage, type ItemChange, type ItemPatch, type ReviewResult, type ReviewRun, type ScanResult, type SourceMessage, type WorkItem, type WorkItemDraft } from './contracts'
import { redactText } from './privacy'
import { assertEvidence, isRecord, validateWorkItemDraft } from './ai/validation'
import { buildReviewContext, workspaceKeyFor, workspacesDisjoint } from './continuity'

export type StoreErrorCode = 'STORE_REVISION_CONFLICT' | 'STORE_NOT_FOUND' | 'STORE_INVALID_INPUT' | 'STORE_MIGRATION_UNSUPPORTED'
export class StoreError extends Error {
  constructor(public readonly code: StoreErrorCode) { super(code); this.name = 'StoreError' }
}
export interface PortableData { schemaVersion: 1; exportedAt: string; sessions: AgentSession[]; items: WorkItem[]; history: ItemChange[] }
type Row = Record<string, unknown>
const now = () => new Date().toISOString()
const json = (value: unknown) => JSON.stringify(value)
const parse = <T>(row: Row | undefined): T | null => row ? JSON.parse(String(row.data)) as T : null
const unique = <T>(values: T[]) => [...new Set(values)]
const limitNumber = (value: number | undefined, fallback: number, max: number) => Math.min(max, Math.max(1, Math.trunc(value ?? fallback)))
const validId = (value: unknown): value is string => typeof value === 'string' && /^[\w:.-]{1,500}$/.test(value) && redactText(value).redactions === 0
function requireId(id: unknown): asserts id is string { if (!validId(id)) throw new StoreError('STORE_INVALID_INPUT') }
function requireText(value: unknown, max = 10_000, empty = false): asserts value is string {
  if (typeof value !== 'string' || value.length > max || value.includes('\0') || (!empty && !value.trim())) throw new StoreError('STORE_INVALID_INPUT')
}
function requireDate(value: unknown, nullable = false): void {
  if (nullable && value === null) return
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new StoreError('STORE_INVALID_INPUT')
}
function requirePath(value: unknown, empty = false): asserts value is string {
  requireText(value, 8192, empty)
  if (value && !(isAbsolute(value) || win32.isAbsolute(value))) throw new StoreError('STORE_INVALID_INPUT')
  if (redactText(value).redactions) throw new StoreError('STORE_INVALID_INPUT')
}
function cleanStrings<T>(value: T): T {
  if (typeof value === 'string') return redactText(value).text as T
  if (Array.isArray(value)) return value.map(cleanStrings) as T
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, cleanStrings(field)])) as T
  return value
}
function draftOf(item: WorkItem): WorkItemDraft {
  return { project: item.project, title: item.title, state: item.state, stage: item.stage, summary: item.summary, nextAction: item.nextAction, completionCriteria: item.completionCriteria, decisions: item.decisions, uncertainties: item.uncertainties, evidence: item.evidence, confidence: item.confidence }
}
function unionEvidence(items: WorkItemDraft[]): WorkItemDraft['evidence'] {
  const refs = new Map<string, WorkItemDraft['evidence'][number]>()
  for (const item of items) for (const ref of item.evidence) refs.set(json([ref.messageId, ref.sessionId, ref.quote]), ref)
  return [...refs.values()]
}

function validateStoredItem(raw: unknown): WorkItem {
  if (!isRecord(raw)) throw new StoreError('STORE_INVALID_INPUT')
  requireId(raw.id); requireDate(raw.createdAt); requireDate(raw.updatedAt)
  if (raw.reviewedAt !== '') requireDate(raw.reviewedAt)
  if (!Number.isSafeInteger(raw.revision) || Number(raw.revision) < 1 || typeof raw.manualOverride !== 'boolean') throw new StoreError('STORE_INVALID_INPUT')
  requireText(raw.note, 10_000, true)
  let draft: WorkItemDraft
  try { draft = validateWorkItemDraft(cleanStrings(draftOf(raw as unknown as WorkItem)), true) } catch { throw new StoreError('STORE_INVALID_INPUT') }
  return { ...draft, id: raw.id, createdAt: String(raw.createdAt), updatedAt: String(raw.updatedAt), reviewedAt: String(raw.reviewedAt), revision: Number(raw.revision), manualOverride: raw.manualOverride, note: redactText(raw.note).text } as WorkItem
}

function validateSession(raw: unknown): AgentSession {
  if (!isRecord(raw)) throw new StoreError('STORE_INVALID_INPUT')
  for (const field of ['id', 'sourceId'] as const) requireId(raw[field])
  // Native identifiers can include a sidechain path. Only our indexed IDs are restricted.
  requireText(raw.nativeId, 1000)
  if (redactText(raw.nativeId).redactions) throw new StoreError('STORE_INVALID_INPUT')
  if (!AGENTS.includes(raw.agent as typeof AGENTS[number])) throw new StoreError('STORE_INVALID_INPUT')
  requireText(raw.title, 1000); requirePath(raw.cwd, true); requirePath(raw.sourcePath)
  requireDate(raw.startedAt, true); requireDate(raw.updatedAt, true)
  if (raw.parentId !== undefined) requireId(raw.parentId)
  if (raw.version !== undefined) requireText(raw.version, 100)
  if (raw.titleOrigin !== undefined && !['source', 'derived'].includes(String(raw.titleOrigin))) throw new StoreError('STORE_INVALID_INPUT')
  if (!Array.isArray(raw.messages) || raw.messages.length > 100_000) throw new StoreError('STORE_INVALID_INPUT')
  const messages: SourceMessage[] = raw.messages.map(value => {
    if (!isRecord(value)) throw new StoreError('STORE_INVALID_INPUT')
    requireId(value.id); requireId(value.sessionId)
    if (value.sessionId !== raw.id || !['user', 'assistant', 'tool'].includes(String(value.role))) throw new StoreError('STORE_INVALID_INPUT')
    requireText(value.text, 1_000_000, true); requirePath(value.sourcePath); requireDate(value.timestamp, true)
    if (value.line !== undefined && (!Number.isSafeInteger(value.line) || Number(value.line) < 1)) throw new StoreError('STORE_INVALID_INPUT')
    if (value.kind !== undefined && !['message', 'answer', 'result', 'context'].includes(String(value.kind))) throw new StoreError('STORE_INVALID_INPUT')
    if (value.parentId !== undefined) requireId(value.parentId)
    if (value.turnId !== undefined) requireId(value.turnId)
    return { id: value.id, sessionId: value.sessionId, role: value.role as SourceMessage['role'], text: redactText(value.text).text, timestamp: value.timestamp as string | null, sourcePath: value.sourcePath, ...(value.line === undefined ? {} : { line: Number(value.line) }), ...(value.kind === undefined ? {} : { kind: value.kind as SourceMessage['kind'] }), ...(value.parentId === undefined ? {} : { parentId: String(value.parentId) }), ...(value.turnId === undefined ? {} : { turnId: String(value.turnId) }) }
  })
  if (new Set(messages.map(message => message.id)).size !== messages.length) throw new StoreError('STORE_INVALID_INPUT')
  return { id: String(raw.id), sourceId: String(raw.sourceId), nativeId: String(raw.nativeId), agent: raw.agent as AgentSession['agent'], title: redactText(raw.title).text, cwd: raw.cwd, sourcePath: raw.sourcePath, startedAt: raw.startedAt as string | null, updatedAt: raw.updatedAt as string | null, messages, ...(raw.parentId ? { parentId: String(raw.parentId) } : {}), ...(raw.version ? { version: String(raw.version) } : {}), ...(raw.titleOrigin ? { titleOrigin: raw.titleOrigin as AgentSession['titleOrigin'] } : {}) }
}

export class Store {
  private readonly db: DatabaseSync
  constructor(dbPath: string) {
    if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 })
    this.db = new DatabaseSync(dbPath, { enableForeignKeyConstraints: true, allowExtension: false })
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;')
    const version = Number(this.db.prepare('PRAGMA user_version').get()?.user_version ?? 0)
    if (version > 1) { this.db.close(); throw new StoreError('STORE_MIGRATION_UNSUPPORTED') }
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, updated_at INTEGER, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), happened_at INTEGER, text TEXT NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS messages_session ON messages(session_id, happened_at);
      CREATE INDEX IF NOT EXISTS messages_time ON messages(happened_at);
      CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, archived INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS item_history (id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id), timestamp TEXT NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS history_item ON item_history(item_id, timestamp);
      CREATE TABLE IF NOT EXISTS coverage (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS handoffs (id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id), data TEXT NOT NULL);
      PRAGMA user_version=1;
    `)
    if (dbPath !== ':memory:' && process.platform !== 'win32') for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) if (existsSync(file)) chmodSync(file, 0o600)
  }
  close(): void { this.db.close() }
  private transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE')
    try { const result = fn(); this.db.exec('COMMIT'); return result }
    catch (error) { this.db.exec('ROLLBACK'); throw error }
  }
  clearAll(): void {
    this.transaction(() => this.db.exec('DELETE FROM handoffs; DELETE FROM item_history; DELETE FROM items; DELETE FROM messages; DELETE FROM sessions; DELETE FROM coverage; DELETE FROM reviews; DELETE FROM settings;'))
    this.db.exec('PRAGMA wal_checkpoint(TRUNCATE); VACUUM;')
  }
  snapshot(settings: AppSettings): AppSnapshot {
    const items = this.listItems()
    const projects = new Map<string, AppSnapshot['projects'][number]>()
    for (const item of items) {
      const project = projects.get(item.project) ?? { name: item.project, items: 0, open: 0, updatedAt: item.updatedAt }
      project.items++
      if (!['done', 'paused', 'cancelled', 'candidate'].includes(item.state)) project.open++
      if (item.updatedAt > project.updatedAt) project.updatedAt = item.updatedAt
      projects.set(item.project, project)
    }
    return { settings, sessions: this.listSessions(), projects: [...projects.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), items, coverage: this.db.prepare('SELECT data FROM coverage ORDER BY id').all().map(row => parse<AppSnapshot['coverage'][number]>(row)!), reviews: this.listReviewRuns() }
  }
  upsertSessions(scan: ScanResult): { sessions: number; messages: number } {
    const sessions = scan.sessions.map(validateSession)
    for (const value of scan.coverage) {
      requireId(value.sourceId)
      if (!AGENTS.includes(value.agent) || !['ok', 'missing', 'partial', 'error', 'disabled'].includes(value.status)) throw new StoreError('STORE_INVALID_INPUT')
    }
    return this.transaction(() => {
      let count = 0
      for (const session of sessions) count += this.writeSession(session)
      const upsert = this.db.prepare('INSERT INTO coverage (id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data')
      for (const value of scan.coverage) upsert.run(value.sourceId, json(cleanStrings(value)))
      return { sessions: sessions.length, messages: count }
    })
  }
  private writeSession(session: AgentSession): number {
    const { messages, ...metadata } = session
    this.db.prepare('INSERT INTO sessions(id,updated_at,data) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at,data=excluded.data').run(session.id, session.updatedAt ? Date.parse(session.updatedAt) : null, json(metadata))
    const get = this.db.prepare('SELECT session_id FROM messages WHERE id=?')
    const put = this.db.prepare('INSERT INTO messages(id,session_id,happened_at,text,data) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET happened_at=excluded.happened_at,text=excluded.text,data=excluded.data')
    for (const message of messages) {
      const previous = get.get(message.id)
      if (previous && previous.session_id !== session.id) throw new StoreError('STORE_INVALID_INPUT')
      put.run(message.id, session.id, message.timestamp ? Date.parse(message.timestamp) : null, message.text, json(message))
    }
    return messages.length
  }
  listSessions(): Omit<AgentSession, 'messages'>[] { return this.db.prepare('SELECT data FROM sessions ORDER BY updated_at DESC,id').all().map(row => parse<Omit<AgentSession, 'messages'>>(row)!) }
  getSession(id: string): AgentSession | null {
    const metadata = parse<Omit<AgentSession, 'messages'>>(this.db.prepare('SELECT data FROM sessions WHERE id=?').get(id))
    return metadata ? { ...metadata, messages: this.getMessages([id]) } : null
  }
  getMessage(id: string): SourceMessage | null { return parse<SourceMessage>(this.db.prepare('SELECT data FROM messages WHERE id=?').get(id)) }
  getMessages(sessionIds?: string[], options: { since?: string; until?: string; limit?: number } = {}): SourceMessage[] {
    if (sessionIds?.length === 0) return []
    if (sessionIds && sessionIds.length > 10_000) throw new StoreError('STORE_INVALID_INPUT')
    const where: string[] = []
    const args: (string | number)[] = []
    if (sessionIds) { sessionIds.forEach(requireId); where.push(`session_id IN (${sessionIds.map(() => '?').join(',')})`); args.push(...sessionIds) }
    if (options.since) { requireDate(options.since); where.push('happened_at >= ?'); args.push(Date.parse(options.since)) }
    if (options.until) { requireDate(options.until); where.push('happened_at <= ?'); args.push(Date.parse(options.until)) }
    const sql = `SELECT data FROM messages ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY happened_at DESC,rowid DESC ${options.limit === undefined ? '' : 'LIMIT ?'}`
    if (options.limit !== undefined) args.push(limitNumber(options.limit, 1000, 100_000))
    return this.db.prepare(sql).all(...args).map(row => parse<SourceMessage>(row)!).reverse()
  }
  search(query: string, limit = 100): SourceMessage[] {
    if (!query.trim()) return []
    requireText(query, 2000)
    const term = `%${query.replace(/[\\%_]/g, '\\$&')}%`
    return this.db.prepare("SELECT data FROM messages WHERE text LIKE ? ESCAPE '\\' ORDER BY happened_at DESC,rowid DESC LIMIT ?").all(term, limitNumber(limit, 100, 1000)).map(row => parse<SourceMessage>(row)!)
  }
  listItems(): WorkItem[] { return this.db.prepare('SELECT data FROM items WHERE archived=0').all().map(row => parse<WorkItem>(row)!).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) }
  getItem(id: string): WorkItem | null { return parse<WorkItem>(this.db.prepare('SELECT data FROM items WHERE id=? AND archived=0').get(id)) }
  private requireItem(id: string): WorkItem { const item = this.getItem(id); if (!item) throw new StoreError('STORE_NOT_FOUND'); return item }
  private validateEvidence(draft: WorkItemDraft): void {
    const messages = new Map<string, SourceMessage>()
    for (const ref of draft.evidence) {
      const message = parse<SourceMessage>(this.db.prepare('SELECT data FROM messages WHERE id=?').get(ref.messageId))
      if (!message) throw new StoreError('STORE_INVALID_INPUT')
      messages.set(message.id, message)
    }
    try { draft.evidence.forEach(ref => assertEvidence(ref, messages)) } catch { throw new StoreError('STORE_INVALID_INPUT') }
  }
  private validateAICompletion(draft: WorkItemDraft): void {
    if (draft.state !== 'done') return
    const independent = draft.evidence.some(ref => {
      const message = parse<SourceMessage>(this.db.prepare('SELECT data FROM messages WHERE id=?').get(ref.messageId))
      return message?.role === 'user' || message?.role === 'tool'
    })
    if (!independent || draft.confidence !== 'supported' || draft.uncertainties.length || !draft.completionCriteria.trim()) throw new StoreError('STORE_INVALID_INPUT')
  }
  private writeChange(before: WorkItem | null, after: WorkItem, actor: ItemChange['actor'], reason: string): void {
    this.db.prepare('INSERT INTO items(id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(after.id, json(after))
    const change: ItemChange = { id: randomUUID(), itemId: after.id, timestamp: now(), actor, reason: redactText(reason).text, before, after }
    this.db.prepare('INSERT INTO item_history(id,item_id,timestamp,data) VALUES (?,?,?,?)').run(change.id, after.id, change.timestamp, json(change))
  }
  createItem(draft: WorkItemDraft, actor: ItemChange['actor'] = 'user', reason = 'create'): WorkItem {
    let valid: WorkItemDraft
    try { valid = validateWorkItemDraft(cleanStrings(draft), actor === 'user') } catch { throw new StoreError('STORE_INVALID_INPUT') }
    if (valid.existingId) throw new StoreError('STORE_INVALID_INPUT')
    this.validateEvidence(valid)
    if (actor === 'ai') this.validateAICompletion(valid)
    return this.transaction(() => this.create(valid, actor, reason))
  }
  private create(draft: WorkItemDraft, actor: ItemChange['actor'], reason: string): WorkItem {
    const { existingId: _existing, ...fields } = draft
    const timestamp = now()
    const item: WorkItem = { ...fields, id: randomUUID(), createdAt: timestamp, updatedAt: timestamp, reviewedAt: actor === 'ai' ? timestamp : '', manualOverride: actor === 'user', revision: 1, note: '' }
    this.writeChange(null, item, actor, reason)
    return item
  }
  patchItem(patch: ItemPatch): WorkItem {
    requireId(patch.id); requireText(patch.reason, 3000, true)
    const allowed = ['project', 'title', 'state', 'stage', 'summary', 'nextAction', 'completionCriteria', 'decisions', 'uncertainties', 'note']
    if (!isRecord(patch.changes) || Object.keys(patch.changes).some(key => !allowed.includes(key))) throw new StoreError('STORE_INVALID_INPUT')
    return this.transaction(() => {
      const before = this.requireItem(patch.id)
      if (before.revision !== patch.expectedRevision) throw new StoreError('STORE_REVISION_CONFLICT')
      const after = { ...before, ...cleanStrings(patch.changes), revision: before.revision + 1, updatedAt: now(), manualOverride: true }
      try { validateWorkItemDraft(draftOf(after), true); requireText(after.note, 10_000, true) } catch { throw new StoreError('STORE_INVALID_INPUT') }
      this.writeChange(before, after, 'user', patch.reason)
      return after
    })
  }
  itemHistory(id: string): ItemChange[] { return this.db.prepare('SELECT data FROM item_history WHERE item_id=? ORDER BY timestamp DESC,rowid DESC').all(id).map(row => parse<ItemChange>(row)!) }
  deleteItem(id: string, expectedRevision: number, reason = 'delete'): void {
    requireId(id); requireText(reason, 3000, true)
    this.transaction(() => {
      const before = this.requireItem(id)
      if (before.revision !== expectedRevision) throw new StoreError('STORE_REVISION_CONFLICT')
      this.writeChange(before, { ...before, revision: before.revision + 1, updatedAt: now(), manualOverride: true }, 'user', reason)
      this.db.prepare('UPDATE items SET archived=1 WHERE id=?').run(id)
    })
  }
  mergeItems(ids: string[], title: string): WorkItem {
    requireText(title, 300)
    if (unique(ids).length < 2 || ids.length > 50 || unique(ids).length !== ids.length) throw new StoreError('STORE_INVALID_INPUT')
    return this.transaction(() => {
      const originals = ids.map(id => this.requireItem(id))
      const first = originals[0]
      const draft: WorkItemDraft = { ...draftOf(first), project: unique(originals.map(item => item.project)).join(' / '), title: redactText(title).text, summary: originals.map(item => item.summary).join('\n\n'), decisions: unique(originals.flatMap(item => item.decisions)), uncertainties: unique(originals.flatMap(item => item.uncertainties)), evidence: unionEvidence(originals), state: originals.every(item => item.state === first.state) ? first.state : 'candidate', confidence: originals.every(item => item.confidence === 'supported') ? 'supported' : 'uncertain' }
      try { validateWorkItemDraft(draft, true) } catch { throw new StoreError('STORE_INVALID_INPUT') }
      const merged = this.create(draft, 'user', 'merge')
      for (const original of originals) {
        this.writeChange(original, { ...original, revision: original.revision + 1, updatedAt: now(), manualOverride: true }, 'user', `merged_into:${merged.id}`)
        this.db.prepare('UPDATE items SET archived=1 WHERE id=?').run(original.id)
      }
      return merged
    })
  }
  splitItem(id: string, titles: string[]): WorkItem[] {
    if (titles.length < 2 || titles.length > 20 || unique(titles).length !== titles.length) throw new StoreError('STORE_INVALID_INPUT')
    titles.forEach(title => requireText(title, 300))
    return this.transaction(() => {
      const original = this.requireItem(id)
      const result = titles.map(title => this.create({ ...draftOf(original), title: redactText(title).text, state: ['paused', 'cancelled'].includes(original.state) ? original.state : 'candidate', nextAction: '', completionCriteria: '', confidence: 'uncertain' }, 'user', `split_from:${id}`))
      this.writeChange(original, { ...original, revision: original.revision + 1, updatedAt: now(), manualOverride: true }, 'user', `split_into:${result.map(item => item.id).join(',')}`)
      this.db.prepare('UPDATE items SET archived=1 WHERE id=?').run(id)
      return result
    })
  }
  applyReview(result: ReviewResult): WorkItem[] {
    const drafts = result.items.map(item => validateWorkItemDraft(cleanStrings(item)))
    for (const draft of drafts) {
      this.validateEvidence(draft)
      const existing = draft.existingId ? this.getItem(draft.existingId) : null
      if (!existing?.manualOverride) this.validateAICompletion(draft)
    }
    return this.transaction(() => {
      const changed: WorkItem[] = []
      const updated = new Set<string>()
      const metadata = new Map(this.listSessions().map(session => [session.id, session]))
      const workspaceFor = (sessionId: string) => workspaceKeyFor(metadata.get(sessionId)?.cwd ?? '')
      const compatible = (draft: WorkItemDraft, item: WorkItem): boolean => {
        if (!workspacesDisjoint(item.evidence.map(ref => workspaceFor(ref.sessionId)), draft.evidence.map(ref => workspaceFor(ref.sessionId)))) return true
        const handoffs = this.listHandoffs()
        if (!handoffs.length) return false
        const incomingIds = [...new Set(draft.evidence.map(ref => ref.sessionId))]
        const incomingSessions = incomingIds.map(id => metadata.get(id)).filter((session): session is Omit<AgentSession, 'messages'> => Boolean(session))
        const context = buildReviewContext(this.getMessages(incomingIds), incomingSessions, handoffs, [item])
        return context.sessionContext.some(session => session.linkedItemIds.includes(item.id))
      }
      for (const draft of drafts) {
        // Exact-title duplicate protection only; semantic merging belongs to the review.
        const same = !draft.existingId ? this.listItems().find(item => item.project === draft.project && item.title === draft.title && item.evidence.some(ref => draft.evidence.some(candidate => candidate.messageId === ref.messageId)) && compatible(draft, item)) : undefined
        const before = draft.existingId ? this.requireItem(draft.existingId) : same
        if (before && !compatible(draft, before)) throw new StoreError('STORE_INVALID_INPUT')
        if (!before) { changed.push(this.create(draft, 'ai', 'review')); continue }
        if (updated.has(before.id)) throw new StoreError('STORE_INVALID_INPUT')
        updated.add(before.id)
        const protectedItem = before.manualOverride || ['paused', 'cancelled'].includes(before.state)
        const timestamp = now()
        const { existingId: _existing, ...fields } = draft
        const after: WorkItem = { ...before, ...(protectedItem ? {} : fields), evidence: unionEvidence([before, draft]), updatedAt: timestamp, reviewedAt: timestamp, revision: before.revision + 1 }
        if (json(draftOf(before)) === json(draftOf(after))) {
          after.updatedAt = before.updatedAt
          after.revision = before.revision
          this.db.prepare('UPDATE items SET data=? WHERE id=?').run(json(after), before.id)
          changed.push(after)
          continue
        }
        this.writeChange(before, after, 'ai', protectedItem ? 'review_preserved_manual_state' : 'review')
        changed.push(after)
      }
      return changed
    })
  }
  addReviewRun(run: ReviewRun): void {
    requireId(run.id); requireDate(run.timestamp)
    this.db.prepare('INSERT INTO reviews(id,timestamp,data) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET timestamp=excluded.timestamp,data=excluded.data').run(run.id, run.timestamp, json(cleanStrings(run)))
  }
  listReviewRuns(limit = 50): ReviewRun[] { return this.db.prepare('SELECT data FROM reviews ORDER BY timestamp DESC,rowid DESC LIMIT ?').all(limitNumber(limit, 50, 1000)).map(row => parse<ReviewRun>(row)!) }
  getSetting<T>(key: string, fallback: T): T { return parse<T>(this.db.prepare('SELECT data FROM settings WHERE id=?').get(key)) ?? fallback }
  setSetting(key: string, value: unknown): void {
    requireText(key, 200)
    const encoded = json(value)
    if (encoded === undefined || encoded.length > 5_000_000) throw new StoreError('STORE_INVALID_INPUT')
    this.db.prepare('INSERT INTO settings(id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(key, encoded)
  }
  saveHandoff(pkg: HandoffPackage): void { requireId(pkg.id); this.requireItem(pkg.itemId); this.db.prepare('INSERT INTO handoffs(id,item_id,data) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(pkg.id, pkg.itemId, json(cleanStrings(pkg))) }
  getHandoff(id: string): HandoffPackage | null { return parse<HandoffPackage>(this.db.prepare('SELECT data FROM handoffs WHERE id=?').get(id)) }
  listHandoffs(itemId?: string): HandoffPackage[] { return (itemId ? this.db.prepare('SELECT data FROM handoffs WHERE item_id=? ORDER BY rowid DESC').all(itemId) : this.db.prepare('SELECT data FROM handoffs ORDER BY rowid DESC').all()).map(row => parse<HandoffPackage>(row)!) }
  exportData(): PortableData {
    // Explicit exports include source pointers; settings, encrypted keys and handoffs never leave here.
    return { schemaVersion: 1, exportedAt: now(), sessions: this.listSessions().map(session => this.getSession(session.id)!), items: this.listItems(), history: this.listItems().flatMap(item => this.itemHistory(item.id)) }
  }
  importData(value: unknown): { sessions: number; items: number } {
    if (!isRecord(value) || value.schemaVersion !== 1 || Object.keys(value).some(key => !['schemaVersion', 'exportedAt', 'sessions', 'items', 'history'].includes(key)) || !Array.isArray(value.sessions) || !Array.isArray(value.items) || !Array.isArray(value.history) || value.sessions.length > 5000 || value.items.length > 10_000 || value.history.length > 100_000) throw new StoreError('STORE_INVALID_INPUT')
    requireDate(value.exportedAt)
    const sessions = value.sessions.map(validateSession)
    if (sessions.reduce((sum, session) => sum + session.messages.length, 0) > 100_000) throw new StoreError('STORE_INVALID_INPUT')
    const items = value.items.map(validateStoredItem)
    const itemMap = new Map(items.map(item => [item.id, item]))
    const history: ItemChange[] = value.history.map(raw => {
      if (!isRecord(raw)) throw new StoreError('STORE_INVALID_INPUT')
      requireId(raw.id); requireId(raw.itemId); requireDate(raw.timestamp); requireText(raw.reason, 3000, true)
      if (!['user', 'ai'].includes(String(raw.actor)) || !itemMap.has(raw.itemId)) throw new StoreError('STORE_INVALID_INPUT')
      const before = raw.before === null ? null : validateStoredItem(raw.before)
      const after = validateStoredItem(raw.after)
      if ((before && before.id !== raw.itemId) || after.id !== raw.itemId || after.revision > itemMap.get(raw.itemId)!.revision) throw new StoreError('STORE_INVALID_INPUT')
      return { id: raw.id, itemId: raw.itemId, timestamp: String(raw.timestamp), actor: raw.actor as ItemChange['actor'], reason: redactText(raw.reason).text, before, after }
    })
    if (new Set(items.map(item => item.id)).size !== items.length || new Set(sessions.map(session => session.id)).size !== sessions.length) throw new StoreError('STORE_INVALID_INPUT')
    return this.transaction(() => {
      for (const session of sessions) this.writeSession(session)
      let added = 0
      const addedIds = new Set<string>()
      for (const item of items) {
        this.validateEvidence(item)
        // Local edits win collisions. Import is not an implicit sync or an overwrite.
        if (this.db.prepare('SELECT id FROM items WHERE id=?').get(item.id)) continue
        this.writeChange(null, item, 'user', 'import')
        addedIds.add(item.id)
        added++
      }
      const putHistory = this.db.prepare('INSERT OR IGNORE INTO item_history(id,item_id,timestamp,data) VALUES (?,?,?,?)')
      for (const change of history) if (addedIds.has(change.itemId)) putHistory.run(change.id, change.itemId, change.timestamp, json(change))
      return { sessions: sessions.length, items: added }
    })
  }
}
