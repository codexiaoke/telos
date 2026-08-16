/** Provider-independent Computer Use Service: leases, observations, staleness, confirmations, and fresh post-action state. */

import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { Context, Service } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { allocateScreenshotPath, describeScreenshot } from './artifacts.js'
import type { BackendCursorAction, BackendObservation, ComputerUseBackend } from './backend.js'
import type { ResolvedComputerUseConfig } from './config.js'
import { ComputerConfirmationManager } from './confirmations.js'
import { diffElements } from './diff.js'
import { ComputerUseError, computerUseError } from './errors.js'
import { ComputerLeaseManager } from './leases.js'
import {
  describeComputerTarget,
  resolveComputerTarget,
  type ComputerTargetDescriptor,
} from './target-resolver.js'
import {
  ComputerObservationId,
  ComputerTargetHandle,
  type ComputerActionRequest,
  type ComputerActionResult,
  type ComputerCallAction,
  type ComputerCallActionResult,
  type ComputerAppIdentity,
  type ComputerAppSummary,
  type ComputerConfirmRequest,
  type ComputerConfirmation,
  type ComputerElement,
  type ComputerObservation,
  type ComputerOpenAppRequest,
  type ComputerOpenAppResult,
  type ComputerObserveRequest,
  type ComputerTargetResolutionResult,
  type ComputerUseContext,
  type ComputerUseStepRequest,
  type ComputerUseStepResult,
  type ComputerUseStatus,
  type ComputerKeyModifier,
} from './types.js'

declare module '@deepseek-ai/cordis' {
  interface Context {
    computerUse: ComputerUseService
  }
}

const MAX_UNCHANGED_SETTLE_SAMPLES = 2
const SEMANTIC_CLICK_SNAP_DISTANCE = 24

function distanceFromPointToFrame(
  point: { x: number; y: number },
  frame: NonNullable<BackendObservation['elements'][number]['frame']>,
): number {
  const dx = Math.max(frame.x - point.x, 0, point.x - (frame.x + frame.width))
  const dy = Math.max(frame.y - point.y, 0, point.y - (frame.y + frame.height))
  return Math.hypot(dx, dy)
}

function observationTransitioned(before: BackendObservation, after: BackendObservation): boolean {
  if (before.stateHash !== after.stateHash || before.frontmost !== after.frontmost) return true
  const beforeWindow = before.window
  const afterWindow = after.window
  if (beforeWindow === undefined || afterWindow === undefined) return beforeWindow !== afterWindow
  return beforeWindow.id !== afterWindow.id
    || beforeWindow.title !== afterWindow.title
    || beforeWindow.frame.x !== afterWindow.frame.x
    || beforeWindow.frame.y !== afterWindow.frame.y
    || beforeWindow.frame.width !== afterWindow.frame.width
    || beforeWindow.frame.height !== afterWindow.frame.height
}

interface StoredObservation {
  public: ComputerObservation
  backend: BackendObservation
  targets: Map<ComputerTargetHandle, ComputerTargetDescriptor>
  generation: number
}

interface AgentState {
  observations: Map<ComputerObservationId, StoredObservation>
  latestByApp: Map<string, ComputerObservationId>
  computerUseStepsByApp: Map<string, number>
}

function publicElements(observation: BackendObservation): {
  elements: ComputerElement[]
  targets: Map<ComputerTargetHandle, ComputerTargetDescriptor>
} {
  const targets = new Map<ComputerTargetHandle, ComputerTargetDescriptor>()
  const elements = observation.elements.map((backendElement) => {
    const { locator: _locator, nativeIdentifier: _nativeIdentifier, ...element } = backendElement
    const targetHandle = ComputerTargetHandle(randomUUID())
    targets.set(targetHandle, describeComputerTarget(backendElement, observation))
    return { ...element, targetHandle }
  })
  return { elements, targets }
}

function matchesWait(observation: BackendObservation, action: Extract<ComputerActionRequest, { kind: 'wait' }>): boolean {
  const condition = action.condition
  if (condition.text !== undefined && !observation.treeText.toLocaleLowerCase().includes(condition.text.toLocaleLowerCase())) return false
  if (condition.elementRole !== undefined && !observation.elements.some(element => element.role === condition.elementRole)) return false
  if (condition.elementTitle !== undefined && !observation.elements.some(element => element.title === condition.elementTitle || element.label === condition.elementTitle)) return false
  return condition.text !== undefined || condition.elementRole !== undefined || condition.elementTitle !== undefined
}

function targetIndex(action: ComputerActionRequest): number | undefined {
  switch (action.kind) {
    case 'click':
    case 'scroll':
    case 'set-value':
    case 'perform-action': return action.elementIndex
    case 'type-text':
    case 'press-key':
    case 'drag':
    case 'move':
    case 'wait': return undefined
  }
}

