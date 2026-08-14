import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  createWindowChromeOptions,
  TELOS_CAPTION_OVERLAY_HEIGHT,
  TELOS_MAC_TITLEBAR_LEFT_SAFE,
  TELOS_TITLE_BAR_HEIGHT,
} from './window-chrome.js'

describe('createWindowChromeOptions', () => {
  it('keeps the macOS traffic lights on the left', () => {
    expect(createWindowChromeOptions('darwin')).toEqual({
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 18, y: 20 },
    })
  })

  it.each(['win32', 'linux'] as const)('keeps native controls on %s', (platform) => {
    expect(createWindowChromeOptions(platform)).toEqual({
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: '#00000000',
        height: TELOS_CAPTION_OVERLAY_HEIGHT,
      },
    })
  })

  it('uses the titlebar row as product space instead of page padding', () => {
    const rendererCss = readFileSync(resolve(__dirname, '../../renderer/src/styles.css'), 'utf8')
    expect(rendererCss).toContain(`--telos-titlebar-height: ${String(TELOS_TITLE_BAR_HEIGHT)}px;`)
    expect(rendererCss).toContain(`--telos-titlebar-left-safe: ${String(TELOS_MAC_TITLEBAR_LEFT_SAFE)}px;`)
    expect(rendererCss).not.toContain('padding-top: var(--telos-titlebar-height);')
  })
})
