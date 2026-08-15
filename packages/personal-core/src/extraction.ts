import type {
  ClaimKind,
  ContinuityScope,
  EntityKind,
  ExtractionEnvelopeV1,
  ExtractionProposal,
  GraphExtractionEnvelopeV2,
  GraphExtractionEntityProposal,
  GraphExtractionEventProposal,
} from './types.js'

const CLAIM_KINDS: readonly ClaimKind[] = ['semantic', 'episodic', 'procedural', 'prospective', 'constraint']
const MAX_PROPOSALS = 6
const MAX_ENTITIES = 12
const MAX_ALIASES = 6
const MAX_TEXT_LENGTH = 240
const PREDICATE_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/
const ENTITY_REF_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/
const SECRET_PATTERN = /(?:api[ _-]?key|password|passwd|secret|access[ _-]?token|refresh[ _-]?token|private[ _-]?key|密码|口令|密钥|令牌|sk-[a-z0-9_-]{8,})/iu
const ENTITY_KINDS: readonly EntityKind[] = [
  'person', 'workspace', 'project', 'topic', 'goal', 'commitment', 'decision',
  'constraint', 'preference', 'artifact',
]

type UnknownRecord = Record<string, unknown>

/** Shared fail-closed credential boundary for formation, RPC and storage inputs. */
export function containsCredentialLikeContent(value: string): boolean {
  return SECRET_PATTERN.test(value)
}

function record(value: unknown, field: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`)
  return value as UnknownRecord
}

function text(value: unknown, field: string, maximum = MAX_TEXT_LENGTH): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(`${field} must be a non-empty string`)
  const normalized = value.trim().normalize('NFKC')
  if (normalized.length > maximum) throw new RangeError(`${field} exceeds ${String(maximum)} characters`)
  return normalized
}

function unit(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${field} must be between 0 and 1`)
  }
  return value
}

function optionalIso(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined
  const result = text(value, field, 64)
  if (!Number.isFinite(Date.parse(result))) throw new TypeError(`${field} must be an ISO-8601 timestamp`)
  return result
}

function entityRef(value: unknown, field: string): string {
  const result = text(value, field, 64).toLocaleLowerCase()
  if (!ENTITY_REF_PATTERN.test(result)) throw new TypeError(`${field} is invalid`)
  return result
}

function boundedScope(value: unknown, field: string): Exclude<ContinuityScope, { type: 'global' }> {
  const input = record(value, field)
  if (input.type !== 'workspace' && input.type !== 'session') throw new TypeError(`${field}.type must be workspace or session`)
  return { type: input.type, id: text(input.id, `${field}.id`, 160) }
}

function proposal(value: unknown, index: number): ExtractionProposal {
  const input = record(value, `proposals[${String(index)}]`)
  if (typeof input.kind !== 'string' || !CLAIM_KINDS.includes(input.kind as ClaimKind)) {
    throw new TypeError(`proposals[${String(index)}].kind is invalid`)
  }
  const statement = text(input.statement, `proposals[${String(index)}].statement`)
  const objectValue = text(input.objectValue, `proposals[${String(index)}].objectValue`)
  if (containsCredentialLikeContent(`${statement}\n${objectValue}`)) {
    throw new TypeError(`proposals[${String(index)}] contains credential-like content`)
  }
  const predicate = text(input.predicate, `proposals[${String(index)}].predicate`, 80).toLocaleLowerCase()
  if (!PREDICATE_PATTERN.test(predicate)) throw new TypeError(`proposals[${String(index)}].predicate is invalid`)
  const validFrom = optionalIso(input.validFrom, `proposals[${String(index)}].validFrom`)
  const validTo = optionalIso(input.validTo, `proposals[${String(index)}].validTo`)
  if (validFrom !== undefined && validTo !== undefined && validTo < validFrom) {
    throw new RangeError(`proposals[${String(index)}].validTo precedes validFrom`)
  }
  if (input.sensitivity !== 'personal') {
    throw new TypeError(`proposals[${String(index)}].sensitivity must be personal`)
  }
  return {
    kind: input.kind as ClaimKind,
    statement,
    predicate,
    objectValue,
    confidence: unit(input.confidence, `proposals[${String(index)}].confidence`),
    importance: unit(input.importance, `proposals[${String(index)}].importance`),
    sensitivity: 'personal',
    scope: boundedScope(input.scope, `proposals[${String(index)}].scope`),
    ...(validFrom === undefined ? {} : { validFrom }),
    ...(validTo === undefined ? {} : { validTo }),
  }
}

/** Validates the versioned, bounded output of any local or model-backed extractor. */
export function validateExtractionEnvelope(value: unknown): ExtractionEnvelopeV1 {
  const input = record(value, 'extraction envelope')
  if (input.schemaVersion !== 1) throw new TypeError('extraction envelope schemaVersion must be 1')
  const sourceEpisodeId = text(input.sourceEpisodeId, 'sourceEpisodeId', 160)
  if (!Array.isArray(input.proposals)) throw new TypeError('proposals must be an array')
  if (input.proposals.length > MAX_PROPOSALS) throw new RangeError(`proposals exceeds ${String(MAX_PROPOSALS)} items`)
  return {
    schemaVersion: 1,
    sourceEpisodeId,
    proposals: input.proposals.map((entry, index) => proposal(entry, index)),
  }
}

