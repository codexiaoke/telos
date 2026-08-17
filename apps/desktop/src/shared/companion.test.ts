import { describe, expect, it } from 'vitest'
import {
  COMPANION_SIZE_PERCENT_DEFAULT,
  COMPANION_SIZE_PERCENT_LEGACY_SMALL,
  companionWindowSize,
  normalizeCompanionSizePercent,
} from './companion.js'

describe('companion size percentage', () => {
  it('keeps persisted percentages inside the supported range', () => {
    expect(normalizeCompanionSizePercent(85)).toBe(85)
    expect(normalizeCompanionSizePercent(20)).toBe(50)
    expect(normalizeCompanionSizePercent(180)).toBe(150)
  })

  it('migrates legacy size choices without losing their intent', () => {
    expect(normalizeCompanionSizePercent(undefined, 'small')).toBe(COMPANION_SIZE_PERCENT_LEGACY_SMALL)
    expect(normalizeCompanionSizePercent(undefined, 'large')).toBe(COMPANION_SIZE_PERCENT_DEFAULT)
  })

  it('reports the compact physical window boundary', () => {
    expect(companionWindowSize(100)).toEqual({ width: 300, height: 320 })
    expect(companionWindowSize(150)).toEqual({ width: 450, height: 480 })
  })
})
