import { describe, expect, it } from 'vitest'
import { TELOS_LAYOUT_CSS } from './layout-styles'

describe('TELOS_LAYOUT_CSS', () => {
  it('lets the Settings panel use up to 88 percent of the viewport', () => {
    expect(TELOS_LAYOUT_CSS).toMatch(
      /\[data-slot='sidebar\.settings'\][^{]*{\s*width:\s*88vw;\s*max-width:\s*88vw;/,
    )
  })

  it('lets every Settings section fill the widened content column', () => {
    expect(TELOS_LAYOUT_CSS).toContain("[data-slot='settings.section'] > *")
    expect(TELOS_LAYOUT_CSS).toContain("[data-slot='settings.plugins.tab'] > *")
    expect(TELOS_LAYOUT_CSS).toMatch(/width:\s*100%;\s*max-width:\s*none;/)
  })

  it('does not trap sidebar-owned fixed dialogs below sibling columns', () => {
    const columnRule = TELOS_LAYOUT_CSS.match(
      /\.telos-workbench-sidebar,\s*\.telos-workbench-center,\s*\.telos-workbench-details\s*\{(?<body>[^}]*)\}/,
    )

    expect(columnRule?.groups?.body).toBeDefined()
    expect(columnRule?.groups?.body).not.toContain('z-index')
  })

  it('keeps Telos shell overlays above the column content', () => {
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

  it('promotes the expanded session search into a centered modal surface', () => {
    expect(TELOS_LAYOUT_CSS).toContain("button[aria-expanded='true']")
    expect(TELOS_LAYOUT_CSS).toContain('width: min(640px, calc(100vw - 64px));')
    expect(TELOS_LAYOUT_CSS).toMatch(/::after\s*\{[^}]*z-index:\s*99;/)
    expect(TELOS_LAYOUT_CSS).toContain('background: rgb(0 0 0 / 48%);')
    expect(TELOS_LAYOUT_CSS).toContain('@keyframes telos-search-dialog-in')
  })

  it('hides optional content-search status messages inside the modal', () => {
    expect(TELOS_LAYOUT_CSS).toMatch(
      /div:nth-of-type\(2\) \[role='status'\]\s*\{\s*display: none;/,
    )
  })

  it('keeps a non-interactive session-list snapshot behind the search dialog', () => {
    expect(TELOS_LAYOUT_CSS).toContain('[data-telos-search-sidebar-snapshot]')
    expect(TELOS_LAYOUT_CSS).toContain('pointer-events: none;')
  })
})
