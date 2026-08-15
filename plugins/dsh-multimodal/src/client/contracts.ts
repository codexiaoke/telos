import type { MultimodalRpcResult, MultimodalSettingsView } from '../contracts.js'

export interface ClientRpc {
  call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<MultimodalRpcResult<unknown>>
}

export interface MultimodalClientSnapshot {
  loading: boolean
  view?: MultimodalSettingsView
  error?: string
  notice?: string
}
