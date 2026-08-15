import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { defaultMultimodalSettings, MultimodalSettingsStore, parseMultimodalSettings } from '../src/store.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('MultimodalSettingsStore', () => {
  it('returns local-first defaults when no file exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'telos-mm-store-'))
    roots.push(root)
    expect(new MultimodalSettingsStore(join(root, 'missing.json')).load()).toEqual(defaultMultimodalSettings())
  })

  it('persists fixed model routes with owner-only permissions and no credentials', () => {
    const root = mkdtempSync(join(tmpdir(), 'telos-mm-store-'))
    roots.push(root)
    const path = join(root, 'nested/multimodal.json')
    const store = new MultimodalSettingsStore(path)
    const settings = defaultMultimodalSettings()
    settings.routes['image-understanding'] = {
      mode: 'fixed', route: { provider: 'openai', model: 'gpt-5.6-vision' },
    }
    store.save(settings)

    expect(store.load().routes['image-understanding']).toEqual(settings.routes['image-understanding'])
    expect(statSync(path).mode & 0o777).toBe(0o600)
    expect(readFileSync(path, 'utf8')).not.toMatch(/apiKey|baseURL|secret/u)
  })

  it('rejects incomplete and recursive fixed routes', () => {
    const settings = defaultMultimodalSettings()
    expect(() => parseMultimodalSettings({
      ...settings,
      mainModel: { mode: 'fixed', route: { provider: '', model: 'x' } },
    })).toThrow(/provider/u)
    expect(() => parseMultimodalSettings({
      ...settings,
      routes: {
        ...settings.routes,
        ocr: { mode: 'fixed', route: { provider: 'telos-multimodal', model: 'recursive' } },
      },
    })).toThrow(/recursively/u)
  })
})
