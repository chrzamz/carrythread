/** Redact credentials before indexing, truncation, export, or inference. No telemetry. */
export function redactText(input: string): { text: string; redactions: number } {
  let text = input
  let redactions = 0
  const replace = (pattern: RegExp, replacement: string | ((...args: string[]) => string) = '[REDACTED]') => {
    text = text.replace(pattern, (...args: string[]) => {
      const result = typeof replacement === 'function' ? replacement(...args) : replacement
      if (result !== args[0]) redactions++
      return result
    })
  }
  replace(/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z ]+ )?PRIVATE KEY-----|$)/g)
  replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9+/_.=~-]{8,}/gi, (value) => `${value.split(/\s/)[0]} [REDACTED]`)
  replace(/\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}\b/g)
  replace(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g)
  replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g)
  replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g)
  replace(/\b(xox[baprs]-[A-Za-z0-9-]{12,})\b/g)
  replace(/\b([a-z][a-z0-9+.-]{0,31}:\/\/)[^\s/@:]+:[^\s/@]+@/gi, (_all, scheme) => `${scheme}[REDACTED]@`)
  replace(/((?:["']?)(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|password|passwd|secret|token|密码|密钥)(?:["']?)\s*[:=]\s*)("[^"\n]+"|'[^'\n]+'|[^\s,;}\n]+)/gi,
    (all, prefix, value) => {
      const unquoted = value.replace(/^["']|["']$/g, '')
      // Documentation placeholders and existing redactions are not credentials.
      if (/^(?:\[REDACTED\]|<[^>]+>|\$\{?\w+\}?|your[-_ ].*|example|placeholder|none|null|undefined|true|false|os\.|process\.|getenv\(|YOUR_|API_KEY|sk-xxx)/i.test(unquoted)) return all
      if (unquoted.length < 4) return all
      return `${prefix}[REDACTED]`
    })
  return { text, redactions }
}

/** Only known history files are scanned; never traverse credential or cache stores. */
export function isSensitivePath(path: string): boolean {
  if (redactText(path).redactions > 0) return true
  const parts = path.replace(/\\/g, '/').toLowerCase().split('/').filter(Boolean)
  const blocked = new Set(['.ssh', '.gnupg', '.aws', '.azure', '.git', 'node_modules', 'credentials', 'credential', 'secrets', 'keychains', 'cache', 'caches', 'network', 'cookies', 'session storage', 'local storage', 'code cache', 'blob_storage'])
  if (parts.some(part => blocked.has(part))) return true
  const name = parts.at(-1) ?? ''
  return /^(?:\.env(?:\..*)?|(?:auth|credentials?|secrets?|tokens?|config|settings|preferences|user-profile)(?:[._-].*)?|id_(?:rsa|ed25519|ecdsa)(?:\.pub)?|.*\.(?:pem|p12|pfx|key|keychain-db))$/.test(name)
}

/** Do not echo arbitrary error messages: they can contain keys, prompts, or local paths. */
export function safeError(error: unknown): string {
  const value = error && typeof error === 'object' ? error as { code?: unknown; name?: unknown } : {}
  const code = typeof value.code === 'string' ? value.code : ''
  if (value.name === 'AbortError' || code === 'ABORT_ERR') return 'Operation cancelled.'
  if (code === 'ENOENT') return 'Source not found.'
  if (code === 'EACCES' || code === 'EPERM') return 'Permission denied.'
  if (code === 'ELOOP') return 'Symbolic links are not scanned.'
  if (code === 'EBUSY' || code === 'SQLITE_BUSY' || code === 'SQLITE_LOCKED') return 'Source is busy; try again.'
  if (code === 'ETIMEDOUT' || value.name === 'TimeoutError') return 'Operation timed out.'
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ECONNRESET') return 'Connection failed.'
  if (value.name === 'SyntaxError') return 'Invalid data format.'
  return 'Operation failed.'
}
