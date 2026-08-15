import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { defaultMultimodalSettings, MultimodalSettingsStore, parseMultimodalSettings } from '../src/store.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('MultimodalSettingsStore', () => {
  it('starts enabled but requires an explicit default model', () => {
    const root = mkdtempSync(join(tmpdir(), 'telos-mm-store-'))
    roots.push(root)
    expect(new MultimodalSettingsStore(join(root, 'missing.json')).load()).toEqual({ schemaVersion: 2, enabled: true })
    expect(defaultMultimodalSettings()).not.toHaveProperty('defaultModel')
  })

  it('persists one model route with owner-only permissions and no credentials', () => {
    const root = mkdtempSync(join(tmpdir(), 'telos-mm-store-'))
    roots.push(root)
    const path = join(root, 'nested/multimodal.json')
    const store = new MultimodalSettingsStore(path)
    const settings = { schemaVersion: 2 as const, enabled: true, defaultModel: { provider: 'dashscope', model: 'qwen-vl' } }
    store.save(settings)

    expect(store.load()).toEqual(settings)
    expect(statSync(path).mode & 0o777).toBe(0o600)
    expect(readFileSync(path, 'utf8')).not.toMatch(/apiKey|baseURL|secret/u)
  })

  it('migrates the legacy fixed image-understanding route', () => {
    const root = mkdtempSync(join(tmpdir(), 'telos-mm-store-'))
    roots.push(root)
    const path = join(root, 'multimodal.json')
    writeFileSync(path, JSON.stringify({
      schemaVersion: 1,
      enabled: true,
      mainModel: { mode: 'follow-session' },
      routes: {
        'image-understanding': { mode: 'fixed', route: { provider: 'vision', model: 'eyes' } },
      },
      privacy: { preferLocal: true, cloudMediaPolicy: 'ask' },
    }))
    expect(new MultimodalSettingsStore(path).load()).toEqual({
      schemaVersion: 2, enabled: true, defaultModel: { provider: 'vision', model: 'eyes' },
    })
  })

  it('rejects incomplete and recursive routes', () => {
    expect(() => parseMultimodalSettings({
      schemaVersion: 2, enabled: true, defaultModel: { provider: '', model: 'x' },
    })).toThrow(/provider/u)
    expect(() => parseMultimodalSettings({
      schemaVersion: 2, enabled: true, defaultModel: { provider: 'telos-multimodal', model: 'recursive' },
    })).toThrow(/recursively/u)
  })
})
