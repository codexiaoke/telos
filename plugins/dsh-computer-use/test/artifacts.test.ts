import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { afterEach, describe, expect, it } from 'vitest'
import { allocateScreenshotPath, describeScreenshot } from '../src/artifacts.js'

const workspaces: string[] = []
async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'telos-computer-use-'))
  workspaces.push(dir)
  return dir
}
afterEach(async () => {
  await Promise.all(workspaces.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

const SESSION = 'sess-1' as SessionId

describe('allocateScreenshotPath', () => {
  it('allocates a unique path inside the workspace', async () => {
    const workspace = await makeWorkspace()
    const path = await allocateScreenshotPath(workspace, 'artifacts', SESSION)
    const real = await realpath(workspace)
    expect(path.startsWith(real)).toBe(true)
    expect(path.endsWith('.png')).toBe(true)
  })

  it('rejects an artifactRoot that escapes the workspace', async () => {
    const workspace = await makeWorkspace()
    await expect(allocateScreenshotPath(workspace, '../escape', SESSION)).rejects.toThrow(/escapes the Session workspace/)
  })
})

describe('describeScreenshot', () => {
  it('describes a committed file', async () => {
    const workspace = await makeWorkspace()
    const path = await allocateScreenshotPath(workspace, 'artifacts', SESSION)
    await writeFile(path, Buffer.from([1, 2, 3]))
    const artifact = await describeScreenshot(path, 10, 20, 1000, 'computer_observe')
    expect(artifact).toMatchObject({ width: 10, height: 20, bytes: 3, mimeType: 'image/png', sourceTool: 'computer_observe' })
  })

  it('rejects a missing file', async () => {
    await expect(describeScreenshot('/no/such/file.png', 10, 20, 1000, 'computer_observe')).rejects.toThrow(/not created/)
  })

  it('rejects a file above the byte budget', async () => {
    const workspace = await makeWorkspace()
    const path = await allocateScreenshotPath(workspace, 'artifacts', SESSION)
    await writeFile(path, Buffer.alloc(64))
    await expect(describeScreenshot(path, 10, 20, 16, 'computer_observe')).rejects.toThrow(/exceeds maxScreenshotBytes/)
  })
})
