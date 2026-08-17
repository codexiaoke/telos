import { app, BrowserWindow, dialog, protocol, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { configureApplicationProfile } from './application/application-profile.js'
import { DshWebSupervisor } from './application/dsh-web-supervisor.js'
import { prepareTelosDshWebPatch } from './application/dsh-web-overlay.js'
import {
  loadDevelopmentEnvironment,
  resolveDshNodeExecutable,
  resolveDshSourceRoot,
  resolveTelosDshContinuityPackageRoot,
  resolveTelosDshMcpManagerPackageRoot,
  resolveTelosDshMultimodalPackageRoot,
  resolveTelosDshPersonalizationPackageRoot,
  resolveTelosDshCompanionPackageRoot,
  resolveTelosDshMultiRootWorkspacePackageRoot,
  resolveTelosDshWorkbenchFilesPackageRoot,
  resolveTelosDshWorkReportPackageRoot,
  resolveTelosDshComputerUsePackageRoot,
  resolveTelosDshLayoutPackageRoot,
  resolveTelosDshSidebarPackageRoot,
} from './application/dsh-runtime-paths.js'
import { createRuntimeGateway } from './application/runtime-gateway.js'
import { IPC_CHANNELS } from './ipc/channels.js'
import { registerDshWebHandlers } from './ipc/register-dsh-web-handlers.js'
import { registerRuntimeHandlers } from './ipc/register-runtime-handlers.js'
import { registerSystemHandlers } from './ipc/register-system-handlers.js'
import { registerWorkbenchPreferencesHandlers } from './ipc/register-workbench-preferences-handlers.js'
import { configureApplicationLogger } from './logging/application-logger.js'
import { WorkbenchPreferencesStore } from './preferences/workbench-preferences-store.js'
import { CompanionController } from './companion/companion-controller.js'
import { installApplicationIcon } from './shell/application-icon.js'
import { createApplicationTray, type ApplicationTrayHandle } from './shell/application-tray.js'
import { installApplicationMenu } from './shell/application-menu.js'
import { createMainWindow, loadDshWeb } from './shell/main-window.js'
import { createManualUpdateFeedback } from './update/manual-update-feedback.js'
import { UpdateService } from './update/update-service.js'

protocol.registerSchemesAsPrivileged([{
  scheme: 'petwhale-live2d',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true,
  },
}])

app.setName('Telos')
const applicationProfile = configureApplicationProfile(app)
app.setAppLogsPath()

const logger = configureApplicationLogger(app.isPackaged)
const RELEASE_PAGE_URL = 'https://github.com/codexiaoke/telos/releases/latest'
logger.info('Telos main process starting', {
  version: app.getVersion(),
  packaged: app.isPackaged,
  profile: applicationProfile.kind,
})
autoUpdater.logger = logger
const updateConfigurationAvailable = app.isPackaged && existsSync(join(process.resourcesPath, 'app-update.yml'))
if (app.isPackaged && !updateConfigurationAvailable) {
  logger.info('Online updates are disabled because this directory build has no release metadata')
}
const updateService = new UpdateService({
  enabled: updateConfigurationAvailable,
  updater: autoUpdater,
  logger,
  openReleasePage: () => shell.openExternal(RELEASE_PAGE_URL),
})

let dshWeb: DshWebSupervisor | undefined
let mainWindow: BrowserWindow | undefined
let tray: ApplicationTrayHandle | undefined
let companion: CompanionController | undefined
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

async function checkForUpdatesInteractively(): Promise<void> {
  await updateService.checkForUpdates()
  const feedback = createManualUpdateFeedback(updateService.getSnapshot())
  const parent = mainWindow !== undefined && !mainWindow.isDestroyed() ? mainWindow : undefined
  const result = parent === undefined
    ? await dialog.showMessageBox(feedback.options)
    : await dialog.showMessageBox(parent, feedback.options)
  if (result.response === feedback.openReleaseResponse) {
    await updateService.openReleasePage()
  }
}

