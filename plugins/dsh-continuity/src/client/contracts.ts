export type ContinuityTab = 'memories' | 'graph' | 'recalls' | 'audit'

export type Scope =
  | { type: 'global' }
  | { type: 'workspace'; id: string }
  | { type: 'session'; id: string }

export interface MemoryClaimView {
  id: string
  kind: 'semantic' | 'episodic' | 'procedural' | 'prospective' | 'constraint'
  statement: string
  predicate: string
  subjectEntityId: string
  objectEntityId?: string
  objectValue?: string
  status: 'candidate' | 'confirmed' | 'superseded' | 'contradicted' | 'revoked' | 'expired'
  confidence: number
  importance: number
  sensitivity: 'personal' | 'sensitive' | 'secret'
  scope: Scope
  validFrom?: string
  validTo?: string
  observedAt: string
  recordedAt: string
  supersedesClaimId?: string
  supersededByClaimId?: string
  sourceEpisodeIds: string[]
  contentHash: string
  revision: number
}

export interface SourceEpisodeView {
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
  sensitivity: 'personal' | 'sensitive' | 'secret'
  deletionState: 'active' | 'purged'
}

export interface EntityView {
  id: string
  kind: string
  canonicalName: string
  scope: Scope
  status: 'active' | 'merged' | 'deleted'
  revision: number
}

export interface RelationView {
  claimId: string
  fromEntityId: string
  predicate: string
  toEntityId?: string
  objectValue?: string
  validFrom?: string
  validTo?: string
  status: MemoryClaimView['status']
}

export interface RecallCandidateView {
  claimId: string
  score: number
  reason: string
}

export interface RecallDecisionView {
  id: string
  query: string
  queryFingerprint: string
  context: { workspaceId?: string; sessionId?: string }
  candidates: RecallCandidateView[]
  selectedClaims: MemoryClaimView[]
  contradictionSets: string[][]
  contextPack: { claimIds: string[]; charCount: number; contentHash: string }
  latencyMs: number
  createdAt: string
}

export interface RecallMaterializationView {
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

export interface ActionReceiptView {
  id: string
  action: string
  authorization: 'allowed' | 'denied' | 'not-required'
  runtimeId: string
  provider?: string
  result: 'succeeded' | 'failed' | 'cancelled' | 'denied'
  scope: Scope
  sourceEpisodeIds: string[]
  affectedEntityIds: string[]
  occurredAt: string
  recordedAt: string
}

export interface ForgetReportView {
  receiptId: string
  claimId: string
  revoked: boolean
  physicallyPurged: boolean
  sourceStates: { sourceEpisodeId: string; state: 'purged' | 'retained-reference' }[]
  derivatives: {
    runtimeId: string
    sessionId: string
    seqStart: number
    seqEnd: number
    state: 'requires-session-deletion'
  }[]
  completedAt: string
}

export interface ContinuityHealthView {
  schemaVersion: number
  integrity: string
  databasePath: string
  lastBackgroundError?: string
}

export interface SessionRecallReceipt {
  selectedCount: number
  recallId?: string
  createdAt?: string
}

export interface ContinuityClientSnapshot {
  open: boolean
  tab: ContinuityTab
  loading: boolean
  error?: string
  notice?: string
  activeSessionId?: string
  health?: ContinuityHealthView
  claims: MemoryClaimView[]
  entities: EntityView[]
  relations: RelationView[]
  recalls: RecallDecisionView[]
  materializations: RecallMaterializationView[]
  receipts: ActionReceiptView[]
  deletions: ForgetReportView[]
  sourcesById: Record<string, SourceEpisodeView | null>
  selectedClaimId?: string
  query: string
  statusFilter: 'active' | 'all' | MemoryClaimView['status']
  sessionReceipts: Record<string, SessionRecallReceipt>
}

export interface ClientRpc {
  call(
    channel: string,
    endpoint: string,
    payload: unknown,
    signal?: AbortSignal,
  ): Promise<
    | { ok: true; value: unknown }
    | { ok: false; error: { code: string; message: string } }
  >
}

export interface CorrectionDraft {
  statement: string
  predicate: string
  objectValue: string
}
