import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertRuntimeHasNoLinks, materializeRuntimeLinks } from './materialize-runtime-links.mjs'

const temporaryRoots = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'telos-runtime-links-'))
  temporaryRoots.push(root)
  return root
}

describe('materializeRuntimeLinks', () => {
  it('copies linked packages without recursively copying their dependency graph', () => {
    const root = fixtureRoot()
    const nodeModules = join(root, 'node_modules')
    const source = join(root, 'source-package')
    mkdirSync(join(source, 'node_modules'), { recursive: true })
    mkdirSync(nodeModules, { recursive: true })
    writeFileSync(join(source, 'index.js'), 'export const ready = true\n')
    writeFileSync(join(source, 'node_modules', 'ignored.js'), 'ignored\n')
    symlinkSync(source, join(nodeModules, 'runtime-package'), 'dir')

    materializeRuntimeLinks(nodeModules)

    expect(lstatSync(join(nodeModules, 'runtime-package')).isSymbolicLink()).toBe(false)
    expect(existsSync(join(nodeModules, 'runtime-package', 'index.js'))).toBe(true)
    expect(existsSync(join(nodeModules, 'runtime-package', 'node_modules'))).toBe(false)
    expect(() => assertRuntimeHasNoLinks(nodeModules)).not.toThrow()
  })

  it('removes generated bin links from the deployable closure', () => {
    const root = fixtureRoot()
    const nodeModules = join(root, 'node_modules')
    mkdirSync(join(nodeModules, '.bin'), { recursive: true })
    writeFileSync(join(root, 'tool.js'), 'console.log("tool")\n')
    symlinkSync(join(root, 'tool.js'), join(nodeModules, '.bin', 'tool'))

    materializeRuntimeLinks(nodeModules)

    expect(existsSync(join(nodeModules, '.bin'))).toBe(false)
    expect(() => assertRuntimeHasNoLinks(nodeModules)).not.toThrow()
  })
})
