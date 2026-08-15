import { createHash } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import type { ContentBlock, UserMessage } from '@deepseek-ai/dsh-llm'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import { defineTool, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { Workspace } from '@deepseek-ai/dsh-workspace'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {
  ClaimKind,
  ContinuityScope,
  MemoryClaim,
  RecallDecision,
  Sensitivity,
} from '@telos/personal-core'
import { CONTINUITY_RPC_CHANNEL, type CorrectCommand, type RememberCommand } from './contracts.js'
import { ContinuityGateway } from './gateway.js'

export { CONTINUITY_RPC_CHANNEL } from './contracts.js'
export type * from './contracts.js'
export { ContinuityGateway } from './gateway.js'

export const name = 'telos-continuity'
export const inject = ['agents', 'connection', 'tools', 'workspaceRegistry']

export interface Config {
  databasePath: string
  maxRecallClaims?: number
  maxRecallChars?: number
  graphDepth?: number
  captureTurnSources?: boolean
  queueInference?: boolean
}

interface ResolvedConfig {
  databasePath: string
  maxRecallClaims: number
  maxRecallChars: number
  graphDepth: number
  captureTurnSources: boolean
  queueInference: boolean
}

interface DirectHumanExecution {
  agent: Agent
  sourceEvent: Extract<SessionEvent, { type: 'user/message' }>
}

interface TurnTrace {
  turn: number
  startSeq: number
  digest: ReturnType<typeof createHash>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    telosContinuity: ContinuityGateway
  }
}

const TEXT_OUTPUT = {
  schema: { type: 'string' as const },
  render: (_args: unknown, value: string) => [{ type: 'text' as const, text: value }],
}

const CLAIM_KINDS: readonly ClaimKind[] = ['semantic', 'episodic', 'procedural', 'prospective', 'constraint']
const SENSITIVITIES: readonly Sensitivity[] = ['personal', 'sensitive']

function boundedInteger(value: number | undefined, fallback: number, minimum: number, maximum: number, field: string): number {
  const resolved = value ?? fallback
  if (!Number.isSafeInteger(resolved) || resolved < minimum || resolved > maximum) {
    throw new RangeError(`${field} must be an integer between ${String(minimum)} and ${String(maximum)}`)
  }
  return resolved
}

function resolveConfig(config: Config): ResolvedConfig {
  if (typeof config.databasePath !== 'string' || config.databasePath.trim().length === 0) {
    throw new TypeError('telos-continuity databasePath must be a non-empty string')
  }
  return {
    databasePath: config.databasePath,
    maxRecallClaims: boundedInteger(config.maxRecallClaims, 8, 1, 50, 'maxRecallClaims'),
    maxRecallChars: boundedInteger(config.maxRecallChars, 2_400, 128, 20_000, 'maxRecallChars'),
    graphDepth: boundedInteger(config.graphDepth, 2, 0, 4, 'graphDepth'),
    captureTurnSources: config.captureTurnSources ?? true,
    queueInference: config.queueInference ?? true,
  }
}

function eventHash(event: SessionEvent): string {
  return createHash('sha256').update(JSON.stringify(event)).digest('hex')
}

function textOf(blocks: readonly ContentBlock[]): string {
  return blocks.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n').trim()
}

function workspaceFor(ctx: Context, sessionId: string): Workspace | undefined {
  return ctx.workspaceRegistry.list().find(workspace => workspace.sessionIds.some(id => String(id) === sessionId))
}

function contextFor(ctx: Context, agent: Agent): { workspaceId?: string; sessionId: string } {
  const sessionId = String(agent.id)
  const workspaceId = workspaceFor(ctx, sessionId)?.id
  return { sessionId, ...(workspaceId === undefined ? {} : { workspaceId: String(workspaceId) }) }
}

function scopeFor(ctx: Context, agent: Agent, requested: 'global' | 'workspace' | 'session'): ContinuityScope {
  if (requested === 'global') return { type: 'global' }
  if (requested === 'session') return { type: 'session', id: String(agent.id) }
  const workspace = workspaceFor(ctx, String(agent.id))
  if (workspace === undefined) throw new Error('current DSH session is not attached to a workspace')
  return { type: 'workspace', id: String(workspace.id) }
}

