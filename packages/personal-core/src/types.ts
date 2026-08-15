export type ScopeType = 'global' | 'workspace' | 'session'

export type ContinuityScope =
  | { type: 'global' }
  | { type: 'workspace'; id: string }
  | { type: 'session'; id: string }

export type Sensitivity = 'personal' | 'sensitive' | 'secret'
export type SourceDeletionState = 'active' | 'detached' | 'purged'
export type EntityStatus = 'active' | 'merged' | 'split' | 'deleted'
export type ClaimStatus = 'candidate' | 'confirmed' | 'superseded' | 'contradicted' | 'revoked' | 'expired'
export type ClaimKind = 'semantic' | 'episodic' | 'procedural' | 'prospective' | 'constraint'
export type ActorKind = 'user' | 'agent' | 'system' | 'runtime'

export type EntityKind =
  | 'person'
  | 'workspace'
  | 'project'
  | 'topic'
  | 'goal'
  | 'commitment'
  | 'decision'
  | 'constraint'
  | 'preference'
  | 'artifact'

export type EntityEventType =
  | 'claim.observed'
  | 'claim.confirmed'
  | 'claim.corrected'
  | 'claim.superseded'
  | 'claim.contradicted'
  | 'claim.revoked'
  | 'claim.expired'
  | 'entity.created'
  | 'entity.aliased'
  | 'entity.merged'
  | 'entity.split'
  | 'scope.changed'
  | 'source.detached'
  | 'action.received'

export interface SourceEpisode {
  id: string
  sourceKind: string
  runtimeId?: string
  sourceInstanceId: string
  sessionId?: string
  seqStart?: number
  seqEnd?: number
  observedAt: string
  recordedAt: string
  content?: string
  contentHash: string
  sensitivity: Sensitivity
  deletionState: SourceDeletionState
}

export interface Entity {
  id: string
  kind: EntityKind
  canonicalName: string
  scope: ContinuityScope
  status: EntityStatus
  createdAt: string
  updatedAt: string
  revision: number
}

export interface EntityAlias {
  id: string
  entityId: string
  alias: string
  normalizedAlias: string
  scope: ContinuityScope
  sourceEpisodeId?: string
  createdAt: string
}

export interface EntityEvent {
  id: string
  eventType: EntityEventType
  aggregateId: string
  payload: Readonly<Record<string, unknown>>
  scope: ContinuityScope
  sourceEpisodeIds: readonly string[]
  actor: ActorKind
  occurredAt: string
  recordedAt: string
  idempotencyKey: string
}

export interface MemoryClaim {
  id: string
  kind: ClaimKind
  statement: string
  predicate: string
  subjectEntityId: string
  objectEntityId?: string
  objectValue?: string
  status: ClaimStatus
  confidence: number
  importance: number
  sensitivity: Sensitivity
  scope: ContinuityScope
  validFrom?: string
  validTo?: string
  observedAt: string
  recordedAt: string
  supersedesClaimId?: string
  supersededByClaimId?: string
  sourceEpisodeIds: readonly string[]
  contentHash: string
  revision: number
}

export interface RelationProjection {
  claimId: string
  fromEntityId: string
  predicate: string
  toEntityId?: string
  objectValue?: string
  validFrom?: string
  validTo?: string
  status: ClaimStatus
}

export interface CreateSourceEpisodeInput {
  id?: string
  sourceKind: string
  runtimeId?: string
  sourceInstanceId: string
  sessionId?: string
  seqStart?: number
  seqEnd?: number
  observedAt?: string
  content?: string
  contentHash?: string
  sensitivity?: Sensitivity
}

export interface CreateEntityInput {
  id?: string
  kind: EntityKind
  canonicalName: string
  scope: ContinuityScope
  sourceEpisodeIds?: readonly string[]
  actor?: ActorKind
  occurredAt?: string
  idempotencyKey: string
}

export interface AddAliasInput {
  id?: string
  entityId: string
  alias: string
  scope: ContinuityScope
  sourceEpisodeId?: string
  actor?: ActorKind
  occurredAt?: string
  idempotencyKey: string
}

export interface RememberClaimInput {
  id?: string
  kind: ClaimKind
  statement: string
  predicate: string
  subjectEntityId: string
  objectEntityId?: string
  objectValue?: string
  status?: Extract<ClaimStatus, 'candidate' | 'confirmed'>
  confidence: number
  importance: number
  sensitivity?: Sensitivity
  scope: ContinuityScope
  validFrom?: string
  validTo?: string
  observedAt?: string
  sourceEpisodeIds: readonly string[]
  actor?: ActorKind
  idempotencyKey: string
}

