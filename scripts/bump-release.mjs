import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')
const versionedManifests = ['package.json', 'apps/desktop/package.json']
const releaseVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/

export function bumpReleaseVersion(root, version) {
  if (!releaseVersionPattern.test(version)) {
    throw new Error(`Release version must be semantic x.y.z or x.y.z-prerelease; received ${version}`)
  }

  for (const relativePath of versionedManifests) {
    const path = resolve(root, relativePath)
    const manifest = JSON.parse(readFileSync(path, 'utf8'))
    manifest.version = version
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`)
  }
}

function main() {
  const version = process.argv[2]
  if (version === undefined) {
    throw new Error('Usage: pnpm release:bump <x.y.z>')
  }

  bumpReleaseVersion(repositoryRoot, version)
  execFileSync(process.execPath, [resolve(repositoryRoot, 'scripts/build-telos-dsh-overlays.mjs')], {
    cwd: repositoryRoot,
    stdio: 'inherit',
  })
  process.stdout.write(`Prepared Telos release version ${version}.\n`)
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
