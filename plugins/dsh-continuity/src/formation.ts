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
const ENTITY_REF_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/u
const ENTITY_KINDS = new Set([
  'person', 'place', 'organization', 'workspace', 'project', 'topic', 'goal', 'commitment', 'decision',
  'constraint', 'preference', 'artifact',
])
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
  '{"schemaVersion":2,"decision":"remember|ignore","reason":"short reason","entities":[{"ref":"local_ref","kind":"person|place|organization|workspace|project|topic|goal|commitment|decision|constraint|preference|artifact","canonicalName":"exactly observed name","aliases":[],"evidence":"exact human substring"}],"events":[{"kind":"semantic|episodic|procedural|prospective|constraint","statement":"...","predicate":"lowercase.dotted_name","subjectEntityRef":"owner|local_ref","objectEntityRef":"owner|local_ref|null","objectValue":"literal|null","confidence":0.0,"importance":0.0,"sensitivity":"personal","evidence":"exact human substring","durability":"cross-session","validFrom":null,"validTo":null}]}',
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

function comparableEvidence(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{Z}\s]/gu, '')
}

interface CalendarDate {
  year: number
  month: number
  day: number
}

export interface RelativeTimeBounds {
  validFrom: string
  validTo: string
}

function zonedParts(instant: Date, timeZone: string): CalendarDate & { hour: number; minute: number; second: number } {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-CA-u-hc-h23', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]))
  return {
    year: values.year!,
    month: values.month!,
    day: values.day!,
    hour: values.hour!,
    minute: values.minute!,
    second: values.second!,
  }
}

function calendarFromEpoch(value: number): CalendarDate {
  const date = new Date(value)
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
}

function shiftCalendar(date: CalendarDate, days: number): CalendarDate {
  return calendarFromEpoch(Date.UTC(date.year, date.month - 1, date.day + days))
}

function localInstant(date: CalendarDate, timeZone: string, hour = 0): number {
  const desiredWallTime = Date.UTC(date.year, date.month - 1, date.day, hour)
  let candidate = desiredWallTime
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const observed = zonedParts(new Date(candidate), timeZone)
    const observedWallTime = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    )
    candidate += desiredWallTime - observedWallTime
  }
  return candidate
}

function bounds(start: CalendarDate, endExclusive: CalendarDate, timeZone: string, startHour = 0): RelativeTimeBounds {
  return {
    validFrom: new Date(localInstant(start, timeZone, startHour)).toISOString(),
    validTo: new Date(localInstant(endExclusive, timeZone) - 1).toISOString(),
  }
}