function directHumanExecution(ctx: Context, exec: ToolRunContext): DirectHumanExecution {
  const agent = exec.agent
  if (agent === undefined || ctx.agents.get(agent.id) !== agent || agent.status !== 'running'
    || ctx.agents.currentInitiator() !== agent || !ctx.agents.roots().includes(agent)) {
    throw new Error('continuity mutations require the exact live top-level agent')
  }
  const events = agent.session.events
  let turnStart = -1
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event?.type === 'turn/end') break
    if (event?.type === 'turn/start') {
      turnStart = index
      break
    }
  }
  if (turnStart < 0) throw new Error('continuity mutations require an open DSH turn')
  const sourceEvent = events.slice(turnStart + 1).findLast((event): event is Extract<SessionEvent, { type: 'user/message' }> =>
    event.type === 'user/message' && event.data.source.kind === 'user')
  if (sourceEvent === undefined) throw new Error('continuity mutations require direct human input in the current turn')
  return { agent, sourceEvent }
}

function sourceFor(execution: DirectHumanExecution) {
  return {
    sourceKind: 'dsh.user-message',
    runtimeId: 'dsh',
    sourceInstanceId: `${String(execution.agent.id)}:${String(execution.sourceEvent.seq)}`,
    sessionId: String(execution.agent.id),
    seqStart: execution.sourceEvent.seq,
    seqEnd: execution.sourceEvent.seq,
    observedAt: new Date(execution.sourceEvent.time).toISOString(),
    contentHash: eventHash(execution.sourceEvent),
    sensitivity: 'personal' as const,
  }
}

function claimSummary(claim: MemoryClaim): string {
  return JSON.stringify({
    claimId: claim.id,
    status: claim.status,
    kind: claim.kind,
    scope: claim.scope,
    statement: claim.statement,
    sourceEpisodeIds: claim.sourceEpisodeIds,
  })
}

function recallSummary(decision: RecallDecision): string {
  return JSON.stringify({
    recallId: decision.id,
    selected: decision.selectedClaims.map(claim => ({
      claimId: claim.id,
      statement: claim.statement,
      scope: claim.scope,
      status: claim.status,
      sourceEpisodeIds: claim.sourceEpisodeIds,
    })),
    contradictionSets: decision.contradictionSets,
    candidates: decision.candidates,
  })
}

function assertClaimAccessible(ctx: Context, agent: Agent, claim: MemoryClaim): void {
  const current = contextFor(ctx, agent)
  if (claim.scope.type === 'workspace' && claim.scope.id !== current.workspaceId) throw new Error('claim is outside the current workspace')
  if (claim.scope.type === 'session' && claim.scope.id !== current.sessionId) throw new Error('claim is outside the current session')
}

