import { describe, expect, it } from 'vitest'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Context } from '@deepseek-ai/cordis'
import type { BackendObservation, ComputerUseBackend } from '../src/backend.js'
import { resolveConfig } from '../src/config.js'
import { ComputerUseError } from '../src/errors.js'
import { ComputerUseService } from '../src/service.js'
import type { ComputerAppIdentity, ComputerUseContext } from '../src/types.js'

const APP: ComputerAppIdentity = { bundleId: 'com.example.app', pid: 42, name: 'Example' }
const AGENT = { session: { id: 'sess-1', header: { createdAt: 1234567890, cwd: '/tmp/telos-ws' }, events: [{ type: 'turn/start', data: { turn: 1 } }] } } as unknown as Agent

function context(): ComputerUseContext {
  return { agent: AGENT, workspace: '/tmp/telos-ws', signal: new AbortController().signal }
}

function baseObservation(): BackendObservation {
  return {
    app: APP,
    stateHash: 'h1',
    frontmost: true,
    window: { title: 'Main', frame: { x: 0, y: 0, width: 800, height: 600 }, id: 7 },
    treeText: 'Save',
    truncated: false,
    elements: [{ index: 0, locator: [0], role: 'button', title: 'Save', actions: ['AXPress'] }],
    permissions: { accessibility: 'granted', screenRecording: 'granted' },
  }
}

function fakeBackend(overrides: Partial<ComputerUseBackend> = {}): ComputerUseBackend & { observeCount: number; actCount: number } {
  let hash = 0
  const backend: ComputerUseBackend & { observeCount: number; actCount: number } = {
    name: 'macos-ax',
    helperPath: '/tmp/helper',
    observeCount: 0,
    actCount: 0,
    resolveApp: async () => APP,
    listApps: async () => [],
    resolveLaunchTarget: async () => ({ ...APP, path: '/Applications/Example.app' }),
    openApp: async (_target, activate) => ({ app: APP, launched: false, activation: activate ? 'activated' : 'not-requested' }),
    observe: async () => {
      backend.observeCount += 1
      hash += 1
      return { ...baseObservation(), stateHash: `h${String(hash)}` }
    },
    act: async () => {
      backend.actCount += 1
      return { channel: 'accessibility', activation: 'not-requested', pointerInput: false, pointerRouting: 'none' }
    },
    visualizeCursor: async () => {},
    dispose: async () => {},
    health: async () => ({ helperVersion: '1', helperSha256: 'abc', accessibility: 'granted', screenRecording: 'granted' }),
    openSettings: async () => {},
  }
  return Object.assign(backend, overrides)
}

function makeStorage() {
  const sessions = new Map<string, unknown>()
  const table = { get: (key: string) => sessions.get(key), put: async (key: string, value: unknown) => { sessions.set(key, value) } }
  const domain = { table: () => table, close: async () => {} }
  return { open: async () => domain, sessions }
}

function makeFakeCtx(requests?: { count: number }): Context {
  const storage = makeStorage()
  return {
    reflect: { provide: () => {} },
    effect: () => () => {},
    inject: (_deps: readonly string[], callback: (storageCtx: Context) => Promise<() => Promise<void>>) => {
      const ready = callback({ storageDomain: storage } as unknown as Context).then(() => {})
      return Object.assign(ready, { dispose: () => {} })
    },
    get: (name: string) => (name === 'storageDomain' ? storage : undefined),
    approval: {
      overrideOf: () => 'ask',
      config: { policy: 'ask' },
      request: async () => {
        if (requests !== undefined) requests.count += 1
        return 'allowed-once'
      },
    },
    sessions: { flush: async () => true },
  } as unknown as Context
}

function fakeCtx(): Context {
  return makeFakeCtx()
}

