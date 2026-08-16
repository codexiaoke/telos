import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { WorkspaceGroupRecord, WorkspaceRoot } from './contracts.js'

interface StoreDocument {
  schemaVersion: 1
  workspaces: WorkspaceGroupRecord[]
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`)
  }
  return value as Record<string, unknown>
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`)
  return value.trim()
}

function root(value: unknown, field: string): WorkspaceRoot {
  const input = object(value, field)
  if (typeof input.primary !== 'boolean') throw new TypeError(`${field}.primary must be a boolean`)
  return {
    id: text(input.id, `${field}.id`),
    label: text(input.label, `${field}.label`),
    path: text(input.path, `${field}.path`),
    primary: input.primary,
  }
}

export function parseWorkspaceGroupRecord(value: unknown, field = 'workspace'): WorkspaceGroupRecord {
  const input = object(value, field)
  if (!Array.isArray(input.roots) || input.roots.length === 0) throw new TypeError(`${field}.roots must be a non-empty array`)
  const roots = input.roots.map((entry, index) => root(entry, `${field}.roots[${String(index)}]`))
  const ids = roots.map(entry => entry.id)
  if (new Set(ids).size !== ids.length) throw new TypeError(`${field}.roots contains duplicate ids`)
  const labels = roots.map(entry => entry.label.toLocaleLowerCase())
  if (new Set(labels).size !== labels.length) throw new TypeError(`${field}.roots contains duplicate labels`)
  const paths = roots.map(entry => entry.path)
  if (new Set(paths).size !== paths.length) throw new TypeError(`${field}.roots contains duplicate paths`)
  const primaryRootId = text(input.primaryRootId, `${field}.primaryRootId`)
  if (roots.filter(entry => entry.primary).length !== 1 || !roots.some(entry => entry.id === primaryRootId && entry.primary)) {
    throw new TypeError(`${field} must identify exactly one primary root`)
  }
  return {
    workspaceId: text(input.workspaceId, `${field}.workspaceId`),
    primaryRootId,
    roots,
    updatedAt: text(input.updatedAt, `${field}.updatedAt`),
  }
}

export class WorkspaceGroupStore {
  constructor(readonly path: string) {}

  load(): WorkspaceGroupRecord[] {
    let raw: string
    try {
      raw = readFileSync(this.path, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
    const document = object(JSON.parse(raw), 'document')
    if (document.schemaVersion !== 1 || !Array.isArray(document.workspaces)) {
      throw new TypeError('unsupported multi-root workspace store schema')
    }
    const workspaces = document.workspaces.map((entry, index) => parseWorkspaceGroupRecord(entry, `workspaces[${String(index)}]`))
    if (new Set(workspaces.map(entry => entry.workspaceId)).size !== workspaces.length) {
      throw new TypeError('multi-root workspace store contains duplicate workspace ids')
    }
    return workspaces
  }

  save(workspaces: readonly WorkspaceGroupRecord[]): void {
    const validated = workspaces.map((entry, index) => parseWorkspaceGroupRecord(entry, `workspaces[${String(index)}]`))
    if (new Set(validated.map(entry => entry.workspaceId)).size !== validated.length) {
      throw new TypeError('workspaceId must be unique')
    }
    const document: StoreDocument = { schemaVersion: 1, workspaces: validated }
    mkdirSync(dirname(this.path), { recursive: true })
    const temporary = `${this.path}.${String(process.pid)}.tmp`
    writeFileSync(temporary, `${JSON.stringify(document, null, 2)}\n`, { mode: 0o600 })
    try {
      renameSync(temporary, this.path)
    } catch {
      rmSync(this.path, { force: true })
      renameSync(temporary, this.path)
    }
  }
}
