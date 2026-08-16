import { useEffect, useState, useSyncExternalStore } from 'react'
import { MAX_PERSONAL_INSTRUCTIONS_BYTES } from '../contracts.js'
import type { PersonalizationClientController } from './controller.js'

export interface PersonalizationInjected { controller: PersonalizationClientController }

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

export function PersonalizationSettingsSection({ controller }: PersonalizationInjected) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const [draft, setDraft] = useState<string>()
  const [clearArmed, setClearArmed] = useState(false)
  useEffect(() => { void controller.refresh() }, [controller])
  useEffect(() => { if (state.view !== undefined) setDraft(state.view.instructions) }, [state.view])

  if (draft === undefined || state.view === undefined) {
    return <section aria-label="个性化指令配置" className="telosPersonalization"><div className="telosPersonalizationLoading">{state.error ?? '正在读取个性化指令…'}</div></section>
  }

  const byteLength = utf8Bytes(draft)
  const maxBytes = state.view.maxBytes || MAX_PERSONAL_INSTRUCTIONS_BYTES
  const overLimit = byteLength > maxBytes
  const dirty = draft !== state.view.instructions

  return <section aria-label="个性化指令配置" className="telosPersonalization">
    <header className="telosPersonalizationHeader">
      <div><h1>个性化指令</h1><p>告诉 Telos 你是谁、希望它怎样回答，以及应长期遵循的偏好。</p></div>
      <div className="telosPersonalizationActions">
        <button disabled={state.loading || !dirty} onClick={() => setDraft(state.view?.instructions ?? '')} type="button">撤销修改</button>
        <button data-primary disabled={state.loading || !dirty || overLimit} onClick={() => { void controller.save(draft) }} type="button">保存</button>
      </div>
    </header>

    <div className="telosPersonalizationPhase"><strong>应用于本机所有工作区</strong><span>由 DSH 原生 AGENTS.md 指令链加载，不修改 Agent 预设；下一次对话请求开始生效。</span></div>
    {state.error === undefined ? null : <div className="telosPersonalizationBanner" data-error>{state.error}</div>}
    {state.notice === undefined ? null : <div className="telosPersonalizationBanner">{state.notice}</div>}

    <label className="telosPersonalizationEditor">
      <span>指令内容</span>
      <textarea
        onChange={event => { setClearArmed(false); setDraft(event.target.value) }}
        placeholder={'例如：\n- 请优先使用中文回答\n- 先给结论，再解释原因\n- 我常用的技术栈是 Electron、React 和 TypeScript'}
        rows={14}
        value={draft}
      />
      <small data-error={overLimit || undefined}>{String(byteLength)} / {String(maxBytes)} UTF-8 bytes{overLimit ? '，内容过长，无法保存' : ''}</small>
    </label>

    <footer className="telosPersonalizationFooter">
      <p>内容仅保存在当前设备的本地 DSH 用户目录，不随工作区切换或上传。请不要在这里填写 API Key 等秘密。</p>
      <button data-danger disabled={state.loading || (!state.view.configured && draft.trim().length === 0)} onClick={() => {
        if (!clearArmed) setClearArmed(true)
        else { setClearArmed(false); setDraft(''); void controller.reset() }
      }} type="button">{clearArmed ? '再次确认清空' : '清空指令'}</button>
    </footer>
  </section>
}
