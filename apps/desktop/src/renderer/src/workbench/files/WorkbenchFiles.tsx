import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MaterialFileIcon } from './material-file-icons'
import { MonacoCodeEditor, MonacoDiffViewer } from './MonacoCodeEditor'
import { editorContextStore, type EditorSelectionContext } from './editor-context'
import { detectExternalFileChange, type ExternalFileChange } from './external-change'

const WORKBENCH_FILES_RPC_CHANNEL = '/telos-workbench-files'
const MULTI_ROOT_WORKSPACE_RPC_CHANNEL = '/telos-multi-root-workspace'

interface WorkspaceRootView {
  id: string
  label: string
  path: string
  primary: boolean
}

interface WorkspaceGroupView {
  workspaceId: string
  title: string
  primaryRootId: string
  roots: WorkspaceRootView[]
  updatedAt: string
}

export interface WorkbenchFileEntry {
  name: string
  path: string
  kind: 'directory' | 'file'
  hidden: boolean
}

interface WorkbenchDirectoryView {
  path: string
  entries: WorkbenchFileEntry[]
  truncated: boolean
}

interface WorkbenchTextFile {
  path: string
  content: string
  revision: string
  mtimeMs: number
  size: number
}

interface WorkbenchEditorContext {
  sessionId: string
  path: string
  content: string
  revision: string
  selection?: { startLine: number; endLine: number; content: string }
}

export interface WorkbenchFilesRpc {
  call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<
    | { ok: true; value: unknown }
    | { ok: false; error: { code: string; message: string } }
  >
}

export class WorkbenchFilesClient {
  constructor(private readonly rpc: WorkbenchFilesRpc) {}

  list(sessionId: string, path: string, signal?: AbortSignal): Promise<WorkbenchDirectoryView> {
    return this.call('list', { sessionId, path }, signal)
  }

  read(sessionId: string, path: string, signal?: AbortSignal): Promise<WorkbenchTextFile> {
    return this.call('read', { sessionId, path }, signal)
  }

  write(sessionId: string, file: WorkbenchTextFile): Promise<WorkbenchTextFile> {
    return this.call('write', {
      sessionId,
      path: file.path,
      content: file.content,
      expectedRevision: file.revision,
    })
  }

  stageContext(context: WorkbenchEditorContext, signal?: AbortSignal): Promise<WorkbenchEditorContext> {
    return this.call('stage-context', context, signal)
  }

  workspaceGroup(sessionId: string): Promise<WorkspaceGroupView> {
    return this.callChannel(MULTI_ROOT_WORKSPACE_RPC_CHANNEL, 'get-session', { sessionId })
  }

  async addWorkspaceRoot(workspaceId: string): Promise<WorkspaceGroupView | undefined> {
    const path = await this.callChannel<string | null>(MULTI_ROOT_WORKSPACE_RPC_CHANNEL, 'pick-directory', {})
    if (path === null) return undefined
    return this.callChannel(MULTI_ROOT_WORKSPACE_RPC_CHANNEL, 'add-root', { workspaceId, path })
  }

  removeWorkspaceRoot(workspaceId: string, rootId: string): Promise<WorkspaceGroupView> {
    return this.callChannel(MULTI_ROOT_WORKSPACE_RPC_CHANNEL, 'remove-root', { workspaceId, rootId })
  }

  renameWorkspaceRoot(workspaceId: string, rootId: string, label: string): Promise<WorkspaceGroupView> {
    return this.callChannel(MULTI_ROOT_WORKSPACE_RPC_CHANNEL, 'rename-root', { workspaceId, rootId, label })
  }

  private async call<T>(endpoint: string, payload: unknown, signal?: AbortSignal): Promise<T> {
    return this.callChannel(WORKBENCH_FILES_RPC_CHANNEL, endpoint, payload, signal)
  }

