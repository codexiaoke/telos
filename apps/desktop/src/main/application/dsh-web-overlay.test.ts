import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { prepareTelosDshWebPatch, renderTelosDshWebPatch } from './dsh-web-overlay.js'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('renderTelosDshWebPatch', () => {
  it('disables only the upstream sidebar and inserts the TELOS replacement', () => {
    const patch = renderTelosDshWebPatch()
    expect(patch).toContain('- id: ui-sidebar\n  disabled: true')
    expect(patch).toContain('id: telos-ui-sidebar')
    expect(patch).toContain('name: "@telos/dsh-client-ui-sidebar"')
    expect(patch).not.toContain('ui-conversation')
  })

  it('installs the package into the writable profile dependency root', () => {
    const root = mkdtempSync(join(tmpdir(), 'telos-dsh-overlay-'))
    temporaryRoots.push(root)
    const source = join(root, 'source')
    mkdirSync(join(source, 'lib'), { recursive: true })
    writeFileSync(join(source, 'package.json'), '{}')
    writeFileSync(join(source, 'lib/client.js'), 'window.__TELOS_TEST__ = true')

    const path = prepareTelosDshWebPatch(join(root, 'home'), source)

    expect(readFileSync(path, 'utf8')).toContain('"@telos/dsh-client-ui-sidebar"')
    expect(existsSync(join(root, 'home/profiles/node_modules/@telos/dsh-client-ui-sidebar/lib/client.js')))
      .toBe(true)
  })
})
