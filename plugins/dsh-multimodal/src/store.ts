import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  TELOS_MULTIMODAL_PROVIDER,
  type ModelRoute,
  type MultimodalSettings,
} from './contracts.js'

const ROUTE_TEXT_MAX_LENGTH = 240

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
  if (provider === TELOS_MULTIMODAL_PROVIDER) {
    throw new TypeError(`${field}.provider cannot recursively target ${TELOS_MULTIMODAL_PROVIDER}`)
  }
  return { provider, model: routeText(input.model, `${field}.model`) }
}

interface LegacySettings {
  enabled?: unknown
  routes?: unknown
}

function migrateLegacySettings(input: LegacySettings): MultimodalSettings {
  const enabled = boolean(input.enabled, 'enabled')
  const routes = object(input.routes, 'routes')
  const imageRoute = object(routes['image-understanding'], 'routes.image-understanding')
  return {
    schemaVersion: 2,
    enabled,
    ...(imageRoute.mode === 'fixed'
      ? { defaultModel: modelRoute(imageRoute.route, 'routes.image-understanding.route') }
      : {}),
  }
}

export function defaultMultimodalSettings(): MultimodalSettings {
  return { schemaVersion: 2, enabled: true }
}

export function parseMultimodalSettings(value: unknown): MultimodalSettings {
  const input = object(value, 'settings')
  if (input.schemaVersion === 1) return migrateLegacySettings(input)
  if (input.schemaVersion !== 2) throw new TypeError('unsupported multimodal settings schema')
  return {
    schemaVersion: 2,
    enabled: boolean(input.enabled, 'enabled'),
    ...(input.defaultModel === undefined || input.defaultModel === null
      ? {}
      : { defaultModel: modelRoute(input.defaultModel, 'defaultModel') }),
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
