import {
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  protocol,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type MenuItemConstructorOptions,
  type WebContents,
} from 'electron'
import {
  CustomPetStore,
  DEFAULT_PET_SETTINGS,
  PetStateTracker,
  normalizePetSettings,
  parseHostFrame,
  petMenuOptions,
  type CustomPetRecord,
  type PetChoiceId,
  type PetSettings,
} from '@petwhale/electron-host'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DshWebSupervisor } from '../application/dsh-web-supervisor.js'
import {
  COMPANION_SIZE_PERCENT_DEFAULT,
  COMPANION_SIZE_PERCENT_MAX,
  COMPANION_SIZE_PERCENT_MIN,
  COMPANION_SIZE_PERCENT_STEP,
  companionWindowSize,
  normalizeCompanionAspectRatio,
  normalizeCompanionSizePercent,
  type CompanionConfig,
  type CompanionImportKind,
  type CompanionPetOption,
  type CompanionSettingsPatch,
  type CompanionSettingsView,
  type CompanionSnapshot,
} from '../../shared/companion.js'
import { IPC_CHANNELS } from '../ipc/channels.js'
import { CompanionConversationTracker } from './conversation-tracker.js'

const LIVE2D_PROPRIETARY_LICENSE_URL =
  'https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_cn.html'
const LIVE2D_OPEN_LICENSE_URL =
  'https://www.live2d.com/eula/live2d-open-software-license-agreement_cn.html'

