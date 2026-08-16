import { copyFile, readFile, readdir, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import type {
  WorkbenchDirectoryView,
  WorkbenchEditorContext,
  WorkbenchEditorSelection,
  WorkbenchTextFile,
  WorkbenchWorkspaceRoot,
} from './contracts.js'

export interface WorkspaceFileServiceOptions {
  rootsForSession: (sessionId: string) => readonly WorkbenchWorkspaceRoot[] | undefined
  maxEntries?: number
  maxFileBytes?: number
}

const DEFAULT_MAX_ENTRIES = 1_000
const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`)
  return value
}

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

function toWorkspacePath(root: string, target: string): string {
  return relative(root, target).split(sep).join('/')
}

function qualifiedPath(rootId: string, relativePath: string): string {
  return relativePath === '' ? `${rootId}:` : `${rootId}:/${relativePath}`
}

function revisionOf(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex')
}

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined
}

export class WorkspaceFileService {
  private readonly maxEntries: number
  private readonly maxFileBytes: number
  private readonly editorContexts = new Map<string, WorkbenchEditorContext>()

  constructor(private readonly options: WorkspaceFileServiceOptions) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
    this.maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES
  }

  async list(payload: unknown): Promise<WorkbenchDirectoryView> {
    const request = this.parsePathRequest(payload)
    if (request.path === '') {
      const roots = this.requireRoots(request.sessionId)
      return {
        path: '',
        entries: roots.map(root => ({
          name: root.label,
          path: `${root.id}:`,
          kind: 'directory',
          hidden: false,
        })),
        truncated: false,
      }
    }
    const { rootId, root, target } = await this.resolveExisting(request.sessionId, request.path)
    const targetStat = await stat(target)
    if (!targetStat.isDirectory()) throw new TypeError('path must identify a directory')
    const rows = await readdir(target, { withFileTypes: true })
    const entries: WorkbenchDirectoryView['entries'] = []
    for (const row of rows) {
      if (entries.length >= this.maxEntries) break
      const candidate = resolve(target, row.name)
      let resolved: string
      try { resolved = await realpath(candidate) } catch { continue }
      if (!isInside(root, resolved)) continue
      let kind: 'directory' | 'file'
      if (row.isDirectory()) kind = 'directory'
      else if (row.isFile()) kind = 'file'
      else if (row.isSymbolicLink()) {
        const linked = await stat(resolved)
        if (linked.isDirectory()) kind = 'directory'
        else if (linked.isFile()) kind = 'file'
        else continue
      } else continue
      entries.push({ name: row.name, path: qualifiedPath(rootId, toWorkspacePath(root, resolved)), kind, hidden: row.name.startsWith('.') })
    }
    entries.sort((left, right) => left.kind === right.kind
      ? left.name.localeCompare(right.name)
      : left.kind === 'directory' ? -1 : 1)
    return { path: qualifiedPath(rootId, toWorkspacePath(root, target)), entries, truncated: rows.length > this.maxEntries }
  }

  async read(payload: unknown): Promise<WorkbenchTextFile> {
    const request = this.parsePathRequest(payload)
    const { rootId, root, target } = await this.resolveExisting(request.sessionId, request.path)
    const metadata = await stat(target)
    if (!metadata.isFile()) throw new TypeError('path must identify a file')
    if (metadata.size > this.maxFileBytes) throw Object.assign(new Error('file exceeds the workbench preview limit'), { code: 'file-too-large' })
    const buffer = await readFile(target)
    if (buffer.includes(0)) throw Object.assign(new Error('binary files cannot be opened in the text editor'), { code: 'binary-file' })
    return {
      path: qualifiedPath(rootId, toWorkspacePath(root, target)),
      content: buffer.toString('utf8'),
      revision: revisionOf(buffer),
      mtimeMs: metadata.mtimeMs,
      size: metadata.size,
    }
  }

  async write(payload: unknown): Promise<WorkbenchTextFile> {
    if (typeof payload !== 'object' || payload === null) throw new TypeError('payload must be an object')
    const input = payload as Record<string, unknown>
    const sessionId = requiredString(input.sessionId, 'sessionId')
    const path = requiredString(input.path, 'path')
    if (typeof input.content !== 'string') throw new TypeError('content must be a string')
    const expectedRevision = requiredString(input.expectedRevision, 'expectedRevision')
    const bytes = Buffer.byteLength(input.content)
    if (bytes > this.maxFileBytes) throw Object.assign(new Error('file exceeds the workbench save limit'), { code: 'file-too-large' })
    const { target } = await this.resolveExisting(sessionId, path)
    const metadata = await stat(target)
    if (!metadata.isFile()) throw new TypeError('path must identify a file')
    const current = await readFile(target)
    if (revisionOf(current) !== expectedRevision) {
      throw Object.assign(new Error('file changed on disk; reopen it before saving'), { code: 'conflict' })
    }
    const temporary = resolve(dirname(target), `.${basename(target)}.${randomUUID()}.telos-tmp`)
    try {
      await writeFile(temporary, input.content, { mode: metadata.mode })
      try {
        await rename(temporary, target)
      } catch (error) {
        if (errorCode(error) !== 'EEXIST' && errorCode(error) !== 'EPERM') throw error
        const latest = await readFile(target)
        if (revisionOf(latest) !== expectedRevision) {
          throw Object.assign(new Error('file changed on disk; reopen it before saving'), { code: 'conflict' })
        }
        await copyFile(temporary, target)
        await unlink(temporary)
      }
    } catch (error) {
      try { await unlink(temporary) } catch { /* no temporary artifact to remove */ }
      throw error
    }
    return this.read({ sessionId, path })
  }

  async stageContext(payload: unknown): Promise<WorkbenchEditorContext> {
    if (typeof payload !== 'object' || payload === null) throw new TypeError('payload must be an object')
    const input = payload as Record<string, unknown>
    const sessionId = requiredString(input.sessionId, 'sessionId')
    const path = requiredString(input.path, 'path')
    if (typeof input.content !== 'string') throw new TypeError('content must be a string')
    const content = input.content
    const revision = requiredString(input.revision, 'revision')
    if (Buffer.byteLength(content) > this.maxFileBytes) throw Object.assign(new Error('editor context exceeds the workbench limit'), { code: 'file-too-large' })
    const { configuredRoot, rootId, root, target } = await this.resolveExisting(sessionId, path)
    const canonicalPath = qualifiedPath(rootId, toWorkspacePath(root, target))
    const relativePath = toWorkspacePath(root, target)
    const selection = this.parseSelection(input.selection)
    const context: WorkbenchEditorContext = {
      sessionId,
      path: canonicalPath,
      toolPath: configuredRoot.primary ? relativePath : canonicalPath,
      content,
      revision,
      ...(selection === undefined ? {} : { selection }),
    }
    const key = this.contextKey(sessionId, canonicalPath)
    this.editorContexts.delete(key)
    this.editorContexts.set(key, context)
    while (this.editorContexts.size > 64) {
      const oldestKey = this.editorContexts.keys().next().value
      if (oldestKey === undefined) break
      this.editorContexts.delete(oldestKey)
    }
    return context
  }

  editorContext(sessionId: string, path: string): WorkbenchEditorContext | undefined {
    return this.editorContexts.get(this.contextKey(sessionId, path))
  }

  private parsePathRequest(payload: unknown): { sessionId: string; path: string } {
    if (typeof payload !== 'object' || payload === null) throw new TypeError('payload must be an object')
    const input = payload as Record<string, unknown>
    const sessionId = requiredString(input.sessionId, 'sessionId')
    const path = input.path === undefined ? '' : typeof input.path === 'string' ? input.path : requiredString(input.path, 'path')
    return { sessionId, path }
  }

  private parseSelection(value: unknown): WorkbenchEditorSelection | undefined {
    if (value === undefined) return undefined
    if (typeof value !== 'object' || value === null) throw new TypeError('selection must be an object')
    const input = value as Record<string, unknown>
    if (!Number.isSafeInteger(input.startLine) || (input.startLine as number) < 1) throw new TypeError('selection.startLine must be a positive integer')
    if (!Number.isSafeInteger(input.endLine) || (input.endLine as number) < (input.startLine as number)) throw new TypeError('selection.endLine must not precede startLine')
    const content = requiredString(input.content, 'selection.content')
    if (Buffer.byteLength(content) > this.maxFileBytes) throw Object.assign(new Error('editor selection exceeds the workbench limit'), { code: 'file-too-large' })
    return { startLine: input.startLine as number, endLine: input.endLine as number, content }
  }

  private contextKey(sessionId: string, path: string): string {
    return `${sessionId}\u001f${path}`
  }

  private requireRoots(sessionId: string): readonly WorkbenchWorkspaceRoot[] {
    const roots = this.options.rootsForSession(sessionId)
    if (roots === undefined || roots.length === 0) {
      throw Object.assign(new Error('session is not attached to a registered workspace'), { code: 'workspace-unavailable' })
    }
    return roots
  }

  private parseQualifiedPath(sessionId: string, workspacePath: string): { configuredRoot: WorkbenchWorkspaceRoot; relativePath: string } {
    const match = /^([^/:]+):(?:\/(.*))?$/u.exec(workspacePath)
    if (match === null) throw Object.assign(new Error('path must include a workspace root id'), { code: 'path-forbidden' })
    const rootId = match[1] as string
    const configuredRoot = this.requireRoots(sessionId).find(root => root.id === rootId)
    if (configuredRoot === undefined) throw Object.assign(new Error(`unknown workspace root: ${rootId}`), { code: 'path-forbidden' })
    return { configuredRoot, relativePath: match[2] ?? '' }
  }

  private async resolveExisting(sessionId: string, workspacePath: string): Promise<{
    configuredRoot: WorkbenchWorkspaceRoot
    rootId: string
    root: string
    target: string
  }> {
    const { configuredRoot, relativePath } = this.parseQualifiedPath(sessionId, workspacePath)
    const root = await realpath(configuredRoot.path)
    const targetSpelling = resolve(root, relativePath)
    if (!isInside(root, targetSpelling)) throw Object.assign(new Error('path escapes the current workspace'), { code: 'path-forbidden' })
    const target = await realpath(targetSpelling)
    if (!isInside(root, target)) throw Object.assign(new Error('resolved path escapes the current workspace'), { code: 'path-forbidden' })
    return { configuredRoot, rootId: configuredRoot.id, root, target }
  }
}
