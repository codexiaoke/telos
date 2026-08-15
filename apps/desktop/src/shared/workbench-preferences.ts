export interface EditorPanelPreferences {
  files: number
  conversation: number
}

export const EDITOR_FILES_MIN = 180
export const EDITOR_FILES_MAX = 520
export const EDITOR_FILES_DEFAULT = 260
export const EDITOR_CONVERSATION_MIN = 300
export const EDITOR_CONVERSATION_MAX = 720
export const EDITOR_CONVERSATION_DEFAULT = 380

export function validateEditorPanelPreferences(value: unknown): EditorPanelPreferences | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.files !== 'number'
    || !Number.isFinite(candidate.files)
    || typeof candidate.conversation !== 'number'
    || !Number.isFinite(candidate.conversation)
  ) return undefined

  return {
    files: Math.min(EDITOR_FILES_MAX, Math.max(EDITOR_FILES_MIN, Math.round(candidate.files))),
    conversation: Math.min(
      EDITOR_CONVERSATION_MAX,
      Math.max(EDITOR_CONVERSATION_MIN, Math.round(candidate.conversation)),
    ),
  }
}
