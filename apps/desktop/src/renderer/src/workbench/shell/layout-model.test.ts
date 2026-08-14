import { describe, expect, it } from 'vitest'
import {
  CENTER_MIN,
  computeWorkbenchColumns,
  DETAILS_MAX,
  DETAILS_MIN,
  SIDEBAR_COLLAPSED,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
} from './layout-model'

describe('computeWorkbenchColumns', () => {
  it('preserves preferred widths when all columns fit', () => {
    expect(computeWorkbenchColumns(1_500, 296, 380)).toEqual({
      sidebar: 296,
      center: 824,
      details: 380,
    })
  })

  it('shrinks details before taking width from the center', () => {
    expect(computeWorkbenchColumns(1_240, 296, DETAILS_MAX)).toEqual({
      sidebar: 296,
      center: CENTER_MIN,
      details: 324,
    })
  })

  it('closes details when even its minimum no longer fits', () => {
    expect(computeWorkbenchColumns(1_180, 296, DETAILS_MIN)).toEqual({
      sidebar: 296,
      center: 884,
      details: 0,
    })
  })

  it('keeps the compact sidebar rail when its preference is closed', () => {
    expect(computeWorkbenchColumns(900, 0, 0)).toEqual({
      sidebar: SIDEBAR_COLLAPSED,
      center: 900 - SIDEBAR_COLLAPSED,
      details: 0,
    })
  })

  it('clamps stale preferences at the compatibility boundary', () => {
    expect(computeWorkbenchColumns(1_600, 999, 999)).toEqual({
      sidebar: SIDEBAR_MAX,
      center: 1_600 - SIDEBAR_MAX - DETAILS_MAX,
      details: DETAILS_MAX,
    })
    expect(computeWorkbenchColumns(1_600, 1, 1)).toEqual({
      sidebar: SIDEBAR_MIN,
      center: 1_600 - SIDEBAR_MIN - DETAILS_MIN,
      details: DETAILS_MIN,
    })
  })
})
