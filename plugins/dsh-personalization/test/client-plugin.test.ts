import { describe, expect, it, vi } from 'vitest'
import { apply, inject } from '../src/client/index.js'
import { PersonalizationSettingsSection } from '../src/client/PersonalizationSettingsSection.js'

describe('personalization Client plugin', () => {
  it('registers one additive Settings section', () => {
    const registrations: Array<Record<string, unknown>> = []
    const ctx = {
      connection: { rpc: { call: vi.fn() } },
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
    expect(inject).toEqual(['slots', 'connection'])
    expect(registrations).toEqual([expect.objectContaining({
      name: 'settings.section', id: 'personalization', order: 15, label: '个性化', component: PersonalizationSettingsSection,
    })])
  })
})
