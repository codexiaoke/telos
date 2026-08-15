export const MULTIMODAL_RPC_CHANNEL = '/telos-multimodal'
export const TELOS_MULTIMODAL_PROVIDER = 'telos-multimodal'

export interface ModelRoute {
  provider: string
  model: string
}

/** Device-local policy for the image bridge. Provider credentials remain DSH-owned. */
export interface MultimodalSettings {
  schemaVersion: 2
  enabled: boolean
  defaultModel?: ModelRoute
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

export type RouteStatusState = 'unconfigured' | 'available' | 'incompatible' | 'unverified'

export interface RouteStatus {
  state: RouteStatusState
  message: string
}

export interface MultimodalSettingsView {
  settings: MultimodalSettings
  catalog: ModelProviderGroup[]
  defaultModelStatus: RouteStatus
  runtimePhase: 'image-routing'
}

export interface ModelSelectionRoute extends ModelRoute {
  reasoningEffort?: string
}

export type MediaKind = 'image' | 'video' | 'audio'
export type MediaProgressState = 'queued' | 'running' | 'completed' | 'failed'

export interface MediaTokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
}

export interface MediaProgressFailure {
  code: string
  message: string
}

/** Transient, device-local execution state. It never contains credentials or media bytes. */
export interface MediaProgress {
  operationId: string
  sessionId: string
  kind: MediaKind
  /** Media newly attached by the user for this turn. */
  count: number
  /** Media blocks actually perceived after DSH assembled conversation history. */
  processedCount?: number
  state: MediaProgressState
  perceptionRoute: ModelRoute
  perceptionName: string
  createdAt: number
  startedAt?: number
  finishedAt?: number
  elapsedMs: number
  usage?: MediaTokenUsage
  cacheHits: number
  failure?: MediaProgressFailure
}

export interface ImageRouteRequest {
  current: ModelSelectionRoute
  sessionId: string
  imageCount: number
}

export type ImageRouteResolution =
  | { kind: 'native'; route: ModelSelectionRoute }
  | {
      kind: 'bridge'
      route: ModelSelectionRoute
      routeName: string
      perceptionRoute: ModelRoute
      perceptionName: string
      operationId: string
    }

export type MultimodalRpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: 'bad-request'; message: string; details: { issues: never[] } } }
  | { ok: false; error: { code: 'model-unavailable'; message: string; details: { provider: string; model: string } } }
  | { ok: false; error: { code: 'internal'; message: string; details: Record<string, never> } }
