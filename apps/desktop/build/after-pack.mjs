import { constants, cpSync, existsSync, rmSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '../../..')
const excludedDirectoryNames = new Set(['.git', '.codegraph', '.cache', 'coverage'])
const excludedPluginDirectoryNames = new Set([...excludedDirectoryNames, 'node_modules', 'src', 'test'])

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

function dshRuntimeFilter(source, dshRoot) {
  const relativePath = relative(dshRoot, source)
  const segments = relativePath.split(sep)
  if (segments.some(segment => excludedDirectoryNames.has(segment))) return false
  const name = segments.at(-1) ?? ''
  return name !== '.DS_Store' && !name.endsWith('.map') && !name.endsWith('.tsbuildinfo')
}

export function packagedPluginFilter(source, pluginRoot) {
  const relativePath = relative(pluginRoot, source)
  if (relativePath === '') return true
  const segments = relativePath.split(sep)
  if (segments.some(segment => excludedPluginDirectoryNames.has(segment))) return false
  const name = segments.at(-1) ?? ''
  return name !== '.DS_Store'
    && name !== 'tsconfig.json'
    && !name.endsWith('.map')
    && !name.endsWith('.tsbuildinfo')
}

export default async function afterPack(context) {
  const runtimeTarget = process.env.TELOS_RUNTIME_TARGET
  if (runtimeTarget === undefined || runtimeTarget.length === 0) {
    throw new Error('TELOS_RUNTIME_TARGET is required by the desktop afterPack hook')
  }

  const resourcesDirectory = context.packager.getResourcesDir(context.appOutDir)
  const dshRoot = join(repositoryRoot, '.local/desktop-runtime', runtimeTarget, 'dsh-runtime')
  const overlaysRoot = join(repositoryRoot, 'integrations/dsh/plugins')
  const nodeRoot = join(repositoryRoot, '.local/desktop-runtime', runtimeTarget, 'dsh-node')

  const copyPlugin = (source, destination) => {
    copyResource(source, destination, entry => packagedPluginFilter(entry, source))
  }

  copyResource(dshRoot, join(resourcesDirectory, 'dsh-runtime'), source => dshRuntimeFilter(source, dshRoot))
  copyPlugin(join(overlaysRoot, 'telos-ui-sidebar'), join(resourcesDirectory, 'dsh-overlays/telos-ui-sidebar'))
  copyPlugin(join(overlaysRoot, 'telos-ui-layout'), join(resourcesDirectory, 'dsh-overlays/telos-ui-layout'))
  copyPlugin(join(repositoryRoot, 'plugins/dsh-continuity'), join(resourcesDirectory, 'dsh-overlays/telos-continuity'))
  copyPlugin(join(repositoryRoot, 'plugins/dsh-mcp-manager'), join(resourcesDirectory, 'dsh-overlays/telos-mcp-manager'))
  copyPlugin(join(repositoryRoot, 'plugins/dsh-multimodal'), join(resourcesDirectory, 'dsh-overlays/telos-multimodal'))
  copyPlugin(join(repositoryRoot, 'plugins/dsh-workbench-files'), join(resourcesDirectory, 'dsh-overlays/telos-workbench-files'))
  copyPlugin(join(repositoryRoot, 'plugins/dsh-work-report'), join(resourcesDirectory, 'dsh-overlays/telos-work-report'))
  copyResource(nodeRoot, join(resourcesDirectory, 'dsh-node'))
}
