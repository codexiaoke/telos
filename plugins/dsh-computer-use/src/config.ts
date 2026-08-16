/** Validated provider, observation, settlement, artifact, and app-policy configuration. */

import { ComputerUseError } from './errors.js'

/** One persisted application grant. Wildcards are intentionally unsupported. */
export interface ComputerUseAppGrant {
  bundleId: string
  read?: boolean
  control?: boolean
}

/** Host-owned policy for foreground activation, keyboard routing, target-process input, and the visible Agent cursor. */
export interface ComputerUseInteractionConfig {
  focusPolicy?: 'preserve' | 'activate'
  keyboardPolicy?: 'preserve' | 'activate'
  pointerInputPolicy?: 'deny' | 'targeted'
  cursorVisualization?: 'hidden' | 'visible'
  cursorMotionMs?: number
  cursorAutoHideMs?: number
}

/** User-facing configuration. `observationTtlMs: 0` disables observation expiry. */
export interface ComputerUseConfig {
  observationTtlMs?: number
  confirmationTtlMs?: number
  actionTimeoutMs?: number
  settleMs?: number
  maxSettleMs?: number
  maxNodes?: number
  maxDepth?: number
  maxTextBytes?: number
  maxScreenshotBytes?: number
  artifactRoot?: string
  helper?: {
    path?: string
    allowSourceBuild?: boolean
  }
  interaction?: ComputerUseInteractionConfig
  allowAllApps?: boolean
  grants?: ComputerUseAppGrant[]
}

/** Fully defaulted configuration consumed at runtime. */
export interface ResolvedComputerUseConfig {
  observationTtlMs: number
  confirmationTtlMs: number
  actionTimeoutMs: number
  settleMs: number
  maxSettleMs: number
  maxNodes: number
  maxDepth: number
  maxTextBytes: number
  maxScreenshotBytes: number
  artifactRoot: string
  helper: {
    path?: string
    allowSourceBuild: boolean
  }
  interaction: {
    focusPolicy: 'preserve' | 'activate'
    keyboardPolicy: 'preserve' | 'activate'
    pointerInputPolicy: 'deny' | 'targeted'
    cursorVisualization: 'hidden' | 'visible'
    cursorMotionMs: number
    cursorAutoHideMs: number
  }
  allowAllApps: boolean
  grants: Array<{
    bundleId: string
    read: boolean
    control: boolean
  }>
}

function integer(name: string, value: number, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ComputerUseError('COMPUTER_PROVIDER_FAILURE', `${name} must be an integer between ${String(min)} and ${String(max)}`)
  }
  return value
}

function option<T extends string>(name: string, value: string, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) {
    throw new ComputerUseError('COMPUTER_PROVIDER_FAILURE', `${name} must be one of ${allowed.join(', ')}`)
  }
  return value as T
}

/** Validate and normalize one raw config object. */
export function resolveConfig(config: ComputerUseConfig = {}): ResolvedComputerUseConfig {
  const observationTtl = config.observationTtlMs ?? 0
  const observationTtlMs = observationTtl === 0 ? 0 : integer('observationTtlMs', observationTtl, 1000, 86400000)
  const confirmationTtlMs = integer('confirmationTtlMs', config.confirmationTtlMs ?? 300000, 1000, 900000)
  const actionTimeoutMs = integer('actionTimeoutMs', config.actionTimeoutMs ?? 15000, 1000, 120000)
  const settleMs = integer('settleMs', config.settleMs ?? 250, 0, 10000)
  const maxSettleMs = integer('maxSettleMs', config.maxSettleMs ?? 5000, 100, 60000)
  if (settleMs > maxSettleMs) {
    throw new ComputerUseError('COMPUTER_PROVIDER_FAILURE', 'settleMs must be no greater than maxSettleMs')
  }
  const maxNodes = integer('maxNodes', config.maxNodes ?? 500, 10, 5000)
  const maxDepth = integer('maxDepth', config.maxDepth ?? 14, 1, 64)
  const maxTextBytes = integer('maxTextBytes', config.maxTextBytes ?? 64000, 1024, 1048576)
  const maxScreenshotBytes = integer('maxScreenshotBytes', config.maxScreenshotBytes ?? 33554432, 1024, 268435456)
  const artifactRoot = (config.artifactRoot ?? '.dsh-computer-use/artifacts').trim()
  if (artifactRoot.length === 0 || artifactRoot.startsWith('/') || artifactRoot.split(/[\\/]+/u).includes('..')) {
    throw new ComputerUseError('COMPUTER_PROVIDER_FAILURE', 'artifactRoot must be a non-empty workspace-relative path without ..')
  }
  const helperPath = config.helper?.path?.trim()
  if (helperPath !== undefined && helperPath.length === 0) {
    throw new ComputerUseError('COMPUTER_PROVIDER_FAILURE', 'helper.path must not be empty')
  }
  const focusPolicy = option('interaction.focusPolicy', config.interaction?.focusPolicy ?? 'preserve', ['preserve', 'activate'] as const)
  const keyboardPolicy = option('interaction.keyboardPolicy', config.interaction?.keyboardPolicy ?? 'preserve', ['preserve', 'activate'] as const)
  const pointerInputPolicy = option('interaction.pointerInputPolicy', config.interaction?.pointerInputPolicy ?? 'targeted', ['deny', 'targeted'] as const)
  const cursorVisualization = option('interaction.cursorVisualization', config.interaction?.cursorVisualization ?? 'visible', ['hidden', 'visible'] as const)
  const cursorMotionMs = integer('interaction.cursorMotionMs', config.interaction?.cursorMotionMs ?? 180, 0, 2000)
  const cursorAutoHideMs = integer('interaction.cursorAutoHideMs', config.interaction?.cursorAutoHideMs ?? 0, 0, 30000)
  const allowAllApps = config.allowAllApps ?? false
  const seen = new Set<string>()
  const grants = (config.grants ?? []).map((grant) => {
    const bundleId = grant.bundleId.trim()
    if (bundleId.length === 0 || bundleId === '*' || bundleId.includes('*')) {
      throw new ComputerUseError('COMPUTER_PROVIDER_FAILURE', 'grants[].bundleId must be one exact non-wildcard bundle id')
    }
    if (seen.has(bundleId)) {
      throw new ComputerUseError('COMPUTER_PROVIDER_FAILURE', `duplicate app grant for ${bundleId}`)
    }
    seen.add(bundleId)
    const control = grant.control ?? false
    return { bundleId, read: (grant.read ?? false) || control, control }
  })
  return {
    observationTtlMs,
    confirmationTtlMs,
    actionTimeoutMs,
    settleMs,
    maxSettleMs,
    maxNodes,
    maxDepth,
    maxTextBytes,
    maxScreenshotBytes,
    artifactRoot,
    helper: {
      ...(helperPath === undefined ? {} : { path: helperPath }),
      allowSourceBuild: config.helper?.allowSourceBuild ?? false,
    },
    interaction: {
      focusPolicy,
      keyboardPolicy,
      pointerInputPolicy,
      cursorVisualization,
      cursorMotionMs,
      cursorAutoHideMs,
    },
    allowAllApps,
    grants,
  }
}
