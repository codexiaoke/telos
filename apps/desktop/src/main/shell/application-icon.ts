import { app } from 'electron'
import { join } from 'node:path'

export function getDevelopmentApplicationIconPath(): string | undefined {
  if (app.isPackaged) return undefined
  return join(app.getAppPath(), 'build/icon.png')
}

export function installApplicationIcon(): void {
  const iconPath = getDevelopmentApplicationIconPath()
  if (iconPath === undefined || process.platform !== 'darwin') return
  app.dock?.setIcon(iconPath)
}
