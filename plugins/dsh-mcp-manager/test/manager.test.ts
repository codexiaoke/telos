import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { McpManager } from '../src/manager.js'
import { McpServerStore } from '../src/store.js'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function harness() {
  const secrets = new Map<string, string>()
  const schemas: { name: string }[] = []
  const dispose = vi.fn(async () => {
    schemas.splice(0)
  })
  const ctx = {
    credentials: {
      set: vi.fn(async (ref: string, value: string) => { secrets.set(ref, value) }),
      unset: vi.fn(async (ref: string) => { secrets.delete(ref) }),
      resolve: vi.fn(async (ref: string) => secrets.has(ref) ? { value: secrets.get(ref)!, source: 'file' } : undefined),
      describe: vi.fn(async (ref: string) => ({ configured: secrets.has(ref), source: secrets.has(ref) ? 'file' : undefined, writable: true })),
    },
    tools: { schemas: vi.fn(() => schemas) },
    plugin: vi.fn((_plugin: unknown, config: { serverName: string }) => {
      schemas.push({ name: `mcp__${config.serverName}__explore` })
      return Object.assign(Promise.resolve(), { dispose })
    }),
  }
  return { ctx, secrets, dispose }
}

function server(enabled = true) {
  return {
    serverName: 'codegraph', displayName: 'CodeGraph', enabled, transport: 'stdio',
    command: 'codegraph', args: ['serve', '--mcp'], cwd: '/repo', env: [], headers: [],
    toolCallTimeoutMs: 60_000,
    reconnect: { enabled: true, initialDelayMs: 500, maxDelayMs: 5_000, maxAttempts: 5 },
  }
}

describe('McpManager', () => {
  it('requires acknowledgement before starting a local process', async () => {
    const root = mkdtempSync(join(tmpdir(), 'telos-mcp-manager-'))
    roots.push(root)
    const { ctx } = harness()
    const manager = new McpManager(ctx as never, new McpServerStore(join(root, 'servers.json')))
    await expect(manager.handle('save', { server: server() })).rejects.toThrow(/acknowledgement/)
    expect(ctx.plugin).not.toHaveBeenCalled()
  })

  it('mounts the official client dynamically and reports its registered tools', async () => {
    const root = mkdtempSync(join(tmpdir(), 'telos-mcp-manager-'))
    roots.push(root)
    const { ctx } = harness()
    const path = join(root, 'servers.json')
    const manager = new McpManager(ctx as never, new McpServerStore(path))
    const views = await manager.handle('save', { server: server(), acknowledgeLocalExecution: true }) as Array<{ runtime: string; toolNames: string[] }>

    expect(ctx.plugin).toHaveBeenCalledOnce()
    expect(views[0]).toMatchObject({ runtime: 'loaded', toolNames: ['mcp__codegraph__explore'] })
    expect(readFileSync(path, 'utf8')).toContain('codegraph')
  })

  it('stores credential values only in the DSH credential provider and redacts list results', async () => {
    const root = mkdtempSync(join(tmpdir(), 'telos-mcp-manager-'))
    roots.push(root)
    const { ctx, secrets } = harness()
    const path = join(root, 'servers.json')
    const manager = new McpManager(ctx as never, new McpServerStore(path))
    const configured = {
      ...server(false),
      env: [{ name: 'TOKEN', credentialRef: 'TELOS_MCP_CODEGRAPH_ENV_TOKEN' }],
    }
    const views = await manager.handle('save', {
      server: configured,
      credentialValues: { TELOS_MCP_CODEGRAPH_ENV_TOKEN: 'secret-value' },
    })

    expect(secrets.get('TELOS_MCP_CODEGRAPH_ENV_TOKEN')).toBe('secret-value')
    expect(JSON.stringify(views)).not.toContain('secret-value')
    expect(readFileSync(path, 'utf8')).not.toContain('secret-value')
  })

  it('removes writable credentials when their binding is removed', async () => {
    const root = mkdtempSync(join(tmpdir(), 'telos-mcp-manager-'))
    roots.push(root)
    const { ctx, secrets } = harness()
    const manager = new McpManager(ctx as never, new McpServerStore(join(root, 'servers.json')))
    const ref = 'TELOS_MCP_CODEGRAPH_ENV_TOKEN'
    await manager.handle('save', {
      server: { ...server(false), env: [{ name: 'TOKEN', credentialRef: ref }] },
      credentialValues: { [ref]: 'secret-value' },
    })
    await manager.handle('save', { server: server(false) })
    expect(secrets.has(ref)).toBe(false)
    expect(ctx.credentials.unset).toHaveBeenCalledWith(ref)
  })

  it('disposes a running fiber before deletion', async () => {
    const root = mkdtempSync(join(tmpdir(), 'telos-mcp-manager-'))
    roots.push(root)
    const { ctx, dispose } = harness()
    const manager = new McpManager(ctx as never, new McpServerStore(join(root, 'servers.json')))
    await manager.handle('save', { server: server(), acknowledgeLocalExecution: true })
    const result = await manager.handle('delete', { serverName: 'codegraph' })
    expect(dispose).toHaveBeenCalledOnce()
    expect(result).toEqual([])
  })
})
