import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { randomUUID } from 'node:crypto'
import { MAC_KEY_STORAGE_HELPER_FLAG, macKeyStorageInternals as internals } from '../src/main/mac-key-storage'

const executable = '/Applications/Carrythread.app/Contents/MacOS/Carrythread'
const cipher = Buffer.from('synthetic-ciphertext-not-real-encryption').toString('base64')
type Request = { requestId: string; operation: 'encrypt' | 'decrypt'; value: string }

class FakeProcess extends EventEmitter {
  readonly stdin = new PassThrough()
  readonly stdout = new PassThrough()
  closed = false
  constructor(readonly pid: number, onRequest: (child: FakeProcess, request: Request) => void, private readonly events: string[]) {
    super()
    const input: Buffer[] = []
    this.stdin.on('data', chunk => input.push(Buffer.from(chunk)))
    this.stdin.on('finish', () => onRequest(this, JSON.parse(Buffer.concat(input).toString('utf8'))))
  }
  reply(value: unknown) {
    this.stdout.write(Buffer.from(JSON.stringify(value) + '\n'))
    this.finish()
  }
  finish() {
    if (this.closed) return
    this.closed = true
    this.stdout.end()
    this.events.push('exit')
    setImmediate(() => this.emit('close', 0, null))
  }
}

function runtime(onRequest: (child: FakeProcess, request: Request) => void, options: { cleanupFails?: boolean; createDirectory?: () => Promise<string> } = {}) {
  const children: FakeProcess[] = [], events: string[] = []
  const calls: { executable: string; args: string[]; env: NodeJS.ProcessEnv }[] = []
  let count = 0
  return {
    children, events, calls,
    adapter: {
      supported: true, executable, parentPid: 42,
      environment: { HOME: '/Users/synthetic', USER: 'synthetic', LOGNAME: 'synthetic', LANG: 'en_US.UTF-8', TMPDIR: '/tmp', LC_CTYPE: 'UTF-8',
        OPENAI_API_KEY: 'synthetic-key-must-not-be-inherited', NODE_OPTIONS: '--require=untrusted.js', ELECTRON_RUN_AS_NODE: '1', NODE_PATH: '/untrusted', SSH_AUTH_SOCK: '/socket', CODEX_THREAD_ID: 'parent-session' },
      verifyExecutable: async () => {},
      createDirectory: options.createDirectory ?? (async () => `/tmp/carrythread-key-helper-${++count}`),
      removeDirectory: async (_path: string) => {
        assert.ok(children.every(c => c.closed), 'owned helper must exit before temporary files are removed')
        events.push('cleanup')
        if (options.cleanupFails) throw new Error('private filesystem details must not escape')
      },
      spawn: (path: string, args: string[], env: NodeJS.ProcessEnv) => {
        calls.push({ executable: path, args, env })
        const child = new FakeProcess(10000 + children.length, onRequest, events)
        children.push(child)
        return child
      },
      killOwned: (pid: number) => {
        const child = children.find(c => c.pid === pid)
        assert.ok(child, 'must only kill a helper created by this broker')
        events.push('kill')
        child.finish()
      },
    },
  }
}

test('strict one-shot protocol rejects unknown operations, IDs, extra fields and unbounded values', () => {
  const request: Request = { requestId: randomUUID(), operation: 'encrypt', value: 'synthetic-key' }
  assert.deepEqual(internals.parseRequest(Buffer.from(JSON.stringify(request))), request)
  for (const invalid of [
    { ...request, operation: 'eval' }, { ...request, requestId: '--inspect' }, { ...request, extra: true },
    { ...request, value: '' }, { ...request, value: 'a\0b' }, { ...request, value: 'x'.repeat(17000) },
    { ...request, operation: 'decrypt', value: 'not base64' },
  ]) assert.throws(() => internals.parseRequest(Buffer.from(JSON.stringify(invalid))), /KEY_HELPER_REQUEST_INVALID/)
  assert.throws(() => internals.parseRequest(Buffer.from(JSON.stringify(request) + JSON.stringify(request))), /KEY_HELPER_REQUEST_INVALID/)
  assert.throws(() => internals.parseRequest(Buffer.alloc(100_000)), /KEY_HELPER_REQUEST_INVALID/)
  assert.throws(() => internals.parseRequest(Buffer.from([0xff, 0xfe])), /KEY_HELPER_REQUEST_INVALID/)
})

