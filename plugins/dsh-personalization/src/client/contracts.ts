import type { PersonalizationRpcResult, PersonalizationView } from '../contracts.js'

export interface ClientRpc {
  call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<PersonalizationRpcResult<unknown>>
}

export interface PersonalizationClientSnapshot {
  loading: boolean
  view?: PersonalizationView
  error?: string
  notice?: string
}
