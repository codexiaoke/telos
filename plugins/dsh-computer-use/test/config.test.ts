import { describe, expect, it } from 'vitest'
import { ComputerUseError } from '../src/errors.js'
import { resolveConfig } from '../src/config.js'

describe('resolveConfig', () => {
  it('applies production defaults', () => {
    const config = resolveConfig()
    expect(config).toMatchObject({
      observationTtlMs: 0,
      confirmationTtlMs: 300000,
      actionTimeoutMs: 15000,
      settleMs: 250,
      maxSettleMs: 5000,
      maxNodes: 500,
      maxDepth: 14,
      maxTextBytes: 64000,
      maxScreenshotBytes: 33554432,
      maxComputerUseSteps: 12,
      maxActionsPerStep: 8,
      artifactRoot: '.dsh-computer-use/artifacts',
      allowAllApps: false,
    })
    expect(config.interaction).toEqual({
      focusPolicy: 'preserve',
      keyboardPolicy: 'preserve',
      pointerInputPolicy: 'targeted',
      cursorVisualization: 'visible',
      cursorMotionMs: 180,
      cursorAutoHideMs: 0,
    })
  })

  it('treats a zero observation TTL as disabled', () => {
    expect(resolveConfig({ observationTtlMs: 0 }).observationTtlMs).toBe(0)
    expect(resolveConfig({ observationTtlMs: 60000 }).observationTtlMs).toBe(60000)
  })

  it('derives read from control for an app grant', () => {
    const config = resolveConfig({ grants: [{ bundleId: 'com.example.app', control: true }] })
    expect(config.grants).toEqual([{ bundleId: 'com.example.app', read: true, control: true }])
  })

  it('rejects wildcard and duplicate grants', () => {
    expect(() => resolveConfig({ grants: [{ bundleId: '*' }] })).toThrowError(ComputerUseError)
    expect(() => resolveConfig({ grants: [{ bundleId: 'com.a' }, { bundleId: 'com.a' }] })).toThrow(/duplicate app grant/)
  })

  it('rejects a workspace-relative artifact root with ..', () => {
    expect(() => resolveConfig({ artifactRoot: '../artifacts' })).toThrow(/workspace-relative path/)
    expect(() => resolveConfig({ artifactRoot: '/absolute' })).toThrow(/workspace-relative path/)
  })

  it('rejects settleMs greater than maxSettleMs', () => {
    expect(() => resolveConfig({ settleMs: 9000, maxSettleMs: 5000 })).toThrow(/settleMs must be no greater than maxSettleMs/)
  })

  it('rejects an invalid interaction policy option', () => {
    expect(() => resolveConfig({ interaction: { focusPolicy: 'steal' as never } })).toThrow(/focusPolicy must be one of/)
  })
})
