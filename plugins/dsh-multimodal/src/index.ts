import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-settings'
import { TelosMultimodalAdapter } from './adapter.js'
import { MULTIMODAL_RPC_CHANNEL, TELOS_MULTIMODAL_PROVIDER, type MultimodalRpcResult } from './contracts.js'
import { MultimodalRouteUnavailableError, MultimodalSettingsService } from './service.js'
import { MultimodalSettingsStore } from './store.js'
import { applyVisionTool } from './vision.js'

export const name = 'telos-multimodal'
export const inject = ['connection', 'llm', 'settings', 'attachments', 'tools']
export { MULTIMODAL_RPC_CHANNEL } from './contracts.js'
export type * from './contracts.js'
export { TelosMultimodalAdapter } from './adapter.js'
export { buildModelCatalog, buildSettingsView, MultimodalRouteUnavailableError, MultimodalSettingsService } from './service.js'
export { defaultMultimodalSettings, MultimodalSettingsStore, parseMultimodalSettings } from './store.js'

export interface Config { storePath: string }

function result<T>(operation: () => T | Promise<T>): Promise<MultimodalRpcResult<T>> {
  return Promise.resolve().then(operation).then(
    value => ({ ok: true, value }),
    (error: unknown): MultimodalRpcResult<never> => {
      const message = error instanceof Error ? error.message : String(error)
      if (error instanceof MultimodalRouteUnavailableError) {
        return { ok: false, error: { code: 'model-unavailable', message, details: { provider: TELOS_MULTIMODAL_PROVIDER, model: '' } } }
      }
      return error instanceof TypeError || error instanceof RangeError
        ? { ok: false, error: { code: 'bad-request', message, details: { issues: [] } } }
        : { ok: false, error: { code: 'internal', message, details: {} } }
    },
  )
}

export function apply(ctx: Context, config: Config): void {
  if (typeof config.storePath !== 'string' || config.storePath.trim() === '') {
    throw new TypeError('telos-multimodal storePath must be a non-empty string')
  }
  const store = new MultimodalSettingsStore(config.storePath)
  const service = new MultimodalSettingsService(ctx, store)
  ctx.llm.registerAdapter([TELOS_MULTIMODAL_PROVIDER], new TelosMultimodalAdapter(ctx, () => store.load()))
  applyVisionTool(ctx, store)
  ctx.connection.rpc.handle(
    MULTIMODAL_RPC_CHANNEL,
    (endpoint, payload) => result(() => service.handle(endpoint, payload)),
    { authority: 'loopback' },
  )
}
