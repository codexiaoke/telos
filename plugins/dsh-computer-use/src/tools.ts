/** Focused model-facing Computer Use Tool definitions. */

import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { defineTool, type ToolDefinition, type ToolRunContext, type ValueSchemaSpec } from '@deepseek-ai/dsh-tools'
import {
  ComputerConfirmationToken,
  ComputerObservationId,
  ComputerTargetHandle,
  type ComputerActionRequest,
  type ComputerUseContext,
} from './types.js'
import type { ComputerUseService } from './service.js'

function renderJson(_args: unknown, value: unknown): ContentBlock[] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

function contextOf(exec: ToolRunContext): ComputerUseContext {
  const agent = exec.agent
  if (agent === undefined) throw new Error(`${exec.name}: an Agent Session is required`)
  return {
    agent,
    workspace: agent.session.header.cwd ?? process.cwd(),
    callId: exec.callId,
    signal: exec.signal,
  }
}

const rectSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    x: { type: 'number', required: true },
    y: { type: 'number', required: true },
    width: { type: 'number', required: true },
    height: { type: 'number', required: true },
  },
} as const satisfies ValueSchemaSpec

const appSelectorSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    bundleId: { type: 'string', description: 'Preferred exact macOS bundle identifier.' },
    pid: { type: 'integer', description: 'Exact current process id when already observed.' },
    name: { type: 'string', description: 'Display name accepted only when it resolves uniquely.' },
  },
} as const satisfies ValueSchemaSpec

const appSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    bundleId: { type: 'string', required: true },
    pid: { type: 'integer', required: true },
    name: { type: 'string', required: true },
  },
} as const satisfies ValueSchemaSpec

const elementSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    index: { type: 'integer', required: true },
    targetHandle: { type: 'string', required: true },
    role: { type: 'string', required: true },
    subrole: { type: 'string' },
    title: { type: 'string' },
    label: { type: 'string' },
    value: { type: 'string' },
    enabled: { type: 'boolean' },
    focused: { type: 'boolean' },
    selected: { type: 'boolean' },
    frame: rectSchema,
    actions: { type: 'array', items: { type: 'string' }, required: true },
  },
} as const satisfies ValueSchemaSpec

const artifactSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    path: { type: 'string', required: true },
    filename: { type: 'string', required: true },
    mimeType: { type: 'string', enum: ['image/png'], required: true },
    kind: { type: 'string', enum: ['image'], required: true },
    description: { type: 'string', required: true },
    sourceTool: { type: 'string', enum: ['computer_observe', 'computer_action'], required: true },
    previewIntent: { type: 'string', enum: ['image'], required: true },
    bytes: { type: 'integer', required: true },
    width: { type: 'integer', required: true },
    height: { type: 'integer', required: true },
  },
} as const satisfies ValueSchemaSpec

const observationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    observationId: { type: 'string', required: true },
    app: { ...appSchema, required: true },
    createdAt: { type: 'string', required: true },
    expiresAt: { type: 'string', required: true },
    frontmost: { type: 'boolean', required: true },
    window: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        frame: { ...rectSchema, required: true },
        id: { type: 'integer' },
      },
    },
    tree: {
      type: 'object',
      additionalProperties: false,
      required: true,
      properties: {
        mode: { type: 'string', enum: ['full', 'diff'], required: true },
        text: { type: 'string', required: true },
        truncated: { type: 'boolean', required: true },
      },
    },
    elements: { type: 'array', items: elementSchema, required: true },
    screenshot: artifactSchema,
    permissions: {
      type: 'object',
      additionalProperties: false,
      required: true,
      properties: {
        accessibility: { type: 'string', enum: ['granted', 'denied', 'not-determined', 'unavailable'], required: true },
        screenRecording: { type: 'string', enum: ['granted', 'denied', 'not-determined', 'unavailable'], required: true },
      },
    },
  },
} as const satisfies ValueSchemaSpec

const actionResultSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    action: { type: 'string', enum: ['click', 'set-value', 'type-text', 'press-key', 'scroll', 'drag', 'perform-action', 'wait'], required: true },
    channel: { type: 'string', enum: ['accessibility', 'coordinates', 'keyboard', 'wait'], required: true },
    activation: { type: 'string', enum: ['not-requested', 'already-frontmost', 'activated'], required: true },
    pointerInput: { type: 'boolean', required: true },
    pointerRouting: { type: 'string', enum: ['none', 'target-process'], required: true },
    resolution: {
      type: 'object',
      additionalProperties: false,
      properties: {
        mode: { type: 'string', enum: ['exact-locator', 'native-identifier', 'semantic-rebind'], required: true },
        confidence: { type: 'number', required: true },
        candidateCount: { type: 'integer', required: true },
        targetChanged: { type: 'boolean', required: true },
      },
    },
    observation: { ...observationSchema, required: true },
  },
} as const satisfies ValueSchemaSpec

