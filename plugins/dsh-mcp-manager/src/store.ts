import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { CredentialBinding, McpServerConfig, ReconnectPolicy } from './contracts.js'

const SERVER_NAME = /^[A-Za-z0-9_-]{1,32}$/
const CREDENTIAL_REF = /^[A-Za-z_][A-Za-z0-9_]*$/

function validBindingName(value: string): boolean {
  return value.length > 0 && [...value].every((character) => {
    const code = character.charCodeAt(0)
    return character !== '=' && character !== ':' && !/\s/u.test(character) && code >= 32 && code !== 127
  })
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`)
  return value as Record<string, unknown>
}

function text(value: unknown, field: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim() === '')) throw new TypeError(`${field} must be a string`)
  return value.trim()
}

function integer(value: unknown, field: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new RangeError(`${field} must be an integer between ${String(minimum)} and ${String(maximum)}`)
  }
  return value as number
}

function binding(value: unknown, field: string): CredentialBinding {
  const item = object(value, field)
  const name = text(item.name, `${field}.name`)
  const credentialRef = text(item.credentialRef, `${field}.credentialRef`)
  if (!validBindingName(name)) throw new TypeError(`${field}.name is invalid`)
  if (!CREDENTIAL_REF.test(credentialRef)) throw new TypeError(`${field}.credentialRef is invalid`)
  return { name, credentialRef }
}

function bindings(value: unknown, field: string): CredentialBinding[] {
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`)
  const result = value.map((item, index) => binding(item, `${field}[${String(index)}]`))
  if (new Set(result.map(item => item.name.toLowerCase())).size !== result.length) throw new TypeError(`${field} contains duplicate names`)
  if (new Set(result.map(item => item.credentialRef)).size !== result.length) throw new TypeError(`${field} contains duplicate credential refs`)
  return result
}

function reconnect(value: unknown): ReconnectPolicy {
  const input = object(value, 'reconnect')
  if (typeof input.enabled !== 'boolean') throw new TypeError('reconnect.enabled must be a boolean')
  const initialDelayMs = integer(input.initialDelayMs, 'reconnect.initialDelayMs', 1, 2_147_483_647)
  const maxDelayMs = integer(input.maxDelayMs, 'reconnect.maxDelayMs', initialDelayMs, 2_147_483_647)
  return {
    enabled: input.enabled,
    initialDelayMs,
    maxDelayMs,
    maxAttempts: integer(input.maxAttempts, 'reconnect.maxAttempts', 1, Number.MAX_SAFE_INTEGER),
  }
}

export function parseServer(value: unknown): McpServerConfig {
  const input = object(value, 'server')
  const serverName = text(input.serverName, 'serverName')
  if (!SERVER_NAME.test(serverName)) throw new TypeError('serverName must match [A-Za-z0-9_-]{1,32}')
  const displayName = text(input.displayName, 'displayName')
  if (typeof input.enabled !== 'boolean') throw new TypeError('enabled must be a boolean')
  if (input.transport !== 'stdio' && input.transport !== 'streamable-http') throw new TypeError('transport is invalid')
  const env = bindings(input.env, 'env')
  const headers = bindings(input.headers, 'headers')
  const common = {
    serverName,
    displayName,
    enabled: input.enabled,
    transport: input.transport,
    env,
    headers,
    toolCallTimeoutMs: integer(input.toolCallTimeoutMs, 'toolCallTimeoutMs', 1_000, 300_000),
    reconnect: reconnect(input.reconnect),
  }
  if (input.transport === 'stdio') {
    if (headers.length > 0) throw new TypeError('stdio servers cannot define headers')
    if (input.args !== undefined && !Array.isArray(input.args)) throw new TypeError('args must be an array')
    const args = (input.args ?? []).map((entry, index) => text(entry, `args[${String(index)}]`, true))
    const cwd = input.cwd === undefined ? '' : text(input.cwd, 'cwd', true)
    return { ...common, transport: 'stdio', command: text(input.command, 'command'), args, cwd }
  }
  if (env.length > 0) throw new TypeError('HTTP servers cannot define environment variables')
  const url = text(input.url, 'url')
  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new TypeError('url must use http or https')
  return { ...common, transport: 'streamable-http', url }
}

interface StoreDocument { schemaVersion: 1; servers: McpServerConfig[] }

export class McpServerStore {
  constructor(readonly path: string) {}

  load(): McpServerConfig[] {
    let raw: string
    try { raw = readFileSync(this.path, 'utf8') } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
    const document = object(JSON.parse(raw), 'document')
    if (document.schemaVersion !== 1 || !Array.isArray(document.servers)) throw new TypeError('unsupported MCP server store schema')
    const servers = document.servers.map(parseServer)
    if (new Set(servers.map(server => server.serverName)).size !== servers.length) throw new TypeError('MCP server store contains duplicate serverName values')
    return servers
  }

  save(servers: readonly McpServerConfig[]): void {
    const validated = servers.map(parseServer)
    if (new Set(validated.map(server => server.serverName)).size !== validated.length) throw new TypeError('serverName must be unique')
    const document: StoreDocument = { schemaVersion: 1, servers: validated }
    mkdirSync(dirname(this.path), { recursive: true })
    const temporary = `${this.path}.${String(process.pid)}.tmp`
    writeFileSync(temporary, `${JSON.stringify(document, null, 2)}\n`, { mode: 0o600 })
    try { renameSync(temporary, this.path) } catch {
      rmSync(this.path, { force: true })
      renameSync(temporary, this.path)
    }
  }
}
