import { useEffect, useSyncExternalStore } from 'react'
import {
  EDITOR_CONTEXT_SOURCE,
  editorContextClipboardText,
  editorContextRef,
  editorContextStore,
} from './editor-context'

interface OccurrenceView {
  source: string
  ref: string
  offset: number
}

interface InputView {
  draft: string
  draftRev: number
  phase: 'plain' | 'adjudicating' | 'claimed' | 'submitting'
  occurrences: readonly OccurrenceView[]
}

interface EditorContextBridgeProps {
  sessionId: string
  input: InputView
  inputActions: { setDraft(text: string): void }
  insertContext(reference: { source: string; ref: string; label: string; clipboardText: string }, span: {
    start: number
    end: number
    draftRev: number
  }): boolean
}

function basename(path: string): string {
  return path.split('/').at(-1) ?? path
}

function removeOccurrences(draft: string, occurrences: readonly OccurrenceView[]): string {
  const offsets = occurrences.map(item => item.offset).sort((left, right) => right - left)
  let next = draft
  for (const offset of offsets) next = next.slice(0, offset) + next.slice(offset + 1)
  return next
}

/** Keeps one model-serialized reference to the active editor file in the DSH composer. */
export function EditorContextBridge({ sessionId, input, inputActions, insertContext }: EditorContextBridgeProps) {
  const context = useSyncExternalStore(
    editorContextStore.subscribe,
    () => editorContextStore.get(sessionId),
    () => undefined,
  )

  useEffect(() => {
    if (input.phase !== 'plain') return
    const editorOccurrences = input.occurrences.filter(item => item.source === EDITOR_CONTEXT_SOURCE)
    const desiredRef = context === undefined ? undefined : editorContextRef(sessionId, context.path)
    const retained = desiredRef === undefined ? [] : editorOccurrences.filter(item => item.ref === desiredRef)
    const stale = editorOccurrences.filter(item => item.ref !== desiredRef)

    if (stale.length > 0 || retained.length > 1) {
      inputActions.setDraft(removeOccurrences(input.draft, [
        ...stale,
        ...retained.slice(1),
      ]))
      return
    }
    if (desiredRef === undefined || context === undefined || retained.length === 1) return

    const contextPath = context.path
    insertContext({
      source: EDITOR_CONTEXT_SOURCE,
      ref: desiredRef,
      label: basename(contextPath),
      clipboardText: editorContextClipboardText(desiredRef),
    }, { start: 0, end: 0, draftRev: input.draftRev })
  }, [context, input, inputActions, insertContext, sessionId])

  return null
}