function graphEntity(value: unknown, index: number): GraphExtractionEntityProposal {
  const input = record(value, `entities[${String(index)}]`)
  const ref = entityRef(input.ref, `entities[${String(index)}].ref`)
  if (ref === 'owner') throw new TypeError(`entities[${String(index)}].ref owner is reserved`)
  if (typeof input.kind !== 'string' || !ENTITY_KINDS.includes(input.kind as EntityKind)) {
    throw new TypeError(`entities[${String(index)}].kind is invalid`)
  }
  const canonicalName = text(input.canonicalName, `entities[${String(index)}].canonicalName`, 120)
  if (!Array.isArray(input.aliases) || input.aliases.length > MAX_ALIASES) {
    throw new TypeError(`entities[${String(index)}].aliases must contain at most ${String(MAX_ALIASES)} items`)
  }
  const aliases = [...new Set(input.aliases.map((alias, aliasIndex) =>
    text(alias, `entities[${String(index)}].aliases[${String(aliasIndex)}]`, 120)))]
    .filter(alias => alias !== canonicalName)
  if (containsCredentialLikeContent([canonicalName, ...aliases].join('\n'))) {
    throw new TypeError(`entities[${String(index)}] contains credential-like content`)
  }
  return { ref, kind: input.kind as EntityKind, canonicalName, aliases }
}

function graphEvent(value: unknown, index: number, refs: ReadonlySet<string>): GraphExtractionEventProposal {
  const input = record(value, `events[${String(index)}]`)
  if (typeof input.kind !== 'string' || !CLAIM_KINDS.includes(input.kind as ClaimKind)) {
    throw new TypeError(`events[${String(index)}].kind is invalid`)
  }
  const subjectEntityRef = entityRef(input.subjectEntityRef, `events[${String(index)}].subjectEntityRef`)
  if (subjectEntityRef !== 'owner' && !refs.has(subjectEntityRef)) {
    throw new TypeError(`events[${String(index)}].subjectEntityRef is unknown`)
  }
  const objectEntityRef = input.objectEntityRef === undefined
    ? undefined
    : entityRef(input.objectEntityRef, `events[${String(index)}].objectEntityRef`)
  if (objectEntityRef !== undefined && objectEntityRef !== 'owner' && !refs.has(objectEntityRef)) {
    throw new TypeError(`events[${String(index)}].objectEntityRef is unknown`)
  }
  const objectValue = input.objectValue === undefined
    ? undefined
    : text(input.objectValue, `events[${String(index)}].objectValue`)
  if ((objectEntityRef === undefined && objectValue === undefined)
    || (objectEntityRef !== undefined && objectValue !== undefined)) {
    throw new TypeError(`events[${String(index)}] requires exactly one objectEntityRef or objectValue`)
  }
  const statement = text(input.statement, `events[${String(index)}].statement`)
  if (containsCredentialLikeContent(`${statement}\n${objectValue ?? ''}`)) {
    throw new TypeError(`events[${String(index)}] contains credential-like content`)
  }
  const predicate = text(input.predicate, `events[${String(index)}].predicate`, 80).toLocaleLowerCase()
  if (!PREDICATE_PATTERN.test(predicate)) throw new TypeError(`events[${String(index)}].predicate is invalid`)
  const validFrom = optionalIso(input.validFrom, `events[${String(index)}].validFrom`)
  const validTo = optionalIso(input.validTo, `events[${String(index)}].validTo`)
  if (validFrom !== undefined && validTo !== undefined && validTo < validFrom) {
    throw new RangeError(`events[${String(index)}].validTo precedes validFrom`)
  }
  if (input.sensitivity !== 'personal') {
    throw new TypeError(`events[${String(index)}].sensitivity must be personal`)
  }
  return {
    kind: input.kind as ClaimKind,
    statement,
    predicate,
    subjectEntityRef,
    ...(objectEntityRef === undefined ? {} : { objectEntityRef }),
    ...(objectValue === undefined ? {} : { objectValue }),
    confidence: unit(input.confidence, `events[${String(index)}].confidence`),
    importance: unit(input.importance, `events[${String(index)}].importance`),
    sensitivity: 'personal',
    ...(validFrom === undefined ? {} : { validFrom }),
    ...(validTo === undefined ? {} : { validTo }),
  }
}

/** Validates one entity-event graph batch before any identity or claim is written. */
export function validateGraphExtractionEnvelope(value: unknown): GraphExtractionEnvelopeV2 {
  const input = record(value, 'graph extraction envelope')
  if (input.schemaVersion !== 2) throw new TypeError('graph extraction envelope schemaVersion must be 2')
  const sourceEpisodeId = text(input.sourceEpisodeId, 'sourceEpisodeId', 160)
  const scope = boundedScope(input.scope, 'scope')
  if (!Array.isArray(input.entities) || input.entities.length > MAX_ENTITIES) {
    throw new RangeError(`entities must contain at most ${String(MAX_ENTITIES)} items`)
  }
  const entities = input.entities.map((entry, index) => graphEntity(entry, index))
  const refs = new Set<string>()
  for (const entity of entities) {
    if (refs.has(entity.ref)) throw new TypeError(`duplicate entity ref ${entity.ref}`)
    refs.add(entity.ref)
  }
  if (!Array.isArray(input.events) || input.events.length > MAX_PROPOSALS) {
    throw new RangeError(`events must contain at most ${String(MAX_PROPOSALS)} items`)
  }
  const events = input.events.map((entry, index) => graphEvent(entry, index, refs))
  const usedRefs = new Set(events.flatMap(event => [event.subjectEntityRef, event.objectEntityRef]
    .filter((ref): ref is string => ref !== undefined && ref !== 'owner')))
  for (const entity of entities) {
    if (!usedRefs.has(entity.ref)) throw new TypeError(`entity ref ${entity.ref} is not used by an event`)
  }
  return { schemaVersion: 2, sourceEpisodeId, scope, entities, events }
}
