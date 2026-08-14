import { describe, expect, it } from 'vitest'
import { TELOS_LAYOUT_CSS } from './layout-styles'

describe('TELOS_LAYOUT_CSS', () => {
  it('does not trap sidebar-owned fixed dialogs below sibling columns', () => {
    const columnRule = TELOS_LAYOUT_CSS.match(
      /\.telos-workbench-sidebar,\s*\.telos-workbench-center,\s*\.telos-workbench-details\s*\{(?<body>[^}]*)\}/,
    )

    expect(columnRule?.groups?.body).toBeDefined()
    expect(columnRule?.groups?.body).not.toContain('z-index')
  })

  it('keeps TELOS shell overlays above the column content', () => {
    expect(TELOS_LAYOUT_CSS).toMatch(
      /\.telos-workbench-overlay\s*\{[^}]*z-index:\s*20;/,
    )
  })

  it('uses the stable DSH session-header slot as the draggable titlebar', () => {
    expect(TELOS_LAYOUT_CSS).toContain("[data-slot='conversation.session.header'] > header")
    expect(TELOS_LAYOUT_CSS).toContain('-webkit-app-region: drag;')
    expect(TELOS_LAYOUT_CSS).toContain('-webkit-app-region: no-drag;')
  })

  it('fully hides the closed sidebar and exposes a frame-owned reopen control', () => {
    expect(TELOS_LAYOUT_CSS).toContain('[data-sidebar-collapsed] .telos-workbench-sidebar')
    expect(TELOS_LAYOUT_CSS).toContain('visibility: hidden;')
    expect(TELOS_LAYOUT_CSS).toContain('.telos-sidebar-reopen')
  })

  it('re-seats the workspace toolbar through its stable slot anchor', () => {
    expect(TELOS_LAYOUT_CSS).toContain("[data-slot='sidebar.workspaces'] > div > div:first-child")
    expect(TELOS_LAYOUT_CSS).toContain('-webkit-app-region: no-drag;')
    expect(TELOS_LAYOUT_CSS).toMatch(/button:last-of-type\s*\{\s*display: none;/)
    expect(TELOS_LAYOUT_CSS).toContain('div:first-of-type > button:last-of-type')
  })
})
