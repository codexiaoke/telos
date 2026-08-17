import {
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  protocol,
  shell,
  type IpcMainEvent,
  type MenuItemConstructorOptions,
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
import type { CompanionConfig, CompanionSnapshot } from '../../shared/companion.js'
import { IPC_CHANNELS } from '../ipc/channels.js'

const PET_SIZES: Record<PetSettings['size'], { width: number; height: number }> = {
  small: { width: 200, height: 253 },
  large: { width: 300, height: 380 },
}

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
  private customPets: CustomPetRecord[]
  private tracker = new PetStateTracker()
  private window: BrowserWindow | undefined
  private socket: WebSocket | undefined
  private dshUrl: string | undefined
  private reconnectTimer: NodeJS.Timeout | undefined
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
    this.settings = this.loadSettings()
    if (
      this.settings.pet.startsWith('custom:')
      && !this.customPets.some(pet => pet.id === this.settings.pet)
    ) {
      this.settings = { ...this.settings, pet: 'orb' }
      this.saveSettings()
    }
    this.installLive2DProtocol()
    ipcMain.on(IPC_CHANNELS.companionMenu, this.handleMenu)
    ipcMain.on(IPC_CHANNELS.companionRendererError, this.handleRendererError)
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
    ipcMain.removeListener(IPC_CHANNELS.companionRendererError, this.handleRendererError)
    protocol.unhandle('petwhale-live2d')
    this.window?.destroy()
    this.window = undefined
    this.observers.clear()
  }

  private loadSettings(): PetSettings {
    try {
      return normalizePetSettings(JSON.parse(readFileSync(this.settingsPath, 'utf8')))
    } catch {
      return { ...DEFAULT_PET_SETTINGS }
    }
  }

  private saveSettings(): void {
    try {
      mkdirSync(this.rootPath, { recursive: true })
      writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2))
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
    const size = PET_SIZES[this.settings.size]
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
    const socket = new WebSocket(`${baseUrl.replace(/^http/, 'ws')}/api/events.host`)
    this.socket = socket
    socket.onopen = () => {
      if (this.socket !== socket) return
      this.connected = true
      this.notify()
    }
    socket.onmessage = (event) => {
      if (this.socket !== socket) return
      const frame = parseHostFrame(event.data)
      if (frame === null) return
      this.tracker.ingest(frame)
      this.pushState()
    }
    socket.onclose = () => {
      if (this.socket !== socket) return
      this.socket = undefined
      this.connected = false
      this.notify()
      this.scheduleReconnect(baseUrl)
    }
    socket.onerror = () => socket.close()
  }

  private scheduleReconnect(baseUrl: string): void {
    if (this.disposed || this.dshUrl !== baseUrl || this.reconnectTimer !== undefined) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined
      this.connect(baseUrl)
    }, 2_000)
  }

  private disconnect(): void {
    if (this.reconnectTimer !== undefined) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = undefined
    const socket = this.socket
    this.socket = undefined
    socket?.close()
    this.connected = false
    this.notify()
  }

  private pushState(): void {
    const window = this.window
    if (window === undefined || window.isDestroyed() || window.webContents.isDestroyed()) return
    const snapshot: CompanionSnapshot = {
      ...this.tracker.getSnapshot(),
      context: { ...this.tracker.getSnapshot().context, host: 'telos' },
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
  }

  private toggleVisible(): void {
    const window = this.openWindow()
    if (window.isVisible()) window.hide()
    else window.showInactive()
    this.notify()
  }

  private setLocked(locked: boolean): void {
    this.settings = { ...this.settings, locked }
    this.saveSettings()
    this.pushConfig()
    this.notify()
  }

  private toggleSize(): void {
    const size = this.settings.size === 'large' ? 'small' : 'large'
    this.settings = { ...this.settings, size }
    this.saveSettings()
    const window = this.window
    if (window !== undefined && !window.isDestroyed()) {
      window.setSize(PET_SIZES[size].width, PET_SIZES[size].height)
    }
    this.pushConfig()
    this.notify()
  }

  private setPet(pet: PetChoiceId): void {
    if (pet.startsWith('custom:') && !this.customPets.some(candidate => candidate.id === pet)) return
    this.settings = { ...this.settings, pet }
    this.saveSettings()
    this.pushConfig()
    this.notify()
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
      {
        label: this.settings.size === 'large' ? '切换为小尺寸' : '切换为大尺寸',
        click: () => this.toggleSize(),
      },
      {
        label: '更换宠物',
        submenu: [
          ...petMenuOptions(this.settings.pet, this.customPets).map(option => ({
            label: option.label,
            type: 'radio' as const,
            checked: option.checked,
            click: () => this.setPet(option.id),
          })),
          { type: 'separator' as const },
          { label: '导入图片宠物…', click: () => void this.importImage() },
          { label: '导入 Live2D 宠物…', click: () => void this.importLive2D() },
        ],
      },
      ...(this.customPets.length === 0
        ? []
        : [{
            label: '删除自定义宠物',
            submenu: this.customPets.map(pet => ({
              label: pet.label,
              click: () => void this.removePet(pet),
            })),
          } satisfies MenuItemConstructorOptions]),
      { type: 'separator' },
      { label: this.connected ? '已连接 Agent 状态' : '等待 Agent Runtime', enabled: false },
    ]
  }

  private readonly handleMenu = (event: IpcMainEvent): void => {
    if (this.window === undefined || this.window.isDestroyed() || event.sender.id !== this.window.webContents.id) return
    Menu.buildFromTemplate(this.menuItems()).popup({ window: this.window })
  }

  private readonly handleRendererError = (event: IpcMainEvent, message: unknown): void => {
    if (this.window === undefined || this.window.isDestroyed() || event.sender.id !== this.window.webContents.id) return
    if (typeof message !== 'string' || message.length === 0 || message.length > 500) return
    this.options.logger.error('Companion renderer failed', message)
    if (this.settings.pet !== 'orb') this.setPet('orb')
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
    default: return 'application/octet-stream'
  }
}
