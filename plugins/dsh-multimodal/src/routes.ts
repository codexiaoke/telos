import {
  TELOS_MULTIMODAL_PROVIDER,
  type ModelRoute,
  type ModelSelectionRoute,
} from './contracts.js'

interface EncodedRoute { provider: unknown; model: unknown }

/** Encode an underlying route into an opaque provider-owned model id. */
export function encodeLogicalModel(route: ModelRoute): string {
  return Buffer.from(JSON.stringify({ provider: route.provider, model: route.model }), 'utf8').toString('base64url')
}

/** Decode only ids produced by {@link encodeLogicalModel}. */
export function decodeLogicalModel(model: string): ModelRoute {
  let value: EncodedRoute
  try {
    value = JSON.parse(Buffer.from(model, 'base64url').toString('utf8')) as EncodedRoute
  } catch {
    throw new TypeError('invalid Telos multimodal model route')
  }
  if (typeof value.provider !== 'string' || value.provider.length === 0
    || typeof value.model !== 'string' || value.model.length === 0
    || value.provider === TELOS_MULTIMODAL_PROVIDER) {
    throw new TypeError('invalid Telos multimodal model route')
  }
  return { provider: value.provider, model: value.model }
}

export function logicalSelection(route: ModelSelectionRoute): ModelSelectionRoute {
  return {
    provider: TELOS_MULTIMODAL_PROVIDER,
    model: encodeLogicalModel(route),
    ...(route.reasoningEffort === undefined ? {} : { reasoningEffort: route.reasoningEffort }),
  }
}
