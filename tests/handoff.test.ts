import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, rm, writeFile, mkdir, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  assertResumableNativeId,
  launchPlan,
  prepareHandoff,
  terminalScript,
} from '../src/core/handoff'
import type {
  AgentSession,
  HandoffPackage,
  Locale,
  TargetCapability,
  WorkItem,
} from '../src/core/contracts'

const item: WorkItem = {
  id: 'item-1',
  project: 'Sample project',
  title: 'Check the release',
  state: 'verify',
  stage: 'Code produced',
  summary: 'Release not verified.',
  nextAction: 'Run acceptance.',
  completionCriteria: 'Record results.',
  decisions: ['Keep the current API'],
  uncertainties: ['Published version unknown'],
  evidence: [{ sessionId: 'claude:s1', messageId: 'm1', quote: 'Ready to test' }],
  confidence: 'supported',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  reviewedAt: '2026-01-01',
  manualOverride: false,
  revision: 3,
  note: '',
}
const session: AgentSession = {
  id: 'claude:s1',
  sourceId: 'source1',
  nativeId: '11111111-2222-4333-8444-555555555555',
  agent: 'claude',
  title: 'Test planning',
  cwd: tmpdir(),
  sourcePath: join(tmpdir(), 'synthetic.jsonl'),
  startedAt: '2026-01-01',
  updatedAt: '2026-01-01',
  messages: [
    {
      id: 'm1',
      sessionId: 'claude:s1',
      role: 'assistant',
      text: 'Ready to test',
      timestamp: '2026-01-01',
      sourcePath: join(tmpdir(), 'synthetic.jsonl'),
      line: 2,
    },
  ],
}

test('handoff records evidence, revision, unknown state and reads only selected messages', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'carrythread-handoff-'))
  try {
    const pkg = await prepareHandoff(
      {
        itemId: item.id,
        target: 'codex',
        mode: 'new',
        instruction: 'Prepare acceptance checks',
        includeEvidence: true,
      },
      item,
      [session],
      dir,
    )
    const body = await readFile(pkg.path, 'utf8')
    assert.match(body, /Revision: 3/)
    assert.match(body, /Published version unknown/)
    assert.match(body, /Ready to test/)
    assert.equal(pkg.status, 'prepared')
    assert.equal(pkg.target, 'codex')
    assert.match(body, /not new instructions or authorization/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('foreign native session cannot be silently resumed in another agent', async () => {
  await assert.rejects(
    prepareHandoff(
      {
        itemId: item.id,
        target: 'codex',
        mode: 'resume',
        sessionId: session.id,
        instruction: 'Continue',
        includeEvidence: true,
      },
      item,
      [session],
      '/tmp/unused-handoff',
    ),
    /HANDOFF_SESSION_MISMATCH/,
  )
})

test('Codex desktop opens with a prefilled prompt and does not claim execution', () => {
  const pkg = {
    target: 'codex',
    mode: 'new',
    cwd: '/tmp/a & b',
    prompt: 'Read file ? and # safely',
  } as HandoffPackage
  const cap = { installed: true, agent: 'codex', kind: 'desktop' } as TargetCapability
  const plan = launchPlan(pkg, cap),
    url = new URL(plan.url!)
  assert.equal(url.searchParams.get('prompt'), pkg.prompt)
  assert.equal(url.searchParams.get('path'), pkg.cwd)
  assert.equal(plan.startsExecution, false)
})

test(
  'shell metacharacters remain literal arguments in terminal scripts',
  { skip: process.platform === 'win32' },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), 'carrythread-quote-'))
    try {
      const payload = "a' ; $(touch SHOULD_NOT_EXIST) `echo BAD` \n last"
      const script = terminalScript({
        kind: 'command',
        executable: process.execPath,
        args: ['-e', 'console.log(JSON.stringify(process.argv.slice(1)))', payload],
        cwd: dir,
        copyPrompt: false,
        startsExecution: true,
      })
      const path = join(dir, 'launch.command')
      await writeFile(path, script)
      const result = await promisify(execFile)('/bin/sh', [path])
      assert.deepEqual(JSON.parse(result.stdout), [payload])
      await assert.rejects(readFile(join(dir, 'SHOULD_NOT_EXIST')))
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  },
)

