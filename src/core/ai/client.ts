import type { ConnectionResult, Locale, ProviderConfig } from '../contracts'
import { AIError, aiErrorMessage } from './errors'

export interface ChatInput { system: string; prompt: string; maxTokens?: number; json?: boolean }
const MAX_RESPONSE_BYTES = 2_000_000

export function validateProvider(config: ProviderConfig, requireModel = true): URL {
  let url: URL
  try { url = new URL(config.baseUrl) } catch { throw new AIError('invalid_config') }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password || url.search || url.hash || !['openai', 'anthropic', 'ollama'].includes(config.protocol)) throw new AIError('invalid_config')
  if ((requireModel && !config.model.trim()) || !Number.isFinite(config.timeoutMs) || config.timeoutMs < 1 || config.timeoutMs > 600_000) throw new AIError('invalid_config')
  return url
}

function endpoint(config: ProviderConfig, kind: 'chat' | 'models'): URL {
  const url = validateProvider(config, kind === 'chat')
  const base = url.pathname.replace(/\/+$/, '')
  const suffix = config.protocol === 'openai' ? (kind === 'chat' ? '/chat/completions' : '/models')
    : config.protocol === 'anthropic' ? (base.endsWith('/v1') ? '' : '/v1') + (kind === 'chat' ? '/messages' : '/models')
      : (base.endsWith('/api') ? '' : '/api') + (kind === 'chat' ? '/chat' : '/tags')
  url.pathname = base + suffix
  return url
}

async function request(config: ProviderConfig, key: string | undefined, kind: 'chat' | 'models', body: unknown, signal?: AbortSignal): Promise<unknown> {
  const url = endpoint(config, kind)
  if (signal?.aborted) throw new AIError('cancelled')
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (config.protocol === 'anthropic') {
    headers['anthropic-version'] = '2023-06-01'
    if (key) headers['x-api-key'] = key
  } else if (key) headers.Authorization = `Bearer ${key}`

  const timeout = new AbortController()
  const combined = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal
  let timedOut = false
  let abortListener: (() => void) | undefined
  const timer = setTimeout(() => { timedOut = true; timeout.abort() }, config.timeoutMs)
  const abort = new Promise<never>((_, reject) => {
    abortListener = () => reject(new AIError(timedOut ? 'timeout' : 'cancelled'))
    combined.addEventListener('abort', abortListener, { once: true })
  })
  const operation = async () => {
    // Never follow a redirect with a provider key to an unreviewed destination.
    const response = await fetch(url, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body), signal: combined, redirect: 'error' })
    if (!response.ok) {
      const code = response.status === 401 || response.status === 403 ? 'authentication' : response.status === 429 ? 'rate_limit' : 'http_error'
      await response.body?.cancel()
      throw new AIError(code, 'en', response.status)
    }
    if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) { await response.body?.cancel(); throw new AIError('invalid_response') }
    const reader = response.body?.getReader()
    if (!reader) throw new AIError('invalid_response')
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        size += chunk.value.byteLength
        if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new AIError('invalid_response') }
        chunks.push(chunk.value)
      }
    } finally { reader.releaseLock() }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown } catch { throw new AIError('invalid_response') }
  }
  try { return await Promise.race([operation(), abort]) }
  catch (error) {
    if (error instanceof AIError) throw error
    if (combined.aborted) throw new AIError(timedOut ? 'timeout' : 'cancelled')
    throw new AIError('network')
  } finally {
    clearTimeout(timer)
    if (abortListener) combined.removeEventListener('abort', abortListener)
  }
}

const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

export async function generateText(config: ProviderConfig, key: string | undefined, input: ChatInput, signal?: AbortSignal): Promise<string> {
  const messages = [{ role: 'system', content: input.system }, { role: 'user', content: input.prompt }]
  const maxTokens = Math.min(16_384, Math.max(16, input.maxTokens ?? 8192))
  let body: unknown
  if (config.protocol === 'anthropic') body = { model: config.model, system: input.system, messages: [messages[1]], max_tokens: maxTokens, stream: false }
  else if (config.protocol === 'ollama') body = { model: config.model, messages, stream: false, ...(input.json ? { format: 'json' } : {}), options: { num_predict: maxTokens } }
  else body = { model: config.model, messages, stream: false, [validateProvider(config).hostname === 'api.openai.com' ? 'max_completion_tokens' : 'max_tokens']: maxTokens }

  const data = object(await request(config, key, 'chat', body, signal))
  let content: unknown
  if (config.protocol === 'anthropic') {
    if (data.stop_reason === 'max_tokens') throw new AIError('invalid_response')
    const parts = Array.isArray(data.content) ? data.content.filter(part => object(part).type === 'text') : []
    if (parts.some(part => typeof object(part).text !== 'string')) throw new AIError('invalid_response')
    content = parts.map(part => object(part).text).join('')
  } else if (config.protocol === 'ollama') {
    if (data.done !== true || data.done_reason === 'length') throw new AIError('invalid_response')
    content = object(data.message).content
  } else {
    const choice = Array.isArray(data.choices) ? object(data.choices[0]) : {}
    if (choice.finish_reason === 'length' || choice.finish_reason === 'content_filter') throw new AIError('invalid_response')
    content = object(choice.message).content
  }
  if (typeof content !== 'string' || !content.trim()) throw new AIError('invalid_response')
  return content
}

/** Listing is optional. A failure here does not invalidate a manually entered model. */
export async function listModels(config: ProviderConfig, key?: string, signal?: AbortSignal): Promise<string[]> {
  const data = object(await request(config, key, 'models', undefined, signal))
  const values = config.protocol === 'ollama' ? data.models : data.data
  if (!Array.isArray(values)) throw new AIError('invalid_response')
  return [...new Set(values.map(entry => object(entry)[config.protocol === 'ollama' ? 'name' : 'id']).filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length < 300))].sort()
}

export async function testConnection(config: ProviderConfig, key?: string, signal?: AbortSignal, locale: Locale = 'en'): Promise<ConnectionResult> {
  try {
    await generateText(config, key, { system: 'This is a synthetic connection test. Reply with OK.', prompt: 'Connection test. No user records are included.', maxTokens: 1024 }, signal)
    const success = { en: 'Connection test succeeded.', 'zh-CN': '连接测试成功。', es: 'La prueba de conexión se completó.', ja: '接続テストに成功しました。' }
    return { ok: true, message: success[locale] }
  } catch (error) { return { ok: false, message: aiErrorMessage(error, locale) } }
}
