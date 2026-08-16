import { describe, expect, it, vi } from 'vitest'
import { configureApplicationProfile, type ApplicationProfileHost } from './application-profile.js'

function createHost(isPackaged: boolean): ApplicationProfileHost {
  return {
    isPackaged,
    getPath: vi.fn(() => '/profiles'),
    setPath: vi.fn(),
  }
}

describe('configureApplicationProfile', () => {
  it('keeps the default profile for packaged applications', () => {
    const host = createHost(true)
    const ensureDirectory = vi.fn()

    expect(configureApplicationProfile(host, ensureDirectory)).toEqual({ kind: 'production' })
    expect(host.getPath).not.toHaveBeenCalled()
    expect(host.setPath).not.toHaveBeenCalled()
    expect(ensureDirectory).not.toHaveBeenCalled()
  })

  it('isolates source development from the production profile and lock', () => {
    const host = createHost(false)
    const ensureDirectory = vi.fn()

    expect(configureApplicationProfile(host, ensureDirectory)).toEqual({
      kind: 'development',
      userDataPath: '/profiles/Telos Dev',
    })
    expect(ensureDirectory).toHaveBeenCalledWith('/profiles/Telos Dev')
    expect(host.setPath).toHaveBeenCalledWith('userData', '/profiles/Telos Dev')
  })
})
