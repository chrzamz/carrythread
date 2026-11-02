import test from 'node:test'
import assert from 'node:assert/strict'
import { providerDestinationChanged } from '../src/core/provider-policy'
import type { ProviderConfig } from '../src/core/contracts'
const original: ProviderConfig = {
  id: 'a',
  name: 'Primary',
  baseUrl: 'https://api.example.test/v1',
  protocol: 'openai',
  model: 'model-a',
  hasKey: true,
  timeoutMs: 30000,
}
test('provider credentials are invalidated for host, base path, scheme or protocol changes', () => {
  for (const changes of [
    { baseUrl: 'https://other.example.test/v1' },
    { baseUrl: 'https://api.example.test/other/v1' },
    { baseUrl: 'http://api.example.test/v1' },
    { protocol: 'anthropic' as const },
  ])
    assert.equal(providerDestinationChanged(original, { ...original, ...changes }), true)
})
test('model/display edits and equivalent trailing slash do not change the credential destination', () => {
  assert.equal(
    providerDestinationChanged(original, { ...original, model: 'model-b', name: 'Renamed' }),
    false,
  )
  assert.equal(
    providerDestinationChanged(original, { ...original, baseUrl: original.baseUrl + '/' }),
    false,
  )
  assert.equal(providerDestinationChanged(undefined, original), false)
})
