import type { Context } from '@deepseek-ai/cordis'
import {
  BlockAssembler,
  createUserMessage,
  deepFreeze,
  ReasoningEffortId,
} from '@deepseek-ai/dsh-llm'
import type { FinishReason, GenerateOptions } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import {
  containsCredentialLikeContent,
  validateExtractionEnvelope,
} from '@telos/personal-core'
import type {
  ContinuityScope,
  ExtractionProposal,
} from '@telos/personal-core'

const MAX_PROPOSALS = 6
const MAX_EVIDENCE_LENGTH = 500
const RESPONSE_KEYS = new Set(['schemaVersion', 'proposals'])
const PROPOSAL_KEYS = new Set([
  'kind',
  'statement',
  'predicate',
  'objectValue',
  'confidence',
  'importance',
  'sensitivity',
  'evidence',
  'durability',
  'validFrom',
  'validTo',
])

type UnknownRecord = Record<string, unknown>

export interface MemoryFormationMessage {
  seq: number
  text: string
}

export interface MemoryFormationRoute {
  provider: string
  model: string
  reasoningEffort?: string
}

export interface MemoryFormationPolicy {
  maxInputBytes: number
  maxOutputTokens: number
  timeoutMs: number
}

export interface MemoryFormationInput {
  sessionId: string
  messages: readonly MemoryFormationMessage[]
  scope: Exclude<ContinuityScope, { type: 'global' }>
  route: MemoryFormationRoute
  policy: MemoryFormationPolicy
  signal?: AbortSignal
}

export interface FormedMemoryProposal extends ExtractionProposal {
  /** Exact direct-human substring retained as provenance after validation. */
  evidence: string
}

export interface MemoryFormationResult {
  route: MemoryFormationRoute
  proposals: readonly FormedMemoryProposal[]
}

/**
 * The model makes the semantic durability decision. Deterministic code only
 * constrains provenance, scope, secrets, size and the versioned wire shape.
 */
export const MEMORY_FORMATION_SYSTEM_PROMPT = [
  'You are the memory-formation stage for a local-first personal AI.',
  'Decide whether the direct human messages contain durable personal information that will remain useful in a future conversation.',
  'Do not extract ordinary one-turn instructions, response-format requests, tool-use controls, test/debug prompts, questions, brainstorming, quoted text, or facts stated only by the assistant.',
  'Ignore temporary clauses instead of discarding an otherwise durable message. If a message combines a stable cross-session fact or constraint with a one-turn control such as "do not call tools", extract only the durable part.',
  'A message whose entire meaning is temporary, such as "Do not call tools; reply only with X" or "summarize this file", MUST produce an empty proposals array.',
  'Eligible memories include stable preferences, durable goals, decisions, commitments, procedures, and constraints whose meaning extends beyond the current turn.',
  'Never extract credentials, secrets, inferred sensitive attributes, or unsupported conclusions.',
  'Every proposal must contain an evidence field copied verbatim from exactly one supplied human message.',
  'Use concise normalized statements and stable lowercase dotted predicates.',
  'Return exactly one JSON object and no Markdown or commentary.',
  'The required shape is:',
  '{"schemaVersion":1,"proposals":[{"kind":"semantic|episodic|procedural|prospective|constraint","statement":"...","predicate":"lowercase.dotted_name","objectValue":"...","confidence":0.0,"importance":0.0,"sensitivity":"personal","evidence":"exact human substring","durability":"cross-session","validFrom":null,"validTo":null}]}',
  `Return at most ${String(MAX_PROPOSALS)} proposals. When nothing qualifies, return {"schemaVersion":1,"proposals" : []}.`,
].join('\n')

function record(value: unknown, field: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`)
  }
  return value as UnknownRecord
}

function text(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string`)
  }
  const normalized = value.trim().normalize('NFKC')
  if (normalized.length > maximum) throw new RangeError(`${field} exceeds ${String(maximum)} characters`)
  return normalized
}

