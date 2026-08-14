export const TELOS_TITLE_BAR_HEIGHT = 44

export interface WindowChromeOptions {
  titleBarStyle: 'hidden' | 'hiddenInset'
  trafficLightPosition?: { x: number; y: number }
  titleBarOverlay?: {
    color: string
    height: number
  }
}

/**
 * Keep native window controls while giving the Web UI one cross-platform
 * title-bar contract. The renderer reserves the matching height, so neither
 * left-side macOS traffic lights nor right-side Windows/Linux controls overlap
 * application actions.
 */
export function createWindowChromeOptions(platform: NodeJS.Platform): WindowChromeOptions {
  if (platform === 'darwin') {
    return {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 18, y: 18 },
    }
  }

  return {
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      height: TELOS_TITLE_BAR_HEIGHT,
    },
  }
}