async function startApplication(): Promise<void> {
  loadDevelopmentEnvironment()
  installApplicationIcon()
  installApplicationMenu({
    showMainWindow,
    checkForUpdates: checkForUpdatesInteractively,
    quit: requestQuit,
  })
  registerSystemHandlers()
  registerRuntimeHandlers(createRuntimeGateway())
  const workbenchPreferences = new WorkbenchPreferencesStore(
    join(app.getPath('userData'), 'settings/workbench-preferences.json'),
  )
  registerWorkbenchPreferencesHandlers({
    store: workbenchPreferences,
    isTrustedSender: sender => (
      mainWindow !== undefined
      && !mainWindow.isDestroyed()
      && sender.id === mainWindow.webContents.id
    ),
  })

  const dshHome = join(app.getPath('userData'), 'runtime/dsh/web-home')
  const telosPatch = prepareTelosDshWebPatch(dshHome, {
    sidebarPackageRoot: resolveTelosDshSidebarPackageRoot(),
    layoutPackageRoot: resolveTelosDshLayoutPackageRoot(),
    continuityPackageRoot: resolveTelosDshContinuityPackageRoot(),
    mcpManagerPackageRoot: resolveTelosDshMcpManagerPackageRoot(),
    multimodalPackageRoot: resolveTelosDshMultimodalPackageRoot(),
    personalizationPackageRoot: resolveTelosDshPersonalizationPackageRoot(),
    companionPackageRoot: resolveTelosDshCompanionPackageRoot(),
    multiRootWorkspacePackageRoot: resolveTelosDshMultiRootWorkspacePackageRoot(),
    workbenchFilesPackageRoot: resolveTelosDshWorkbenchFilesPackageRoot(),
    workReportPackageRoot: resolveTelosDshWorkReportPackageRoot(),
    computerUsePackageRoot: resolveTelosDshComputerUsePackageRoot(),
  })
  dshWeb = new DshWebSupervisor({
    sourceRoot: resolveDshSourceRoot(),
    dshHome,
    packaged: app.isPackaged,
    executablePath: resolveDshNodeExecutable(),
    patchPaths: [telosPatch],
  })
  companion = new CompanionController({
    userDataPath: app.getPath('userData'),
    preloadPath: join(__dirname, '../preload/index.js'),
    rendererPath: join(__dirname, '../renderer/pet.html'),
    logger,
    getWorkbenchWebContents: () => (
      mainWindow !== undefined && !mainWindow.isDestroyed()
        ? mainWindow.webContents
        : undefined
    ),
  })
  companion.start(dshWeb)
  registerDshWebHandlers({
    getSnapshot: () => dshWeb?.getSnapshot() ?? {
      state: 'idle',
      recentOutput: [],
    },
    retry: async (sender) => {
      const window = BrowserWindow.fromWebContents(sender)
      if (window === null || window.isDestroyed() || dshWeb === undefined) {
        throw new Error('Telos startup window is no longer available')
      }
      const url = await dshWeb.restart()
      if (!window.isDestroyed()) await loadDshWeb(window, url)
    },
  })

  const window = openMainWindow()
  tray = createApplicationTray({
    showMainWindow,
    checkForUpdates: checkForUpdatesInteractively,
    openReleasePage: () => updateService.openReleasePage(),
    quit: requestQuit,
    getUpdateSnapshot: () => updateService.getSnapshot(),
    subscribeToUpdates: observer => updateService.subscribe(observer),
    companion: {
      menuItem: () => companion?.trayMenuItem() ?? { label: '桌面宠物', enabled: false },
      subscribe: observer => companion?.subscribe(observer) ?? (() => undefined),
    },
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
    logger.error('Telos failed during startup', error)
    requestQuit()
  })
}

app.on('before-quit', (event) => {
  quitRequested = true
  updateService.stop()
  companion?.dispose()
  companion = undefined
  if (dshWeb === undefined || shutdownStarted) return
  event.preventDefault()
  void stopDshRuntime().finally(() => app.quit())
})

app.on('will-quit', () => {
  companion?.dispose()
  companion = undefined
  tray?.destroy()
  tray = undefined
})
