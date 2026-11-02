import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { AgentSession, HandoffPackage, SourceMessage, WorkItem } from '../src/core/contracts'
import { buildReviewContext, workspaceKeyFor, workspacesDisjoint } from '../src/core/continuity'

const handoffId = '11111111-2222-4333-8444-555555555555'
const original: WorkItem = {
  id: 'item:original', project: 'Synthetic Project', title: 'Finish device validation', state: 'paused', stage: 'Awaiting hardware', summary: 'The implementation needs real-device checks.', nextAction: 'Wait for the test device.', completionCriteria: 'Real-device checks pass.', decisions: ['Keep the agreed interface.'], uncertainties: ['Test device unavailable.'], evidence: [{ messageId: 'old-message', sessionId: 'old-session', quote: 'Wait for hardware.' }], confidence: 'supported', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-03T00:00:00Z', reviewedAt: '', manualOverride: true, revision: 4, note: 'Do not reopen this automatically.',
}
const handoff: HandoffPackage = { id: handoffId, itemId: original.id, revision: 2, target: 'claude', mode: 'new', cwd: '/synthetic/first-project', path: '/synthetic/package.md', content: 'Synthetic', prompt: 'Synthetic', createdAt: '2026-10-02T00:00:00Z', status: 'opened' }
const marker = (changes: Partial<{ id: string; item: string; revision: number }> = {}) => `<!-- carrythread handoff=${changes.id ?? handoffId} item=${encodeURIComponent(changes.item ?? original.id)} revision=${changes.revision ?? handoff.revision} -->`
const session: Pick<AgentSession, 'id' | 'agent' | 'title' | 'cwd'> = { id: 'new-session', agent: 'claude', title: 'A renamed conversation', cwd: '/synthetic/second-project' }
const message = (overrides: Partial<SourceMessage> = {}): SourceMessage => ({ id: 'new-message', sessionId: session.id, role: 'user', text: marker() + '\nContinue the existing work.', timestamp: '2026-10-04T00:00:00Z', sourcePath: '/synthetic/new-session.jsonl', ...overrides })

test('verified cross-agent handoff links to the latest item even after its revision advanced', () => {
  const context = buildReviewContext([message()], [session], [handoff], [original])
  assert.equal(context.sessionContext.length, 1)
  assert.deepEqual(context.sessionContext[0].linkedItemIds, [original.id])
  assert.deepEqual(context.sessionContext[0].handoffLinks, [{ messageId: 'new-message', itemId: original.id }])
  assert.equal(context.sessionContext[0].title, 'A renamed conversation')
  assert.equal(context.sessionContext[0].projectHint, 'second-project')
  assert.match(context.sessionContext[0].workspaceKey!, /^workspace-[a-f0-9]{64}$/)
  assert.ok(!JSON.stringify(context).includes('/synthetic/'))
})

test('unknown handoffs, wrong item or revision, assistant/tool reports and carried context cannot link', () => {
  const attempts = [
    message({ text: marker({ id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' }) }),
    message({ text: marker({ item: 'private-other-item' }) }),
    message({ text: marker({ revision: 3 }) }),
    message({ role: 'assistant' }),
    message({ role: 'tool', kind: 'answer' }),
    message({ kind: 'context' }),
    message({ text: 'Here is an old transcript:\n' + marker() }),
    message({ text: '> ' + marker() }),
    message({ text: `<!-- carrythread handoff=${handoffId} item=%ZZ revision=2 -->` }),
  ]
  for (const attempt of attempts) {
    const context = buildReviewContext([attempt], [session], [handoff], [original]).sessionContext[0]
    assert.deepEqual(context.linkedItemIds, [])
    assert.deepEqual(context.handoffLinks, [])
  }
  assert.deepEqual(buildReviewContext([message()], [session], [handoff], []).sessionContext[0].linkedItemIds, [])
})

test('target mismatch is rejected, while a registered generic handoff can continue in any agent', () => {
  const otherAgent = { ...session, agent: 'pi' as const }
  assert.deepEqual(buildReviewContext([message()], [otherAgent], [handoff], [original]).sessionContext[0].linkedItemIds, [])
  assert.deepEqual(buildReviewContext([message()], [otherAgent], [{ ...handoff, target: 'generic' }], [original]).sessionContext[0].linkedItemIds, [original.id])
})

test('unselected sessions and their marker links do not enter review metadata', () => {
  const other = { ...session, id: 'private-session', title: 'Unselected private title', cwd: '/private/never-upload' }
  const selected = message({ text: 'An unrelated selected request.' })
  const context = buildReviewContext([selected], [session, other], [handoff], [original])
  assert.equal(context.sessionContext.length, 1)
  assert.deepEqual(context.sessionContext[0].linkedItemIds, [])
  assert.ok(!JSON.stringify(context).includes('private'))
})

test('same titles and directory basenames in different workspaces remain distinct', () => {
  const first = { ...session, cwd: '/synthetic/client-a/app', title: 'Same title' }
  const second = { ...session, id: 'another-session', cwd: '/synthetic/client-b/app', title: 'Same title' }
  const context = buildReviewContext([message({ text: 'First work.' }), message({ id: 'second-message', sessionId: second.id, text: 'Second work.' })], [first, second], [], [])
  assert.equal(context.sessionContext[0].projectHint, 'app')
  assert.equal(context.sessionContext[1].projectHint, 'app')
  assert.notEqual(context.sessionContext[0].workspaceKey, context.sessionContext[1].workspaceKey)
  assert.equal(workspacesDisjoint([context.sessionContext[0].workspaceKey], [context.sessionContext[1].workspaceKey]), true)
  assert.deepEqual(context.sessionContext.flatMap(row => row.linkedItemIds), [])
})

test('workspace hints normalize paths locally without exposing full POSIX or Windows paths', () => {
  assert.equal(workspaceKeyFor('/synthetic/project/'), workspaceKeyFor('/synthetic/other/../project'))
  assert.equal(workspaceKeyFor('C:\\Synthetic\\Project\\'), workspaceKeyFor('c:\\Synthetic\\Project'))
  assert.equal(workspaceKeyFor('relative/project'), null)
  assert.equal(workspacesDisjoint([null], [workspaceKeyFor('/synthetic/project')]), false)
  const cwd = 'C:\\Synthetic\\PrivateArea\\Project'
  const context = buildReviewContext([message({ text: 'Continue.' })], [{ ...session, cwd, title: `Work in ${cwd}` }], [], [])
  assert.equal(context.sessionContext[0].projectHint, 'Project')
  assert.ok(!JSON.stringify(context).includes('PrivateArea'))
})

test('conflicting duplicate registry entries or metadata fail closed', () => {
  const conflicting = { ...handoff, itemId: 'another-item' }
  assert.deepEqual(buildReviewContext([message()], [session], [handoff, conflicting], [original]).sessionContext[0].linkedItemIds, [])
  assert.deepEqual(buildReviewContext([message()], [session, { ...session, cwd: '/different/place' }], [handoff], [original]).sessionContext, [])
})