function targetHandle(action: ComputerActionRequest): ComputerTargetHandle | undefined {
  switch (action.kind) {
    case 'click':
    case 'scroll':
    case 'set-value':
    case 'perform-action': return action.targetHandle
    case 'type-text':
    case 'press-key':
    case 'drag':
    case 'move':
    case 'wait': return undefined
  }
}

function allowsTargetRebind(action: ComputerActionRequest): boolean {
  switch (action.kind) {
    case 'click':
    case 'scroll':
    case 'set-value':
    case 'perform-action': return action.allowRebind === true
    case 'type-text':
    case 'press-key':
    case 'drag':
    case 'move':
    case 'wait': return false
  }
}

function requiresElement(action: ComputerActionRequest): boolean {
  return action.kind === 'set-value' || action.kind === 'perform-action'
}

function requiresPointerInput(
  action: Exclude<ComputerActionRequest, { kind: 'wait' }>,
  element: BackendObservation['elements'][number] | undefined,
): boolean {
  switch (action.kind) {
    case 'click':
      if (action.x !== undefined || action.y !== undefined) return true
      return element !== undefined && !element.actions.includes('AXPress') && action.allowCoordinateFallback === true
    case 'scroll':
    case 'drag':
    case 'move': return true
    case 'set-value':
    case 'type-text':
    case 'press-key':
    case 'perform-action': return false
  }
}

function requiresForegroundPermission(action: Exclude<ComputerActionRequest, { kind: 'wait' }>): boolean {
  return action.kind === 'perform-action' && action.action === 'AXRaise'
}

function cursorAction(
  action: Exclude<ComputerActionRequest, { kind: 'wait' }>,
  element: BackendObservation['elements'][number] | undefined,
  window: BackendObservation['window'] | undefined,
  app: BackendObservation['app'],
): BackendCursorAction | undefined {
  if (window?.id === undefined) return undefined
  const target = {
    targetPid: app.pid,
    targetWindowNumber: window.id,
    targetWindowFrame: { ...window.frame },
  }
  const elementPoint = element?.frame === undefined
    ? undefined
    : { x: element.frame.x + element.frame.width / 2, y: element.frame.y + element.frame.height / 2 }
  const coordinateSpace = action.kind === 'click' || action.kind === 'scroll' || action.kind === 'drag' || action.kind === 'move'
    ? action.coordinateSpace
    : undefined
  const windowPoint = (x: number | undefined, y: number | undefined): { x: number; y: number } | undefined => {
    if (x === undefined || y === undefined || window === undefined) return undefined
    return coordinateSpace === 'screen' ? { x, y } : { x: window.frame.x + x, y: window.frame.y + y }
  }
  switch (action.kind) {
    case 'click':
    case 'scroll': {
      const point = elementPoint ?? windowPoint(action.x, action.y)
      return point === undefined ? undefined : { kind: action.kind, to: point, ...target }
    }
    case 'drag': {
      const from = windowPoint(action.fromX, action.fromY)
      const to = windowPoint(action.toX, action.toY)
      return from === undefined || to === undefined ? undefined : { kind: 'drag', from, to, ...target }
    }
    case 'move': {
      const point = windowPoint(action.x, action.y)
      return point === undefined ? undefined : { kind: 'move', to: point, ...target }
    }
    case 'set-value':
    case 'type-text':
    case 'press-key':
    case 'perform-action': return undefined
  }
}

const COMPUTER_KEY_MODIFIERS = new Map<string, ComputerKeyModifier>([
  ['CMD', 'command'],
  ['COMMAND', 'command'],
  ['CTRL', 'control'],
  ['CONTROL', 'control'],
  ['ALT', 'option'],
  ['OPTION', 'option'],
  ['SHIFT', 'shift'],
])

function normalizedComputerKey(value: string): string {
  const key = value.trim().toUpperCase()
  const aliases: Record<string, string> = {
    ENTER: 'return', RETURN: 'return', ESC: 'escape', ESCAPE: 'escape',
    BACKSPACE: 'delete', DELETE: 'delete', TAB: 'tab', SPACE: 'space',
    ARROWUP: 'up', ARROWDOWN: 'down', ARROWLEFT: 'left', ARROWRIGHT: 'right',
    HOME: 'home', END: 'end', PAGEUP: 'pageup', PAGEDOWN: 'pagedown',
  }
  return aliases[key] ?? key.toLocaleLowerCase()
}

function rejectPointerModifiers(action: ComputerCallAction): void {
  if ('keys' in action && action.keys !== undefined && action.keys.length > 0) {
    throw new ComputerUseError(
      'COMPUTER_ACTION_BLOCKED',
      `${action.type} modifier keys are not supported by the targeted macOS pointer route`,
    )
  }
}