interface CompanionLogger {
  info(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

export interface CompanionControllerOptions {
  userDataPath: string
  preloadPath: string
  rendererPath: string
  logger: CompanionLogger
  getWorkbenchWebContents: () => WebContents | undefined
}

/**
 * Owns Telos's companion BrowserWindow. It deliberately has no Electron app,
 * tray, updater, or quit authority: those remain in the Telos main lifecycle.
 */
export class CompanionController {
  private readonly rootPath: string
  private readonly settingsPath: string
  private readonly positionPath: string
  private readonly live2dLicensePath: string
  private readonly pets: CustomPetStore
  private settings: PetSettings
  private sizePercent: number
  private aspectRatio = 1
  private customPets: CustomPetRecord[]
  private tracker = new PetStateTracker()
  private readonly conversations = new CompanionConversationTracker()
  private window: BrowserWindow | undefined
  private hostSocket: WebSocket | undefined
  private muxSocket: WebSocket | undefined
  private dshUrl: string | undefined
  private hostReconnectTimer: NodeJS.Timeout | undefined
  private muxReconnectTimer: NodeJS.Timeout | undefined
  private statePushTimer: NodeJS.Timeout | undefined
  private unsubscribeDsh: (() => void) | undefined
  private readonly observers = new Set<() => void>()
  private disposed = false
  private connected = false

  constructor(private readonly options: CompanionControllerOptions) {
    const root = join(options.userDataPath, 'petwhale')
    this.rootPath = root
    this.settingsPath = join(root, 'settings.json')
    this.positionPath = join(root, 'position.json')
    this.live2dLicensePath = join(root, 'live2d-license.json')
    this.pets = new CustomPetStore(join(root, 'custom-pets'))
    this.customPets = this.pets.load()
    const persisted = this.loadSettings()
    this.settings = persisted.settings
    this.sizePercent = persisted.sizePercent
    if (
      this.settings.pet.startsWith('custom:')
      && !this.customPets.some(pet => pet.id === this.settings.pet)
    ) {
      this.settings = { ...this.settings, pet: 'orb' }
      this.saveSettings()
    }
    this.installLive2DProtocol()
    ipcMain.on(IPC_CHANNELS.companionMenu, this.handleMenu)
    ipcMain.on(IPC_CHANNELS.companionFocusWorkbench, this.handleFocusWorkbench)
    ipcMain.on(IPC_CHANNELS.companionRendererError, this.handleRendererError)
    ipcMain.on(IPC_CHANNELS.companionIntrinsicSize, this.handleIntrinsicSize)
    ipcMain.handle(IPC_CHANNELS.companionSettingsGet, this.handleSettingsGet)
    ipcMain.handle(IPC_CHANNELS.companionSettingsUpdate, this.handleSettingsUpdate)
    ipcMain.handle(IPC_CHANNELS.companionSettingsImport, this.handleSettingsImport)
    ipcMain.handle(IPC_CHANNELS.companionSettingsRemove, this.handleSettingsRemove)
  }

  start(supervisor: DshWebSupervisor): void {
    if (this.disposed) return
    this.openWindow()
    this.unsubscribeDsh?.()
    this.unsubscribeDsh = supervisor.subscribe((snapshot) => {
      const nextUrl = snapshot.state === 'ready' ? snapshot.url : undefined
      if (nextUrl === this.dshUrl) return
      this.disconnect()
      this.dshUrl = nextUrl
      this.tracker = new PetStateTracker()
      this.conversations.clear()
      this.pushState()
      if (nextUrl !== undefined) this.connect(nextUrl)
    })
  }

  subscribe(observer: () => void): () => void {
    this.observers.add(observer)
    return () => this.observers.delete(observer)
  }

  trayMenuItem(): MenuItemConstructorOptions {
    return {
      label: '桌面宠物',
      submenu: this.menuItems(),
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.unsubscribeDsh?.()
    this.unsubscribeDsh = undefined
    this.dshUrl = undefined
    this.disconnect()
    ipcMain.removeListener(IPC_CHANNELS.companionMenu, this.handleMenu)
    ipcMain.removeListener(IPC_CHANNELS.companionFocusWorkbench, this.handleFocusWorkbench)
    ipcMain.removeListener(IPC_CHANNELS.companionRendererError, this.handleRendererError)
    ipcMain.removeListener(IPC_CHANNELS.companionIntrinsicSize, this.handleIntrinsicSize)
    ipcMain.removeHandler(IPC_CHANNELS.companionSettingsGet)
    ipcMain.removeHandler(IPC_CHANNELS.companionSettingsUpdate)
    ipcMain.removeHandler(IPC_CHANNELS.companionSettingsImport)
    ipcMain.removeHandler(IPC_CHANNELS.companionSettingsRemove)
    protocol.unhandle('petwhale-live2d')
    this.window?.destroy()
    this.window = undefined
    this.observers.clear()
  }

  private loadSettings(): { settings: PetSettings; sizePercent: number } {
    try {
      const value = JSON.parse(readFileSync(this.settingsPath, 'utf8')) as { sizePercent?: unknown }
      const settings = normalizePetSettings(value)
      return {
        settings,
        sizePercent: normalizeCompanionSizePercent(value.sizePercent, settings.size),
      }
    } catch {
      return {
        settings: { ...DEFAULT_PET_SETTINGS },
        sizePercent: COMPANION_SIZE_PERCENT_DEFAULT,
      }
    }
  }

  private saveSettings(): void {
    try {
      mkdirSync(this.rootPath, { recursive: true })
      writeFileSync(this.settingsPath, JSON.stringify({ ...this.settings, sizePercent: this.sizePercent }, null, 2))
    } catch (error) {
      this.options.logger.error('Failed to persist companion settings', error)
    }
  }

  private loadPosition(): { x: number; y: number } | undefined {
    try {
      const value = JSON.parse(readFileSync(this.positionPath, 'utf8')) as { x?: unknown; y?: unknown }
      if (typeof value.x === 'number' && typeof value.y === 'number') return { x: value.x, y: value.y }
    } catch {
      // The first launch has no stored position.
    }
    return undefined
  }

  private savePosition(): void {
    const window = this.window
    if (window === undefined || window.isDestroyed()) return
    const [x, y] = window.getPosition()
    try {
      mkdirSync(this.rootPath, { recursive: true })
      writeFileSync(this.positionPath, JSON.stringify({ x, y }))
    } catch (error) {
      this.options.logger.error('Failed to persist companion position', error)
    }
  }

  private openWindow(): BrowserWindow {
    if (this.window !== undefined && !this.window.isDestroyed()) return this.window
    const position = this.loadPosition()
    const size = companionWindowSize(this.sizePercent, this.aspectRatio)
    const window = new BrowserWindow({
      ...size,
      ...position,
      frame: false,
      transparent: true,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      fullscreenable: false,
      maximizable: false,
      show: false,
      webPreferences: {
        preload: this.options.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    this.window = window
    window.setAlwaysOnTop(true, 'screen-saver')
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    window.on('moved', () => this.savePosition())
    window.on('close', (event) => {
      if (this.disposed) return
      event.preventDefault()
      window.hide()
      this.notify()
    })
    window.once('closed', () => {
      if (this.window === window) this.window = undefined
      this.notify()
    })
    window.webContents.on('did-finish-load', () => {
      this.pushState()
      this.pushConfig()
      window.showInactive()
      this.notify()
    })
    void window.loadFile(this.options.rendererPath)
    return window
  }

  private connect(baseUrl: string): void {
    if (this.disposed || this.dshUrl !== baseUrl) return
    this.connectHost(baseUrl)
    this.connectMux(baseUrl)
  }

  private connectHost(baseUrl: string): void {
    if (this.disposed || this.dshUrl !== baseUrl || this.hostSocket !== undefined) return
    const socket = new WebSocket(`${baseUrl.replace(/^http/, 'ws')}/api/events.host`)
    this.hostSocket = socket
    socket.onopen = () => {
      if (this.hostSocket !== socket) return
      this.connected = true
      this.notify()
    }
    socket.onmessage = (event) => {
      if (this.hostSocket !== socket) return
      const frame = parseHostFrame(event.data)
      if (frame === null) return
      this.tracker.ingest(frame)
      this.conversations.ingestHost(frame)
      this.pushState()
    }
    socket.onclose = () => {
      if (this.hostSocket !== socket) return
      this.hostSocket = undefined
      this.connected = false
      this.notify()
      this.scheduleHostReconnect(baseUrl)
    }
    socket.onerror = () => socket.close()
  }

  private connectMux(baseUrl: string): void {
    if (this.disposed || this.dshUrl !== baseUrl || this.muxSocket !== undefined) return
    const socket = new WebSocket(`${baseUrl.replace(/^http/, 'ws')}/api/events.mux`)
    this.muxSocket = socket
    socket.onmessage = (event) => {
      if (this.muxSocket !== socket) return
      const frame = parseHostFrame(event.data)
      if (frame !== null && this.conversations.ingestMux(frame)) this.schedulePushState()
    }
    socket.onclose = () => {
      if (this.muxSocket !== socket) return
      this.muxSocket = undefined
      this.scheduleMuxReconnect(baseUrl)
    }
    socket.onerror = () => socket.close()
  }

  private scheduleHostReconnect(baseUrl: string): void {
    if (this.disposed || this.dshUrl !== baseUrl || this.hostReconnectTimer !== undefined) return
    this.hostReconnectTimer = setTimeout(() => {
      this.hostReconnectTimer = undefined
      this.connectHost(baseUrl)
    }, 2_000)
  }

  private scheduleMuxReconnect(baseUrl: string): void {
    if (this.disposed || this.dshUrl !== baseUrl || this.muxReconnectTimer !== undefined) return
    this.muxReconnectTimer = setTimeout(() => {
      this.muxReconnectTimer = undefined
      this.connectMux(baseUrl)
    }, 2_000)
  }

  private disconnect(): void {
    if (this.hostReconnectTimer !== undefined) clearTimeout(this.hostReconnectTimer)
    if (this.muxReconnectTimer !== undefined) clearTimeout(this.muxReconnectTimer)
    if (this.statePushTimer !== undefined) clearTimeout(this.statePushTimer)
    this.hostReconnectTimer = undefined
    this.muxReconnectTimer = undefined
    this.statePushTimer = undefined
    const hostSocket = this.hostSocket
    const muxSocket = this.muxSocket
    this.hostSocket = undefined
    this.muxSocket = undefined
    hostSocket?.close()
    muxSocket?.close()
    this.connected = false
    this.notify()
  }

  private schedulePushState(): void {
    if (this.statePushTimer !== undefined) return
    this.statePushTimer = setTimeout(() => {
      this.statePushTimer = undefined
      this.pushState()
    }, 80)
  }

  private pushState(): void {
    const window = this.window
    if (window === undefined || window.isDestroyed() || window.webContents.isDestroyed()) return
    const tracked = this.tracker.getSnapshot()
    const conversation = this.conversations.snapshot(tracked.activity?.label)
    const snapshot: CompanionSnapshot = {
      ...tracked,
      context: {
        ...tracked.context,
        host: 'telos',
        ...(conversation === undefined ? {} : { sessionId: conversation.sessionId }),
      },
      ...(conversation === undefined ? {} : { conversation }),
    }
    window.webContents.send(IPC_CHANNELS.companionState, snapshot)
  }

  private config(): CompanionConfig {
    const custom = this.customPets.find(pet => pet.id === this.settings.pet)
    return {
      ...this.settings,
      ...(custom === undefined ? {} : { customPet: this.pets.rendererConfig(custom) }),
    }
  }

  private pushConfig(): void {
    const window = this.window
    if (window === undefined || window.isDestroyed() || window.webContents.isDestroyed()) return
    window.webContents.send(IPC_CHANNELS.companionConfig, this.config())
  }

  private notify(): void {
    for (const observer of this.observers) observer()
    const workbench = this.options.getWorkbenchWebContents()
    if (workbench !== undefined && !workbench.isDestroyed()) {
      workbench.send(IPC_CHANNELS.companionSettingsChanged, this.settingsView())
    }
  }

  private toggleVisible(): void {
    const window = this.openWindow()
    if (window.isVisible()) window.hide()
    else window.showInactive()
    this.notify()
  }

  private setVisible(visible: boolean): void {
    const window = this.openWindow()
    if (visible) window.showInactive()
    else window.hide()
    this.notify()
  }

  private setLocked(locked: boolean): void {
    this.settings = { ...this.settings, locked }
    this.saveSettings()
    this.pushConfig()
    this.notify()
  }

  private setSizePercent(value: number): void {
    const sizePercent = normalizeCompanionSizePercent(value)
    this.sizePercent = sizePercent
    this.settings = {
      ...this.settings,
      size: sizePercent < COMPANION_SIZE_PERCENT_DEFAULT ? 'small' : 'large',
    }
    this.saveSettings()
    const window = this.window
    if (window !== undefined && !window.isDestroyed()) {
      const size = companionWindowSize(sizePercent, this.aspectRatio)
      window.setSize(size.width, size.height)
    }
    this.pushConfig()
    this.notify()
  }

  private setPet(pet: PetChoiceId): void {
    if (pet.startsWith('custom:') && !this.customPets.some(candidate => candidate.id === pet)) return
    this.settings = { ...this.settings, pet }
    this.aspectRatio = 1
    this.saveSettings()
    const window = this.window
    if (window !== undefined && !window.isDestroyed()) {
      const size = companionWindowSize(this.sizePercent, this.aspectRatio)
      window.setSize(size.width, size.height)
    }
    this.pushConfig()
    this.notify()
  }

  private settingsView(): CompanionSettingsView {
    const windowSize = companionWindowSize(this.sizePercent, this.aspectRatio)
    const customById = new Map<PetChoiceId, CustomPetRecord>(this.customPets.map(pet => [pet.id, pet]))
    const pets: CompanionPetOption[] = petMenuOptions(this.settings.pet, this.customPets).map((option) => {
      const custom = customById.get(option.id)
      return {
        id: option.id,
        label: option.label,
        kind: custom?.type ?? (option.id === 'orb' ? 'orb' : 'sprite'),
        removable: custom !== undefined,
      }
    })
    return {
      visible: this.window !== undefined && !this.window.isDestroyed() && this.window.isVisible(),
      connected: this.connected,
      pet: this.settings.pet,
      locked: this.settings.locked,
      sizePercent: this.sizePercent,
      minSizePercent: COMPANION_SIZE_PERCENT_MIN,
      maxSizePercent: COMPANION_SIZE_PERCENT_MAX,
      stepSizePercent: COMPANION_SIZE_PERCENT_STEP,
      windowWidth: windowSize.width,
      windowHeight: windowSize.height,
      pets,
    }
  }

  private assertSettingsSender(event: IpcMainInvokeEvent): void {
    const workbench = this.options.getWorkbenchWebContents()
    if (workbench === undefined || workbench.isDestroyed() || event.sender.id !== workbench.id) {
      throw new Error('Companion settings are only available from the Telos workbench')
    }
  }

  private parseSettingsPatch(value: unknown): CompanionSettingsPatch {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError('Companion settings patch must be an object')
    }
    const input = value as Record<string, unknown>
    const allowed = new Set(['visible', 'locked', 'sizePercent', 'pet'])
    if (Object.keys(input).some(key => !allowed.has(key))) throw new TypeError('Unknown companion setting')
    if (input.visible !== undefined && typeof input.visible !== 'boolean') throw new TypeError('Invalid visibility')
    if (input.locked !== undefined && typeof input.locked !== 'boolean') throw new TypeError('Invalid lock state')
    if (
      input.sizePercent !== undefined
      && (
        typeof input.sizePercent !== 'number'
        || !Number.isInteger(input.sizePercent)
        || input.sizePercent < COMPANION_SIZE_PERCENT_MIN
        || input.sizePercent > COMPANION_SIZE_PERCENT_MAX
      )
    ) throw new TypeError('Invalid size percentage')
    if (input.pet !== undefined && !this.settingsView().pets.some(option => option.id === input.pet)) {
      throw new TypeError('Unknown pet')
    }
    return input as CompanionSettingsPatch
  }

  private readonly handleSettingsGet = (event: IpcMainInvokeEvent): CompanionSettingsView => {
    this.assertSettingsSender(event)
    return this.settingsView()
  }

  private readonly handleSettingsUpdate = (
    event: IpcMainInvokeEvent,
    value: unknown,
  ): CompanionSettingsView => {
    this.assertSettingsSender(event)
    const patch = this.parseSettingsPatch(value)
    if (patch.visible !== undefined) this.setVisible(patch.visible)
    if (patch.locked !== undefined) this.setLocked(patch.locked)
    if (patch.sizePercent !== undefined) this.setSizePercent(patch.sizePercent)
    if (patch.pet !== undefined) this.setPet(patch.pet)
    return this.settingsView()
  }

  private readonly handleSettingsImport = async (
    event: IpcMainInvokeEvent,
    kind: unknown,
  ): Promise<CompanionSettingsView> => {
    this.assertSettingsSender(event)
    if (kind !== 'image' && kind !== 'live2d') throw new TypeError('Unknown companion import kind')
    if ((kind as CompanionImportKind) === 'image') await this.importImage()
    else await this.importLive2D()
    return this.settingsView()
  }

  private readonly handleSettingsRemove = async (
    event: IpcMainInvokeEvent,
    id: unknown,
  ): Promise<CompanionSettingsView> => {
    this.assertSettingsSender(event)
    if (typeof id !== 'string') throw new TypeError('Invalid custom pet id')
    const pet = this.customPets.find(candidate => candidate.id === id)
    if (pet === undefined) throw new TypeError('Custom pet does not exist')
    await this.removePet(pet)
    return this.settingsView()
  }

  private async importImage(): Promise<void> {
    const result = await dialog.showOpenDialog({
      title: '导入自定义宠物',
      properties: ['openFile'],
      filters: [{ name: '宠物图片', extensions: ['png', 'apng', 'webp'] }],
    })
    const source = result.filePaths[0]
    if (result.canceled || source === undefined) return
    try {
      const imported = this.pets.importFile(source)
      this.customPets = this.pets.load()
      this.setPet(imported.id)
    } catch (error) {
      dialog.showErrorBox('无法导入宠物', error instanceof Error ? error.message : String(error))
    }
  }

  private async confirmLive2DLicense(): Promise<boolean> {
    if (existsSync(this.live2dLicensePath)) return true
    while (true) {
      const result = await dialog.showMessageBox({
        type: 'info',
        title: '启用 Live2D Cubism',
        message: '导入 Live2D 模型需要使用 Live2D Cubism Core。',
        detail:
          '继续即表示你已阅读并同意 Live2D Proprietary Software License Agreement 和 '
          + 'Live2D Open Software License Agreement，并确认拥有所导入模型及素材的使用权。'
          + 'Telos 会从 Live2D 官方固定版本地址加载 Cubism Core。',
        buttons: ['取消', '查看许可', '同意并继续'],
        defaultId: 0,
        cancelId: 0,
      })
      if (result.response === 0) return false
      if (result.response === 1) {
        await shell.openExternal(LIVE2D_PROPRIETARY_LICENSE_URL)
        await shell.openExternal(LIVE2D_OPEN_LICENSE_URL)
        continue
      }
      mkdirSync(this.rootPath, { recursive: true })
      writeFileSync(this.live2dLicensePath, JSON.stringify({
        acceptedAt: new Date().toISOString(),
        cubismCore: '5.3-hosted',
      }))
      return true
    }
  }

  private async importLive2D(): Promise<void> {
    if (!(await this.confirmLive2DLicense())) return
    const result = await dialog.showOpenDialog({
      title: '导入 Live2D 模型包',
      properties: ['openFile'],
      filters: [{ name: 'Live2D ZIP 模型包', extensions: ['zip'] }],
    })
    const source = result.filePaths[0]
    if (result.canceled || source === undefined) return
    try {
      const imported = this.pets.importLive2D(source)
      this.customPets = this.pets.load()
      this.setPet(imported.id)
    } catch (error) {
      dialog.showErrorBox('无法导入 Live2D 宠物', error instanceof Error ? error.message : String(error))
    }
  }

  private async removePet(pet: CustomPetRecord): Promise<void> {
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: '删除自定义宠物',
      message: `确定删除“${pet.label}”吗？`,
      detail: 'Telos 保存的副本会被删除，原始文件不受影响。',
      buttons: ['取消', '删除'],
      defaultId: 0,
      cancelId: 0,
    })
    if (result.response !== 1) return
    if (this.settings.pet === pet.id) this.setPet('orb')
    this.pets.remove(pet.id)
    this.customPets = this.pets.load()
    this.pushConfig()
    this.notify()
  }

  private menuItems(): MenuItemConstructorOptions[] {
    const visible = this.window !== undefined && !this.window.isDestroyed() && this.window.isVisible()
    return [
      { label: visible ? '隐藏宠物' : '显示宠物', click: () => this.toggleVisible() },
      {
        label: '锁定位置',
        type: 'checkbox',
        checked: this.settings.locked,
        click: item => this.setLocked(item.checked),
      },
    ]
  }

  private readonly handleMenu = (event: IpcMainEvent): void => {
    if (this.window === undefined || this.window.isDestroyed() || event.sender.id !== this.window.webContents.id) return
    Menu.buildFromTemplate(this.menuItems()).popup({ window: this.window })
  }

  private readonly handleFocusWorkbench = (event: IpcMainEvent): void => {
    if (this.window === undefined || this.window.isDestroyed() || event.sender.id !== this.window.webContents.id) return
    const workbench = this.options.getWorkbenchWebContents()
    if (workbench === undefined || workbench.isDestroyed()) return
    const window = BrowserWindow.fromWebContents(workbench)
    if (window?.isMinimized()) window.restore()
    window?.show()
    window?.focus()
  }

  private readonly handleRendererError = (event: IpcMainEvent, message: unknown): void => {
    if (this.window === undefined || this.window.isDestroyed() || event.sender.id !== this.window.webContents.id) return
    if (typeof message !== 'string' || message.length === 0 || message.length > 500) return
    this.options.logger.error('Companion renderer failed', message)
    if (this.settings.pet !== 'orb') this.setPet('orb')
  }

  private readonly handleIntrinsicSize = (
    event: IpcMainEvent,
    width: unknown,
    height: unknown,
  ): void => {
    const window = this.window
    if (window === undefined || window.isDestroyed() || event.sender.id !== window.webContents.id) return
    if (typeof width !== 'number' || typeof height !== 'number') return
    const aspectRatio = normalizeCompanionAspectRatio(width, height)
    if (Math.abs(aspectRatio - this.aspectRatio) < 0.001) return
    this.aspectRatio = aspectRatio
    const size = companionWindowSize(this.sizePercent, aspectRatio)
    window.setSize(size.width, size.height)
    this.notify()
  }

  private installLive2DProtocol(): void {
    void protocol.handle('petwhale-live2d', (request) => {
      try {
        const url = new URL(request.url)
        const requestPath = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
        const resource = this.pets.resolveLive2DResource(url.hostname, requestPath)
        if (resource === null) return new Response('Not found', { status: 404 })
        return new Response(readFileSync(resource), {
          headers: {
            'Content-Type': live2DContentType(resource),
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'private, max-age=3600',
          },
        })
      } catch {
        return new Response('Bad request', { status: 400 })
      }
    })
  }
}

function live2DContentType(path: string): string {
  const extension = path.toLocaleLowerCase('en-US').split('.').pop()
  switch (extension) {
    case 'json': return 'application/json; charset=utf-8'
    case 'png': return 'image/png'
    case 'webp': return 'image/webp'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'wav': return 'audio/wav'
    case 'mp3': return 'audio/mpeg'
    case 'ogg': return 'audio/ogg'
    case 'm4a': return 'audio/mp4'
    case 'aac': return 'audio/aac'
    case 'flac': return 'audio/flac'
    case 'webm': return 'audio/webm'
    default: return 'application/octet-stream'
  }
}
