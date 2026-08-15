import { cpSync, lstatSync, readdirSync, realpathSync, rmSync } from 'node:fs'
import { join, sep } from 'node:path'

function findFirstSymbolicLink(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    const metadata = lstatSync(path)
    if (metadata.isSymbolicLink()) return path
    if (metadata.isDirectory()) {
      const nested = findFirstSymbolicLink(path)
      if (nested !== undefined) return nested
    }
  }
  return undefined
}

export function materializeRuntimeLinks(nodeModules) {
  let remaining = findFirstSymbolicLink(nodeModules)
  while (remaining !== undefined) {
    const segments = remaining.slice(nodeModules.length + 1).split(sep)
    const binIndex = segments.lastIndexOf('.bin')
    if (binIndex >= 0) {
      rmSync(join(nodeModules, ...segments.slice(0, binIndex + 1)), { recursive: true, force: true })
      remaining = findFirstSymbolicLink(nodeModules)
      continue
    }

    const source = realpathSync(remaining)
    const nestedNodeModules = join(source, 'node_modules')
    rmSync(remaining, { recursive: true, force: true })
    cpSync(source, remaining, {
      recursive: true,
      dereference: true,
      filter: path => path !== nestedNodeModules && !path.startsWith(`${nestedNodeModules}${sep}`),
    })
    remaining = findFirstSymbolicLink(nodeModules)
  }
}

export function assertRuntimeHasNoLinks(nodeModules) {
  const remaining = findFirstSymbolicLink(nodeModules)
  if (remaining !== undefined) throw new Error(`Deployable DSH runtime still contains a symbolic link: ${remaining}`)
}
