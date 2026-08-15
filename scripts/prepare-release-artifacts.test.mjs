import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import { prepareReleaseArtifacts } from './prepare-release-artifacts.mjs'

const temporaryRoots = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'telos-release-artifacts-'))
  temporaryRoots.push(root)
  return root
}

function writeMetadata(path, arch, sha512) {
  writeFileSync(path, stringify({
    version: '0.2.0',
    files: [
      { url: `Telos-0.2.0-mac-${arch}.zip`, sha512, size: 10 },
      { url: `Telos-0.2.0-mac-${arch}.dmg`, sha512: `${sha512}-dmg`, size: 20 },
    ],
    path: `Telos-0.2.0-mac-${arch}.zip`,
    sha512,
    releaseDate: arch === 'arm64' ? '2026-08-15T00:00:00.000Z' : '2026-08-15T00:01:00.000Z',
  }))
}

describe('prepareReleaseArtifacts', () => {
  it('flattens installers and merges architecture-specific update metadata', () => {
    const root = fixtureRoot()
    const input = join(root, 'downloaded')
    const output = join(root, 'release')
    const arm64 = join(input, 'macos-arm64')
    const x64 = join(input, 'macos-x64')
    mkdirSync(arm64, { recursive: true })
    mkdirSync(x64, { recursive: true })
    writeFileSync(join(arm64, 'Telos-0.2.0-mac-arm64.zip'), 'arm64')
    writeFileSync(join(x64, 'Telos-0.2.0-mac-x64.zip'), 'x64')
    writeFileSync(join(x64, 'Telos-0.2.0-x64.nsis.7z'), 'windows-web-payload')
    writeMetadata(join(arm64, 'latest-mac.yml'), 'arm64', 'arm64-sha')
    writeMetadata(join(x64, 'latest-mac.yml'), 'x64', 'x64-sha')

    prepareReleaseArtifacts(input, output)

    expect(readFileSync(join(output, 'Telos-0.2.0-mac-arm64.zip'), 'utf8')).toBe('arm64')
    expect(readFileSync(join(output, 'Telos-0.2.0-mac-x64.zip'), 'utf8')).toBe('x64')
    expect(readFileSync(join(output, 'Telos-0.2.0-x64.nsis.7z'), 'utf8')).toBe('windows-web-payload')
    const metadata = parse(readFileSync(join(output, 'latest-mac.yml'), 'utf8'))
    expect(metadata.version).toBe('0.2.0')
    expect(metadata.files.map(file => file.url)).toEqual([
      'Telos-0.2.0-mac-arm64.dmg',
      'Telos-0.2.0-mac-arm64.zip',
      'Telos-0.2.0-mac-x64.dmg',
      'Telos-0.2.0-mac-x64.zip',
    ])
    expect(metadata.releaseDate).toBe('2026-08-15T00:01:00.000Z')
  })

  it('rejects metadata from different product versions', () => {
    const root = fixtureRoot()
    const input = join(root, 'downloaded')
    const output = join(root, 'release')
    const first = join(input, 'first')
    const second = join(input, 'second')
    mkdirSync(first, { recursive: true })
    mkdirSync(second, { recursive: true })
    writeMetadata(join(first, 'latest-mac.yml'), 'arm64', 'arm64-sha')
    const incompatible = parse(readFileSync(join(first, 'latest-mac.yml'), 'utf8'))
    incompatible.version = '0.3.0'
    writeFileSync(join(second, 'latest-mac.yml'), stringify(incompatible))

    expect(() => prepareReleaseArtifacts(input, output)).toThrow('different versions')
  })
})
