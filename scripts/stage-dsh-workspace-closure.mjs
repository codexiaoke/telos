import { cpSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'

const packageAreaNames = new Set(['apps', 'native', 'packages', 'vendor'])
const excludedPackageDirectories = new Set(['.git', '.codegraph', 'coverage', 'node_modules'])

function discoverManifests(directory, manifests) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (excludedPackageDirectories.has(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      discoverManifests(path, manifests)
      continue
    }
    if (!entry.isFile() || entry.name !== 'package.json') continue
    const manifest = JSON.parse(readFileSync(path, 'utf8'))
    if (typeof manifest.name === 'string') manifests.set(manifest.name, { manifest, root: dirname(path) })
  }
}

export function discoverDshWorkspacePackages(dshRoot) {
  const manifests = new Map()
  for (const entry of readdirSync(dshRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && packageAreaNames.has(entry.name)) {
      discoverManifests(join(dshRoot, entry.name), manifests)
    }
  }
  return manifests
}

function runtimeWorkspaceDependencies(manifest, workspacePackages) {
  const dependencies = new Set()
  for (const kind of ['dependencies', 'optionalDependencies']) {
    for (const name of Object.keys(manifest[kind] ?? {})) {
      if (workspacePackages.has(name)) dependencies.add(name)
    }
  }
  for (const name of Object.keys(manifest.peerDependencies ?? {})) {
    if (manifest.peerDependenciesMeta?.[name]?.optional === true) continue
    if (workspacePackages.has(name)) dependencies.add(name)
  }
  return [...dependencies].sort()
}

export function dshWorkspaceRuntimeClosure(rootPackageName, workspacePackages) {
  if (!workspacePackages.has(rootPackageName)) throw new Error(`Unknown DSH runtime root package: ${rootPackageName}`)
  const closure = new Set()
  const queue = [rootPackageName]
  while (queue.length > 0) {
    const name = queue.shift()
    if (closure.has(name)) continue
    closure.add(name)
    const current = workspacePackages.get(name)
    for (const dependency of runtimeWorkspaceDependencies(current.manifest, workspacePackages)) {
      if (!closure.has(dependency)) queue.push(dependency)
    }
  }
  return [...closure].sort()
}

function copyWorkspacePackage(source, destination) {
  cpSync(source, destination, {
    recursive: true,
    dereference: true,
    filter: path => {
      const relativePath = relative(source, path)
      const firstSegment = relativePath.split(sep)[0]
      return !excludedPackageDirectories.has(firstSegment)
    },
  })
}

export function restoreDshWorkspaceClosure(dshRoot, deployRoot, rootPackageName = '@deepseek-ai/dsh') {
  const workspacePackages = discoverDshWorkspacePackages(dshRoot)
  const closure = dshWorkspaceRuntimeClosure(rootPackageName, workspacePackages)
  const restored = []
  for (const name of closure) {
    if (name === rootPackageName) continue
    const destination = join(deployRoot, 'node_modules', ...name.split('/'))
    if (existsSync(destination)) continue
    copyWorkspacePackage(workspacePackages.get(name).root, destination)
    restored.push(name)
  }
  return { closure, restored }
}
