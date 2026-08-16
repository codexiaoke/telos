import { describe, expect, it } from 'vitest'
import { PERSONALIZATION_STYLES } from '../src/client/styles.js'

describe('personalization Client styles', () => {
  it('uses DSH theme tokens and includes accessible focus treatment', () => {
    expect(PERSONALIZATION_STYLES).toContain('var(--dsw-alias-bg-layer-1)')
    expect(PERSONALIZATION_STYLES).toContain('var(--dsw-alias-label-primary)')
    expect(PERSONALIZATION_STYLES).toContain('textarea:focus')
  })
})
