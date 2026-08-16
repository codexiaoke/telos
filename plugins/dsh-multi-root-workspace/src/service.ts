import { randomUUID } from 'node:crypto'
import { realpath, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type { DirectoryPicker } from '@deepseek-ai/dsh-host-directory-picker'
import type { Workspace, WorkspaceRegistry } from '@deepseek-ai/dsh-workspace'
import type {
  CreateWorkspaceGroupInput,
  WorkspaceGroup,
  WorkspaceGroupRecord,
  WorkspaceRoot,
} from './contracts.js'
import { WorkspaceGroupStore } from './store.js'

const MAX_ROOTS = 32
const ROOT_ID = /^[A-Za-z0-9._-]{1,64}$/u

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`)
  return value.trim()
}

function requiredObject(value: unknown, field = 'payload'): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`)
  return value as Record<string, unknown>
}

function aliasBase(path: string): string {
  const value = basename(path).normalize('NFKC').replaceAll(/[^A-Za-z0-9._-]+/gu, '-').replaceAll(/^-+|-+$/gu, '')
  return (value || 'root').slice(0, 48)
}

function uniqueAlias(path: string, roots: readonly WorkspaceRoot[]): string {
  const base = aliasBase(path)
  const used = new Set(roots.map(root => root.id.toLocaleLowerCase()))
  if (!used.has(base.toLocaleLowerCase())) return base
  for (let index = 2; index < 10_000; index++) {
    const candidate = `${base}-${String(index)}`
    if (!used.has(candidate.toLocaleLowerCase())) return candidate
  }
  return randomUUID()
}

function uniqueLabel(path: string, roots: readonly WorkspaceRoot[]): string {
  const base = basename(path) || '文件夹'
  const used = new Set(roots.map(root => root.label.toLocaleLowerCase()))
  if (!used.has(base.toLocaleLowerCase())) return base
  for (let index = 2; index < 10_000; index++) {
    const candidate = `${base} ${String(index)}`
    if (!used.has(candidate.toLocaleLowerCase())) return candidate
  }
  return randomUUID()
}

async function canonicalDirectory(path: string): Promise<string> {
  const canonical = await realpath(requiredText(path, 'path'))
  if (!(await stat(canonical)).isDirectory()) throw new TypeError(`path is not a directory: ${canonical}`)
  return canonical
}

export interface WorkspaceGroupServiceOptions {
  registry: Pick<WorkspaceRegistry, 'create' | 'get' | 'list'>
  directoryPicker: Pick<DirectoryPicker, 'capability'>
  store: WorkspaceGroupStore
}

export class WorkspaceGroupService {
  private records: WorkspaceGroupRecord[]

  constructor(private readonly options: WorkspaceGroupServiceOptions) {
    this.records = options.store.load()
  }

  list(): WorkspaceGroup[] {
    return this.options.registry.list().map(workspace => this.ensure(workspace))
  }

  groupForWorkspaceId(workspaceId: string): WorkspaceGroup | undefined {
    const workspace = this.options.registry.get(workspaceId as never)
    return workspace === undefined ? undefined : this.ensure(workspace)
  }

  groupForSession(sessionId: string): WorkspaceGroup | undefined {
    const workspace = this.options.registry.list().find(candidate => candidate.sessionIds.some(id => String(id) === sessionId))
    return workspace === undefined ? undefined : this.ensure(workspace)
  }

  async pickDirectory(signal = new AbortController().signal): Promise<string | null> {
    const capability = this.options.directoryPicker.capability()
    if (capability.kind !== 'native') throw new Error('当前工作区插件需要本机目录选择器')
    return capability.pick(signal)
  }

  async create(inputValue: unknown): Promise<WorkspaceGroup> {
    const input = this.parseCreate(inputValue)
    const canonical: string[] = []
    for (const path of input.paths) {
      const resolved = await canonicalDirectory(path)
      if (!canonical.includes(resolved)) canonical.push(resolved)
    }
    if (canonical.length === 0) throw new TypeError('paths must contain at least one directory')
    if (canonical.length > MAX_ROOTS) throw new RangeError(`a workspace supports at most ${String(MAX_ROOTS)} roots`)
    const workspace = await this.options.registry.create(canonical[0]!)
    if (input.title !== undefined && workspace.title !== input.title) await workspace.setTitle(input.title)
    let group = this.ensure(workspace)
    for (const path of canonical.slice(1)) group = await this.addRootInternal(workspace, group, path)
    return { ...group, title: workspace.title }
  }

  async addRoot(payload: unknown): Promise<WorkspaceGroup> {
    const input = requiredObject(payload)
    const workspace = this.requireWorkspace(requiredText(input.workspaceId, 'workspaceId'))
    const group = this.ensure(workspace)
    return this.addRootInternal(workspace, group, await canonicalDirectory(requiredText(input.path, 'path')), input.label)
  }

  removeRoot(payload: unknown): WorkspaceGroup {
    const input = requiredObject(payload)
    const workspace = this.requireWorkspace(requiredText(input.workspaceId, 'workspaceId'))
    const rootId = requiredText(input.rootId, 'rootId')
    const group = this.ensure(workspace)
    if (rootId === group.primaryRootId) throw new TypeError('the primary workspace root cannot be removed')
    if (!group.roots.some(root => root.id === rootId)) throw new TypeError(`unknown workspace root: ${rootId}`)
    return this.commit(workspace, {
      ...group,
      roots: group.roots.filter(root => root.id !== rootId),
      updatedAt: new Date().toISOString(),
    })
  }

