import { describe, expect, it, vi } from 'vitest'
import { CompanionSettingsSection } from '../src/client/CompanionSettingsSection.js'
import { apply, inject } from '../src/client/index.js'

describe('companion Client plugin', () => {
  it('registers a desktop pet Settings section', () => {
    const registrations: Array<Record<string, unknown>> = []
    const ctx = {
      effect: vi.fn(),
      slots: {
        inject: (_name: string, register: () => unknown) => register(),
        register: (options: Record<string, unknown>, component: unknown) => {
          registrations.push({ ...options, component })
          return () => undefined
        },
      },
    }
    apply(ctx as never)
    expect(inject).toEqual(['slots'])
    expect(registrations).toEqual([expect.objectContaining({
      name: 'settings.section', id: 'companion', order: 12, label: '桌面宠物', component: CompanionSettingsSection,
    })])
  })
})
