import { mkdtemp, mkdir, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Workspace } from '@deepseek-ai/dsh-workspace'
import { WorkspaceGroupService } from '../src/service.js'
import { WorkspaceGroupStore } from '../src/store.js'

const roots: string[] = []

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'telos-multi-root-'))
  roots.push(root)
  const frontend = join(root, 'frontend')
  const backend = join(root, 'backend')
  await mkdir(frontend)
  await mkdir(backend)
  const canonicalFrontend = await realpath(frontend)
  const canonicalBackend = await realpath(backend)
  const sessions = ['session-1'] as never[]
  let title = 'frontend'
  const workspace = {
    id: 'workspace-1', path: canonicalFrontend, createdAt: '', updatedAt: '', sessionIds: sessions,
    get title() { return title },
    setTitle(value: string) { title = value; return Promise.resolve() },
  } as unknown as Workspace
  const service = new WorkspaceGroupService({
    registry: {
      list: () => [workspace],
      get: (id: unknown) => String(id) === 'workspace-1' ? workspace : undefined,
      create: async (path: string) => {
        expect(path).toBe(canonicalFrontend)
        return workspace
      },
    } as never,
    directoryPicker: { capability: () => ({ kind: 'native', pick: async () => canonicalBackend }) } as never,
    store: new WorkspaceGroupStore(join(root, 'workspace-groups.json')),
  })
  return { frontend: canonicalFrontend, backend: canonicalBackend, service }
}

describe('WorkspaceGroupService', () => {
  it('migrates a DSH single-root workspace and keeps the DSH id stable', async () => {
    const { frontend, service } = await fixture()
    expect(service.groupForSession('session-1')).toMatchObject({
      workspaceId: 'workspace-1',
      title: 'frontend',
      roots: [{ label: basename(frontend), path: frontend, primary: true }],
    })
  })

  it('creates one logical workspace from frontend and backend folders', async () => {
    const { frontend, backend, service } = await fixture()
    await expect(service.create({ title: 'product', paths: [frontend, backend] })).resolves.toMatchObject({
      workspaceId: 'workspace-1',
      title: 'product',
      roots: [
        { id: 'frontend', path: frontend, primary: true },
        { id: 'backend', path: backend, primary: false },
      ],
    })
    expect(service.groupForSession('session-1')?.roots).toHaveLength(2)
  })

  it('does not remove the primary root and supports renaming an additional root', async () => {
    const { backend, service } = await fixture()
    const added = await service.addRoot({ workspaceId: 'workspace-1', path: backend })
    const extra = added.roots.find(root => !root.primary)!
    expect(() => service.removeRoot({ workspaceId: 'workspace-1', rootId: added.primaryRootId })).toThrow(/cannot be removed/u)
    expect(service.renameRoot({ workspaceId: 'workspace-1', rootId: extra.id, label: 'API' }).roots)
      .toContainEqual(expect.objectContaining({ id: extra.id, label: 'API' }))
  })
})
