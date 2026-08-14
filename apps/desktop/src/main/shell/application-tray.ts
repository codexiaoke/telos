import { Menu, Tray, nativeImage, type MenuItemConstructorOptions } from 'electron'
import type { UpdateSnapshot } from '../../shared/update.js'

export interface ApplicationTrayActions {
  showMainWindow: () => void
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  installUpdate: () => void
  quit: () => void
  getUpdateSnapshot: () => UpdateSnapshot
  subscribeToUpdates: (observer: (snapshot: UpdateSnapshot) => void) => () => void
}

export interface ApplicationTrayHandle {
  destroy: () => void
}

export function describeUpdate(snapshot: UpdateSnapshot): string {
  switch (snapshot.status) {
    case 'disabled': return '开发环境不检查更新'
    case 'idle': return '尚未检查更新'
    case 'checking': return '正在检查更新…'
    case 'available': return `发现新版本 ${snapshot.version ?? ''}`.trim()
    case 'not-available': return 'TELOS 已是最新版本'
    case 'downloading': return `正在下载更新 ${Math.round(snapshot.progressPercent ?? 0)}%`
    case 'downloaded': return `版本 ${snapshot.version ?? ''} 已准备安装`.trim()
    case 'error': return '更新检查失败'
  }
}

function createTrayIcon(): Electron.NativeImage {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">',
    '<path fill="#000" d="M5 5h22v5h-8.5v17h-5V10H5z"/>',
    '</svg>',
  ].join('')
  const image = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`)
  const resized = image.resize({ width: 18, height: 18 })
  if (process.platform === 'darwin') resized.setTemplateImage(true)
  return resized
}

export function createApplicationTray(actions: ApplicationTrayActions): ApplicationTrayHandle {
  const tray = new Tray(createTrayIcon())
  tray.setToolTip('TELOS')

  const rebuildMenu = (): void => {
    const update = actions.getUpdateSnapshot()
    const template: MenuItemConstructorOptions[] = [
      { label: '打开 TELOS', click: actions.showMainWindow },
      { type: 'separator' },
      { label: describeUpdate(update), enabled: false },
      {
        label: '检查更新',
        enabled: update.status !== 'disabled' && update.status !== 'checking' && update.status !== 'downloading',
        click: () => void actions.checkForUpdates(),
      },
      ...(update.status === 'available'
        ? [{ label: `下载 ${update.version ?? '新版本'}`, click: () => void actions.downloadUpdate() } satisfies MenuItemConstructorOptions]
        : []),
      ...(update.status === 'downloaded'
        ? [{ label: '重启并安装更新', click: actions.installUpdate } satisfies MenuItemConstructorOptions]
        : []),
      { type: 'separator' },
      { label: '退出 TELOS', click: actions.quit },
    ]
    tray.setContextMenu(Menu.buildFromTemplate(template))
  }

  tray.on('click', actions.showMainWindow)
  rebuildMenu()
  const unsubscribe = actions.subscribeToUpdates(rebuildMenu)

  return {
    destroy: () => {
      unsubscribe()
      tray.destroy()
    },
  }
}
