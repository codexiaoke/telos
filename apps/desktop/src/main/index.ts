import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'node:path'
import { DshWebSupervisor } from './application/dsh-web-supervisor.js'
import { prepareTelosDshWebPatch } from './application/dsh-web-overlay.js'
import {
  loadDevelopmentEnvironment,
  resolveDshNodeExecutable,
  resolveDshSourceRoot,
  resolveTelosDshLayoutPackageRoot,
  resolveTelosDshSidebarPackageRoot,
} from './application/dsh-runtime-paths.js'
import { createRuntimeGateway } from './application/runtime-gateway.js'
import { IPC_CHANNELS } from './ipc/channels.js'
import { registerDshWebHandlers } from './ipc/register-dsh-web-handlers.js'
import { registerRuntimeHandlers } from './ipc/register-runtime-handlers.js'
import { registerSystemHandlers } from './ipc/register-system-handlers.js'
import { configureApplicationLogger } from './logging/application-logger.js'
import { installApplicationIcon } from './shell/application-icon.js'
import { createApplicationTray, type ApplicationTrayHandle } from './shell/application-tray.js'
import { installApplicationMenu } from './shell/application-menu.js'
import { createMainWindow, loadDshWeb } from './shell/main-window.js'
import { UpdateService } from './update/update-service.js'

app.setName('TELOS')
app.setAppLogsPath()

const logger = configureApplicationLogger(app.isPackaged)
logger.info('TELOS main process starting', { version: app.getVersion(), packaged: app.isPackaged })
autoUpdater.logger = logger
const updateService = new UpdateService({
  enabled: app.isPackaged,
  updater: autoUpdater,
  logger,
})

let dshWeb: DshWebSupervisor | undefined
let mainWindow: BrowserWindow | undefined
let tray: ApplicationTrayHandle | undefined
let quitRequested = false
let shutdownStarted = false
let shutdownPromise: Promise<void> | undefined

function openMainWindow(): BrowserWindow {
  if (mainWindow !== undefined && !mainWindow.isDestroyed()) return mainWindow

  const window = createMainWindow()
  mainWindow = window
  window.on('close', (event) => {
    if (quitRequested) return
    event.preventDefault()
    window.hide()
  })
  const unsubscribe = dshWeb?.subscribe((snapshot) => {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.dshWebState, snapshot)
    }
  })
  window.once('closed', () => {
    unsubscribe?.()
    if (mainWindow === window) mainWindow = undefined
  })
  const readyUrl = dshWeb?.getSnapshot().url
  if (readyUrl !== undefined) {
    void loadDshWeb(window, readyUrl).catch((error: unknown) => {
      logger.error('Failed to load the ready DSH Web application', error)
    })
  }
  return window
}

function showMainWindow(): void {
  if (!app.isReady()) return
  const window = openMainWindow()
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

function stopDshRuntime(): Promise<void> {
  if (shutdownPromise !== undefined) return shutdownPromise
  const runtime = dshWeb
  if (runtime === undefined) return Promise.resolve()

  shutdownStarted = true
  shutdownPromise = runtime.stop().finally(() => {
    if (dshWeb === runtime) dshWeb = undefined
  })
  return shutdownPromise
}

function requestQuit(): void {
  quitRequested = true
  updateService.stop()
  app.quit()
}

function installReadyUpdate(): void {
  quitRequested = true
  updateService.stop()
  void stopDshRuntime().then(
    () => updateService.installUpdate(),
    (error: unknown) => {
      logger.error('Failed to stop DSH before installing an update', error)
      updateService.installUpdate()
    },
  )
}

async function startApplication(): Promise<void> {
  loadDevelopmentEnvironment()
  installApplicationIcon()
  installApplicationMenu({
    showMainWindow,
    checkForUpdates: () => updateService.checkForUpdates(),
    quit: requestQuit,
  })
  registerSystemHandlers()
  registerRuntimeHandlers(createRuntimeGateway())

  const dshHome = join(app.getPath('userData'), 'runtime/dsh/web-home')
  const telosPatch = prepareTelosDshWebPatch(dshHome, {
    sidebarPackageRoot: resolveTelosDshSidebarPackageRoot(),
    layoutPackageRoot: resolveTelosDshLayoutPackageRoot(),
  })
  dshWeb = new DshWebSupervisor({
    sourceRoot: resolveDshSourceRoot(),
    dshHome,
    executablePath: resolveDshNodeExecutable(),
    patchPaths: [telosPatch],
  })
  registerDshWebHandlers({
    getSnapshot: () => dshWeb?.getSnapshot() ?? {
      state: 'idle',
      recentOutput: [],
    },
    retry: async (sender) => {
      const window = BrowserWindow.fromWebContents(sender)
      if (window === null || window.isDestroyed() || dshWeb === undefined) {
        throw new Error('TELOS startup window is no longer available')
      }
      const url = await dshWeb.restart()
      if (!window.isDestroyed()) await loadDshWeb(window, url)
    },
  })

  const window = openMainWindow()
  tray = createApplicationTray({
    showMainWindow,
    checkForUpdates: () => updateService.checkForUpdates(),
    downloadUpdate: () => updateService.downloadUpdate(),
    installUpdate: installReadyUpdate,
    quit: requestQuit,
    getUpdateSnapshot: () => updateService.getSnapshot(),
    subscribeToUpdates: observer => updateService.subscribe(observer),
  })
  updateService.start()

  void dshWeb.start().then(
    async (url) => {
      if (!window.isDestroyed()) await loadDshWeb(window, url)
    },
    (error: unknown) => {
      if (shutdownStarted) return
      logger.error('Failed to start the complete DSH Web runtime', error)
    },
  )

  app.on('activate', () => {
    showMainWindow()
  })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', showMainWindow)
  void app.whenReady().then(startApplication).catch((error: unknown) => {
    logger.error('TELOS failed during startup', error)
    requestQuit()
  })
}

app.on('before-quit', (event) => {
  quitRequested = true
  updateService.stop()
  if (dshWeb === undefined || shutdownStarted) return
  event.preventDefault()
  void stopDshRuntime().finally(() => app.quit())
})

app.on('will-quit', () => {
  tray?.destroy()
  tray = undefined
})
