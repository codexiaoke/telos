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
  validateGraphExtractionEnvelope,
} from '@telos/personal-core'
import type {
  ContinuityScope,
  GraphExtractionEntityProposal,
  GraphExtractionEventProposal,
} from '@telos/personal-core'

const MAX_EVENTS = 6
const MAX_ENTITIES = 12
const MAX_ALIASES = 6
const MAX_EVIDENCE_LENGTH = 500
const RESPONSE_KEYS = new Set(['schemaVersion', 'decision', 'reason', 'entities', 'events'])
const ENTITY_KEYS = new Set(['ref', 'kind', 'canonicalName', 'aliases', 'evidence'])
const EVENT_KEYS = new Set([
  'kind',
  'statement',
  'predicate',
  'subjectEntityRef',
  'objectEntityRef',
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
  captureIntent?: 'automatic' | 'explicit'
  messages: readonly MemoryFormationMessage[]
  assistantMessages?: readonly MemoryFormationMessage[]
  referenceTime: string
  timeZone: string
  locale: string
  scope: Exclude<ContinuityScope, { type: 'global' }>
  route: MemoryFormationRoute
  policy: MemoryFormationPolicy
  signal?: AbortSignal
}

export interface FormedMemoryEntity extends GraphExtractionEntityProposal {
  /** Exact direct-human substring retained as provenance after validation. */
  evidence: string
}

export interface FormedMemoryEvent extends GraphExtractionEventProposal {
  /** Exact direct-human substring retained as provenance after validation. */
  evidence: string
}

export interface MemoryFormationResult {
  route: MemoryFormationRoute
  decision: 'remember' | 'ignore'
  reason: string
  entities: readonly FormedMemoryEntity[]
  events: readonly FormedMemoryEvent[]
}

/**
 * The model makes the semantic durability decision. Deterministic code only
 * constrains provenance, scope, secrets, size and the versioned wire shape.
 */
export const MEMORY_FORMATION_SYSTEM_PROMPT = [
  'You are the memory-formation stage for a local-first personal AI.',
  'Convert direct human messages into evidence-grounded personal entities and time-aware memory events that will be useful beyond the current turn.',
  'Direct human messages are the only authoritative evidence. Assistant messages are non-authoritative context: they may help resolve wording or a typo, but can never introduce a fact or be copied as evidence.',
  'Do not extract ordinary one-turn instructions, response-format requests, tool-use controls, test/debug prompts, questions, brainstorming, quoted text, or facts stated only by the assistant.',
  'Ignore temporary control clauses instead of discarding an otherwise useful memory event.',
  'An explicit captureIntent means the human directly asked Telos to remember the situation. Treat that as strong durability evidence, while still rejecting secrets, test/debug prompts and content that has no useful memory event.',
  'Eligible memories include stable preferences, goals, decisions, commitments, procedures and constraints, plus concrete time-bounded events that matter across turns, such as a family visit, appointment, deadline, trip or promised follow-up.',
  'A concrete event may qualify even when stated only once. For example, "爸爸明天来我家" is a prospective event about a person entity, not a disposable chat detail.',
  'Resolve relative time such as today or tomorrow from referenceTime in the supplied timeZone. Use ISO-8601 offsets; for an all-day event use the local day start and end.',
  'Use owner for the user. Create another entity only when its canonicalName is explicitly present in a direct human message, or when a normalized canonicalName has at least one explicitly observed alias. Aliases must be copied from direct human text; do not invent synonyms.',
  'Represent relationships as edges: subjectEntityRef + predicate + exactly one of objectEntityRef or objectValue. Prefer an entity edge when both endpoints are known.',
  'Never extract credentials, secrets, inferred sensitive attributes, or unsupported conclusions.',
  'Every entity and event must contain one evidence field copied verbatim from exactly one supplied direct human message.',
  'Use concise normalized statements and stable lowercase dotted predicates.',
  'Write statements and literal values in the direct human message language. Do not translate Chinese memory into English.',
  'Prefer a compact connected event graph. Create each explicitly named person, organization, project, goal, commitment, topic or artifact that participates in a durable event, but do not split one situation into redundant paraphrases.',
  'Return exactly one JSON object and no Markdown or commentary.',
  'The required shape is:',
  '{"schemaVersion":2,"decision":"remember|ignore","reason":"short reason","entities":[{"ref":"local_ref","kind":"person|workspace|project|topic|goal|commitment|decision|constraint|preference|artifact","canonicalName":"exactly observed name","aliases":[],"evidence":"exact human substring"}],"events":[{"kind":"semantic|episodic|procedural|prospective|constraint","statement":"...","predicate":"lowercase.dotted_name","subjectEntityRef":"owner|local_ref","objectEntityRef":"owner|local_ref|null","objectValue":"literal|null","confidence":0.0,"importance":0.0,"sensitivity":"personal","evidence":"exact human substring","durability":"cross-session","validFrom":null,"validTo":null}]}',
  `Return at most ${String(MAX_ENTITIES)} entities and ${String(MAX_EVENTS)} events. When nothing qualifies, decision must be ignore and both arrays must be empty.`,
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

function optionalText(value: unknown, field: string, maximum: number): string | undefined {
  return value === undefined || value === null ? undefined : text(value, field, maximum)
}

function unit(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${field} must be between 0 and 1`)
  }
  return value
}

function unwrapJson(textValue: string): string {
  const trimmed = textValue.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(trimmed)
  return fenced?.[1]?.trim() ?? trimmed
}

function frameMessages(input: MemoryFormationInput): string {
  return [
    'Evaluate this turn for evidence-grounded personal entities and memory events.',
    'The host will enforce the supplied local scope; do not invent another scope.',
    JSON.stringify({
      scope: input.scope,
      captureIntent: input.captureIntent ?? 'automatic',
      referenceTime: input.referenceTime,
      timeZone: input.timeZone,
      locale: input.locale,
      directHumanMessages: input.messages,
      assistantContext: input.assistantMessages ?? [],
    }),
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
): Pick<MemoryFormationResult, 'decision' | 'reason' | 'entities' | 'events'> {
  let decoded: unknown
  try {
    decoded = JSON.parse(unwrapJson(output))
  } catch (error) {
    throw new TypeError('memory formation model returned invalid JSON', { cause: error })
  }
  const envelope = record(decoded, 'memory formation response')
  assertKnownKeys(envelope, RESPONSE_KEYS, 'memory formation response')
  if (envelope.schemaVersion !== 2) throw new TypeError('memory formation response schemaVersion must be 2')
  if (envelope.decision !== 'remember' && envelope.decision !== 'ignore') {
    throw new TypeError('memory formation response decision must be remember or ignore')
  }
  const reason = text(envelope.reason, 'memory formation response reason', 500)
  if (!Array.isArray(envelope.entities)) throw new TypeError('memory formation response entities must be an array')
  if (!Array.isArray(envelope.events)) throw new TypeError('memory formation response events must be an array')
  if (envelope.entities.length > MAX_ENTITIES) throw new RangeError(`memory formation response exceeds ${String(MAX_ENTITIES)} entities`)
  if (envelope.events.length > MAX_EVENTS) throw new RangeError(`memory formation response exceeds ${String(MAX_EVENTS)} events`)
  if (envelope.decision === 'ignore' && (envelope.entities.length > 0 || envelope.events.length > 0)) {
    throw new TypeError('ignored memory formation response must have empty entities and events')
  }
  if (envelope.decision === 'remember' && envelope.events.length === 0) {
    throw new TypeError('remembered memory formation response must contain at least one event')
  }

  const normalizedMessages = input.messages.map(message => message.text.normalize('NFKC'))
  const exactHumanExcerpt = (value: unknown, field: string): string => {
    const excerpt = text(value, field, MAX_EVIDENCE_LENGTH)
    if (!normalizedMessages.some(message => message.includes(excerpt))) {
      throw new TypeError(`${field} is not an exact human-message substring`)
    }
    if (containsCredentialLikeContent(excerpt)) throw new TypeError(`${field} contains credential-like content`)
    return excerpt
  }
  const entityEvidence: string[] = []
  const rawEntities = envelope.entities.map((value, index) => {
    const entity = record(value, `entities[${String(index)}]`)
    assertKnownKeys(entity, ENTITY_KEYS, `entities[${String(index)}]`)
    const canonicalName = text(entity.canonicalName, `entities[${String(index)}].canonicalName`, 120)
    const excerpt = exactHumanExcerpt(entity.evidence, `entities[${String(index)}].evidence`)
    if (!Array.isArray(entity.aliases) || entity.aliases.length > MAX_ALIASES) {
      throw new TypeError(`entities[${String(index)}].aliases must contain at most ${String(MAX_ALIASES)} items`)
    }
    const aliases = entity.aliases.map((alias, aliasIndex) => {
      const result = text(alias, `entities[${String(index)}].aliases[${String(aliasIndex)}]`, 120)
      if (!normalizedMessages.some(message => message.includes(result))) {
        throw new TypeError(`entities[${String(index)}].aliases[${String(aliasIndex)}] is not an exact human-message substring`)
      }
      return result
    })
    const observedNames = [canonicalName, ...aliases]
      .filter(name => normalizedMessages.some(message => message.includes(name)))
    if (observedNames.length === 0) {
      throw new TypeError(`entities[${String(index)}] has no canonicalName or alias in a human message`)
    }
    entityEvidence.push(observedNames.some(name => excerpt.includes(name)) ? excerpt : observedNames[0]!)
    return {
      ref: entity.ref,
      kind: entity.kind,
      canonicalName,
      aliases,
    }
  })
  const eventEvidence: string[] = []
  const rawEvents = envelope.events.map((value, index) => {
    const event = record(value, `events[${String(index)}]`)
    assertKnownKeys(event, EVENT_KEYS, `events[${String(index)}]`)
    if (event.durability !== 'cross-session') {
      throw new TypeError(`events[${String(index)}].durability must be cross-session`)
    }
    const excerpt = exactHumanExcerpt(event.evidence, `events[${String(index)}].evidence`)
    eventEvidence.push(excerpt)
    return {
      kind: event.kind,
      statement: event.statement,
      predicate: event.predicate,
      subjectEntityRef: event.subjectEntityRef,
      objectEntityRef: optionalText(event.objectEntityRef, `events[${String(index)}].objectEntityRef`, 64),
      objectValue: optionalText(event.objectValue, `events[${String(index)}].objectValue`, 240),
      confidence: unit(event.confidence, `events[${String(index)}].confidence`),
      importance: unit(event.importance, `events[${String(index)}].importance`),
      sensitivity: event.sensitivity,
      validFrom: optionalIso(event.validFrom, `events[${String(index)}].validFrom`),
      validTo: optionalIso(event.validTo, `events[${String(index)}].validTo`),
    }
  })
  const validated = validateGraphExtractionEnvelope({
    schemaVersion: 2,
    sourceEpisodeId: 'model-formation-validation',
    scope: input.scope,
    entities: rawEntities,
    events: rawEvents,
  })
  return {
    decision: envelope.decision,
    reason,
    entities: validated.entities.map((entity, index) => ({ ...entity, evidence: entityEvidence[index]! })),
    events: validated.events.map((event, index) => ({ ...event, evidence: eventEvidence[index]! })),
  }
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
    ...parseMemoryFormationOutput(output, input),
  }
}
