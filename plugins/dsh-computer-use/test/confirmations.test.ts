import { describe, expect, it } from 'vitest'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Context } from '@deepseek-ai/cordis'
import type { ApprovalOutcome } from '@deepseek-ai/dsh-user-approval'
import type { ResolvedComputerUseConfig } from '../src/config.js'
import { resolveConfig } from '../src/config.js'
import { ComputerConfirmationManager } from '../src/confirmations.js'
import { ComputerUseError } from '../src/errors.js'
import {
  ComputerObservationId,
  type ComputerActionRequest,
  type ComputerAppIdentity,
} from '../src/types.js'

const APP: ComputerAppIdentity = { bundleId: 'com.example.app', pid: 42, name: 'Example' }
const OBSERVATION = ComputerObservationId('obs-1')
const AGENT = {} as unknown as Agent

function config(overrides: Partial<ResolvedComputerUseConfig> = {}): () => ResolvedComputerUseConfig {
  return () => ({ ...resolveConfig(), ...overrides } as ResolvedComputerUseConfig)
}

function sensitiveClick(overrides: Partial<ComputerActionRequest> = {}): ComputerActionRequest {
  return { kind: 'click', observationId: OBSERVATION, sensitive: true, elementIndex: 0, ...overrides } as ComputerActionRequest
}

function approvingContext(outcome: ApprovalOutcome = 'allowed-once'): Context {
  return {
    approval: {
      overrideOf: () => 'ask',
      config: { policy: 'ask' },
      request: async () => outcome,
    },
  } as unknown as Context
}

describe('ComputerConfirmationManager', () => {
  it('mints a token after an allowed-once approval', async () => {
    const manager = new ComputerConfirmationManager(approvingContext(), config())
    const action = sensitiveClick({ confirmationToken: undefined })
    const confirmation = await manager.confirm(AGENT, APP, { action, reason: 'delete', target: 'Delete button' }, undefined, new AbortController().signal)
    expect(confirmation.token).toBeTruthy()
    expect(confirmation.app).toEqual(APP)
    expect(confirmation.observationId).toBe(OBSERVATION)
  })

  it('fails closed when approval is rejected', async () => {
    const manager = new ComputerConfirmationManager(approvingContext('rejected'), config())
    const action = sensitiveClick({ confirmationToken: undefined })
    await expect(manager.confirm(AGENT, APP, { action, reason: 'delete', target: 'Delete' }, undefined, new AbortController().signal))
      .rejects.toThrowError(ComputerUseError)
  })

  it('fails closed when the session approval policy is never', async () => {
    const ctx = { approval: { overrideOf: () => 'never', config: { policy: 'ask' } } } as unknown as Context
    const manager = new ComputerConfirmationManager(ctx, config())
    const action = sensitiveClick({ confirmationToken: undefined })
    await expect(manager.confirm(AGENT, APP, { action, reason: 'delete', target: 'Delete' }, undefined, new AbortController().signal))
      .rejects.toThrow(/approval prompts are disabled/)
  })

  it('consumes a matching sensitive action exactly once', async () => {
    const manager = new ComputerConfirmationManager(approvingContext(), config())
    const action = sensitiveClick({ confirmationToken: undefined })
    const { token } = await manager.confirm(AGENT, APP, { action, reason: 'delete', target: 'Delete' }, undefined, new AbortController().signal)
    expect(() => manager.consume(AGENT, APP, sensitiveClick({ confirmationToken: token }))).not.toThrow()
    expect(() => manager.consume(AGENT, APP, sensitiveClick({ confirmationToken: token }))).toThrow(/already consumed/)
  })

  it('allows a non-sensitive action without a token', () => {
    const manager = new ComputerConfirmationManager(approvingContext(), config())
    const action = { kind: 'click', observationId: OBSERVATION, elementIndex: 0 } as ComputerActionRequest
    expect(() => manager.consume(AGENT, APP, action)).not.toThrow()
  })

  it('rejects a non-sensitive action carrying a token', () => {
    const manager = new ComputerConfirmationManager(approvingContext(), config())
    const action = { kind: 'click', observationId: OBSERVATION, elementIndex: 0, confirmationToken: 'x' } as unknown as ComputerActionRequest
    expect(() => manager.consume(AGENT, APP, action)).toThrow(/valid only when sensitive is true/)
  })

  it('rejects a sensitive action without a token', () => {
    const manager = new ComputerConfirmationManager(approvingContext(), config())
    expect(() => manager.consume(AGENT, APP, sensitiveClick({ confirmationToken: undefined }))).toThrow(/requires a token/)
  })

  it('rejects a token bound to a different action', async () => {
    const manager = new ComputerConfirmationManager(approvingContext(), config())
    const action = sensitiveClick({ confirmationToken: undefined })
    const { token } = await manager.confirm(AGENT, APP, { action, reason: 'delete', target: 'Delete' }, undefined, new AbortController().signal)
    const different = sensitiveClick({ confirmationToken: token, x: 999 })
    expect(() => manager.consume(AGENT, APP, different)).toThrow(/does not match this app, observation, or action/)
  })

  it('rejects a token bound to a different app', async () => {
    const manager = new ComputerConfirmationManager(approvingContext(), config())
    const action = sensitiveClick({ confirmationToken: undefined })
    const { token } = await manager.confirm(AGENT, APP, { action, reason: 'delete', target: 'Delete' }, undefined, new AbortController().signal)
    expect(() => manager.consume(AGENT, { ...APP, pid: 99 }, sensitiveClick({ confirmationToken: token }))).toThrow(/does not match this app, observation, or action/)
  })

  it('rejects an expired token and consumes it', async () => {
    let now = 0
    const manager = new ComputerConfirmationManager(approvingContext(), config({ confirmationTtlMs: 300000 }), () => now)
    const action = sensitiveClick({ confirmationToken: undefined })
    const { token } = await manager.confirm(AGENT, APP, { action, reason: 'delete', target: 'Delete' }, undefined, new AbortController().signal)
    now = 400000
    expect(() => manager.consume(AGENT, APP, sensitiveClick({ confirmationToken: token }))).toThrow(/expired/)
  })
})
