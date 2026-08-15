import { CONTINUITY_RPC_CHANNEL } from '../contracts.js'
import type {
  ActionReceiptView,
  ClientRpc,
  ContinuityClientSnapshot,
  ContinuityHealthView,
  ContinuityTab,
  CorrectionDraft,
  EntityView,
  ForgetReportView,
  MemoryClaimView,
  RecallDecisionView,
  RecallMaterializationView,
  RelationView,
  SessionRecallReceipt,
  SourceEpisodeView,
} from './contracts.js'

const EMPTY_SNAPSHOT: ContinuityClientSnapshot = {
  open: false,
  tab: 'memories',
  loading: false,
  claims: [],
  entities: [],
  relations: [],
  recalls: [],
  materializations: [],
  receipts: [],
  deletions: [],
  sourcesById: {},
  query: '',
  statusFilter: 'active',
  sessionReceipts: {},
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function managementSource(statement: string, sensitivity: MemoryClaimView['sensitivity']) {
  const id = randomId()
  return {
    sourceKind: 'telos.user-edit',
    runtimeId: 'dsh-web',
    sourceInstanceId: `memory-edit:${id}`,
    observedAt: new Date().toISOString(),
    content: statement,
    sensitivity,
  }
}

function confirmationSource(claim: MemoryClaimView) {
  const id = randomId()
  return {
    sourceKind: 'telos.user-confirmation',
    runtimeId: 'dsh-web',
    sourceInstanceId: `memory-confirmation:${id}`,
    observedAt: new Date().toISOString(),
    content: `Confirmed candidate: ${claim.statement}`,
    sensitivity: claim.sensitivity,
  }
}

/** Browser application boundary; every mutation remains an explicit user action. */
export class ContinuityClientController {
  private snapshot: ContinuityClientSnapshot = EMPTY_SNAPSHOT
  private readonly listeners = new Set<() => void>()
  private readonly receiptLoads = new Map<string, Promise<void>>()

  constructor(private readonly rpc: ClientRpc) {}

  getSnapshot = (): ContinuityClientSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  open(sessionId?: string): void {
    this.update({ open: true, activeSessionId: sessionId, error: undefined, notice: undefined })
    void this.refresh()
  }

  close(): void {
    this.update({ open: false, error: undefined, notice: undefined })
  }

  setTab(tab: ContinuityTab): void {
    this.update({ tab })
  }

  setQuery(query: string): void {
    this.update({ query })
  }

  setStatusFilter(statusFilter: ContinuityClientSnapshot['statusFilter']): void {
    this.update({ statusFilter })
  }

  async selectClaim(claimId?: string): Promise<void> {
    this.update({ selectedClaimId: claimId, error: undefined, notice: undefined })
    if (claimId === undefined) return
    const claim = this.snapshot.claims.find(candidate => candidate.id === claimId)
    if (claim === undefined) return
    const missing = claim.sourceEpisodeIds.filter(id => !(id in this.snapshot.sourcesById))
    if (missing.length === 0) return
    try {
      const sources = await Promise.all(missing.map(id => this.request<SourceEpisodeView | null>('source/get', {
        sourceEpisodeId: id,
      })))
      const additions = Object.fromEntries(missing.map((id, index) => [id, sources[index] ?? null]))
      this.update({ sourcesById: { ...this.snapshot.sourcesById, ...additions } })
    } catch (error) {
      this.update({ error: messageOf(error) })
    }
  }

  async refresh(): Promise<void> {
    this.update({ loading: true, error: undefined })
    try {
      const [health, claims, entities, relations, recalls, materializations, receipts, deletions] = await Promise.all([
        this.request<ContinuityHealthView>('health', {}),
        this.request<MemoryClaimView[]>('memory/list', { limit: 500 }),
        this.request<EntityView[]>('entity/list', { limit: 500 }),
        this.request<RelationView[]>('graph/list', { limit: 1_000 }),
        this.request<RecallDecisionView[]>('recall/list', { limit: 100 }),
        this.request<RecallMaterializationView[]>('materialization/list', { limit: 500 }),
        this.request<ActionReceiptView[]>('receipt/list', { limit: 200 }),
        this.request<ForgetReportView[]>('deletion/list', {}),
      ])
      this.update({
        loading: false,
        health,
        claims,
        entities,
        relations,
        recalls,
        materializations,
        receipts,
        deletions,
      })
      const selected = this.snapshot.selectedClaimId
      if (selected !== undefined && !claims.some(claim => claim.id === selected)) {
        this.update({ selectedClaimId: undefined })
      }
    } catch (error) {
      this.update({ loading: false, error: messageOf(error) })
    }
  }

  async correct(claim: MemoryClaimView, draft: CorrectionDraft): Promise<void> {
    this.update({ loading: true, error: undefined, notice: undefined })
    try {
      const replacement = await this.request<MemoryClaimView>('memory/correct', {
        claimId: claim.id,
        statement: draft.statement,
        predicate: draft.predicate,
        objectValue: draft.objectValue,
        kind: claim.kind,
        scope: claim.scope,
        sensitivity: claim.sensitivity,
        confidence: 1,
        importance: claim.importance,
        status: 'confirmed',
        source: managementSource(draft.statement, claim.sensitivity),
        actor: 'user',
        idempotencyKey: `ui:correct:${randomId()}`,
        validFrom: claim.validFrom,
        validTo: claim.validTo,
      })
      this.update({ selectedClaimId: replacement.id, notice: '已保留原记录，并创建纠正后的新版本。' })
      await this.refresh()
      await this.selectClaim(replacement.id)
    } catch (error) {
      this.update({ loading: false, error: messageOf(error) })
    }
  }

  async confirm(claim: MemoryClaimView): Promise<void> {
    this.update({ loading: true, error: undefined, notice: undefined })
    try {
      const confirmed = await this.request<MemoryClaimView>('memory/confirm', {
        claimId: claim.id,
        source: confirmationSource(claim),
        actor: 'user',
        idempotencyKey: `ui:confirm:${randomId()}`,
      })
      this.update({ selectedClaimId: confirmed.id, notice: '候选记忆已由你确认，之后可以参与正常召回。' })
      await this.refresh()
      await this.selectClaim(confirmed.id)
    } catch (error) {
      this.update({ loading: false, error: messageOf(error) })
    }
  }

  async forget(claim: MemoryClaimView, physical: boolean): Promise<ForgetReportView | undefined> {
    this.update({ loading: true, error: undefined, notice: undefined })
    try {
      const report = await this.request<ForgetReportView>('memory/forget', {
        claimId: claim.id,
        physical,
        purgeSourceContent: physical,
        actor: 'user',
        idempotencyKey: `ui:forget:${randomId()}`,
      })
      this.update({
        selectedClaimId: physical ? undefined : claim.id,
        notice: physical
          ? `已彻底删除；${String(report.derivatives.length)} 处已使用副本需在对应会话中继续删除。`
          : '已撤销该记忆；它不会再参与召回。',
      })
      await this.refresh()
      return report
    } catch (error) {
      this.update({ loading: false, error: messageOf(error) })
      return undefined
    }
  }

  sessionReceipt(sessionId: string): SessionRecallReceipt {
    return this.snapshot.sessionReceipts[sessionId] ?? { selectedCount: 0 }
  }

  loadSessionReceipt(sessionId: string): Promise<void> {
    const existing = this.receiptLoads.get(sessionId)
    if (existing !== undefined) return existing
    const pending = this.request<RecallDecisionView[]>('recall/list', { sessionId, limit: 1 })
      .then((recalls) => {
        const latest = recalls[0]
        this.update({
          sessionReceipts: {
            ...this.snapshot.sessionReceipts,
            [sessionId]: latest === undefined
              ? { selectedCount: 0 }
              : { selectedCount: latest.selectedClaims.length, recallId: latest.id, createdAt: latest.createdAt },
          },
        })
      })
      .catch((error: unknown) => { this.update({ error: messageOf(error) }) })
      .finally(() => { this.receiptLoads.delete(sessionId) })
    this.receiptLoads.set(sessionId, pending)
    return pending
  }

  private async request<T>(endpoint: string, payload: unknown): Promise<T> {
    const result = await this.rpc.call(CONTINUITY_RPC_CHANNEL, endpoint, payload)
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    return result.value as T
  }

  private update(patch: Partial<ContinuityClientSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }
}
