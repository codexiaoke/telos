import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
  MULTIMODAL_CAPABILITIES,
  type CapabilityRouteConfig,
  type ModelProviderGroup,
  type ModelRoute,
  type MultimodalCapability,
  type MultimodalSettings,
  type RouteStatus,
} from '../contracts.js'
import type { MultimodalClientController } from './controller.js'

export interface MultimodalInjected { controller: MultimodalClientController }

const CAPABILITY_COPY: Record<MultimodalCapability, { title: string; description: string }> = {
  'image-understanding': { title: '图片理解', description: '看懂照片、截图、图表和界面。' },
  ocr: { title: 'OCR', description: '从图片和扫描件中提取文字与版面。' },
  'speech-to-text': { title: '语音转文字', description: '转写语音消息、录音和音视频音轨。' },
  'text-to-speech': { title: '文字转语音', description: '把回复生成可播放的语音。' },
  'video-understanding': { title: '视频理解', description: '处理视频的画面、时间轴和音轨。' },
  'document-understanding': { title: '文档理解', description: '处理 PDF、Office 文档、扫描页和版面。' },
}

const EMPTY_ROUTE: ModelRoute = { provider: '', model: '' }

function routeOf(config: CapabilityRouteConfig): ModelRoute {
  return config.route ?? EMPTY_ROUTE
}

function statusLabel(status: RouteStatus): string {
  if (status.state === 'available') return '可用'
  if (status.state === 'incompatible') return '不兼容'
  if (status.state === 'unverified') return '待验证'
  if (status.state === 'disabled') return '已停用'
  return '自动'
}

