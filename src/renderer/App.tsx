import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { FormEvent, ReactElement, ReactNode } from 'react'
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Clock3,
  Cog,
  FileText,
  FolderOpen,
  GitMerge,
  Layers3,
  LoaderCircle,
  MessageSquareText,
  Moon,
  Pause,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Split,
  Unplug,
  X,
} from 'lucide-react'
import type {
  AgentKind,
  AgentSession,
  AppSettings,
  AppSnapshot,
  HandoffPackage,
  HandoffRequest,
  ItemChange,
  Locale,
  ProviderConfig,
  ProviderPreset,
  SourceMessage,
  TargetCapability,
  WorkItem,
  WorkState,
} from '../core/contracts'
import { AGENTS } from '../core/contracts'
import { errorText, formatDate, languages, translate, type MessageKey } from './i18n'
import markUrl from '../../resources/brand/mark.svg'
import { translateDiagnostic } from '../core/sources/diagnostics'

const api = window.carrythread
const states: WorkState[] = [
  'active',
  'decision',
  'waiting',
  'verify',
  'done',
  'paused',
  'cancelled',
  'candidate',
]
const agentName = (agent: AgentKind) =>
  ({
    codex: 'Codex',
    claude: 'Claude Code',
    opencode: 'OpenCode',
    pi: 'Pi',
    finch: 'Finch',
    generic: 'JSON / Markdown',
  })[agent]
const unfinished = (item: WorkItem) =>
  !['done', 'paused', 'cancelled', 'candidate'].includes(item.state)
const iconSize = 17
type View = 'overview' | 'work' | 'evidence' | 'sources' | 'ai' | 'settings'
type T = (key: MessageKey, params?: Record<string, string | number>) => string

function Mark({ size = 32 }: { size?: number }) {
  return <img src={markUrl} width={size} height={size} alt="" aria-hidden="true" />
}
function Button({
  children,
  onClick,
  primary = false,
  disabled = false,
  type = 'button',
  className = '',
  title,
}: {
  children: ReactNode
  onClick?: () => void
  primary?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
  title?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`button ${primary ? 'primary' : ''} ${className}`}
      title={title}
    >
      {children}
    </button>
  )
}
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const hintId = useId()
  const control =
    isValidElement(children) &&
    typeof children.type === 'string' &&
    ['input', 'select', 'textarea'].includes(children.type)
      ? cloneElement(
          children as ReactElement<{ 'aria-label'?: string; 'aria-describedby'?: string }>,
          { 'aria-label': label, ...(hint ? { 'aria-describedby': hintId } : {}) },
        )
      : children
  return (
    <label className="field">
      <span>{label}</span>
      {control}
      {hint && (
        <small id={hintId} aria-hidden="true">
          {hint}
        </small>
      )}
    </label>
  )
}
function Empty({
  icon,
  heading,
  body,
  children,
}: {
  icon: ReactNode
  heading: string
  body?: string
  children?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h2>{heading}</h2>
      {body && <p>{body}</p>}
      {children && <div className="actions">{children}</div>}
    </div>
  )
}
function Badge({ item, t }: { item: WorkItem; t: T }) {
  return (
    <span className={`badge state-${item.state}`}>
      <span />
      {t(item.state)}
    </span>
  )
}
function Modal({
  title,
  onClose,
  children,
  t,
  wide = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  t: T
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
    return () => ref.current?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label={t('close')} onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  )
}

