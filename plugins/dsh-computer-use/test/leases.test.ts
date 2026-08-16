import { describe, expect, it } from 'vitest'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Context } from '@deepseek-ai/cordis'
import type { ApprovalOutcome } from '@deepseek-ai/dsh-user-approval'
import type { ResolvedComputerUseConfig } from '../src/config.js'
import { resolveConfig } from '../src/config.js'
import { ComputerUseError } from '../src/errors.js'
import { ComputerLeaseManager, configuredAccess, type ComputerUseSessionState } from '../src/leases.js'
import type { ComputerAppIdentity } from '../src/types.js'

const APP: ComputerAppIdentity = { bundleId: 'com.example.app', pid: 42, name: 'Example' }
const SIGNAL = new AbortController().signal

function config(overrides: Partial<ResolvedComputerUseConfig> = {}): () => ResolvedComputerUseConfig {
  return () => ({ ...resolveConfig(), ...overrides } as ResolvedComputerUseConfig)
}

function agent(turn = 1): Agent {
  return {
    session: {
      id: 'sess-1',
      header: { createdAt: 1234567890, cwd: '/tmp/ws' },
      events: [{ type: 'turn/start', data: { turn } }],
    },
  } as unknown as Agent
}

interface TrackingContext { requests: number }

function makeStorage() {
  const sessions = new Map<string, ComputerUseSessionState>()
  const table = {
    get: (key: string) => sessions.get(key),
    put: async (key: string, value: ComputerUseSessionState) => { sessions.set(key, value) },
  }
  const domain = { table: () => table, close: async () => {} }
  return { open: async () => domain, sessions }
}

function makeCtx(outcome: ApprovalOutcome = 'allowed-once', policy: 'ask' | 'never' = 'ask', withStorage = false): Context & TrackingContext {
  const storage = withStorage ? makeStorage() : null
  const ctx = {
    requests: 0,
    inject: (_deps: readonly string[], callback: (storageCtx: Context) => Promise<() => Promise<void>>) => {
      const ready = storage === null
        ? Promise.resolve()
        : callback({ storageDomain: storage } as unknown as Context).then(() => {})
      return Object.assign(ready, { dispose: () => {} })
    },
    effect: () => () => {},
    get: (name: string) => (name === 'storageDomain' && storage !== null ? storage : undefined),
    approval: {
      overrideOf: () => policy,
      config: { policy: 'ask' },
      request: async () => {
        ctx.requests += 1
        return outcome
      },
    },
    sessions: { flush: async () => true },
  }
  return ctx as unknown as Context & TrackingContext
}

describe('configuredAccess', () => {
  it('authorizes every app when allowAllApps is set', () => {
    expect(configuredAccess(resolveConfig({ allowAllApps: true }), 'com.any', 'control')).toBe(true)
  })

  it('authorizes only an exact scoped grant', () => {
    const resolved = resolveConfig({ grants: [{ bundleId: 'com.example.app', read: true }] })
    expect(configuredAccess(resolved, 'com.example.app', 'read')).toBe(true)
    expect(configuredAccess(resolved, 'com.example.app', 'control')).toBe(false)
    expect(configuredAccess(resolved, 'com.other', 'read')).toBe(false)
  })
})

describe('ComputerLeaseManager', () => {
  it('returns configured without asking approval', async () => {
    const ctx = makeCtx('allowed-once')
    const manager = new ComputerLeaseManager(ctx, config({ allowAllApps: true }))
    await expect(manager.ensure(agent(), APP, 'control', 'computer_click', undefined, SIGNAL)).resolves.toBe('configured')
    expect(ctx.requests).toBe(0)
  })

  it('scopes a control grant to one turn', async () => {
    const ctx = makeCtx('allowed-once')
    const manager = new ComputerLeaseManager(ctx, config())
    const a = agent(1)
    await manager.ensure(a, APP, 'control', 'computer_click', undefined, SIGNAL)
    await manager.ensure(a, APP, 'control', 'computer_click', undefined, SIGNAL)
    expect(ctx.requests).toBe(1)
    ;(a as unknown as { session: { events: unknown[] } }).session.events = [{ type: 'turn/start', data: { turn: 2 } }]
    await manager.ensure(a, APP, 'control', 'computer_click', undefined, SIGNAL)
    expect(ctx.requests).toBe(2)
  })

  it('fails closed when the session approval policy is never', async () => {
    const ctx = makeCtx('allowed-once', 'never')
    const manager = new ComputerLeaseManager(ctx, config())
    await expect(manager.ensure(agent(), APP, 'control', 'computer_click', undefined, SIGNAL)).rejects.toThrow(/blocked because approval prompts are disabled/)
  })

  it('throws a structured cancellation when the request is cancelled', async () => {
    const ctx = makeCtx('cancelled')
    const manager = new ComputerLeaseManager(ctx, config())
    await expect(manager.ensure(agent(), APP, 'control', 'computer_click', undefined, SIGNAL)).rejects.toThrowError(ComputerUseError)
  })

  it('requires an open Agent turn', async () => {
    const noTurn = { session: { id: 'sess-1', header: { createdAt: 1 }, events: [] } } as unknown as Agent
    const manager = new ComputerLeaseManager(makeCtx('allowed-once'), config())
    await expect(manager.ensure(noTurn, APP, 'control', 'computer_click', undefined, SIGNAL)).rejects.toThrow(/inside an open Agent turn/)
  })

  it('fails closed for a read grant without a storage-domain sidecar', async () => {
    const ctx = makeCtx('allowed-once')
    const manager = new ComputerLeaseManager(ctx, config())
    await expect(manager.ensure(agent(), APP, 'read', 'computer_observe', undefined, SIGNAL)).rejects.toThrow(/requires ctx.storageDomain/)
  })

  it('persists and caches a read grant across the session', async () => {
    const ctx = makeCtx('allowed-once', 'ask', true)
    const manager = new ComputerLeaseManager(ctx, config())
    await expect(manager.ensure(agent(), APP, 'read', 'computer_observe', undefined, SIGNAL)).resolves.toBe('approved')
    await expect(manager.ensure(agent(), APP, 'read', 'computer_observe', undefined, SIGNAL)).resolves.toBe('approved')
    expect(ctx.requests).toBe(1)
  })

  it('persists a denial and does not re-ask within the session', async () => {
    const ctx = makeCtx('rejected', 'ask', true)
    const manager = new ComputerLeaseManager(ctx, config())
    await expect(manager.ensure(agent(), APP, 'read', 'computer_observe', undefined, SIGNAL)).rejects.toThrow(/not granted \(rejected\)/)
    await expect(manager.ensure(agent(), APP, 'read', 'computer_observe', undefined, SIGNAL)).rejects.toThrow(/rejected earlier in this Session/)
    expect(ctx.requests).toBe(1)
  })
})
