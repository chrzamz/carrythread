import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ProviderConfig, ProviderProtocol } from '../src/core/contracts'
import { generateText, listModels, testConnection, validateProvider } from '../src/core/ai/client'
import { AIError } from '../src/core/ai/errors'
import { PROVIDER_PRESETS } from '../src/core/ai/presets'

const config = (protocol: ProviderProtocol): ProviderConfig => ({ id: 'test', name: 'Synthetic', protocol, baseUrl: protocol === 'ollama' ? 'http://localhost:11434' : protocol === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1', model: 'synthetic-model', hasKey: true, timeoutMs: 1000 })
const response = (protocol: ProviderProtocol, text = 'OK') => protocol === 'anthropic' ? { content: [{ type: 'text', text }], stop_reason: 'end_turn' } : protocol === 'ollama' ? { message: { content: text }, done: true } : { choices: [{ message: { content: text }, finish_reason: 'stop' }] }
const jsonResponse = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const hasCode = (code: string) => (error: unknown) => error instanceof AIError && error.code === code

for (const protocol of ['openai', 'anthropic', 'ollama'] as const) {
  test(`${protocol} uses the documented non-streaming request and bounded output`, async t => {
    let calls = 0
    t.mock.method(globalThis, 'fetch', async (url: URL, options: RequestInit) => {
      calls++
      assert.equal(options.redirect, 'error')
      assert.equal(options.method, 'POST')
      const body = JSON.parse(String(options.body))
      assert.equal(body.stream, false)
      assert.equal(body.model, 'synthetic-model')
      assert.equal(body.messages.at(-1).content, 'Synthetic prompt')
      assert.ok(!String(options.body).includes('synthetic-key'))
      if (protocol === 'anthropic') {
        assert.equal(url.pathname, '/v1/messages')
        assert.equal((options.headers as Record<string, string>)['x-api-key'], 'synthetic-key')
        assert.equal(body.system, 'Synthetic system')
        assert.equal(body.max_tokens, 256)
      } else if (protocol === 'ollama') {
        assert.equal(url.pathname, '/api/chat')
        assert.equal(body.format, 'json')
        assert.equal(body.options.num_predict, 256)
      } else {
        assert.equal(url.pathname, '/v1/chat/completions')
        assert.equal((options.headers as Record<string, string>).Authorization, 'Bearer synthetic-key')
        assert.equal(body.max_completion_tokens, 256)
      }
      return jsonResponse(response(protocol))
    })
    assert.equal(await generateText(config(protocol), 'synthetic-key', { system: 'Synthetic system', prompt: 'Synthetic prompt', json: true, maxTokens: 256 }), 'OK')
    assert.equal(calls, 1)
  })
  test(`${protocol} rejects authentication and rate limits without revealing upstream content`, async t => {
    let status = 401
    t.mock.method(globalThis, 'fetch', async () => jsonResponse({ error: 'Secret input echoed here: synthetic-key' }, status))
    await assert.rejects(generateText(config(protocol), 'synthetic-key', { system: '', prompt: 'test' }), (error: unknown) => hasCode('authentication')(error) && !String(error).includes('synthetic-key'))
    status = 429
    await assert.rejects(generateText(config(protocol), 'synthetic-key', { system: '', prompt: 'test' }), hasCode('rate_limit'))
  })
  test(`${protocol} rejects malformed JSON and invalid success shapes`, async t => {
    let malformed = true
    t.mock.method(globalThis, 'fetch', async () => malformed ? new Response('{broken') : jsonResponse({ data: 'not a chat response' }))
    await assert.rejects(generateText(config(protocol), undefined, { system: '', prompt: 'test' }), hasCode('invalid_response'))
    malformed = false
    await assert.rejects(generateText(config(protocol), undefined, { system: '', prompt: 'test' }), hasCode('invalid_response'))
  })
  test(`${protocol} deadline also bounds an unresponsive transport`, async t => {
    t.mock.method(globalThis, 'fetch', async () => await new Promise<Response>(() => {}))
    await assert.rejects(generateText({ ...config(protocol), timeoutMs: 10 }, undefined, { system: '', prompt: 'test' }), hasCode('timeout'))
  })
  test(`${protocol} model listing is optional and normalized`, async t => {
    t.mock.method(globalThis, 'fetch', async (_url: URL, options: RequestInit) => {
      assert.equal(options.method, 'GET')
      return jsonResponse(protocol === 'ollama' ? { models: [{ name: 'b' }, { name: 'a' }, { name: 'b' }] } : { data: [{ id: 'b' }, { id: 'a' }, { id: 'b' }] })
    })
    assert.deepEqual(await listModels(config(protocol), 'synthetic-key'), ['a', 'b'])
  })
}

test('OpenAI-compatible custom base paths use legacy max_tokens without assuming OpenAI-only options', async t => {
  t.mock.method(globalThis, 'fetch', async (url: URL, options: RequestInit) => {
    assert.equal(url.pathname, '/compatible-mode/v1/chat/completions')
    const body = JSON.parse(String(options.body))
    assert.equal(body.max_tokens, 8192)
    assert.equal(body.max_completion_tokens, undefined)
    assert.equal(body.response_format, undefined)
    return jsonResponse(response('openai'))
  })
  await generateText({ ...config('openai'), baseUrl: 'https://example.invalid/compatible-mode/v1/' }, undefined, { system: '', prompt: 'test' })
})

test('endpoint checks reject plaintext remote, credentials and URL query secrets', () => {
  for (const baseUrl of ['http://example.invalid/v1', 'https://username:password@example.invalid/v1', 'https://example.invalid/v1?key=secret', 'file:///tmp/service', 'https://example.invalid/v1#secret']) assert.throws(() => validateProvider({ ...config('openai'), baseUrl }), hasCode('invalid_config'))
  validateProvider(config('ollama'))
  validateProvider({ ...config('ollama'), baseUrl: 'http://[::1]:11434' })
})

test('cancellation and transport errors are safe and do not persist request material', async t => {
  const controller = new AbortController(); controller.abort()
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('credentials: synthetic-key and prompt') })
  await assert.rejects(generateText(config('openai'), 'synthetic-key', { system: '', prompt: 'test' }, controller.signal), hasCode('cancelled'))
  await assert.rejects(generateText(config('openai'), 'synthetic-key', { system: '', prompt: 'test' }), (error: unknown) => hasCode('network')(error) && !String(error).includes('synthetic-key'))
})

