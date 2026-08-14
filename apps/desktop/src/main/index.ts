import { app, BrowserWindow, ipcMain, Menu, type MenuItemConstructorOptions } from 'electron'
import { join } from 'node:path'

const APP_INFO_CHANNEL = 'telos:system:get-app-info'

app.setName('TELOS')

function isTrustedRenderer(urlValue: string): boolean {
  const developmentUrl = process.env.ELECTRON_RENDERER_URL

  if (developmentUrl) {
    return new URL(urlValue).origin === new URL(developmentUrl).origin
  }

  return new URL(urlValue).protocol === 'file:'
}

function registerSystemHandlers(): void {
  ipcMain.handle(APP_INFO_CHANNEL, (event) => {
    const rendererUrl = event.senderFrame?.url

    if (!rendererUrl || !isTrustedRenderer(rendererUrl)) {
      throw new Error('Rejected IPC request from an untrusted renderer')
    }

    return {
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform
    }
  })
}

function installApplicationMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: 'TELOS',
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          } satisfies MenuItemConstructorOptions
        ]
      : []),
    {
      label: '文件',
      submenu: [{ role: process.platform === 'darwin' ? 'close' : 'quit' }]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: '窗口',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'front' }]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1060,
    minHeight: 700,
    backgroundColor: '#f7f7f6',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  const developmentUrl = process.env.ELECTRON_RENDERER_URL

  if (developmentUrl) {
    void window.loadURL(developmentUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  installApplicationMenu()
  registerSystemHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
