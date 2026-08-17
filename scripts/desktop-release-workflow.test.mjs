import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')

describe('desktop release publication', () => {
  it('publishes stable tag builds instead of leaving updater-invisible drafts', () => {
    const workflow = readFileSync(resolve(root, '.github/workflows/desktop-release.yml'), 'utf8')
    const builder = readFileSync(resolve(root, 'apps/desktop/electron-builder.yml'), 'utf8')

    expect(builder).toContain('releaseType: release')
    expect(workflow).toContain('release_args=(--generate-notes --title "Telos $RELEASE_TAG")')
    expect(workflow).toContain('gh release create "$RELEASE_TAG" "${release_args[@]}"')
    expect(workflow).toContain('gh release edit "$RELEASE_TAG" --draft=false')
    expect(workflow).not.toContain('gh release create "$RELEASE_TAG" --draft')
  })

  it('prefers Developer ID signed and notarized macOS artifacts when credentials exist', () => {
    const workflow = readFileSync(resolve(root, '.github/workflows/desktop-release.yml'), 'utf8')
    const builder = readFileSync(resolve(root, 'apps/desktop/electron-builder.yml'), 'utf8')

    expect(builder).not.toContain('identity: null')
    expect(builder).toContain('hardenedRuntime: true')
    expect(builder).toContain('entitlements: build/entitlements.mac.plist')
    expect(builder).toContain('entitlementsInherit: build/entitlements.mac.plist')
    expect(builder).toContain('notarize: true')
    expect(builder).toContain('sign: true')

    for (const secret of [
      'MAC_CSC_LINK',
      'MAC_CSC_KEY_PASSWORD',
      'APPLE_ID',
      'APPLE_APP_SPECIFIC_PASSWORD',
      'APPLE_TEAM_ID',
    ]) {
      expect(workflow).toContain(`secrets.${secret}`)
    }
    expect(workflow).toContain('codesign --verify --deep --strict')
    expect(workflow).toContain('xcrun stapler validate')
    expect(workflow).toContain('xattr -w com.apple.quarantine')
    expect(workflow).toContain('spctl --assess --type execute')
  })

  it('publishes verified ad-hoc macOS packages when Developer ID is unavailable', () => {
    const workflow = readFileSync(resolve(root, '.github/workflows/desktop-release.yml'), 'utf8')

    expect(workflow).toContain("runner.os == 'macOS' && steps.mac-signing.outputs.mode == 'ad-hoc'")
    expect(workflow).toContain('--config.mac.identity=-')
    expect(workflow).toContain('--config.mac.notarize=false')
    expect(workflow).toContain('--config.dmg.sign=false')
    expect(workflow).toContain('Signature=adhoc')
    expect(workflow).toContain('xattr -dr com.apple.quarantine /Applications/Telos.app')
    expect(workflow).not.toContain('Unsigned or unnotarized macOS artifacts will not be published.')
  })
})