  private async callChannel<T>(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<T> {
    const result = await this.rpc.call(channel, endpoint, payload, signal)
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    return result.value as T
  }
}

let configuredClient: WorkbenchFilesClient | undefined

export function configureWorkbenchFilesClient(client: WorkbenchFilesClient): void {
  configuredClient = client
}

export function workbenchFilesClient(): WorkbenchFilesClient {
  if (configuredClient === undefined) throw new Error('Telos workbench files client is unavailable before plugin setup')
  return configuredClient
}

interface OpenFile extends WorkbenchTextFile {
  savedContent: string
  saving: boolean
  pendingChange?: ExternalFileChange
  undoChange?: { content: string; label: string }
  error?: string
}

interface TabContextMenu {
  path: string
  x: number
  y: number
}

function basename(path: string): string {
  return path.split('/').at(-1) ?? path
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16">
      <path d={expanded ? 'm4 6 4 4 4-4' : 'm6 4 4 4-4 4'} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.35" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 18 18">
      <path d="M14 6.1A5.75 5.75 0 1 0 14.35 11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.45" />
      <path d="M10.9 5.9H14.2V2.6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16">
      <path d="m4.5 4.5 7 7m0-7-7 7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.35" />
    </svg>
  )
}

function WorkspaceFoldersIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 18 18">
      <path d="M2.7 5.2h4l1.2 1.4h7.4v6.9a1.4 1.4 0 0 1-1.4 1.4H4.1a1.4 1.4 0 0 1-1.4-1.4V5.2Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.35" />
      <path d="M5.2 3.1h3.4l1.1 1.3h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.35" />
    </svg>
  )
}

interface WorkspaceRootsDialogProps {
  client: WorkbenchFilesClient
  group: WorkspaceGroupView
  openFilePaths: readonly string[]
  onChange: (group: WorkspaceGroupView) => void
  onClose: () => void
}

function WorkspaceRootsDialog({ client, group, openFilePaths, onChange, onClose }: WorkspaceRootsDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const run = async (operation: () => Promise<WorkspaceGroupView | undefined>): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const next = await operation()
      if (next !== undefined) onChange(next)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const rename = (root: WorkspaceRootView): void => {
    const label = window.prompt('文件夹显示名称', root.label)?.trim()
    if (label === undefined || label === '' || label === root.label) return
    void run(() => client.renameWorkspaceRoot(group.workspaceId, root.id, label))
  }

  const remove = (root: WorkspaceRootView): void => {
    if (openFilePaths.some(path => path === `${root.id}:` || path.startsWith(`${root.id}:/`))) {
      setError('请先关闭这个文件夹中已经打开的文件')
      return
    }
    if (!window.confirm(`从工作区移除“${root.label}”？不会删除磁盘上的文件。`)) return
    void run(() => client.removeWorkspaceRoot(group.workspaceId, root.id))
  }

  return (
    <div className="telos-workspace-roots-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose()
    }}>
      <section aria-labelledby="telosWorkspaceRootsTitle" aria-modal="true" className="telos-workspace-roots-dialog" role="dialog">
        <header>
          <div><h2 id="telosWorkspaceRootsTitle">工作区文件夹</h2><p>{group.title} · {group.roots.length} 个文件夹</p></div>
          <button aria-label="关闭" disabled={busy} onClick={onClose} type="button">×</button>
        </header>
        <div className="telos-workspace-roots-list">
          {group.roots.map(root => (
            <div className="telos-workspace-roots-row" key={root.id}>
              <MaterialFileIcon expanded kind="folder" name={root.label} />
              <span><strong>{root.label}</strong><small>{root.path}</small></span>
              {root.primary && <em>主目录</em>}
              <button disabled={busy} onClick={() => rename(root)} type="button">重命名</button>
              {!root.primary && <button data-danger disabled={busy} onClick={() => remove(root)} type="button">移除</button>}
            </div>
          ))}
        </div>
        {error !== undefined && <p className="telos-workspace-roots-error" role="alert">{error}</p>}
        <footer>
          <span>移除文件夹不会删除本地文件。</span>
          <button data-primary disabled={busy} onClick={() => void run(() => client.addWorkspaceRoot(group.workspaceId))} type="button">
            {busy ? '处理中…' : '＋ 添加文件夹'}
          </button>
        </footer>
      </section>
    </div>
  )
}

