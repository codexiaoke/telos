import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TELOS_DSH_THEME_CSS, toTelosWindowTitle } from './dsh-brand.js'

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

  it('keeps the collapsed rail control below the macOS traffic lights', () => {
    expect(TELOS_DSH_THEME_CSS).toContain('--telos-sidebar-top-inset: 30px;')
    expect(TELOS_DSH_THEME_CSS).toContain('--telos-sidebar-rail-top-inset: 54px;')

    const sidebarBundle = readFileSync(
      resolve(repositoryRoot, 'integrations/dsh/plugins/telos-ui-sidebar/lib/client.js'),
      'utf8',
    )
    expect(sidebarBundle).toContain('var(--telos-sidebar-rail-top-inset,18px)')
  })
})
