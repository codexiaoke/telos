import { describe, expect, it } from 'vitest'
import { TELOS_DSH_THEME_CSS, toTelosWindowTitle } from './dsh-brand.js'

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
})
