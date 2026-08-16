import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { DirectoryFlowOwnerProps } from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { MultiRootWorkspaceClient } from './contracts.js'

export interface MultiRootDirectoryFlowInjected {
  controller: MultiRootWorkspaceClient
}

function folderName(path: string): string {
  return path.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? '新工作区'
}

export function MultiRootDirectoryFlow(
  props: DirectoryFlowOwnerProps & MultiRootDirectoryFlowInjected,
): ReactElement | null {
  const { open, busy: ownerBusy, controller, onCancel, onError, onPicked } = props
  const [paths, setPaths] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open && !wasOpen.current) {
      setPaths([])
      setTitle('')
      setError(undefined)
      setBusy(false)
    }
    wasOpen.current = open
  }, [open])

  if (!open) return null

  const addFolder = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const path = await controller.pickDirectory()
      if (path === null) return
      setPaths(current => current.includes(path) ? current : [...current, path])
      setTitle(current => current || folderName(path))
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setError(message)
      onError(message)
    } finally {
      setBusy(false)
    }
  }

  const create = async (): Promise<void> => {
    if (paths.length === 0) {
      setError('请至少添加一个文件夹')
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      const group = await controller.create({ title: title.trim() || undefined, paths })
      const primary = group.roots.find(root => root.primary)
      if (primary === undefined) throw new Error('工作区没有主文件夹')
      onPicked(primary.path)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  const disabled = busy || ownerBusy
  return (
    <div className="telosWorkspaceFlowBackdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !disabled) onCancel()
    }}>
      <section className="telosWorkspaceFlow" role="dialog" aria-modal="true" aria-labelledby="telosWorkspaceFlowTitle">
        <header>
          <div>
            <h2 id="telosWorkspaceFlowTitle">创建工作区</h2>
            <p>一个工作区可以由前端、后端、文档等多个文件夹组成。</p>
          </div>
          <button type="button" className="telosWorkspaceFlowClose" aria-label="关闭" disabled={disabled} onClick={onCancel}>×</button>
        </header>

        <label className="telosWorkspaceFlowName">
          <span>工作区名称</span>
          <input value={title} disabled={disabled} placeholder="例如：Telos" onChange={event => setTitle(event.target.value)} />
        </label>

        <div className="telosWorkspaceFlowRoots">
          <div className="telosWorkspaceFlowRootsTitle">
            <span>文件夹</span>
            <small>第一个文件夹是主目录，用于兼容 DSH Runtime</small>
          </div>
          {paths.length === 0 ? (
            <button type="button" className="telosWorkspaceFlowEmpty" disabled={disabled} onClick={() => void addFolder()}>
              <strong>＋ 添加第一个文件夹</strong>
              <span>选择 Telos 可以读取和编辑的本地目录</span>
            </button>
          ) : (
            <div className="telosWorkspaceFlowRootList">
              {paths.map((path, index) => (
                <div className="telosWorkspaceFlowRoot" key={path}>
                  <span className="telosWorkspaceFlowFolderIcon">▱</span>
                  <span><strong>{folderName(path)}</strong><small>{path}</small></span>
                  {index === 0 && <em>主目录</em>}
                  <button type="button" aria-label={`移除 ${folderName(path)}`} disabled={disabled}
                    onClick={() => setPaths(current => current.filter(value => value !== path))}>移除</button>
                </div>
              ))}
              <button type="button" className="telosWorkspaceFlowAdd" disabled={disabled} onClick={() => void addFolder()}>＋ 添加文件夹</button>
            </div>
          )}
        </div>

        {error !== undefined && <p className="telosWorkspaceFlowError" role="alert">{error}</p>}
        <footer>
          <button type="button" disabled={disabled} onClick={onCancel}>取消</button>
          <button type="button" data-primary disabled={disabled || paths.length === 0} onClick={() => void create()}>
            {busy ? '处理中…' : '创建工作区'}
          </button>
        </footer>
      </section>
    </div>
  )
}