interface FileTreeProps {
  activePath?: string
  directories: Readonly<Record<string, WorkbenchDirectoryView>>
  expanded: ReadonlySet<string>
  loading: ReadonlySet<string>
  onDirectory: (path: string) => void
  onFile: (path: string) => void
  path: string
  depth?: number
}

function FileTree({ activePath, directories, expanded, loading, onDirectory, onFile, path, depth = 0 }: FileTreeProps) {
  const directory = directories[path]
  if (directory === undefined) return null
  return (
    <div role={depth === 0 ? 'tree' : 'group'}>
      {directory.entries.map(entry => entry.kind === 'directory' ? (
        <div key={entry.path}>
          <button
            aria-expanded={expanded.has(entry.path)}
            className="telos-file-tree-row"
            data-loading={loading.has(entry.path) || undefined}
            onClick={() => onDirectory(entry.path)}
            role="treeitem"
            style={{ paddingLeft: 12 + depth * 14 }}
            type="button"
          >
            <span className="telos-file-tree-chevron"><ChevronIcon expanded={expanded.has(entry.path)} /></span>
            <span className="telos-file-tree-icon"><MaterialFileIcon expanded={expanded.has(entry.path)} kind="folder" name={entry.name} /></span>
            <span className="telos-file-tree-name">{entry.name}</span>
          </button>
          {expanded.has(entry.path) && (
            <FileTree
              activePath={activePath}
              depth={depth + 1}
              directories={directories}
              expanded={expanded}
              loading={loading}
              onDirectory={onDirectory}
              onFile={onFile}
              path={entry.path}
            />
          )}
        </div>
      ) : (
        <button
          aria-selected={activePath === entry.path}
          className="telos-file-tree-row"
          data-active={activePath === entry.path || undefined}
          key={entry.path}
          onClick={() => onFile(entry.path)}
          role="treeitem"
          style={{ paddingLeft: 30 + depth * 14 }}
          type="button"
        >
          <span className="telos-file-tree-icon"><MaterialFileIcon kind="file" name={entry.name} /></span>
          <span className="telos-file-tree-name">{entry.name}</span>
        </button>
      ))}
      {directory.truncated && <div className="telos-file-tree-note">目录内容过多，仅显示前一部分</div>}
    </div>
  )
}

export interface WorkbenchFilesProps {
  active: boolean
  client: WorkbenchFilesClient
  sessionId?: string
  workspaceLabel?: string
}

