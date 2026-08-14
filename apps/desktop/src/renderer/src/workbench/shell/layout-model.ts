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
