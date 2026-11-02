import assert from 'node:assert/strict'
import { test } from 'node:test'
import { KeyStorageWriteSupersededError, ProviderKeyStorage, type NativeKeyBackend } from '../src/core/key-storage'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function fixture(backend: Partial<NativeKeyBackend> = {}) {
  const encrypted = new Map<string, string | null>()
  const sessionKeys = new Map<string, string>()
  const writes: (string | null)[] = []
  const storage = new ProviderKeyStorage({
    timeoutMs: 15, sessionKeys,
    readEncrypted: id => encrypted.get(id) ?? null,
    writeEncrypted: (id, cipher) => { writes.push(cipher); encrypted.set(id, cipher) },
    backend: { available: async () => true, encrypt: async () => 'opaque-os-ciphertext', decrypt: async () => 'synthetic-key', ...backend },
  })
  return { storage, encrypted, sessionKeys, writes }
}
const nextTick = () => new Promise(resolve => setImmediate(resolve))

test('successful native storage persists only ciphertext and remains readable after restart', async () => {
  const { storage, encrypted, sessionKeys, writes } = fixture()
  await storage.set('provider', 'synthetic-key')
  assert.equal(storage.pendingNativeCalls, 0)
  assert.equal(encrypted.get('provider'), 'opaque-os-ciphertext')
  assert.equal(sessionKeys.has('provider'), false)
  assert.ok(!writes.includes('synthetic-key'))
  const restarted = new ProviderKeyStorage({ timeoutMs: 15, readEncrypted: id => encrypted.get(id) ?? null, writeEncrypted: () => assert.fail('Reads must not write'), backend: { available: async () => true, encrypt: async () => assert.fail('Reads must not encrypt'), decrypt: async cipher => { assert.equal(cipher, 'opaque-os-ciphertext'); return 'synthetic-key' } } })
  assert.equal(await restarted.get('provider'), 'synthetic-key')
})

test('a hanging availability check returns a bounded session-only fallback', async () => {
  const gate = deferred<boolean>()
  let encryptionCalls = 0
  const { storage, encrypted, sessionKeys, writes } = fixture({ available: () => gate.promise, encrypt: async () => { encryptionCalls++; return 'late-cipher' } })
  encrypted.set('provider', 'older-cipher')
  const started = performance.now()
  await storage.set('provider', 'synthetic-key')
  assert.ok(performance.now() - started < 1000)
  assert.equal(sessionKeys.get('provider'), 'synthetic-key')
  assert.equal(encrypted.get('provider'), null)
  assert.equal(await storage.get('provider'), 'synthetic-key')
  gate.resolve(true); await nextTick()
  assert.equal(encryptionCalls, 0)
  assert.deepEqual(writes, [null])
})

test('late encryption success after timeout never persists or replaces the session key', async () => {
  const gate = deferred<string>()
  const { storage, encrypted, sessionKeys, writes } = fixture({ encrypt: () => gate.promise })
  await storage.set('provider', 'synthetic-key')
  assert.equal(sessionKeys.get('provider'), 'synthetic-key')
  assert.equal(encrypted.get('provider'), null)
  assert.equal(storage.pendingNativeCalls, 1, 'A timeout must not claim the native encryption was cancelled')
  gate.resolve('late-success-cipher'); await nextTick()
  assert.equal(storage.pendingNativeCalls, 0)
  assert.deepEqual(writes, [null])
  assert.equal(encrypted.get('provider'), null)
  assert.equal(sessionKeys.get('provider'), 'synthetic-key')
})

test('clearing memory preserves the pending-native count until late resolution or rejection', async () => {
  const first = deferred<boolean>(), second = deferred<boolean>()
  let calls = 0
  const { storage, sessionKeys, writes } = fixture({ available: () => ++calls === 1 ? first.promise : second.promise })
  await Promise.all([storage.set('first', 'synthetic-first'), storage.set('second', 'synthetic-second')])
  assert.equal(storage.pendingNativeCalls, 2)
  assert.equal(sessionKeys.size, 2)
  storage.clearSessionKeys()
  assert.equal(sessionKeys.size, 0)
  assert.equal(storage.pendingNativeCalls, 2, 'clearSessionKeys invalidates writes, not OS operations')
  first.resolve(true); await nextTick()
  assert.equal(storage.pendingNativeCalls, 1)
  second.reject(new Error('Late OS rejection')); await nextTick()
  assert.equal(storage.pendingNativeCalls, 0)
  assert.deepEqual(writes, [null, null])
  assert.equal(sessionKeys.size, 0)
})

test('unavailable or rejected native operations retain only the newly supplied session key', async () => {
  for (const backend of [
    { available: async () => false },
    { available: async () => { throw new Error('OS denied access') } },
    { encrypt: async () => { throw new Error('OS denied encryption') } },
  ]) {
    const { storage, encrypted, sessionKeys, writes } = fixture(backend)
    await storage.set('provider', 'synthetic-key')
    assert.equal(sessionKeys.get('provider'), 'synthetic-key')
    assert.equal(encrypted.get('provider'), null)
    assert.deepEqual(writes, [null])
  }
})

test('read unavailability, rejection and timeout do not delete historical ciphertext', async () => {
  for (const backend of [
    { available: async () => false },
    { available: () => new Promise<boolean>(() => {}) },
    { decrypt: async () => { throw new Error('Locked keychain') } },
    { decrypt: () => new Promise<string>(() => {}) },
  ]) {
    const { storage, encrypted, sessionKeys, writes } = fixture(backend)
    encrypted.set('provider', 'historical-cipher')
    assert.equal(await storage.get('provider'), undefined)
    assert.equal(encrypted.get('provider'), 'historical-cipher')
    assert.equal(sessionKeys.size, 0)
    assert.deepEqual(writes, [])
  }
})

test('explicit clearing supersedes a pending encryption and does not invoke native storage', async () => {
  const gate = deferred<string>(), entered = deferred<void>()
  const { storage, encrypted, sessionKeys, writes } = fixture({ encrypt: () => { entered.resolve(); return gate.promise } })
  const pending = storage.set('provider', 'synthetic-key')
  const rejected = assert.rejects(pending, KeyStorageWriteSupersededError)
  await entered.promise
  await storage.set('provider', '')
  gate.resolve('cipher-from-old-destination')
  await rejected
  assert.equal(encrypted.get('provider'), null)
  assert.equal(sessionKeys.has('provider'), false)
  assert.deepEqual(writes, [null])
})

test('clearing session data or quitting prevents a pending write from restoring credentials', async () => {
  const gate = deferred<string>(), entered = deferred<void>()
  const { storage, encrypted, sessionKeys, writes } = fixture({ encrypt: () => { entered.resolve(); return gate.promise } })
  const pending = storage.set('provider', 'synthetic-key')
  const rejected = assert.rejects(pending, KeyStorageWriteSupersededError)
  await entered.promise
  storage.clearSessionKeys()
  encrypted.clear()
  gate.resolve('late-cipher')
  await rejected
  assert.equal(encrypted.size, 0)
  assert.equal(sessionKeys.size, 0)
  assert.deepEqual(writes, [])
})

test('a delayed old decrypt cannot return a key after that provider was cleared', async () => {
  const gate = deferred<string>(), entered = deferred<void>()
  const { storage, encrypted } = fixture({ decrypt: () => { entered.resolve(); return gate.promise } })
  encrypted.set('provider', 'historical-cipher')
  const pending = storage.get('provider')
  await entered.promise
  await storage.set('provider', '')
  gate.resolve('old-provider-key')
  assert.equal(await pending, undefined)
  assert.equal(encrypted.get('provider'), null)
})
