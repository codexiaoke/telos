import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { PropsRenderSlots, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { WorkbenchFiles, workbenchFilesClient } from '../files/WorkbenchFiles'
import {
  clampWidth,
  computeEditorWorkbenchColumns,
  computeWorkbenchColumns,
  DETAILS_MAX,
  DETAILS_MIN,
  EDITOR_CONVERSATION_MAX,
  EDITOR_CONVERSATION_MIN,
  EDITOR_FILES_MAX,
  EDITOR_FILES_MIN,
  parseEditorPanelPreferences,
  SIDEBAR_AUTO_COLLAPSE,
  SIDEBAR_DEFAULT,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
} from './layout-model'
import type { createTelosLayoutStore } from './layout-store'

const OPEN_SEARCH_DIALOG_SELECTOR =
  ".telos-workbench-sidebar [data-slot='sidebar.workspaces'] > div:has(> div:first-child > div:first-of-type button[aria-expanded='true'])"
const SEARCH_SIDEBAR_SNAPSHOT_SELECTOR = '[data-telos-search-sidebar-snapshot]'

export type TelosAppFrameProps =
  & PropsRuntime<'root'>
  & PropsRenderSlots<'sidebar' | 'conversation' | 'details' | 'shell.overlay'>
  & PropsStore<ReturnType<typeof createTelosLayoutStore>>

type TelosViewMode = 'chat' | 'editor'

const VIEW_MODE_STORAGE_PREFIX = 'telos:view-mode:'
const EDITOR_PANELS_STORAGE_PREFIX = 'telos:editor-panels:'

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

function WorkbenchModeIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <rect height="14" rx="3" stroke="currentColor" strokeWidth="1.45" width="16" x="2" y="3" />
      <path d="M7 3.7v12.6M13.1 3.7v12.6" stroke="currentColor" strokeWidth="1.35" />
      <path d="m9.1 8.1-1.35 1.35L9.1 10.8m1.8-2.7 1.35 1.35-1.35 1.35" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.05" />
    </svg>
  )
}

function workspaceLabel(cwd: string | undefined): string | undefined {
  if (cwd === undefined) return undefined
  const segments = cwd.replace(/[/\\]+$/, '').split(/[/\\]/)
  return segments.at(-1) || cwd
}

interface ResizerProps {
  side: 'sidebar' | 'details' | 'editor-files' | 'editor-conversation'
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
      aria-label={{
        sidebar: '调整会话栏宽度',
        details: '调整活动面板宽度',
        'editor-files': '调整文件面板宽度',
        'editor-conversation': '调整聊天面板宽度',
      }[side]}
      aria-orientation="vertical"
      aria-valuemax={{
        sidebar: SIDEBAR_MAX,
        details: DETAILS_MAX,
        'editor-files': EDITOR_FILES_MAX,
        'editor-conversation': EDITOR_CONVERSATION_MAX,
      }[side]}
      aria-valuemin={{
        sidebar: SIDEBAR_MIN,
        details: DETAILS_MIN,
        'editor-files': EDITOR_FILES_MIN,
        'editor-conversation': EDITOR_CONVERSATION_MIN,
      }[side]}
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
  const currentSession = useSessions((sessions) => {
    const current = sessions.current
    return current === undefined ? undefined : sessions.byId[current]
  })
  const detailsSession = useSessions((sessions) => {
    const current = sessions.current
    return current !== undefined && sessions.byId[current]?.blank === false ? current : undefined
  })
  const frameRef = useRef<HTMLDivElement | null>(null)
  const searchDialogClick = useRef(false)
  const [viewport, setViewport] = useState(() => window.innerWidth)
  const viewModeStorageKey = `${VIEW_MODE_STORAGE_PREFIX}${currentSession?.cwd ?? 'global'}`
  const editorPanelsStorageKey = `${EDITOR_PANELS_STORAGE_PREFIX}${currentSession?.cwd ?? 'global'}`
  const [viewMode, setViewMode] = useState<TelosViewMode>('chat')
  const [editorPanels, setEditorPanels] = useState(() => (
    parseEditorPanelPreferences(window.localStorage.getItem(editorPanelsStorageKey))
  ))
  const editorPanelsRef = useRef(editorPanels)

  useEffect(() => {
    const stored = window.localStorage.getItem(viewModeStorageKey)
    setViewMode(stored === 'editor' ? 'editor' : 'chat')
  }, [viewModeStorageKey])

