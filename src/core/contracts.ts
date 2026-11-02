export const AGENTS = ['codex', 'claude', 'opencode', 'pi', 'finch', 'generic'] as const
export type AgentKind = (typeof AGENTS)[number]
export type Locale = 'en' | 'zh-CN' | 'es' | 'ja'
export type WorkState =
  'active' | 'decision' | 'waiting' | 'verify' | 'done' | 'paused' | 'cancelled' | 'candidate'
export type EvidenceKind = 'user' | 'assistant' | 'tool'

export interface SourceMessage {
  id: string
  sessionId: string
  role: EvidenceKind
  text: string
  timestamp: string | null
  sourcePath: string
  line?: number
  kind?: 'message' | 'answer' | 'result' | 'context'
  parentId?: string
  turnId?: string
}
export interface AgentSession {
  id: string
  sourceId: string
  nativeId: string
  agent: AgentKind
  title: string
  cwd: string
  sourcePath: string
  startedAt: string | null
  updatedAt: string | null
  messages: SourceMessage[]
  parentId?: string
  version?: string
  titleOrigin?: 'source' | 'derived'
}
export interface SourceConfig {
  id: string
  agent: AgentKind
  path: string
  enabled: boolean
}
export interface SourceCoverage {
  sourceId: string
  agent: AgentKind
  path: string
  status: 'ok' | 'missing' | 'partial' | 'error' | 'disabled'
  files: number
  sessions: number
  messages: number
  skipped: number
  redacted: number
  errors: string[]
  scannedAt: string
}
export interface ScanResult {
  sessions: AgentSession[]
  coverage: SourceCoverage[]
}
export interface ScanOptions {
  since?: string
  until?: string
  maxFiles?: number
  maxFileBytes?: number
  signal?: AbortSignal
}
export interface EvidenceRef {
  messageId: string
  sessionId: string
  quote: string
}
export interface WorkItemDraft {
  existingId?: string
  project: string
  title: string
  state: WorkState
  stage: string
  summary: string
  nextAction: string
  completionCriteria: string
  decisions: string[]
  uncertainties: string[]
  evidence: EvidenceRef[]
  confidence: 'supported' | 'uncertain'
}
export interface WorkItem extends Omit<WorkItemDraft, 'existingId'> {
  id: string
  createdAt: string
  updatedAt: string
  reviewedAt: string
  manualOverride: boolean
  revision: number
  note: string
}
export interface ItemChange {
  id: string
  itemId: string
  timestamp: string
  actor: 'user' | 'ai'
  reason: string
  before: WorkItem | null
  after: WorkItem
}
export interface ItemPatch {
  id: string
  expectedRevision: number
  changes: Partial<
    Pick<
      WorkItem,
      | 'project'
      | 'title'
      | 'state'
      | 'stage'
      | 'summary'
      | 'nextAction'
      | 'completionCriteria'
      | 'decisions'
      | 'uncertainties'
      | 'note'
    >
  >
  reason: string
}

export type ProviderProtocol = 'openai' | 'anthropic' | 'ollama'
export interface ProviderConfig {
  id: string
  name: string
  protocol: ProviderProtocol
  baseUrl: string
  model: string
  hasKey: boolean
  timeoutMs: number
  keyStorage?: 'encrypted' | 'session' | 'missing'
}
export interface ProviderPreset {
  id: string
  name: string
  protocol: ProviderProtocol
  baseUrl: string
  region: 'global' | 'cn' | 'local'
  docsUrl: string
  modelsOptional?: boolean
}
export interface AppSettings {
  locale: Locale
  theme: 'system' | 'light' | 'dark'
  autoScan: boolean
  historyDays: number
  sources: SourceConfig[]
  providers: ProviderConfig[]
  activeProviderId: string | null
}
export interface ReviewRequest {
  sessionIds: string[]
  providerId: string
  locale: Locale
  since?: string
  until?: string
}
export interface ReviewResult {
  items: WorkItemDraft[]
  processedMessages: number
  omittedMessages: number
  provider: string
  model: string
}
export interface ReviewRun {
  id: string
  timestamp: string
  sessionIds: string[]
  provider: string
  model: string
  processedMessages: number
  omittedMessages?: number
  itemCount: number
  status: 'complete' | 'failed'
  error?: string
}

export interface ProjectSummary {
  name: string
  items: number
  open: number
  updatedAt: string
}
export interface AppSnapshot {
  settings: AppSettings
  sessions: Omit<AgentSession, 'messages'>[]
  projects: ProjectSummary[]
  items: WorkItem[]
  coverage: SourceCoverage[]
  reviews: ReviewRun[]
}
export interface HandoffRequest {
  itemId: string
  target: AgentKind
  mode: 'new' | 'resume'
  sessionId?: string
  cwd?: string
  instruction: string
  includeEvidence: boolean
}
export interface HandoffPackage {
  id: string
  itemId: string
  revision: number
  target: AgentKind
  mode: 'new' | 'resume'
  sessionId?: string
  cwd: string
  path: string
  content: string
  prompt: string
  createdAt: string
  status: 'prepared' | 'opened' | 'submitted' | 'failed'
  warning?: string
}
export interface TargetCapability {
  agent: AgentKind
  installed: boolean
  executable?: string
  openExisting: boolean
  newWithContext: boolean
  appendExisting: boolean
  kind: 'desktop' | 'terminal' | 'manual'
  notes: string[]
}
export interface ConnectionResult {
  ok: boolean
  message: string
  models?: string[]
}

export interface CarrythreadAPI {
  onChange(listener: () => void): () => void
  snapshot(): Promise<AppSnapshot>
  chooseSource(agent: AgentKind): Promise<SourceConfig | null>
  chooseWorkspace(current?: string): Promise<string | null>
  detectSources(): Promise<SourceConfig[]>
  saveSettings(settings: AppSettings): Promise<void>
  scan(): Promise<{ coverage: SourceCoverage[]; sessions: number; messages: number }>
  session(id: string): Promise<AgentSession | null>
  search(query: string): Promise<SourceMessage[]>
  saveProvider(config: ProviderConfig, key?: string): Promise<void>
  removeProvider(id: string): Promise<void>
  testProvider(id: string): Promise<ConnectionResult>
  providerPresets(): Promise<ProviderPreset[]>
  previewReview(request: Pick<ReviewRequest,'sessionIds'|'since'|'until'>): Promise<{batches:number;totalMessages:number;eligibleMessages:number;omittedMessages:number}>
  review(request: ReviewRequest): Promise<ReviewRun>
  cancelReview(): Promise<void>
  patchItem(patch: ItemPatch): Promise<WorkItem>
  itemHistory(id: string): Promise<ItemChange[]>
  mergeItems(ids: string[], title: string): Promise<WorkItem>
  splitItem(id: string, titles: string[]): Promise<WorkItem[]>
  targets(): Promise<TargetCapability[]>
  prepareHandoff(request: HandoffRequest): Promise<HandoffPackage>
  launchHandoff(id: string): Promise<HandoffPackage>
  exportHandoff(id: string): Promise<string | null>
  openEvidence(messageId: string): Promise<void>
  exportData(): Promise<string | null>
  importData(): Promise<{ sessions: number; items: number } | null>
  clearLocalData(): Promise<void>
  openExternal(url: string): Promise<void>
  version(): Promise<string>
}
