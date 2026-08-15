import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { decodeLogicalModel } from '../src/routes.js'
import { buildModelCatalog, buildSettingsView, MultimodalSettingsService } from '../src/service.js'
import { defaultMultimodalSettings, MultimodalSettingsStore } from '../src/store.js'

const roots: string[] = []
const llm = {
  listProviders: () => [
    { id: 'deepseek', name: 'DeepSeek' },
    { id: 'vision', name: 'Vision' },
    { id: 'telos-multimodal', name: 'Telos' },
    { id: 'broken', name: 'Broken' },
  ],
  listModels: async (provider: string) => {
    if (provider === 'broken') throw new Error('catalog offline')
    if (provider === 'vision') return [{ provider, id: 'eyes', name: 'Eyes', inputModalities: ['text', 'image'] as const }]
    return [{ provider, id: 'reasoner', name: 'Reasoner', inputModalities: ['text'] as const }]
  },
  resolveModelInfo: async (provider: string, model: string) => {
    if (provider === 'missing') throw new Error('provider missing')
    return { provider, id: model, name: model === 'eyes' ? 'Eyes' : 'Reasoner', inputModalities: provider === 'vision' ? ['text', 'image'] as const : ['text'] as const }
  },
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function serviceWith(settings = defaultMultimodalSettings()): MultimodalSettingsService {
  const root = mkdtempSync(join(tmpdir(), 'telos-mm-service-'))
  roots.push(root)
  const store = new MultimodalSettingsStore(join(root, 'settings.json'))
  store.save(settings)
  return new MultimodalSettingsService({ llm } as never, store)
}

function routeRequest(current: { provider: string; model: string; reasoningEffort?: string }, imageCount = 1) {
  return { current, sessionId: 'session-1', imageCount }
}

describe('MultimodalSettingsService', () => {
  it('keeps sound provider groups, excludes its logical provider, and reports catalog failures', async () => {
    const catalog = await buildModelCatalog({ llm } as never)
    expect(catalog.find(group => group.id === 'vision')?.models[0]).toMatchObject({ model: 'eyes', inputModalities: ['text', 'image'] })
    expect(catalog.find(group => group.id === 'broken')).toMatchObject({ models: [], failure: 'catalog offline' })
    expect(catalog.some(group => group.id === 'telos-multimodal')).toBe(false)
  })

  it('only marks a declared image model as available', async () => {
    const catalog = await buildModelCatalog({ llm } as never)
    expect(buildSettingsView(defaultMultimodalSettings(), catalog).defaultModelStatus.state).toBe('unconfigured')
    expect(buildSettingsView({ schemaVersion: 2, enabled: true, defaultModel: { provider: 'deepseek', model: 'reasoner' } }, catalog).defaultModelStatus.state).toBe('incompatible')
    expect(buildSettingsView({ schemaVersion: 2, enabled: true, defaultModel: { provider: 'vision', model: 'eyes' } }, catalog)).toMatchObject({
      defaultModelStatus: { state: 'available' }, runtimePhase: 'image-routing',
    })
  })

  it('keeps native image routes and bridges a text route through one logical provider model', async () => {
    const service = serviceWith({ schemaVersion: 2, enabled: true, defaultModel: { provider: 'vision', model: 'eyes' } })
    await expect(service.resolveImageRoute(routeRequest({ provider: 'vision', model: 'eyes' }))).resolves.toEqual({
      kind: 'native', route: { provider: 'vision', model: 'eyes' },
    })
    const bridge = await service.resolveImageRoute(routeRequest({ provider: 'deepseek', model: 'reasoner', reasoningEffort: 'high' }))
    expect(bridge).toMatchObject({
      kind: 'bridge',
      route: { provider: 'telos-multimodal', reasoningEffort: 'high' },
      perceptionRoute: { provider: 'vision', model: 'eyes' },
      operationId: expect.any(String),
    })
    if (bridge.kind === 'bridge') expect(decodeLogicalModel(bridge.route.model)).toEqual({ provider: 'deepseek', model: 'reasoner' })
    if (bridge.kind === 'bridge') {
      const next = await service.resolveImageRoute(routeRequest(bridge.route))
      expect(next).toMatchObject({
        kind: 'bridge', routeName: 'Reasoner', route: { provider: 'telos-multimodal' },
      })
      if (next.kind === 'bridge') {
        expect(next.operationId).not.toBe(bridge.operationId)
        expect(next.route.model).toBe(bridge.route.model)
      }
    }
  })

  it('fails before admission when a text model has no usable default', async () => {
    await expect(serviceWith().resolveImageRoute(routeRequest({ provider: 'deepseek', model: 'reasoner' }))).rejects.toThrow(/设置 → 多模态/u)
    await expect(serviceWith({ schemaVersion: 2, enabled: true, defaultModel: { provider: 'deepseek', model: 'reasoner' } })
      .resolveImageRoute(routeRequest({ provider: 'deepseek', model: 'reasoner' }))).rejects.toThrow(/没有声明图片/u)
  })

  it('declares a selected custom pi-ai model as text plus image through the Settings API', async () => {
    const root = mkdtempSync(join(tmpdir(), 'telos-mm-service-'))
    roots.push(root)
    let input = ['text']
    const mutate = async (_namespace: unknown, operations: Array<{ value?: unknown }>) => {
      const nextModels = operations[0]?.value as Array<{ id: string; input?: string[] }>
      input = nextModels[0]?.input ?? []
    }
    const customLlm = {
      listProviders: () => [{ id: 'qwen', name: 'Qwen' }],
      listModels: async () => [{ provider: 'qwen', id: 'flash', name: 'Flash', inputModalities: input }],
      resolveModelInfo: async () => ({ provider: 'qwen', id: 'flash', name: 'Flash', inputModalities: input }),
    }
    const customSettings = {
      get: () => ({ providers: { qwen: { models: [{ id: 'flash' }] } } }),
      mutate,
    }
    const service = new MultimodalSettingsService(
      { llm: customLlm, settings: customSettings } as never,
      new MultimodalSettingsStore(join(root, 'settings.json')),
    )
    const view = await service.save({
      schemaVersion: 2, enabled: true, defaultModel: { provider: 'qwen', model: 'flash' },
    })
    expect(input).toEqual(['text', 'image'])
    expect(view.defaultModelStatus.state).toBe('available')
  })

  it('preserves sibling custom models when declaring image capability', async () => {
    const root = mkdtempSync(join(tmpdir(), 'telos-mm-service-'))
    roots.push(root)
    const models = [
      { id: 'text-model', input: ['text'], maxTokens: 1_000 },
      { id: 'vision-model', name: 'Vision', input: ['text'], maxTokens: 2_000 },
    ]
    let written: typeof models | undefined
    const customLlm = {
      listProviders: () => [{ id: 'qwen', name: 'Qwen' }],
      listModels: async () => [{ provider: 'qwen', id: 'vision-model', name: 'Vision', inputModalities: written?.[1]?.input ?? ['text'] }],
      resolveModelInfo: async () => ({ provider: 'qwen', id: 'vision-model', name: 'Vision', inputModalities: written?.[1]?.input ?? ['text'] }),
    }
    const customSettings = {
      get: () => ({ providers: { qwen: { models } } }),
      mutate: async (_namespace: unknown, operations: Array<{ path: string[]; value?: unknown }>) => {
        expect(operations[0]?.path).toEqual(['providers', 'qwen', 'models'])
        written = operations[0]?.value as typeof models
      },
    }
    const service = new MultimodalSettingsService(
      { llm: customLlm, settings: customSettings } as never,
      new MultimodalSettingsStore(join(root, 'settings.json')),
    )

    await service.save({ schemaVersion: 2, enabled: true, defaultModel: { provider: 'qwen', model: 'vision-model' } })

    expect(written).toEqual([
      models[0],
      { ...models[1], input: ['text', 'image'] },
    ])
  })

  it('saves and resets through the loopback service contract', async () => {
    const service = serviceWith()
    const settings = { schemaVersion: 2 as const, enabled: false }
    expect((await service.handle('save', settings) as { settings: { enabled: boolean } }).settings.enabled).toBe(false)
    expect((await service.handle('reset', {}) as { settings: { enabled: boolean } }).settings.enabled).toBe(true)
    await expect(service.handle('unknown', {})).rejects.toThrow(/unknown multimodal endpoint/u)
  })
})
