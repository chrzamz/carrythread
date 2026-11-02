export interface NativeKeyBackend {
  available(): Promise<boolean>
  encrypt(plaintext: string): Promise<string>
  decrypt(ciphertext: string): Promise<string>
}

export interface ProviderKeyStorageOptions {
  backend: NativeKeyBackend
  readEncrypted(id: string): string | null
  writeEncrypted(id: string, ciphertext: string | null): void
  sessionKeys?: Map<string, string>
  timeoutMs?: number
}

type NativeResult<T> = { ok: true; value: T } | { ok: false }

export class KeyStorageWriteSupersededError extends Error {
  readonly code = 'KEY_WRITE_SUPERSEDED'
  constructor() { super('KEY_WRITE_SUPERSEDED'); this.name = 'KeyStorageWriteSupersededError' }
}

/**
 * Bounds native storage calls without assuming that an OS prompt can be cancelled.
 * Late native results are ignored: only this class's awaited result may persist data.
 */
export class ProviderKeyStorage {
  private readonly sessionKeys: Map<string, string>
  private readonly timeoutMs: number
  private readonly revisions = new Map<string, number>()
  private epoch = 0

  constructor(private readonly options: ProviderKeyStorageOptions) {
    this.sessionKeys = options.sessionKeys ?? new Map()
    this.timeoutMs = options.timeoutMs ?? 5000
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs < 1) throw new Error('KEY_STORAGE_TIMEOUT_INVALID')
  }

  private native<T>(operation: () => Promise<T>): Promise<NativeResult<T>> {
    return new Promise(resolve => {
      let settled = false
      const finish = (result: NativeResult<T>) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(result)
      }
      const timer = setTimeout(() => finish({ ok: false }), this.timeoutMs)
      Promise.resolve().then(operation).then(value => finish({ ok: true, value }), () => finish({ ok: false }))
    })
  }

  private current(id: string, revision: number, epoch: number): boolean {
    return this.epoch === epoch && (this.revisions.get(id) ?? 0) === revision
  }

  async get(id: string): Promise<string | undefined> {
    if (this.sessionKeys.has(id)) return this.sessionKeys.get(id)
    const cipher = this.options.readEncrypted(id)
    if (!cipher) return undefined
    const revision = this.revisions.get(id) ?? 0
    const epoch = this.epoch
    const available = await this.native(() => this.options.backend.available())
    if (!available.ok || available.value !== true || !this.current(id, revision, epoch)) return undefined
    const decrypted = await this.native(() => this.options.backend.decrypt(cipher))
    if (!decrypted.ok || typeof decrypted.value !== 'string' || !this.current(id, revision, epoch)) return undefined
    // Reading must never clear an old ciphertext, including when the OS is locked.
    if (this.options.readEncrypted(id) !== cipher) return undefined
    return decrypted.value
  }

  async set(id: string, key: string): Promise<void> {
    const revision = (this.revisions.get(id) ?? 0) + 1
    this.revisions.set(id, revision)
    const epoch = this.epoch
    this.sessionKeys.delete(id)
    if (!key) {
      this.options.writeEncrypted(id, null)
      return
    }

    const available = await this.native(() => this.options.backend.available())
    if (!this.current(id, revision, epoch)) throw new KeyStorageWriteSupersededError()
    if (available.ok && available.value === true) {
      const encrypted = await this.native(() => this.options.backend.encrypt(key))
      if (!this.current(id, revision, epoch)) throw new KeyStorageWriteSupersededError()
      if (encrypted.ok && typeof encrypted.value === 'string' && encrypted.value.length > 0 && encrypted.value !== key) {
        this.options.writeEncrypted(id, encrypted.value)
        return
      }
    }

    // This is a newly supplied key, not a decrypted historical credential.
    // On rejection, unavailability or timeout, it exists only in process memory.
    this.options.writeEncrypted(id, null)
    this.sessionKeys.set(id, key)
  }

  /** Clearing application data or quitting invalidates every pending native result. */
  clearSessionKeys(): void {
    this.epoch++
    this.revisions.clear()
    this.sessionKeys.clear()
  }
}
