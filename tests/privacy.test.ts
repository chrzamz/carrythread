import test from 'node:test'
import assert from 'node:assert/strict'
import { isSensitivePath, redactText, safeError } from '../src/core/privacy'
import { SOURCE_DIAGNOSTICS, translateDiagnostic } from '../src/core/sources/diagnostics'

test('redacts complete credentials and connection strings, including an unfinished PEM', () => {
  const key = 'sk-' + 'synthetic_only_'.repeat(3)
  const jwt = ['eyJsyntheticheader', 'syntheticpayload', 'syntheticsignature'].join('.')
  const input = `Token ${key}\nAuthorization: Bearer synthetic-bearer-value\npassword="synthetic-password"\npostgres://demo:synthetic-pass@example.invalid/db\n${jwt}\n-----BEGIN PRIVATE KEY-----\nsynthetic content`
  const result = redactText(input)
  assert.ok(result.redactions >= 6)
  for (const secret of [key, 'synthetic-bearer-value', 'synthetic-password', 'synthetic-pass', jwt, 'synthetic content']) assert.ok(!result.text.includes(secret))
  assert.equal(redactText(result.text).text, result.text)
})

test('ordinary API documentation and placeholders are not removed', () => {
  const input = 'Use the OpenAI API. API key: YOUR_API_KEY\npassword: <your-password>\napi_key = os.getenv("EXAMPLE_KEY")\nSecrets must stay local.'
  assert.equal(redactText(input).text, input)
})

test('sensitive paths are denied without blocking the supported history roots', () => {
  for (const path of ['/tmp/.env', '/tmp/auth.json', 'C:\\Users\\demo\\.ssh\\id_rsa', '/tmp/credentials/cache.db', '/tmp/Preferences']) assert.equal(isSensitivePath(path), true, path)
  for (const path of ['/tmp/.claude/projects/test.jsonl', '/tmp/.codex/sessions/one.jsonl', '/tmp/.finch/pi/sessions/one.jsonl', '/tmp/api-notes.md']) assert.equal(isSensitivePath(path), false, path)
})

test('safe errors never echo user content, paths, or credentials', () => {
  const error = Object.assign(new Error('private transcript at /home/example with password=not-for-output'), { code: 'EACCES' })
  assert.equal(safeError(error), 'Permission denied.')
  assert.equal(safeError(new Error('private response body')), 'Operation failed.')
  assert.equal(safeError(new DOMException('private', 'AbortError')), 'Operation cancelled.')
})

test('source diagnostics have complete English, Chinese, Spanish and Japanese variants', () => {
  for (const message of Object.keys(SOURCE_DIAGNOSTICS)) {
    assert.equal(translateDiagnostic(message, 'en'), message)
    for (const locale of ['zh-CN', 'es', 'ja'] as const) {
      assert.ok(translateDiagnostic(message, locale).trim())
      assert.notEqual(translateDiagnostic(message, locale), message)
    }
  }
})
