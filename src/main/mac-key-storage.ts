import type { App, SafeStorage } from 'electron'
import { randomUUID } from 'node:crypto'
import { spawn, execFile } from 'node:child_process'
import { chmod, lstat, mkdtemp, realpath, rm } from 'node:fs/promises'
import { fstatSync } from 'node:fs'
import { basename, dirname, isAbsolute, join } from 'node:path'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import type { Readable, Writable } from 'node:stream'
import type { NativeKeyBackend } from '../core/key-storage'

export const MAC_KEY_STORAGE_HELPER_FLAG = '--carrythread-key-storage-helper'
const PARENT_FLAG = '--carrythread-key-storage-parent='
const DIRECTORY_PREFIX = 'carrythread-key-helper-'
const DEADLINE_MS = 4000
const MAX_PLAINTEXT_BYTES = 16 * 1024
const MAX_CIPHER_BYTES = 64 * 1024
const MAX_WIRE_BYTES = 96 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
type Operation = 'encrypt' | 'decrypt'
type Request = { operation: Operation; value: string; requestId: string }
type Reply = { requestId: string; ok: true; value: string } | { requestId: string; ok: false; code: string }

const fail = (code: string): Error => Object.assign(new Error(code), { code })
const codes = new Set(['KEY_HELPER_UNAUTHORIZED', 'KEY_HELPER_REQUEST_INVALID', 'KEY_STORAGE_UNAVAILABLE', 'KEY_STORAGE_OPERATION_FAILED', 'KEY_HELPER_RESPONSE_INVALID'])
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k))
const plaintext = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && !/[\x00-\x1f\x7f]/.test(value) && Buffer.byteLength(value) <= MAX_PLAINTEXT_BYTES
const ciphertext = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= MAX_CIPHER_BYTES && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value) && Buffer.from(value, 'base64').toString('base64') === value

function parseRequest(bytes: Buffer): Request {
  if (bytes.length > MAX_WIRE_BYTES) throw fail('KEY_HELPER_REQUEST_INVALID')
  let value: unknown
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { throw fail('KEY_HELPER_REQUEST_INVALID') }
  if (!record(value) || !exactKeys(value, ['operation', 'value', 'requestId']) || typeof value.requestId !== 'string' || !UUID.test(value.requestId) ||
    !['encrypt', 'decrypt'].includes(String(value.operation)) || !(value.operation === 'encrypt' ? plaintext(value.value) : ciphertext(value.value))) throw fail('KEY_HELPER_REQUEST_INVALID')
  return value as Request
}

function parseReply(bytes: Buffer, request: Request): string {
  if (bytes.length > MAX_WIRE_BYTES) throw fail('KEY_HELPER_RESPONSE_INVALID')
  let value: unknown
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { throw fail('KEY_HELPER_RESPONSE_INVALID') }
  if (!record(value) || value.requestId !== request.requestId) throw fail('KEY_HELPER_RESPONSE_INVALID')
  if (value.ok === false && exactKeys(value, ['requestId', 'ok', 'code']) && typeof value.code === 'string' && codes.has(value.code)) throw fail(value.code)
  if (value.ok !== true || !exactKeys(value, ['requestId', 'ok', 'value']) || !(request.operation === 'encrypt' ? ciphertext(value.value) : plaintext(value.value))) throw fail('KEY_HELPER_RESPONSE_INVALID')
  return value.value as string
}

/** The helper inherits no API keys, agent transports, Node injection, or debug settings. */
function helperEnvironment(environment: NodeJS.ProcessEnv, directory?: string): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(environment)) {
    if (value !== undefined && (['HOME', 'USER', 'LOGNAME', 'TMPDIR', 'LANG', 'SHELL', '__CF_USER_TEXT_ENCODING'].includes(key) || /^LC_[A-Z_]+$/.test(key))) result[key] = value
  }
  result.PATH = '/usr/bin:/bin:/usr/sbin:/sbin'
  if (directory) result.CARRYTHREAD_DATA_DIR = directory
  return result
}

