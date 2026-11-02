import { createHash } from 'node:crypto'
import { posix, win32 } from 'node:path'
import type { AgentKind, AgentSession, HandoffPackage, SourceMessage, WorkItem } from './contracts'
import { redactText } from './privacy'

export interface ReviewSessionContext {
  sessionId: string
  agent: AgentKind
  title: string
  workspaceKey: string | null
  projectHint: string | null
  linkedItemIds: string[]
  /** Only first-line user markers verified against the local handoff registry. */
  handoffLinks?: { messageId: string; itemId: string }[]
}
export interface ReviewContext { sessionContext: ReviewSessionContext[] }
type SessionMetadata = Pick<AgentSession, 'id' | 'agent' | 'title' | 'cwd'>

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const MARKER = new RegExp(`^<!-- carrythread handoff=(${UUID}) item=(\\S{1,1500}) revision=([1-9][0-9]{0,14}) -->$`, 'i')

function workspace(cwd: string): { key: string | null; hint: string | null; normalized: string } {
  if (!cwd || cwd.includes('\0') || redactText(cwd).redactions) return { key: null, hint: null, normalized: '' }
  const windows = /^[a-z]:[\\/]/i.test(cwd) || cwd.startsWith('\\\\')
  const path = windows ? win32 : posix
  if (!path.isAbsolute(cwd)) return { key: null, hint: null, normalized: '' }
  let normalized = path.normalize(cwd)
  if (windows) normalized = normalized.replace(/^[A-Z]:/, drive => drive.toLowerCase())
  if (normalized !== path.parse(normalized).root) normalized = normalized.replace(/[\\/]+$/, '')
  const digest = createHash('sha256').update(`${windows ? 'windows' : 'posix'}\0${normalized}`).digest('hex')
  return { key: `workspace-${digest}`, hint: redactText(path.basename(normalized)).text.slice(0, 300) || null, normalized }
}

/** A local equality hint only: not a global project identity or a permission grant. */
export function workspaceKeyFor(cwd: string): string | null { return workspace(cwd).key }

/** Missing directories cannot establish a conflict; two known disjoint sets can. */
export function workspacesDisjoint(left: Iterable<string | null>, right: Iterable<string | null>): boolean {
  const a = new Set([...left].filter((key): key is string => Boolean(key)))
  const b = new Set([...right].filter((key): key is string => Boolean(key)))
  return a.size > 0 && b.size > 0 && ![...a].some(key => b.has(key))
}

function firstLineMarker(message: SourceMessage): { handoffId: string; itemId: string; revision: number } | null {
  if (message.role !== 'user' || message.kind === 'context') return null
  const end = message.text.indexOf('\n')
  const line = (end === -1 ? message.text : message.text.slice(0, end)).trim()
  if (line.length > 2048) return null
  const match = MARKER.exec(line)
  if (!match) return null
  let itemId: string
  try { itemId = decodeURIComponent(match[2]) } catch { return null }
  if (!itemId || itemId.length > 500 || /[\x00-\x1f\x7f]/.test(itemId) || redactText(itemId).redactions) return null
  const revision = Number(match[3])
  if (!Number.isSafeInteger(revision)) return null
  return { handoffId: match[1].toLowerCase(), itemId, revision }
}

/**
 * Derives context locally from selected sessions and our handoff registry.
 * Never accept linkedItemIds from the renderer or infer them from assistant prose.
 * A verified historical handoff can refer to an older revision of a still-existing item;
 * the current item, including later user corrections, remains authoritative.
 */
export function buildReviewContext(
  messages: SourceMessage[],
  sessions: SessionMetadata[],
  handoffs: HandoffPackage[],
  existingItems: WorkItem[],
): ReviewContext {
  const selected = new Set(messages.map(message => message.sessionId))
  const metadata = new Map<string, SessionMetadata>()
  const ambiguous = new Set<string>()
  for (const session of sessions) {
    if (!selected.has(session.id)) continue
    const previous = metadata.get(session.id)
    if (previous && (previous.agent !== session.agent || previous.cwd !== session.cwd || previous.title !== session.title)) ambiguous.add(session.id)
    metadata.set(session.id, session)
  }
  const items = new Set(existingItems.map(item => item.id))
  const registry = new Map<string, HandoffPackage>()
  const conflictingHandoffs = new Set<string>()
  for (const handoff of handoffs) {
    const id = handoff.id.toLowerCase()
    const previous = registry.get(id)
    if (previous && (previous.itemId !== handoff.itemId || previous.revision !== handoff.revision || previous.target !== handoff.target)) conflictingHandoffs.add(id)
    registry.set(id, handoff)
  }
  const links = new Map<string, Set<string>>()
  const messageLinks = new Map<string, { messageId: string; itemId: string }[]>()
  for (const message of messages) {
    const session = metadata.get(message.sessionId)
    if (!session || ambiguous.has(session.id)) continue
    const marker = firstLineMarker(message)
    if (!marker || conflictingHandoffs.has(marker.handoffId)) continue
    const handoff = registry.get(marker.handoffId)
    if (!handoff || handoff.itemId !== marker.itemId || handoff.revision !== marker.revision || !items.has(marker.itemId)) continue
    if (handoff.target !== 'generic' && handoff.target !== session.agent) continue
    const sessionLinks = links.get(session.id) ?? new Set<string>()
    sessionLinks.add(marker.itemId)
    links.set(session.id, sessionLinks)
    const verified = messageLinks.get(session.id) ?? []
    if (!verified.some(link => link.messageId === message.id && link.itemId === marker.itemId)) verified.push({ messageId: message.id, itemId: marker.itemId })
    messageLinks.set(session.id, verified)
  }
  const sessionContext: ReviewSessionContext[] = []
  for (const id of selected) {
    const session = metadata.get(id)
    if (!session || ambiguous.has(id)) continue
    const directory = workspace(session.cwd)
    let title = session.title
    // Titles sometimes contain the cwd verbatim. Do not undo the path privacy boundary.
    for (const path of new Set([session.cwd, directory.normalized].filter(Boolean))) title = title.split(path).join(directory.hint ?? '[workspace]')
    sessionContext.push({ sessionId: session.id, agent: session.agent, title: redactText(title).text.slice(0, 1000), workspaceKey: directory.key, projectHint: directory.hint, linkedItemIds: [...(links.get(session.id) ?? [])], handoffLinks: messageLinks.get(session.id) ?? [] })
  }
  return { sessionContext }
}
