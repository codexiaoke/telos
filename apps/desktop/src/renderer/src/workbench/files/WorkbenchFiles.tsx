import { useCallback, useEffect, useMemo, useState } from 'react'
import { MaterialFileIcon } from './material-file-icons'
import { MonacoCodeEditor } from './MonacoCodeEditor'

const WORKBENCH_FILES_RPC_CHANNEL = '/telos-workbench-files'

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

  private async call<T>(endpoint: string, payload: unknown, signal?: AbortSignal): Promise<T> {
    const result = await this.rpc.call(WORKBENCH_FILES_RPC_CHANNEL, endpoint, payload, signal)
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
  const [tabContextMenu, setTabContextMenu] = useState<TabContextMenu>()
  const [error, setError] = useState<string>()
  const activeFile = files.find(file => file.path === activePath)

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
    if (sessionId === undefined) return
    const controller = new AbortController()
    void loadDirectory('', controller.signal)
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
      setActivePath(path)
      setError(undefined)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }, [client, files, sessionId])

  const updateActiveFile = useCallback((content: string) => {
    setFiles(current => current.map(file => file.path === activePath ? { ...file, content, error: undefined } : file))
  }, [activePath])

  const saveActiveFile = useCallback(async () => {
    if (activeFile === undefined || sessionId === undefined || activeFile.content === activeFile.savedContent) return
    setFiles(current => current.map(file => file.path === activeFile.path ? { ...file, saving: true, error: undefined } : file))
    try {
      const saved = await client.write(sessionId, activeFile)
      setFiles(current => current.map(file => file.path === activeFile.path ? {
        ...saved, savedContent: saved.content, saving: false,
      } : file))
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setFiles(current => current.map(file => file.path === activeFile.path ? { ...file, saving: false, error: message } : file))
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
                  <button onClick={() => setActivePath(file.path)} title={file.path} type="button">
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
              <button disabled={activeFile.saving || activeFile.content === activeFile.savedContent} onClick={() => void saveActiveFile()} type="button">
                {activeFile.saving ? '保存中…' : '保存'}
              </button>
            </div>
            <MonacoCodeEditor
              content={activeFile.content}
              onChange={updateActiveFile}
              onSave={() => void saveActiveFile()}
              openPaths={files.map(file => file.path)}
              path={activeFile.path}
            />
            {activeFile.error !== undefined && <div className="telos-editor-save-error">{activeFile.error}</div>}
          </div>
        )}
      </main>
    </>
  )
}
