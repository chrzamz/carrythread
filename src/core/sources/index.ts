import { constants } from 'node:fs'
import { lstat, open, readdir, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { AgentSession, ScanOptions, ScanResult, SourceConfig, SourceCoverage } from '../contracts'
import { isSensitivePath, redactText, safeError } from '../privacy'
import { parseRows } from './json-adapters'
import { parseOpenCodeLegacy, readOpenCodeDatabase } from './opencode'
import { finish, hash, object, parsed, string, type LocatedRow, type ParsedSource, type Row } from './shared'

export { parseClaude, parseCodex, parsePi, parseFinchRuntime, parseGeneric } from './json-adapters'
export { parseOpenCodeLegacy, readOpenCodeDatabase } from './opencode'

const DEFAULT_FILES = 2000
const DEFAULT_BYTES = 32 * 1024 * 1024
const MAX_LINE_BYTES = 4 * 1024 * 1024
const UNSUPPORTED = 'Some records have an unsupported shape and were skipped.'
const abort = (signal?: AbortSignal) => { if (signal?.aborted) throw new DOMException('Operation cancelled', 'AbortError') }
const exists = async (path: string) => { try { return !(await lstat(path)).isSymbolicLink() } catch { return false } }

/** Only candidate roots are returned. Discovery never opens histories or credentials. */
export async function discoverSources(home = homedir()): Promise<SourceConfig[]> {
  const useEnvironment = resolve(home) === resolve(homedir())
  const openCodeData = join(useEnvironment && process.env.XDG_DATA_HOME ? process.env.XDG_DATA_HOME : join(home, '.local', 'share'), 'opencode')
  const openCodeOverride = useEnvironment ? process.env.OPENCODE_DB : undefined
  const candidates: { agent: SourceConfig['agent']; path: string }[] = [
    { agent: 'codex', path: useEnvironment && process.env.CODEX_HOME ? process.env.CODEX_HOME : join(home, '.codex') },
    { agent: 'claude', path: join(home, '.claude', 'projects') },
    { agent: 'opencode', path: openCodeOverride && openCodeOverride !== ':memory:' ? resolve(openCodeData, openCodeOverride) : openCodeData },
    { agent: 'pi', path: useEnvironment && process.env.PI_CODING_AGENT_SESSION_DIR ? process.env.PI_CODING_AGENT_SESSION_DIR :
      join(useEnvironment && process.env.PI_CODING_AGENT_DIR ? process.env.PI_CODING_AGENT_DIR : join(home, '.pi', 'agent'), 'sessions') },
    { agent: 'finch', path: join(home, '.finch') },
  ]
  const found: SourceConfig[] = []
  for (const candidate of candidates) {
    if (await exists(candidate.path)) found.push({ ...candidate, path: resolve(candidate.path), id: `${candidate.agent}-${hash(resolve(candidate.path))}`, enabled: true })
  }
  return found
}

interface CacheEntry { signature: string; parsed?: ParsedSource; rows?: LocatedRow[]; errors: string[]; skipped: number }
interface FileRead { rows: LocatedRow[]; errors: string[]; skipped: number }

function decodeRows(text: string, path: string): FileRead {
  const result: FileRead = { rows: [], errors: [], skipped: 0 }
  if (/\.md(?:own)?$|\.markdown$/i.test(path)) {
    result.rows.push({ value: { type: 'generic_markdown', role: 'source', text, title: text.match(/^#\s+(.+)$/m)?.[1] }, path, line: 1 })
    return result
  }
  const push = (value: unknown, line: number) => {
    if (Array.isArray(value)) { for (const entry of value) push(entry, line); return }
    if (value && typeof value === 'object') result.rows.push({ value: value as Row, path, line })
    else { result.skipped++; result.errors.push(UNSUPPORTED) }
  }
  if (extname(path).toLowerCase() === '.json') {
    try { push(JSON.parse(text), 1) } catch { result.errors.push('Invalid JSON file.'); result.skipped++ }
  } else {
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      if (Buffer.byteLength(line) > MAX_LINE_BYTES) { result.skipped++; result.errors.push('A JSONL record exceeded the size limit.'); continue }
      try { push(JSON.parse(line), i + 1) }
      catch {
        result.skipped++
        result.errors.push(i === lines.length - 1 && !text.endsWith('\n') ? 'An incomplete final JSONL record is waiting for more data.' : 'Invalid JSONL records were skipped.')
      }
    }
  }
  return result
}

function inRoot(root: string, path: string): boolean {
  const rel = relative(root, path)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

function allowed(source: SourceConfig, root: string, path: string, directory: boolean): boolean {
  if (isSensitivePath(path)) return false
  const rel = relative(root, path).replace(/\\/g, '/')
  if (source.agent === 'finch' && basename(root) === '.finch') {
    const allowedRoots = ['pi/sessions', 'session-runtime/sessions']
    return allowedRoots.some(prefix => directory ? prefix.startsWith(rel + '/') || rel === prefix || rel.startsWith(prefix + '/') : rel.startsWith(prefix + '/')) && (directory || extname(path) === '.jsonl')
  }
  if (source.agent === 'codex' && basename(root) === '.codex') {
    if (!/^(?:sessions|archived_sessions)(?:\/|$)/.test(rel)) return false
  }
  if (source.agent === 'opencode') {
    if (!directory && root === path && extname(path).toLowerCase() === '.db') return true
    if (!directory && /^opencode(?:-[a-z0-9_.-]+)?\.db$/i.test(basename(path))) return true
    // Legacy storage is the only directory tree considered in a full app data root.
    if (basename(root) === 'opencode') {
      if (directory) return rel === 'storage' || /^(?:storage\/(?:session|message|part))(?:\/|$)/.test(rel)
      if (!/^storage\/(?:session|message|part)\//.test(rel)) return false
    } else if (basename(root) === 'storage') {
      if (!/^(?:session|message|part)(?:\/|$)/.test(rel)) return false
    }
    return directory || extname(path).toLowerCase() === '.json'
  }
  if (directory) return true
  return source.agent === 'generic' ? /\.(?:jsonl?|md|markdown)$/i.test(path) : /\.jsonl$/i.test(path)
}

function mergeSessions(results: ParsedSource[]): AgentSession[] {
  const sessions = new Map<string, AgentSession>()
  for (const result of results) for (const incoming of result.sessions) {
    const current = sessions.get(incoming.id)
    if (!current) { sessions.set(incoming.id, { ...incoming, messages: incoming.messages.map(m => ({ ...m })) }); continue }
    // Native Finch logs win over UI snapshots; both share the same native ID.
    if (current.agent === 'finch' && !current.version?.startsWith('runtime-') && incoming.version?.startsWith('runtime-')) continue
    if (current.agent === 'finch' && current.version?.startsWith('runtime-') && !incoming.version?.startsWith('runtime-')) {
      sessions.set(incoming.id, { ...incoming, messages: incoming.messages.map(m => ({ ...m })) }); continue
    }
    const messages = new Map(current.messages.map(m => [m.id, m]))
    for (const message of incoming.messages) messages.set(message.id, { ...message })
    current.messages = [...messages.values()]
    if (incoming.titleOrigin === 'source') { current.title = incoming.title; current.titleOrigin = 'source' }
    if (incoming.cwd) current.cwd = incoming.cwd
    current.version ||= incoming.version
  }
  return finish({ ...parsed(), sessions: [...sessions.values()] }).sessions
}

/** Caches sanitized parsed files in memory. A scan still reports the full selected view. */
export class SourceScanner {
  private cache = new Map<string, CacheEntry>()
  private counters = { filesRead: 0, cacheHits: 0 }
  get stats(): Readonly<{ filesRead: number; cacheHits: number }> { return { ...this.counters } }
  clear(): void { this.cache.clear() }

  async scan(configs: SourceConfig[], options: ScanOptions = {}): Promise<ScanResult> {
    const output: ScanResult = { sessions: [], coverage: [] }
    this.counters = { filesRead: 0, cacheHits: 0 }
    const maxFiles = Math.max(1, Math.min(options.maxFiles ?? DEFAULT_FILES, 100_000))
    const maxBytes = Math.max(1, Math.min(options.maxFileBytes ?? DEFAULT_BYTES, 512 * 1024 * 1024))
    if (!Number.isFinite(maxFiles) || !Number.isFinite(maxBytes)) throw new TypeError('Invalid scan limits.')
    const since = options.since === undefined ? -Infinity : Date.parse(options.since)
    const until = options.until === undefined ? Infinity : Date.parse(options.until)
    if (Number.isNaN(since) || Number.isNaN(until) || since >= until) throw new TypeError('Invalid scan time range.')
    for (const source of configs) {
      const coverage: SourceCoverage = { sourceId: source.id, agent: source.agent, path: source.path,
        status: source.enabled ? 'ok' : 'disabled', files: 0, sessions: 0, messages: 0, skipped: 0, redacted: 0, errors: [], scannedAt: new Date().toISOString() }
      output.coverage.push(coverage)
      if (!source.enabled) continue
      const results: ParsedSource[] = [], legacyRows: LocatedRow[] = []
      const seen = new Set<string>()
      try {
        abort(options.signal)
        const requested = resolve(source.path), rootStat = await lstat(requested)
        if (rootStat.isSymbolicLink()) { coverage.status = 'partial'; coverage.errors.push('Symbolic links are not scanned.'); continue }
        const root = await realpath(requested)
        if (root === resolve(sep) || root === resolve(homedir())) { coverage.status = 'error'; coverage.errors.push('Choose a specific history directory, not the home or filesystem root.'); continue }
        if (isSensitivePath(root)) { coverage.status = 'error'; coverage.errors.push('Credential and configuration paths are not imported.'); continue }
        const files: string[] = []
        let limitReached = false
        const walk = async (directory: string, depth = 0): Promise<void> => {
          abort(options.signal)
          if (depth > 16) { coverage.errors.push('Directory depth limit reached.'); return }
          let entries
          try { entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name)) }
          catch (error) { coverage.skipped++; coverage.errors.push(safeError(error)); return }
          for (const entry of entries) {
            const path = join(directory, entry.name)
            if (entry.isSymbolicLink()) { coverage.skipped++; coverage.errors.push('Symbolic links were skipped.'); continue }
            if (!allowed(source, root, path, entry.isDirectory())) continue
            if (entry.isDirectory()) await walk(path, depth + 1)
            else if (entry.isFile()) {
              if (files.length >= maxFiles) { limitReached = true; return }
              files.push(path)
            }
            if (limitReached) return
          }
        }
        if (rootStat.isDirectory()) await walk(root)
        else if (rootStat.isFile() && allowed(source, root, root, false)) files.push(root)
        else coverage.errors.push('Unsupported source file type.')
        if (limitReached) coverage.errors.push('File limit reached; coverage is incomplete.')
        // SQLite follows legacy JSON so its current metadata takes precedence on duplicate IDs.
        files.sort((a, b) => Number(extname(a) === '.db') - Number(extname(b) === '.db') || a.localeCompare(b))
        for (const path of files) {
          abort(options.signal)
          try {
            if (source.agent === 'finch' && path.replace(/\\/g, '/').includes('/session-runtime/') &&
              results.some(result => result.sessions.some(s => s.nativeId === basename(path, '.jsonl') && !s.version?.startsWith('runtime-')))) {
              coverage.skipped++; continue
            }
            const info = await lstat(path)
            if (info.isSymbolicLink() || !inRoot(rootStat.isFile() ? resolve(root, '..') : root, await realpath(path))) {
              coverage.skipped++; coverage.errors.push('A path outside the selected source was skipped.'); continue
            }
            if (info.size > maxBytes) { coverage.skipped++; coverage.errors.push('A source file exceeded the size limit.'); continue }
            coverage.files++
            const wal = extname(path) === '.db' ? await stat(path + '-wal').catch(() => null) : null
            const signature = `${info.ino}:${info.size}:${info.mtimeMs}:${info.ctimeMs}:${wal?.size ?? 0}:${wal?.mtimeMs ?? 0}`
            const key = `${source.id}:${source.agent}:${path}`
            seen.add(key)
            let entry = this.cache.get(key)
            if (entry?.signature === signature) this.counters.cacheHits++
            else {
              this.counters.filesRead++
              if (extname(path) === '.db' && source.agent === 'opencode') {
                entry = { signature, parsed: readOpenCodeDatabase(source, path), errors: [], skipped: 0 }
              } else {
                const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
                let text: string
                try {
                  const opened = await handle.stat()
                  const selectedRoot = rootStat.isFile() ? resolve(root, '..') : root
                  if (opened.ino !== info.ino || opened.dev !== info.dev || !inRoot(selectedRoot, await realpath(path))) {
                    coverage.skipped++; coverage.errors.push('Source changed during scanning; try again.'); continue
                  }
                  const chunks: Buffer[] = []
                  let bytes = 0
                  while (bytes <= maxBytes) {
                    abort(options.signal)
                    const buffer = Buffer.alloc(Math.min(64 * 1024, maxBytes - bytes + 1))
                    const read = await handle.read(buffer, 0, buffer.length, null)
                    if (!read.bytesRead) break
                    bytes += read.bytesRead; chunks.push(buffer.subarray(0, read.bytesRead))
                  }
                  if (bytes > maxBytes) { coverage.skipped++; coverage.errors.push('A source file grew beyond the size limit.'); continue }
                  text = Buffer.concat(chunks).toString('utf8')
                } finally { await handle.close() }
                const decoded = decodeRows(text, path)
                if (source.agent === 'opencode' && decoded.rows.some(row => row.value.info && Array.isArray(row.value.messages))) {
                  entry = { signature, parsed: parseOpenCodeLegacy(source, decoded.rows), errors: decoded.errors, skipped: decoded.skipped }
                } else if (source.agent === 'opencode') {
                  // Legacy pieces are joined across files. Cache only redacted payloads.
                  let count = 0
                  const rows = decoded.rows.filter(row => {
                    const r = row.value
                    // Never retain reasoning or arbitrary tool output in the cache.
                    return !r.messageID || ['text', 'compaction'].includes(string(r.type))
                  }).map(row => ({ ...row, value: sanitizeTree(row.value, () => count++) }))
                  entry = { signature, rows, errors: decoded.errors, skipped: decoded.skipped,
                    parsed: { ...parsed(), redacted: count } }
                } else entry = { signature, parsed: parseRows(source, decoded.rows), errors: decoded.errors, skipped: decoded.skipped }
              }
              // Do not cache failures or incomplete files, so the next scan can recover.
              if (!entry.errors.length && !entry.parsed?.errors.length) this.cache.set(key, entry)
              else this.cache.delete(key)
            }
            coverage.skipped += entry.skipped
            coverage.errors.push(...entry.errors)
            if (entry.rows) legacyRows.push(...entry.rows)
            if (entry.parsed) results.push(entry.parsed)
          } catch (error) { coverage.skipped++; coverage.errors.push(safeError(error)) }
        }
        if (legacyRows.length) results.unshift(parseOpenCodeLegacy(source, legacyRows))
        for (const result of results) {
          coverage.redacted += result.redacted; coverage.skipped += result.skipped; coverage.errors.push(...result.errors)
        }
        const sessions = mergeSessions(results)
        for (const session of sessions) {
          // Metadata can contain credentials too. Clean it before storing or presenting it.
          for (const field of ['title', 'cwd'] as const) { const clean = redactText(session[field]); session[field] = clean.text; coverage.redacted += clean.redactions }
          session.messages = session.messages.filter(m => {
            if (since === -Infinity && until === Infinity) return true
            if (!m.timestamp) { coverage.skipped++; coverage.errors.push('Records without event timestamps were excluded from the time filter.'); return false }
            const time = Date.parse(m.timestamp)
            return time >= since && time < until
          })
          if (!session.messages.length && (since !== -Infinity || until !== Infinity)) continue
          coverage.sessions++; coverage.messages += session.messages.length
          output.sessions.push(session)
        }
        if (coverage.errors.length) coverage.status = 'partial'
      } catch (error) {
        coverage.status = (error as NodeJS.ErrnoException)?.code === 'ENOENT' ? 'missing' : 'error'
        coverage.errors.push(safeError(error))
      }
      coverage.errors = [...new Set(coverage.errors)]
      // Purge disappeared files for this source; no raw transcript is retained in cache.
      for (const key of this.cache.keys()) if (key.startsWith(source.id + ':') && !seen.has(key)) this.cache.delete(key)
    }
    return output
  }
}

function sanitizeTree(value: Row, onRedaction: () => void): Row {
  const visit = (x: unknown, field?: string): unknown => {
    if (typeof x === 'string') {
      if (field && /^(?:password|api[_-]?key|access[_-]?token|refresh[_-]?token|secret|authorization)$/i.test(field) && x) { onRedaction(); return '[REDACTED]' }
      const clean = redactText(x); for (let i = 0; i < clean.redactions; i++) onRedaction(); return clean.text
    }
    if (Array.isArray(x)) return x.map(item => visit(item))
    if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, visit(v, k)]))
    return x
  }
  return object(visit(value))
}

export async function scanSources(configs: SourceConfig[], options?: ScanOptions): Promise<ScanResult> {
  return new SourceScanner().scan(configs, options)
}