interface OwnedProcess {
  pid?: number
  stdin: Writable | null
  stdout: Readable | null
  once(event: string, listener: (...args: any[]) => void): unknown
}
interface BrokerRuntime {
  supported: boolean
  executable: string
  parentPid: number
  environment: NodeJS.ProcessEnv
  verifyExecutable(): Promise<void>
  createDirectory(): Promise<string>
  removeDirectory(path: string): Promise<void>
  spawn(executable: string, args: string[], environment: NodeJS.ProcessEnv): OwnedProcess
  killOwned(pid: number): void
}

class BrokerCore {
  private closed = false
  private readonly jobs = new Set<{ done: Promise<string>; cancel(code: string): void }>()
  readonly backend: NativeKeyBackend
  constructor(private readonly runtime: BrokerRuntime, private readonly deadline = DEADLINE_MS) {
    this.backend = {
      available: async () => runtime.supported && !this.closed,
      encrypt: value => this.run('encrypt', value),
      decrypt: value => this.run('decrypt', value),
    }
  }
  get active(): boolean { return this.jobs.size > 0 }

  private run(operation: Operation, value: string): Promise<string> {
    if (this.closed) return Promise.reject(fail('KEY_HELPER_CLOSED'))
    if (!this.runtime.supported) return Promise.reject(fail('KEY_STORAGE_UNAVAILABLE'))
    const request = { operation, value, requestId: randomUUID() }
    let encoded: Buffer
    try { encoded = Buffer.from(JSON.stringify(request)); parseRequest(encoded) } catch { return Promise.reject(fail('KEY_HELPER_REQUEST_INVALID')) }
    let child: OwnedProcess | undefined, directory: string | undefined, abortCode: string | undefined
    const output: Buffer[] = []
    const cancel = (code: string) => {
      abortCode ??= code
      if (child?.pid) this.runtime.killOwned(child.pid)
    }
    const timer = setTimeout(() => cancel('KEY_HELPER_TIMEOUT'), this.deadline)
    const job = { done: Promise.resolve(''), cancel }
    job.done = Promise.resolve().then(async () => {
      try {
        await this.runtime.verifyExecutable()
        if (abortCode || this.closed) throw fail(abortCode || 'KEY_HELPER_CLOSED')
        directory = await this.runtime.createDirectory()
        if (abortCode || this.closed) throw fail(abortCode || 'KEY_HELPER_CLOSED')
        child = this.runtime.spawn(this.runtime.executable, [MAC_KEY_STORAGE_HELPER_FLAG, `${PARENT_FLAG}${this.runtime.parentPid}`], helperEnvironment(this.runtime.environment, directory))
        const owned = child
        let bytes = 0, spawnFailed = false
        await new Promise<void>(resolve => {
          owned.once('error', () => { spawnFailed = true; cancel('KEY_HELPER_SPAWN_FAILED'); if (!owned.pid) resolve() })
          owned.once('close', () => resolve())
          owned.stdout?.on('data', (chunk: Buffer | string) => {
            const buffer = Buffer.from(chunk)
            bytes += buffer.length
            if (bytes > MAX_WIRE_BYTES) { buffer.fill(0); cancel('KEY_HELPER_RESPONSE_INVALID'); return }
            output.push(buffer)
          })
          owned.stdout?.on('error', () => cancel('KEY_HELPER_RESPONSE_INVALID'))
          owned.stdin?.on('error', () => cancel('KEY_HELPER_REQUEST_INVALID'))
          if (!owned.stdin || !owned.stdout) { cancel('KEY_HELPER_SPAWN_FAILED'); if (!owned.pid) resolve(); return }
          owned.stdin.end(encoded, () => encoded.fill(0))
        })
        if (abortCode || spawnFailed || this.closed) throw fail(abortCode || 'KEY_HELPER_CLOSED')
        return parseReply(Buffer.concat(output), request)
      } catch (error) {
        const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined
        throw fail(typeof code === 'string' && /^(?:KEY_HELPER_[A-Z_]+|KEY_STORAGE_[A-Z_]+)$/.test(code) ? code : 'KEY_STORAGE_OPERATION_FAILED')
      } finally {
        clearTimeout(timer)
        // The detached group contains only this helper and its own deadman process.
        if (child?.pid) this.runtime.killOwned(child.pid)
        encoded.fill(0); for (const buffer of output) buffer.fill(0)
        if (directory) await this.runtime.removeDirectory(directory).catch(() => { throw fail('KEY_HELPER_CLEANUP_FAILED') })
      }
    }).finally(() => { this.jobs.delete(job) })
    this.jobs.add(job)
    return job.done
  }

