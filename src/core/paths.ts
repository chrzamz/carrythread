import { realpath, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path'

export async function assertExportDestination(
  destination: string,
  readOnlyPaths: string[],
  privateRoot: string,
): Promise<void> {
  if (!isAbsolute(destination) || destination.includes('\0')) throw new Error('INVALID_INPUT')
  let target: string
  try {
    target = await realpath(destination)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    target = join(await realpath(dirname(destination)), basename(destination))
  }
  for (const path of new Set([...readOnlyPaths, privateRoot])) {
    const protectedPath = await realpath(path).catch(() => null)
    if (!protectedPath) continue
    const info = await stat(protectedPath)
    if (target === protectedPath) throw new Error('EXPORT_SOURCE_READ_ONLY')
    if (info.isDirectory()) {
      const difference = relative(protectedPath, target)
      if (difference !== '..' && !difference.startsWith(`..${sep}`) && !isAbsolute(difference))
        throw new Error('EXPORT_SOURCE_READ_ONLY')
    }
  }
}
