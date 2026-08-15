import type {
  ClaimKind,
  ClaimStatus,
  ContinuityScope,
  CreateSourceEpisodeInput,
  Sensitivity,
} from '@telos/personal-core'

export const CONTINUITY_RPC_CHANNEL = '/telos-continuity'

export type ContinuityRpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: 'bad-request'; message: string; details: { issues: never[] } } }
  | { ok: false; error: { code: 'internal'; message: string; details: Record<string, never> } }

export interface RememberCommand {
  statement: string
  predicate: string
  objectValue: string
  kind: ClaimKind
  scope: ContinuityScope
  sensitivity: Sensitivity
  confidence: number
  importance: number
  status: 'candidate' | 'confirmed'
  source: CreateSourceEpisodeInput
  actor: 'user' | 'agent' | 'runtime'
  idempotencyKey: string
  validFrom?: string
  validTo?: string
}

export interface CorrectCommand extends Omit<RememberCommand, 'status'> {
  claimId: string
  status: 'candidate' | 'confirmed'
}

export interface ConfirmCommand {
  claimId: string
  source: CreateSourceEpisodeInput
  actor: 'user'
  idempotencyKey: string
}

export interface ForgetCommand {
  claimId: string
  physical: boolean
  purgeSourceContent: boolean
  idempotencyKey: string
  actor: 'user' | 'agent'
}

export interface RecallCommand {
  query: string
  workspaceId?: string
  sessionId?: string
  includeCandidates?: boolean
  allowedSensitivities?: readonly Sensitivity[]
  maxClaims?: number
  maxChars?: number
  graphDepth?: number
  minScore?: number
}

export interface ListClaimsCommand {
  statuses?: readonly ClaimStatus[]
  scope?: ContinuityScope
  limit?: number
}

export interface ContinuityHealth {
  schemaVersion: number
  integrity: string
  databasePath: string
  lastBackgroundError?: string
}
