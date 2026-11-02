import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertExportDestination } from '../src/core/paths'

test('exports cannot overwrite original histories or the application database, including new files in source roots', async () => {
  const root = await mkdtemp(join(tmpdir(), 'carrythread-export-'))
  try {
    const source = join(root, 'history'),
      privateRoot = join(root, 'app')
    await mkdir(source)
    await mkdir(privateRoot)
    const original = join(source, 'session.jsonl')
    await writeFile(original, 'original bytes')
    await assert.rejects(
      assertExportDestination(original, [source], privateRoot),
      /EXPORT_SOURCE_READ_ONLY/,
    )
    await assert.rejects(
      assertExportDestination(join(source, 'new.md'), [source], privateRoot),
      /EXPORT_SOURCE_READ_ONLY/,
    )
    await assert.rejects(
      assertExportDestination(join(privateRoot, 'carrythread.db'), [source], privateRoot),
      /EXPORT_SOURCE_READ_ONLY/,
    )
    await assertExportDestination(join(root, 'portable.json'), [source], privateRoot)
    assert.equal(await readFile(original, 'utf8'), 'original bytes')
    if (process.platform !== 'win32') {
      const alias = join(root, 'alias.json')
      await symlink(original, alias)
      await assert.rejects(
        assertExportDestination(alias, [source], privateRoot),
        /EXPORT_SOURCE_READ_ONLY/,
      )
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