function actionRequests(
  action: ComputerCallAction,
  observationId: ComputerObservationId,
  observation: BackendObservation,
): ComputerActionRequest[] {
  switch (action.type) {
    case 'click': {
      rejectPointerModifiers(action)
      const window = observation.window
      const point = window === undefined
        ? undefined
        : { x: window.frame.x + action.x, y: window.frame.y + action.y }
      const semanticTarget = point === undefined || (action.button ?? 'left') !== 'left'
        ? undefined
        : observation.elements
          .filter(element => element.enabled !== false
            && element.actions.includes('AXPress')
            && element.frame !== undefined
            && distanceFromPointToFrame(point, element.frame) <= SEMANTIC_CLICK_SNAP_DISTANCE)
          .sort((left, right) => {
            const leftDistance = distanceFromPointToFrame(point, left.frame!)
            const rightDistance = distanceFromPointToFrame(point, right.frame!)
            if (leftDistance !== rightDistance) return leftDistance - rightDistance
            const leftArea = (left.frame?.width ?? Number.POSITIVE_INFINITY) * (left.frame?.height ?? Number.POSITIVE_INFINITY)
            const rightArea = (right.frame?.width ?? Number.POSITIVE_INFINITY) * (right.frame?.height ?? Number.POSITIVE_INFINITY)
            return leftArea - rightArea
          })[0]
      return [{
        kind: 'click', observationId, x: action.x, y: action.y,
        coordinateSpace: 'window', button: action.button ?? 'left', clickCount: 1,
        ...(semanticTarget === undefined ? {} : { elementIndex: semanticTarget.index, allowCoordinateFallback: true }),
      }]
    }
    case 'double_click':
      rejectPointerModifiers(action)
      return [{
        kind: 'click', observationId, x: action.x, y: action.y,
        coordinateSpace: 'window', button: action.button ?? 'left', clickCount: 2,
      }]
    case 'scroll': {
      rejectPointerModifiers(action)
      const horizontal = Math.abs(action.scroll_x) > Math.abs(action.scroll_y)
      const delta = horizontal ? action.scroll_x : action.scroll_y
      if (!Number.isFinite(delta) || delta === 0) {
        throw new ComputerUseError('COMPUTER_ACTION_BLOCKED', 'scroll requires one non-zero finite scroll_x or scroll_y delta')
      }
      const direction = horizontal
        ? delta < 0 ? 'left' : 'right'
        : delta < 0 ? 'up' : 'down'
      return [{
        kind: 'scroll', observationId, x: action.x, y: action.y,
        coordinateSpace: 'window', direction,
        pages: Math.min(10, Math.max(1, Math.ceil(Math.abs(delta) / 500))),
      }]
    }
    case 'type':
      if (action.text === '') return []
      return [{ kind: 'type-text', observationId, text: action.text }]
    case 'keypress': {
      if (action.keys.length === 0) {
        throw new ComputerUseError('COMPUTER_ACTION_BLOCKED', 'keypress requires at least one key')
      }
      if (action.keys.length === 1 && action.keys[0]!.includes('+')) {
        const parts = action.keys[0]!.split('+').map(part => part.trim()).filter(Boolean)
        return actionRequests({ type: 'keypress', keys: parts }, observationId, observation)
      }
      const modifiers: ComputerKeyModifier[] = []
      const ordinary: string[] = []
      for (const raw of action.keys) {
        const modifier = COMPUTER_KEY_MODIFIERS.get(raw.trim().toUpperCase())
        if (modifier === undefined) ordinary.push(normalizedComputerKey(raw))
        else modifiers.push(modifier)
      }
      if (ordinary.length === 1) {
        return [{ kind: 'press-key', observationId, key: ordinary[0]!, ...(modifiers.length === 0 ? {} : { modifiers }) }]
      }
      if (modifiers.length > 0) {
        throw new ComputerUseError('COMPUTER_ACTION_BLOCKED', 'keypress modifiers must accompany exactly one ordinary key')
      }
      return ordinary.map(key => ({ kind: 'press-key' as const, observationId, key }))
    }
    case 'drag': {
      rejectPointerModifiers(action)
      if (action.path.length < 2) {
        throw new ComputerUseError('COMPUTER_ACTION_BLOCKED', 'drag path requires at least two points')
      }
      const from = action.path[0]!
      const to = action.path[action.path.length - 1]!
      return [{
        kind: 'drag', observationId, fromX: from.x, fromY: from.y,
        toX: to.x, toY: to.y, coordinateSpace: 'window',
      }]
    }
    case 'move':
      rejectPointerModifiers(action)
      return [{ kind: 'move', observationId, x: action.x, y: action.y, coordinateSpace: 'window' }]
    case 'wait':
    case 'screenshot': return []
  }
}