export default function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null)
  const [appVersion, setAppVersion] = useState('')
  const [view, setView] = useState<View>('overview')
  const [project, setProject] = useState('all')
  const [filter, setFilter] = useState('open')
  const [selected, setSelected] = useState<string | null>(null)
  const [checked, setChecked] = useState<string[]>([])
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [editItem, setEditItem] = useState<WorkItem | null>(null)
  const [handoffItem, setHandoffItem] = useState<WorkItem | null>(null)
  const [history, setHistory] = useState<ItemChange[] | null>(null)
  const [splitItem, setSplitItem] = useState<WorkItem | null>(null)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SourceMessage[] | null>(null)
  const [conversation, setConversation] = useState<AgentSession | null>(null)
  const [evidenceSessions, setEvidenceSessions] = useState<Record<string, AgentSession>>({})
  const locale = snapshot?.settings.locale || 'en'
  const t: T = useCallback((key, params = {}) => translate(locale, key, params), [locale])
  const refresh = useCallback(async () => {
    const next = await api.snapshot()
    setSnapshot(next)
    return next
  }, [])
  const run = useCallback(
    async (label: string, action: () => Promise<unknown>, success?: MessageKey) => {
      setBusy(label)
      setNotice(null)
      try {
        await action()
        await refresh()
        if (success) setNotice({ text: translate(locale, success) })
        return true
      } catch (e) {
        setNotice({ text: errorText(e, locale), error: true })
        return false
      } finally {
        setBusy('')
      }
    },
    [refresh, locale],
  )
  useEffect(() => {
    refresh().catch((e) => setNotice({ text: errorText(e, 'en'), error: true }))
    void api.version().then(setAppVersion)
  }, [refresh])
  useEffect(
    () =>
      api.onChange(() => {
        void refresh().catch(() => undefined)
      }),
    [refresh],
  )
  useEffect(() => setChecked([]), [project])
  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dataset.theme = snapshot?.settings.theme || 'system'
  }, [locale, snapshot?.settings.theme])
  const current = snapshot?.items.find((i) => i.id === selected) || null
  useEffect(() => {
    if (!current) return
    let alive = true
    Promise.all([...new Set(current.evidence.map((e) => e.sessionId))].map((id) => api.session(id)))
      .then((values) => {
        if (alive)
          setEvidenceSessions(
            Object.fromEntries(values.filter((s): s is AgentSession => !!s).map((s) => [s.id, s])),
          )
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [current?.id, current?.revision])
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults(null)
      return
    }
    let alive = true
    const timer = setTimeout(
      () =>
        api
          .search(query.trim())
          .then((r) => alive && setSearchResults(r))
          .catch((e) => alive && setNotice({ text: errorText(e, locale), error: true })),
      250,
    )
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [query, locale])
  const items = useMemo(
    () =>
      snapshot?.items
        .filter(
          (i) =>
            (project === 'all' || i.project === project) &&
            (filter === 'all' || (filter === 'open' && unfinished(i)) || i.state === filter),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) || [],
    [snapshot, project, filter],
  )
  const setSettings = async (changes: Partial<AppSettings>) => {
    if (!snapshot) return
    await api.saveSettings({ ...snapshot.settings, ...changes })
    await refresh()
  }
  const openItem = (item: WorkItem) => {
    setProject(item.project)
    setFilter('all')
    setSelected(item.id)
    setView('work')
  }
  const openConversation = async (id: string) => {
    try {
      setConversation(await api.session(id))
      setView('evidence')
    } catch (e) {
      setNotice({ text: errorText(e, locale), error: true })
    }
  }
  const navigation: { id: View; icon: typeof Layers3 }[] = [
    { id: 'overview', icon: Layers3 },
    { id: 'work', icon: ClipboardList },
    { id: 'evidence', icon: MessageSquareText },
    { id: 'sources', icon: Unplug },
    { id: 'ai', icon: Sparkles },
  ]

  if (!snapshot)
    return (
      <div className="startup">
        <Mark size={44} />
        <h1>Carrythread</h1>
        <p>{notice?.text || t('loading')}</p>
        {notice && <Button onClick={() => void refresh()}>{t('scan')}</Button>}
      </div>
    )
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Mark />
          <div>
            <strong>Carrythread</strong>
            <small>{t('brandSubtitle')}</small>
          </div>
        </div>
        <nav aria-label={t('work')}>
          {navigation.map(({ id, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? 'active' : ''}`}
              onClick={() => setView(id)}
            >
              <Icon size={iconSize} />
              <span>{t(id)}</span>
              {id === 'work' && snapshot.items.filter(unfinished).length > 0 && (
                <small>{snapshot.items.filter(unfinished).length}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-projects">
          <div className="eyebrow">{t('project')}</div>
          <button
            className={`project-nav ${project === 'all' ? 'chosen' : ''}`}
            onClick={() => {
              setProject('all')
              setSelected(null)
              setView('work')
            }}
          >
            <span className="project-dot" />
            {t('allProjects')}
          </button>
          {snapshot.projects.map((p) => (
            <button
              key={p.name}
              className={`project-nav ${project === p.name ? 'chosen' : ''}`}
              onClick={() => {
                setProject(p.name)
                setSelected(null)
                setView('work')
              }}
            >
              <span className="project-dot" />
              <span>{p.name}</span>
              {p.open > 0 && <small>{p.open}</small>}
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="local-note">
            <ShieldCheck size={15} />
            <span>{t('localFirst')}</span>
          </div>
          <button
            className={`nav-item ${view === 'settings' ? 'active' : ''}`}
            onClick={() => setView('settings')}
          >
            <Cog size={iconSize} />
            {t('settings')}
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Carrythread <ChevronRight size={13} />
            <span>{t(view)}</span>
          </div>
          <div className="topbar-actions">
            <select
              className="locale-switch"
              aria-label={t('language')}
              value={locale}
              onChange={(e) => void setSettings({ locale: e.target.value as Locale })}
            >
              {languages.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <Button
              disabled={!!busy || !snapshot.settings.sources.some((s) => s.enabled)}
              onClick={() => void run('scan', () => api.scan())}
            >
              {busy === 'scan' ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <RefreshCw size={15} />
              )}{' '}
              {t(busy === 'scan' ? 'scanning' : 'scan')}
            </Button>
            <Button
              primary
              disabled={!!busy || !snapshot.sessions.length}
              onClick={() => setReviewOpen(true)}
            >
              <Sparkles size={15} />
              {t('review')}
            </Button>
          </div>
        </header>
        {notice && (
          <div
            className={`notice ${notice.error ? 'error' : ''}`}
            role={notice.error ? 'alert' : 'status'}
          >
            <span>{notice.text}</span>
            <button className="icon-button" onClick={() => setNotice(null)} aria-label={t('close')}>
              <X size={15} />
            </button>
          </div>
        )}
        <main className={`main-content ${view === 'work' ? 'work-layout' : ''}`}>
          {view === 'overview' && (
            <>
              {!snapshot.sessions.length ? (
                <div className="welcome">
                  <span className="welcome-line" />
                  <div className="eyebrow">CARRYTHREAD</div>
                  <h1>{t('welcome')}</h1>
                  <p>{t('welcomeBody')}</p>
                  <Button primary onClick={() => setView('sources')}>
                    {t('connectSources')}
                    <ArrowRight size={16} />
                  </Button>
                  <div className="privacy-line">
                    <ShieldCheck size={16} />
                    {t('privacyShort')}
                  </div>
                  <div className="welcome-steps">
                    {(['sources', 'review', 'prepare'] as MessageKey[]).map((k, i) => (
                      <div key={k}>
                        <span>0{i + 1}</span>
                        <strong>{t(k)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <PageHeading
                    title={t('todayTitle')}
                    body={t('todayBody')}
                    eyebrow={new Intl.DateTimeFormat(locale, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    }).format(new Date())}
                  />
                  <div className="overview-meta">
                    <span>
                      {snapshot.projects.length} {t('project')}
                    </span>
                    <span>
                      {snapshot.items.filter(unfinished).length} {t('open')}
                    </span>
                    <span>
                      {snapshot.sessions.length} {t('sessions')}
                    </span>
                  </div>
                  {!snapshot.items.length ? (
                    <Empty
                      icon={<Sparkles size={28} />}
                      heading={t('noItems')}
                      body={t('noItemsBody')}
                    >
                      <Button primary onClick={() => setReviewOpen(true)}>
                        {t('review')}
                      </Button>
                    </Empty>
                  ) : (
                    <div className="overview-grid">
                      <section>
                        <SectionHeading>{t('nextAction')}</SectionHeading>
                        {snapshot.items
                          .filter(unfinished)
                          .slice(0, 5)
                          .map((item) => (
                            <button
                              key={item.id}
                              className="focus-row"
                              onClick={() => openItem(item)}
                            >
                              <div>
                                <span className="eyebrow">{item.project}</span>
                                <h3>{item.title}</h3>
                                <p>{item.nextAction || t('noNext')}</p>
                              </div>
                              <div>
                                <Badge item={item} t={t} />
                                <ArrowUpRight size={17} />
                              </div>
                            </button>
                          ))}
                      </section>
                      <aside className="recent-panel">
                        <SectionHeading>{t('recent')}</SectionHeading>
                        {[...snapshot.items]
                          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                          .slice(0, 5)
                          .map((item) => (
                            <button
                              key={item.id}
                              className="recent-entry"
                              onClick={() => openItem(item)}
                            >
                              <span className="timeline-dot" />
                              <div>
                                <small>{t('updatedAt')} · {formatDate(item.updatedAt, locale)}</small>
                                <strong>{item.title}</strong>
                                <p>{item.stage}</p>
                              </div>
                            </button>
                          ))}
                        <div className="review-status">
                          <Sparkles size={17} />
                          <div>
                            <strong>{t('lastReview')}</strong>
                            <small>
                              {snapshot.reviews[0]
                                ? formatDate(snapshot.reviews[0].timestamp, locale)
                                : t('noReviewYet')}
                            </small>
                            {snapshot.reviews[0]?.omittedMessages ? (
                              <span className="warning-text">
                                {snapshot.reviews[0].omittedMessages} {t('skipped')}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </aside>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {view === 'work' && (
            <>
              <section className="work-list">
                <PageHeading
                  title={project === 'all' ? t('work') : project}
                  body={`${items.length} ${t('work')}`}
                />
                <div className="tabs" aria-label={t('state')}>
                  {['open', 'decision', 'verify', 'paused', 'all'].map((k) => (
                    <button
                      key={k}
                      aria-pressed={filter === k}
                      className={filter === k ? 'active' : ''}
                      onClick={() => setFilter(k)}
                    >
                      {t(k as MessageKey)}
                    </button>
                  ))}
                </div>
                {checked.length >= 2 && (
                  <div className="selection-bar">
                    <span>{t('selected', { count: checked.length })}</span>
                    <Button onClick={() => setMergeOpen(true)}>
                      <GitMerge size={14} />
                      {t('merge')}
                    </Button>
                  </div>
                )}
                {items.length ? (
                  items.map((item) => (
                    <div
                      key={item.id}
                      className={`work-row ${selected === item.id ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        aria-label={`${t('selected', { count: 1 })}: ${item.title}`}
                        checked={checked.includes(item.id)}
                        onChange={(e) =>
                          setChecked((c) =>
                            e.target.checked ? [...c, item.id] : c.filter((id) => id !== item.id),
                          )
                        }
                      />
                      <button className="work-row-main" onClick={() => setSelected(item.id)}>
                        <span className="eyebrow">{item.project}</span>
                        <h3>{item.title}</h3>
                        <p>{item.stage}</p>
                        <div>
                          <Badge item={item} t={t} />
                          <small>{t('updatedAt')} · {formatDate(item.updatedAt, locale)}</small>
                        </div>
                      </button>
                      <ChevronRight size={15} />
                    </div>
                  ))
                ) : (
                  <Empty
                    icon={<CircleDot size={26} />}
                    heading={t('noItems')}
                    body={t('noItemsBody')}
                  />
                )}
              </section>
              <section className="detail-panel">
                {current ? (
                  <>
                    <div className="detail-top">
                      <span className="eyebrow">{current.project}</span>
                      <button
                        className="icon-button"
                        aria-label={t('close')}
                        onClick={() => setSelected(null)}
                      >
                        <X size={17} />
                      </button>
                    </div>
                    <h1>{current.title}</h1>
                    <div className="detail-badges">
                      <Badge item={current} t={t} />
                      {current.manualOverride && (
                        <span className="soft-label">
                          <Check size={12} />
                          {t('userConfirmed')}
                        </span>
                      )}
                      <span className="muted">
                        {t('revision')} {current.revision}
                      </span>
                    </div>
                    <p className="summary">{current.summary}</p>
                    <div className="next-action">
                      <span className="eyebrow">{t('nextAction')}</span>
                      <p>{current.nextAction || t('noNext')}</p>
                      <Button primary onClick={() => setHandoffItem(current)}>
                        {t('prepare')}
                        <ArrowUpRight size={15} />
                      </Button>
                    </div>
                    <DetailSection title={t('completion')}>
                      <p>{current.completionCriteria}</p>
                    </DetailSection>
                    {current.decisions.length > 0 && (
                      <DetailSection title={t('decisions')}>
                        <ul>
                          {current.decisions.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </DetailSection>
                    )}
                    {current.uncertainties.length > 0 && (
                      <DetailSection title={t('uncertainties')}>
                        <ul>
                          {current.uncertainties.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </DetailSection>
                    )}
                    {current.note && (
                      <DetailSection title={t('note')}>
                        <p>{current.note}</p>
                      </DetailSection>
                    )}
                    <details className="evidence-details">
                      <summary>
                        {t('originalEvidence')} <span>{current.evidence.length}</span>
                      </summary>
                      {current.evidence.map((ref, i) => {
                        const session = evidenceSessions[ref.sessionId],
                          message = session?.messages.find((m) => m.id === ref.messageId)
                        return (
                          <div className="evidence-card" key={`${ref.messageId}-${i}`}>
                            <div>
                              <strong>{session ? agentName(session.agent) : ref.sessionId}</strong>
                              <small>{formatDate(message?.timestamp, locale)}</small>
                            </div>
                            <blockquote>{ref.quote}</blockquote>
                            <button
                              className="text-button"
                              onClick={() => void openConversation(ref.sessionId)}
                            >
                              {session?.title || t('view')}
                              <ArrowUpRight size={13} />
                            </button>
                            {message && (
                              <button
                                className="text-button"
                                onClick={() =>
                                  void run('reveal', () => api.openEvidence(message.id))
                                }
                              >
                                <FolderOpen size={13} />
                                {t('revealSource')}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </details>
                    <div className="detail-actions">
                      <Button
                        onClick={() => {
                          setNotice(null)
                          setEditItem(current)
                        }}
                      >
                        <Settings2 size={14} />
                        {t('edit')}
                      </Button>
                      <Button
                        onClick={() =>
                          void api
                            .itemHistory(current.id)
                            .then(setHistory)
                            .catch((e) => setNotice({ text: errorText(e, locale), error: true }))
                        }
                      >
                        <Clock3 size={14} />
                        {t('history')}
                      </Button>
                      <Button onClick={() => setSplitItem(current)}>
                        <Split size={14} />
                        {t('split')}
                      </Button>
                    </div>
                  </>
                ) : (
                  <Empty icon={<BookOpen size={30} />} heading={t('noSelection')} />
                )}
              </section>
            </>
          )}
          {view === 'sources' && (
            <>
              <PageHeading title={t('sourcesTitle')} body={t('sourcesBody')} />
              <div className="actions section-actions">
                <Button
                  primary
                  onClick={() =>
                    void run('detect', async () => {
                      const found = await api.detectSources()
                      const combined = [...snapshot.settings.sources]
                      for (const source of found)
                        if (
                          !combined.some((s) => s.agent === source.agent && s.path === source.path)
                        )
                          combined.push(source)
                      await api.saveSettings({ ...snapshot.settings, sources: combined })
                    })
                  }
                >
                  <Unplug size={16} />
                  {t('detect')}
                </Button>
                <select
                  aria-label={t('addSource')}
                  value=""
                  onChange={(e) => {
                    const kind = e.target.value as AgentKind
                    if (kind)
                      void run('chooseSource', async () => {
                        const chosen = await api.chooseSource(kind)
                        if (chosen)
                          await api.saveSettings({
                            ...snapshot.settings,
                            sources: [...snapshot.settings.sources, chosen],
                          })
                      })
                  }}
                >
                  <option value="" disabled>
                    {t('addSource')}
                  </option>
                  {AGENTS.map((a) => (
                    <option value={a} key={a}>
                      {agentName(a)}
                    </option>
                  ))}
                </select>
              </div>
              {snapshot.settings.sources.length ? (
                snapshot.settings.sources.map((source) => {
                  const coverage = snapshot.coverage.find((c) => c.sourceId === source.id)
                  return (
                    <section key={source.id} className="source-card">
                      <div className="source-heading">
                        <div className={`agent-symbol agent-${source.agent}`}>
                          {agentName(source.agent).slice(0, 1)}
                        </div>
                        <div>
                          <h3>{agentName(source.agent)}</h3>
                          <code>{source.path}</code>
                        </div>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={source.enabled}
                            onChange={(e) =>
                              void run('source', () =>
                                setSettings({
                                  sources: snapshot.settings.sources.map((s) =>
                                    s.id === source.id ? { ...s, enabled: e.target.checked } : s,
                                  ),
                                }),
                              )
                            }
                          />
                          <span>{t('enabled')}</span>
                        </label>
                        <button
                          className="icon-button"
                          aria-label={t('remove')}
                          onClick={() =>
                            void run('removeSource', () =>
                              setSettings({
                                sources: snapshot.settings.sources.filter(
                                  (s) => s.id !== source.id,
                                ),
                              }),
                            )
                          }
                        >
                          <X size={16} />
                        </button>
                      </div>
                      {coverage ? (
                        <div className="coverage">
                          <span className={`coverage-status ${coverage.status}`}>
                            {t(coverage.status)}
                          </span>
                          <span>
                            {coverage.files} {t('files')}
                          </span>
                          <span>
                            {coverage.sessions} {t('sessions')}
                          </span>
                          <span>
                            {coverage.messages} {t('messages')}
                          </span>
                          {coverage.skipped > 0 && (
                            <span className="warning-text">
                              {coverage.skipped} {t('skipped')}
                            </span>
                          )}
                          {coverage.redacted > 0 && (
                            <span>
                              {coverage.redacted} {t('redacted')}
                            </span>
                          )}
                          <small>{formatDate(coverage.scannedAt, locale)}</small>
                          {coverage.errors.length > 0 && (
                            <details>
                              <summary>{t('coverage')}</summary>
                              <ul>
                                {coverage.errors.map((e, i) => (
                                  <li key={i}>{translateDiagnostic(e, locale)}</li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>
                      ) : (
                        <div className="coverage muted">{t('neverScanned')}</div>
                      )}
                    </section>
                  )
                })
              ) : (
                <Empty
                  icon={<Unplug size={28} />}
                  heading={t('noSources')}
                  body={t('noSourcesBody')}
                />
              )}
            </>
          )}
          {view === 'evidence' && (
            <>
              <PageHeading title={t('conversationsTitle')} body={t('conversationsBody')} />
              <div className="search-field">
                <Search size={18} />
                <input
                  type="search"
                  placeholder={t('searchPlaceholder')}
                  aria-label={t('search')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="conversation-grid">
                <section className="conversation-list">
                  {searchResults
                    ? searchResults.map((message) => (
                        <button
                          key={message.id}
                          className="conversation-row"
                          onClick={() => void openConversation(message.sessionId)}
                        >
                          <span>{t(message.role)}</span>
                          <p>{message.text.slice(0, 200)}</p>
                          <small>{formatDate(message.timestamp, locale)}</small>
                        </button>
                      ))
                    : snapshot.sessions.map((session) => (
                        <button
                          key={session.id}
                          className={`conversation-row ${conversation?.id === session.id ? 'selected' : ''}`}
                          onClick={() => void openConversation(session.id)}
                        >
                          <span>{agentName(session.agent)}</span>
                          <strong>{session.title}</strong>
                          <small>{formatDate(session.updatedAt, locale)}</small>
                        </button>
                      ))}
                </section>
                <section className="conversation-body">
                  {conversation ? (
                    <>
                      <div className="conversation-heading">
                        <h2>{conversation.title}</h2>
                        <code>{conversation.cwd}</code>
                      </div>
                      {conversation.messages.map((message) => (
                        <article key={message.id} className={`message message-${message.role}`}>
                          <div>
                            <strong>{t(message.role)}</strong>
                            <time>{formatDate(message.timestamp, locale)}</time>
                          </div>
                          <p>{message.text}</p>
                        </article>
                      ))}
                    </>
                  ) : (
                    <Empty
                      icon={<MessageSquareText size={28} />}
                      heading={t(
                        snapshot.sessions.length ? 'selectConversation' : 'noConversations',
                      )}
                    />
                  )}
                </section>
              </div>
            </>
          )}
          {view === 'ai' && (
            <AISettings
              snapshot={snapshot}
              t={t}
              locale={locale}
              refresh={refresh}
              run={run}
              busy={busy}
            />
          )}
          {view === 'settings' && (
            <>
              <PageHeading title={t('settingsTitle')} />
              <div className="settings-grid">
                <section className="settings-section">
                  <Field label={t('language')}>
                    <select
                      value={locale}
                      onChange={(e) =>
                        void run('locale', () => setSettings({ locale: e.target.value as Locale }))
                      }
                    >
                      {languages.map((l) => (
                        <option value={l.id} key={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t('appearance')}>
                    <select
                      value={snapshot.settings.theme}
                      onChange={(e) =>
                        void run('theme', () =>
                          setSettings({ theme: e.target.value as AppSettings['theme'] }),
                        )
                      }
                    >
                      {['system', 'light', 'dark'].map((s) => (
                        <option key={s} value={s}>
                          {t(s as MessageKey)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t('historyWindow')}>
                    <select
                      value={snapshot.settings.historyDays}
                      onChange={(e) =>
                        void run('window', () =>
                          setSettings({ historyDays: Number(e.target.value) }),
                        )
                      }
                    >
                      {[7, 30, 90, 365, 0].map((n) => (
                        <option value={n} key={n}>
                          {n ? t('days', { count: n }) : t('allHistory')}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <label className="check-line">
                    <input
                      type="checkbox"
                      checked={snapshot.settings.autoScan}
                      onChange={(e) =>
                        void run('autoScan', () => setSettings({ autoScan: e.target.checked }))
                      }
                    />
                    {t('autoScan')}
                  </label>
                </section>
                <section className="settings-section">
                  <h3>{t('exportData')}</h3>
                  <p>{t('exportHint')}</p>
                  <div className="actions">
                    <Button onClick={() => void run('export', () => api.exportData(), 'exported')}>
                      <ArrowDownToLine size={15} />
                      {t('exportData')}
                    </Button>
                    <Button onClick={() => void run('import', () => api.importData(), 'imported')}>
                      {t('importData')}
                    </Button>
                  </div>
                  <div className="divider" />
                  <h3>{t('clearData')}</h3>
                  <p>{t('clearHint')}</p>
                  <Button className="danger-button" onClick={() => setClearOpen(true)}>
                    {t('clearData')}
                  </Button>
                </section>
                <section className="settings-section">
                  <h3>{t('about')}</h3>
                  <p>Carrythread · 续迹</p>
                  <p>
                    {t('version')} {appVersion}
                  </p>
                  <p>{t('tagline')}</p>
                  <div className="actions">
                    <Button
                      onClick={() =>
                        void api.openExternal('https://github.com/chrzamz/carrythread')
                      }
                    >
                      <ArrowUpRight size={15} />
                      {t('github')}
                    </Button>
                    <Button
                      onClick={() =>
                        void api.openExternal('https://github.com/chrzamz/carrythread#readme')
                      }
                    >
                      {t('docs')}
                    </Button>
                    <Button
                      onClick={() => void api.quit().catch(error => setNotice({ text: errorText(error, locale), error: true }))}
                    >
                      {t('quit')}
                    </Button>
                  </div>
                </section>
              </div>
            </>
          )}
        </main>
      </div>
      {reviewOpen && (
        <ReviewDialog
          snapshot={snapshot}
          t={t}
          locale={locale}
          onClose={() => setReviewOpen(false)}
          onDone={async () => {
            await refresh()
            setView('work')
            setProject('all')
            setFilter('all')
            setSelected(null)
            setNotice({ text: t('reviewFinished') })
          }}
          onError={(e) => setNotice({ text: errorText(e, locale), error: true })}
        />
      )}
      {editItem && (
        <EditDialog
          item={editItem}
          t={t}
          formError={notice?.error ? notice.text : ''}
          onClose={() => setEditItem(null)}
          onSave={async (changes) => {
            const saved = await run(
              'edit',
              () =>
                api.patchItem({
                  id: editItem.id,
                  expectedRevision: editItem.revision,
                  changes: changes.values,
                  reason: changes.reason,
                }),
              'saved',
            )
            if (saved) setEditItem(null)
          }}
        />
      )}
      {handoffItem && (
        <HandoffDialog
          item={handoffItem}
          snapshot={snapshot}
          t={t}
          locale={locale}
          onClose={() => setHandoffItem(null)}
        />
      )}
      {history && (
        <Modal title={t('history')} onClose={() => setHistory(null)} t={t}>
          {history.length ? (
            history.map((change) => (
              <div className="history-entry" key={change.id}>
                <small>
                  {formatDate(change.timestamp, locale)} ·{' '}
                  {change.actor === 'user' ? t('user') : t('assistant')}
                </small>
                <p>{change.reason}</p>
                <Badge item={change.after} t={t} />
                {current &&
                  current.id === change.itemId &&
                  current.revision !== change.after.revision && (
                    <Button
                      onClick={() =>
                        void run(
                          'restore',
                          async () => {
                            const prior = change.after
                            await api.patchItem({
                              id: current.id,
                              expectedRevision: current.revision,
                              changes: {
                                project: prior.project,
                                title: prior.title,
                                state: prior.state,
                                stage: prior.stage,
                                summary: prior.summary,
                                nextAction: prior.nextAction,
                                completionCriteria: prior.completionCriteria,
                                decisions: prior.decisions,
                                uncertainties: prior.uncertainties,
                                note: prior.note,
                              },
                              reason: t('restoreReason', { revision: prior.revision }),
                            })
                            setHistory(null)
                          },
                          'saved',
                        )
                      }
                    >
                      {t('restoreRevision')}
                    </Button>
                  )}
              </div>
            ))
          ) : (
            <p>{t('noChangeHistory')}</p>
          )}
        </Modal>
      )}
      {mergeOpen && (
        <TextDialog
          title={t('mergeTitle')}
          initial={snapshot.items.find((i) => i.id === checked[0])?.title || ''}
          t={t}
          onClose={() => setMergeOpen(false)}
          onSave={(value) =>
            void run(
              'merge',
              async () => {
                const item = await api.mergeItems(checked, value)
                setSelected(item.id)
                setChecked([])
                setMergeOpen(false)
              },
              'saved',
            )
          }
        />
      )}
      {splitItem && (
        <TextDialog
          title={t('splitTitle')}
          multiline
          initial={splitItem.title + '\n'}
          t={t}
          onClose={() => setSplitItem(null)}
          onSave={(value) =>
            void run(
              'split',
              async () => {
                const items = await api.splitItem(
                  splitItem.id,
                  value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
                setSelected(items[0]?.id || null)
                setSplitItem(null)
              },
              'saved',
            )
          }
        />
      )}
      {clearOpen && (
        <Modal title={t('confirmClear')} onClose={() => setClearOpen(false)} t={t}>
          <p>{t('clearHint')}</p>
          <div className="actions">
            <Button onClick={() => setClearOpen(false)}>{t('cancel')}</Button>
            <Button
              className="danger-button"
              onClick={() =>
                void run('clear', async () => {
                  await api.clearLocalData()
                  setClearOpen(false)
                  setSelected(null)
                  setConversation(null)
                  setProject('all')
                  setView('overview')
                })
              }
            >
              {t('confirm')}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function PageHeading({ title, body, eyebrow }: { title: string; body?: string; eyebrow?: string }) {
  return (
    <div className="page-heading">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h1>{title}</h1>
      {body && <p>{body}</p>}
    </div>
  )
}
function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="section-heading">{children}</h2>
}
function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="detail-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function AISettings({
  snapshot,
  t,
  locale,
  refresh,
  run,
  busy,
}: {
  snapshot: AppSnapshot
  t: T
  locale: Locale
  refresh: () => Promise<AppSnapshot>
  run: (label: string, action: () => Promise<unknown>, success?: MessageKey) => Promise<boolean>
  busy: string
}) {
  const [presets, setPresets] = useState<ProviderPreset[]>([]),
    [editing, setEditing] = useState<ProviderConfig | null>(null),
    [secret, setSecret] = useState(''),
    [testResult, setTestResult] = useState<{ id: string; text: string; ok: boolean } | null>(null),
    [saveError, setSaveError] = useState(''),
    [savingProvider, setSavingProvider] = useState(false)
  useEffect(() => {
    void api.providerPresets().then(setPresets)
  }, [])
  const newProvider = () => {
    setSaveError('')
    const p = presets[0]
    setEditing({
      id: crypto.randomUUID(),
      name: p?.name || 'OpenAI',
      protocol: p?.protocol || 'openai',
      baseUrl: p?.baseUrl || 'https://api.openai.com/v1',
      model: '',
      hasKey: false,
      timeoutMs: 90000,
    })
    setSecret('')
  }
  return (
    <>
      <PageHeading title={t('aiTitle')} body={t('aiBody')} />
      <div className="actions section-actions">
        <Button primary onClick={newProvider}>
          <Plus size={16} />
          {t('addProvider')}
        </Button>
        <small className="muted">{t('apiUsage')}</small>
      </div>
      {snapshot.settings.providers.length ? (
        snapshot.settings.providers.map((p) => (
          <section className="provider-card" key={p.id}>
            <div className="provider-heading">
              <div className="provider-symbol">
                <Sparkles size={21} />
              </div>
              <div>
                <h3>{p.name}</h3>
                <p>{p.model || t('modelHint')}</p>
                <code>{p.baseUrl}</code>
              </div>
              {snapshot.settings.activeProviderId === p.id && (
                <span className="soft-label">
                  <Check size={13} />
                  {t('activeProvider')}
                </span>
              )}
            </div>
            <div className="provider-footer">
              <span className={p.keyStorage === 'session' ? 'warning-text' : 'muted'}>
                {t(
                  p.keyStorage === 'session' ? 'sessionKey' : p.hasKey ? 'savedKey' : 'missingKey',
                )}
              </span>
              <div className="actions">
                <Button
                  onClick={() => {
                    setEditing(p)
                    setSecret('')
                  }}
                >
                  {t('edit')}
                </Button>
                {snapshot.settings.activeProviderId !== p.id && (
                  <Button
                    onClick={() =>
                      void run('activeProvider', () =>
                        api.saveSettings({ ...snapshot.settings, activeProviderId: p.id }),
                      )
                    }
                  >
                    {t('setActive')}
                  </Button>
                )}
                <Button
                  disabled={!!busy}
                  onClick={() =>
                    void run('test', async () => {
                      const result = await api.testProvider(p.id)
                      setTestResult({ id: p.id, text: result.message, ok: result.ok })
                    })
                  }
                >
                  {busy === 'test' ? (
                    <LoaderCircle size={14} className="spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}{' '}
                  {t('test')}
                </Button>
                <button
                  className="icon-button"
                  aria-label={t('remove')}
                  onClick={() => void run('removeProvider', () => api.removeProvider(p.id))}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            {testResult?.id === p.id && (
              <p
                role="status"
                className={`connection-result ${testResult.ok ? 'success' : 'error'}`}
              >
                {testResult.text}
              </p>
            )}
          </section>
        ))
      ) : (
        <Empty
          icon={<Sparkles size={28} />}
          heading={t('noProviders')}
          body={t('noProvidersBody')}
        />
      )}
      {editing && (
        <Modal
          title={t('addProvider')}
          t={t}
          onClose={() => {
            if (!savingProvider) {
              setEditing(null)
              setSecret('')
            }
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setSaveError('')
              setSavingProvider(true)
              void (async () => {
                try {
                  await api.saveProvider(editing, secret.trim() || undefined)
                  await refresh()
                  setEditing(null)
                  setSecret('')
                } catch (error) {
                  setSaveError(errorText(error, locale))
                } finally {
                  setSavingProvider(false)
                }
              })()
            }}
          >
            <Field label={t('preset')}>
              <select
                defaultValue=""
                onChange={(e) => {
                  const p = presets.find((p) => p.id === e.target.value)
                  if (p)
                    setEditing({
                      ...editing,
                      name: p.name,
                      protocol: p.protocol,
                      baseUrl: p.baseUrl,
                    })
                }}
              >
                <option value="">{t('custom')}</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.region.toUpperCase()}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label={t('name')}>
                <input
                  required
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </Field>
              <Field label={t('protocol')}>
                <select
                  value={editing.protocol}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      protocol: e.target.value as ProviderConfig['protocol'],
                    })
                  }
                >
                  <option value="openai">OpenAI-compatible</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="ollama">Ollama</option>
                </select>
              </Field>
            </div>
            <Field label={t('endpoint')}>
              <input
                type="url"
                required
                value={editing.baseUrl}
                onChange={(e) => setEditing({ ...editing, baseUrl: e.target.value })}
              />
            </Field>
            <Field label={t('model')} hint={t('modelHint')}>
              <input
                required
                value={editing.model}
                onChange={(e) => setEditing({ ...editing, model: e.target.value })}
              />
            </Field>
            <Field label={t('key')} hint={t('keyHint')}>
              <input
                type="password"
                autoComplete="off"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
            </Field>
            <Field label={t('timeout')}>
              <input
                type="number"
                min="5"
                max="180"
                value={editing.timeoutMs / 1000}
                onChange={(e) =>
                  setEditing({ ...editing, timeoutMs: Number(e.target.value) * 1000 })
                }
              />
            </Field>
            <div className="actions">
              <Button type="submit" primary disabled={!!busy || savingProvider}>
                {t('save')}
              </Button>
              <Button onClick={() => setEditing(null)}>{t('cancel')}</Button>
            </div>
            {saveError && (
              <p role="alert" className="form-error">
                {saveError}
              </p>
            )}
          </form>
        </Modal>
      )}
    </>
  )
}

function ReviewDialog({
  snapshot,
  t,
  locale,
  onClose,
  onDone,
  onError,
}: {
  snapshot: AppSnapshot
  t: T
  locale: Locale
  onClose: () => void
  onDone: () => Promise<void>
  onError: (e: unknown) => void
}) {
  const [ids, setIds] = useState(snapshot.sessions.map((s) => s.id)),
    [providerId, setProviderId] = useState(snapshot.settings.activeProviderId || ''),
    [running, setRunning] = useState(false),
    [scopeRoot, setScopeRoot] = useState('all'),
    [scopeAgent, setScopeAgent] = useState('all'),
    [fromDate, setFromDate] = useState(() => {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }),
    [untilDate, setUntilDate] = useState(() => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }),
    [preview, setPreview] = useState<Awaited<ReturnType<typeof api.previewReview>> | null>(null),
    [previewError, setPreviewError] = useState('')
  const [runError, setRunError] = useState('')
  const range = useMemo(() => {
    const convert = (value: string, end: boolean) => {
      if (!value) return undefined
      const d = new Date(`${value}T00:00:00`)
      if (Number.isNaN(d.getTime())) return value
      if (end) d.setHours(23, 59, 59, 999)
      return d.toISOString()
    }
    return { since: convert(fromDate, false), until: convert(untilDate, true) }
  }, [fromDate, untilDate])
  const visibleSessions = snapshot.sessions.filter(
    (s) =>
      (scopeRoot === 'all' || s.cwd === scopeRoot) &&
      (scopeAgent === 'all' || s.agent === scopeAgent),
  )
  const roots = [...new Set(snapshot.sessions.map((s) => s.cwd).filter(Boolean))].sort()
  const scope = (root: string, agent: string) => {
    setScopeRoot(root)
    setScopeAgent(agent)
    setIds(
      snapshot.sessions
        .filter((s) => (root === 'all' || s.cwd === root) && (agent === 'all' || s.agent === agent))
        .map((s) => s.id),
    )
  }
  useEffect(() => {
    let active = true
    setPreview(null)
    setPreviewError('')
    if (!ids.length) return
    api
      .previewReview({ sessionIds: ids, ...range })
      .then((result) => {
        if (active) setPreview(result)
      })
      .catch((e) => {
        if (active) setPreviewError(errorText(e, locale))
      })
    return () => {
      active = false
    }
  }, [ids, range, locale, snapshot.coverage])
  const config = snapshot.settings.providers.find((p) => p.id === providerId),
    local = config && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/.test(config.baseUrl)
  const start = async () => {
    setRunning(true)
    setRunError('')
    try {
      await api.review({ sessionIds: ids, providerId, locale, ...range })
      await onDone()
      onClose()
    } catch (e) {
      setRunError(errorText(e, locale))
      onError(e)
    } finally {
      setRunning(false)
    }
  }
  return (
    <Modal
      title={t('reviewTitle')}
      onClose={() => {
        if (!running) onClose()
      }}
      t={t}
      wide
    >
      <p className="muted">{t('reviewBody')}</p>
      <Field label={t('provider')}>
        <select
          value={providerId}
          disabled={running}
          onChange={(e) => setProviderId(e.target.value)}
        >
          <option value="">{t('providerRequired')}</option>
          {snapshot.settings.providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.model}
            </option>
          ))}
        </select>
      </Field>
      <div className="form-grid">
        <Field label={t('workingDirectory')}>
          <select
            disabled={running}
            value={scopeRoot}
            onChange={(e) => scope(e.target.value, scopeAgent)}
          >
            <option value="all">{t('allProjects')}</option>
            {roots.map((root) => (
              <option value={root} key={root}>
                {root}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('sources')}>
          <select
            disabled={running}
            value={scopeAgent}
            onChange={(e) => scope(scopeRoot, e.target.value)}
          >
            <option value="all">{t('all')}</option>
            {AGENTS.map((agent) => (
              <option value={agent} key={agent}>
                {agentName(agent)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="form-grid">
        <Field label={t('fromDate')}>
          <input
            type="date"
            disabled={running}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </Field>
        <Field label={t('untilDate')}>
          <input
            type="date"
            disabled={running}
            value={untilDate}
            onChange={(e) => setUntilDate(e.target.value)}
          />
        </Field>
      </div>
      <div className="selection-tools">
        <span>{t('selected', { count: ids.length })}</span>
        <button
          className="text-button"
          disabled={running}
          onClick={() => setIds(visibleSessions.map((s) => s.id))}
        >
          {t('selectAll')}
        </button>
        <button className="text-button" disabled={running} onClick={() => setIds([])}>
          {t('clearSelection')}
        </button>
      </div>
      <div className="review-session-list">
        {visibleSessions.map((s) => (
          <label className="session-check" key={s.id}>
            <input
              type="checkbox"
              disabled={running}
              checked={ids.includes(s.id)}
              onChange={(e) =>
                setIds((c) => (e.target.checked ? [...c, s.id] : c.filter((id) => id !== s.id)))
              }
            />
            <div>
              <strong>{s.title}</strong>
              <small>
                {agentName(s.agent)} · {formatDate(s.updatedAt, locale)}
              </small>
            </div>
          </label>
        ))}
      </div>
      {preview && (
        <p className="review-preview-counts">
          {t('reviewMessages', { count: preview.eligibleMessages })} ·{' '}
          {t('reviewBatches', { count: preview.batches })}
          {preview.omittedMessages > 0 && (
            <span className="warning-text">
              {' '}
              · {preview.omittedMessages} {t('skipped')}
            </span>
          )}
        </p>
      )}
      {previewError && (
        <p role="alert" className="form-error">
          {previewError}
        </p>
      )}
      {preview&&preview.relatedItems>0&&<details className="review-related"><summary>{t('relatedWork',{count:preview.relatedItems})}</summary><ul>{preview.relatedTitles.map((title,index)=><li key={index}>{title}</li>)}</ul></details>}
      {runError && (
        <p role="alert" className="form-error">
          {runError}
        </p>
      )}
      <div className="privacy-callout">
        <ShieldCheck size={18} />
        <p>
          {t(local ? 'localReviewNotice' : 'reviewNotice', {
            count: ids.length,
            provider: config?.name || '—',
          })}
        </p>
      </div>
      <div className="actions">
        <Button
          primary
          disabled={
            running || !ids.length || !providerId || !preview?.eligibleMessages || !!previewError
          }
          onClick={() => void start()}
        >
          {running ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}{' '}
          {t(running ? 'reviewing' : 'startReview')}
        </Button>
        <Button onClick={() => (running ? void api.cancelReview() : onClose())}>
          {t('cancel')}
        </Button>
      </div>
    </Modal>
  )
}

function EditDialog({
  item,
  t,
  formError,
  onClose,
  onSave,
}: {
  item: WorkItem
  t: T
  formError: string
  onClose: () => void
  onSave: (data: { values: Record<string, unknown>; reason: string }) => Promise<void>
}) {
  const [values, setValues] = useState({
      project: item.project,
      title: item.title,
      state: item.state,
      stage: item.stage,
      summary: item.summary,
      nextAction: item.nextAction,
      completionCriteria: item.completionCriteria,
      note: item.note,
      decisions: item.decisions.join('\n'),
      uncertainties: item.uncertainties.join('\n'),
    }),
    [reason, setReason] = useState(''),
    [saving, setSaving] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({
        values: {
          ...values,
          decisions: values.decisions
            .split('\n')
            .map((v) => v.trim())
            .filter(Boolean),
          uncertainties: values.uncertainties
            .split('\n')
            .map((v) => v.trim())
            .filter(Boolean),
        },
        reason,
      })
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal title={t('edit')} t={t} onClose={onClose} wide>
      <p className="muted">{t('correctionBody')}</p>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label={t('project')}>
            <input
              required
              value={values.project}
              onChange={(e) => setValues({ ...values, project: e.target.value })}
            />
          </Field>
          <Field label={t('state')}>
            <select
              value={values.state}
              onChange={(e) => setValues({ ...values, state: e.target.value as WorkState })}
            >
              {states.map((s) => (
                <option value={s} key={s}>
                  {t(s)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {(['title', 'stage', 'summary', 'nextAction', 'completionCriteria', 'note'] as const).map(
          (key) => (
            <Field
              label={t(
                key === 'nextAction'
                  ? 'nextAction'
                  : key === 'completionCriteria'
                    ? 'completion'
                    : key,
              )}
              key={key}
            >
              {['summary', 'note'].includes(key) ? (
                <textarea
                  value={values[key]}
                  onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                />
              ) : (
                <input
                  required={key !== 'note'}
                  value={values[key]}
                  onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                />
              )}
            </Field>
          ),
        )}
        {(['decisions', 'uncertainties'] as const).map((key) => (
          <Field label={t(key)} key={key}>
            <textarea
              value={values[key]}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            />
          </Field>
        ))}
        <Field label={t('reason')}>
          <textarea
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={2000}
          />
        </Field>
        <div className="actions">
          <Button primary type="submit" disabled={saving}>
            {t('saveCorrection')}
          </Button>
          <Button onClick={onClose}>{t('cancel')}</Button>
        </div>
        {formError && (
          <p role="alert" className="form-error">
            {formError}
          </p>
        )}
      </form>
    </Modal>
  )
}
function TextDialog({
  title,
  initial,
  t,
  onClose,
  onSave,
  multiline = false,
}: {
  title: string
  initial: string
  t: T
  onClose: () => void
  onSave: (value: string) => void
  multiline?: boolean
}) {
  const [value, setValue] = useState(initial)
  return (
    <Modal title={title} t={t} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSave(value)
        }}
      >
        <Field label={title}>
          {multiline ? (
            <textarea required value={value} onChange={(e) => setValue(e.target.value)} />
          ) : (
            <input required value={value} onChange={(e) => setValue(e.target.value)} />
          )}
        </Field>
        <div className="actions">
          <Button primary type="submit">
            {t('save')}
          </Button>
          <Button onClick={onClose}>{t('cancel')}</Button>
        </div>
      </form>
    </Modal>
  )
}

function HandoffDialog({
  item,
  snapshot,
  t,
  locale,
  onClose,
}: {
  item: WorkItem
  snapshot: AppSnapshot
  t: T
  locale: Locale
  onClose: () => void
}) {
  const [targets, setTargets] = useState<TargetCapability[]>([]),
    [request, setRequest] = useState<HandoffRequest>({
      locale,
      itemId: item.id,
      target: 'codex',
      mode: 'new',
      instruction: item.nextAction,
      includeEvidence: true,
    }),
    [pkg, setPkg] = useState<HandoffPackage | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  useEffect(() => {
    void api.targets().then(setTargets)
  }, [])
  const capability = targets.find((t) => t.agent === request.target),
    sessions = snapshot.sessions.filter((s) => s.agent === request.target && snapshot.settings.sources.some(source=>source.id===s.sourceId&&source.agent===s.agent))
  const action = async (fn: () => Promise<HandoffPackage>) => {
    setBusy(true)
    setError('')
    try {
      setPkg(await fn())
    } catch (e) {
      setError(errorText(e, locale))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title={t('handoffTitle')} onClose={onClose} t={t} wide>
      <p className="muted">{t('handoffBody')}</p>
      {!pkg ? (
        <>
          <div className="form-grid">
            <Field label={t('target')}>
              <select
                value={request.target}
                onChange={(e) =>
                  setRequest({
                    ...request,
                    target: e.target.value as AgentKind,
                    sessionId: undefined,
                  })
                }
              >
                {AGENTS.map((a) => (
                  <option key={a} value={a}>
                    {agentName(a)}
                    {targets.find((t) => t.agent === a)?.installed
                      ? ''
                      : ` · ${t('targetMissing')}`}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('destination')}>
              <select
                value={request.mode}
                onChange={(e) =>
                  setRequest({
                    ...request,
                    mode: e.target.value as 'new' | 'resume',
                    sessionId: undefined,
                  })
                }
              >
                <option value="new">{t('newSession')}</option>
                <option value="resume" disabled={!sessions.length || request.target === 'generic'}>
                  {t('resumeSession')}
                </option>
              </select>
            </Field>
          </div>
          {request.mode === 'resume' && (
            <Field label={t('destination')}>
              <select
                value={request.sessionId || ''}
                required
                onChange={(e) => setRequest({ ...request, sessionId: e.target.value })}
              >
                <option value="">{t('selectConversation')}</option>
                {sessions.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={t('workingDirectory')}>
            <div className="directory-field">
              <input
                aria-label={t('workingDirectory')}
                readOnly
                value={request.cwd || ''}
                placeholder={
                  snapshot.sessions.find((s) => item.evidence.some((e) => e.sessionId === s.id))
                    ?.cwd || ''
                }
              />
              <Button
                onClick={() =>
                  void api
                    .chooseWorkspace(
                      request.cwd ||
                        snapshot.sessions.find((s) =>
                          item.evidence.some((e) => e.sessionId === s.id),
                        )?.cwd,
                    )
                    .then((path) => {
                      if (path) setRequest({ ...request, cwd: path })
                    })
                    .catch((e) => setError(errorText(e, locale)))
                }
              >
                <FolderOpen size={15} />
                {t('chooseWorkspace')}
              </Button>
            </div>
          </Field>
          <Field label={t('instruction')}>
            <textarea
              value={request.instruction}
              onChange={(e) => setRequest({ ...request, instruction: e.target.value })}
              maxLength={4000}
            />
          </Field>
          <label className="check-line">
            <input
              type="checkbox"
              checked={request.includeEvidence}
              onChange={(e) => setRequest({ ...request, includeEvidence: e.target.checked })}
            />
            {t('includeEvidence')}
          </label>
          <div className="actions">
            <Button
              primary
              disabled={
                busy ||
                !request.instruction.trim() ||
                (request.mode === 'resume' && !request.sessionId)
              }
              onClick={() => void action(() => api.prepareHandoff(request))}
            >
              {busy ? <LoaderCircle className="spin" size={15} /> : <FileText size={15} />}{' '}
              {t('preparePackage')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="handoff-status">
            <span className={`badge ${pkg.status === 'failed' ? 'state-waiting' : 'state-active'}`}>
              {t(pkg.status)}
            </span>
            <code>{pkg.path}</code>
          </div>
          <Field label={t('packagePreview')}>
            <textarea className="package-content" value={pkg.content} readOnly rows={14} />
          </Field>
          <div className="privacy-callout">
            <BookOpen size={18} />
            <p>{pkg.warning ? errorText(pkg.warning, locale) : t('receiptNotice')}</p>
          </div>
          <div className="actions">
            <Button
              primary
              disabled={
                busy || !capability?.installed || ['opened', 'submitted'].includes(pkg.status)
              }
              onClick={() => void action(() => api.launchHandoff(pkg.id))}
            >
              {busy ? <LoaderCircle className="spin" size={15} /> : <ArrowUpRight size={15} />}{' '}
              {t(
                pkg.startsExecution
                  ? 'executeTarget'
                  : request.target === 'generic'
                    ? 'copyContext'
                    : 'openTarget',
              )}
            </Button>
            <Button
              onClick={() =>
                void api.exportHandoff(pkg.id).catch((e) => setError(errorText(e, locale)))
              }
            >
              <ArrowDownToLine size={15} />
              {t('exportHandoff')}
            </Button>
            <Button onClick={() => setPkg(null)}>{t('back')}</Button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </Modal>
  )
}
