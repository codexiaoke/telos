import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildModelCatalog, buildSettingsView, MultimodalSettingsService } from '../src/service.js'
import { defaultMultimodalSettings, MultimodalSettingsStore } from '../src/store.js'

const roots: string[] = []
const llm = {
  listProviders: () => [{ id: 'deepseek', name: 'DeepSeek' }, { id: 'vision', name: 'Vision' }, { id: 'broken', name: 'Broken' }],
  listModels: async (provider: string) => {
    if (provider === 'broken') throw new Error('catalog offline')
    if (provider === 'vision') return [{ provider, id: 'eyes', name: 'Eyes', inputModalities: ['text', 'image'] as const }]
    return [{ provider, id: 'reasoner', name: 'Reasoner', inputModalities: ['text'] as const }]
  },
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('MultimodalSettingsService', () => {
  it('keeps sound provider groups when one catalog fails', async () => {
    const catalog = await buildModelCatalog({ llm } as never)
    expect(catalog.find(group => group.id === 'vision')?.models[0]).toMatchObject({ model: 'eyes', inputModalities: ['text', 'image'] })
    expect(catalog.find(group => group.id === 'broken')).toMatchObject({ models: [], failure: 'catalog offline' })
  })

  it('distinguishes image-capable, incompatible, and unverified routes', async () => {
    const catalog = await buildModelCatalog({ llm } as never)
    const settings = defaultMultimodalSettings()
    settings.routes['image-understanding'] = { mode: 'fixed', route: { provider: 'vision', model: 'eyes' } }
    settings.routes.ocr = { mode: 'fixed', route: { provider: 'deepseek', model: 'reasoner' } }
    settings.routes['speech-to-text'] = { mode: 'fixed', route: { provider: 'local-whisper', model: 'large-v3' } }
    const view = buildSettingsView(settings, catalog)
    expect(view.routeStatuses['image-understanding'].state).toBe('available')
    expect(view.routeStatuses.ocr.state).toBe('incompatible')
    expect(view.routeStatuses['speech-to-text'].state).toBe('unverified')
    expect(view.runtimePhase).toBe('configuration-only')
  })

  it('saves and resets through the loopback service contract', async () => {
    const root = mkdtempSync(join(tmpdir(), 'telos-mm-service-'))
    roots.push(root)
    const service = new MultimodalSettingsService({ llm } as never, new MultimodalSettingsStore(join(root, 'settings.json')))
    const settings = defaultMultimodalSettings()
    settings.enabled = false
    expect((await service.handle('save', settings)).settings.enabled).toBe(false)
    expect((await service.handle('reset', {})).settings.enabled).toBe(true)
    await expect(service.handle('unknown', {})).rejects.toThrow(/unknown multimodal endpoint/u)
  })
})