function installTools(ctx: Context, gateway: ContinuityGateway): void {
  ctx.tools.register(defineTool({
    name: 'continuity_remember',
    description: 'Persist one personal fact only when the direct human explicitly asks Telos to remember it or clearly states a durable decision, preference, commitment, or constraint. Never store secrets or inferred private attributes.',
    parameters: {
      statement: { type: 'string', required: true, description: 'Concise natural-language memory statement.' },
      predicate: { type: 'string', required: true, description: 'Stable dotted relation name such as prefers.evidence or project.requires.' },
      value: { type: 'string', required: true, description: 'Literal value of the fact.' },
      kind: { type: 'string', enum: [...CLAIM_KINDS], description: 'Memory form; defaults to semantic.' },
      scope: { type: 'string', enum: ['global', 'workspace', 'session'], description: 'Availability boundary; defaults to workspace.' },
      sensitivity: { type: 'string', enum: [...SENSITIVITIES], description: 'personal or sensitive; secrets are rejected.' },
      importance: { type: 'number', description: '0 to 1; defaults to 0.7.' },
      valid_from: { type: 'string', description: 'Optional ISO-8601 valid-from timestamp.' },
      valid_to: { type: 'string', description: 'Optional ISO-8601 valid-to timestamp.' },
    },
    output: TEXT_OUTPUT,
    async execute(args, exec) {
      const execution = directHumanExecution(ctx, exec)
      const command: RememberCommand = {
        statement: args.statement,
        predicate: args.predicate,
        objectValue: args.value,
        kind: (args.kind ?? 'semantic') as ClaimKind,
        scope: scopeFor(ctx, execution.agent, (args.scope ?? 'workspace') as 'global' | 'workspace' | 'session'),
        sensitivity: (args.sensitivity ?? 'personal') as Sensitivity,
        confidence: 1,
        importance: args.importance ?? 0.7,
        status: 'confirmed',
        source: sourceFor(execution),
        actor: 'user',
        idempotencyKey: `dsh:${String(execution.agent.id)}:${String(exec.callId)}:remember`,
        validFrom: args.valid_from || undefined,
        validTo: args.valid_to || undefined,
      }
      return claimSummary(gateway.remember(command))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'continuity_correct',
    description: 'Supersede one accessible personal memory after the direct human corrects or changes it. Read the claim id with continuity_search first.',
    parameters: {
      claim_id: { type: 'string', required: true },
      statement: { type: 'string', required: true },
      predicate: { type: 'string', required: true },
      value: { type: 'string', required: true },
      kind: { type: 'string', enum: [...CLAIM_KINDS] },
      scope: { type: 'string', enum: ['global', 'workspace', 'session'] },
      sensitivity: { type: 'string', enum: [...SENSITIVITIES] },
      importance: { type: 'number' },
    },
    output: TEXT_OUTPUT,
    async execute(args, exec) {
      const execution = directHumanExecution(ctx, exec)
      const previous = gateway.store.getClaim(args.claim_id)
      if (previous === undefined) throw new Error(`unknown claim ${args.claim_id}`)
      assertClaimAccessible(ctx, execution.agent, previous)
      const command: CorrectCommand = {
        claimId: previous.id,
        statement: args.statement,
        predicate: args.predicate,
        objectValue: args.value,
        kind: (args.kind ?? previous.kind) as ClaimKind,
        scope: args.scope === undefined ? previous.scope : scopeFor(ctx, execution.agent, args.scope as 'global' | 'workspace' | 'session'),
        sensitivity: (args.sensitivity ?? previous.sensitivity) as Sensitivity,
        confidence: 1,
        importance: args.importance ?? previous.importance,
        status: 'confirmed',
        source: sourceFor(execution),
        actor: 'user',
        idempotencyKey: `dsh:${String(execution.agent.id)}:${String(exec.callId)}:correct`,
      }
      return claimSummary(gateway.correct(command))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'continuity_search',
    description: 'Search Telos personal continuity for relevant confirmed facts in the current session/workspace boundary, with claim ids and provenance.',
    parameters: {
      query: { type: 'string', required: true },
      include_candidates: { type: 'boolean', description: 'Include unconfirmed candidate memories; defaults to false.' },
      max_claims: { type: 'integer', description: 'Maximum returned claims, 1 to 20.' },
    },
    output: TEXT_OUTPUT,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      if (exec.agent === undefined) throw new Error('continuity_search requires a calling agent')
      return recallSummary(gateway.recall({
        query: args.query,
        ...contextFor(ctx, exec.agent),
        includeCandidates: args.include_candidates ?? false,
        allowedSensitivities: ['personal'],
        maxClaims: Math.min(args.max_claims ?? 8, 20),
      }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'continuity_explain',
    description: 'Explain a prior Telos recall decision, including selected and ignored claim ids, reasons, sources, scope, and contradictions.',
    parameters: { recall_id: { type: 'string', required: true } },
    output: TEXT_OUTPUT,
    isConcurrencySafe: () => true,
    async execute(args) {
      const decision = gateway.store.explainRecall(args.recall_id)
      return decision === undefined ? JSON.stringify({ recallId: args.recall_id, found: false }) : recallSummary(decision)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'continuity_forget',
    description: 'Revoke one accessible Telos memory only after a direct human asks to forget it. Physical purge is optional and returns any DSH sessions that still contain a recalled copy.',
    parameters: {
      claim_id: { type: 'string', required: true },
      physical: { type: 'boolean', description: 'Physically remove the claim after revocation; defaults to false.' },
      purge_source_content: { type: 'boolean', description: 'Purge unshared locally retained evidence content; defaults to false.' },
    },
    output: TEXT_OUTPUT,
    async execute(args, exec) {
      const execution = directHumanExecution(ctx, exec)
      const claim = gateway.store.getClaim(args.claim_id)
      if (claim === undefined) throw new Error(`unknown claim ${args.claim_id}`)
      assertClaimAccessible(ctx, execution.agent, claim)
      return JSON.stringify(gateway.forget({
        claimId: claim.id,
        physical: args.physical ?? false,
        purgeSourceContent: args.purge_source_content ?? false,
        actor: 'user',
        idempotencyKey: `dsh:${String(execution.agent.id)}:${String(exec.callId)}:forget`,
      }))
    },
  }))
}

function installRecallHook(
  ctx: Context,
  gateway: ContinuityGateway,
  config: ResolvedConfig,
  reportBackgroundError: (error: unknown) => void,
): void {
  ctx.on('agent/pre-step', async ({ agent, messages, signal }, next): Promise<PreStepDecision> => {
    if (signal.aborted) return next()
    const query = messages
      .filter(message => message.source.kind === 'user')
      .map(message => textOf(message.content))
      .filter(Boolean)
      .join('\n')
    if (query.length === 0) return next()

    let decision: RecallDecision
    try {
      decision = gateway.recall({
        query,
        ...contextFor(ctx, agent),
        allowedSensitivities: ['personal'],
        maxClaims: config.maxRecallClaims,
        maxChars: config.maxRecallChars,
        graphDepth: config.graphDepth,
      })
    } catch (error) {
      reportBackgroundError(error)
      ctx.logger.warn(`telos-continuity recall failed: ${String(error)}`)
      return next()
    }
    const downstream = await next()
    if (downstream.kind !== 'enter' || decision.contextPack.text.length === 0) return downstream
    const recallMessage: UserMessage = createUserMessage({
      content: [{ type: 'text', text: decision.contextPack.text }],
      source: { kind: 'plugin', plugin: 'telos-continuity', form: 'recall' },
    })
    return { kind: 'enter', messages: [...downstream.messages, recallMessage] }
  })
}

function installSessionObserver(
  ctx: Context,
  gateway: ContinuityGateway,
  config: ResolvedConfig,
  reportBackgroundError: (error: unknown) => void,
): void {
  const turns = new WeakMap<Session, TurnTrace>()
  const toolCalls = new WeakMap<Session, Map<string, { seq: number; name: string }>>()

  ctx.on('session/event', (session, event) => {
    try {
      if (event.type === 'turn/start') {
        const digest = createHash('sha256')
        digest.update(JSON.stringify(event))
        turns.set(session, { turn: event.data.turn, startSeq: event.seq, digest })
      } else {
        turns.get(session)?.digest.update(JSON.stringify(event))
      }

      if (event.type === 'tool/call') {
        const calls = toolCalls.get(session) ?? new Map()
        calls.set(String(event.data.callId), { seq: event.seq, name: event.data.name })
        toolCalls.set(session, calls)
      }

      if (event.type === 'tool/result') {
        const callId = String(event.data.message.source.callId)
        const call = toolCalls.get(session)?.get(callId)
        if (call !== undefined) {
          const episode = gateway.store.createSourceEpisode({
            sourceKind: 'dsh.tool-execution',
            runtimeId: 'dsh',
            sourceInstanceId: `${String(session.id)}:${callId}`,
            sessionId: String(session.id),
            seqStart: call.seq,
            seqEnd: event.seq,
            observedAt: new Date(event.time).toISOString(),
            contentHash: eventHash(event),
          })
          const isError = event.data.message.content.some(block => block.type === 'tool-result' && block.isError)
          const workspace = workspaceFor(ctx, String(session.id))
          gateway.store.recordActionReceipt({
            action: call.name,
            authorization: 'allowed',
            runtimeId: 'dsh',
            provider: 'dsh-tool',
            result: isError ? 'failed' : 'succeeded',
            scope: workspace === undefined
              ? { type: 'session', id: String(session.id) }
              : { type: 'workspace', id: String(workspace.id) },
            sourceEpisodeIds: [episode.id],
            idempotencyKey: `dsh-action:${String(session.id)}:${callId}:${String(event.seq)}`,
          })
          toolCalls.get(session)?.delete(callId)
        }
      }

      if (event.type === 'user/message' && event.data.source.kind === 'plugin'
        && event.data.source.plugin === 'telos-continuity' && event.data.source.form === 'recall') {
        const text = textOf(event.data.content)
        const recallId = /<telos_continuity recall_id="([^"]+)">/.exec(text)?.[1]
        if (recallId !== undefined) {
          gateway.store.recordMaterialization({
            recallId,
            runtimeId: 'dsh',
            sessionId: String(session.id),
            seqStart: event.seq,
            seqEnd: event.seq,
            renderedContentHash: createHash('sha256').update(text).digest('hex'),
          })
        }
      }

      if (event.type === 'turn/end') {
        const trace = turns.get(session)
        turns.delete(session)
        if (trace !== undefined && trace.turn === event.data.turn && config.captureTurnSources) {
          const episode = gateway.store.createSourceEpisode({
            sourceKind: 'dsh.turn',
            runtimeId: 'dsh',
            sourceInstanceId: `${String(session.id)}:turn:${String(trace.turn)}`,
            sessionId: String(session.id),
            seqStart: trace.startSeq,
            seqEnd: event.seq,
            observedAt: new Date(event.time).toISOString(),
            contentHash: trace.digest.digest('hex'),
          })
          if (config.queueInference) {
            gateway.store.enqueue('infer-turn-candidates', {
              sourceEpisodeId: episode.id,
              sessionId: String(session.id),
              workspaceId: workspaceFor(ctx, String(session.id))?.id,
              turn: trace.turn,
            }, `infer:${String(session.id)}:${String(trace.turn)}`)
          }
        }
      }
    } catch (error) {
      reportBackgroundError(error)
      ctx.logger.warn(`telos-continuity observer contained failure: ${String(error)}`)
    }
  })
}

export function apply(ctx: Context, input: Config): void {
  const config = resolveConfig(input)
  let lastBackgroundError: string | undefined
  const reportBackgroundError = (error: unknown): void => {
    lastBackgroundError = error instanceof Error ? error.message : String(error)
  }
  const gateway = new ContinuityGateway({
    databasePath: config.databasePath,
    onBackgroundError: () => lastBackgroundError,
  })
  ctx.provide('telosContinuity', gateway)
  ctx.effect(() => () => gateway.close(), 'telos-continuity: close personal core')

  ctx.connection.rpc.handle(
    CONTINUITY_RPC_CHANNEL,
    async (endpoint, payload) => gateway.handle(endpoint, payload),
    { authority: 'loopback' },
  )
  installTools(ctx, gateway)
  installRecallHook(ctx, gateway, config, reportBackgroundError)
  installSessionObserver(ctx, gateway, config, reportBackgroundError)

  ctx.inject(['systemPrompt'], (promptCtx) => {
    promptCtx.systemPrompt.section({
      name: 'tool:telos-continuity',
      order: 112,
      text: 'Telos personal continuity is distinct from DSH session history. Use continuity_remember only for direct-human durable intent, '
        + 'continuity_correct instead of overwriting history, continuity_forget for explicit revocation, and continuity_search or '
        + 'continuity_explain for evidence. Never store credentials, secrets, inferred sensitive attributes, or an entire conversation.',
    })
  })

}
