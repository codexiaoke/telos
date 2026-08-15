import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-llm'
import {
  MULTIMODAL_CAPABILITIES,
  type CapabilityRouteConfig,
  type ModelCatalogEntry,
  type ModelProviderGroup,
  type ModelRoute,
  type MultimodalCapability,
  type MultimodalSettings,
  type MultimodalSettingsView,
  type RouteStatus,
} from './contracts.js'
import { MultimodalSettingsStore, parseMultimodalSettings } from './store.js'

const IMAGE_CAPABILITIES = new Set<MultimodalCapability>(['image-understanding', 'ocr'])

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function buildModelCatalog(ctx: Pick<Context, 'llm'>): Promise<ModelProviderGroup[]> {
  return Promise.all(ctx.llm.listProviders().map(async (provider) => {
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

function fixedStatus(
  catalog: readonly ModelProviderGroup[],
  route: ModelRoute,
  requireImage: boolean,
): RouteStatus {
  const model = findModel(catalog, route)
  if (model === undefined) {
    return { state: 'unverified', message: '未在当前 DSH 模型目录中找到；路线已保存，运行时接入后仍需验证。' }
  }
  if (requireImage && model.inputModalities !== undefined && !model.inputModalities.includes('image')) {
    return { state: 'incompatible', message: '该模型明确声明不支持图片输入。' }
  }
  if (requireImage && model.inputModalities === undefined) {
    return { state: 'unverified', message: '模型存在，但没有声明图片能力；运行时不会把它当作已验证视觉模型。' }
  }
  return { state: 'available', message: '模型已在当前 DSH 目录中找到。' }
}

function capabilityStatus(
  catalog: readonly ModelProviderGroup[],
  capability: MultimodalCapability,
  route: CapabilityRouteConfig,
): RouteStatus {
  if (route.mode === 'disabled') return { state: 'disabled', message: '此能力已停用。' }
  if (route.mode === 'auto') return { state: 'automatic', message: '运行时接入后按能力、隐私和可用性自动选择。' }
  return fixedStatus(catalog, route.route as ModelRoute, IMAGE_CAPABILITIES.has(capability))
}

export function buildSettingsView(
  settings: MultimodalSettings,
  catalog: ModelProviderGroup[],
): MultimodalSettingsView {
  const routeStatuses = Object.fromEntries(MULTIMODAL_CAPABILITIES.map(capability => [
    capability,
    capabilityStatus(catalog, capability, settings.routes[capability]),
  ])) as Record<MultimodalCapability, RouteStatus>
  const mainModelStatus = settings.mainModel.mode === 'follow-session'
    ? { state: 'automatic', message: '跟随每个会话当前选择的主模型。' } as const
    : fixedStatus(catalog, settings.mainModel.route as ModelRoute, false)
  return { settings, catalog, mainModelStatus, routeStatuses, runtimePhase: 'configuration-only' }
}

export class MultimodalSettingsService {
  constructor(private readonly ctx: Pick<Context, 'llm'>, private readonly store: MultimodalSettingsStore) {}

  async getView(): Promise<MultimodalSettingsView> {
    return buildSettingsView(this.store.load(), await buildModelCatalog(this.ctx))
  }

  async save(value: unknown): Promise<MultimodalSettingsView> {
    const settings = this.store.save(parseMultimodalSettings(value))
    return buildSettingsView(settings, await buildModelCatalog(this.ctx))
  }

  async reset(): Promise<MultimodalSettingsView> {
    const settings = this.store.reset()
    return buildSettingsView(settings, await buildModelCatalog(this.ctx))
  }

  async handle(endpoint: string, payload: unknown): Promise<MultimodalSettingsView> {
    if (endpoint === 'get') return this.getView()
    if (endpoint === 'save') return this.save(payload)
    if (endpoint === 'reset') return this.reset()
    throw new TypeError(`unknown multimodal endpoint: ${endpoint}`)
  }
}
