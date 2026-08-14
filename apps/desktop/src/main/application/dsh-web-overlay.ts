import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const PATCH_FILENAME = 'telos.web.patch.yml'
const PATCH_TEMPLATE_FILENAME = 'telos.web.patch.yml'

/** Read the tracked DSH patch that defines TELOS's complete allowed roster delta. */
export function loadTelosDshWebPatch(sidebarPackageRoot: string): string {
  return readFileSync(join(sidebarPackageRoot, PATCH_TEMPLATE_FILENAME), 'utf8')
}

/** Materialize the absolute-path overlay in TELOS-owned application data. */
export function prepareTelosDshWebPatch(dshHome: string, sidebarPackageRoot: string): string {
  const packageManifest = join(sidebarPackageRoot, 'package.json')
  const clientBundle = join(sidebarPackageRoot, 'lib/client.js')
  const patchTemplate = join(sidebarPackageRoot, PATCH_TEMPLATE_FILENAME)
  if (!existsSync(packageManifest) || !existsSync(clientBundle) || !existsSync(patchTemplate)) {
    throw new Error('TELOS DSH sidebar overlay is missing; run pnpm dsh:build')
  }

  const installedPackageRoot = join(dshHome, 'profiles/node_modules/@telos/dsh-client-ui-sidebar')
  rmSync(installedPackageRoot, { recursive: true, force: true })
  mkdirSync(dirname(installedPackageRoot), { recursive: true })
  cpSync(sidebarPackageRoot, installedPackageRoot, { recursive: true, force: true })

  mkdirSync(dshHome, { recursive: true })
  const path = join(dshHome, PATCH_FILENAME)
  const temporaryPath = `${path}.${String(process.pid)}.tmp`
  writeFileSync(temporaryPath, loadTelosDshWebPatch(sidebarPackageRoot), { mode: 0o600 })
  try {
    renameSync(temporaryPath, path)
  } catch {
    // Windows cannot atomically replace an existing destination.
    rmSync(path, { force: true })
    renameSync(temporaryPath, path)
  }
  return path
}
