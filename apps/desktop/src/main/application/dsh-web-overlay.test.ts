import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadTelosDshWebPatch, prepareTelosDshWebPatch } from './dsh-web-overlay.js'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('prepareTelosDshWebPatch', () => {
  it('disables only the upstream sidebar and inserts the Telos replacement', () => {
    const root = mkdtempSync(join(tmpdir(), 'telos-dsh-overlay-'))
    temporaryRoots.push(root)
    const sidebar = join(root, 'sidebar')
    mkdirSync(sidebar)
    writeFileSync(join(sidebar, 'telos.web.patch.yml'), [
      '- id: ui-sidebar',
      '  disabled: true',
      '- insert:',
      '    - id: telos-ui-sidebar',
      '      name: "@telos/dsh-client-ui-sidebar"',
      '',
    ].join('\n'))

    const patch = loadTelosDshWebPatch({
      sidebarPackageRoot: sidebar,
      layoutPackageRoot: '',
      continuityPackageRoot: '',
      mcpManagerPackageRoot: '',
      workbenchFilesPackageRoot: '',
    })
    expect(patch).toContain('- id: ui-sidebar\n  disabled: true')
    expect(patch).toContain('id: telos-ui-sidebar')
    expect(patch).toContain('name: "@telos/dsh-client-ui-sidebar"')
    expect(patch).not.toContain('ui-conversation')
  })

  it('installs the package into the writable profile dependency root', () => {
    const root = mkdtempSync(join(tmpdir(), 'telos-dsh-overlay-'))
    temporaryRoots.push(root)
    const sidebar = join(root, 'sidebar')
    const layout = join(root, 'layout')
    const continuity = join(root, 'continuity')
    const mcpManager = join(root, 'mcp-manager')
    const workbenchFiles = join(root, 'workbench-files')
    mkdirSync(join(sidebar, 'lib'), { recursive: true })
    mkdirSync(join(layout, 'lib'), { recursive: true })
    mkdirSync(join(continuity, 'lib'), { recursive: true })
    mkdirSync(join(mcpManager, 'lib'), { recursive: true })
    mkdirSync(join(workbenchFiles, 'lib'), { recursive: true })
    writeFileSync(join(sidebar, 'package.json'), JSON.stringify({
      name: '@telos/dsh-client-ui-sidebar',
      private: true,
    }))
    writeFileSync(join(sidebar, 'lib/client.js'), 'window.__TELOS_SIDEBAR_TEST__ = true')
    writeFileSync(join(sidebar, 'telos.web.patch.yml'), [
      '- id: ui-sidebar',
      '  disabled: true',
      '- insert:',
      '    - id: telos-ui-sidebar',
      '      name: "@telos/dsh-client-ui-sidebar"',
      '',
    ].join('\n'))
    writeFileSync(join(layout, 'package.json'), JSON.stringify({
      name: '@deepseek-ai/dsh-client-ui-layout',
      private: true,
    }))
    writeFileSync(join(layout, 'lib/client.js'), 'window.__TELOS_LAYOUT_TEST__ = true')
    writeFileSync(join(continuity, 'package.json'), JSON.stringify({
      name: '@telos/dsh-continuity',
      private: true,
    }))
    writeFileSync(join(continuity, 'lib/index.js'), 'export const name = "telos-continuity"')
    writeFileSync(join(continuity, 'lib/client.js'), 'window.__TELOS_CONTINUITY_TEST__ = true')
    writeFileSync(join(mcpManager, 'package.json'), JSON.stringify({
      name: '@telos/dsh-mcp-manager',
      private: true,
    }))
    writeFileSync(join(mcpManager, 'lib/index.js'), 'export const name = "telos-mcp-manager"')
    writeFileSync(join(mcpManager, 'lib/client.js'), 'window.__TELOS_MCP_MANAGER_TEST__ = true')
    writeFileSync(join(workbenchFiles, 'package.json'), JSON.stringify({
      name: '@telos/dsh-workbench-files',
      private: true,
    }))
    writeFileSync(join(workbenchFiles, 'lib/index.js'), 'export const name = "telos-workbench-files"')

    const path = prepareTelosDshWebPatch(join(root, 'home'), {
      sidebarPackageRoot: sidebar,
      layoutPackageRoot: layout,
      continuityPackageRoot: continuity,
      mcpManagerPackageRoot: mcpManager,
      workbenchFilesPackageRoot: workbenchFiles,
    })

    expect(readFileSync(path, 'utf8')).toContain('"@telos/dsh-client-ui-sidebar"')
    expect(existsSync(join(root, 'home/profiles/web/node_modules/@telos/dsh-client-ui-sidebar/lib/client.js')))
      .toBe(true)
    expect(existsSync(join(root, 'home/profiles/web/node_modules/@deepseek-ai/dsh-client-ui-layout/lib/client.js')))
      .toBe(true)
    expect(existsSync(join(root, 'home/profiles/web/node_modules/@telos/dsh-continuity/lib/index.js')))
      .toBe(true)
    expect(existsSync(join(root, 'home/profiles/web/node_modules/@telos/dsh-continuity/lib/client.js')))
      .toBe(true)
    expect(existsSync(join(root, 'home/profiles/web/node_modules/@telos/dsh-mcp-manager/lib/index.js')))
      .toBe(true)
    expect(existsSync(join(root, 'home/profiles/web/node_modules/@telos/dsh-mcp-manager/lib/client.js')))
      .toBe(true)
    expect(existsSync(join(root, 'home/profiles/web/node_modules/@telos/dsh-workbench-files/lib/index.js')))
      .toBe(true)
  })
})
