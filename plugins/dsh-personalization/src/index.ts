import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import {
  PERSONALIZATION_RPC_CHANNEL,
  type PersonalizationRpcResult,
} from './contracts.js'
import { PersonalizationService } from './service.js'
import { PersonalInstructionsStore } from './store.js'

export const name = 'telos-personalization'
export const inject = ['connection']
export * from './contracts.js'
export { PersonalizationService } from './service.js'
export { PersonalInstructionsStore } from './store.js'

export interface Config { instructionsPath: string }

function result<T>(operation: () => T | Promise<T>): Promise<PersonalizationRpcResult<T>> {
  return Promise.resolve().then(operation).then(
    value => ({ ok: true, value }),
    (error: unknown): PersonalizationRpcResult<never> => {
      const message = error instanceof Error ? error.message : String(error)
      return error instanceof TypeError || error instanceof RangeError
        ? { ok: false, error: { code: 'bad-request', message, details: { issues: [] } } }
        : { ok: false, error: { code: 'internal', message, details: {} } }
    },
  )
}

export function apply(ctx: Context, config: Config): void {
  if (typeof config.instructionsPath !== 'string' || config.instructionsPath.trim() === '') {
    throw new TypeError('telos-personalization instructionsPath must be a non-empty string')
  }
  const service = new PersonalizationService(new PersonalInstructionsStore(config.instructionsPath))
  ctx.connection.rpc.handle(
    PERSONALIZATION_RPC_CHANNEL,
    (endpoint, payload) => result(() => service.handle(endpoint, payload)),
    { authority: 'loopback' },
  )
}
