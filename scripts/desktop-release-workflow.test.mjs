import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')

describe('desktop release publication', () => {
  it('publishes stable tag builds instead of leaving updater-invisible drafts', () => {
    const workflow = readFileSync(resolve(root, '.github/workflows/desktop-release.yml'), 'utf8')
    const builder = readFileSync(resolve(root, 'apps/desktop/electron-builder.yml'), 'utf8')

    expect(builder).toContain('releaseType: release')
    expect(workflow).toContain('gh release create "$RELEASE_TAG" --generate-notes')
    expect(workflow).toContain('gh release edit "$RELEASE_TAG" --draft=false')
    expect(workflow).not.toContain('gh release create "$RELEASE_TAG" --draft')
  })
})