test('reply must match the request ID and return only the expected value type', () => {
  const request: Request = { requestId: randomUUID(), operation: 'encrypt', value: 'synthetic-key' }
  assert.equal(internals.parseReply(Buffer.from(JSON.stringify({ requestId: request.requestId, ok: true, value: cipher })), request), cipher)
  assert.throws(() => internals.parseReply(Buffer.from(JSON.stringify({ requestId: randomUUID(), ok: true, value: cipher })), request), /KEY_HELPER_RESPONSE_INVALID/)
  assert.throws(() => internals.parseReply(Buffer.from(JSON.stringify({ requestId: request.requestId, ok: true, value: 'plaintext-leak' })), request), /KEY_HELPER_RESPONSE_INVALID/)
  assert.throws(() => internals.parseReply(Buffer.from(JSON.stringify({ requestId: request.requestId, ok: true, value: cipher, log: 'unexpected' })), request), /KEY_HELPER_RESPONSE_INVALID/)
  assert.throws(() => internals.parseReply(Buffer.from(JSON.stringify({ requestId: request.requestId, ok: false, code: 'KEY_STORAGE_UNAVAILABLE' })), request), /KEY_STORAGE_UNAVAILABLE/)
  assert.throws(() => internals.parseReply(Buffer.from(JSON.stringify({ requestId: request.requestId, ok: false, code: 'private secret text' })), request), /KEY_HELPER_RESPONSE_INVALID/)
})

