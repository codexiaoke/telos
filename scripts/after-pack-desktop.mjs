import { constants, cpSync, existsSync, rmSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')
const excludedDirectoryNames = new Set(['.git', '.codegraph', '.cache', 'coverage'])

function assertContained(parent, child) {
  const path = relative(parent, child)
  if (path === '' || path === '..' || path.startsWith(`..${sep}`)) {
    throw new Error(`Refusing to replace a desktop resource outside ${parent}: ${child}`)
  }
}

function copyResource(source, destination, filter) {
  if (!existsSync(source)) throw new Error(`Required packaged resource does not exist: ${source}`)
  assertContained(dirnameForDestination(destination), destination)
  rmSync(destination, { recursive: true, force: true })
  cpSync(source, destination, {
    recursive: true,
    dereference: false,
    verbatimSymlinks: true,
    preserveTimestamps: true,
    mode: constants.COPYFILE_FICLONE,
    ...(filter === undefined ? {} : { filter }),
  })
}

function dirnameForDestination(destination) {
  const resourcesMarker = `${sep}Resources${sep}`
  const resourcesIndex = destination.indexOf(resourcesMarker)
  if (resourcesIndex >= 0) return destination.slice(0, resourcesIndex + resourcesMarker.length - 1)

  const lowerMarker = `${sep}resources${sep}`
  const lowerIndex = destination.indexOf(lowerMarker)
  if (lowerIndex >= 0) return destination.slice(0, lowerIndex + lowerMarker.length - 1)
  throw new Error(`Unable to identify packaged Resources directory for ${destination}`)
}

function dshRuntimeFilter(source) {
  const relativePath = relative(join(repositoryRoot, 'third_party/deepseek-harness'), source)
  const segments = relativePath.split(sep)
  if (segments.some(segment => excludedDirectoryNames.has(segment))) return false
  const name = segments.at(-1) ?? ''
  return name !== '.DS_Store' && !name.endsWith('.map') && !name.endsWith('.tsbuildinfo')
}

export default async function afterPack(context) {
  const runtimeTarget = process.env.TELOS_RUNTIME_TARGET
  if (runtimeTarget === undefined || runtimeTarget.length === 0) {
    throw new Error('TELOS_RUNTIME_TARGET is required by the desktop afterPack hook')
  }

  const resourcesDirectory = context.packager.getResourcesDir(context.appOutDir)
  const dshRoot = join(repositoryRoot, 'third_party/deepseek-harness')
  const overlaysRoot = join(repositoryRoot, 'integrations/dsh/plugins')
  const nodeRoot = join(repositoryRoot, '.local/desktop-runtime', runtimeTarget, 'dsh-node')

  copyResource(dshRoot, join(resourcesDirectory, 'dsh-runtime'), dshRuntimeFilter)
  copyResource(join(overlaysRoot, 'telos-ui-sidebar'), join(resourcesDirectory, 'dsh-overlays/telos-ui-sidebar'))
  copyResource(join(overlaysRoot, 'telos-ui-layout'), join(resourcesDirectory, 'dsh-overlays/telos-ui-layout'))
  copyResource(join(repositoryRoot, 'plugins/dsh-continuity'), join(resourcesDirectory, 'dsh-overlays/telos-continuity'))
  copyResource(join(repositoryRoot, 'plugins/dsh-mcp-manager'), join(resourcesDirectory, 'dsh-overlays/telos-mcp-manager'))
  copyResource(nodeRoot, join(resourcesDirectory, 'dsh-node'))
}
