/** macOS Accessibility/CoreGraphics/ScreenCaptureKit provider for `ctx.computerUse`. */

import { setTimeout as delay } from 'node:timers/promises'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-subprocess'
import type {
  BackendActionRequest,
  BackendActionResult,
  BackendCursorAction,
  BackendHealth,
  BackendLaunchTarget,
  BackendObservation,
  BackendObserveOptions,
  ComputerUseBackend,
} from '../backend.js'
import type { ResolvedComputerUseConfig } from '../config.js'
import type { ComputerAppIdentity, ComputerAppSelector, ComputerAppSummary, ComputerOpenAppResult } from '../types.js'
import { NativeHelperClient } from '../native-helper.js'

interface NativeHealth {
  helperVersion: string
  accessibility: BackendHealth['accessibility']
  screenRecording: BackendHealth['screenRecording']
}

/** Fixed-command native backend. */
export class MacOSBackend implements ComputerUseBackend {
  readonly name = 'macos-ax' as const
  readonly client: NativeHelperClient

  constructor(
    ctx: Context,
    private readonly config: ResolvedComputerUseConfig,
  ) {
    this.client = new NativeHelperClient(ctx, config)
  }

  get helperPath(): string {
    return this.client.helperPath
  }

  async resolveApp(selector: ComputerAppSelector, signal: AbortSignal): Promise<ComputerAppIdentity> {
    return await this.client.invoke<ComputerAppIdentity>({ command: 'resolve-app', selector }, signal)
  }

  async listApps(signal: AbortSignal): Promise<ComputerAppSummary[]> {
    return await this.client.invoke<ComputerAppSummary[]>({ command: 'list-apps' }, signal)
  }

  async resolveLaunchTarget(selector: ComputerAppSelector, signal: AbortSignal): Promise<BackendLaunchTarget> {
    return await this.client.invoke<BackendLaunchTarget>({ command: 'resolve-launch-target', selector }, signal)
  }

  async openApp(target: BackendLaunchTarget, activate: boolean, signal: AbortSignal): Promise<ComputerOpenAppResult> {
    return await this.client.invoke<ComputerOpenAppResult>({
      command: 'open-app',
      target,
      activate,
      actionTimeoutMs: this.config.actionTimeoutMs,
    }, signal)
  }

  async observe(app: ComputerAppIdentity, options: BackendObserveOptions, signal: AbortSignal): Promise<BackendObservation> {
    return await this.client.invoke<BackendObservation>({ command: 'observe', app, options }, signal)
  }

  async act(request: BackendActionRequest, signal: AbortSignal): Promise<BackendActionResult> {
    return await this.client.invoke<BackendActionResult>({
      command: 'act',
      request: {
        ...request,
        actionTimeoutMs: this.config.actionTimeoutMs,
        limits: {
          maxNodes: this.config.maxNodes,
          maxDepth: this.config.maxDepth,
          maxTextBytes: this.config.maxTextBytes,
        },
      },
    }, signal)
  }

  async visualizeCursor(action: BackendCursorAction, phase: 'before' | 'after', signal: AbortSignal): Promise<void> {
    if (this.config.interaction.cursorVisualization !== 'visible') return
    const autoHideMs = this.config.interaction.cursorAutoHideMs
    const move = async (point: { x: number; y: number }, durationMs: number): Promise<void> => {
      await this.client.cursorCommand({
        op: 'move',
        x: point.x,
        y: point.y,
        durationMs,
        autoHideMs,
        targetPid: action.targetPid,
        targetWindowNumber: action.targetWindowNumber,
        targetWindowFrame: action.targetWindowFrame,
      }, signal)
    }
    if (phase === 'after') {
      if (action.kind === 'drag') await this.client.cursorCommand({
        op: 'release',
        autoHideMs,
        targetPid: action.targetPid,
        targetWindowNumber: action.targetWindowNumber,
        targetWindowFrame: action.targetWindowFrame,
      }, signal)
      return
    }
    const start = action.kind === 'drag' ? action.from : action.to
    if (start === undefined) return
    await move(start, this.config.interaction.cursorMotionMs)
    if (this.config.interaction.cursorMotionMs > 0) {
      await delay(this.config.interaction.cursorMotionMs, undefined, { signal })
    }
    if (action.kind === 'scroll') return
    await this.client.cursorCommand({
      op: 'press',
      autoHideMs,
      targetPid: action.targetPid,
      targetWindowNumber: action.targetWindowNumber,
      targetWindowFrame: action.targetWindowFrame,
      sustainedPress: action.kind === 'drag',
    }, signal)
    if (action.kind === 'drag') {
      await move(action.to, Math.max(this.config.interaction.cursorMotionMs, 240))
    }
  }

  async dispose(): Promise<void> {
    await this.client.dispose()
  }

  async health(signal: AbortSignal): Promise<BackendHealth> {
    const prepared = await this.client.prepare(signal)
    const health = await this.client.invoke<NativeHealth>({ command: 'health' }, signal)
    return {
      helperVersion: health.helperVersion || prepared.version,
      helperSha256: prepared.sha256,
      accessibility: health.accessibility,
      screenRecording: health.screenRecording,
    }
  }

  async openSettings(kind: 'accessibility' | 'screen-recording', signal: AbortSignal): Promise<void> {
    await this.client.invoke<null>({ command: 'open-settings', kind }, signal)
  }
}
