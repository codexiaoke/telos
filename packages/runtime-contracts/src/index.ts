export type RuntimeId = 'dsh'

export interface RuntimeRoute {
  provider: string
  model: string
}

export type RuntimeCapability =
  | 'text-input'
  | 'streaming-output'
  | 'durable-session-log'
  | 'subagents'

export interface RuntimeDescriptor {
  id: RuntimeId
  displayName: string
  capabilities: readonly RuntimeCapability[]
  limitations: readonly string[]
  defaultRoute: RuntimeRoute
}

export interface RuntimeRunRequest {
  runId: string
  conversationId: string
  input: string
  workspacePath?: string
  route?: RuntimeRoute
}

export interface RuntimePromptRequest {
  runId: string
  conversationId: string
  input: string
  route?: RuntimeRoute
}

export type RuntimeAvailability = 'ready' | 'needs-build' | 'missing-credential' | 'unavailable'

export interface RuntimeStatus {
  descriptor: RuntimeDescriptor
  availability: RuntimeAvailability
  detail: string
}

export interface DshEventReference {
  runtime: 'dsh'
  eventType: string
  sequence?: number
}

interface RuntimeEventBase {
  runId: string
  sessionId: string
  runtime: RuntimeId
  sequence: number
  occurredAt: number
  source?: DshEventReference
}

export type RuntimeEvent =
  | (RuntimeEventBase & {
      type: 'run.started'
      data: { route: RuntimeRoute }
    })
  | (RuntimeEventBase & {
      type: 'session.status'
      data: { status: 'idle' | 'running' }
    })
  | (RuntimeEventBase & {
      type: 'turn.started' | 'turn.finished'
      data: { turn: number }
    })
  | (RuntimeEventBase & {
      type: 'output.phase'
      data: { phase: 'thinking' | 'answering' }
    })
  | (RuntimeEventBase & {
      type: 'output.delta'
      data: { text: string }
    })
  | (RuntimeEventBase & {
      type: 'output.committed'
      data: { text: string }
    })
  | (RuntimeEventBase & {
      type: 'tool.started'
      data: { callId: string; toolName: string }
    })
  | (RuntimeEventBase & {
      type: 'tool.finished'
      data: { callId: string; isError: boolean }
    })
  | (RuntimeEventBase & {
      type: 'subagent.started'
      data: { childSessionId: string }
    })
  | (RuntimeEventBase & {
      type: 'subagent.finished'
      data: { childSessionId: string; status: 'ok' | 'error' }
    })
  | (RuntimeEventBase & {
      type: 'run.completed'
      data: { finalResponse: string }
    })
  | (RuntimeEventBase & {
      type: 'run.failed'
      data: { message: string }
    })

export interface RuntimeRunResult {
  runId: string
  sessionId: string
  runtime: RuntimeId
  route: RuntimeRoute
  finalResponse: string
  eventCount: number
}

export type RuntimeEventObserver = (event: RuntimeEvent) => void

export interface AgentRuntime {
  readonly descriptor: RuntimeDescriptor
  run(request: RuntimeRunRequest, onEvent?: RuntimeEventObserver): Promise<RuntimeRunResult>
}