/** Complete Service Definition plus provider-independent implementation. */
export class ComputerUseService extends Service {
  private backend: ComputerUseBackend
  private config: ResolvedComputerUseConfig
  private generation = 1
  private readonly agents = new Map<Agent, AgentState>()
  private readonly leases: ComputerLeaseManager
  private readonly confirmations: ComputerConfirmationManager
  private readonly lifecycle = new AbortController()
  private readonly host: Context
  private healthState: Omit<ComputerUseStatus, 'platform' | 'provider' | 'generation' | 'helperPath'> = {
    ready: false,
    accessibility: 'unavailable',
    screenRecording: 'unavailable',
  }

  /** Register `ctx.computerUse` using one validated backend and configuration generation. */
  constructor(ctx: Context, backend: ComputerUseBackend, config: ResolvedComputerUseConfig) {
    super(ctx, 'computerUse')
    this.host = ctx
    this.backend = backend
    this.config = config
    this.leases = new ComputerLeaseManager(ctx, () => this.config)
    this.confirmations = new ComputerConfirmationManager(ctx, () => this.config)
    ctx.effect(() => async () => {
      this.lifecycle.abort()
      this.clearState()
      await this.backend.dispose()
    }, 'dsh-computer-use: service lifecycle')
  }

  /** Verify the active backend before consumers become injectable. */
  protected async initialize(): Promise<void> {
    try {
      const health = await this.backend.health(this.lifecycle.signal)
      this.healthState = { ready: true, ...health }
    } catch (error) {
      const failure = computerUseError(error, 'Computer Use provider initialization failed')
      this.healthState = { ready: false, accessibility: 'unavailable', screenRecording: 'unavailable', lastError: failure.message }
      throw failure
    }
  }

  /** Replace the backend/config generation after a validated live Settings update. */
  protected async reconfigure(backend: ComputerUseBackend, config: ResolvedComputerUseConfig): Promise<void> {
    const health = await backend.health(this.lifecycle.signal)
    const previous = this.backend
    this.backend = backend
    this.config = config
    this.generation += 1
    this.clearState()
    this.healthState = { ready: true, ...health }
    await previous.dispose()
  }

  /** Current provider and permission diagnostics. */
  status(): ComputerUseStatus {
    return {
      platform: process.platform,
      provider: 'macos-ax',
      generation: this.generation,
      helperPath: this.backend.helperPath,
      ...this.healthState,
    }
  }

  /** Re-run non-mutating provider health checks. */
  async health(signal: AbortSignal): Promise<ComputerUseStatus> {
    try {
      const health = await this.backend.health(AbortSignal.any([signal, this.lifecycle.signal]))
      this.healthState = { ready: true, ...health }
    } catch (error) {
      const failure = computerUseError(error, 'Computer Use health check failed')
      this.healthState = { ...this.healthState, ready: false, lastError: failure.message }
      throw failure
    }
    return this.status()
  }

  /** Open the exact macOS privacy pane after an explicit Settings-page action. */
  async openPermissionSettings(kind: 'accessibility' | 'screen-recording', signal: AbortSignal): Promise<void> {
    await this.backend.openSettings(kind, AbortSignal.any([signal, this.lifecycle.signal]))
  }

  /** List bounded running applications without inspecting their UI contents. */
  async listApps(context: ComputerUseContext): Promise<ComputerAppSummary[]> {
    return await this.backend.listApps(AbortSignal.any([context.signal, this.lifecycle.signal]))
  }

  /** Resolve authorization before deterministically launching or activating one installed app. */
  async openApp(request: ComputerOpenAppRequest, context: ComputerUseContext): Promise<ComputerOpenAppResult> {
    const signal = AbortSignal.any([context.signal, this.lifecycle.signal])
    const target = await this.backend.resolveLaunchTarget(request.app, signal)
    await this.leases.ensure(context.agent, {
      bundleId: target.bundleId,
      name: target.name,
      pid: target.pid ?? 0,
    }, 'control', 'computer_open_app', context.callId, signal)
    const result = await this.backend.openApp(target, this.config.interaction.focusPolicy === 'activate', signal)
    this.state(context.agent).computerUseStepsByApp.set(`${result.app.bundleId}:${result.app.pid}`, 0)
    return result
  }

  /** Obtain a fresh, scoped observation after enforcing the app read lease. */
  async observe(request: ComputerObserveRequest, context: ComputerUseContext): Promise<ComputerObservation> {
    const signal = AbortSignal.any([context.signal, this.lifecycle.signal])
    const app = await this.backend.resolveApp(request.app, signal)
    await this.leases.ensure(context.agent, app, 'read', 'computer_observe', context.callId, signal)
    return await this.capture(app, request, context, 'computer_observe')
  }