test('connection test sends synthetic content only and is independent of model listing', async t => {
  const bodies: string[] = []
  t.mock.method(globalThis, 'fetch', async (url: URL, options: RequestInit) => {
    assert.equal(url.pathname, '/v1/chat/completions')
    bodies.push(String(options.body))
    return jsonResponse(response('openai'))
  })
  const result = await testConnection(config('openai'), 'synthetic-key', undefined, 'zh-CN')
  assert.equal(result.ok, true)
  assert.equal(result.message, '连接测试成功。')
  assert.equal(bodies.length, 1)
  assert.ok(bodies[0].includes('No user records are included'))
})

test('truncated model responses and excessive HTTP response sizes are rejected', async t => {
  let oversized = false
  t.mock.method(globalThis, 'fetch', async () => oversized ? new Response('{}', { headers: { 'content-length': '3000000' } }) : jsonResponse({ choices: [{ message: { content: '{"items":[]}' }, finish_reason: 'length' }] }))
  await assert.rejects(generateText(config('openai'), undefined, { system: '', prompt: 'test' }), hasCode('invalid_response'))
  oversized = true
  await assert.rejects(generateText(config('openai'), undefined, { system: '', prompt: 'test' }), hasCode('invalid_response'))
})

test('provider presets include domestic, international, local and custom options without fixed models', () => {
  assert.ok(PROVIDER_PRESETS.some(preset => preset.region === 'cn'))
  assert.ok(PROVIDER_PRESETS.some(preset => preset.region === 'global'))
  assert.ok(PROVIDER_PRESETS.some(preset => preset.region === 'local'))
  assert.ok(PROVIDER_PRESETS.some(preset => preset.id === 'custom'))
  assert.ok(PROVIDER_PRESETS.every(preset => !('apiKey' in preset) && !('model' in preset)))
})