  useEffect(() => {
    let cancelled = false
    const fallback = (): void => {
      const panels = parseEditorPanelPreferences(window.localStorage.getItem(editorPanelsStorageKey))
      editorPanelsRef.current = panels
      setEditorPanels(panels)
    }
    const preferences = window.telos?.workbench
    if (preferences === undefined) {
      fallback()
      return
    }
    void preferences.getEditorPanels(editorPanelsStorageKey).then((panels) => {
      if (cancelled) return
      if (panels === undefined) fallback()
      else {
        editorPanelsRef.current = panels
        setEditorPanels(panels)
      }
    }, fallback)
    return () => { cancelled = true }
  }, [editorPanelsStorageKey])

  const toggleViewMode = useCallback(() => {
    setViewMode((current) => {
      const next = current === 'chat' ? 'editor' : 'chat'
      window.localStorage.setItem(viewModeStorageKey, next)
      return next
    })
  }, [viewModeStorageKey])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || event.key.toLowerCase() !== 'e') return
      event.preventDefault()
      toggleViewMode()
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [toggleViewMode])

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

  useEffect(() => {
    const frame = frameRef.current
    if (frame === null) return

    const syncSidebarSnapshot = () => {
      const searchDialog = frame.querySelector<HTMLElement>(OPEN_SEARCH_DIALOG_SELECTOR)
      const existingSnapshot = frame.querySelector<HTMLElement>(SEARCH_SIDEBAR_SNAPSHOT_SELECTOR)
      if (searchDialog === null) {
        existingSnapshot?.remove()
        return
      }
      if (existingSnapshot !== null) return

      const slot = searchDialog.parentElement
      const region = slot?.parentElement
      if (slot === null || slot === undefined || region === null || region === undefined) return

      const snapshot = searchDialog.cloneNode(true) as HTMLElement
      snapshot.dataset.telosSearchSidebarSnapshot = ''
      snapshot.setAttribute('aria-hidden', 'true')
      snapshot.inert = true
      snapshot.querySelector(':scope > div:first-child')?.remove()
      snapshot.querySelectorAll('[id]').forEach(element => { element.removeAttribute('id') })
      region.insertBefore(snapshot, slot.nextSibling)
    }

    const observer = new MutationObserver(syncSidebarSnapshot)
    observer.observe(frame, {
      attributes: true,
      attributeFilter: ['aria-expanded'],
      childList: true,
      subtree: true,
    })
    syncSidebarSnapshot()
    return () => {
      observer.disconnect()
      frame.querySelector(SEARCH_SIDEBAR_SNAPSHOT_SELECTOR)?.remove()
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
  const editorColumns = computeEditorWorkbenchColumns(
    viewport,
    editorPanels.files,
    editorPanels.conversation,
  )
  const editorColumnsRef = useRef(editorColumns)
  editorColumnsRef.current = editorColumns

  const sidebarBase = useRef(0)
  const detailsBase = useRef(0)
  const editorFilesBase = useRef(0)
  const editorConversationBase = useRef(0)
  const [dragging, setDragging] = useState(false)
  const endDrag = useCallback(() => setDragging(false), [])
  const endEditorDrag = useCallback(() => {
    setDragging(false)
    const panels = editorPanelsRef.current
    const fallback = (): void => {
      window.localStorage.setItem(editorPanelsStorageKey, JSON.stringify(panels))
    }
    const write = window.telos?.workbench?.setEditorPanels(editorPanelsStorageKey, panels)
    if (write === undefined) fallback()
    else void write.catch(fallback)
  }, [editorPanelsStorageKey])
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
  const startEditorFilesDrag = useCallback(() => {
    editorFilesBase.current = editorColumnsRef.current.files
    setDragging(true)
  }, [])
  const startEditorConversationDrag = useCallback(() => {
    editorConversationBase.current = editorColumnsRef.current.conversation
    setDragging(true)
  }, [])
  const dragEditorFiles = useCallback((dx: number) => {
    const next = {
      ...editorPanelsRef.current,
      files: clampWidth(editorFilesBase.current + dx, EDITOR_FILES_MIN, EDITOR_FILES_MAX),
    }
    editorPanelsRef.current = next
    setEditorPanels(next)
  }, [])
  const dragEditorConversation = useCallback((dx: number) => {
    const next = {
      ...editorPanelsRef.current,
      conversation: clampWidth(
        editorConversationBase.current - dx,
        EDITOR_CONVERSATION_MIN,
        EDITOR_CONVERSATION_MAX,
      ),
    }
    editorPanelsRef.current = next
    setEditorPanels(next)
  }, [])

  const handleWorkbenchClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    searchDialogClick.current = false
    if (!(event.target instanceof Element)) return
    const searchDialog = event.currentTarget.querySelector<HTMLElement>(OPEN_SEARCH_DIALOG_SELECTOR)
    if (searchDialog === null) return

    const clickedInsideDialog = searchDialog.contains(event.target)
    searchDialogClick.current = clickedInsideDialog
    const sessionRow = event.target.closest("[role='treeitem'][aria-selected]")
    const pickedSession = sessionRow !== null && clickedInsideDialog
    const clickedBackdrop = !clickedInsideDialog
    if (!pickedSession && !clickedBackdrop) return

    const closeButton = searchDialog.querySelector<HTMLElement>(
      ':scope > div:first-child > div:first-of-type button:last-of-type',
    )
    if (closeButton === null) return
    queueMicrotask(() => { closeButton.click() })
  }, [])

  const handleWorkbenchClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!searchDialogClick.current) return
    searchDialogClick.current = false
    // DSH treats the result tree as outside its input-only search root. Let the
    // row action finish, then keep this in-dialog click from its document listener.
    event.stopPropagation()
  }, [])

  return (
    <div
      className="telos-workbench-frame"
      data-details-collapsed={columns.details === 0 || undefined}
      data-dragging={dragging || undefined}
      data-sidebar-collapsed={sidebarCollapsed || undefined}
      data-telos-workbench=""
      data-view-mode={viewMode}
      onClick={handleWorkbenchClick}
      onClickCapture={handleWorkbenchClickCapture}
      ref={frameRef}
      style={{ gridTemplateColumns: viewMode === 'chat'
        ? `${columns.sidebar}px minmax(0, 1fr) ${columns.details}px`
        : `${editorColumns.files}px minmax(0, 1fr) ${editorColumns.conversation}px` }}
    >
      <div className="telos-editor-files-seat">
        <WorkbenchFiles
          active={viewMode === 'editor'}
          client={workbenchFilesClient()}
          sessionId={currentSession === undefined ? undefined : String(currentSession.id)}
          workspaceLabel={workspaceLabel(currentSession?.cwd)}
        />
      </div>
      {viewMode === 'chat' ? (
        <>
          <div className="telos-workbench-sidebar">
            {renderSlot('sidebar', { collapsed: sidebarCollapsed, width: columns.sidebar })}
          </div>
          <CenterColumn>{renderSlot('conversation', {})}</CenterColumn>
          <DetailsColumn>{renderSlot('details', {})}</DetailsColumn>
        </>
      ) : (
        <div className="telos-editor-conversation">{renderSlot('conversation', {})}</div>
      )}
      <div className="telos-workbench-overlay" data-shell-overlay>
        {renderSlot('shell.overlay', {})}
      </div>
      <button
        aria-label={viewMode === 'chat' ? '进入编辑工作台' : '返回自由聊天'}
        aria-pressed={viewMode === 'editor'}
        className="telos-view-mode-toggle"
        data-active={viewMode === 'editor' || undefined}
        onClick={toggleViewMode}
        title={`${viewMode === 'chat' ? '进入编辑工作台' : '返回自由聊天'} (⌘⇧E)`}
        type="button"
      >
        <WorkbenchModeIcon />
      </button>
      {viewMode === 'chat' && sidebarCollapsed && (
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
      {viewMode === 'chat' && !sidebarCollapsed && (
        <Resizer
          left={columns.sidebar}
          onDrag={dragSidebar}
          onEnd={endDrag}
          onStart={startSidebarDrag}
          side="sidebar"
          value={columns.sidebar}
        />
      )}
      {viewMode === 'chat' && columns.details > 0 && (
        <Resizer
          left={viewport - columns.details}
          onDrag={dragDetails}
          onEnd={endDrag}
          onStart={startDetailsDrag}
          side="details"
          value={columns.details}
        />
      )}
      {viewMode === 'editor' && (
        <>
          <Resizer
            left={editorColumns.files}
            onDrag={dragEditorFiles}
            onEnd={endEditorDrag}
            onStart={startEditorFilesDrag}
            side="editor-files"
            value={editorColumns.files}
          />
          <Resizer
            left={viewport - editorColumns.conversation}
            onDrag={dragEditorConversation}
            onEnd={endEditorDrag}
            onStart={startEditorConversationDrag}
            side="editor-conversation"
            value={editorColumns.conversation}
          />
        </>
      )}
    </div>
  )
}
