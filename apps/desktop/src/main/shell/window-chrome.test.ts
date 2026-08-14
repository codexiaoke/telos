import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createWindowChromeOptions, TELOS_TITLE_BAR_HEIGHT } from './window-chrome.js'

describe('createWindowChromeOptions', () => {
  it('keeps the macOS traffic lights on the left', () => {
    expect(createWindowChromeOptions('darwin')).toEqual({
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 18, y: 18 },
    })
  })

  it.each(['win32', 'linux'] as const)('keeps native controls on %s', (platform) => {
    expect(createWindowChromeOptions(platform)).toEqual({
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: '#00000000',
        height: TELOS_TITLE_BAR_HEIGHT,
      },
    })
  })

  it('keeps the bootstrap shell on the same title-bar height contract', () => {
    const rendererCss = readFileSync(resolve(__dirname, '../../renderer/src/styles.css'), 'utf8')
    expect(rendererCss).toContain(`--telos-title-bar-height: ${String(TELOS_TITLE_BAR_HEIGHT)}px;`)
    expect(rendererCss).toContain('padding-top: var(--telos-title-bar-height);')
  })
})