  /** Ask for a one-use token bound to an exact proposed sensitive action. */
  async confirm(request: ComputerConfirmRequest, context: ComputerUseContext): Promise<ComputerConfirmation> {
    const stored = this.requireObservation(request.action.observationId, context.agent)
    return await this.confirmations.confirm(
      context.agent,
      stored.backend.app,
      request,
      context.callId,
      AbortSignal.any([context.signal, this.lifecycle.signal]),
    )
  }

  /** Execute one observation-bound action and always return a fresh post-action observation. */
  async act(action: ComputerActionRequest, context: ComputerUseContext): Promise<ComputerActionResult> {
    return await this.actWithScreenshot(action, context)
  }

  private async actWithScreenshot(
    action: ComputerActionRequest,
    context: ComputerUseContext,
    postScreenshot?: 'none' | 'optional' | 'required',
  ): Promise<ComputerActionResult> {
    const signal = AbortSignal.any([context.signal, this.lifecycle.signal])
    const stored = this.requireObservation(action.observationId, context.agent)
    if (action.kind === 'wait') return await this.wait(stored, action, context, signal)
    const index = targetIndex(action)
    const handle = targetHandle(action)
    const originalElement = index === undefined ? undefined : stored.backend.elements.find(candidate => candidate.index === index)
    if (index !== undefined && originalElement === undefined) {
      throw new ComputerUseError('COMPUTER_ELEMENT_UNAVAILABLE', `element ${index} is not part of observation ${String(action.observationId)}`)
    }
    if (allowsTargetRebind(action) && handle === undefined) {
      throw new ComputerUseError('COMPUTER_TARGET_UNAVAILABLE', 'allowRebind requires a targetHandle from the referenced observation')
    }
    const descriptor = handle === undefined ? undefined : stored.targets.get(handle)
    if (handle !== undefined && descriptor === undefined) {
      throw new ComputerUseError('COMPUTER_TARGET_UNAVAILABLE', 'targetHandle is unknown or does not belong to the referenced observation')
    }
    if (descriptor !== undefined && index !== undefined
      && (descriptor.locator.length !== originalElement?.locator.length
        || !descriptor.locator.every((part, position) => part === originalElement.locator[position]))) {
      throw new ComputerUseError('COMPUTER_TARGET_UNAVAILABLE', 'elementIndex and targetHandle select different elements')
    }
    const selectedOriginalElement = originalElement ?? (descriptor === undefined
      ? undefined
      : stored.backend.elements.find(candidate => candidate.locator.length === descriptor.locator.length
        && candidate.locator.every((part, position) => part === descriptor.locator[position])))
    if (descriptor !== undefined && selectedOriginalElement === undefined) {
      throw new ComputerUseError('COMPUTER_TARGET_UNAVAILABLE', 'targetHandle no longer has provider evidence in the referenced observation')
    }
    if (requiresElement(action) && selectedOriginalElement === undefined) {
      throw new ComputerUseError('COMPUTER_ELEMENT_UNAVAILABLE', `${action.kind} requires elementIndex or targetHandle`)
    }
    if (requiresPointerInput(action, selectedOriginalElement) && this.config.interaction.pointerInputPolicy === 'deny') {
      throw new ComputerUseError(
        'COMPUTER_ACTION_BLOCKED',
        `${action.kind} requires target-process pointer input, which interaction.pointerInputPolicy denies; use an Accessibility action or enable targeted pointer input in host Settings`,
      )
    }
    if (requiresForegroundPermission(action) && this.config.interaction.focusPolicy === 'preserve') {
      throw new ComputerUseError(
        'COMPUTER_ACTION_BLOCKED',
        'AXRaise may raise the target window, which interaction.focusPolicy preserve denies; enable explicit activation in host Settings before using this action',
      )
    }
    await this.leases.ensure(context.agent, stored.backend.app, 'control', `computer_${action.kind}`, context.callId, signal)
    let actionObservation = stored.backend
    let element = selectedOriginalElement
    let resolution: ComputerTargetResolutionResult | undefined = selectedOriginalElement === undefined
      ? undefined
      : { mode: 'exact-locator', confidence: 1, candidateCount: 1, targetChanged: false }
    if (descriptor !== undefined) {
      const fresh = await this.backend.observe(stored.backend.app, {
        screenshot: 'none',
        maxNodes: this.config.maxNodes,
        maxDepth: this.config.maxDepth,
        maxTextBytes: this.config.maxTextBytes,
      }, signal)
      const resolved = resolveComputerTarget(stored.backend, fresh, descriptor, allowsTargetRebind(action))
      actionObservation = resolved.observation
      element = resolved.element
      resolution = resolved.resolution
      if (action.sensitive === true && resolution.targetChanged) {
        this.confirmations.invalidate(context.agent, action.confirmationToken)
        throw new ComputerUseError(
          'COMPUTER_TARGET_REBIND_REQUIRES_CONFIRMATION',
          'the sensitive target rebound to a fresh element; observe the current UI and request a new one-use confirmation before acting',
        )
      }
    }
    this.confirmations.consume(context.agent, stored.backend.app, action)
    const visualization = cursorAction(action, element, actionObservation.window, actionObservation.app)
    let cursorStarted = false
    if (visualization !== undefined && this.config.interaction.cursorVisualization === 'visible') {
      try {
        await this.backend.visualizeCursor(visualization, 'before', signal)
        cursorStarted = true
      } catch {
        // The overlay is presentation-only; native input remains authoritative.
      }
    }
    let outcome
    try {
      outcome = await this.backend.act({
        action,
        app: actionObservation.app,
        expectedStateHash: actionObservation.stateHash,
        interaction: this.config.interaction,
        ...(element === undefined ? {} : { element }),
        ...(actionObservation.window === undefined ? {} : { window: actionObservation.window }),
      }, signal)
    } catch (error) {
      throw computerUseError(error, `Computer Use ${action.kind} failed`)
    } finally {
      if (cursorStarted && visualization !== undefined) {
        try {
          await this.backend.visualizeCursor(visualization, 'after', signal)
        } catch {
          // The overlay is presentation-only; native input remains authoritative.
        }
      }
    }
    const started = Date.now()
    let latest: BackendObservation | undefined
    let unchangedSamples = 0
    do {
      if (this.config.settleMs > 0) await delay(this.config.settleMs, undefined, { signal })
      latest = await this.backend.observe(stored.backend.app, {
        screenshot: 'none',
        maxNodes: this.config.maxNodes,
        maxDepth: this.config.maxDepth,
        maxTextBytes: this.config.maxTextBytes,
      }, signal)
      if (observationTransitioned(actionObservation, latest)) break
      unchangedSamples += 1
    } while (unchangedSamples < MAX_UNCHANGED_SETTLE_SAMPLES && Date.now() - started < this.config.maxSettleMs)
    const observation = await this.capture(
      stored.backend.app,
      {
        app: { bundleId: stored.backend.app.bundleId, pid: stored.backend.app.pid },
        screenshot: postScreenshot ?? (stored.public.screenshot === undefined ? 'none' : 'optional'),
      },
      context,
      'computer_action',
      latest,
    )
    return {
      action: action.kind,
      channel: outcome.channel,
      activation: outcome.activation,
      pointerInput: outcome.pointerInput,
      pointerRouting: outcome.pointerRouting,
      ...(resolution === undefined ? {} : { resolution }),
      observation,
    }
  }

