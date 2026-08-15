import type { Context, Fiber } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import * as McpClient from '@deepseek-ai/dsh-mcp-client'
import type {
  CredentialBinding,
  CredentialBindingView,
  McpServerConfig,
  McpServerMutation,
  McpServerView,
} from './contracts.js'
import { McpServerStore, parseServer } from './store.js'

interface RuntimeState {
  fiber?: Fiber
  runtime: 'disabled' | 'connecting' | 'loaded' | 'error'
  error?: string
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function values(value: unknown): Record<string, string> {
  if (value === undefined) return {}
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('credentialValues must be an object')
  const result: Record<string, string> = {}
  for (const [ref, entry] of Object.entries(value)) {
    credentialRef(ref)
    if (typeof entry !== 'string' || entry.length === 0) throw new TypeError(`credentialValues.${ref} must be a non-empty string`)
    result[ref] = entry
  }
  return result
}

function mutation(value: unknown): McpServerMutation {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('payload must be an object')
  const input = value as Record<string, unknown>
  return {
    server: parseServer(input.server),
    credentialValues: values(input.credentialValues),
    acknowledgeLocalExecution: input.acknowledgeLocalExecution === true,
  }
}

function serverName(value: unknown): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('payload must be an object')
  const name = (value as Record<string, unknown>).serverName
  if (typeof name !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(name)) throw new TypeError('serverName is invalid')
  return name
}

function toggleRequest(value: unknown): { serverName: string; acknowledgeLocalExecution: boolean } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('payload must be an object')
  return {
    serverName: serverName(value),
    acknowledgeLocalExecution: (value as Record<string, unknown>).acknowledgeLocalExecution === true,
  }
}

/** Owns persisted MCP configuration and one official DSH MCP Client fiber per enabled server. */
export class McpManager {
  private servers: McpServerConfig[]
  private readonly runtime = new Map<string, RuntimeState>()
  private operation = Promise.resolve()
  private closing = false

  constructor(private readonly ctx: Context, private readonly store: McpServerStore) {
    this.servers = store.load()
    for (const server of this.servers) this.runtime.set(server.serverName, { runtime: server.enabled ? 'connecting' : 'disabled' })
  }

  start(): void {
    for (const server of this.servers) {
      if (server.enabled) void this.serial(() => this.startServer(server.serverName))
    }
  }

  async close(): Promise<void> {
    this.closing = true
    await this.serial(async () => {
      for (const name of [...this.runtime.keys()]) await this.stopServer(name)
    })
  }

  async handle(endpoint: string, payload: unknown): Promise<unknown> {
    switch (endpoint) {
      case 'list': return this.serial(() => this.list())
      case 'save': return this.serial(() => this.save(mutation(payload)))
      case 'toggle': {
        const request = toggleRequest(payload)
        return this.serial(() => this.toggle(request.serverName, request.acknowledgeLocalExecution))
      }
      case 'reconnect': return this.serial(() => this.reconnect(serverName(payload)))
      case 'delete': return this.serial(() => this.delete(serverName(payload)))
      default: throw new TypeError(`unknown MCP manager endpoint: ${endpoint}`)
    }
  }

  private serial<T>(operation: () => T | Promise<T>): Promise<T> {
    const next = this.operation.then(operation, operation)
    this.operation = next.then(() => undefined, () => undefined)
    return next
  }

  private find(name: string): McpServerConfig {
    const server = this.servers.find(candidate => candidate.serverName === name)
    if (server === undefined) throw new TypeError(`unknown MCP server: ${name}`)
    return server
  }

  private async list(): Promise<McpServerView[]> {
    return Promise.all(this.servers.map(async (server) => {
      const state = this.runtime.get(server.serverName) ?? { runtime: 'disabled' as const }
      const prefix = `mcp__${server.serverName}__`
      const toolNames = this.ctx.tools.schemas().map(schema => schema.name).filter(name => name.startsWith(prefix)).sort()
      return {
        ...server,
        runtime: server.enabled && toolNames.length > 0 ? 'loaded' : state.runtime,
        ...(state.error === undefined ? {} : { error: state.error }),
        toolNames,
        env: await this.describeBindings(server.env),
        headers: await this.describeBindings(server.headers),
      }
    }))
  }

  private async describeBindings(bindings: readonly CredentialBinding[]): Promise<CredentialBindingView[]> {
    return Promise.all(bindings.map(async (binding) => ({
      ...binding,
      ...await this.ctx.credentials.describe(credentialRef(binding.credentialRef)),
    })))
  }

