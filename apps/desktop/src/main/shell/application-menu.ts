import { Menu, type MenuItemConstructorOptions } from 'electron'

export interface ApplicationMenuActions {
  showMainWindow: () => void
  checkForUpdates: () => Promise<void>
  quit: () => void
}

export function installApplicationMenu(actions: ApplicationMenuActions): void {
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: 'Telos',
            submenu: [
              { role: 'about' },
              { label: '检查更新…', click: () => void actions.checkForUpdates() },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { label: '退出 Telos', accelerator: 'Command+Q', click: actions.quit },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: '文件',
      submenu: [
        { label: '打开主窗口', click: actions.showMainWindow },
        { type: 'separator' },
        process.platform === 'darwin'
          ? { role: 'close' }
          : { label: '退出 Telos', accelerator: 'Alt+F4', click: actions.quit },
      ],
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
        { role: 'selectAll' },
      ],
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
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: '窗口',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'front' }],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
