export const EDITOR_CONTEXT_SOURCE = 'telos-editor'

const REF_SEPARATOR = '\u001f'

export interface EditorSelectionContext {
  startLine: number
  endLine: number
  content: string
}

export interface EditorFileContext {
  sessionId: string
  path: string
  content: string
  revision: string
  selection?: EditorSelectionContext
}

type Listener = () => void

class EditorContextStore {
  private readonly contexts = new Map<string, EditorFileContext>()
  private readonly listeners = new Set<Listener>()

  get(sessionId: string): EditorFileContext | undefined {
    return this.contexts.get(sessionId)
  }

  publish(context: EditorFileContext): void {
    const current = this.contexts.get(context.sessionId)
    if (
      current?.path === context.path
      && current.content === context.content
      && current.revision === context.revision
      && current.selection?.startLine === context.selection?.startLine
      && current.selection?.endLine === context.selection?.endLine
      && current.selection?.content === context.selection?.content
    ) return
    this.contexts.set(context.sessionId, context)
    this.emit()
  }

  clear(sessionId: string, path?: string): void {
    const current = this.contexts.get(sessionId)
    if (current === undefined || (path !== undefined && current.path !== path)) return
    this.contexts.delete(sessionId)
    this.emit()
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

export const editorContextStore = new EditorContextStore()

export function editorContextRef(sessionId: string, path: string): string {
  return `${sessionId}${REF_SEPARATOR}${path}`
}

export function parseEditorContextRef(ref: string): { sessionId: string; path: string } | undefined {
  const separator = ref.indexOf(REF_SEPARATOR)
  if (separator <= 0 || separator === ref.length - 1) return undefined
  return { sessionId: ref.slice(0, separator), path: ref.slice(separator + 1) }
}

export function editorContextClipboardText(ref: string): string {
  const parsed = parseEditorContextRef(ref)
  return parsed === undefined ? '@file' : `@file:${encodeURIComponent(parsed.path)}`
}

export function resolveEditorContext(ref: string): EditorFileContext {
  const parsed = parseEditorContextRef(ref)
  if (parsed === undefined) throw new Error('编辑器上下文引用无效')
  const context = editorContextStore.get(parsed.sessionId)
  if (context === undefined || context.path !== parsed.path) {
    throw new Error(`编辑器上下文已失效：${parsed.path}`)
  }
  return context
}
