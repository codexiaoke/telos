import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { rmSync } from 'node:fs'
import { WorkspaceFileService } from '../src/service.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'telos-workbench-'))
  roots.push(root)
  await mkdir(join(root, 'src'))
  await writeFile(join(root, 'src', 'index.ts'), 'export const telos = true\n')
  await writeFile(join(root, 'README.md'), '# Telos\n')
  return {
    root,
    service: new WorkspaceFileService({
      rootsForSession: id => id === 'session'
        ? [{ id: 'telos', label: 'telos', path: root, primary: true }]
        : undefined,
    }),
  }
}

describe('WorkspaceFileService', () => {
  it('projects multiple registered roots into one virtual file tree', async () => {
    const { root } = await fixture()
    const backend = await mkdtemp(join(tmpdir(), 'telos-backend-'))
    roots.push(backend)
    await writeFile(join(backend, 'server.ts'), 'export const api = true\n')
    const service = new WorkspaceFileService({
      rootsForSession: () => [
        { id: 'frontend', label: 'Web', path: root, primary: true },
        { id: 'backend', label: 'API', path: backend, primary: false },
      ],
    })

    await expect(service.list({ sessionId: 'session', path: '' })).resolves.toMatchObject({
      entries: [
        { name: 'Web', path: 'frontend:', kind: 'directory' },
        { name: 'API', path: 'backend:', kind: 'directory' },
      ],
    })
    await expect(service.read({ sessionId: 'session', path: 'backend:/server.ts' })).resolves.toMatchObject({
      path: 'backend:/server.ts', content: 'export const api = true\n',
    })
    await expect(service.stageContext({
      sessionId: 'session', path: 'backend:/server.ts', content: 'buffer', revision: 'editor-revision',
    })).resolves.toMatchObject({ path: 'backend:/server.ts', toolPath: 'backend:/server.ts' })
  })

  it('lists directories first and reads workspace-relative text files', async () => {
    const { service } = await fixture()
    await expect(service.list({ sessionId: 'session', path: '' })).resolves.toMatchObject({
      path: '',
      entries: [{ name: 'telos', path: 'telos:', kind: 'directory' }],
    })
    await expect(service.list({ sessionId: 'session', path: 'telos:' })).resolves.toMatchObject({
      path: 'telos:',
      entries: [
        { name: 'src', path: 'telos:/src', kind: 'directory' },
        { name: 'README.md', path: 'telos:/README.md', kind: 'file' },
      ],
    })
    await expect(service.read({ sessionId: 'session', path: 'telos:/src/index.ts' })).resolves.toMatchObject({
      path: 'telos:/src/index.ts', content: 'export const telos = true\n',
    })
  })

  it('rejects traversal and symlinks that leave the registered workspace', async () => {
    const { root, service } = await fixture()
    const outside = await mkdtemp(join(tmpdir(), 'telos-outside-'))
    roots.push(outside)
    await writeFile(join(outside, 'secret.txt'), 'secret')
    await symlink(outside, join(root, 'escape'))
    await expect(service.read({ sessionId: 'session', path: 'telos:/../secret.txt' })).rejects.toMatchObject({ code: 'path-forbidden' })
    await expect(service.read({ sessionId: 'session', path: 'telos:/escape/secret.txt' })).rejects.toMatchObject({ code: 'path-forbidden' })
  })

  it('saves only against the exact file revision', async () => {
    const { root, service } = await fixture()
    const opened = await service.read({ sessionId: 'session', path: 'telos:/README.md' })
    const saved = await service.write({
      sessionId: 'session', path: 'telos:/README.md', content: '# Updated\n', expectedRevision: opened.revision,
    })
    expect(saved.content).toBe('# Updated\n')
    expect(await readFile(join(root, 'README.md'), 'utf8')).toBe('# Updated\n')
    await expect(service.write({
      sessionId: 'session', path: 'telos:/README.md', content: '# Stale\n', expectedRevision: opened.revision,
    })).rejects.toMatchObject({ code: 'conflict' })
  })

  it('refuses sessions outside the workspace registry', async () => {
    const { service } = await fixture()
    await expect(service.list({ sessionId: 'missing', path: '' })).rejects.toMatchObject({ code: 'workspace-unavailable' })
  })

  it('stages the unsaved editor buffer and selection for the matching session', async () => {
    const { service } = await fixture()
    await expect(service.stageContext({
      sessionId: 'session',
      path: 'telos:/src/index.ts',
      content: '',
      revision: 'editor-revision-1',
      selection: { startLine: 2, endLine: 3, content: 'selected buffer' },
    })).resolves.toMatchObject({
      sessionId: 'session',
      path: 'telos:/src/index.ts',
      toolPath: 'src/index.ts',
      content: '',
      revision: 'editor-revision-1',
      selection: { startLine: 2, endLine: 3, content: 'selected buffer' },
    })
    expect(service.editorContext('session', 'telos:/src/index.ts')).toMatchObject({ revision: 'editor-revision-1' })
    expect(service.editorContext('another-session', 'telos:/src/index.ts')).toBeUndefined()
  })

  it('refuses to stage editor context outside the registered workspace', async () => {
    const { service } = await fixture()
    await expect(service.stageContext({
      sessionId: 'session', path: 'telos:/../secret.txt', content: 'secret', revision: 'revision-1',
    })).rejects.toMatchObject({ code: 'path-forbidden' })
  })
})
