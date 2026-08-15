import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { packagedPluginFilter } from './after-pack.mjs'

describe('packagedPluginFilter', () => {
  const root = join('repository', 'plugins', 'telos-plugin')

  it('keeps runtime plugin files', () => {
    expect(packagedPluginFilter(root, root)).toBe(true)
    expect(packagedPluginFilter(join(root, 'package.json'), root)).toBe(true)
    expect(packagedPluginFilter(join(root, 'lib', 'index.js'), root)).toBe(true)
    expect(packagedPluginFilter(join(root, 'telos.web.patch.yml'), root)).toBe(true)
  })

  it('removes development trees and generated metadata', () => {
    expect(packagedPluginFilter(join(root, 'node_modules', 'react'), root)).toBe(false)
    expect(packagedPluginFilter(join(root, 'src', 'index.ts'), root)).toBe(false)
    expect(packagedPluginFilter(join(root, 'test', 'plugin.test.ts'), root)).toBe(false)
    expect(packagedPluginFilter(join(root, 'tsconfig.json'), root)).toBe(false)
    expect(packagedPluginFilter(join(root, 'lib', 'index.js.map'), root)).toBe(false)
  })
})