test('helper environment keeps the real OS identity but no injected Node, agent or provider variables', () => {
  const source = runtime(() => {}).adapter.environment
  const env = internals.helperEnvironment(source, '/tmp/carrythread-key-helper-owned')
  assert.equal(env.HOME, source.HOME)
  assert.equal(env.USER, source.USER)
  assert.equal(env.LOGNAME, source.LOGNAME)
  assert.equal(env.LC_CTYPE, source.LC_CTYPE)
  assert.equal(env.CARRYTHREAD_DATA_DIR, '/tmp/carrythread-key-helper-owned')
  for (const key of ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE', 'NODE_PATH', 'SSH_AUTH_SOCK', 'OPENAI_API_KEY', 'CODEX_THREAD_ID']) assert.equal(env[key], undefined)
})

test('shell/node parents, extra debug flags, mismatched ppid and nonpackaged entry points are denied', async () => {
  const identity = { platform: 'darwin', packaged: true, executable, actualParentPid: 42, argv: [MAC_KEY_STORAGE_HELPER_FLAG, '--carrythread-key-storage-parent=42'], pipes: true }
  const canonical = async (path: string) => path
  await assert.doesNotReject(internals.assertParent(identity, canonical, async pid => { assert.equal(pid, 42); return executable + '\n' }))
  for (const changed of [
    { platform: 'linux' }, { packaged: false }, { pipes: false }, { actualParentPid: 43 },
    { executable: '/usr/local/bin/node' }, { argv: [MAC_KEY_STORAGE_HELPER_FLAG, '--carrythread-key-storage-parent=42', '--inspect=0'] },
    { argv: [MAC_KEY_STORAGE_HELPER_FLAG, '--carrythread-key-storage-parent=1'] },
  ]) await assert.rejects(internals.assertParent({ ...identity, ...changed }, canonical, async () => executable), /KEY_HELPER_UNAUTHORIZED/)
  for (const parent of ['/bin/zsh', '/usr/local/bin/node', '/Applications/Other.app/Contents/MacOS/Other']) {
    await assert.rejects(internals.assertParent(identity, canonical, async () => parent), /KEY_HELPER_UNAUTHORIZED/)
  }
})

test('recursive helpers and Node/debug-mode parent command lines are rejected', () => {
  assert.doesNotThrow(() => internals.assertParentArguments(executable))
  for (const command of [
    `${executable} ${MAC_KEY_STORAGE_HELPER_FLAG} --carrythread-key-storage-parent=42`,
    `${executable} --inspect=0`, `${executable} --require injection.js`, `${executable} -e code`,
    `${executable}\nextra`,
  ]) assert.throws(() => internals.assertParentArguments(command), /KEY_HELPER_UNAUTHORIZED/)
})

test('one process per operation, no secrets in argv/env, and settlement follows exit and cleanup', async () => {
  const received: Request[] = []
  const fixture = runtime((child, request) => {
    received.push(request)
    child.reply({ requestId: request.requestId, ok: true, value: request.operation === 'encrypt' ? cipher : 'synthetic-key' })
  })
  const broker = internals.createBroker(fixture.adapter)
  assert.equal(await broker.backend.available(), true)
  assert.equal(fixture.calls.length, 0, 'available must not create a second process')
  const encryption = broker.backend.encrypt('synthetic-key')
  assert.equal(broker.active, true)
  assert.equal(await encryption, cipher)
  assert.equal(broker.active, false)
  assert.deepEqual(fixture.events.slice(0, 3), ['exit', 'kill', 'cleanup'])
  assert.equal(await broker.backend.decrypt(cipher), 'synthetic-key')
  assert.equal(fixture.calls.length, 2)
  for (const call of fixture.calls) {
    assert.deepEqual(call.args, [MAC_KEY_STORAGE_HELPER_FLAG, '--carrythread-key-storage-parent=42'])
    assert.ok(!JSON.stringify(call.args).includes('synthetic-key'))
    assert.ok(!JSON.stringify(call.env).includes(cipher))
    assert.ok(!JSON.stringify(call.env).includes('synthetic-key'))
  }
  assert.deepEqual(received.map(r => r.operation), ['encrypt', 'decrypt'])
})

test('hard deadline kills the owned child and waits for cleanup before rejecting', async () => {
  const fixture = runtime(() => {})
  const broker = internals.createBroker(fixture.adapter, 15)
  await assert.rejects(broker.backend.encrypt('synthetic-key'), /KEY_HELPER_TIMEOUT/)
  assert.equal(fixture.children.length, 1)
  assert.equal(fixture.children[0].closed, true)
  assert.equal(fixture.events.at(-1), 'cleanup')
  assert.equal(broker.active, false)
})

test('shutdown is idempotent, waits for owned children, and blocks future operations', async () => {
  const fixture = runtime(() => {})
  const broker = internals.createBroker(fixture.adapter)
  const rejection = assert.rejects(broker.backend.encrypt('synthetic-key'), /KEY_HELPER_CLOSED/)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(broker.active, true)
  await broker.shutdown(); await rejection; await broker.shutdown()
  assert.equal(broker.active, false)
  assert.equal(await broker.backend.available(), false)
  await assert.rejects(broker.backend.decrypt(cipher), /KEY_HELPER_CLOSED/)
  assert.equal(fixture.children.length, 1)
  assert.equal(fixture.events.at(-1), 'cleanup')
})

test('shutdown during temporary directory creation still removes its directory without spawning', async () => {
  let release!: (path: string) => void
  const fixture = runtime(() => {}, { createDirectory: () => new Promise(resolve => { release = resolve }) })
  const broker = internals.createBroker(fixture.adapter)
  const rejected = assert.rejects(broker.backend.encrypt('synthetic-key'), /KEY_HELPER_CLOSED/)
  await new Promise(resolve => setImmediate(resolve))
  const shutdown = broker.shutdown()
  release('/tmp/carrythread-key-helper-late')
  await shutdown; await rejected
  assert.equal(fixture.children.length, 0)
  assert.deepEqual(fixture.events, ['cleanup'])
})

test('cleanup failure is reported only after the child has exited and never leaks raw errors', async () => {
  const fixture = runtime((child, request) => child.reply({ requestId: request.requestId, ok: true, value: cipher }), { cleanupFails: true })
  const broker = internals.createBroker(fixture.adapter)
  await assert.rejects(broker.backend.encrypt('synthetic-key'), error => {
    assert.equal((error as Error).message, 'KEY_HELPER_CLEANUP_FAILED')
    assert.equal(fixture.children[0].closed, true)
    return true
  })
  assert.equal(broker.active, false)
})

test('the independent deadman checks actual parenthood before signalling after six seconds', () => {
  assert.match(internals.DEADMAN_SCRIPT, /\/bin\/sleep 6/)
  assert.match(internals.DEADMAN_SCRIPT, /\/bin\/ps -p "\$\$" -o ppid=/)
  assert.match(internals.DEADMAN_SCRIPT, /"\$parent" = "\$1"/)
  assert.match(internals.DEADMAN_SCRIPT, /\/bin\/kill -KILL "\$1"/)
})