function assertKnownKeys(value: UnknownRecord, allowed: ReadonlySet<string>, field: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${field} contains unknown field ${key}`)
  }
}

function optionalIso(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined
  const result = text(value, field, 64)
  if (!Number.isFinite(Date.parse(result))) throw new TypeError(`${field} must be an ISO-8601 timestamp or null`)
  return result
}

function unwrapJson(textValue: string): string {
  const trimmed = textValue.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(trimmed)
  return fenced?.[1]?.trim() ?? trimmed
}

function frameMessages(input: MemoryFormationInput): string {
  return [
    'Evaluate this JSON array of direct human messages for durable personal memory.',
    'The host will enforce the supplied local scope; do not invent another scope.',
    JSON.stringify({ scope: input.scope, messages: input.messages }),
  ].join('\n')
}

function finishError(finish: FinishReason): Error | undefined {
  switch (finish.kind) {
    case 'stop': return undefined
    case 'error':
    case 'aborted': {
      const error = new Error(finish.failure.message) as Error & { code?: string }
      error.code = finish.failure.code
      return error
    }
    case 'max-tokens': return new Error('memory formation output reached maxOutputTokens')
    case 'tool-calls': return new Error('memory formation model unexpectedly requested a tool')
    default: return new Error(`unsupported memory formation finish reason ${String((finish as { kind?: unknown }).kind)}`)
  }
}

/** Parse and evidence-ground one model response before it reaches Personal Core. */
export function parseMemoryFormationOutput(
  output: string,
  input: Pick<MemoryFormationInput, 'messages' | 'scope'>,
): FormedMemoryProposal[] {
  let decoded: unknown
  try {
    decoded = JSON.parse(unwrapJson(output))
  } catch (error) {
    throw new TypeError('memory formation model returned invalid JSON', { cause: error })
  }
  const envelope = record(decoded, 'memory formation response')
  assertKnownKeys(envelope, RESPONSE_KEYS, 'memory formation response')
  if (envelope.schemaVersion !== 1) throw new TypeError('memory formation response schemaVersion must be 1')
  if (!Array.isArray(envelope.proposals)) throw new TypeError('memory formation response proposals must be an array')
  if (envelope.proposals.length > MAX_PROPOSALS) {
    throw new RangeError(`memory formation response exceeds ${String(MAX_PROPOSALS)} proposals`)
  }

  const normalizedMessages = input.messages.map(message => message.text.normalize('NFKC'))
  const evidence: string[] = []
  const proposals = envelope.proposals.map((value, index) => {
    const proposal = record(value, `proposals[${String(index)}]`)
    assertKnownKeys(proposal, PROPOSAL_KEYS, `proposals[${String(index)}]`)
    if (proposal.durability !== 'cross-session') {
      throw new TypeError(`proposals[${String(index)}].durability must be cross-session`)
    }
    const excerpt = text(proposal.evidence, `proposals[${String(index)}].evidence`, MAX_EVIDENCE_LENGTH)
    if (!normalizedMessages.some(message => message.includes(excerpt))) {
      throw new TypeError(`proposals[${String(index)}].evidence is not an exact human-message substring`)
    }
    if (containsCredentialLikeContent(excerpt)) {
      throw new TypeError(`proposals[${String(index)}].evidence contains credential-like content`)
    }
    evidence.push(excerpt)
    return {
      kind: proposal.kind,
      statement: proposal.statement,
      predicate: proposal.predicate,
      objectValue: proposal.objectValue,
      confidence: proposal.confidence,
      importance: proposal.importance,
      sensitivity: proposal.sensitivity,
      scope: input.scope,
      validFrom: optionalIso(proposal.validFrom, `proposals[${String(index)}].validFrom`),
      validTo: optionalIso(proposal.validTo, `proposals[${String(index)}].validTo`),
    }
  })
  const validated = validateExtractionEnvelope({
    schemaVersion: 1,
    sourceEpisodeId: 'model-formation-validation',
    proposals,
  })
  return validated.proposals.map((proposal, index) => ({
    ...proposal,
    // The one-to-one map above and bounded validator preserve index identity.
    evidence: evidence[index]!,
  }))
}

/** Run one tool-free auxiliary call through the exact main-model route. */
export async function formMemoriesWithMainModel(
  ctx: Context,
  input: MemoryFormationInput,
): Promise<MemoryFormationResult> {
  if (input.messages.length === 0) throw new TypeError('memory formation requires at least one human message')
  if (input.route.provider.trim().length === 0 || input.route.model.trim().length === 0) {
    throw new TypeError('memory formation requires a non-empty main-model route')
  }
  const directText = input.messages.map(message => message.text).join('\n')
  if (containsCredentialLikeContent(directText)) {
    throw new TypeError('credential-like human input cannot be sent to memory formation')
  }
  const framedInput = frameMessages(input)
  const inputBytes = Buffer.byteLength(framedInput, 'utf8')
  if (inputBytes > input.policy.maxInputBytes) {
    throw new RangeError(`memory formation input is ${String(inputBytes)} bytes, exceeding maxInputBytes ${String(input.policy.maxInputBytes)}`)
  }
  const timeoutSignal = AbortSignal.timeout(input.policy.timeoutMs)
  const signal = input.signal === undefined
    ? timeoutSignal
    : AbortSignal.any([input.signal, timeoutSignal])
  signal.throwIfAborted()
  const modelInfo = await ctx.llm.resolveModelInfo(
    input.route.provider,
    input.route.model,
    signal,
  )
  const supportsReasoningOff = modelInfo.reasoning?.efforts
    .some(effort => String(effort.id) === 'off') === true
  const formationRoute: MemoryFormationRoute = {
    ...input.route,
    ...(supportsReasoningOff ? { reasoningEffort: 'off' } : {}),
  }
  const messages = [createUserMessage({
    content: [{ type: 'text', text: framedInput }],
    source: { kind: 'plugin', plugin: 'telos-continuity' },
  })]
  const options: GenerateOptions = deepFreeze({
    provider: formationRoute.provider,
    model: formationRoute.model,
    ...(formationRoute.reasoningEffort === undefined
      ? {}
      : { reasoningEffort: ReasoningEffortId(formationRoute.reasoningEffort) }),
    messages,
    system: MEMORY_FORMATION_SYSTEM_PROMPT,
    maxTokens: input.policy.maxOutputTokens,
    sessionId: SessionId(input.sessionId),
    signal,
  })
  signal.throwIfAborted()
  const assembler = new BlockAssembler()
  for await (const chunk of ctx.llm.stream(options)) {
    signal.throwIfAborted()
    assembler.push(chunk)
  }
  signal.throwIfAborted()
  const terminalError = finishError(assembler.finish)
  if (terminalError !== undefined) throw terminalError
  const blocks = assembler.blocks()
  if (blocks.some(block => block.type === 'tool-call')) {
    throw new Error('memory formation output must contain text only')
  }
  const output = blocks
    .filter((block): block is Extract<(typeof blocks)[number], { type: 'text' }> => block.type === 'text')
    .map(block => block.text)
    .join('')
  if (output.trim().length === 0) throw new Error('memory formation model produced no JSON output')
  return {
    route: formationRoute,
    proposals: parseMemoryFormationOutput(output, input),
  }
}
