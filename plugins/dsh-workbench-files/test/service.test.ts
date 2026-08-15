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
  return { root, service: new WorkspaceFileService({ rootForSession: id => id === 'session' ? root : undefined }) }
}

describe('WorkspaceFileService', () => {
  it('lists directories first and reads workspace-relative text files', async () => {
    const { service } = await fixture()
    await expect(service.list({ sessionId: 'session', path: '' })).resolves.toMatchObject({
      path: '',
      entries: [
        { name: 'src', path: 'src', kind: 'directory' },
        { name: 'README.md', path: 'README.md', kind: 'file' },
      ],
    })
    await expect(service.read({ sessionId: 'session', path: 'src/index.ts' })).resolves.toMatchObject({
      path: 'src/index.ts', content: 'export const telos = true\n',
    })
  })

  it('rejects traversal and symlinks that leave the registered workspace', async () => {
    const { root, service } = await fixture()
    const outside = await mkdtemp(join(tmpdir(), 'telos-outside-'))
    roots.push(outside)
    await writeFile(join(outside, 'secret.txt'), 'secret')
    await symlink(outside, join(root, 'escape'))
    await expect(service.read({ sessionId: 'session', path: '../secret.txt' })).rejects.toMatchObject({ code: 'path-forbidden' })
    await expect(service.read({ sessionId: 'session', path: 'escape/secret.txt' })).rejects.toMatchObject({ code: 'path-forbidden' })
  })

  it('saves only against the exact file revision', async () => {
    const { root, service } = await fixture()
    const opened = await service.read({ sessionId: 'session', path: 'README.md' })
    const saved = await service.write({
      sessionId: 'session', path: 'README.md', content: '# Updated\n', expectedRevision: opened.revision,
    })
    expect(saved.content).toBe('# Updated\n')
    expect(await readFile(join(root, 'README.md'), 'utf8')).toBe('# Updated\n')
    await expect(service.write({
      sessionId: 'session', path: 'README.md', content: '# Stale\n', expectedRevision: opened.revision,
    })).rejects.toMatchObject({ code: 'conflict' })
  })

  it('refuses sessions outside the workspace registry', async () => {
    const { service } = await fixture()
    await expect(service.list({ sessionId: 'missing', path: '' })).rejects.toMatchObject({ code: 'workspace-unavailable' })
  })
})
