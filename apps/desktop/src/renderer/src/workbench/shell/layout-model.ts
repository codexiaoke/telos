import {
  EDITOR_CONVERSATION_DEFAULT,
  EDITOR_CONVERSATION_MAX,
  EDITOR_CONVERSATION_MIN,
  EDITOR_FILES_DEFAULT,
  EDITOR_FILES_MAX,
  EDITOR_FILES_MIN,
  validateEditorPanelPreferences,
  type EditorPanelPreferences,
} from '../../../../shared/workbench-preferences'

/**
 * Telos three-column geometry. The concession order remains compatible with
 * DSH ui-layout: preserve the sidebar, shrink details, close details, then let
 * the conversation absorb the remaining width.
 */

export interface WorkbenchColumns {
  sidebar: number
  center: number
  details: number
}

export interface EditorWorkbenchColumns {
  files: number
  editor: number
  conversation: number
}

export type { EditorPanelPreferences }
export {
  EDITOR_CONVERSATION_DEFAULT,
  EDITOR_CONVERSATION_MAX,
  EDITOR_CONVERSATION_MIN,
  EDITOR_FILES_DEFAULT,
  EDITOR_FILES_MAX,
  EDITOR_FILES_MIN,
} from '../../../../shared/workbench-preferences'

export const CENTER_MIN = 620
export const SIDEBAR_MIN = 264
export const SIDEBAR_MAX = 420
export const SIDEBAR_DEFAULT = 296
/** A closed sidebar yields the whole track to the workbench. Its reopen control
 * is owned by TelosAppFrame and floats inside the shared titlebar instead of
 * keeping a permanent navigation rail. */
export const SIDEBAR_COLLAPSED = 0
export const SIDEBAR_AUTO_COLLAPSE = 1_060
export const DETAILS_MIN = 300
export const DETAILS_MAX = 520
export const DETAILS_DEFAULT = 380
export const EDITOR_CENTER_MIN = 340

export function clampWidth(px: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(px)))
}

export function computeWorkbenchColumns(
  viewport: number,
  sidebar: number,
  details: number,
): WorkbenchColumns {
  const resolvedSidebar = sidebar === 0
    ? SIDEBAR_COLLAPSED
    : clampWidth(sidebar, SIDEBAR_MIN, SIDEBAR_MAX)
  const preferredDetails = details === 0
    ? 0
    : clampWidth(details, DETAILS_MIN, DETAILS_MAX)

  if (resolvedSidebar + preferredDetails + CENTER_MIN <= viewport) {
    return {
      sidebar: resolvedSidebar,
      center: viewport - resolvedSidebar - preferredDetails,
      details: preferredDetails,
    }
  }

  const concededDetails = preferredDetails === 0
    ? 0
    : Math.max(DETAILS_MIN, viewport - resolvedSidebar - CENTER_MIN)
  if (resolvedSidebar + concededDetails + CENTER_MIN <= viewport) {
    return {
      sidebar: resolvedSidebar,
      center: CENTER_MIN,
      details: concededDetails,
    }
  }

  return {
    sidebar: resolvedSidebar,
    center: Math.max(0, viewport - resolvedSidebar),
    details: 0,
  }
}

export function defaultEditorPanelPreferences(): EditorPanelPreferences {
  return {
    files: EDITOR_FILES_DEFAULT,
    conversation: EDITOR_CONVERSATION_DEFAULT,
  }
}

export function parseEditorPanelPreferences(serialized: string | null): EditorPanelPreferences {
  if (serialized === null) return defaultEditorPanelPreferences()

  try {
    return validateEditorPanelPreferences(JSON.parse(serialized)) ?? defaultEditorPanelPreferences()
  }
  catch {
    return defaultEditorPanelPreferences()
  }
}

/**
 * Resolve the editor workbench without letting either side panel consume the
 * editing surface. Preferences are reduced right-to-left when the window is
 * narrow, while the stored values remain untouched for a later wider window.
 */
export function computeEditorWorkbenchColumns(
  viewport: number,
  files: number,
  conversation: number,
): EditorWorkbenchColumns {
  let resolvedFiles = clampWidth(files, EDITOR_FILES_MIN, EDITOR_FILES_MAX)
  let resolvedConversation = clampWidth(
    conversation,
    EDITOR_CONVERSATION_MIN,
    EDITOR_CONVERSATION_MAX,
  )
  let overage = resolvedFiles + resolvedConversation + EDITOR_CENTER_MIN - viewport

  if (overage > 0) {
    const conversationConcession = Math.min(
      overage,
      resolvedConversation - EDITOR_CONVERSATION_MIN,
    )
    resolvedConversation -= conversationConcession
    overage -= conversationConcession
  }

  if (overage > 0) {
    const filesConcession = Math.min(overage, resolvedFiles - EDITOR_FILES_MIN)
    resolvedFiles -= filesConcession
  }

  return {
    files: resolvedFiles,
    editor: Math.max(0, viewport - resolvedFiles - resolvedConversation),
    conversation: resolvedConversation,
  }
}
