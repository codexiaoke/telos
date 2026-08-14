import type { AppUpdater, ProgressInfo, UpdateDownloadedEvent, UpdateInfo } from 'electron-updater'
import type { UpdateSnapshot } from '../../shared/update.js'
import type { ApplicationLogger } from '../logging/application-logger.js'

const DEFAULT_STARTUP_DELAY_MS = 30_000
const DEFAULT_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000

export interface UpdateServiceOptions {
  enabled: boolean
  updater?: AppUpdater
  logger: ApplicationLogger
  startupDelayMs?: number
  checkIntervalMs?: number
}

function safeErrorDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/\b(?:ghp_|github_pat_)[A-Za-z0-9_]+\b/g, '[redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, 'sk-[redacted]')
}

export class UpdateService {
  private snapshot: UpdateSnapshot
  private readonly observers = new Set<(snapshot: UpdateSnapshot) => void>()
  private startupTimer: NodeJS.Timeout | undefined
  private intervalTimer: NodeJS.Timeout | undefined

  constructor(private readonly options: UpdateServiceOptions) {
    this.snapshot = { status: options.enabled ? 'idle' : 'disabled' }
    if (!options.enabled || options.updater === undefined) return

    options.updater.autoDownload = false
    options.updater.autoInstallOnAppQuit = false
    options.updater.allowPrerelease = false
    options.updater.on('checking-for-update', () => this.publish({ status: 'checking' }))
    options.updater.on('update-available', info => this.onAvailable(info))
    options.updater.on('update-not-available', info => this.onNotAvailable(info))
    options.updater.on('download-progress', info => this.onDownloadProgress(info))
    options.updater.on('update-downloaded', info => this.onDownloaded(info))
    options.updater.on('error', error => this.fail(error))
  }

  getSnapshot(): UpdateSnapshot {
    return { ...this.snapshot }
  }

  subscribe(observer: (snapshot: UpdateSnapshot) => void): () => void {
    this.observers.add(observer)
    observer(this.getSnapshot())
    return () => this.observers.delete(observer)
  }

  start(): void {
    if (!this.options.enabled || this.options.updater === undefined || this.startupTimer !== undefined) return

    this.startupTimer = setTimeout(() => {
      this.startupTimer = undefined
      void this.checkForUpdates()
    }, this.options.startupDelayMs ?? DEFAULT_STARTUP_DELAY_MS)
    this.startupTimer.unref()

    this.intervalTimer = setInterval(() => {
      void this.checkForUpdates()
    }, this.options.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS)
    this.intervalTimer.unref()
  }

  stop(): void {
    if (this.startupTimer !== undefined) clearTimeout(this.startupTimer)
    if (this.intervalTimer !== undefined) clearInterval(this.intervalTimer)
    this.startupTimer = undefined
    this.intervalTimer = undefined
  }

  async checkForUpdates(): Promise<void> {
    const updater = this.options.updater
    if (!this.options.enabled || updater === undefined) return
    if (this.snapshot.status === 'checking' || this.snapshot.status === 'downloading') return

    this.publish({ status: 'checking' })
    try {
      await updater.checkForUpdates()
    } catch (error: unknown) {
      this.fail(error)
    }
  }

  async downloadUpdate(): Promise<void> {
    const updater = this.options.updater
    if (!this.options.enabled || updater === undefined || this.snapshot.status !== 'available') return

    this.publish({
      status: 'downloading',
      ...(this.snapshot.version === undefined ? {} : { version: this.snapshot.version }),
      progressPercent: 0,
    })
    try {
      await updater.downloadUpdate()
    } catch (error: unknown) {
      this.fail(error)
    }
  }

  installUpdate(): void {
    if (!this.options.enabled || this.options.updater === undefined || this.snapshot.status !== 'downloaded') return
    this.options.updater.quitAndInstall(false, true)
  }

  private onAvailable(info: UpdateInfo): void {
    this.options.logger.info(`Telos update ${info.version} is available`)
    this.publish({
      status: 'available',
      version: info.version,
      checkedAt: new Date().toISOString(),
    })
  }

  private onNotAvailable(info: UpdateInfo): void {
    this.options.logger.info(`Telos is current at ${info.version}`)
    this.publish({
      status: 'not-available',
      version: info.version,
      checkedAt: new Date().toISOString(),
    })
  }

  private onDownloadProgress(info: ProgressInfo): void {
    this.publish({
      status: 'downloading',
      ...(this.snapshot.version === undefined ? {} : { version: this.snapshot.version }),
      progressPercent: Math.max(0, Math.min(100, info.percent)),
    })
  }

  private onDownloaded(info: UpdateDownloadedEvent): void {
    this.options.logger.info(`Telos update ${info.version} is ready to install`)
    this.publish({
      status: 'downloaded',
      version: info.version,
      progressPercent: 100,
    })
  }

  private fail(error: unknown): void {
    const detail = safeErrorDetail(error)
    this.options.logger.error('Telos update failed', detail)
    this.publish({ status: 'error', detail })
  }

  private publish(snapshot: UpdateSnapshot): void {
    this.snapshot = snapshot
    for (const observer of this.observers) {
      try {
        observer(this.getSnapshot())
      } catch (error: unknown) {
        this.options.logger.warn('An update observer failed', safeErrorDetail(error))
      }
    }
  }
}
