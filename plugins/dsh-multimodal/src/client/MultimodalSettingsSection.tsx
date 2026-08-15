import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
  type ModelCatalogEntry,
  type ModelRoute,
  type MultimodalSettings,
  type RouteStatus,
} from '../contracts.js'
import type { MultimodalClientController } from './controller.js'

export interface MultimodalInjected { controller: MultimodalClientController }

function routeValue(route: ModelRoute | undefined): string {
  return route === undefined ? '' : JSON.stringify(route)
}

function parseRouteValue(value: string): ModelRoute | undefined {
  if (value === '') return undefined
  const route = JSON.parse(value) as ModelRoute
  return { provider: route.provider, model: route.model }
}

function statusLabel(status: RouteStatus): string {
  if (status.state === 'available') return '可用'
  if (status.state === 'incompatible') return '不兼容'
  if (status.state === 'unverified') return '待验证'
  return '未配置'
}

function routeKey(route: ModelRoute): string {
  return `${route.provider}\u0000${route.model}`
}

export function MultimodalSettingsSection({ controller }: MultimodalInjected) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const [draft, setDraft] = useState<MultimodalSettings | undefined>()
  const [resetArmed, setResetArmed] = useState(false)
  useEffect(() => { void controller.refresh() }, [controller])
  useEffect(() => { if (state.view !== undefined) setDraft(state.view.settings) }, [state.view])

  const imageModels = useMemo(() => {
    if (state.view === undefined) return []
    return state.view.catalog.flatMap(group => group.models.map(model => ({ ...model, providerName: group.name })))
  }, [state.view])

  if (draft === undefined || state.view === undefined) {
    return <section aria-label="多模态模型配置" className="telosMmSettings"><div className="telosMmLoading">{state.error ?? '正在读取模型目录…'}</div></section>
  }
  const view = state.view
  const selectedMissing = draft.defaultModel !== undefined
    && !imageModels.some(model => routeKey(model) === routeKey(draft.defaultModel as ModelRoute))

  return <section aria-label="多模态模型配置" className="telosMmSettings">
    <header className="telosMmHeader">
      <div><h1>默认多模态模型</h1><p>当前会话模型看不懂图片时，由这里的模型先完成视觉理解；最终回答、推理和工具调用仍由当前会话模型负责。</p></div>
      <div className="telosMmActions">
        <button disabled={state.loading} onClick={() => { void controller.refresh() }} type="button">刷新目录</button>
        <button data-primary disabled={state.loading} onClick={() => { void controller.save(draft) }} type="button">保存</button>
      </div>
    </header>

    <div className="telosMmPhase"><strong>图片路由已启用</strong><span>原生图片模型直接处理；文本模型通过 Telos 逻辑路由使用默认多模态模型，不经过 MCP。</span></div>
    {state.error === undefined ? null : <div className="telosMmBanner" data-error>{state.error}</div>}
    {state.notice === undefined ? null : <div className="telosMmBanner">{state.notice}</div>}

    <label className="telosMmMaster">
      <span><strong>自动补足图片能力</strong><small>关闭后，当前模型不支持图片时直接使用 DSH 原生错误。</small></span>
      <input checked={draft.enabled} onChange={event => setDraft({ ...draft, enabled: event.target.checked })} type="checkbox" />
    </label>

    <div className="telosMmSectionTitle"><h2>模型</h2><p>API 地址与密钥继续在“模型”设置中配置，本页只保存 Provider 与模型 ID。</p></div>
    <article className="telosMmModelCard">
      <label>默认多模态模型
        <select onChange={event => setDraft({ ...draft, defaultModel: parseRouteValue(event.target.value) })} value={routeValue(draft.defaultModel)}>
          <option value="">未配置</option>
          {selectedMissing && draft.defaultModel !== undefined
            ? <option value={routeValue(draft.defaultModel)}>{draft.defaultModel.provider} · {draft.defaultModel.model}（待验证）</option>
            : null}
          {view.catalog.map(group => {
            const models = imageModels.filter(model => model.provider === group.id)
            return models.length === 0 ? null : <optgroup key={group.id} label={group.name}>{models.map((model: ModelCatalogEntry) => <option key={routeKey(model)} value={routeValue(model)}>{model.name}{model.inputModalities?.includes('image') ? '' : '（保存时声明图片能力）'}</option>)}</optgroup>
          })}
        </select>
      </label>
      <div className="telosMmStatus" data-status={view.defaultModelStatus.state}>
        <strong>{statusLabel(view.defaultModelStatus)}</strong><span>{view.defaultModelStatus.message}</span>
      </div>
      <p>选择尚未声明图片能力的自定义 OpenAI 兼容模型时，保存会通过 DSH Settings API 将该模型声明为 text + image；不直接改写配置文件。若声明或路由失败，图片不会提交到 Session，输入文字和图片草稿都会保留。</p>
    </article>

    <div className="telosMmFlow" aria-label="图片处理流程">
      <span>原始图片保存到 DSH Session</span><i>→</i><span>默认模型生成视觉观察</span><i>→</i><span>当前模型回答与调用工具</span>
    </div>

    <footer className="telosMmFooter">
      <p>配置按当前设备的本地用户保存，不随工作区切换；API Key 不会写入多模态配置。</p>
      <button data-danger disabled={state.loading} onClick={() => {
        if (!resetArmed) setResetArmed(true)
        else { setResetArmed(false); void controller.reset() }
      }} type="button">{resetArmed ? '再次确认恢复默认' : '恢复默认'}</button>
    </footer>
  </section>
}
