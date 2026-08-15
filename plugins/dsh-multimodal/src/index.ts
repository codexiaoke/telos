import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-llm'
import { MULTIMODAL_RPC_CHANNEL, type MultimodalRpcResult } from './contracts.js'
import { MultimodalSettingsService } from './service.js'
import { MultimodalSettingsStore } from './store.js'

export const name = 'telos-multimodal'
export const inject = ['connection', 'llm']
export { MULTIMODAL_RPC_CHANNEL } from './contracts.js'
export type * from './contracts.js'
export { buildModelCatalog, buildSettingsView, MultimodalSettingsService } from './service.js'
export { defaultMultimodalSettings, MultimodalSettingsStore, parseMultimodalSettings } from './store.js'

export interface Config { storePath: string }

function result<T>(operation: () => T | Promise<T>): Promise<MultimodalRpcResult<T>> {
  return Promise.resolve().then(operation).then(
    value => ({ ok: true, value }),
    (error: unknown): MultimodalRpcResult<never> => {
      const message = error instanceof Error ? error.message : String(error)
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
  const service = new MultimodalSettingsService(ctx, new MultimodalSettingsStore(config.storePath))
  ctx.connection.rpc.handle(
    MULTIMODAL_RPC_CHANNEL,
    (endpoint, payload) => result(() => service.handle(endpoint, payload)),
    { authority: 'loopback' },
  )
}
