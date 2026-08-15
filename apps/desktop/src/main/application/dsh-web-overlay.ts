import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const PATCH_FILENAME = 'telos.web.patch.yml'
const PATCH_TEMPLATE_FILENAME = 'telos.web.patch.yml'
const WEB_PROFILE_NAME = 'web'
const DSH_LAYOUT_PACKAGE = '@deepseek-ai/dsh-client-ui-layout'
const TELOS_SIDEBAR_PACKAGE = '@telos/dsh-client-ui-sidebar'
const TELOS_CONTINUITY_PACKAGE = '@telos/dsh-continuity'
const TELOS_MCP_MANAGER_PACKAGE = '@telos/dsh-mcp-manager'

export interface TelosDshWebOverlaySources {
  sidebarPackageRoot: string
  layoutPackageRoot: string
  continuityPackageRoot: string
  mcpManagerPackageRoot: string
}

/** Read the tracked DSH patch that defines Telos's complete allowed roster delta. */
export function loadTelosDshWebPatch(sources: TelosDshWebOverlaySources): string {
  return readFileSync(join(sources.sidebarPackageRoot, PATCH_TEMPLATE_FILENAME), 'utf8')
}

function installProfilePackage(
  dshHome: string,
  sourceRoot: string,
  expectedPackageName: string,
  expectedArtifacts: readonly string[],
): void {
  const packageManifest = join(sourceRoot, 'package.json')
  if (!existsSync(packageManifest) || expectedArtifacts.some(artifact => !existsSync(join(sourceRoot, artifact)))) {
    throw new Error(`Telos DSH package ${expectedPackageName} is missing; run pnpm dsh:build`)
  }
  const manifest = JSON.parse(readFileSync(packageManifest, 'utf8')) as { name?: unknown; private?: unknown }
  if (manifest.name !== expectedPackageName || manifest.private !== true) {
    throw new Error(`Telos DSH package must be private and named ${expectedPackageName}`)
  }

  // The flat profiles/node_modules directory is healed by DSH and reserves
  // upstream package symlinks. Profile-specific node_modules precedes it in
  // Node resolution and is the supported seat for Telos compatibility input.
  const installedPackageRoot = join(
    dshHome,
    'profiles',
    WEB_PROFILE_NAME,
    'node_modules',
    ...expectedPackageName.split('/'),
  )
  rmSync(installedPackageRoot, { recursive: true, force: true })
  mkdirSync(dirname(installedPackageRoot), { recursive: true })
  cpSync(sourceRoot, installedPackageRoot, { recursive: true, force: true })
}

function removeLegacyFlatPackage(dshHome: string, expectedPackageName: string): void {
  const legacyRoot = join(dshHome, 'profiles/node_modules', ...expectedPackageName.split('/'))
  if (!existsSync(legacyRoot) || lstatSync(legacyRoot).isSymbolicLink()) return
  const manifestPath = join(legacyRoot, 'package.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`Refusing to remove unrecognized DSH profile package at ${legacyRoot}`)
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    name?: unknown
    private?: unknown
    telos?: { compatibilityDerivative?: unknown }
  }
  const owned = manifest.name === expectedPackageName
    && manifest.private === true
    && (expectedPackageName.startsWith('@telos/') || manifest.telos?.compatibilityDerivative === true)
  if (!owned) throw new Error(`Refusing to remove non-Telos DSH profile package at ${legacyRoot}`)
  rmSync(legacyRoot, { recursive: true, force: true })
}

/** Materialize Telos packages and the absolute patch in application data. */
export function prepareTelosDshWebPatch(
  dshHome: string,
  sources: TelosDshWebOverlaySources,
): string {
  const patchTemplate = join(sources.sidebarPackageRoot, PATCH_TEMPLATE_FILENAME)
  if (!existsSync(patchTemplate)) {
    throw new Error('Telos DSH sidebar overlay is missing; run pnpm dsh:build')
  }

  removeLegacyFlatPackage(dshHome, TELOS_SIDEBAR_PACKAGE)
  removeLegacyFlatPackage(dshHome, DSH_LAYOUT_PACKAGE)
  removeLegacyFlatPackage(dshHome, TELOS_CONTINUITY_PACKAGE)
  removeLegacyFlatPackage(dshHome, TELOS_MCP_MANAGER_PACKAGE)
  installProfilePackage(dshHome, sources.sidebarPackageRoot, TELOS_SIDEBAR_PACKAGE, ['lib/client.js'])
  installProfilePackage(dshHome, sources.layoutPackageRoot, DSH_LAYOUT_PACKAGE, ['lib/client.js'])
  installProfilePackage(dshHome, sources.continuityPackageRoot, TELOS_CONTINUITY_PACKAGE, ['lib/index.js', 'lib/client.js'])
  installProfilePackage(dshHome, sources.mcpManagerPackageRoot, TELOS_MCP_MANAGER_PACKAGE, ['lib/index.js', 'lib/client.js'])

  mkdirSync(dshHome, { recursive: true })
  const path = join(dshHome, PATCH_FILENAME)
  const temporaryPath = `${path}.${String(process.pid)}.tmp`
  writeFileSync(temporaryPath, loadTelosDshWebPatch(sources), { mode: 0o600 })
  try {
    renameSync(temporaryPath, path)
  } catch {
    // Windows cannot atomically replace an existing destination.
    rmSync(path, { force: true })
    renameSync(temporaryPath, path)
  }
  return path
}
