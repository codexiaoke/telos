import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { McpServerStore, parseServer } from '../src/store.js'

const roots: string[] = []
const reconnect = { enabled: true, initialDelayMs: 500, maxDelayMs: 5_000, maxAttempts: 5 }

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('McpServerStore', () => {
  it('persists only credential references with owner-only permissions', () => {
    const root = mkdtempSync(join(tmpdir(), 'telos-mcp-store-'))
    roots.push(root)
    const path = join(root, 'nested/servers.json')
    const store = new McpServerStore(path)
    store.save([parseServer({
      serverName: 'codegraph', displayName: 'CodeGraph', enabled: true, transport: 'stdio',
      command: 'codegraph', args: ['serve', '--mcp'], cwd: '/repo', env: [], headers: [],
      toolCallTimeoutMs: 60_000, reconnect,
    })])

    expect(store.load()).toHaveLength(1)
    expect(readFileSync(path, 'utf8')).not.toContain('secret-value')
  })

  it('rejects invalid transport fields and duplicate bindings', () => {
    expect(() => parseServer({
      serverName: 'bad name', displayName: 'Bad', enabled: false, transport: 'stdio',
      command: 'x', args: [], cwd: '', env: [], headers: [], toolCallTimeoutMs: 60_000, reconnect,
    })).toThrow(/serverName/)
    expect(() => parseServer({
      serverName: 'api', displayName: 'API', enabled: false, transport: 'streamable-http',
      url: 'file:///tmp/socket', env: [], headers: [], toolCallTimeoutMs: 60_000, reconnect,
    })).toThrow(/http or https/)
    expect(() => parseServer({
      serverName: 'env', displayName: 'Env', enabled: false, transport: 'stdio',
      command: 'x', args: [], cwd: '', headers: [], toolCallTimeoutMs: 60_000, reconnect,
      env: [{ name: 'TOKEN', credentialRef: 'A' }, { name: 'token', credentialRef: 'B' }],
    })).toThrow(/duplicate names/)
  })
})