  /**
   * Run one screenshot-grounded action batch and return a new screenshot.
   * This is the custom-harness form of the OpenAI Computer Use loop: callers
   * begin with an empty batch, then ground each subsequent batch only in the
   * returned frame.
   */
  async computerUse(request: ComputerUseStepRequest, context: ComputerUseContext): Promise<ComputerUseStepResult> {
    const signal = AbortSignal.any([context.signal, this.lifecycle.signal])
    if (request.actions.length > this.config.maxActionsPerStep) {
      throw new ComputerUseError(
        'COMPUTER_ACTION_BLOCKED',
        `computer_use accepts at most ${String(this.config.maxActionsPerStep)} ordered actions per screenshot`,
      )
    }

    if (request.observationId === undefined) {
      if (request.actions.length !== 0) {
        throw new ComputerUseError(
          'COMPUTER_STALE_OBSERVATION',
          'the first computer_use call must use actions=[] so actions can be grounded in its returned screenshot',
        )
      }
      const opened = await this.openApp({ app: request.app }, context)
      await this.leases.ensure(context.agent, opened.app, 'read', 'computer_use', context.callId, signal)
      const key = `${opened.app.bundleId}:${opened.app.pid}`
      this.state(context.agent).computerUseStepsByApp.set(key, 0)
      const observation = await this.capture(
        opened.app,
        { app: { bundleId: opened.app.bundleId, pid: opened.app.pid }, screenshot: 'required', full: true },
        context,
        'computer_use',
      )
      return { step: 0, actions: [], observation }
    }

    const initial = this.requireObservation(request.observationId, context.agent)
    const selector = request.app
    let selectorMismatch = (selector.bundleId !== undefined && selector.bundleId !== initial.backend.app.bundleId)
      || (selector.pid !== undefined && selector.pid !== initial.backend.app.pid)
    const nameDiffers = selector.name !== undefined
      && selector.name.localeCompare(initial.backend.app.name, undefined, { sensitivity: 'accent' }) !== 0
    if (!selectorMismatch && nameDiffers && selector.bundleId === undefined && selector.pid === undefined) {
      try {
        const resolved = await this.backend.resolveApp(selector, signal)
        selectorMismatch = resolved.bundleId !== initial.backend.app.bundleId || resolved.pid !== initial.backend.app.pid
      } catch {
        selectorMismatch = true
      }
    }
    if (selectorMismatch) {
      throw new ComputerUseError('COMPUTER_STALE_OBSERVATION', 'computer_use app selector does not match the referenced screenshot')
    }
    const key = `${initial.backend.app.bundleId}:${initial.backend.app.pid}`
    const state = this.state(context.agent)
    const step = (state.computerUseStepsByApp.get(key) ?? 0) + 1
    if (step > this.config.maxComputerUseSteps) {
      throw new ComputerUseError(
        'COMPUTER_TIMEOUT',
        `computer_use stopped after ${String(this.config.maxComputerUseSteps)} screenshot/action steps; report the blocker instead of retrying`,
      )
    }
    state.computerUseStepsByApp.set(key, step)

    let currentId = request.observationId
    const outcomes: ComputerCallActionResult[] = []
    for (const callAction of request.actions) {
      signal.throwIfAborted()
      if (callAction.type === 'wait') {
        const waitMs = callAction.ms ?? 500
        if (!Number.isInteger(waitMs) || waitMs < 0) {
          throw new ComputerUseError('COMPUTER_TIMEOUT', 'computer_use wait.ms must be a non-negative integer')
        }
        const boundedWaitMs = Math.min(waitMs, 2_000)
        if (boundedWaitMs > 0) await delay(boundedWaitMs, undefined, { signal })
        outcomes.push({ type: callAction.type, status: 'completed', channel: 'wait' })
        continue
      }
      if (callAction.type === 'screenshot') {
        outcomes.push({ type: callAction.type, status: 'completed', channel: 'screenshot' })
        continue
      }
      const requests = actionRequests(
        callAction,
        currentId,
        this.requireObservation(currentId, context.agent).backend,
      )
      let channel: ComputerActionResult['channel'] = 'wait'
      for (const action of requests) {
        const rebound = { ...action, observationId: currentId } as ComputerActionRequest
        const result = await this.actWithScreenshot(rebound, context, 'none')
        currentId = result.observation.observationId
        channel = result.channel
      }
      outcomes.push({ type: callAction.type, status: 'completed', channel })
    }

    const latest = this.requireObservation(currentId, context.agent)
    const observation = await this.capture(
      latest.backend.app,
      { app: { bundleId: latest.backend.app.bundleId, pid: latest.backend.app.pid }, screenshot: 'required', full: true },
      context,
      'computer_use',
    )
    return { step, actions: outcomes, observation }
  }

