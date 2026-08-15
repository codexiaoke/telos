import { describe, expect, it } from 'vitest'
import { detectExternalFileChange, type EditableFileSnapshot, type VersionedTextFile } from './external-change'

const local: EditableFileSnapshot = {
  path: 'src/app.ts',
  content: 'before',
  savedContent: 'before',
  revision: 'revision-1',
  mtimeMs: 1,
  size: 6,
}

function disk(content: string, revision: string): VersionedTextFile {
  return { path: local.path, content, revision, mtimeMs: 2, size: content.length }
}

describe('external file change detection', () => {
  it('ignores the version already represented by the editor', () => {
    expect(detectExternalFileChange(local, disk('before', 'revision-1'))).toBeUndefined()
  })

  it('creates a reviewable change for a clean editor buffer', () => {
    expect(detectExternalFileChange(local, disk('after', 'revision-2'))).toEqual({
      baseContent: 'before',
      localContent: 'before',
      incoming: disk('after', 'revision-2'),
      conflict: false,
    })
  })

  it('marks concurrent local edits as a conflict', () => {
    const dirty = { ...local, content: 'my unsaved edit' }
    expect(detectExternalFileChange(dirty, disk('agent edit', 'revision-2'))?.conflict).toBe(true)
  })

  it('does not repeatedly report an unchanged pending disk version', () => {
    const incoming = disk('agent edit', 'revision-2')
    const pending = detectExternalFileChange(local, incoming)
    expect(detectExternalFileChange(local, incoming, pending)).toBeUndefined()
  })
})
