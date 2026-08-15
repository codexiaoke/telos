import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ContinuityClientController } from './controller.js'
import type {
  ContinuityClientSnapshot,
  ContinuityTab,
  MemoryClaimView,
  RecallDecisionView,
  Scope,
  SourceEpisodeView,
} from './contracts.js'

export interface ContinuityInjected {
  controller: ContinuityClientController
}

function MemoryIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <path d="M8.5 4.5a3 3 0 0 0-3 3v1a3.5 3.5 0 0 0 0 7v1a3 3 0 0 0 5.5 1.65V5.85A3 3 0 0 0 8.5 4.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15.5 4.5a3 3 0 0 1 3 3v1a3.5 3.5 0 0 1 0 7v1a3 3 0 0 1-5.5 1.65V5.85a3 3 0 0 1 2.5-1.35Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 9.5h3M13 14.5h3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 20 20" width="18">
      <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  )
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg aria-hidden="true" className={spinning ? 'telosContinuitySpinner' : undefined} fill="none" height="17" viewBox="0 0 20 20" width="17">
      <path d="M15.3 6.7A6 6 0 1 0 16 12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      <path d="M12.5 6.7h2.8V3.9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  )
}

function useContinuity(controller: ContinuityClientController): ContinuityClientSnapshot {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
}

