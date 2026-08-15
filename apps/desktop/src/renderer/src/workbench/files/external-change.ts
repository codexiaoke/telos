export interface VersionedTextFile {
  path: string
  content: string
  revision: string
  mtimeMs: number
  size: number
}

export interface EditableFileSnapshot extends VersionedTextFile {
  savedContent: string
}

export interface ExternalFileChange {
  baseContent: string
  localContent: string
  incoming: VersionedTextFile
  conflict: boolean
}

export function detectExternalFileChange(
  file: EditableFileSnapshot,
  disk: VersionedTextFile,
  pending?: ExternalFileChange,
): ExternalFileChange | undefined {
  if (disk.revision === file.revision || disk.revision === pending?.incoming.revision) return undefined
  return {
    baseContent: pending?.baseContent ?? file.savedContent,
    localContent: file.content,
    incoming: disk,
    conflict: file.content !== file.savedContent,
  }
}
