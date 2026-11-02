import { createHash } from 'node:crypto'
import { basename } from 'node:path'
import type { AgentSession, SourceConfig, SourceMessage } from '../contracts'
import { redactText } from '../privacy'

export type Row = Record<string, unknown>
export interface LocatedRow { value: Row; path: string; line: number }
export interface ParsedSource { sessions: AgentSession[]; skipped: number; redacted: number; errors: string[] }
export const parsed = (): ParsedSource => ({ sessions: [], skipped: 0, redacted: 0, errors: [] })
export const object = (value: unknown): Row => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}
export const string = (value: unknown): string => typeof value === 'string' ? value : ''
export const hash = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 24)
export const sessionId = (source: SourceConfig, native: string): string => `${source.id}:${hash(native)}`
const messageIndices = new WeakMap<AgentSession, Map<string, number>>()

export function timestamp(value: unknown): string | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    const d = new Date(Math.abs(value) < 100_000_000_000 ? value * 1000 : value)
    return Number.isNaN(d.valueOf()) ? null : d.toISOString()
  }
  // A date without an explicit timezone is not a known instant.
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) return null
  const d = new Date(value)
  return Number.isNaN(d.valueOf()) ? null : d.toISOString()
}

export function textBlocks(value: unknown): string {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  return value.map(part => {
    const p = object(part)
    return ['text', 'input_text', 'output_text'].includes(string(p.type)) ? string(p.text) : ''
  }).filter(Boolean).join('\n')
}

export function isContext(text: string): boolean {
  return /^(?:Background \(from the session|This session is being continued|The following is a summary|The previous conversation was summarized|<conversation_summary>|<summary>|<task-notification|<subagent_notification|<side-sessions-event>)/i.test(text.trim())
}

export function makeSession(source: SourceConfig, native: string, path: string, meta: Row = {}): AgentSession {
  const title = redactText(string(meta.title)).text.trim()
  return {
    id: sessionId(source, native), sourceId: source.id, nativeId: redactText(native).text, agent: source.agent,
    title: title || 'Untitled session', titleOrigin: title ? 'source' : 'derived',
    cwd: redactText(string(meta.cwd)).text, sourcePath: path,
    startedAt: timestamp(meta.startedAt), updatedAt: timestamp(meta.updatedAt), messages: [],
    ...(meta.parentId ? { parentId: sessionId(source, string(meta.parentId)) } : {}),
    ...(meta.version !== undefined ? { version: redactText(String(meta.version)).text } : {}),
  }
}

export interface MessageInput {
  nativeId?: string; text: string; role: SourceMessage['role']; timestamp: unknown;
  path: string; line?: number; kind?: SourceMessage['kind']; parentId?: string; turnId?: string;
}

export function addMessage(result: ParsedSource, session: AgentSession, input: MessageInput): void {
  const clean = redactText(input.text) // Always redact the full text before any truncation.
  result.redacted += clean.redactions
  if (!clean.text.trim()) { result.skipped++; return }
  const limit = 120_000
  const text = clean.text.length > limit ? clean.text.slice(0, limit) + '\n[Text truncated]' : clean.text
  if (clean.text.length > limit) result.errors.push('Message text exceeded the import limit and was truncated.')
  const at = timestamp(input.timestamp)
  const native = input.nativeId || `${input.path}:${input.line ?? 0}:${hash(input.text)}`
  const id = `${session.id}:${hash(native)}`
  let indices = messageIndices.get(session)
  if (!indices) { indices = new Map(session.messages.map((message, index) => [message.id, index])); messageIndices.set(session, indices) }
  const previous = indices.get(id)
  const message: SourceMessage = {
    id, sessionId: session.id, role: input.role, text, timestamp: at,
    sourcePath: input.path, ...(input.line ? { line: input.line } : {}),
    kind: input.kind ?? (isContext(text) ? 'context' : 'message'),
    ...(input.parentId ? { parentId: `${session.id}:${hash(input.parentId)}` } : {}),
    ...(input.turnId ? { turnId: redactText(input.turnId).text } : {}),
  }
  if (previous !== undefined) session.messages[previous] = message
  else { indices.set(id, session.messages.length); session.messages.push(message) }
}

export function finish(result: ParsedSource): ParsedSource {
  for (const session of result.sessions) {
    for (const field of ['title', 'cwd'] as const) {
      const clean = redactText(session[field]); session[field] = clean.text; result.redacted += clean.redactions
    }
    const dates = session.messages.filter(m => m.kind !== 'context').flatMap(m => m.timestamp ? [m.timestamp] : []).sort()
    session.startedAt ||= dates[0] ?? null
    session.updatedAt = dates.at(-1) ?? session.updatedAt
    session.messages.sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? '') || (a.line ?? 0) - (b.line ?? 0))
    messageIndices.delete(session)
  }
  result.errors = [...new Set(result.errors)]
  return result
}

export function fallbackNative(path: string): string {
  return basename(path).replace(/\.(jsonl?|md|markdown)$/i, '') || hash(path)
}
