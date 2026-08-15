export const MULTIMODAL_RPC_CHANNEL = '/telos-multimodal'

export const MULTIMODAL_CAPABILITIES = [
  'image-understanding',
  'ocr',
  'speech-to-text',
  'text-to-speech',
  'video-understanding',
  'document-understanding',
] as const

export type MultimodalCapability = typeof MULTIMODAL_CAPABILITIES[number]
export type CapabilityRouteMode = 'auto' | 'fixed' | 'disabled'
export type CloudMediaPolicy = 'ask' | 'allow-configured' | 'local-only'

export interface ModelRoute {
  provider: string
  model: string
}

export interface MainModelConfig {
  mode: 'follow-session' | 'fixed'
  route?: ModelRoute
}

export interface CapabilityRouteConfig {
  mode: CapabilityRouteMode
  route?: ModelRoute
}

export interface MultimodalSettings {
  schemaVersion: 1
  enabled: boolean
  mainModel: MainModelConfig
  routes: Record<MultimodalCapability, CapabilityRouteConfig>
  privacy: {
    preferLocal: boolean
    cloudMediaPolicy: CloudMediaPolicy
  }
}

export interface ModelCatalogEntry extends ModelRoute {
  name: string
  description?: string
  inputModalities?: readonly ('text' | 'image')[]
}

export interface ModelProviderGroup {
  id: string
  name: string
  models: ModelCatalogEntry[]
  failure?: string
}

export type RouteStatusState =
  | 'automatic'
  | 'disabled'
  | 'available'
  | 'incompatible'
  | 'unverified'

export interface RouteStatus {
  state: RouteStatusState
  message: string
}

export interface MultimodalSettingsView {
  settings: MultimodalSettings
  catalog: ModelProviderGroup[]
  mainModelStatus: RouteStatus
  routeStatuses: Record<MultimodalCapability, RouteStatus>
  runtimePhase: 'configuration-only'
}

export type MultimodalRpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: 'bad-request'; message: string; details: { issues: never[] } } }
  | { ok: false; error: { code: 'internal'; message: string; details: Record<string, never> } }
