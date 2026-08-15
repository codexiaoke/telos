import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bumpReleaseVersion } from './bump-release.mjs'

const temporaryRoots = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'telos-release-version-'))
  temporaryRoots.push(root)
  mkdirSync(join(root, 'apps/desktop'), { recursive: true })
  writeFileSync(join(root, 'package.json'), '{"name":"telos","version":"0.1.0"}\n')
  writeFileSync(join(root, 'apps/desktop/package.json'), '{"name":"@telos/desktop","version":"0.1.0"}\n')
  return root
}

describe('bumpReleaseVersion', () => {
  it('keeps the product and packaged application on one version', () => {
    const root = fixtureRoot()

    bumpReleaseVersion(root, '0.2.0')

    expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version).toBe('0.2.0')
    expect(JSON.parse(readFileSync(join(root, 'apps/desktop/package.json'), 'utf8')).version).toBe('0.2.0')
  })

  it('rejects incomplete or build-metadata release versions', () => {
    const root = fixtureRoot()

    expect(() => bumpReleaseVersion(root, '0.2')).toThrow('semantic')
    expect(() => bumpReleaseVersion(root, '0.2.0+local')).toThrow('semantic')
  })
})