  private async save(input: McpServerMutation): Promise<McpServerView[]> {
    const existing = this.servers.find(server => server.serverName === input.server.serverName)
    if (input.server.transport === 'stdio' && input.server.enabled && input.acknowledgeLocalExecution !== true) {
      throw new TypeError('enabling a stdio MCP server requires explicit local-execution acknowledgement')
    }
    const allowedRefs = new Set([...input.server.env, ...input.server.headers].map(binding => binding.credentialRef))
    for (const ref of Object.keys(input.credentialValues ?? {})) {
      if (!allowedRefs.has(ref)) throw new TypeError(`credentialValues contains an unrelated reference: ${ref}`)
    }
    for (const [ref, value] of Object.entries(input.credentialValues ?? {})) {
      await this.ctx.credentials.set(credentialRef(ref), value)
    }
    const next = existing === undefined
      ? [...this.servers, input.server]
      : this.servers.map(server => server.serverName === input.server.serverName ? input.server : server)
    this.store.save(next)
    this.servers = next
    await this.stopServer(input.server.serverName)
    this.runtime.set(input.server.serverName, { runtime: input.server.enabled ? 'connecting' : 'disabled' })
    if (input.server.enabled) await this.startServer(input.server.serverName)
    return this.list()
  }

  private async toggle(name: string, acknowledgeLocalExecution: boolean): Promise<McpServerView[]> {
    const current = this.find(name)
    if (!current.enabled && current.transport === 'stdio' && !acknowledgeLocalExecution) {
      throw new TypeError('enabling a stdio MCP server requires explicit local-execution acknowledgement')
    }
    const updated = { ...current, enabled: !current.enabled }
    this.store.save(this.servers.map(server => server.serverName === name ? updated : server))
    this.servers = this.servers.map(server => server.serverName === name ? updated : server)
    if (updated.enabled) await this.startServer(name)
    else await this.stopServer(name)
    return this.list()
  }

  private async reconnect(name: string): Promise<McpServerView[]> {
    const server = this.find(name)
    if (!server.enabled) throw new TypeError('disabled MCP servers cannot reconnect')
    await this.stopServer(name)
    await this.startServer(name)
    return this.list()
  }

  private async delete(name: string): Promise<McpServerView[]> {
    const server = this.find(name)
    await this.stopServer(name)
    for (const binding of [...server.env, ...server.headers]) {
      const info = await this.ctx.credentials.describe(credentialRef(binding.credentialRef))
      if (info.configured && info.writable) await this.ctx.credentials.unset(credentialRef(binding.credentialRef))
    }
    this.servers = this.servers.filter(candidate => candidate.serverName !== name)
    this.store.save(this.servers)
    this.runtime.delete(name)
    return this.list()
  }

  private async resolveBindings(bindings: readonly CredentialBinding[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {}
    for (const binding of bindings) {
      const resolved = await this.ctx.credentials.resolve(credentialRef(binding.credentialRef))
      if (resolved === undefined) throw new TypeError(`credential ${binding.credentialRef} is not configured`)
      result[binding.name] = resolved.value
    }
    return result
  }

  private async startServer(name: string): Promise<void> {
    if (this.closing) return
    const server = this.find(name)
    if (!server.enabled) {
      this.runtime.set(name, { runtime: 'disabled' })
      return
    }
    this.runtime.set(name, { runtime: 'connecting' })
    try {
      const common = {
        serverName: server.serverName,
        toolCallTimeoutMs: server.toolCallTimeoutMs,
        failOnStartupError: true,
        reconnect: server.reconnect,
      }
      const config: McpClient.Config = server.transport === 'stdio'
        ? {
            ...common,
            transport: 'stdio',
            command: server.command!,
            args: server.args ?? [],
            cwd: server.cwd ?? '',
            env: await this.resolveBindings(server.env),
          }
        : {
            ...common,
            transport: 'streamable-http',
            url: server.url!,
            headers: await this.resolveBindings(server.headers),
          }
      const fiber = this.ctx.plugin(McpClient, config)
      await fiber
      this.runtime.set(name, { fiber, runtime: 'loaded' })
    } catch (error) {
      this.runtime.set(name, { runtime: 'error', error: message(error) })
    }
  }

  private async stopServer(name: string): Promise<void> {
    const state = this.runtime.get(name)
    if (state?.fiber !== undefined) await state.fiber.dispose()
    this.runtime.set(name, { runtime: 'disabled' })
  }
}