/** Resolve common relative-time phrases after the model has selected an event. */
export function inferRelativeTimeBounds(
  value: string,
  referenceTime: string,
  timeZone: string,
): RelativeTimeBounds | undefined {
  const normalized = value.normalize('NFKC').toLocaleLowerCase()
  const reference = new Date(referenceTime)
  if (!Number.isFinite(reference.getTime())) throw new TypeError('referenceTime must be ISO-8601')
  const local = zonedParts(reference, timeZone)
  const today = { year: local.year, month: local.month, day: local.day }
  if (/今晚|tonight/u.test(normalized)) return bounds(today, shiftCalendar(today, 1), timeZone, 18)
  if (/下周|next\s+week/u.test(normalized)) {
    const weekday = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay()
    const start = shiftCalendar(today, weekday === 0 ? 1 : 8 - weekday)
    return bounds(start, shiftCalendar(start, 7), timeZone)
  }
  if (/下个月|next\s+month/u.test(normalized)) {
    const start = calendarFromEpoch(Date.UTC(today.year, today.month, 1))
    const end = calendarFromEpoch(Date.UTC(today.year, today.month + 1, 1))
    return bounds(start, end, timeZone)
  }
  if (/明天|tomorrow/u.test(normalized)) {
    const start = shiftCalendar(today, 1)
    return bounds(start, shiftCalendar(start, 1), timeZone)
  }
  if (/昨天|yesterday/u.test(normalized)) {
    const start = shiftCalendar(today, -1)
    return bounds(start, today, timeZone)
  }
  if (/今天|今日|today/u.test(normalized)) return bounds(today, shiftCalendar(today, 1), timeZone)
  return undefined
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
  input: Pick<MemoryFormationInput, 'messages' | 'scope'>
    & Partial<Pick<MemoryFormationInput, 'referenceTime' | 'timeZone'>>,
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
    const exact = normalizedMessages.find(message => message.includes(excerpt))
    if (exact !== undefined) {
      if (containsCredentialLikeContent(excerpt)) throw new TypeError(`${field} contains credential-like content`)
      return excerpt
    }
    const comparable = comparableEvidence(excerpt)
    const punctuationOnlyMatch = comparable.length >= 4
      ? normalizedMessages.find(message => message.length <= MAX_EVIDENCE_LENGTH
        && comparableEvidence(message).includes(comparable))
      : undefined
    if (punctuationOnlyMatch === undefined) {
      throw new TypeError(`${field} is not grounded in a human message`)
    }
    if (containsCredentialLikeContent(punctuationOnlyMatch)) throw new TypeError(`${field} contains credential-like content`)
    return punctuationOnlyMatch
  }
  const entityEvidence: string[] = []
  const rawEntities: GraphExtractionEntityProposal[] = []
  const retainedRefs = new Set<string>()
  for (const [index, value] of envelope.entities.entries()) {
    const entity = record(value, `entities[${String(index)}]`)
    assertKnownKeys(entity, ENTITY_KEYS, `entities[${String(index)}]`)
    const canonicalName = text(entity.canonicalName, `entities[${String(index)}].canonicalName`, 120)
    if (!Array.isArray(entity.aliases) || entity.aliases.length > MAX_ALIASES) {
      throw new TypeError(`entities[${String(index)}].aliases must contain at most ${String(MAX_ALIASES)} items`)
    }
    const aliases = entity.aliases.flatMap((alias, aliasIndex) => {
      const result = text(alias, `entities[${String(index)}].aliases[${String(aliasIndex)}]`, 120)
      return normalizedMessages.some(message => message.includes(result)) ? [result] : []
    })
    const observedNames = [canonicalName, ...aliases]
      .filter(name => normalizedMessages.some(message => message.includes(name)))
    if (observedNames.length === 0) continue
    const proposedEvidence = text(entity.evidence, `entities[${String(index)}].evidence`, MAX_EVIDENCE_LENGTH)
    let excerpt: string
    try {
      excerpt = exactHumanExcerpt(proposedEvidence, `entities[${String(index)}].evidence`)
    } catch {
      excerpt = observedNames[0]!
    }
    if (typeof entity.ref !== 'string' || typeof entity.kind !== 'string') continue
    const ref = entity.ref.trim().toLocaleLowerCase()
    if (!ENTITY_REF_PATTERN.test(ref) || ref === 'owner' || !ENTITY_KINDS.has(entity.kind)) continue
    const proposal: GraphExtractionEntityProposal = {
      ref,
      kind: entity.kind as GraphExtractionEntityProposal['kind'],
      canonicalName,
      aliases,
    }
    if (retainedRefs.has(proposal.ref)) continue
    retainedRefs.add(proposal.ref)
    rawEntities.push(proposal)
    entityEvidence.push(observedNames.some(name => excerpt.includes(name)) ? excerpt : observedNames[0]!)
  }
  const eventEvidence: string[] = []
  const rawEvents: GraphExtractionEventProposal[] = []
  const availableRefs = new Set(['owner', ...rawEntities.map(entity => entity.ref)])
  for (const [index, value] of envelope.events.entries()) {
    const event = record(value, `events[${String(index)}]`)
    assertKnownKeys(event, EVENT_KEYS, `events[${String(index)}]`)
    if (event.durability !== 'cross-session') {
      throw new TypeError(`events[${String(index)}].durability must be cross-session`)
    }
    const excerpt = exactHumanExcerpt(event.evidence, `events[${String(index)}].evidence`)
    const statement = text(event.statement, `events[${String(index)}].statement`, 500)
    const subjectEntityRef = text(event.subjectEntityRef, `events[${String(index)}].subjectEntityRef`, 64)
    if (!availableRefs.has(subjectEntityRef)) continue
    const proposedObjectEntityRef = optionalText(event.objectEntityRef, `events[${String(index)}].objectEntityRef`, 64)
    const objectEntityRef = proposedObjectEntityRef !== undefined && availableRefs.has(proposedObjectEntityRef)
      ? proposedObjectEntityRef
      : undefined
    const objectValue = optionalText(event.objectValue, `events[${String(index)}].objectValue`, 240)
    const inferredBounds = input.referenceTime === undefined || input.timeZone === undefined
      ? undefined
      : inferRelativeTimeBounds(`${excerpt}\n${statement}`, input.referenceTime, input.timeZone)
    const proposal = {
      kind: event.kind,
      statement,
      predicate: event.predicate,
      subjectEntityRef,
      objectEntityRef,
      objectValue: objectEntityRef === undefined ? (objectValue ?? statement) : undefined,
      confidence: unit(event.confidence, `events[${String(index)}].confidence`),
      importance: unit(event.importance, `events[${String(index)}].importance`),
      sensitivity: event.sensitivity,
      validFrom: optionalIso(event.validFrom, `events[${String(index)}].validFrom`) ?? inferredBounds?.validFrom,
      validTo: optionalIso(event.validTo, `events[${String(index)}].validTo`) ?? inferredBounds?.validTo,
    }
    try {
      const eventRefs = new Set([subjectEntityRef, objectEntityRef].filter((ref): ref is string => ref !== undefined && ref !== 'owner'))
      const validatedEvent = validateGraphExtractionEnvelope({
        schemaVersion: 2,
        sourceEpisodeId: 'model-formation-event-validation',
        scope: input.scope,
        entities: rawEntities.filter(entity => eventRefs.has(entity.ref)),
        events: [proposal],
      }).events[0]
      if (validatedEvent === undefined) continue
      rawEvents.push(validatedEvent)
      eventEvidence.push(excerpt)
    } catch {
      // Drop only the malformed relation; never promote its unsupported structure.
    }
  }
  const usedEntityRefs = new Set(rawEvents.flatMap(event => [event.subjectEntityRef, event.objectEntityRef]
    .filter((ref): ref is string => ref !== undefined && ref !== 'owner')))
  const retainedEntityIndexes = rawEntities.map((entity, index) => ({ entity, index }))
    .filter(({ entity }) => usedEntityRefs.has(entity.ref))
  const graphEntities = retainedEntityIndexes.map(({ entity }) => entity)
  const graphEntityEvidence = retainedEntityIndexes.map(({ index }) => entityEvidence[index]!)
  const validated = validateGraphExtractionEnvelope({
    schemaVersion: 2,
    sourceEpisodeId: 'model-formation-validation',
    scope: input.scope,
    entities: graphEntities,
    events: rawEvents,
  })
  return {
    decision: rawEvents.length === 0 ? 'ignore' : envelope.decision,
    reason,
    entities: rawEvents.length === 0
      ? []
      : validated.entities.map((entity, index) => ({ ...entity, evidence: graphEntityEvidence[index]! })),
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
