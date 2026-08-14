import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { PropsRenderSlots, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import {
  computeWorkbenchColumns,
  DETAILS_MAX,
  DETAILS_MIN,
  SIDEBAR_AUTO_COLLAPSE,
  SIDEBAR_DEFAULT,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
} from './layout-model'
import type { createTelosLayoutStore } from './layout-store'

export type TelosAppFrameProps =
  & PropsRuntime<'root'>
  & PropsRenderSlots<'sidebar' | 'conversation' | 'details' | 'shell.overlay'>
  & PropsStore<ReturnType<typeof createTelosLayoutStore>>

function CenterColumn({ children }: { children?: ReactNode }) {
  return <div className="telos-workbench-center">{children}</div>
}

function DetailsColumn({ children }: { children?: ReactNode }) {
  return <div className="telos-workbench-details">{children}</div>
}

function SidebarOpenIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <rect height="14" rx="3.5" stroke="currentColor" strokeWidth="1.6" width="16" x="2" y="3" />
      <path d="M7 3.8v12.4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  )
}

interface ResizerProps {
  side: 'sidebar' | 'details'
  left: number
  value: number
  onStart: () => void
  onDrag: (dx: number) => void
  onEnd: () => void
}

function Resizer({ side, left, value, onStart, onDrag, onEnd }: ResizerProps) {
  const [dragging, setDragging] = useState(false)
  const origin = useRef(0)
  const latest = useRef(0)
  const frame = useRef<number | null>(null)
  const callbacks = useRef({ onStart, onDrag, onEnd })
  callbacks.current = { onStart, onDrag, onEnd }

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    origin.current = event.clientX
    latest.current = event.clientX
    callbacks.current.onStart()
    setDragging(true)
  }, [])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    latest.current = event.clientX
    frame.current ??= requestAnimationFrame(() => {
      frame.current = null
      callbacks.current.onDrag(latest.current - origin.current)
    })
  }, [])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    callbacks.current.onDrag(latest.current - origin.current)
    setDragging(false)
    callbacks.current.onEnd()
  }, [])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    callbacks.current.onStart()
    callbacks.current.onDrag(event.key === 'ArrowLeft' ? -16 : 16)
    callbacks.current.onEnd()
  }, [])

  return (
    <div
      aria-label={side === 'sidebar' ? '调整会话栏宽度' : '调整活动面板宽度'}
      aria-orientation="vertical"
      aria-valuemax={side === 'sidebar' ? SIDEBAR_MAX : DETAILS_MAX}
      aria-valuemin={side === 'sidebar' ? SIDEBAR_MIN : DETAILS_MIN}
      aria-valuenow={Math.round(value)}
      className="telos-workbench-resizer"
      data-dragging={dragging || undefined}
      data-side={side}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      role="separator"
      style={{ left }}
      tabIndex={0}
    />
  )
}

