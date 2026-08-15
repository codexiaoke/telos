import { describe, expect, it, vi } from 'vitest'
import { apply, inject } from '../src/client/index.js'
import { MultimodalSettingsSection, routeValue } from '../src/client/MultimodalSettingsSection.js'
import { MediaProgressDock } from '../src/client/MediaProgressDock.js'
import type { ModelCatalogEntry } from '../src/contracts.js'

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
      name: 'conversation.input.dock', id: 'telos-multimodal-progress', order: 10, component: MediaProgressDock,
    }), expect.objectContaining({
      name: 'settings.section', id: 'multimodal', order: 20, label: '多模态', component: MultimodalSettingsSection,
    })])
  })

  it('uses the same select value for a catalog entry and its persisted model route', () => {
    const catalogEntry: ModelCatalogEntry = {
      provider: 'qwen-dashscope',
      model: 'qwen3.7-flash',
      name: 'Qwen 3.7 Flash',
      inputModalities: ['text', 'image'],
    }

    expect(routeValue(catalogEntry)).toBe(routeValue({
      provider: catalogEntry.provider,
      model: catalogEntry.model,
    }))
    expect(routeValue(catalogEntry)).toBe('{"provider":"qwen-dashscope","model":"qwen3.7-flash"}')
  })
})
