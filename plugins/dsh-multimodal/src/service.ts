import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-llm'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  TELOS_MULTIMODAL_PROVIDER,
  type ImageRouteRequest,
  type ImageRouteResolution,
  type ModelCatalogEntry,
  type ModelProviderGroup,
  type ModelRoute,
  type ModelSelectionRoute,
  type MultimodalSettings,
  type MultimodalSettingsView,
  type RouteStatus,
} from './contracts.js'
import { MediaProgressRegistry } from './progress.js'
import { decodeLogicalModel, logicalSelection } from './routes.js'
import { MultimodalSettingsStore, parseMultimodalSettings } from './store.js'

const PI_AI_SETTINGS = settingsNamespace('llm-pi-ai')

interface PiAiSettings {
  providers?: Record<string, { models?: Array<{ id?: string; input?: string[] }> }>
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export class MultimodalRouteUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MultimodalRouteUnavailableError'
  }
}

export async function buildModelCatalog(ctx: Pick<Context, 'llm'>): Promise<ModelProviderGroup[]> {
  const providers = ctx.llm.listProviders().filter(provider => provider.id !== TELOS_MULTIMODAL_PROVIDER)
  return Promise.all(providers.map(async (provider) => {
    try {
      const models = await ctx.llm.listModels(provider.id)
      return {
        id: provider.id,
        name: provider.name,
        models: models.map((model): ModelCatalogEntry => ({
          provider: provider.id,
          model: model.id,
          name: model.name,
          ...(model.description === undefined ? {} : { description: model.description }),
          ...(model.inputModalities === undefined ? {} : { inputModalities: model.inputModalities }),
        })),
      }
    } catch (error) {
      return { id: provider.id, name: provider.name, models: [], failure: errorMessage(error) }
    }
  }))
}

function findModel(catalog: readonly ModelProviderGroup[], route: ModelRoute): ModelCatalogEntry | undefined {
  return catalog.find(group => group.id === route.provider)?.models.find(model => model.model === route.model)
}

function defaultModelStatus(settings: MultimodalSettings, catalog: readonly ModelProviderGroup[]): RouteStatus {
  const route = settings.defaultModel
  if (route === undefined) return { state: 'unconfigured', message: '尚未配置。文本模型发送图片时会保留草稿并提示配置。' }
  const model = findModel(catalog, route)
  if (model === undefined) return { state: 'unverified', message: '当前 DSH 模型目录中找不到该模型。' }
  if (model.inputModalities === undefined) return { state: 'unverified', message: '模型没有声明图片输入能力，不能作为默认多模态模型。' }
  if (!model.inputModalities.includes('image')) return { state: 'incompatible', message: '该模型明确声明不支持图片输入。' }
  return { state: 'available', message: '图片能力已由 DSH 模型目录确认。' }
}

export function buildSettingsView(
  settings: MultimodalSettings,
  catalog: ModelProviderGroup[],
): MultimodalSettingsView {
  return {
    settings,
    catalog,
    defaultModelStatus: defaultModelStatus(settings, catalog),
    runtimePhase: 'image-routing',
  }
}

export class MultimodalSettingsService {
  constructor(
    private readonly ctx: Pick<Context, 'llm' | 'settings'>,
    private readonly store: MultimodalSettingsStore,
    private readonly progress = new MediaProgressRegistry(),
  ) {}

  async getView(): Promise<MultimodalSettingsView> {
    return buildSettingsView(this.store.load(), await buildModelCatalog(this.ctx))
  }

  async save(value: unknown): Promise<MultimodalSettingsView> {
    const parsed = parseMultimodalSettings(value)
    if (parsed.enabled && parsed.defaultModel !== undefined) await this.ensureImageCapability(parsed.defaultModel)
    const settings = this.store.save(parsed)
    return buildSettingsView(settings, await buildModelCatalog(this.ctx))
  }

  async reset(): Promise<MultimodalSettingsView> {
    const settings = this.store.reset()
    return buildSettingsView(settings, await buildModelCatalog(this.ctx))
  }