function formatDate(value: string | undefined): string {
  if (value === undefined) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function scopeLabel(scope: Scope): string {
  if (scope.type === 'global') return '全局'
  return `${scope.type === 'workspace' ? '工作区' : '会话'} · ${scope.id.slice(0, 10)}`
}

function statusLabel(status: MemoryClaimView['status']): string {
  return {
    candidate: '待确认',
    confirmed: '已确认',
    superseded: '已纠正',
    contradicted: '有冲突',
    revoked: '已撤销',
    expired: '已过期',
  }[status]
}

function kindLabel(kind: MemoryClaimView['kind']): string {
  return {
    semantic: '事实', episodic: '事件', procedural: '方法', prospective: '承诺', constraint: '约束',
  }[kind]
}

export function ContinuityFooterAction({ controller, wide }: ContinuityInjected & { wide: boolean }) {
  const state = useContinuity(controller)
  const activeCount = state.claims.filter(claim => claim.status === 'confirmed').length
  return (
    <button
      aria-label="打开连续记忆"
      className="telosContinuityFooterButton"
      data-rail={wide ? undefined : ''}
      onClick={() => controller.open()}
      title="连续记忆"
      type="button"
    >
      <MemoryIcon />
      {wide ? <span>连续记忆{activeCount > 0 ? ` · ${String(activeCount)}` : ''}</span> : null}
    </button>
  )
}

export function ContinuityHeaderAction({
  controller,
  sessionId,
}: ContinuityInjected & { sessionId: string }) {
  const state = useContinuity(controller)
  const receipt = state.sessionReceipts[sessionId] ?? { selectedCount: 0 }
  useEffect(() => {
    void controller.loadSessionReceipt(sessionId)
    const timer = window.setInterval(() => { void controller.loadSessionReceipt(sessionId) }, 15_000)
    return () => window.clearInterval(timer)
  }, [controller, sessionId])

  const label = receipt.selectedCount > 0 ? `记忆 · ${String(receipt.selectedCount)}` : '记忆'
  return (
    <button
      aria-label={receipt.selectedCount > 0 ? `本轮召回 ${String(receipt.selectedCount)} 条记忆` : '打开连续记忆'}
      className="telosContinuityHeaderButton"
      onClick={() => controller.open(sessionId)}
      title={receipt.createdAt === undefined ? '连续记忆' : `最近使用于 ${formatDate(receipt.createdAt)}`}
      type="button"
    >
      <MemoryIcon size={15} />
      <span>{label}</span>
      {receipt.selectedCount > 0 ? <span className="telosContinuityBadge">{receipt.selectedCount}</span> : null}
    </button>
  )
}

const TABS: readonly { id: ContinuityTab; label: string }[] = [
  { id: 'memories', label: '记忆' },
  { id: 'graph', label: '关系图' },
  { id: 'recalls', label: '召回回执' },
  { id: 'audit', label: '行动与删除' },
]

function filteredClaims(state: ContinuityClientSnapshot): MemoryClaimView[] {
  const query = state.query.trim().toLocaleLowerCase()
  return state.claims.filter((claim) => {
    const statusMatch = state.statusFilter === 'all'
      || (state.statusFilter === 'active' && ['confirmed', 'candidate', 'contradicted'].includes(claim.status))
      || claim.status === state.statusFilter
    const queryMatch = query.length === 0
      || `${claim.statement} ${claim.predicate} ${claim.objectValue ?? ''}`.toLocaleLowerCase().includes(query)
    return statusMatch && queryMatch
  })
}

function ClaimList({ controller, state }: { controller: ContinuityClientController; state: ContinuityClientSnapshot }) {
  const claims = filteredClaims(state)
  const filters = [
    ['active', '有效'], ['all', '全部'], ['candidate', '待确认'], ['revoked', '已撤销'], ['superseded', '历史'],
  ] as const
  return (
    <div className="telosContinuityListPane">
      <div className="telosContinuityFilters">
        {filters.map(([id, label]) => (
          <button
            className="telosContinuityFilter"
            data-active={state.statusFilter === id ? '' : undefined}
            key={id}
            onClick={() => controller.setStatusFilter(id)}
            type="button"
          >{label}</button>
        ))}
      </div>
      {claims.length === 0
        ? <div className="telosContinuityEmpty">没有匹配的记忆。明确告诉 Telos“记住……”即可建立第一条。</div>
        : claims.map(claim => (
          <button
            className="telosContinuityClaim"
            data-selected={state.selectedClaimId === claim.id ? '' : undefined}
            key={claim.id}
            onClick={() => { void controller.selectClaim(claim.id) }}
            type="button"
          >
            <div className="telosContinuityClaimMeta">
              <span className="telosContinuityChip" data-status={claim.status}>{statusLabel(claim.status)}</span>
              <span className="telosContinuityChip">{kindLabel(claim.kind)}</span>
              <span className="telosContinuityChip">{scopeLabel(claim.scope)}</span>
            </div>
            <p className="telosContinuityClaimStatement">{claim.statement}</p>
            <span className="telosContinuityMuted">{formatDate(claim.recordedAt)} · {claim.sourceEpisodeIds.length} 个来源</span>
          </button>
        ))}
    </div>
  )
}

function SourceCard({ source }: { source: SourceEpisodeView | null | undefined }) {
  if (source === undefined) return <div className="telosContinuitySource telosContinuityMuted">正在读取来源…</div>
  if (source === null) return <div className="telosContinuitySource telosContinuityMuted">来源已不可用</div>
  return (
    <div className="telosContinuitySource">
      <div className="telosContinuityMetaRow">
        <span className="telosContinuityChip">{source.sourceKind}</span>
        <span className="telosContinuityChip">{source.deletionState === 'purged' ? '内容已清除' : '来源保留'}</span>
        <span className="telosContinuityMuted">{formatDate(source.observedAt)}</span>
      </div>
      {source.content === undefined ? null : <pre className="telosContinuitySourceContent">{source.content}</pre>}
      <div className="telosContinuityMuted" title={source.contentHash}>hash · {source.contentHash.slice(0, 12)}</div>
    </div>
  )
}

function ClaimDetail({ controller, state, claim }: {
  controller: ContinuityClientController
  state: ContinuityClientSnapshot
  claim: MemoryClaimView
}) {
  const [statement, setStatement] = useState(claim.statement)
  const [predicate, setPredicate] = useState(claim.predicate)
  const [value, setValue] = useState(claim.objectValue ?? claim.objectEntityId ?? '')
  const [armedPhysical, setArmedPhysical] = useState(false)
  useEffect(() => {
    setStatement(claim.statement)
    setPredicate(claim.predicate)
    setValue(claim.objectValue ?? claim.objectEntityId ?? '')
    setArmedPhysical(false)
  }, [claim])
  const editable = claim.status === 'confirmed' || claim.status === 'candidate' || claim.status === 'contradicted'
  const recalls = state.recalls.filter(recall => recall.selectedClaims.some(selected => selected.id === claim.id))
  const materializations = state.materializations.filter(item => item.claimId === claim.id)

  return (
    <div className="telosContinuityDetailPane">
      <h2 className="telosContinuityDetailTitle">{claim.statement}</h2>
      <div className="telosContinuityMetaRow">
        <span className="telosContinuityChip" data-status={claim.status}>{statusLabel(claim.status)}</span>
        <span className="telosContinuityChip">{kindLabel(claim.kind)}</span>
        <span className="telosContinuityChip">{claim.sensitivity}</span>
        <span className="telosContinuityChip">{scopeLabel(claim.scope)}</span>
      </div>
      <dl className="telosContinuityDefinition">
        <dt>关系</dt><dd>{claim.predicate}</dd>
        <dt>值</dt><dd>{claim.objectValue ?? claim.objectEntityId ?? '—'}</dd>
        <dt>可信度</dt><dd>{Math.round(claim.confidence * 100)}%</dd>
        <dt>版本</dt><dd>r{claim.revision}{claim.supersedesClaimId === undefined ? '' : ` · 纠正 ${claim.supersedesClaimId.slice(0, 12)}`}</dd>
        <dt>实际使用</dt><dd>{recalls.length} 次召回 · {materializations.length} 个会话副本</dd>
        <dt>内容指纹</dt><dd title={claim.contentHash}>{claim.contentHash.slice(0, 20)}…</dd>
      </dl>

      <section className="telosContinuitySection">
        <h3 className="telosContinuitySectionTitle">证据来源</h3>
        {claim.sourceEpisodeIds.map(id => <SourceCard key={id} source={state.sourcesById[id]} />)}
      </section>

      {claim.status === 'candidate' ? (
        <section className="telosContinuitySection">
          <h3 className="telosContinuitySectionTitle">候选记忆</h3>
          <p className="telosContinuityMuted">这是从你的直接陈述中提取的候选项。确认前不会进入正常召回。</p>
          <button
            className="telosContinuityButton"
            data-primary
            disabled={state.loading}
            onClick={() => { void controller.confirm(claim) }}
            type="button"
          >确认这条候选记忆</button>
        </section>
      ) : null}

      {editable ? (
        <section className="telosContinuitySection">
          <h3 className="telosContinuitySectionTitle">纠正，不覆盖历史</h3>
          <div className="telosContinuityEditGrid">
            <textarea aria-label="记忆表述" className="telosContinuityField" onChange={event => setStatement(event.target.value)} rows={2} value={statement} />
            <input aria-label="关系" className="telosContinuityField" onChange={event => setPredicate(event.target.value)} value={predicate} />
            <input aria-label="值" className="telosContinuityField" onChange={event => setValue(event.target.value)} value={value} />
          </div>
          <div className="telosContinuityActions">
            <button
              className="telosContinuityButton"
              data-primary
              disabled={state.loading || statement.trim() === '' || predicate.trim() === '' || value.trim() === ''}
              onClick={() => { void controller.correct(claim, { statement, predicate, objectValue: value }) }}
              type="button"
            >保存为新版本</button>
          </div>
        </section>
      ) : null}

      <section className="telosContinuitySection">
        <h3 className="telosContinuitySectionTitle">撤销与本地删除</h3>
        <p className="telosContinuityMuted">撤销会保留审计历史但停止召回；彻底删除会清除本地 Claim 和无共享来源内容。</p>
        <div className="telosContinuityActions">
          {claim.status === 'revoked' ? null : (
            <button
              className="telosContinuityButton"
              data-danger
              disabled={state.loading}
              onClick={() => { void controller.forget(claim, false) }}
              type="button"
            >撤销记忆</button>
          )}
          <button
            className="telosContinuityButton"
            data-danger
            disabled={state.loading}
            onClick={() => {
              if (!armedPhysical) setArmedPhysical(true)
              else void controller.forget(claim, true)
            }}
            type="button"
          >{armedPhysical ? '再次点击确认彻底删除' : '彻底删除本地记录'}</button>
        </div>
      </section>
    </div>
  )
}

function MemoriesView({ controller, state }: { controller: ContinuityClientController; state: ContinuityClientSnapshot }) {
  const selected = state.claims.find(claim => claim.id === state.selectedClaimId)
  return (
    <div className="telosContinuityMemoryGrid">
      <ClaimList controller={controller} state={state} />
      {selected === undefined
        ? <div className="telosContinuityEmpty">选择一条记忆，查看来源、版本和实际召回记录。</div>
        : <ClaimDetail claim={selected} controller={controller} state={state} />}
    </div>
  )
}

function GraphView({ state }: { state: ContinuityClientSnapshot }) {
  const entities = new Map(state.entities.map(entity => [entity.id, entity.canonicalName]))
  const relations = state.relations.filter(relation => state.query.trim() === ''
    || `${relation.predicate} ${relation.objectValue ?? ''} ${entities.get(relation.fromEntityId) ?? ''}`
      .toLocaleLowerCase().includes(state.query.trim().toLocaleLowerCase()))
  return (
    <div className="telosContinuityScrollPane telosContinuityContent">
      <h2 className="telosContinuityContentTitle">实体关系投影</h2>
      <p className="telosContinuityContentSubtitle">每条边都能回到 MemoryClaim；图可重建，不是唯一事实源。</p>
      {relations.length === 0
        ? <div className="telosContinuityEmpty">还没有可展示的关系。</div>
        : relations.map(relation => (
          <div className="telosContinuityGraphRow" key={relation.claimId}>
            <div className="telosContinuityNode">{entities.get(relation.fromEntityId) ?? relation.fromEntityId}</div>
            <div className="telosContinuityEdge">{relation.predicate}</div>
            <div className="telosContinuityNode">{relation.toEntityId === undefined
              ? relation.objectValue
              : entities.get(relation.toEntityId) ?? relation.toEntityId}</div>
          </div>
        ))}
    </div>
  )
}

function RecallCard({ recall, state }: { recall: RecallDecisionView; state: ContinuityClientSnapshot }) {
  const materialized = state.materializations.filter(item => item.recallId === recall.id)
  return (
    <article className="telosContinuityReceipt">
      <div className="telosContinuityReceiptHeader">
        <span className="telosContinuityChip">选中 {recall.selectedClaims.length}</span>
        <span className="telosContinuityChip">候选 {recall.candidates.length}</span>
        <span className="telosContinuityChip">注入 {materialized.length}</span>
        <span className="telosContinuityMuted">{formatDate(recall.createdAt)} · {recall.latencyMs.toFixed(1)} ms</span>
      </div>
      <p className="telosContinuityReceiptQuery">{recall.query}</p>
      <p className="telosContinuityReceiptClaims">
        {recall.selectedClaims.length === 0
          ? '未使用任何记忆'
          : recall.selectedClaims.map(claim => `${claim.id.slice(0, 10)} · ${claim.statement}`).join('；')}
      </p>
      {recall.contradictionSets.length > 0
        ? <p className="telosContinuityReceiptClaims">存在 {recall.contradictionSets.length} 组未解决冲突，均保留在回执中。</p>
        : null}
    </article>
  )
}

function RecallsView({ state }: { state: ContinuityClientSnapshot }) {
  const query = state.query.trim().toLocaleLowerCase()
  const recalls = state.recalls.filter(recall => query.length === 0 || recall.query.toLocaleLowerCase().includes(query)
    || recall.selectedClaims.some(claim => claim.statement.toLocaleLowerCase().includes(query)))
  return (
    <div className="telosContinuityScrollPane telosContinuityContent">
      <h2 className="telosContinuityContentTitle">召回决策回执</h2>
      <p className="telosContinuityContentSubtitle">能看到选了什么、忽略了什么、是否真的注入某个 DSH 会话。</p>
      {recalls.length === 0
        ? <div className="telosContinuityEmpty">尚无召回记录。</div>
        : recalls.map(recall => <RecallCard key={recall.id} recall={recall} state={state} />)}
    </div>
  )
}

function AuditView({ state }: { state: ContinuityClientSnapshot }) {
  return (
    <div className="telosContinuityScrollPane telosContinuityContent">
      <h2 className="telosContinuityContentTitle">行动与删除审计</h2>
      <p className="telosContinuityContentSubtitle">行动回执不保存原始参数；删除回执明确列出仍存在于会话中的派生副本。</p>
      <div className="telosContinuityAuditGrid">
        <section className="telosContinuityAuditColumn">
          <h3 className="telosContinuitySectionTitle">行动回执</h3>
          {state.receipts.length === 0 ? <div className="telosContinuityEmpty">暂无行动回执。</div> : state.receipts.map(receipt => (
            <article className="telosContinuityReceipt" key={receipt.id}>
              <div className="telosContinuityReceiptHeader">
                <span className="telosContinuityChip">{receipt.result}</span>
                <span className="telosContinuityChip">{receipt.authorization}</span>
                <span className="telosContinuityMuted">{formatDate(receipt.occurredAt)}</span>
              </div>
              <p className="telosContinuityReceiptQuery">{receipt.action}</p>
              <p className="telosContinuityReceiptClaims">{receipt.runtimeId} · {scopeLabel(receipt.scope)}</p>
            </article>
          ))}
        </section>
        <section className="telosContinuityAuditColumn">
          <h3 className="telosContinuitySectionTitle">删除回执</h3>
          {state.deletions.length === 0 ? <div className="telosContinuityEmpty">暂无删除记录。</div> : state.deletions.map(report => (
            <article className="telosContinuityReceipt" key={report.receiptId}>
              <div className="telosContinuityReceiptHeader">
                <span className="telosContinuityChip">{report.physicallyPurged ? '已彻底删除' : '已撤销'}</span>
                <span className="telosContinuityMuted">{formatDate(report.completedAt)}</span>
              </div>
              <p className="telosContinuityReceiptQuery">{report.claimId}</p>
              <p className="telosContinuityReceiptClaims">
                来源 {report.sourceStates.length} · 待处理会话副本 {report.derivatives.length}
              </p>
            </article>
          ))}
        </section>
      </div>
    </div>
  )
}

export function ContinuityOverlay({ controller }: ContinuityInjected) {
  const state = useContinuity(controller)
  useEffect(() => {
    if (!state.open) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') controller.close()
    }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [controller, state.open])
  if (!state.open) return null

  return (
    <div
      className="telosContinuityBackdrop"
      onMouseDown={(event) => { if (event.currentTarget === event.target) controller.close() }}
    >
      <section aria-label="连续记忆" aria-modal="true" className="telosContinuityDialog" role="dialog">
        <header className="telosContinuityTopbar">
          <div className="telosContinuityTitleBlock">
            <h1 className="telosContinuityTitle">连续记忆</h1>
            <p className="telosContinuitySubtitle">可见、可纠正、可删除、可追溯</p>
          </div>
          <input
            aria-label="搜索记忆"
            autoFocus
            className="telosContinuitySearch"
            onChange={event => controller.setQuery(event.target.value)}
            placeholder="搜索表述、关系或值"
            value={state.query}
          />
          <button aria-label="刷新" className="telosContinuityIconButton" onClick={() => { void controller.refresh() }} type="button">
            <RefreshIcon spinning={state.loading} />
          </button>
          <button aria-label="关闭连续记忆" className="telosContinuityIconButton" onClick={() => controller.close()} type="button"><CloseIcon /></button>
        </header>
        <div>
          <nav aria-label="连续记忆视图" className="telosContinuityTabs" role="tablist">
            {TABS.map(tab => (
              <button
                aria-selected={state.tab === tab.id}
                className="telosContinuityTab"
                key={tab.id}
                onClick={() => controller.setTab(tab.id)}
                role="tab"
                type="button"
              >{tab.label}</button>
            ))}
            <span className="telosContinuityHealth" title={state.health?.databasePath}>
              <span
                className="telosContinuityHealthDot"
                data-health={state.health === undefined ? 'loading' : state.health.integrity === 'ok' && state.health.lastBackgroundError === undefined ? 'ok' : 'error'}
              />
              {state.health === undefined
                ? '正在连接'
                : state.health.lastBackgroundError === undefined
                  ? `本地数据库 · schema ${String(state.health.schemaVersion)}`
                  : `后台错误 · ${state.health.lastBackgroundError}`}
            </span>
          </nav>
          {state.error === undefined ? null : <div className="telosContinuityBanner" data-error>{state.error}</div>}
          {state.notice === undefined ? null : <div className="telosContinuityBanner">{state.notice}</div>}
        </div>
        <main className="telosContinuityBody">
          {state.tab === 'memories' ? <MemoriesView controller={controller} state={state} /> : null}
          {state.tab === 'graph' ? <GraphView state={state} /> : null}
          {state.tab === 'recalls' ? <RecallsView state={state} /> : null}
          {state.tab === 'audit' ? <AuditView state={state} /> : null}
        </main>
      </section>
    </div>
  )
}
