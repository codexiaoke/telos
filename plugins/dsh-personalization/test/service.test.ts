import { describe, expect, it, vi } from 'vitest'
import { PersonalizationService } from '../src/service.js'

describe('PersonalizationService', () => {
  it('returns a settings-ready view and persists saves', () => {
    const store = {
      load: vi.fn(() => ''),
      save: vi.fn((value: unknown) => value as string),
      reset: vi.fn(() => ''),
    }
    const service = new PersonalizationService(store as never)
    expect(service.handle('get', {})).toEqual({ instructions: '', configured: false, byteLength: 0, maxBytes: 65_536 })
    expect(service.handle('save', { instructions: '请使用中文' })).toEqual(expect.objectContaining({
      instructions: '请使用中文', configured: true, byteLength: 15,
    }))
    expect(store.save).toHaveBeenCalledWith('请使用中文')
  })

  it('rejects malformed payloads and unknown endpoints', () => {
    const service = new PersonalizationService({ load: vi.fn(), save: vi.fn(), reset: vi.fn() } as never)
    expect(() => service.handle('save', null)).toThrow('payload must be an object')
    expect(() => service.handle('unknown', {})).toThrow('unsupported personalization endpoint')
  })
})