function RouteInputs({ route, catalog, id, onChange }: {
  route: ModelRoute
  catalog: readonly ModelProviderGroup[]
  id: string
  onChange: (route: ModelRoute) => void
}) {
  const models = useMemo(
    () => catalog.find(group => group.id === route.provider)?.models ?? catalog.flatMap(group => group.models),
    [catalog, route.provider],
  )
  return <div className="telosMmRouteInputs">
    <label>Provider
      <input list={`${id}-providers`} onChange={event => onChange({ ...route, provider: event.target.value })} placeholder="例如 openai" value={route.provider} />
      <datalist id={`${id}-providers`}>{catalog.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</datalist>
    </label>
    <label>Model
      <input list={`${id}-models`} onChange={event => onChange({ ...route, model: event.target.value })} placeholder="模型 ID" value={route.model} />
      <datalist id={`${id}-models`}>{models.map(model => <option key={`${model.provider}:${model.model}`} value={model.model}>{model.name}</option>)}</datalist>
    </label>
  </div>
}

function CapabilityEditor({ capability, config, status, catalog, onChange }: {
  capability: MultimodalCapability
  config: CapabilityRouteConfig
  status: RouteStatus
  catalog: readonly ModelProviderGroup[]
  onChange: (config: CapabilityRouteConfig) => void
}) {
  const copy = CAPABILITY_COPY[capability]
  return <article className="telosMmCapability">
    <div className="telosMmCapabilityHeader">
      <div><h3>{copy.title}</h3><p>{copy.description}</p></div>
      <span data-status={status.state}>{statusLabel(status)}</span>
    </div>
    <label className="telosMmMode">模型路线
      <select onChange={event => {
        const mode = event.target.value as CapabilityRouteConfig['mode']
        onChange(mode === 'fixed' ? { mode, route: routeOf(config) } : { mode })
      }} value={config.mode}>
        <option value="auto">自动选择</option>
        <option value="fixed">指定模型</option>
        <option value="disabled">停用</option>
      </select>
    </label>
    {config.mode === 'fixed' ? <RouteInputs catalog={catalog} id={`telos-mm-${capability}`} onChange={route => onChange({ mode: 'fixed', route })} route={routeOf(config)} /> : null}
    <p className="telosMmStatusText">{status.message}</p>
  </article>
}

export function MultimodalSettingsSection({ controller }: MultimodalInjected) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const [draft, setDraft] = useState<MultimodalSettings | undefined>()
  const [resetArmed, setResetArmed] = useState(false)
  useEffect(() => { void controller.refresh() }, [controller])
  useEffect(() => { if (state.view !== undefined) setDraft(state.view.settings) }, [state.view])

  if (draft === undefined || state.view === undefined) {
    return <section aria-label="多模态模型配置" className="telosMmSettings"><div className="telosMmLoading">{state.error ?? '正在读取模型目录…'}</div></section>
  }
  const view = state.view

  const updateRoute = (capability: MultimodalCapability, config: CapabilityRouteConfig) => {
    setDraft(current => current === undefined ? current : ({ ...current, routes: { ...current.routes, [capability]: config } }))
  }
  const mainRoute = draft.mainModel.route ?? EMPTY_ROUTE
  const fixedRoutesValid = MULTIMODAL_CAPABILITIES.every(capability => {
    const route = draft.routes[capability]
    return route.mode !== 'fixed' || (route.route?.provider.trim() !== '' && route.route?.model.trim() !== '')
  })
  const mainRouteValid = draft.mainModel.mode !== 'fixed' || (mainRoute.provider.trim() !== '' && mainRoute.model.trim() !== '')

  return <section aria-label="多模态模型配置" className="telosMmSettings">
    <header className="telosMmHeader">
      <div><h1>多模态模型</h1><p>为不同媒体能力指定模型路线。Provider 的地址和 API Key 仍在“模型”设置中管理。</p></div>
      <div className="telosMmActions">
        <button disabled={state.loading} onClick={() => { void controller.refresh() }} type="button">刷新目录</button>
        <button data-primary disabled={state.loading || !fixedRoutesValid || !mainRouteValid} onClick={() => { void controller.save(draft) }} type="button">保存</button>
      </div>
    </header>

    <div className="telosMmPhase"><strong>配置基础</strong><span>本页会持久化模型与隐私路线；多模态处理运行时尚未在这一阶段启用。</span></div>
    {state.error === undefined ? null : <div className="telosMmBanner" data-error>{state.error}</div>}
    {state.notice === undefined ? null : <div className="telosMmBanner">{state.notice}</div>}

    <label className="telosMmMaster">
      <span><strong>启用 Telos 多模态路线</strong><small>关闭后保留配置，但未来运行时只使用 DSH 原生能力。</small></span>
      <input checked={draft.enabled} onChange={event => setDraft({ ...draft, enabled: event.target.checked })} type="checkbox" />
    </label>

    <div className="telosMmSectionTitle"><h2>主模型</h2><p>继续负责推理、回答和工具决策，不要求它原生支持所有媒体。</p></div>
    <article className="telosMmMainModel">
      <label className="telosMmMode">选择方式
        <select onChange={event => {
          const mode = event.target.value as MultimodalSettings['mainModel']['mode']
          setDraft({ ...draft, mainModel: mode === 'fixed' ? { mode, route: mainRoute } : { mode } })
        }} value={draft.mainModel.mode}>
          <option value="follow-session">跟随当前会话</option>
          <option value="fixed">固定模型</option>
        </select>
      </label>
      {draft.mainModel.mode === 'fixed' ? <RouteInputs catalog={view.catalog} id="telos-mm-main" onChange={route => setDraft({ ...draft, mainModel: { mode: 'fixed', route } })} route={mainRoute} /> : null}
      <p className="telosMmStatusText"><span data-status={view.mainModelStatus.state}>{statusLabel(view.mainModelStatus)}</span>{view.mainModelStatus.message}</p>
    </article>

    <div className="telosMmSectionTitle"><h2>能力路线</h2><p>“自动”会在运行时接入后，结合能力声明、可用性和隐私策略选择。</p></div>
    <div className="telosMmCapabilities">{MULTIMODAL_CAPABILITIES.map(capability => <CapabilityEditor
      capability={capability}
      catalog={view.catalog}
      config={draft.routes[capability]}
      key={capability}
      onChange={config => updateRoute(capability, config)}
      status={view.routeStatuses[capability]}
    />)}</div>

    <div className="telosMmSectionTitle"><h2>隐私与本地优先</h2><p>这些是未来路线规划器的强约束，不是提示词建议。</p></div>
    <div className="telosMmPrivacy">
      <label><span><strong>优先使用本地能力</strong><small>同等可用时先选本机 OCR、转写或视觉模型。</small></span><input checked={draft.privacy.preferLocal} onChange={event => setDraft({ ...draft, privacy: { ...draft.privacy, preferLocal: event.target.checked } })} type="checkbox" /></label>
      <label><span><strong>媒体发送到云端</strong><small>控制原始图片、音频、视频和文档能否离开本机。</small></span><select onChange={event => setDraft({ ...draft, privacy: { ...draft.privacy, cloudMediaPolicy: event.target.value as MultimodalSettings['privacy']['cloudMediaPolicy'] } })} value={draft.privacy.cloudMediaPolicy}><option value="ask">每次首次询问</option><option value="allow-configured">允许已配置路线</option><option value="local-only">仅限本地</option></select></label>
    </div>

    <footer className="telosMmFooter">
      <p>配置按当前设备的本地用户保存，不随工作区切换；模型密钥不会写入此配置文件。</p>
      <button data-danger disabled={state.loading} onClick={() => {
        if (!resetArmed) setResetArmed(true)
        else { setResetArmed(false); void controller.reset() }
      }} type="button">{resetArmed ? '再次确认恢复默认' : '恢复默认'}</button>
    </footer>
  </section>
}