const sensitiveParameters = {
  sensitive: { type: 'boolean', description: 'Set true for an action classified by the Skill as high impact or sensitive.' },
  confirmationToken: { type: 'string', description: 'One-use token from computer_confirm for this exact action.' },
} as const

const keyNames = [
  'a', 's', 'd', 'f', 'h', 'g', 'z', 'x', 'c', 'v', 'b', 'q', 'w', 'e', 'r', 'y', 't',
  '1', '2', '3', '4', '6', '5', '=', '9', '7', '-', '8', '0', ']', 'o', 'u', '[', 'i', 'p',
  'return', 'l', 'j', "'", 'k', ';', '\\', ',', '/', 'n', 'm', '.', 'tab', 'space', 'delete',
  'escape', 'home', 'pageup', 'forwarddelete', 'end', 'pagedown', 'left', 'right', 'down', 'up',
] as const

function actionBase(args: { observationId: string; sensitive?: boolean; confirmationToken?: string }) {
  return {
    observationId: ComputerObservationId(args.observationId),
    ...(args.sensitive === undefined ? {} : { sensitive: args.sensitive }),
    ...(args.confirmationToken === undefined ? {} : { confirmationToken: ComputerConfirmationToken(args.confirmationToken) }),
  }
}

function elementTarget(args: { elementIndex?: number; targetHandle?: string; allowRebind?: boolean }) {
  return {
    ...(args.elementIndex === undefined ? {} : { elementIndex: args.elementIndex }),
    ...(args.targetHandle === undefined ? {} : { targetHandle: ComputerTargetHandle(args.targetHandle) }),
    ...(args.allowRebind === undefined ? {} : { allowRebind: args.allowRebind }),
  }
}

function actionOutput() {
  return {
    schema: actionResultSchema,
    render: renderJson,
  }
}

