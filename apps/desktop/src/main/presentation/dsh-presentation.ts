import type { BrowserWindow, WebContents } from 'electron'
import { TELOS_DSH_THEME_CSS, toTelosWindowTitle } from './dsh-brand.js'

interface PresentationState {
  insertedCssKey?: string
  update: Promise<void>
}

const installed = new WeakSet<WebContents>()
const states = new WeakMap<WebContents, PresentationState>()

/** Apply the host-owned TELOS token layer to the currently loaded DSH page. */
export function applyDshPresentation(webContents: WebContents): Promise<void> {
  const state = states.get(webContents) ?? { update: Promise.resolve() }
  states.set(webContents, state)

  state.update = state.update.catch(() => undefined).then(async () => {
    if (webContents.isDestroyed()) return
    if (state.insertedCssKey !== undefined) {
      await webContents.removeInsertedCSS(state.insertedCssKey).catch(() => undefined)
    }
    state.insertedCssKey = await webContents.insertCSS(TELOS_DSH_THEME_CSS, { cssOrigin: 'author' })
  })
  return state.update
}

/**
 * Install the idempotent Electron-side presentation boundary. DSH continues
 * to own its DOM, routes, components, and runtime behavior.
 */
export function installDshPresentation(window: BrowserWindow): void {
  const { webContents } = window
  if (installed.has(webContents)) return
  installed.add(webContents)

  webContents.on('page-title-updated', (event, title) => {
    event.preventDefault()
    if (!window.isDestroyed()) window.setTitle(toTelosWindowTitle(title))
  })
  webContents.on('did-finish-load', () => {
    void applyDshPresentation(webContents).catch((error: unknown) => {
      console.error('Failed to apply the TELOS DSH presentation layer', error)
    })
  })
}
