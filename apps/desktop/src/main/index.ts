import { app, BrowserWindow, dialog } from 'electron'
import { join } from 'node:path'
import { DshWebSupervisor } from './application/dsh-web-supervisor.js'
import {
  loadDevelopmentEnvironment,
  resolveDshNodeExecutable,
  resolveDshSourceRoot,
} from './application/dsh-runtime-paths.js'
import { createRuntimeGateway } from './application/runtime-gateway.js'
import { registerRuntimeHandlers } from './ipc/register-runtime-handlers.js'
import { registerSystemHandlers } from './ipc/register-system-handlers.js'
import { installApplicationMenu } from './shell/application-menu.js'
import { createMainWindow, loadDshWeb } from './shell/main-window.js'

app.setName('TELOS')

let dshWeb: DshWebSupervisor | undefined
let shutdownStarted = false

function openMainWindow(): BrowserWindow {
  const window = createMainWindow()
  const readyUrl = dshWeb?.getSnapshot().url
  if (readyUrl !== undefined) {
    void loadDshWeb(window, readyUrl).catch((error: unknown) => {
      console.error('Failed to load the ready DSH Web application', error)
    })
  }
  return window
}

app.whenReady().then(() => {
  loadDevelopmentEnvironment()
  installApplicationMenu()
  registerSystemHandlers()
  registerRuntimeHandlers(createRuntimeGateway())

  dshWeb = new DshWebSupervisor({
    sourceRoot: resolveDshSourceRoot(),
    dshHome: join(app.getPath('userData'), 'runtime/dsh/web-home'),
    executablePath: resolveDshNodeExecutable(),
  })

  const window = openMainWindow()
  void dshWeb.start().then(
    async (url) => {
      if (!window.isDestroyed()) await loadDshWeb(window, url)
    },
    (error: unknown) => {
      if (shutdownStarted) return
      const detail = error instanceof Error ? error.message : String(error)
      console.error('Failed to start the complete DSH Web runtime', error)
      dialog.showErrorBox('TELOS 无法启动 DSH', detail)
    },
  )

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openMainWindow()
  })
})

app.on('before-quit', (event) => {
  if (dshWeb === undefined || shutdownStarted) return
  event.preventDefault()
  shutdownStarted = true
  void dshWeb.stop().finally(() => app.quit())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