/** Create the focused execution definitions bound to one active Service generation. */
export function createComputerUseTools(service: ComputerUseService): ToolDefinition[] {
  const listApps = defineTool({
    name: 'computer_list_apps',
    description: 'List bounded running user-facing macOS applications. Use this only when the task does not already identify a unique bundle id.',
    parameters: {},
    output: {
      schema: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ...appSchema.properties,
            frontmost: { type: 'boolean', required: true },
            accessibility: { type: 'string', enum: ['granted', 'denied', 'not-determined', 'unavailable'], required: true },
            screenRecording: { type: 'string', enum: ['granted', 'denied', 'not-determined', 'unavailable'], required: true },
          },
        },
      },
      render: renderJson,
    },
    execute: (_args, exec) => service.listApps(contextOf(exec)),
    presentCall: () => ({ card: 'generic', title: 'List macOS apps', kind: 'read' }),
  })

  const openApp = defineTool({
    name: 'computer_open_app',
    description: 'Launch an installed macOS app or activate its existing process in one deterministic call. For requests to open, launch, show, switch to, or bring an app forward, call this directly first; do not use computer_list_apps, computer_observe, AXRaise, screenshots, vision, or coordinate clicks merely to activate an app. Foreground activation occurs only when host focusPolicy is activate.',
    parameters: {
      app: { ...appSelectorSchema, required: true },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          app: { ...appSchema, required: true },
          launched: { type: 'boolean', required: true },
          activation: { type: 'string', enum: ['not-requested', 'already-frontmost', 'activated'], required: true },
        },
      },
      render: renderJson,
    },
    execute: (args, exec) => service.openApp({ app: args.app }, contextOf(exec)),
    presentCall: () => ({ card: 'generic', title: 'Open macOS app', kind: 'execute' }),
  })

  const observe = defineTool({
    name: 'computer_observe',
    description: 'Read a fresh Accessibility observation for one exact running app. Element indexes belong only to the returned observationId. Prefer the tree; request a screenshot only for pixel-only facts. This tool does not launch or activate apps: use computer_open_app first when the user asks to open or switch to an app.',
    parameters: {
      app: { ...appSelectorSchema, required: true },
      screenshot: { type: 'string', enum: ['none', 'optional', 'required'], description: 'Default none for low latency. Required fails when Screen Recording is unavailable.' },
      full: { type: 'boolean', description: 'Return a full tree instead of a diff from the previous observation.' },
    },
    output: { schema: observationSchema, render: renderJson },
    execute: (args, exec) => service.observe(args, contextOf(exec)),
    presentCall: () => ({ card: 'generic', title: 'Observe macOS app', kind: 'read' }),
  })

  const click = defineTool({
    name: 'computer_click',
    description: 'Click an observed element, preferring AXPress, or use a window-relative or screen-global coordinate when host pointer policy allows it. Use computer_open_app instead of clicks to activate an app. For safe recovery after harmless tree reordering, pass targetHandle and allowRebind=true. After one stale-state failure, obtain one fresh observation and do not repeat the same guessed coordinate.',
    parameters: {
      observationId: { type: 'string', required: true },
      elementIndex: { type: 'integer' },
      targetHandle: { type: 'string' },
      allowRebind: { type: 'boolean', description: 'Allow fail-closed native-identifier or unique semantic rebinding. Requires targetHandle.' },
      x: { type: 'number' },
      y: { type: 'number' },
      coordinateSpace: { type: 'string', enum: ['window', 'screen'], description: 'Default window interprets x/y inside the observed window frame; screen uses screen-global coordinates.' },
      button: { type: 'string', enum: ['left', 'right', 'middle'] },
      clickCount: { type: 'integer' },
      allowCoordinateFallback: { type: 'boolean' },
      ...sensitiveParameters,
    },
    output: actionOutput(),
    execute: (args, exec) => service.act({
      kind: 'click',
      ...actionBase(args),
      ...elementTarget(args),
      ...(args.x === undefined ? {} : { x: args.x }),
      ...(args.y === undefined ? {} : { y: args.y }),
      ...(args.coordinateSpace === undefined ? {} : { coordinateSpace: args.coordinateSpace }),
      ...(args.button === undefined ? {} : { button: args.button }),
      ...(args.clickCount === undefined ? {} : { clickCount: args.clickCount }),
      ...(args.allowCoordinateFallback === undefined ? {} : { allowCoordinateFallback: args.allowCoordinateFallback }),
    }, contextOf(exec)),
    presentCall: () => ({ card: 'generic', title: 'Click macOS app', kind: 'execute' }),
  })

  const setValue = defineTool({
    name: 'computer_set_value',
    description: 'Set one observed editable Accessibility value without using the clipboard. Supply elementIndex or targetHandle; targetHandle plus allowRebind=true permits deterministic fail-closed recovery after harmless tree reordering.',
    parameters: {
      observationId: { type: 'string', required: true },
      elementIndex: { type: 'integer' },
      targetHandle: { type: 'string' },
      allowRebind: { type: 'boolean' },
      value: { type: 'string', required: true },
      ...sensitiveParameters,
    },
    output: actionOutput(),
    execute: (args, exec) => service.act({ kind: 'set-value', ...actionBase(args), ...elementTarget(args), value: args.value }, contextOf(exec)),
    presentCall: () => ({ card: 'generic', title: 'Set app value', kind: 'execute' }),
  })

  const typeText = defineTool({
    name: 'computer_type_text',
    description: 'Type Unicode into the currently focused control without reading or replacing the clipboard. Focus a control using fresh state first; keyboard fallback may require host-authorized foreground activation. The result does not echo the supplied text.',
    parameters: {
      observationId: { type: 'string', required: true },
      text: { type: 'string', required: true },
      ...sensitiveParameters,
    },
    output: actionOutput(),
    execute: (args, exec) => service.act({ kind: 'type-text', ...actionBase(args), text: args.text }, contextOf(exec)),
    presentCall: () => ({ card: 'generic', title: 'Type in macOS app', kind: 'execute' }),
  })

  const pressKey = defineTool({
    name: 'computer_press_key',
    description: 'Press one validated key or chord by routing it to the selected app process. The default host policy preserves the current foreground app; read the returned fresh observation.',
    parameters: {
      observationId: { type: 'string', required: true },
      key: { type: 'string', enum: keyNames, required: true },
      modifiers: { type: 'array', items: { type: 'string', enum: ['command', 'control', 'option', 'shift'] } },
      ...sensitiveParameters,
    },
    output: actionOutput(),
    execute: (args, exec) => service.act({ kind: 'press-key', ...actionBase(args), key: args.key, ...(args.modifiers === undefined ? {} : { modifiers: args.modifiers }) }, contextOf(exec)),
    presentCall: () => ({ card: 'generic', title: 'Press app key', kind: 'execute' }),
  })

  const scroll = defineTool({
    name: 'computer_scroll',
    description: 'Scroll by routing a wheel event only to the selected app process at an observed element or window-relative/screen-global coordinate. The system cursor is not moved.',
    parameters: {
      observationId: { type: 'string', required: true },
      elementIndex: { type: 'integer' },
      targetHandle: { type: 'string' },
      allowRebind: { type: 'boolean' },
      x: { type: 'number' },
      y: { type: 'number' },
      coordinateSpace: { type: 'string', enum: ['window', 'screen'] },
      direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], required: true },
      pages: { type: 'integer' },
      ...sensitiveParameters,
    },
    output: actionOutput(),
    execute: (args, exec) => service.act({
      kind: 'scroll',
      ...actionBase(args),
      ...elementTarget(args),
      direction: args.direction,
      ...(args.x === undefined ? {} : { x: args.x }),
      ...(args.y === undefined ? {} : { y: args.y }),
      ...(args.coordinateSpace === undefined ? {} : { coordinateSpace: args.coordinateSpace }),
      ...(args.pages === undefined ? {} : { pages: args.pages }),
    }, contextOf(exec)),
    presentCall: () => ({ card: 'generic', title: 'Scroll macOS app', kind: 'execute' }),
  })

  const drag = defineTool({
    name: 'computer_drag',
    description: 'Drag by routing mouse events only to the selected app process between two points in the observed-window or screen-global coordinate space. The system cursor is not moved.',
    parameters: {
      observationId: { type: 'string', required: true },
      fromX: { type: 'number', required: true },
      fromY: { type: 'number', required: true },
      toX: { type: 'number', required: true },
      toY: { type: 'number', required: true },
      coordinateSpace: { type: 'string', enum: ['window', 'screen'] },
      ...sensitiveParameters,
    },
    output: actionOutput(),
    execute: (args, exec) => service.act({
      kind: 'drag',
      ...actionBase(args),
      fromX: args.fromX,
      fromY: args.fromY,
      toX: args.toX,
      toY: args.toY,
      ...(args.coordinateSpace === undefined ? {} : { coordinateSpace: args.coordinateSpace }),
    }, contextOf(exec)),
    presentCall: () => ({ card: 'generic', title: 'Drag in macOS app', kind: 'execute' }),
  })

  const perform = defineTool({
    name: 'computer_perform_action',
    description: 'Perform one Accessibility action advertised by an observed element. Supply elementIndex or targetHandle; targetHandle plus allowRebind=true permits deterministic fail-closed recovery after harmless tree reordering.',
    parameters: {
      observationId: { type: 'string', required: true },
      elementIndex: { type: 'integer' },
      targetHandle: { type: 'string' },
      allowRebind: { type: 'boolean' },
      action: { type: 'string', required: true },
      ...sensitiveParameters,
    },
    output: actionOutput(),
    execute: (args, exec) => service.act({ kind: 'perform-action', ...actionBase(args), ...elementTarget(args), action: args.action }, contextOf(exec)),
    presentCall: () => ({ card: 'generic', title: 'Perform app action', kind: 'execute' }),
  })

  const wait = defineTool({
    name: 'computer_wait',
    description: 'Wait for one bounded Accessibility condition and return fresh state without mutating the app.',
    parameters: {
      observationId: { type: 'string', required: true },
      condition: {
        type: 'object',
        additionalProperties: false,
        required: true,
        properties: {
          text: { type: 'string' },
          elementRole: { type: 'string' },
          elementTitle: { type: 'string' },
        },
      },
      timeoutMs: { type: 'integer' },
    },
    output: actionOutput(),
    execute: (args, exec) => service.act({ kind: 'wait', observationId: ComputerObservationId(args.observationId), condition: args.condition, ...(args.timeoutMs === undefined ? {} : { timeoutMs: args.timeoutMs }) }, contextOf(exec)),
    presentCall: () => ({ card: 'generic', title: 'Wait for app state', kind: 'read' }),
  })

  const confirm = defineTool({
    name: 'computer_confirm',
    description: 'Request just-in-time approval for one exact sensitive action. Call immediately before the action, then repeat the same action with sensitive=true and the returned token.',
    parameters: {
      action: { type: 'json', required: true },
      reason: { type: 'string', required: true },
      target: { type: 'string', required: true },
      dataSummary: { type: 'string' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          token: { type: 'string', required: true },
          observationId: { type: 'string', required: true },
          app: { ...appSchema, required: true },
          expiresAt: { type: 'string', required: true },
        },
      },
      render: renderJson,
    },
    execute: (args, exec) => service.confirm({
      action: { ...(args.action as Record<string, unknown>), observationId: ComputerObservationId(String((args.action as Record<string, unknown>).observationId)), sensitive: true } as ComputerActionRequest,
      reason: args.reason,
      target: args.target,
      ...(args.dataSummary === undefined ? {} : { dataSummary: args.dataSummary }),
    }, contextOf(exec)),
    presentCall: () => ({ card: 'generic', title: 'Confirm sensitive app action', kind: 'execute' }),
  })

  return [listApps, openApp, observe, click, setValue, typeText, pressKey, scroll, drag, perform, wait, confirm]
}