export function WorkbenchFiles({ active, client, sessionId, workspaceLabel }: WorkbenchFilesProps) {
  const [directories, setDirectories] = useState<Record<string, WorkbenchDirectoryView>>({})
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState<Set<string>>(() => new Set())
  const [files, setFiles] = useState<OpenFile[]>([])
  const [activePath, setActivePath] = useState<string>()
  const [selection, setSelection] = useState<EditorSelectionContext>()
  const [tabContextMenu, setTabContextMenu] = useState<TabContextMenu>()
  const [error, setError] = useState<string>()
  const [workspaceGroup, setWorkspaceGroup] = useState<WorkspaceGroupView>()
  const [managingRoots, setManagingRoots] = useState(false)
  const activeFile = files.find(file => file.path === activePath)
  const filesRef = useRef(files)
  const checkingFilesRef = useRef(false)
  filesRef.current = files

  useEffect(() => {
    if (!active || sessionId === undefined || activeFile === undefined) {
      if (sessionId !== undefined) editorContextStore.clear(sessionId)
      return
    }
    editorContextStore.publish({
      sessionId,
      path: activeFile.path,
      content: activeFile.content,
      revision: activeFile.revision,
      ...(selection === undefined ? {} : { selection }),
    })
  }, [active, activeFile, selection, sessionId])

  useEffect(() => () => {
    if (sessionId !== undefined) editorContextStore.clear(sessionId)
  }, [sessionId])

  const loadDirectory = useCallback(async (path: string, signal?: AbortSignal) => {
    if (sessionId === undefined) return
    setLoading(current => new Set(current).add(path))
    try {
      const directory = await client.list(sessionId, path, signal)
      setDirectories(current => ({ ...current, [path]: directory }))
      setError(undefined)
    } catch (reason) {
      if (signal?.aborted) return
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoading((current) => {
        const next = new Set(current)
        next.delete(path)
        return next
      })
    }
  }, [client, sessionId])

  useEffect(() => {
    if (!active) return
    setDirectories({})
    setExpanded(new Set())
    setFiles([])
    setActivePath(undefined)
    setTabContextMenu(undefined)
    setError(undefined)
    setWorkspaceGroup(undefined)
    setManagingRoots(false)
    if (sessionId === undefined) return
    const controller = new AbortController()
    void loadDirectory('', controller.signal)
    void client.workspaceGroup(sessionId).then(setWorkspaceGroup, reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason))
    })
    return () => controller.abort()
  }, [active, loadDirectory, sessionId])

  const openDirectory = useCallback((path: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
    if (directories[path] === undefined) void loadDirectory(path)
  }, [directories, loadDirectory])

  const openFile = useCallback(async (path: string) => {
    if (files.some(file => file.path === path)) {
      setSelection(undefined)
      setActivePath(path)
      return
    }
    if (sessionId === undefined) return
    try {
      const opened = await client.read(sessionId, path)
      setFiles(current => current.some(file => file.path === path) ? current : [
        ...current,
        { ...opened, savedContent: opened.content, saving: false },
      ])
      setSelection(undefined)
      setActivePath(path)
      setError(undefined)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }, [client, files, sessionId])

  const updateActiveFile = useCallback((content: string) => {
    setFiles(current => current.map(file => file.path === activePath ? {
      ...file,
      content,
      undoChange: undefined,
      error: undefined,
    } : file))
  }, [activePath])

  const saveActiveFile = useCallback(async () => {
    if (activeFile === undefined || sessionId === undefined || activeFile.content === activeFile.savedContent) return
    setFiles(current => current.map(file => file.path === activeFile.path ? { ...file, saving: true, error: undefined } : file))
    try {
      const saved = await client.write(sessionId, activeFile)
      setFiles(current => current.map(file => file.path === activeFile.path ? {
        ...saved, savedContent: saved.content, saving: false, pendingChange: undefined, undoChange: undefined,
      } : file))
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setFiles(current => current.map(file => file.path === activeFile.path ? { ...file, saving: false, error: message } : file))
    }
  }, [activeFile, client, sessionId])

  const checkExternalChanges = useCallback(async () => {
    if (sessionId === undefined || checkingFilesRef.current) return
    const snapshot = filesRef.current
    if (snapshot.length === 0) return
    checkingFilesRef.current = true
    try {
      const reads = await Promise.all(snapshot.map(async (file) => {
        try {
          return { path: file.path, value: await client.read(sessionId, file.path) }
        } catch {
          return undefined
        }
      }))
      const byPath = new Map(reads.flatMap(result => result === undefined ? [] : [[result.path, result.value] as const]))
      setFiles(current => current.map((file) => {
        const disk = byPath.get(file.path)
        if (disk === undefined || file.saving) return file
        const change = detectExternalFileChange(file, disk, file.pendingChange)
        if (change === undefined) return file
        return { ...file, pendingChange: change, undoChange: undefined, error: undefined }
      }))
    } finally {
      checkingFilesRef.current = false
    }
  }, [client, sessionId])

  useEffect(() => {
    if (!active || sessionId === undefined || files.length === 0) return
    void checkExternalChanges()
    const interval = window.setInterval(() => { void checkExternalChanges() }, 1_200)
    const onFocus = () => { void checkExternalChanges() }
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [active, checkExternalChanges, files.length, sessionId])

  const acceptExternalChange = useCallback(() => {
    if (activeFile?.pendingChange === undefined) return
    const { pendingChange } = activeFile
    setFiles(current => current.map(file => file.path === activeFile.path ? {
      ...pendingChange.incoming,
      savedContent: pendingChange.incoming.content,
      saving: false,
      undoChange: {
        content: pendingChange.conflict ? pendingChange.localContent : pendingChange.baseContent,
        label: pendingChange.conflict ? '撤销并恢复我的修改' : '撤销外部修改',
      },
    } : file))
    setSelection(undefined)
  }, [activeFile])

  const restoreContentOverExternalChange = useCallback(async (content: string, undoContent: string, undoLabel: string) => {
    if (activeFile?.pendingChange === undefined || sessionId === undefined) return
    const path = activeFile.path
    const incoming = activeFile.pendingChange.incoming
    setFiles(current => current.map(file => file.path === path ? { ...file, saving: true, error: undefined } : file))
    try {
      const restored = await client.write(sessionId, { ...incoming, content })
      setFiles(current => current.map(file => file.path === path ? {
        ...restored,
        savedContent: restored.content,
        saving: false,
        undoChange: { content: undoContent, label: undoLabel },
      } : file))
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setFiles(current => current.map(file => file.path === path ? { ...file, saving: false, error: message } : file))
    }
  }, [activeFile, client, sessionId])

  const rejectExternalChange = useCallback(() => {
    if (activeFile?.pendingChange === undefined) return
    const pending = activeFile.pendingChange
    void restoreContentOverExternalChange(
      pending.conflict ? pending.localContent : pending.baseContent,
      pending.incoming.content,
      '撤销恢复并重新应用外部修改',
    )
  }, [activeFile, restoreContentOverExternalChange])

  const undoExternalChange = useCallback(async () => {
    if (activeFile?.undoChange === undefined || sessionId === undefined || activeFile.content !== activeFile.savedContent) return
    const path = activeFile.path
    const undo = activeFile.undoChange
    setFiles(current => current.map(file => file.path === path ? { ...file, saving: true, error: undefined } : file))
    try {
      const restored = await client.write(sessionId, { ...activeFile, content: undo.content })
      setFiles(current => current.map(file => file.path === path ? {
        ...restored, savedContent: restored.content, saving: false,
      } : file))
      setSelection(undefined)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setFiles(current => current.map(file => file.path === path ? { ...file, saving: false, error: message } : file))
    }
  }, [activeFile, client, sessionId])

  const closeFiles = useCallback((paths: readonly string[]) => {
    const closingPaths = new Set(paths)
    const dirtyFiles = files.filter(file => closingPaths.has(file.path) && file.content !== file.savedContent)
    if (dirtyFiles.length > 0) {
      const message = dirtyFiles.length === 1
        ? `${basename(dirtyFiles[0]!.path)} 还有未保存的修改，确定关闭吗？`
        : `${dirtyFiles.length} 个文件还有未保存的修改：\n${dirtyFiles.map(file => `• ${basename(file.path)}`).join('\n')}\n\n确定关闭吗？`
      if (!window.confirm(message)) return
    }

    const activeIndex = files.findIndex(file => file.path === activePath)
    const next = files.filter(file => !closingPaths.has(file.path))
    setFiles(next)
    setTabContextMenu(undefined)
    if (activePath === undefined || !closingPaths.has(activePath)) return
    const nextActive = files.slice(activeIndex + 1).find(file => !closingPaths.has(file.path))
      ?? files.slice(0, activeIndex).findLast(file => !closingPaths.has(file.path))
    setActivePath(nextActive?.path)
  }, [activePath, files])

  const closeFile = useCallback((path: string) => closeFiles([path]), [closeFiles])

  useEffect(() => {
    if (tabContextMenu === undefined) return
    const closeMenu = () => setTabContextMenu(undefined)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    window.addEventListener('blur', closeMenu)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('blur', closeMenu)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [tabContextMenu])

  const rootLoading = loading.has('')
  const title = useMemo(() => workspaceLabel?.trim() || '工作区', [workspaceLabel])

  return (
    <>
      <aside className="telos-editor-explorer">
        <header className="telos-editor-explorer-header">
          <span title={title}>{title}</span>
          <button aria-label="管理工作区文件夹" disabled={workspaceGroup === undefined} onClick={() => setManagingRoots(true)} title="管理工作区文件夹" type="button"><WorkspaceFoldersIcon /></button>
          <button aria-label="刷新文件" onClick={() => void loadDirectory('')} title="刷新文件" type="button"><RefreshIcon /></button>
        </header>
        <div className="telos-editor-explorer-body">
          {sessionId === undefined && <div className="telos-editor-empty-small">请先打开一个工作区会话</div>}
          {sessionId !== undefined && rootLoading && directories[''] === undefined && <div className="telos-editor-empty-small">正在读取文件…</div>}
          {error !== undefined && <div className="telos-editor-error">{error}</div>}
          <FileTree
            activePath={activePath}
            directories={directories}
            expanded={expanded}
            loading={loading}
            onDirectory={openDirectory}
            onFile={path => void openFile(path)}
            path=""
          />
        </div>
      </aside>
      {managingRoots && workspaceGroup !== undefined && (
        <WorkspaceRootsDialog
          client={client}
          group={workspaceGroup}
          onChange={(group) => {
            setWorkspaceGroup(group)
            setDirectories({})
            setExpanded(new Set())
            void loadDirectory('')
          }}
          onClose={() => setManagingRoots(false)}
          openFilePaths={files.map(file => file.path)}
        />
      )}
      <main className="telos-editor-surface">
        {files.length > 0 && (
          <div className="telos-editor-tabs" role="tablist">
            {files.map(file => {
              const dirty = file.content !== file.savedContent
              return (
                <div
                  aria-selected={file.path === activePath}
                  className="telos-editor-tab"
                  data-active={file.path === activePath || undefined}
                  data-dirty={dirty || undefined}
                  data-menu-open={tabContextMenu?.path === file.path || undefined}
                  key={file.path}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    const menuWidth = 190
                    const menuHeight = 176
                    setTabContextMenu({
                      path: file.path,
                      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
                      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
                    })
                  }}
                  role="tab"
                >
                  <button onClick={() => { setSelection(undefined); setActivePath(file.path) }} title={file.path} type="button">
                    <MaterialFileIcon kind="file" name={file.path} />
                    <span className="telos-editor-tab-label">{basename(file.path)}</span>
                  </button>
                  <button aria-label={`关闭 ${basename(file.path)}`} className="telos-editor-tab-close" onClick={() => closeFile(file.path)} type="button">
                    {dirty && <span aria-hidden="true" className="telos-editor-dirty" />}
                    <span className="telos-editor-tab-close-icon"><CloseIcon /></span>
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {tabContextMenu !== undefined && (() => {
          const tabIndex = files.findIndex(file => file.path === tabContextMenu.path)
          const menuItems = [
            { label: '关闭', paths: [tabContextMenu.path], disabled: false },
            { label: '关闭其他', paths: files.filter(file => file.path !== tabContextMenu.path).map(file => file.path), disabled: files.length < 2 },
            { label: '关闭左侧', paths: files.slice(0, tabIndex).map(file => file.path), disabled: tabIndex <= 0 },
            { label: '关闭右侧', paths: files.slice(tabIndex + 1).map(file => file.path), disabled: tabIndex === -1 || tabIndex >= files.length - 1 },
            { label: '关闭全部', paths: files.map(file => file.path), disabled: files.length === 0 },
          ]
          return (
            <div
              className="telos-editor-tab-menu-layer"
              onContextMenu={event => event.preventDefault()}
              onMouseDown={() => setTabContextMenu(undefined)}
            >
              <div
                aria-label={`${basename(tabContextMenu.path)} 标签页管理`}
                className="telos-editor-tab-menu"
                onMouseDown={event => event.stopPropagation()}
                role="menu"
                style={{ left: tabContextMenu.x, top: tabContextMenu.y }}
              >
                {menuItems.map((item, index) => (
                  <button
                    className={index === 2 ? 'telos-editor-tab-menu-separator' : undefined}
                    disabled={item.disabled}
                    key={item.label}
                    onClick={() => closeFiles(item.paths)}
                    role="menuitem"
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })()}
        {activeFile === undefined ? (
          <div className="telos-editor-empty">
            <span className="telos-editor-empty-mark">T</span>
            <strong>打开文件开始编辑</strong>
            <span>从左侧工作区选择文件，聊天会话会持续保留在右侧。</span>
          </div>
        ) : (
          <div className="telos-editor-document">
            <div className="telos-editor-breadcrumb">
              <span>{activeFile.path}</span>
              <div className="telos-editor-breadcrumb-actions">
                {activeFile.undoChange !== undefined && activeFile.pendingChange === undefined && (
                  <button disabled={activeFile.saving || activeFile.content !== activeFile.savedContent} onClick={() => void undoExternalChange()} type="button">
                    {activeFile.undoChange.label}
                  </button>
                )}
                <button disabled={activeFile.saving || activeFile.pendingChange !== undefined || activeFile.content === activeFile.savedContent} onClick={() => void saveActiveFile()} type="button">
                  {activeFile.saving ? '保存中…' : '保存'}
                </button>
              </div>
            </div>
            {activeFile.pendingChange === undefined ? (
              <MonacoCodeEditor
                content={activeFile.content}
                onChange={updateActiveFile}
                onSave={() => void saveActiveFile()}
                onSelectionChange={setSelection}
                openPaths={files.map(file => file.path)}
                path={activeFile.path}
              />
            ) : (
              <div className="telos-editor-change-review">
                <div className="telos-editor-change-banner" data-conflict={activeFile.pendingChange.conflict || undefined}>
                  <div>
                    <strong>{activeFile.pendingChange.conflict ? '文件修改冲突' : '检测到外部文件修改'}</strong>
                    <span>{activeFile.pendingChange.conflict
                      ? 'Agent 或外部工具修改了磁盘，同时你还有未保存内容。请选择保留哪一版。'
                      : 'Agent 或外部工具已经修改磁盘。确认新版本，或恢复编辑器打开时的版本。'}</span>
                  </div>
                  <div className="telos-editor-change-actions">
                    <button disabled={activeFile.saving} onClick={acceptExternalChange} type="button">
                      {activeFile.pendingChange.conflict ? '使用磁盘版本' : '接受修改'}
                    </button>
                    <button className="telos-editor-change-primary" disabled={activeFile.saving} onClick={rejectExternalChange} type="button">
                      {activeFile.saving ? '处理中…' : activeFile.pendingChange.conflict ? '保留我的修改' : '拒绝并恢复'}
                    </button>
                  </div>
                </div>
                <MonacoDiffViewer
                  modified={activeFile.pendingChange.incoming.content}
                  original={activeFile.pendingChange.conflict ? activeFile.pendingChange.localContent : activeFile.pendingChange.baseContent}
                  path={activeFile.path}
                />
              </div>
            )}
            {activeFile.error !== undefined && <div className="telos-editor-save-error">{activeFile.error}</div>}
          </div>
        )}
      </main>
    </>
  )
}