export interface CorrectClaimInput extends Omit<RememberClaimInput, 'status'> {
  claimId: string
  status?: 'confirmed' | 'candidate'
}

export interface ConfirmClaimInput {
  claimId: string
  sourceEpisodeIds: readonly string[]
  actor?: ActorKind
  occurredAt?: string
  idempotencyKey: string
}

export interface ExtractionProposal {
  kind: ClaimKind
  statement: string
  predicate: string
  objectValue: string
  confidence: number
  importance: number
  sensitivity: Extract<Sensitivity, 'personal'>
  scope: Exclude<ContinuityScope, { type: 'global' }>
  validFrom?: string
  validTo?: string
}

export interface ExtractionEnvelopeV1 {
  schemaVersion: 1
  sourceEpisodeId: string
  proposals: readonly ExtractionProposal[]
}

export interface ExtractionOutcome {
  proposalIndex: number
  decision: 'created-candidate' | 'duplicate'
  claimId: string
  conflictingClaimIds: readonly string[]
}

export interface ExtractionReconciliation {
  schemaVersion: 1
  sourceEpisodeId: string
  outcomes: readonly ExtractionOutcome[]
}

export interface RecallContext {
  workspaceId?: string
  sessionId?: string
  at?: string
  includeCandidates?: boolean
  allowedSensitivities?: readonly Sensitivity[]
}

export type RecallReason =
  | 'selected'
  | 'out-of-scope'
  | 'inactive'
  | 'invalid-time'
  | 'sensitivity-denied'
  | 'below-score'
  | 'over-budget'

export interface RecallCandidate {
  claimId: string
  score: number
  reason: RecallReason
}

export interface ContextPack {
  recallId: string
  text: string
  claimIds: readonly string[]
  contentHash: string
  charCount: number
}

export interface RecallDecision {
  id: string
  query: string
  queryFingerprint: string
  context: RecallContext
  candidates: readonly RecallCandidate[]
  selectedClaims: readonly MemoryClaim[]
  contradictionSets: readonly string[][]
  contextPack: ContextPack
  latencyMs: number
  createdAt: string
}

export interface RecallOptions {
  maxClaims?: number
  maxChars?: number
  graphDepth?: number
  minScore?: number
}

export interface RecordMaterializationInput {
  recallId: string
  runtimeId: string
  sessionId: string
  seqStart: number
  seqEnd: number
  renderedContentHash: string
}

export interface RecallMaterialization {
  id: string
  recallId: string
  claimId: string
  runtimeId: string
  sessionId: string
  seqStart: number
  seqEnd: number
  renderedContentHash: string
  createdAt: string
}

export type DerivativeDeletionState = 'purged' | 'retained-reference' | 'requires-session-deletion'

export interface ForgetDerivative {
  runtimeId: string
  sessionId: string
  seqStart: number
  seqEnd: number
  state: DerivativeDeletionState
}

export interface ForgetReport {
  receiptId: string
  claimId: string
  revoked: boolean
  physicallyPurged: boolean
  sourceStates: readonly { sourceEpisodeId: string; state: 'purged' | 'retained-reference' }[]
  derivatives: readonly ForgetDerivative[]
  completedAt: string
}

export interface ActionReceiptInput {
  id?: string
  action: string
  authorization: 'allowed' | 'denied' | 'not-required'
  runtimeId: string
  provider?: string
  result: 'succeeded' | 'failed' | 'cancelled' | 'denied'
  scope: ContinuityScope
  sourceEpisodeIds: readonly string[]
  affectedEntityIds?: readonly string[]
  occurredAt?: string
  idempotencyKey: string
}

export interface ActionReceipt extends Omit<ActionReceiptInput, 'id' | 'occurredAt' | 'idempotencyKey'> {
  id: string
  occurredAt: string
  recordedAt: string
  idempotencyKey: string
}

export interface OutboxJob {
  id: string
  jobType: string
  payload: Readonly<Record<string, unknown>>
  status: 'pending' | 'processing' | 'completed' | 'dead'
  attempts: number
  availableAt: string
  leaseUntil?: string
  lastError?: string
  idempotencyKey: string
  createdAt: string
  updatedAt: string
}

export interface PersonalCoreOptions {
  databasePath: string
  now?: () => Date
  idFactory?: (prefix: string) => string
}
