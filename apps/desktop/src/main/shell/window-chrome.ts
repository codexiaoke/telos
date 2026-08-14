/** Productive macOS titlebar row shared by native traffic lights and Web UI. */
export const TELOS_TITLE_BAR_HEIGHT = 52
/** The compact native caption overlay used by Windows and Linux. */
export const TELOS_CAPTION_OVERLAY_HEIGHT = 30
/** Width kept clear for the Windows/Linux native caption buttons. */
export const TELOS_CAPTION_CONTROLS_WIDTH = 138
/** First interactive x-coordinate after the macOS traffic lights. */
export const TELOS_MAC_TITLEBAR_LEFT_SAFE = 88

export interface WindowChromeOptions {
  titleBarStyle: 'hidden' | 'hiddenInset'
  trafficLightPosition?: { x: number; y: number }
  titleBarOverlay?: {
    color: string
    height: number
  }
}

/**
 * Keep native window controls without reserving a blank row. On macOS the
 * traffic lights share the 52px application toolbar; Windows/Linux own only
 * the compact top-right caption rectangle.
 */
export function createWindowChromeOptions(platform: NodeJS.Platform): WindowChromeOptions {
  if (platform === 'darwin') {
    return {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 18, y: 20 },
    }
  }

  return {
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      height: TELOS_CAPTION_OVERLAY_HEIGHT,
    },
  }
}