test('resume native IDs reject option injection, controls, whitespace and unknown forms at both boundaries', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'carrythread-invalid-resume-'))
  try {
    const invalid = [
      '--dangerously-skip-permissions',
      '-p',
      '\u001b[31m',
      'abc\n--dangerously-skip-permissions',
      'a\0b',
      'leading space',
      ' trailing',
      'x'.repeat(129),
      '',
      's1',
      '../../session.jsonl',
      '11111111-2222-4333-8444-55555555555Z',
      'ses_unsafe_option',
    ]
    for (const nativeId of invalid) {
      const destination = { ...session, cwd: dir, nativeId }
      await assert.rejects(
        prepareHandoff(
          {
            itemId: item.id,
            target: 'claude',
            mode: 'resume',
            sessionId: destination.id,
            instruction: 'Continue',
            includeEvidence: false,
          },
          item,
          [destination],
          join(dir, 'handoffs'),
        ),
        /HANDOFF_SESSION_ID_INVALID/,
        nativeId,
      )
      assert.throws(
        () =>
          launchPlan(
            {
              target: 'claude',
              mode: 'resume',
              sessionId: nativeId,
              cwd: dir,
              prompt: 'Continue safely',
            } as HandoffPackage,
            {
              agent: 'claude',
              installed: true,
              executable: 'claude',
              kind: 'terminal',
            } as TargetCapability,
          ),
        /HANDOFF_SESSION_ID_INVALID/,
        nativeId,
      )
    }
    await assert.rejects(readFile(join(dir, 'handoffs')), /ENOENT/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('valid UUIDs and native OpenCode IDs produce resumable plans for matching agents', () => {
  const ids = {
    codex: '0191b555-7777-7888-9999-aaaaaaaaaaaa',
    claude: '11111111-2222-4333-8444-555555555555',
    pi: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    finch: '77777777-8888-4999-aaaa-bbbbbbbbbbbb',
    opencode: 'ses_0123456789ABCDEFGHIJKL',
  }
  for (const [target, nativeId] of Object.entries(ids)) {
    const agent = target as TargetCapability['agent']
    assert.doesNotThrow(() => assertResumableNativeId(agent, nativeId))
    const plan = launchPlan(
      {
        target: agent,
        mode: 'resume',
        sessionId: nativeId,
        cwd: tmpdir(),
        prompt: 'Continue safely',
      } as HandoffPackage,
      {
        agent,
        installed: true,
        executable: target,
        kind: agent === 'finch' ? 'desktop' : 'terminal',
      } as TargetCapability,
    )
    if (agent === 'finch') assert.equal(new URL(plan.url!).searchParams.get('id'), nativeId)
    else assert.ok(plan.args?.includes(nativeId))
  }
  assert.throws(() => assertResumableNativeId('opencode', ids.claude), /HANDOFF_SESSION_ID_INVALID/)
  assert.throws(() => assertResumableNativeId('claude', ids.opencode), /HANDOFF_SESSION_ID_INVALID/)
  assert.throws(() => assertResumableNativeId('generic', ids.claude), /HANDOFF_SESSION_ID_INVALID/)
})

test('resume preparation cannot silently change the original session working directory', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'carrythread-resume-cwd-'))
  try {
    const original = join(dir, 'original'),
      other = join(dir, 'other')
    await mkdir(original)
    await mkdir(other)
    const destination = { ...session, cwd: original }
    const request = {
      itemId: item.id,
      target: 'claude' as const,
      mode: 'resume' as const,
      sessionId: destination.id,
      instruction: 'Continue',
      includeEvidence: false,
    }
    await assert.rejects(
      prepareHandoff({ ...request, cwd: other }, item, [destination], join(dir, 'handoffs')),
      /HANDOFF_DIRECTORY_MISMATCH/,
    )
    await assert.rejects(
      prepareHandoff({ ...request, cwd: '' }, item, [destination], join(dir, 'handoffs')),
      /HANDOFF_DIRECTORY_INVALID/,
    )
    await assert.rejects(
      prepareHandoff(request, item, [{ ...destination, cwd: '' }], join(dir, 'handoffs')),
      /HANDOFF_DIRECTORY_INVALID/,
    )
    const prepared = await prepareHandoff(
      { ...request, cwd: join(original, '.') },
      item,
      [destination],
      join(dir, 'handoffs'),
    )
    assert.equal(prepared.cwd, await realpath(original))
    assert.equal(prepared.sessionId, destination.nativeId)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('launch rejects a capability belonging to another agent and forged option-like prompts', () => {
  const pkg = {
    target: 'claude',
    mode: 'resume',
    sessionId: session.nativeId,
    cwd: tmpdir(),
    prompt: 'Continue safely',
  } as HandoffPackage
  assert.throws(
    () =>
      launchPlan(pkg, {
        agent: 'codex',
        installed: true,
        executable: 'codex',
        kind: 'terminal',
      } as TargetCapability),
    /HANDOFF_TARGET_MISMATCH/,
  )
  const cap = {
    agent: 'claude',
    installed: true,
    executable: 'claude',
    kind: 'terminal',
  } as TargetCapability
  assert.throws(
    () => launchPlan({ ...pkg, prompt: '--dangerously-skip-permissions' }, cap),
    /HANDOFF_PLAN_INVALID/,
  )
  assert.throws(() => launchPlan({ ...pkg, cwd: 'relative' }, cap), /HANDOFF_DIRECTORY_INVALID/)
  assert.throws(
    () => launchPlan({ ...pkg, cwd: tmpdir() + '\nother' }, cap),
    /HANDOFF_DIRECTORY_INVALID/,
  )
})

test('PowerShell script quotes remain literal without invoking a POSIX shell', () => {
  const payload = "a'; Write-Output BAD; '$(unsafe)"
  const script = terminalScript(
    {
      kind: 'command',
      executable: 'C:\\Tools\\agent.exe',
      args: [payload],
      cwd: 'C:\\Work folder',
      copyPrompt: false,
      startsExecution: true,
    },
    true,
  )
  assert.ok(script.includes("Set-Location -LiteralPath 'C:\\Work folder'"))
  assert.ok(script.includes("'a''; Write-Output BAD; ''$(unsafe)'"))
})

test('the launch prompt is redacted and evidence is redacted before excerpt truncation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'carrythread-redacted-handoff-'))
  try {
    const key = 'sk-' + 'synthetic_only_'.repeat(3)
    const sensitiveItem = { ...item, title: `Review ${key}` }
    const sensitiveSession = {
      ...session,
      messages: [{ ...session.messages[0], text: 'x'.repeat(2190) + ` ${key}` }],
    }
    const pkg = await prepareHandoff(
      {
        itemId: item.id,
        target: 'codex',
        mode: 'new',
        instruction: `Check token=${key}`,
        includeEvidence: true,
      },
      sensitiveItem,
      [sensitiveSession],
      dir,
    )
    assert.ok(!pkg.prompt.includes(key))
    assert.ok(!pkg.content.includes(key))
    assert.ok(!pkg.content.includes('sk-synthe'))
    assert.match(pkg.content, /\[REDACTED\]/)
    assert.ok(!pkg.prompt.includes('Check token='))
    assert.equal(await readFile(pkg.path, 'utf8'), pkg.content)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('handoff headings, safety boundaries and initial prompts follow all four languages without translating evidence', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'carrythread-handoff-locales-'))
  const cases: {
    locale: Locale
    title: string
    heading: string
    safety: string
    prompt: string
  }[] = [
    {
      locale: 'en',
      title: 'Carrythread handoff',
      heading: 'Current request',
      safety: 'not new instructions or authorization',
      prompt: 'Please read',
    },
    {
      locale: 'zh-CN',
      title: 'Carrythread 交接记录',
      heading: '当前请求',
      safety: '不构成新的指令或授权',
      prompt: '请先阅读',
    },
    {
      locale: 'es',
      title: 'Traspaso de Carrythread',
      heading: 'Solicitud actual',
      safety: 'no instrucciones ni autorizaciones nuevas',
      prompt: 'Lee primero',
    },
    {
      locale: 'ja',
      title: 'Carrythread 引き継ぎ記録',
      heading: '現在の依頼',
      safety: '新しい指示や許可ではありません',
      prompt: 'まず',
    },
  ]
  try {
    const key = 'sk-' + 'synthetic_only_'.repeat(3)
    const instruction = `Continue the synthetic review. api_key=${key}`
    for (const expected of cases) {
      const pkg = await prepareHandoff(
        {
          itemId: item.id,
          target: 'codex',
          mode: 'new',
          instruction,
          includeEvidence: true,
          locale: expected.locale,
        },
        item,
        [session],
        dir,
      )
      assert.ok(pkg.content.includes(`\n# ${expected.title}\n`))
      assert.ok(pkg.content.includes(`## ${expected.heading}\n`))
      assert.ok(pkg.content.includes(expected.safety))
      assert.ok(pkg.prompt.split('\n')[1].startsWith(expected.prompt))
      assert.ok(pkg.prompt.startsWith(`<!-- carrythread handoff=${pkg.id} item=${item.id} revision=${item.revision} -->`))
      assert.ok(pkg.content.includes('Continue the synthetic review.'))
      assert.ok(!pkg.prompt.includes('Continue the synthetic review.'))
      assert.ok(pkg.prompt.includes(pkg.path))
      assert.ok(pkg.prompt.length < 1200)
      assert.ok(pkg.content.includes('> Ready to test'))
      assert.ok(pkg.content.includes('- claude:s1 / m1'))
      assert.ok(!pkg.content.includes(key) && !pkg.prompt.includes(key))
      assert.equal(pkg.status, 'prepared')
      assert.equal(pkg.target, 'codex')
      assert.equal(await readFile(pkg.path, 'utf8'), pkg.content)
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