  async shutdown(): Promise<void> {
    this.closed = true
    const jobs = [...this.jobs]
    for (const job of jobs) job.cancel('KEY_HELPER_CLOSED')
    const settled = await Promise.allSettled(jobs.map(job => job.done))
    if (settled.some(result => result.status === 'rejected' && result.reason?.code === 'KEY_HELPER_CLEANUP_FAILED')) throw fail('KEY_HELPER_CLEANUP_FAILED')
  }
}

const packagedExecutable = (path: string) => isAbsolute(path) && basename(path) === 'Carrythread' && /\.app\/Contents\/MacOS\/Carrythread$/.test(path)

export class MacKeyStorageBroker extends BrokerCore {
  constructor(executablePath: string) {
    super({
      supported: process.platform === 'darwin' && packagedExecutable(executablePath), executable: executablePath,
      parentPid: process.pid, environment: process.env,
      verifyExecutable: async () => {
        if (await realpath(executablePath) !== await realpath(process.execPath)) throw fail('KEY_HELPER_UNAUTHORIZED')
      },
      createDirectory: async () => {
        const directory = await mkdtemp(join(await realpath(tmpdir()), DIRECTORY_PREFIX))
        await chmod(directory, 0o700)
        return directory
      },
      removeDirectory: path => rm(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 }),
      spawn: (executable, args, env) => spawn(executable, args, { env, detached: true, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true }),
      killOwned: pid => { try { process.kill(-pid, 'SIGKILL') } catch { /* already exited */ } },
    })
  }
}

interface ParentIdentity {
  platform: string; packaged: boolean; executable: string; actualParentPid: number; argv: string[]; pipes: boolean
}
async function assertParent(identity: ParentIdentity, canonical: (path: string) => Promise<string>, parentCommand: (pid: number) => Promise<string>): Promise<void> {
  if (identity.platform !== 'darwin' || !identity.packaged || !identity.pipes || !packagedExecutable(identity.executable)) throw fail('KEY_HELPER_UNAUTHORIZED')
  if (identity.argv.length !== 2 || identity.argv[0] !== MAC_KEY_STORAGE_HELPER_FLAG || !identity.argv[1].startsWith(PARENT_FLAG)) throw fail('KEY_HELPER_UNAUTHORIZED')
  const pid = identity.argv[1].slice(PARENT_FLAG.length)
  if (!/^[1-9][0-9]{0,9}$/.test(pid) || Number(pid) <= 1 || Number(pid) !== identity.actualParentPid) throw fail('KEY_HELPER_UNAUTHORIZED')
  const command = (await parentCommand(Number(pid))).trim()
  if (!isAbsolute(command) || /[\x00-\x1f\x7f]/.test(command) || await canonical(command) !== await canonical(identity.executable)) throw fail('KEY_HELPER_UNAUTHORIZED')
}

function assertParentArguments(command: string): void {
  if (!command || command.length > 32 * 1024 || /[\x00\r\n]/.test(command) ||
    /(?:^|\s)--carrythread-key-storage-helper(?:\s|$)/.test(command) ||
    /(?:^|\s)(?:--inspect(?:-brk)?(?:=|\s|$)|--(?:require|eval|import)(?:=|\s|$)|-[er](?:\s|$))/.test(command)) throw fail('KEY_HELPER_UNAUTHORIZED')
}

async function assertTemporaryDirectory(path: string | undefined): Promise<string> {
  if (!path || !isAbsolute(path)) throw fail('KEY_HELPER_UNAUTHORIZED')
  const info = await lstat(path)
  if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 || (process.getuid && info.uid !== process.getuid())) throw fail('KEY_HELPER_UNAUTHORIZED')
  const canonical = await realpath(path)
  if (dirname(canonical) !== await realpath(tmpdir()) || !basename(canonical).startsWith(DIRECTORY_PREFIX)) throw fail('KEY_HELPER_UNAUTHORIZED')
  return canonical
}

async function readRequest(stream: Readable): Promise<Request> {
  const chunks: Buffer[] = []
  let size = 0
  try {
    for await (const raw of stream) {
      const chunk = Buffer.from(raw)
      size += chunk.length
      if (size > MAX_WIRE_BYTES) { chunk.fill(0); throw fail('KEY_HELPER_REQUEST_INVALID') }
      chunks.push(chunk)
    }
    return parseRequest(Buffer.concat(chunks))
  } finally { for (const chunk of chunks) chunk.fill(0) }
}