export function TelosAppFrame({
  useStore,
  useSessions,
  actions,
  renderSlot,
}: TelosAppFrameProps) {
  const panels = useStore(state => state)
  const detailsSession = useSessions((sessions) => {
    const current = sessions.current
    return current !== undefined && sessions.byId[current]?.blank === false ? current : undefined
  })
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [viewport, setViewport] = useState(() => window.innerWidth)

  const lastSession = useRef(detailsSession)
  useLayoutEffect(() => {
    if (detailsSession === undefined) return
    if (lastSession.current !== undefined && lastSession.current !== detailsSession) {
      actions.closeDetails()
    }
    lastSession.current = detailsSession
  }, [actions, detailsSession])

  useEffect(() => {
    const element = frameRef.current
    if (element === null) return
    let resizeFrame: number | null = null
    const observer = new ResizeObserver(() => {
      resizeFrame ??= requestAnimationFrame(() => {
        resizeFrame = null
        const width = element.getBoundingClientRect().width
        if (width > 0) setViewport(width)
      })
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame)
    }
  }, [])

  const narrow = viewport < SIDEBAR_AUTO_COLLAPSE
  useEffect(() => actions.setNarrow(narrow), [actions, narrow])
  const sidebarCollapsed = narrow ? !panels.narrowExpanded : panels.sidebar === 0
  const sidebarPreference = sidebarCollapsed
    ? 0
    : panels.sidebar === 0 ? SIDEBAR_DEFAULT : panels.sidebar
  const columns = computeWorkbenchColumns(
    viewport,
    sidebarPreference,
    detailsSession === undefined ? 0 : panels.details,
  )
  const columnsRef = useRef(columns)
  columnsRef.current = columns

  const sidebarBase = useRef(0)
  const detailsBase = useRef(0)
  const [dragging, setDragging] = useState(false)
  const endDrag = useCallback(() => setDragging(false), [])
  const startSidebarDrag = useCallback(() => {
    sidebarBase.current = columnsRef.current.sidebar
    setDragging(true)
  }, [])
  const startDetailsDrag = useCallback(() => {
    detailsBase.current = columnsRef.current.details
    setDragging(true)
  }, [])
  const dragSidebar = useCallback((dx: number) => {
    actions.setSidebar(sidebarBase.current + dx)
  }, [actions])
  const dragDetails = useCallback((dx: number) => {
    actions.setDetails(detailsBase.current - dx)
  }, [actions])

  const handleWorkbenchClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return
    const searchDialog = event.currentTarget.querySelector<HTMLElement>(
      ".telos-workbench-sidebar [data-slot='sidebar.workspaces'] > div:has(> div:first-child > div:first-of-type button[aria-expanded='true'])",
    )
    if (searchDialog === null) return

    const sessionRow = event.target.closest("[role='treeitem'][aria-selected]")
    const pickedSession = sessionRow !== null && searchDialog.contains(sessionRow)
    const clickedBackdrop = !searchDialog.contains(event.target)
    if (!pickedSession && !clickedBackdrop) return

    const closeButton = searchDialog.querySelector<HTMLElement>(
      ':scope > div:first-child > div:first-of-type button:last-of-type',
    )
    if (closeButton === null) return
    queueMicrotask(() => { closeButton.click() })
  }, [])

  return (
    <div
      className="telos-workbench-frame"
      data-details-collapsed={columns.details === 0 || undefined}
      data-dragging={dragging || undefined}
      data-sidebar-collapsed={sidebarCollapsed || undefined}
      data-telos-workbench=""
      onClick={handleWorkbenchClick}
      ref={frameRef}
      style={{ gridTemplateColumns: `${columns.sidebar}px minmax(0, 1fr) ${columns.details}px` }}
    >
      <div className="telos-workbench-sidebar">
        {renderSlot('sidebar', { collapsed: sidebarCollapsed, width: columns.sidebar })}
      </div>
      <CenterColumn>{renderSlot('conversation', {})}</CenterColumn>
      <DetailsColumn>{renderSlot('details', {})}</DetailsColumn>
      <div className="telos-workbench-overlay" data-shell-overlay>
        {renderSlot('shell.overlay', {})}
      </div>
      {sidebarCollapsed && (
        <button
          aria-label="打开侧边栏"
          className="telos-sidebar-reopen"
          onClick={actions.toggleSidebar}
          title="打开侧边栏"
          type="button"
        >
          <SidebarOpenIcon />
        </button>
      )}
      {!sidebarCollapsed && (
        <Resizer
          left={columns.sidebar}
          onDrag={dragSidebar}
          onEnd={endDrag}
          onStart={startSidebarDrag}
          side="sidebar"
          value={columns.sidebar}
        />
      )}
      {columns.details > 0 && (
        <Resizer
          left={viewport - columns.details}
          onDrag={dragDetails}
          onEnd={endDrag}
          onStart={startDetailsDrag}
          side="details"
          value={columns.details}
        />
      )}
    </div>
  )
}
