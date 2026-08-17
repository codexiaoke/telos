import { useEffect, useSyncExternalStore } from 'react'
import type { CompanionPetOption } from './contracts.js'
import type { CompanionClientController } from './controller.js'

export interface CompanionInjected { controller: CompanionClientController }

const KIND_LABEL: Record<CompanionPetOption['kind'], string> = {
  orb: '动态光球',
  sprite: '精灵动画',
  image: '图片',
  live2d: 'Live2D',
}

export function CompanionSettingsSection({ controller }: CompanionInjected) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  useEffect(() => { void controller.refresh() }, [controller])
  const view = state.view

  if (view === undefined) {
    return <section aria-label="桌面宠物设置" className="telosCompanionSettings">
      <div className="telosCompanionEmpty">{state.error ?? '正在读取桌面宠物状态…'}</div>
    </section>
  }

  const customPets = view.pets.filter(pet => pet.removable)
  return <section aria-label="桌面宠物设置" className="telosCompanionSettings">
    <header className="telosCompanionHeader">
      <div>
        <h1>桌面宠物</h1>
        <p>宠物与 Telos 共用同一个应用生命周期，并根据 Agent 工作状态切换动画。</p>
      </div>
      <button
        data-primary={!view.visible || undefined}
        disabled={state.loading}
        onClick={() => { void controller.updateSettings({ visible: !view.visible }) }}
        type="button"
      >{view.visible ? '隐藏宠物' : '显示宠物'}</button>
    </header>

    <div className="telosCompanionStatus" data-visible={view.visible || undefined}>
      <strong>{view.visible ? '宠物正在桌面显示' : '宠物当前已隐藏'}</strong>
      <span>{view.connected ? '已连接 Agent Runtime，动画会随任务状态变化。' : '正在等待 Agent Runtime，当前使用空闲动画。'}</span>
    </div>

    {state.error === undefined ? null : <div className="telosCompanionBanner" data-error>{state.error}</div>}
    {state.notice === undefined ? null : <div className="telosCompanionBanner">{state.notice}</div>}

    <div className="telosCompanionCard">
      <label>
        <span><strong>当前宠物</strong><small>切换后立即生效</small></span>
        <select
          disabled={state.loading}
          onChange={event => { void controller.updateSettings({ pet: event.target.value as typeof view.pet }) }}
          value={view.pet}
        >
          {view.pets.map(pet => <option key={pet.id} value={pet.id}>{pet.label} · {KIND_LABEL[pet.kind]}</option>)}
        </select>
      </label>
      <label>
        <span><strong>显示尺寸</strong><small>调整透明宠物窗口大小</small></span>
        <select
          disabled={state.loading}
          onChange={event => { void controller.updateSettings({ size: event.target.value as typeof view.size }) }}
          value={view.size}
        >
          <option value="small">小尺寸</option>
          <option value="large">大尺寸</option>
        </select>
      </label>
      <label className="telosCompanionSwitch">
        <span><strong>锁定位置</strong><small>锁定后不再响应桌面拖拽</small></span>
        <input
          checked={view.locked}
          disabled={state.loading}
          onChange={event => { void controller.updateSettings({ locked: event.target.checked }) }}
          type="checkbox"
        />
      </label>
    </div>

    <div className="telosCompanionImport">
      <div><h2>自定义宠物</h2><p>图片支持 PNG、APNG、WebP；Live2D 使用经过安全校验的 ZIP 模型包。</p></div>
      <div>
        <button disabled={state.loading} onClick={() => { void controller.importPet('image') }} type="button">导入图片…</button>
        <button disabled={state.loading} onClick={() => { void controller.importPet('live2d') }} type="button">导入 Live2D…</button>
      </div>
    </div>

    {customPets.length === 0 ? null : <div className="telosCompanionCustomList">
      {customPets.map(pet => <div key={pet.id}>
        <span><strong>{pet.label}</strong><small>{KIND_LABEL[pet.kind]}</small></span>
        <button data-danger disabled={state.loading} onClick={() => { void controller.removePet(pet.id) }} type="button">删除</button>
      </div>)}
    </div>}
  </section>
}
