import { describe, expect, it, vi } from 'vitest'
import { apply, inject } from '../src/client/index.js'
import { ContinuitySettingsSection } from '../src/client/ContinuityViews.js'

describe('continuity client plugin', () => {
  it('exposes memory management only as a Settings section', () => {
    const registrations: Array<{
      name: string
      id?: string
      order?: number
      label?: string
      component: unknown
    }> = []
    const ctx = {
      connection: { rpc: { call: vi.fn() } },
      effect: vi.fn(),
      slots: {
        inject: (_name: string, register: () => unknown) => register(),
        register: (options: { name: string; id?: string; order?: number; label?: string }, component: unknown) => {
          registrations.push({ ...options, component })
          return () => undefined
        },
      },
    }

    apply(ctx as never)

    expect(inject).toEqual(['slots', 'connection'])
    expect(registrations).toEqual([expect.objectContaining({
      name: 'settings.section',
      id: 'memory',
      order: 30,
      label: '记忆',
      component: ContinuitySettingsSection,
    })])
    expect(registrations.some(entry => entry.name === 'sidebar.footer.action')).toBe(false)
    expect(registrations.some(entry => entry.name === 'conversation.session.header.utilities')).toBe(false)
    expect(registrations.some(entry => entry.name === 'shell.overlay')).toBe(false)
  })
})
