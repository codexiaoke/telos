import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const DEVELOPMENT_PROFILE_DIRECTORY = 'Telos Dev'

export interface ApplicationProfileHost {
  readonly isPackaged: boolean
  getPath: (name: 'appData') => string
  setPath: (name: 'userData', path: string) => void
}

export interface ApplicationProfile {
  kind: 'production' | 'development'
  userDataPath?: string
}

/**
 * Give source development its own persistent profile before Electron acquires
 * the single-instance lock. Production keeps Electron's normal Telos profile,
 * while development can run alongside it without sharing mutable DSH state.
 */
export function configureApplicationProfile(
  application: ApplicationProfileHost,
  ensureDirectory: (path: string) => void = path => mkdirSync(path, { recursive: true }),
): ApplicationProfile {
  if (application.isPackaged) return { kind: 'production' }

  const userDataPath = join(application.getPath('appData'), DEVELOPMENT_PROFILE_DIRECTORY)
  ensureDirectory(userDataPath)
  application.setPath('userData', userDataPath)
  return { kind: 'development', userDataPath }
}
