import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { WorkspaceGroupStore, parseWorkspaceGroupRecord } from '../src/store.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function record() {
  return {
    workspaceId: 'workspace-1',
    primaryRootId: 'frontend',
    roots: [
      { id: 'frontend', label: 'frontend', path: '/project/frontend', primary: true },
      { id: 'backend', label: 'backend', path: '/project/backend', primary: false },
    ],
    updatedAt: '2026-08-16T00:00:00.000Z',
  }
}

describe('WorkspaceGroupStore', () => {
  it('round-trips a multi-root workspace with private file permissions', () => {
    const root = mkdtempSync(join(tmpdir(), 'telos-multi-root-store-'))
    roots.push(root)
    const path = join(root, 'workspace-groups.json')
    const store = new WorkspaceGroupStore(path)
    store.save([record()])
    expect(store.load()).toEqual([record()])
    expect(readFileSync(path, 'utf8')).toContain('"schemaVersion": 1')
  })

  it('rejects duplicate labels and an invalid primary root', () => {
    expect(() => parseWorkspaceGroupRecord({
      ...record(),
      roots: [
        { id: 'a', label: 'shared', path: '/a', primary: true },
        { id: 'b', label: 'SHARED', path: '/b', primary: false },
      ],
      primaryRootId: 'a',
    })).toThrow(/duplicate labels/u)
    expect(() => parseWorkspaceGroupRecord({ ...record(), primaryRootId: 'missing' })).toThrow(/exactly one primary/u)
  })
})
