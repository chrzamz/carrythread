import type { AgentSession, SourceConfig } from '../contracts'
import { redactText } from '../privacy'
import { addMessage, fallbackNative, finish, hash, makeSession, object, parsed, sessionId, string, textBlocks, timestamp, type LocatedRow, type ParsedSource, type Row } from './shared'

const questionTool = (name: string) => /(?:AskUserQuestion|request_user_input(?:_async)?)$/.test(name)

export function parseClaude(source: SourceConfig, rows: LocatedRow[]): ParsedSource {
  const result = parsed()
  const sessions = new Map<string, AgentSession>()
  const questions = new Set<string>()
  const get = (row: LocatedRow) => {
    const r = row.value
    const parentNative = string(r.sessionId) || fallbackNative(row.path)
    const native = r.isSidechain ? `${parentNative}/subagent/${fallbackNative(row.path)}` : parentNative
    let session = sessions.get(native)
    if (!session) {
      session = makeSession(source, native, row.path, { cwd: r.cwd, version: r.version })
      sessions.set(native, session)
    }
    if (r.cwd) session.cwd = string(r.cwd)
    return session
  }
  for (const row of rows) {
    const r = row.value
    if (r.type === 'custom-title') {
      const s = get(row)
      const titled = makeSession(source, s.nativeId, s.sourcePath, { title: r.customTitle })
      s.title = titled.title; s.titleOrigin = titled.titleOrigin
      continue
    }
    if (!['user', 'assistant'].includes(string(r.type))) continue
    const message = object(r.message)
    const role = string(message.role) || string(r.type)
    if (role !== 'user' && role !== 'assistant') continue
    const s = get(row)
    if (r.parentSessionId) s.parentId = sessionId(source, string(r.parentSessionId))
    if (r.isSidechain && !s.parentId) {
      // Claude sidechains live under <parent-session>/subagents; preserve that relation.
      const match = row.path.replace(/\\/g, '/').match(/\/([^/]+)\/subagents\//)
      if (match) s.parentId = sessionId(source, match[1])
    }
    const content = message.content
    for (const block of Array.isArray(content) ? content : []) {
      const b = object(block)
      if (b.type === 'tool_use' && questionTool(string(b.name))) questions.add(string(b.id))
      if (b.type === 'tool_result' && questions.has(string(b.tool_use_id))) {
        addMessage(result, s, {
          nativeId: `${string(r.uuid)}:answer:${string(b.tool_use_id)}`, role: 'tool', kind: 'answer',
          text: textBlocks(b.content), timestamp: r.timestamp, path: row.path, line: row.line,
          turnId: string(r.promptId) || undefined,
        })
      }
    }
    const text = textBlocks(content)
    if (!text.trim()) continue
    addMessage(result, s, {
      nativeId: string(r.uuid) || string(message.id), role, text, timestamp: r.timestamp,
      path: row.path, line: row.line, parentId: string(r.parentUuid) || undefined,
      turnId: string(r.promptId) || undefined,
      kind: r.isMeta ? 'context' : undefined,
    })
  }
  result.sessions = [...sessions.values()]
  const knownMetadata = new Set(['queue-operation', 'last-prompt', 'agent-name', 'file-history-snapshot', 'file-history-delta', 'custom-title', 'api-request', 'api-request-blob', 'api-request-shape', 'system', 'cost-state', 'mode', 'attachment', 'atis-latch', 'summary', 'progress', 'launched', 'started', 'result', 'failed'])
  if (!result.sessions.length && rows.length && !rows.every(row => knownMetadata.has(string(row.value.type)))) result.errors.push('No supported Claude Code messages were found.')
  return finish(result)
}

export function parseCodex(source: SourceConfig, rows: LocatedRow[]): ParsedSource {
  const result = parsed()
  // Early Codex rollouts stored a bare session header followed by bare ResponseItems.
  // Those message rows often have no timestamps; never copy the header date to them.
  const first = rows[0]?.value
  if (first && !first.type && first.id && first.timestamp && !first.role) {
    rows = rows.map((row, index) => index === 0 ? { ...row, value: { type: 'session_meta', payload: row.value, timestamp: row.value.timestamp } } :
      ['message', 'reasoning', 'function_call', 'function_call_output', 'custom_tool_call', 'custom_tool_call_output'].includes(string(row.value.type)) ?
        { ...row, value: { type: 'response_item', payload: row.value, timestamp: row.value.timestamp } } : row)
  }
  const header = rows.find(row => row.value.type === 'session_meta')?.value
  const meta = object(header?.payload)
  const native = string(meta.id) || string(meta.session_id) || fallbackNative(rows[0]?.path || '')
  const session = makeSession(source, native, rows[0]?.path || '', {
    cwd: meta.cwd, version: meta.cli_version, startedAt: meta.timestamp,
    parentId: meta.parent_thread_id || meta.forked_from_id,
  })
  const questions = new Set<string>()
  const nativeMessages: LocatedRow[] = []
  const mirrors: LocatedRow[] = []
  const rowTurns = new Map<number, string>()
  let currentTurn = ''
  for (const row of rows) {
    const r = row.value, p = object(r.payload)
    if ((r.type === 'turn_context' || (r.type === 'event_msg' && p.type === 'task_started')) && p.turn_id) currentTurn = string(p.turn_id)
    if (currentTurn) rowTurns.set(row.line, currentTurn)
    if (r.type === 'response_item') {
      if (p.type === 'message' && ['user', 'assistant'].includes(string(p.role))) nativeMessages.push(row)
      if (['function_call', 'custom_tool_call'].includes(string(p.type)) && questionTool(string(p.name))) questions.add(string(p.call_id))
      if (['function_call_output', 'custom_tool_call_output'].includes(string(p.type)) && questions.has(string(p.call_id))) {
        addMessage(result, session, { nativeId: `${string(p.call_id)}:answer`, role: 'tool', kind: 'answer',
          text: typeof p.output === 'string' ? p.output : textBlocks(p.output), timestamp: r.timestamp, path: row.path, line: row.line })
      }
    }
    if (r.type === 'event_msg' && ['user_message', 'agent_message', 'item_completed', 'task_complete'].includes(string(p.type))) mirrors.push(row)
  }
  for (const row of nativeMessages) {
    const r = row.value, p = object(r.payload), m = object(p.internal_chat_message_metadata_passthrough)
    addMessage(result, session, {
      nativeId: string(p.id), role: p.role as 'user' | 'assistant', text: textBlocks(p.content),
      timestamp: r.timestamp || m.create_time, path: row.path, line: row.line,
      turnId: string(m.turn_id) || rowTurns.get(row.line) || undefined,
    })
  }
  const origins = new Map(session.messages.map(m => [m.id, 'response']))
  const matched = new Map<string, Set<string>>()
  // Older versions emit only event_msg. Modern versions mirror response_item messages.
  for (const row of mirrors) {
    const r = row.value, p = object(r.payload), item = object(p.item)
    let role: 'user' | 'assistant', text = '', id = '', turn = string(p.turn_id) || rowTurns.get(row.line) || '', at: unknown = r.timestamp
    if (p.type === 'user_message' || p.type === 'agent_message') {
      role = p.type === 'user_message' ? 'user' : 'assistant'; text = textBlocks(p.message); id = string(p.id)
    } else if (p.type === 'item_completed' && ['UserMessage', 'AgentMessage'].includes(string(item.type))) {
      role = item.type === 'UserMessage' ? 'user' : 'assistant'; text = textBlocks(item.content); id = string(item.id); at ||= p.completed_at_ms
    } else if (p.type === 'task_complete') {
      role = 'assistant'; text = string(p.last_agent_message); at ||= p.completed_at
    } else continue
    if (!text.trim()) continue
    const eventTime = timestamp(at)
    const family = string(p.type)
    const used = matched.get(family) ?? new Set<string>()
    matched.set(family, used)
    const cleanText = redactText(text).text
    const same = session.messages.find(m => m.role === role && m.text === cleanText &&
      ((id && m.id === `${session.id}:${hash(id)}`) ||
       (origins.get(m.id) !== family && !used.has(m.id) && ((turn && m.turnId === turn) ||
       (m.timestamp && eventTime && Math.abs(Date.parse(m.timestamp) - Date.parse(eventTime)) <= 2000)))))
    if (same) { used.add(same.id); result.skipped++; continue }
    addMessage(result, session, { nativeId: id, role, text, timestamp: at, path: row.path, line: row.line, turnId: turn || undefined })
    const added = id ? session.messages.find(m => m.id === `${session.id}:${hash(id)}`) : session.messages.at(-1)
    if (added) origins.set(added.id, family)
  }
  if (session.messages.length || Object.keys(meta).length) result.sessions.push(session)
  else if (rows.length && !rows.every(row => ['session_meta', 'event_msg', 'response_item', 'turn_context', 'world_state', 'token_usage_record', 'inter_agent_communication_metadata'].includes(string(row.value.type)))) result.errors.push('No supported Codex messages were found.')
  return finish(result)
}

export function parsePi(source: SourceConfig, rows: LocatedRow[]): ParsedSource {
  const result = parsed(), header = rows.find(r => r.value.type === 'session')?.value ?? {}
  const version = Number(header.version || 1)
  if (![1, 2, 3].includes(version)) { result.errors.push('Unsupported Pi session version.'); return result }
  const native = string(header.id) || fallbackNative(rows[0]?.path || '')
  const titleRow = rows.filter(r => r.value.type === 'session_info').at(-1)?.value
  const session = makeSession(source, native, rows[0]?.path || '', {
    title: titleRow?.name, cwd: header.cwd, version, startedAt: header.timestamp,
    parentId: header.parentSession,
  })
  const questions = new Set<string>()
  for (const row of rows) {
    const r = row.value
    if (['compaction', 'branch_summary'].includes(string(r.type))) {
      addMessage(result, session, { nativeId: string(r.id), role: 'assistant', kind: 'context', text: string(r.summary),
        timestamp: r.timestamp, path: row.path, line: row.line, parentId: string(r.parentId) || undefined })
      continue
    }
    if (r.type !== 'message') continue
    const m = object(r.message), role = string(m.role)
    for (const part of Array.isArray(m.content) ? m.content : []) {
      const b = object(part)
      if (b.type === 'toolCall' && questionTool(string(b.name))) questions.add(string(b.id))
    }
    if (!['user', 'assistant'].includes(role) && !(role === 'toolResult' && questions.has(string(m.toolCallId)))) continue
    addMessage(result, session, { nativeId: string(r.id), role: role === 'toolResult' ? 'tool' : role as 'user' | 'assistant',
      text: textBlocks(m.content), timestamp: r.timestamp || m.timestamp, path: row.path, line: row.line,
      parentId: string(r.parentId) || undefined, kind: role === 'toolResult' ? 'answer' : undefined })
  }
  // Preserve the graph. It contains earlier real work, not only the currently selected branch.
  // Downstream extraction sees parentId and does not assume neighboring rows share a branch.
  if (session.messages.length || header.type === 'session') result.sessions.push(session)
  else if (rows.length) result.errors.push('No supported Pi messages were found.')
  return finish(result)
}

/** Finch runtime snapshots are a fallback when its native Pi session is unavailable. */
export function parseFinchRuntime(source: SourceConfig, rows: LocatedRow[]): ParsedSource {
  const result = parsed()
  const latest = rows.at(-1)
  if (!latest) return result
  const r = latest.value
  if (r.version !== 1 || !Array.isArray(r.turns)) {
    result.errors.push('Unsupported Finch runtime snapshot.'); return result
  }
  const meta = object(r.session), config = object(meta.config)
  const native = string(r.sessionId) || string(meta.id) || fallbackNative(latest.path)
  const session = makeSession(source, native, latest.path, { title: meta.title || meta.name, cwd: meta.cwd || config.cwd,
    startedAt: meta.createdAt, version: `runtime-${String(r.version)}` })
  for (const raw of r.turns) {
    const turn = object(raw), turnId = string(turn.turnId) || string(turn.id)
    // Finch runtime v1 stores normalized turn input/output, not Pi message blocks.
    if (typeof turn.text === 'string' || typeof turn.outputText === 'string') {
      if (turn.text) addMessage(result, session, { nativeId: string(turn.clientMessageId) || `${turnId}:input`,
        role: 'user', kind: 'context', text: string(turn.text), timestamp: turn.createdAt,
        path: latest.path, line: latest.line, turnId: turnId || undefined })
      if (turn.outputText) addMessage(result, session, { nativeId: `${turnId}:output`,
        role: 'assistant', kind: 'context', text: string(turn.outputText), timestamp: turn.completedAt,
        path: latest.path, line: latest.line, turnId: turnId || undefined })
      continue
    }
    const messages = Array.isArray(turn.messages) ? turn.messages : Array.isArray(turn.items) ? turn.items : []
    for (const entry of messages) {
      const item = object(entry), m = Object.keys(object(item.message)).length ? object(item.message) : item
      const role = string(m.role) || (item.type === 'userMessage' ? 'user' : item.type === 'agentMessage' ? 'assistant' : '')
      if (!['user', 'assistant'].includes(role)) continue
      addMessage(result, session, { nativeId: string(item.id), role: role as 'user' | 'assistant',
        text: textBlocks(m.content) || string(m.text), timestamp: item.timestamp || m.timestamp || turn.startedAt,
        path: latest.path, line: latest.line, turnId: turnId || undefined })
    }
  }
  if (!session.messages.length && r.turns.length) result.errors.push('Finch runtime contains no supported message entries; native Pi logs are preferred.')
  if (session.messages.length) result.errors.push('Finch runtime is a snapshot; some event timestamps are unavailable.')
  if (session.messages.length) result.sessions.push(session)
  return finish(result)
}

export function parseGeneric(source: SourceConfig, rows: LocatedRow[]): ParsedSource {
  const result = parsed(), sessions = new Map<string, AgentSession>()
  const consume = (r: Row, location: LocatedRow, inherited: Row = {}) => {
    if (Array.isArray(r.sessions)) { for (const s of r.sessions) consume(object(s), location); return }
    if (Array.isArray(r.records)) { for (const m of r.records) consume(object(m), location, r); return }
    const native = string(r.session_id) || string(r.sessionId) || (Array.isArray(r.messages) ? string(r.nativeId) || string(r.id) : '') || string(inherited.nativeId) || string(inherited.id) || `file-${hash(location.path)}`
    let session = sessions.get(native)
    if (!session) {
      session = makeSession(source, native, location.path, { title: r.title || inherited.title, cwd: r.cwd || inherited.cwd,
        startedAt: r.startedAt || inherited.startedAt, parentId: r.parent_session_id || inherited.parentId, version: r.schemaVersion || inherited.schemaVersion })
      sessions.set(native, session)
    }
    if (Array.isArray(r.messages)) { for (const m of r.messages) consume(object(m), location, { ...r, nativeId: native }); return }
    const role = string(r.role) || 'source'
    if (!['user', 'assistant', 'source', 'tool'].includes(role)) { result.skipped++; return }
    const kind = r.record_kind === 'snapshot' || r.record_kind === 'carried_context' || r.kind === 'context' ? 'context' : r.kind === 'answer' ? 'answer' : role === 'tool' ? 'result' : 'message'
    addMessage(result, session, { nativeId: string(r.message_id) || string(r.id), role: role === 'source' ? 'tool' : role as 'user' | 'assistant' | 'tool',
      text: string(r.text) || textBlocks(r.content), timestamp: ['mtime', 'file_mtime', 'modified_at', 'modification', 'modified_at_only'].includes(string(r.timestamp_basis)) ? undefined : r.timestamp,
      path: location.path, line: location.line, kind, parentId: string(r.parent_message_id || r.parentId) || undefined,
      turnId: string(r.turn_id || r.turnId) || undefined })
  }
  for (const row of rows) consume(row.value, row)
  result.sessions = [...sessions.values()].filter(s => s.messages.length)
  if (!result.sessions.length && rows.length) result.errors.push('No supported generic records were found.')
  return finish(result)
}

export function parseRows(source: SourceConfig, rows: LocatedRow[]): ParsedSource {
  switch (source.agent) {
    case 'claude': return parseClaude(source, rows)
    case 'codex': return parseCodex(source, rows)
    case 'pi': return parsePi(source, rows)
    case 'finch': return rows.some(r => r.value.sessionId && Array.isArray(r.value.turns)) ? parseFinchRuntime(source, rows) : parsePi(source, rows)
    case 'generic': return parseGeneric(source, rows)
    default: return parsed()
  }
}
