import { describe, expect, it, vi } from 'vitest'
import { apply, inject } from '../src/client/index.js'
import { MultimodalSettingsSection } from '../src/client/MultimodalSettingsSection.js'

describe('multimodal Client plugin', () => {
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
    expect(inject).toEqual(['slots', 'connection', 'conversation', 'modelDirectories', 'sessions'])
    expect(registrations).toEqual([expect.objectContaining({
      name: 'settings.section', id: 'multimodal', order: 20, label: '多模态', component: MultimodalSettingsSection,
    })])
  })
})
