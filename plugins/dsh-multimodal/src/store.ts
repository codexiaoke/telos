import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  MULTIMODAL_CAPABILITIES,
  type CapabilityRouteConfig,
  type CloudMediaPolicy,
  type MainModelConfig,
  type ModelRoute,
  type MultimodalCapability,
  type MultimodalSettings,
} from './contracts.js'

const ROUTE_TEXT_MAX_LENGTH = 240
const CLOUD_POLICIES = new Set<CloudMediaPolicy>(['ask', 'allow-configured', 'local-only'])

function object(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`)
  return value as Record<string, unknown>
}

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new TypeError(`${field} must be a boolean`)
  return value
}

function routeText(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new TypeError(`${field} must be a string`)
  const trimmed = value.trim()
  const printable = [...trimmed].every((character) => {
    const code = character.charCodeAt(0)
    return code >= 32 && code !== 127
  })
  if (trimmed.length === 0 || trimmed.length > ROUTE_TEXT_MAX_LENGTH || !printable) {
    throw new TypeError(`${field} must be a non-empty printable string no longer than ${String(ROUTE_TEXT_MAX_LENGTH)} characters`)
  }
  return trimmed
}

function modelRoute(value: unknown, field: string): ModelRoute {
  const input = object(value, field)
  const provider = routeText(input.provider, `${field}.provider`)
  if (provider === 'telos-multimodal') throw new TypeError(`${field}.provider cannot recursively target telos-multimodal`)
  return { provider, model: routeText(input.model, `${field}.model`) }
}

function mainModel(value: unknown): MainModelConfig {
  const input = object(value, 'mainModel')
  if (input.mode === 'follow-session') return { mode: 'follow-session' }
  if (input.mode !== 'fixed') throw new TypeError('mainModel.mode must be follow-session or fixed')
  return { mode: 'fixed', route: modelRoute(input.route, 'mainModel.route') }
}

function capabilityRoute(value: unknown, field: string): CapabilityRouteConfig {
  const input = object(value, field)
  if (input.mode === 'auto' || input.mode === 'disabled') return { mode: input.mode }
  if (input.mode !== 'fixed') throw new TypeError(`${field}.mode must be auto, fixed, or disabled`)
  return { mode: 'fixed', route: modelRoute(input.route, `${field}.route`) }
}

export function defaultMultimodalSettings(): MultimodalSettings {
  return {
    schemaVersion: 1,
    enabled: true,
    mainModel: { mode: 'follow-session' },
    routes: Object.fromEntries(MULTIMODAL_CAPABILITIES.map(capability => [capability, { mode: 'auto' }])) as Record<MultimodalCapability, CapabilityRouteConfig>,
    privacy: { preferLocal: true, cloudMediaPolicy: 'ask' },
  }
}

export function parseMultimodalSettings(value: unknown): MultimodalSettings {
  const input = object(value, 'settings')
  if (input.schemaVersion !== 1) throw new TypeError('unsupported multimodal settings schema')
  const routes = object(input.routes, 'routes')
  const privacy = object(input.privacy, 'privacy')
  if (!CLOUD_POLICIES.has(privacy.cloudMediaPolicy as CloudMediaPolicy)) {
    throw new TypeError('privacy.cloudMediaPolicy is invalid')
  }
  return {
    schemaVersion: 1,
    enabled: boolean(input.enabled, 'enabled'),
    mainModel: mainModel(input.mainModel),
    routes: Object.fromEntries(MULTIMODAL_CAPABILITIES.map(capability => [
      capability,
      capabilityRoute(routes[capability], `routes.${capability}`),
    ])) as Record<MultimodalCapability, CapabilityRouteConfig>,
    privacy: {
      preferLocal: boolean(privacy.preferLocal, 'privacy.preferLocal'),
      cloudMediaPolicy: privacy.cloudMediaPolicy as CloudMediaPolicy,
    },
  }
}

export class MultimodalSettingsStore {
  constructor(readonly path: string) {}

  load(): MultimodalSettings {
    let raw: string
    try {
      raw = readFileSync(this.path, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return defaultMultimodalSettings()
      throw error
    }
    return parseMultimodalSettings(JSON.parse(raw))
  }

  save(settings: MultimodalSettings): MultimodalSettings {
    const validated = parseMultimodalSettings(settings)
    mkdirSync(dirname(this.path), { recursive: true })
    const temporary = `${this.path}.${String(process.pid)}.tmp`
    writeFileSync(temporary, `${JSON.stringify(validated, null, 2)}\n`, { mode: 0o600 })
    try {
      renameSync(temporary, this.path)
    } catch {
      rmSync(this.path, { force: true })
      renameSync(temporary, this.path)
    }
    chmodSync(this.path, 0o600)
    return validated
  }

  reset(): MultimodalSettings {
    const settings = defaultMultimodalSettings()
    this.save(settings)
    return settings
  }
}
