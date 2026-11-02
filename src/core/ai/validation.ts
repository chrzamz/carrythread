import type { EvidenceRef, Locale, SourceMessage, WorkItem, WorkItemDraft, WorkState } from '../contracts'
import { AIError } from './errors'

const STATES: WorkState[] = ['active', 'decision', 'waiting', 'verify', 'done', 'paused', 'cancelled', 'candidate']
const DRAFT_KEYS = ['existingId', 'project', 'title', 'state', 'stage', 'summary', 'nextAction', 'completionCriteria', 'decisions', 'uncertainties', 'evidence', 'confidence']
const reviewGaps: Record<Locale, { completion: string; commitment: string; stage: string; next: string; reported: string }> = {
  en: { completion: 'Completion is reported but lacks an independent confirmation of the stated outcome.', commitment: 'Only an assistant report is available; the user request or commitment needs confirmation.', stage: 'Reported outcome; awaiting verification', next: 'Verify the reported outcome against the completion criteria.', reported: 'Reported outcome: ' },
  'zh-CN': { completion: '记录中报告了完成，但缺少对目标结果的独立确认。', commitment: '目前只有助手报告，用户是否提出或承诺这项工作仍需确认。', stage: '据记录报告，结果待核实', next: '按完成标准核实记录中报告的结果。', reported: '记录中报告：' },
  es: { completion: 'Se informó de la finalización, pero falta una confirmación independiente del resultado.', commitment: 'Solo hay un informe del asistente; falta confirmar la solicitud o el compromiso del usuario.', stage: 'Resultado informado; pendiente de verificar', next: 'Verifica el resultado informado según los criterios de finalización.', reported: 'Resultado informado: ' },
  ja: { completion: '完了の報告はありますが、目標の達成を裏付ける独立した確認がありません。', commitment: 'アシスタントの報告のみです。ユーザーの依頼や合意を確認する必要があります。', stage: '報告された結果・確認待ち', next: '完了条件に照らして、報告された結果を確認してください。', reported: '報告された結果：' },
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
}

function text(value: unknown, max: number, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()) || value.includes('\0')) throw new AIError('invalid_output')
  return value
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 1000) throw new AIError('invalid_output')
  return value.map(entry => text(entry, 2000))
}

export function validateWorkItemDraft(value: unknown, allowEmptyEvidence = false): WorkItemDraft {
  if (!isRecord(value) || Object.keys(value).some(key => !DRAFT_KEYS.includes(key))) throw new AIError('invalid_output')
  if (!STATES.includes(value.state as WorkState) || !['supported', 'uncertain'].includes(value.confidence as string)) throw new AIError('invalid_output')
  if (!Array.isArray(value.evidence) || value.evidence.length > 10_000 || (!allowEmptyEvidence && !value.evidence.length)) throw new AIError('invalid_output')
  const evidence: EvidenceRef[] = value.evidence.map(ref => {
    if (!isRecord(ref) || Object.keys(ref).some(key => !['messageId', 'sessionId', 'quote'].includes(key))) throw new AIError('invalid_evidence')
    return { messageId: text(ref.messageId, 500), sessionId: text(ref.sessionId, 500), quote: text(ref.quote, 2000) }
  })
  return {
    ...(value.existingId === undefined ? {} : { existingId: text(value.existingId, 500) }),
    project: text(value.project, 300), title: text(value.title, 300), state: value.state as WorkState,
    stage: text(value.stage, 1000), summary: text(value.summary, 5000), nextAction: text(value.nextAction, 3000, true),
    completionCriteria: text(value.completionCriteria, 3000, true), decisions: strings(value.decisions), uncertainties: strings(value.uncertainties),
    evidence, confidence: value.confidence as WorkItemDraft['confidence'],
  }
}

export function assertEvidence(ref: EvidenceRef, messages: Map<string, SourceMessage>): SourceMessage {
  const message = messages.get(ref.messageId)
  if (!message || message.sessionId !== ref.sessionId || message.kind === 'context' || !ref.quote.trim() || !message.text.includes(ref.quote)) throw new AIError('invalid_evidence')
  return message
}

