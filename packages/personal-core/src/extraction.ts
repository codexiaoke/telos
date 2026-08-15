import type {
  ClaimKind,
  ContinuityScope,
  ExtractionEnvelopeV1,
  ExtractionProposal,
} from './types.js'

const CLAIM_KINDS: readonly ClaimKind[] = ['semantic', 'episodic', 'procedural', 'prospective', 'constraint']
const MAX_PROPOSALS = 6
const MAX_TEXT_LENGTH = 240
const PREDICATE_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/
const SECRET_PATTERN = /(?:api[ _-]?key|password|passwd|secret|access[ _-]?token|refresh[ _-]?token|private[ _-]?key|密码|口令|密钥|令牌|sk-[a-z0-9_-]{8,})/iu

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