  async resolveImageRoute(value: unknown): Promise<ImageRouteResolution> {
    const request = parseImageRouteRequest(value)
    const current = unwrapLogicalSelection(request.current)
    const settings = this.store.load()
    const currentInfo = await this.ctx.llm.resolveModelInfo(current.provider, current.model)
    if (currentInfo.inputModalities?.includes('image')) return { kind: 'native', route: current }
    if (!settings.enabled) {
      throw new MultimodalRouteUnavailableError('Telos 多模态路由已关闭；当前模型不支持图片。')
    }
    const fallback = settings.defaultModel
    if (fallback === undefined) {
      throw new MultimodalRouteUnavailableError('当前模型不支持图片，请先在“设置 → 多模态”配置默认多模态模型。')
    }
    let fallbackInfo
    try {
      fallbackInfo = await this.ctx.llm.resolveModelInfo(fallback.provider, fallback.model)
    } catch (error) {
      throw new MultimodalRouteUnavailableError(`默认多模态模型不可用：${errorMessage(error)}`)
    }
    if (!fallbackInfo.inputModalities?.includes('image')) {
      throw new MultimodalRouteUnavailableError('默认多模态模型没有声明图片输入能力，请重新配置。')
    }
    const operation = this.progress.enqueue({
      sessionId: request.sessionId,
      kind: 'image',
      count: request.imageCount,
      perceptionRoute: fallback,
      perceptionName: fallbackInfo.name,
    })
    return {
      kind: 'bridge',
      route: logicalSelection(current),
      routeName: currentInfo.name,
      perceptionRoute: fallback,
      perceptionName: fallbackInfo.name,
      operationId: operation.operationId,
    }
  }

  async handle(endpoint: string, payload: unknown): Promise<unknown> {
    if (endpoint === 'get') return this.getView()
    if (endpoint === 'save') return this.save(payload)
    if (endpoint === 'reset') return this.reset()
    if (endpoint === 'resolve-image-route') return this.resolveImageRoute(payload)
    if (endpoint === 'media-progress') return this.progress.get(parseOperationId(payload))
    if (endpoint === 'cancel-media-progress') {
      this.progress.cancel(parseOperationId(payload))
      return {}
    }
    throw new TypeError(`unknown multimodal endpoint: ${endpoint}`)
  }

  private async ensureImageCapability(route: ModelRoute): Promise<void> {
    const current = await this.ctx.llm.resolveModelInfo(route.provider, route.model)
    if (current.inputModalities?.includes('image')) return

    const config = this.ctx.settings.get(PI_AI_SETTINGS) as PiAiSettings | undefined
    const models = config?.providers?.[route.provider]?.models
    const modelIndex = models?.findIndex(model => model.id === route.model) ?? -1
    if (modelIndex < 0) {
      throw new MultimodalRouteUnavailableError(
        '该模型没有声明图片能力，也不是可由 Telos 配置的自定义模型。请改选支持图片的模型。',
      )
    }
    const nextModels = models!.map((model, index) => index === modelIndex
      ? { ...model, input: ['text', 'image'] }
      : model)
    await this.ctx.settings.mutate(PI_AI_SETTINGS, [{
      op: 'set',
      path: ['providers', route.provider, 'models'],
      value: nextModels,
    }])
  }
}

function unwrapLogicalSelection(current: ModelSelectionRoute): ModelSelectionRoute {
  if (current.provider !== TELOS_MULTIMODAL_PROVIDER) return current
  return {
    ...decodeLogicalModel(current.model),
    ...(current.reasoningEffort === undefined ? {} : { reasoningEffort: current.reasoningEffort }),
  }
}

function parseImageRouteRequest(value: unknown): ImageRouteRequest {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('image route request must be an object')
  const input = value as Record<string, unknown>
  const current = parseSelection(input.current)
  if (typeof input.sessionId !== 'string' || input.sessionId.trim() === '') throw new TypeError('sessionId must be a non-empty string')
  if (!Number.isSafeInteger(input.imageCount) || (input.imageCount as number) <= 0) throw new TypeError('imageCount must be a positive integer')
  return { current, sessionId: input.sessionId, imageCount: input.imageCount as number }
}

function parseOperationId(value: unknown): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('operation request must be an object')
  const operationId = (value as Record<string, unknown>).operationId
  if (typeof operationId !== 'string' || operationId.trim() === '') throw new TypeError('operationId must be a non-empty string')
  return operationId
}

function parseSelection(value: unknown): ModelSelectionRoute {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('current model selection must be an object')
  const input = value as Record<string, unknown>
  if (typeof input.provider !== 'string' || input.provider.trim() === '') throw new TypeError('current.provider must be a non-empty string')
  if (typeof input.model !== 'string' || input.model.trim() === '') throw new TypeError('current.model must be a non-empty string')
  if (input.reasoningEffort !== undefined && typeof input.reasoningEffort !== 'string') {
    throw new TypeError('current.reasoningEffort must be a string')
  }
  return {
    provider: input.provider,
    model: input.model,
    ...(typeof input.reasoningEffort === 'string' ? { reasoningEffort: input.reasoningEffort } : {}),
  }
}