  /** Release all scoped observations and confirmations for one disposed Agent. */
  releaseAgent(agent: Agent): void {
    this.agents.delete(agent)
    this.leases.releaseAgent(agent)
    this.confirmations.releaseAgent(agent)
  }

  private state(agent: Agent): AgentState {
    let state = this.agents.get(agent)
    if (state === undefined) {
      state = { observations: new Map(), latestByApp: new Map(), computerUseStepsByApp: new Map() }
      this.agents.set(agent, state)
    }
    return state
  }

  private requireObservation(id: ComputerObservationId, agent: Agent): StoredObservation {
    this.prune(agent)
    const stored = this.state(agent).observations.get(id)
    if (stored === undefined || stored.generation !== this.generation) {
      throw new ComputerUseError('COMPUTER_STALE_OBSERVATION', `observation ${String(id)} is unknown, expired, or belongs to another provider generation`)
    }
    return stored
  }

  private prune(agent: Agent): void {
    const state = this.agents.get(agent)
    if (state === undefined) return
    const now = Date.now()
    for (const [id, stored] of state.observations) {
      if (Date.parse(stored.public.expiresAt) <= now || stored.generation !== this.generation) state.observations.delete(id)
    }
    for (const [app, id] of state.latestByApp) {
      if (!state.observations.has(id)) state.latestByApp.delete(app)
    }
  }