// This watchdog does not share Electron's event loop or Keychain worker threads.
// If the helper has exited, the shell is reparented and must not signal a reused PID.
const DEADMAN_SCRIPT = '/bin/sleep 6; parent=$(/bin/ps -p "$$" -o ppid= | /usr/bin/tr -d "[:space:]"); if [ "$parent" = "$1" ]; then /bin/kill -KILL "$1"; fi'

/** Invoked only by the packaged app's early helper branch, before normal startup. */
export async function runMacKeyStorageHelper(app: App, safeStorage: SafeStorage): Promise<void> {
  let request: Request | undefined
  let deadman: ReturnType<typeof spawn> | undefined
  try {
    const input = fstatSync(0), output = fstatSync(1)
    await assertParent({ platform: process.platform, packaged: app.isPackaged, executable: process.execPath,
      actualParentPid: process.ppid, argv: process.argv.slice(1), pipes: (input.isFIFO() || input.isSocket()) && (output.isFIFO() || output.isSocket()) }, realpath,
      async pid => (await promisify(execFile)('/bin/ps', ['-ww', '-p', String(pid), '-o', 'comm='], { encoding: 'utf8', timeout: 750, maxBuffer: 8192 })).stdout)
    // A helper cannot parent another decrypt helper, even when both executable paths match.
    const parentArguments = await promisify(execFile)('/bin/ps', ['-ww', '-p', String(process.ppid), '-o', 'command='], { encoding: 'utf8', timeout: 750, maxBuffer: 32 * 1024 })
    assertParentArguments(parentArguments.stdout.trim())
    const directory = await assertTemporaryDirectory(process.env.CARRYTHREAD_DATA_DIR)
    // Recheck parenthood after asynchronous identity verification.
    if (`${PARENT_FLAG}${process.ppid}` !== process.argv[2]) throw fail('KEY_HELPER_UNAUTHORIZED')
    deadman = spawn('/bin/sh', ['-c', DEADMAN_SCRIPT, 'carrythread-key-deadman', String(process.pid)], { stdio: 'ignore', env: helperEnvironment(process.env) })
    deadman.on('error', () => { process.kill(process.pid, 'SIGKILL') })
    app.setName('Carrythread')
    app.setPath('userData', directory)
    request = await readRequest(process.stdin)
    await app.whenReady()
    if (!await safeStorage.isAsyncEncryptionAvailable()) throw fail('KEY_STORAGE_UNAVAILABLE')
    const value = request.operation === 'encrypt'
      ? (await safeStorage.encryptStringAsync(request.value)).toString('base64')
      : (await safeStorage.decryptStringAsync(Buffer.from(request.value, 'base64'))).result
    const reply: Reply = { requestId: request.requestId, ok: true, value }
    const bytes = Buffer.from(JSON.stringify(reply) + '\n')
    parseReply(bytes, request)
    await new Promise<void>((resolve, reject) => process.stdout.write(bytes, error => error ? reject(fail('KEY_HELPER_RESPONSE_INVALID')) : resolve()))
    bytes.fill(0)
    app.exit(0)
  } catch (error) {
    const candidate = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined
    const code = typeof candidate === 'string' && codes.has(candidate) ? candidate : 'KEY_STORAGE_OPERATION_FAILED'
    if (request) {
      const reply: Reply = { requestId: request.requestId, ok: false, code }
      await new Promise<void>(resolve => process.stdout.write(JSON.stringify(reply) + '\n', () => resolve()))
    }
    // Never return request bytes, exception text, or a decrypted value on an error.
    app.exit(1)
  }
  // Do not cancel the independent deadman: app.exit can itself stall in native code.
  // The parent kills the owned group after exit, or this watcher terminates it at 6s.
}

/** @internal Deterministic protocol/process tests; production entry points use real identity checks. */
export const macKeyStorageInternals = { parseRequest, parseReply, helperEnvironment, assertParent, assertParentArguments, DEADMAN_SCRIPT,
  createBroker: (runtime: BrokerRuntime, deadline = DEADLINE_MS) => new BrokerCore(runtime, deadline) }
