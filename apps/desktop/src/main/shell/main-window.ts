import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { applyDshPresentation, installDshPresentation } from '../presentation/dsh-presentation.js'
import { getDevelopmentApplicationIconPath } from './application-icon.js'
import { createWindowChromeOptions } from './window-chrome.js'

function parseDshWebUrl(value: string): URL {
  const url = new URL(value)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.port === '') {
    throw new Error(`Refusing to load untrusted DSH Web URL: ${value}`)
  }
  return url
}

function openExternalIfSafe(value: string): void {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' || url.protocol === 'http:') void shell.openExternal(url.href)
  } catch {
    // A malformed target is denied without handing it to the operating system.
  }
}

export function createMainWindow(): BrowserWindow {
  const icon = getDevelopmentApplicationIconPath()
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1060,
    minHeight: 700,
    backgroundColor: '#f7f7f6',
    ...(icon === undefined ? {} : { icon }),
    ...createWindowChromeOptions(process.platform),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const developmentUrl = process.env.ELECTRON_RENDERER_URL
  if (developmentUrl) void window.loadURL(developmentUrl)
  else void window.loadFile(join(__dirname, '../renderer/index.html'))

  return window
}

export async function loadDshWeb(window: BrowserWindow, value: string): Promise<void> {
  const url = parseDshWebUrl(value)
  const allowedOrigin = url.origin

  installDshPresentation(window)

  const guardNavigation = (event: Electron.Event, target: string): void => {
    try {
      if (new URL(target).origin === allowedOrigin) return
    } catch {
      // Invalid navigation is denied below.
    }
    event.preventDefault()
    openExternalIfSafe(target)
  }

  window.webContents.on('will-navigate', guardNavigation)
  window.webContents.on('will-redirect', guardNavigation)
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    openExternalIfSafe(target)
    return { action: 'deny' }
  })

  await window.loadURL(url.href)
  await applyDshPresentation(window.webContents)
}