  private async capture(
    app: ComputerAppIdentity,
    request: ComputerObserveRequest,
    context: ComputerUseContext,
    sourceTool: 'computer_observe' | 'computer_action' | 'computer_use',
    preObserved?: BackendObservation,
  ): Promise<ComputerObservation> {
    const signal = AbortSignal.any([context.signal, this.lifecycle.signal])
    const screenshot = request.screenshot ?? 'none'
    const screenshotPath = screenshot === 'none'
      ? undefined
      : await allocateScreenshotPath(context.workspace, this.config.artifactRoot, context.agent.session.id)
    const backend = preObserved !== undefined && screenshot === 'none'
      ? preObserved
      : await this.backend.observe(app, {
        screenshot,
        ...(screenshotPath === undefined ? {} : { screenshotPath }),
        maxNodes: this.config.maxNodes,
        maxDepth: this.config.maxDepth,
        maxTextBytes: this.config.maxTextBytes,
      }, signal)
    if (backend.app.bundleId !== app.bundleId || backend.app.pid !== app.pid) {
      throw new ComputerUseError('COMPUTER_STALE_OBSERVATION', 'the selected application restarted or resolved to a different process')
    }
    const state = this.state(context.agent)
    this.prune(context.agent)
    const key = `${app.bundleId}:${app.pid}`
    const previousId = state.latestByApp.get(key)
    const previous = previousId === undefined ? undefined : state.observations.get(previousId)
    const projected = publicElements(backend)
    const elements = projected.elements
    const full = request.full === true || previous === undefined
    const createdAt = Date.now()
    const observationId = ComputerObservationId(randomUUID())
    const describedArtifact = backend.screenshot === undefined
      ? undefined
      : await describeScreenshot(
        backend.screenshot.path,
        backend.screenshot.width,
        backend.screenshot.height,
        this.config.maxScreenshotBytes,
        sourceTool,
      )
    let artifact
    if (describedArtifact !== undefined) {
      const saved = await this.host.attachments.saveImage({
        data: await readFile(describedArtifact.path),
        mediaType: 'image/png',
        name: describedArtifact.filename,
      })
      if (saved.mediaType !== 'image/png') {
        throw new ComputerUseError('COMPUTER_PROVIDER_FAILURE', 'attachment storage changed the verified screenshot media type')
      }
      artifact = { ...describedArtifact, attachment: { ...saved, mediaType: 'image/png' as const } }
    }
    const observation: ComputerObservation = {
      observationId,
      app: backend.app,
      createdAt: new Date(createdAt).toISOString(),
      expiresAt: this.config.observationTtlMs === 0
        ? '9999-12-31T23:59:59.999Z'
        : new Date(createdAt + this.config.observationTtlMs).toISOString(),
      frontmost: backend.frontmost,
      ...(backend.window === undefined ? {} : { window: backend.window }),
      tree: {
        mode: full ? 'full' : 'diff',
        text: full ? backend.treeText : diffElements(previous.public.elements, elements, this.config.maxTextBytes),
        truncated: backend.truncated,
      },
      elements,
      ...(artifact === undefined ? {} : { screenshot: artifact }),
      permissions: backend.permissions,
    }
    state.observations.set(observationId, { public: observation, backend, targets: projected.targets, generation: this.generation })
    state.latestByApp.set(key, observationId)
    while (state.observations.size > 64) {
      const oldest = state.observations.keys().next().value as ComputerObservationId | undefined
      if (oldest === undefined) break
      state.observations.delete(oldest)
    }
    return observation
  }

  private async wait(
    stored: StoredObservation,
    action: Extract<ComputerActionRequest, { kind: 'wait' }>,
    context: ComputerUseContext,
    signal: AbortSignal,
  ): Promise<ComputerActionResult> {
    await this.leases.ensure(context.agent, stored.backend.app, 'read', 'computer_wait', context.callId, signal)
    const timeoutMs = action.timeoutMs ?? this.config.maxSettleMs
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > this.config.maxSettleMs) {
      throw new ComputerUseError('COMPUTER_TIMEOUT', `wait timeout must be between 100 and ${this.config.maxSettleMs} milliseconds`)
    }
    const deadline = Date.now() + timeoutMs
    let latest = stored.backend
    while (!matchesWait(latest, action)) {
      if (Date.now() >= deadline) throw new ComputerUseError('COMPUTER_TIMEOUT', 'wait condition was not met before the configured deadline')
      await delay(Math.min(this.config.settleMs || 100, Math.max(1, deadline - Date.now())), undefined, { signal })
      latest = await this.backend.observe(stored.backend.app, {
        screenshot: 'none',
        maxNodes: this.config.maxNodes,
        maxDepth: this.config.maxDepth,
        maxTextBytes: this.config.maxTextBytes,
      }, signal)
    }
    const observation = await this.capture(
      stored.backend.app,
      { app: { bundleId: stored.backend.app.bundleId, pid: stored.backend.app.pid }, screenshot: stored.public.screenshot === undefined ? 'none' : 'optional' },
      context,
      'computer_action',
      latest,
    )
    return {
      action: 'wait',
      channel: 'wait',
      activation: 'not-requested',
      pointerInput: false,
      pointerRouting: 'none',
      observation,
    }
  }

  private clearState(): void {
    this.agents.clear()
    this.confirmations.clear()
  }
}

export default ComputerUseService