/** Checks schema and attribution. Semantic interpretation remains an AI proposal. */
export function parseReviewOutput(content: string, messages: SourceMessage[], existingItems: WorkItem[], locale: Locale = 'en'): WorkItemDraft[] {
  try {
    const clean = content.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, '$1')
    let value: unknown
    try { value = JSON.parse(clean) } catch { throw new AIError('invalid_output') }
    if (!isRecord(value) || Object.keys(value).some(key => key !== 'items') || !Array.isArray(value.items) || value.items.length > 40) throw new AIError('invalid_output')
    const available = new Map(messages.map(message => [message.id, message]))
    if (available.size !== messages.length) throw new AIError('invalid_evidence')
    const existing = new Map(existingItems.map(item => [item.id, item]))
    const updated = new Set<string>()
    return value.items.map(raw => {
      if (!isRecord(raw)) throw new AIError('invalid_output')
      const { origin, completionProof, ...fields } = raw
      if (!['request', 'observation', 'suggestion'].includes(origin as string)) throw new AIError('invalid_output')
      for (const field of ['evidence', 'decisions', 'uncertainties']) if (!Array.isArray(fields[field]) || fields[field].length > 30) throw new AIError('invalid_output')
      const draft = validateWorkItemDraft(fields)
      const refs = draft.evidence.map(ref => assertEvidence(ref, available))
      if (draft.existingId && (!existing.has(draft.existingId) || updated.has(draft.existingId))) throw new AIError('invalid_evidence')
      if (draft.existingId) updated.add(draft.existingId)
      const hasUser = refs.some(message => message.role === 'user' || message.kind === 'answer')
      if (origin === 'request' && !hasUser) {
        draft.confidence = 'uncertain'
        draft.uncertainties = [...new Set([...draft.uncertainties, reviewGaps[locale].commitment])]
        if (draft.state === 'active') draft.state = 'verify'
      }
      if (origin === 'suggestion') draft.state = 'candidate'
      if (['paused', 'cancelled'].includes(draft.state) && !hasUser && !draft.existingId) throw new AIError('invalid_evidence')

      let verifiedProof = false
      if (completionProof !== undefined && completionProof !== null) {
        if (!isRecord(completionProof) || Object.keys(completionProof).some(key => !['messageId', 'quote', 'explanation'].includes(key))) throw new AIError('invalid_output')
        // A missing proof can be downgraded; invented IDs or quotations cannot.
        const proofId = completionProof.messageId === undefined ? undefined : text(completionProof.messageId, 500)
        const proofQuote = completionProof.quote === undefined ? undefined : text(completionProof.quote, 2000)
        const message = proofId ? available.get(proofId) : undefined
        if (proofId && !message) throw new AIError('invalid_evidence')
        if (message && proofId && proofQuote) {
          const proof = assertEvidence({ messageId: proofId, sessionId: message.sessionId, quote: proofQuote }, available)
          const cited = draft.evidence.some(entry => entry.messageId === proofId && entry.quote === proofQuote)
          verifiedProof = cited && (proof.role === 'user' || proof.role === 'tool') && typeof completionProof.explanation === 'string' && completionProof.explanation.trim().length > 0 && completionProof.explanation.length <= 3000
        }
      }
      if (draft.state === 'done' && (!verifiedProof || draft.confidence !== 'supported' || draft.uncertainties.length || !draft.completionCriteria.trim())) {
        const gap = reviewGaps[locale]
        draft.state = 'verify'; draft.confidence = 'uncertain'
        draft.uncertainties = [...new Set([...draft.uncertainties, gap.completion])]
        draft.stage = gap.stage
        draft.summary = (gap.reported + draft.summary).slice(0, 5000)
        draft.nextAction = gap.next
      }
      if (draft.confidence === 'uncertain' && !draft.uncertainties.length) throw new AIError('invalid_output')
      return draft
    })
  } catch (error) {
    throw new AIError(error instanceof AIError ? error.code : 'invalid_output', locale)
  }
}
