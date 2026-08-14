import { EventEmitter } from 'node:events'
import type { AppUpdater, UpdateDownloadedEvent, UpdateInfo } from 'electron-updater'
import { describe, expect, it, vi } from 'vitest'
import type { ApplicationLogger } from '../logging/application-logger.js'
import { UpdateService } from './update-service.js'

function createLogger(): ApplicationLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}

function createUpdater(): AppUpdater {
  const emitter = new EventEmitter()
  return Object.assign(emitter, {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    allowPrerelease: true,
    checkForUpdates: vi.fn().mockResolvedValue(null),
    downloadUpdate: vi.fn().mockResolvedValue([]),
    quitAndInstall: vi.fn(),
  }) as unknown as AppUpdater
}

function updateInfo(version: string): UpdateInfo {
  return {
    version,
    files: [],
    path: '',
    sha512: '',
    releaseDate: '2026-08-15T00:00:00.000Z',
  }
}

describe('UpdateService', () => {
  it('keeps development builds disabled', async () => {
    const updater = createUpdater()
    const service = new UpdateService({ enabled: false, updater, logger: createLogger() })

    await service.checkForUpdates()

    expect(service.getSnapshot()).toEqual({ status: 'disabled' })
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('requires explicit download and install actions', async () => {
    const updater = createUpdater()
    const service = new UpdateService({ enabled: true, updater, logger: createLogger() })

    expect(updater.autoDownload).toBe(false)
    expect(updater.autoInstallOnAppQuit).toBe(false)
    expect(updater.allowPrerelease).toBe(false)

    await service.checkForUpdates()
    expect(service.getSnapshot().status).toBe('checking')

    updater.emit('update-available', updateInfo('0.2.0'))
    expect(service.getSnapshot()).toMatchObject({ status: 'available', version: '0.2.0' })

    await service.downloadUpdate()
    expect(updater.downloadUpdate).toHaveBeenCalledOnce()
    expect(service.getSnapshot()).toMatchObject({ status: 'downloading', progressPercent: 0 })

    updater.emit('download-progress', {
      percent: 53.4,
      total: 100,
      delta: 10,
      transferred: 53.4,
      bytesPerSecond: 1_024,
    })
    expect(service.getSnapshot()).toMatchObject({ status: 'downloading', progressPercent: 53.4 })

    updater.emit('update-downloaded', {
      ...updateInfo('0.2.0'),
      downloadedFile: '/tmp/telos-update.zip',
    } satisfies UpdateDownloadedEvent)
    expect(service.getSnapshot()).toMatchObject({ status: 'downloaded', version: '0.2.0' })

    service.installUpdate()
    expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true)
  })

  it('redacts credentials from observable errors', () => {
    const updater = createUpdater()
    const logger = createLogger()
    const service = new UpdateService({ enabled: true, updater, logger })

    updater.emit('error', new Error('request failed for github_pat_secretvalue and sk-abcdefgh12345678'))

    expect(service.getSnapshot()).toEqual({
      status: 'error',
      detail: 'request failed for [redacted] and sk-[redacted]',
    })
    expect(logger.error).toHaveBeenCalled()
  })
})
