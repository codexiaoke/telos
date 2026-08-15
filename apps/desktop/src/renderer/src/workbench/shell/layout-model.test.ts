import { describe, expect, it } from 'vitest'
import {
  CENTER_MIN,
  computeEditorWorkbenchColumns,
  computeWorkbenchColumns,
  DETAILS_MAX,
  DETAILS_MIN,
  EDITOR_CENTER_MIN,
  EDITOR_CONVERSATION_DEFAULT,
  EDITOR_CONVERSATION_MAX,
  EDITOR_CONVERSATION_MIN,
  EDITOR_FILES_DEFAULT,
  EDITOR_FILES_MAX,
  EDITOR_FILES_MIN,
  parseEditorPanelPreferences,
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

  it('returns the whole viewport to the workbench when the sidebar is closed', () => {
    expect(computeWorkbenchColumns(900, 0, 0)).toEqual({
      sidebar: SIDEBAR_COLLAPSED,
      center: 900,
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

describe('computeEditorWorkbenchColumns', () => {
  it('preserves the preferred file and conversation widths when they fit', () => {
    expect(computeEditorWorkbenchColumns(1_400, 300, 460)).toEqual({
      files: 300,
      editor: 640,
      conversation: 460,
    })
  })

  it('protects the editor by shrinking conversation and then files', () => {
    expect(computeEditorWorkbenchColumns(900, 300, 500)).toEqual({
      files: 260,
      editor: EDITOR_CENTER_MIN,
      conversation: EDITOR_CONVERSATION_MIN,
    })
  })

  it('clamps stale panel preferences', () => {
    expect(computeEditorWorkbenchColumns(2_000, 1, 9_999)).toEqual({
      files: EDITOR_FILES_MIN,
      editor: 2_000 - EDITOR_FILES_MIN - EDITOR_CONVERSATION_MAX,
      conversation: EDITOR_CONVERSATION_MAX,
    })
  })
})

describe('parseEditorPanelPreferences', () => {
  it('recovers defaults from missing or malformed storage', () => {
    expect(parseEditorPanelPreferences(null)).toEqual({
      files: EDITOR_FILES_DEFAULT,
      conversation: EDITOR_CONVERSATION_DEFAULT,
    })
    expect(parseEditorPanelPreferences('{broken')).toEqual({
      files: EDITOR_FILES_DEFAULT,
      conversation: EDITOR_CONVERSATION_DEFAULT,
    })
  })

  it('accepts finite widths and clamps them to supported bounds', () => {
    expect(parseEditorPanelPreferences('{"files":999,"conversation":1}')).toEqual({
      files: EDITOR_FILES_MAX,
      conversation: EDITOR_CONVERSATION_MIN,
    })
  })
})
