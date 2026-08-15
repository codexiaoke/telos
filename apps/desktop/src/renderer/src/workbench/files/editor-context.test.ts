import { afterEach, describe, expect, it } from 'vitest'
import {
  editorContextClipboardText,
  editorContextRef,
  editorContextStore,
  parseEditorContextRef,
  resolveEditorContext,
} from './editor-context'

const sessions = new Set<string>()

function publish(path: string, content: string, selection?: { startLine: number; endLine: number; content: string }) {
  const sessionId = `session-${String(sessions.size + 1)}`
  sessions.add(sessionId)
  editorContextStore.publish({ sessionId, path, content, revision: 'rev-1', ...(selection === undefined ? {} : { selection }) })
  return editorContextRef(sessionId, path)
}

afterEach(() => {
  for (const sessionId of sessions) editorContextStore.clear(sessionId)
  sessions.clear()
})

describe('editor context serialization', () => {
  it('round-trips the session and path reference', () => {
    const ref = editorContextRef('session-a', 'src/你好.ts')
    expect(parseEditorContextRef(ref)).toEqual({ sessionId: 'session-a', path: 'src/你好.ts' })
    expect(editorContextClipboardText(ref)).toBe('@file:src%2F%E4%BD%A0%E5%A5%BD.ts')
  })

  it('resolves the current buffer for Host-side staging', () => {
    const ref = publish('src/app.ts', 'export const answer = 42\n')
    expect(resolveEditorContext(ref)).toMatchObject({
      path: 'src/app.ts', revision: 'rev-1', content: 'export const answer = 42\n',
    })
  })

  it('uses the current selection when one exists', () => {
    const ref = publish('src/app.ts', 'line 1\nline 2\nline 3', { startLine: 2, endLine: 2, content: 'line 2' })
    expect(resolveEditorContext(ref).selection).toEqual({ startLine: 2, endLine: 2, content: 'line 2' })
  })

  it('refuses a stale reference instead of silently sending the wrong file', () => {
    const ref = editorContextRef('missing-session', 'src/missing.ts')
    expect(() => resolveEditorContext(ref)).toThrow('编辑器上下文已失效')
  })
})
