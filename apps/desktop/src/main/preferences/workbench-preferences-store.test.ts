import { mkdtemp, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { WorkbenchPreferencesStore } from './workbench-preferences-store'

describe('WorkbenchPreferencesStore', () => {
  it('persists independent editor widths by workspace', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'telos-workbench-preferences-'))
    const path = join(directory, 'workbench.json')
    const store = new WorkbenchPreferencesStore(path)

    await store.setEditorPanels('/workspace/one', { files: 312, conversation: 488 })
    await store.setEditorPanels('/workspace/two', { files: 220, conversation: 340 })

    const restored = new WorkbenchPreferencesStore(path)
    await expect(restored.getEditorPanels('/workspace/one')).resolves.toEqual({
      files: 312,
      conversation: 488,
    })
    await expect(restored.getEditorPanels('/workspace/two')).resolves.toEqual({
      files: 220,
      conversation: 340,
    })
    expect(JSON.parse(await readFile(path, 'utf8'))).toMatchObject({ version: 1 })
  })

  it('rejects invalid requests and clamps stale widths', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'telos-workbench-preferences-'))
    const store = new WorkbenchPreferencesStore(join(directory, 'workbench.json'))

    await expect(store.setEditorPanels('', { files: 260, conversation: 380 })).rejects.toThrow()
    await store.setEditorPanels('/workspace', { files: 9_999, conversation: 1 })
    await expect(store.getEditorPanels('/workspace')).resolves.toEqual({
      files: 520,
      conversation: 300,
    })
  })
})