describe('ComputerUseService', () => {
  it('authorizes and opens an installed app through the host foreground policy', async () => {
    let opened = false
    const backend = fakeBackend({
      openApp: async (_target, activate) => {
        opened = true
        expect(activate).toBe(true)
        return { app: APP, launched: true, activation: 'activated' }
      },
    })
    const service = new ComputerUseService(fakeCtx(), backend, resolveConfig({
      allowAllApps: true,
      interaction: { focusPolicy: 'activate' },
    }))
    await expect(service.openApp({ app: { name: APP.name } }, context())).resolves.toEqual({
      app: APP,
      launched: true,
      activation: 'activated',
    })
    expect(opened).toBe(true)
  })

  it('preserves foreground policy when opening an app', async () => {
    const backend = fakeBackend({
      openApp: async (_target, activate) => {
        expect(activate).toBe(false)
        return { app: APP, launched: false, activation: 'not-requested' }
      },
    })
    const service = new ComputerUseService(fakeCtx(), backend, resolveConfig({ allowAllApps: true }))
    await expect(service.openApp({ app: { bundleId: APP.bundleId } }, context()))
      .resolves.toMatchObject({ activation: 'not-requested' })
  })

  it('returns a fresh observation bound to the app', async () => {
    const service = new ComputerUseService(fakeCtx(), fakeBackend(), resolveConfig())
    const observation = await service.observe({ app: { bundleId: APP.bundleId }, screenshot: 'none' }, context())
    expect(observation.app).toEqual(APP)
    expect(observation.elements).toHaveLength(1)
    expect(observation.elements[0]?.targetHandle).toBeTruthy()
  })

  it('caches the read lease across observations', async () => {
    const backend = fakeBackend()
    const requests = { count: 0 }
    const service = new ComputerUseService(makeFakeCtx(requests), backend, resolveConfig())
    await service.observe({ app: { bundleId: APP.bundleId }, screenshot: 'none' }, context())
    await service.observe({ app: { bundleId: APP.bundleId }, screenshot: 'none' }, context())
    expect(requests.count).toBe(1)
  })

  it('rejects an action against an unknown observation', async () => {
    const service = new ComputerUseService(fakeCtx(), fakeBackend(), resolveConfig())
    await expect(service.act({ kind: 'click', observationId: 'missing' as never, elementIndex: 0 }, context()))
      .rejects.toThrowError(ComputerUseError)
  })

  it('executes an observation-bound action and returns fresh state', async () => {
    const backend = fakeBackend()
    const service = new ComputerUseService(fakeCtx(), backend, resolveConfig({ settleMs: 0, maxSettleMs: 100 }))
    const observation = await service.observe({ app: { bundleId: APP.bundleId }, screenshot: 'none' }, context())
    const result = await service.act({ kind: 'click', observationId: observation.observationId, elementIndex: 0 }, context())
    expect(backend.actCount).toBe(1)
    expect(result.action).toBe('click')
    expect(result.observation.observationId).toBeTruthy()
  })

  it('bounds post-action settlement when the observable state does not change', async () => {
    const stable = baseObservation()
    const backend = fakeBackend({ observe: async () => {
      backend.observeCount += 1
      return stable
    } })
    const service = new ComputerUseService(fakeCtx(), backend, resolveConfig({ settleMs: 0, maxSettleMs: 5000 }))
    const observation = await service.observe({ app: { bundleId: APP.bundleId } }, context())
    await service.act({ kind: 'click', observationId: observation.observationId, elementIndex: 0 }, context())
    expect(backend.observeCount).toBe(3)
  })

  it('stops settling immediately when foreground state changes', async () => {
    let calls = 0
    const backend = fakeBackend({ observe: async () => {
      backend.observeCount += 1
      calls += 1
      return { ...baseObservation(), frontmost: calls >= 3 }
    } })
    const service = new ComputerUseService(fakeCtx(), backend, resolveConfig({ settleMs: 0, maxSettleMs: 5000 }))
    const observation = await service.observe({ app: { bundleId: APP.bundleId } }, context())
    await service.act({ kind: 'click', observationId: observation.observationId, elementIndex: 0 }, context())
    expect(backend.observeCount).toBe(3)
  })
})
