import log from 'electron-log/main'

export type ApplicationLogger = Pick<typeof log, 'debug' | 'info' | 'warn' | 'error'>

export function configureApplicationLogger(isPackaged: boolean): typeof log {
  log.initialize({ preload: false })
  log.transports.file.level = 'info'
  log.transports.console.level = isPackaged ? 'warn' : 'debug'
  log.errorHandler.startCatching({ showDialog: false })
  return log
}
