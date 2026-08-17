import { describe, expect, it } from 'vitest'
import { COMPANION_CLIENT_CSS } from '../src/client/styles.js'

describe('companion Settings styles', () => {
  it('uses DSH theme tokens and visible focus treatment', () => {
    expect(COMPANION_CLIENT_CSS).toContain('var(--dsw-alias-bg-layer-1)')
    expect(COMPANION_CLIENT_CSS).toContain('var(--dsw-alias-label-primary)')
    expect(COMPANION_CLIENT_CSS).toContain('button:focus-visible')
  })
})
