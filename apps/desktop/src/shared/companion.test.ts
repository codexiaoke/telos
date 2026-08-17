import { describe, expect, it } from 'vitest'
import {
  COMPANION_SIZE_PERCENT_DEFAULT,
  COMPANION_SIZE_PERCENT_LEGACY_SMALL,
  companionWindowSize,
  normalizeCompanionAspectRatio,
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

  it('preserves the pet aspect ratio in the physical window boundary', () => {
    expect(companionWindowSize(100)).toEqual({ width: 320, height: 320 })
    expect(companionWindowSize(100, 512 / 1024)).toEqual({ width: 160, height: 320 })
    expect(companionWindowSize(150, 1024 / 512)).toEqual({ width: 480, height: 240 })
  })

  it('normalizes invalid and extreme intrinsic dimensions', () => {
    expect(normalizeCompanionAspectRatio(512, 1024)).toBe(0.5)
    expect(normalizeCompanionAspectRatio(0, 1024)).toBe(1)
    expect(normalizeCompanionAspectRatio(10_000, 1)).toBe(2)
  })
})
