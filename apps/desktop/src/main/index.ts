import { app, BrowserWindow } from 'electron'
import { createRuntimeGateway } from './application/runtime-gateway.js'
import { registerRuntimeHandlers } from './ipc/register-runtime-handlers.js'
import { registerSystemHandlers } from './ipc/register-system-handlers.js'
import { installApplicationMenu } from './shell/application-menu.js'
import { createMainWindow } from './shell/main-window.js'

app.setName('TELOS')

app.whenReady().then(() => {
  installApplicationMenu()
  registerSystemHandlers()
  registerRuntimeHandlers(createRuntimeGateway())
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
