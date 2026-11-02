import test from 'node:test'
import assert from 'node:assert/strict'
import { catalogs, languages, translate } from '../src/renderer/i18n'

test('all release languages preserve interpolation variables and contain nonempty UI text', () => {
  const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort()
  for (const locale of languages.map(l=>l.id)) {
    assert.deepEqual(Object.keys(catalogs[locale]).sort(),Object.keys(catalogs.en).sort())
    for (const key of Object.keys(catalogs.en) as (keyof typeof catalogs.en)[]) {
      assert.ok(catalogs[locale][key].trim(), `${locale}.${key}`)
      assert.deepEqual(placeholders(catalogs[locale][key]),placeholders(catalogs.en[key]),`${locale}.${key}`)
    }
    const notice = translate(locale,'reviewNotice',{count:4,provider:'Selected endpoint'})
    assert.ok(notice.includes('4')&&notice.includes('Selected endpoint'))
    assert.ok(!notice.includes('{count}'))
  }
})

