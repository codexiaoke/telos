import { describe, expect, it } from 'vitest'
import { MULTI_ROOT_WORKSPACE_CSS } from '../src/client/styles.js'

describe('multi-root workspace styles', () => {
  it('provides a bounded responsive modal instead of modifying DSH layout styles', () => {
    expect(MULTI_ROOT_WORKSPACE_CSS).toContain('.telosWorkspaceFlowBackdrop')
    expect(MULTI_ROOT_WORKSPACE_CSS).toContain('max-height:min(760px,calc(100vh - 48px))')
    expect(MULTI_ROOT_WORKSPACE_CSS).toContain('@media(max-width:640px)')
  })
})
