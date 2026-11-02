import test from 'node:test'
import assert from 'node:assert/strict'
import { PROVIDER_PRESETS } from '../src/core/ai/presets'
import { validateProvider } from '../src/core/ai/client'

test('catalog includes the required domestic, international, local and custom choices', () => {
  const byId = new Map(PROVIDER_PRESETS.map(preset => [preset.id, preset]))
  for (const id of ['openai', 'anthropic', 'gemini', 'openrouter', 'xai']) {
    assert.equal(byId.get(id)?.region, 'global', id)
  }
  for (const id of ['deepseek', 'qwen', 'glm', 'moonshot', 'doubao', 'siliconflow']) {
    assert.equal(byId.get(id)?.region, 'cn', id)
    assert.equal(byId.get(id)?.protocol, 'openai', id)
  }
  assert.equal(byId.get('ollama')?.region, 'local')
  assert.equal(byId.get('custom')?.baseUrl, '')
})

test('preset IDs are unique and the catalog never embeds model IDs or API keys', () => {
  assert.equal(new Set(PROVIDER_PRESETS.map(preset => preset.id)).size, PROVIDER_PRESETS.length)
  const allowed = new Set(['id', 'name', 'protocol', 'baseUrl', 'region', 'docsUrl', 'modelsOptional'])
  for (const preset of PROVIDER_PRESETS) {
    assert.match(preset.id, /^[a-z][a-z0-9-]*$/)
    assert.ok(preset.name.trim())
    for (const field of Object.keys(preset)) assert.ok(allowed.has(field), `Unexpected preset field: ${field}`)
    assert.ok(!('model' in preset) && !('models' in preset) && !('defaultModel' in preset))
  }
  assert.deepEqual([...new Set(PROVIDER_PRESETS.map(preset => preset.protocol))].sort(), ['anthropic', 'ollama', 'openai'])
})

test('remote presets use HTTPS and authenticated requests never inherit URL credentials or query strings', () => {
  for (const preset of PROVIDER_PRESETS) {
    const docs = new URL(preset.docsUrl)
    assert.equal(docs.protocol, 'https:', preset.id)
    assert.equal(docs.username + docs.password, '', preset.id)
    if (preset.id === 'custom') continue
    const url = new URL(preset.baseUrl)
    assert.equal(url.username + url.password + url.search + url.hash, '', preset.id)
    if (url.protocol === 'http:') {
      assert.equal(preset.id, 'ollama')
      assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    } else assert.equal(url.protocol, 'https:', preset.id)
    assert.doesNotMatch(url.pathname, /\/(?:chat\/completions|messages|responses|models|tags)\/?$/)
    assert.doesNotThrow(() => validateProvider({
      id: preset.id, name: preset.name, protocol: preset.protocol, baseUrl: preset.baseUrl,
      model: 'user-selected-model', hasKey: false, timeoutMs: 30_000,
    }))
  }
})

test('ordinary API defaults cannot silently become subscription or coding-plan endpoints', () => {
  for (const preset of PROVIDER_PRESETS) {
    if (!preset.baseUrl) continue
    const url = new URL(preset.baseUrl)
    assert.doesNotMatch(url.hostname + url.pathname, /(?:coding\.|token-plan\.|\/coding(?:\/|$)|\/plan(?:\/|$)|\/token-plan(?:\/|$))/i, preset.id)
  }
  const qwen = PROVIDER_PRESETS.find(p => p.id === 'qwen')!
  const ark = PROVIDER_PRESETS.find(p => p.id === 'doubao')!
  assert.equal(new URL(qwen.baseUrl).pathname, '/compatible-mode/v1')
  assert.equal(new URL(ark.baseUrl).pathname, '/api/v3')
  assert.equal(qwen.modelsOptional, true)
  assert.match(ark.docsUrl, /integrate-third-party-tools/)
})
