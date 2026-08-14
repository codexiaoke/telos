import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createTelosDshThemeCss, TELOS_DSH_THEME_CSS, toTelosWindowTitle } from './dsh-brand.js'

const repositoryRoot = resolve(__dirname, '../../../../..')

describe('toTelosWindowTitle', () => {
  it('replaces only the DSH product identity', () => {
    expect(toTelosWindowTitle('DeepSeek Harness')).toBe('TELOS')
    expect(toTelosWindowTitle('A durable session — DeepSeek Harness')).toBe('A durable session — TELOS')
    expect(toTelosWindowTitle('Settings')).toBe('Settings')
  })
})

describe('TELOS_DSH_THEME_CSS', () => {
  it('stays on the upstream token surface for both palettes', () => {
    expect(TELOS_DSH_THEME_CSS).toContain('body[data-ds-dark-theme]')
    expect(TELOS_DSH_THEME_CSS).toContain('--dsw-alias-bg-base')
    expect(TELOS_DSH_THEME_CSS).not.toMatch(/\.(?:frame|sidebar|composer|message)[\s,{:#.]/i)
  })

  it('shares one productive titlebar row with macOS controls', () => {
    const css = createTelosDshThemeCss('darwin')
    expect(css).not.toContain('padding-top:')
    expect(css).toContain('--telos-titlebar-height: 52px;')
    expect(css).toContain('--telos-titlebar-left-safe: 88px;')
    expect(css).toContain('--telos-titlebar-right-safe: 0px;')
    expect(css).toContain('--telos-sidebar-top-inset: 0px;')
    expect(TELOS_DSH_THEME_CSS).toContain('--telos-sidebar-rail-top-inset: 18px;')

    const sidebarBundle = readFileSync(
      resolve(repositoryRoot, 'integrations/dsh/plugins/telos-ui-sidebar/lib/client.js'),
      'utf8',
    )
    expect(sidebarBundle).toContain('var(--telos-titlebar-left-safe,16px)')
  })

  it('reserves only the top-right native caption rectangle on Windows', () => {
    const css = createTelosDshThemeCss('win32')
    expect(css).toContain('--telos-titlebar-left-safe: 12px;')
    expect(css).toContain('--telos-titlebar-right-safe: 138px;')
  })

  it('keeps sidebar titlebar controls out of the drag region', () => {
    const sidebarBundle = readFileSync(
      resolve(repositoryRoot, 'integrations/dsh/plugins/telos-ui-sidebar/lib/client.js'),
      'utf8',
    )
    expect(sidebarBundle).toContain('-webkit-app-region:drag')
    expect(sidebarBundle).toContain('-webkit-app-region:no-drag')
  })
})