  renameRoot(payload: unknown): WorkspaceGroup {
    const input = requiredObject(payload)
    const workspace = this.requireWorkspace(requiredText(input.workspaceId, 'workspaceId'))
    const rootId = requiredText(input.rootId, 'rootId')
    const label = requiredText(input.label, 'label')
    const group = this.ensure(workspace)
    if (!group.roots.some(root => root.id === rootId)) throw new TypeError(`unknown workspace root: ${rootId}`)
    if (group.roots.some(root => root.id !== rootId && root.label.toLocaleLowerCase() === label.toLocaleLowerCase())) {
      throw new TypeError(`workspace root label already exists: ${label}`)
    }
    return this.commit(workspace, {
      ...group,
      roots: group.roots.map(root => root.id === rootId ? { ...root, label } : root),
      updatedAt: new Date().toISOString(),
    })
  }

  handle(endpoint: string, payload: unknown, signal?: AbortSignal): WorkspaceGroup | WorkspaceGroup[] | string | null | Promise<WorkspaceGroup | string | null> {
    if (endpoint === 'list') return this.list()
    if (endpoint === 'get-session') {
      const input = requiredObject(payload)
      const group = this.groupForSession(requiredText(input.sessionId, 'sessionId'))
      if (group === undefined) throw new TypeError('session is not attached to a registered workspace')
      return group
    }
    if (endpoint === 'pick-directory') return this.pickDirectory(signal)
    if (endpoint === 'create') return this.create(payload)
    if (endpoint === 'add-root') return this.addRoot(payload)
    if (endpoint === 'remove-root') return this.removeRoot(payload)
    if (endpoint === 'rename-root') return this.renameRoot(payload)
    throw new TypeError(`unknown multi-root workspace endpoint: ${endpoint}`)
  }

  private ensure(workspace: Workspace): WorkspaceGroup {
    const workspaceId = String(workspace.id)
    const existing = this.records.find(record => record.workspaceId === workspaceId)
    if (existing !== undefined) {
      const primary = existing.roots.find(root => root.id === existing.primaryRootId)
      if (primary?.path === workspace.path && primary.primary) return this.view(workspace, existing)
    }
    const roots = existing?.roots.filter(root => !root.primary && root.path !== workspace.path) ?? []
    const primaryRoot: WorkspaceRoot = {
      id: uniqueAlias(workspace.path, roots),
      label: uniqueLabel(workspace.path, roots),
      path: workspace.path,
      primary: true,
    }
    const record: WorkspaceGroupRecord = {
      workspaceId,
      primaryRootId: primaryRoot.id,
      roots: [primaryRoot, ...roots],
      updatedAt: new Date().toISOString(),
    }
    this.upsert(record)
    return this.view(workspace, record)
  }

  private async addRootInternal(workspace: Workspace, group: WorkspaceGroup, path: string, labelValue?: unknown): Promise<WorkspaceGroup> {
    if (group.roots.some(root => root.path === path)) return group
    if (group.roots.length >= MAX_ROOTS) throw new RangeError(`a workspace supports at most ${String(MAX_ROOTS)} roots`)
    const label = labelValue === undefined ? uniqueLabel(path, group.roots) : requiredText(labelValue, 'label')
    if (group.roots.some(root => root.label.toLocaleLowerCase() === label.toLocaleLowerCase())) {
      throw new TypeError(`workspace root label already exists: ${label}`)
    }
    const root: WorkspaceRoot = { id: uniqueAlias(path, group.roots), label, path, primary: false }
    return this.commit(workspace, { ...group, roots: [...group.roots, root], updatedAt: new Date().toISOString() })
  }

  private commit(workspace: Workspace, group: WorkspaceGroup): WorkspaceGroup {
    const record: WorkspaceGroupRecord = {
      workspaceId: group.workspaceId,
      primaryRootId: group.primaryRootId,
      roots: group.roots,
      updatedAt: group.updatedAt,
    }
    this.upsert(record)
    return this.view(workspace, record)
  }

  private upsert(record: WorkspaceGroupRecord): void {
    const index = this.records.findIndex(candidate => candidate.workspaceId === record.workspaceId)
    this.records = index === -1
      ? [...this.records, record]
      : this.records.map((candidate, position) => position === index ? record : candidate)
    this.options.store.save(this.records)
  }

  private view(workspace: Workspace, record: WorkspaceGroupRecord): WorkspaceGroup {
    return { ...record, title: workspace.title, roots: record.roots.map(root => ({ ...root })) }
  }

  private requireWorkspace(workspaceId: string): Workspace {
    const workspace = this.options.registry.get(workspaceId as never)
    if (workspace === undefined) throw new TypeError(`unknown workspace: ${workspaceId}`)
    return workspace
  }

  private parseCreate(value: unknown): CreateWorkspaceGroupInput {
    const input = requiredObject(value)
    if (!Array.isArray(input.paths)) throw new TypeError('paths must be an array')
    const paths = input.paths.map((path, index) => requiredText(path, `paths[${String(index)}]`))
    const title = input.title === undefined || input.title === '' ? undefined : requiredText(input.title, 'title')
    return { paths, ...(title === undefined ? {} : { title }) }
  }
}

export function isWorkspaceRootId(value: string): boolean {
  return ROOT_ID.test(value)
}
