import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { MAX_PERSONAL_INSTRUCTIONS_BYTES } from '../src/contracts.js'
import { PersonalInstructionsStore } from '../src/store.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function createStore(): PersonalInstructionsStore {
  const root = mkdtempSync(join(tmpdir(), 'telos-personalization-'))
  roots.push(root)
  return new PersonalInstructionsStore(join(root, 'nested/AGENTS.md'))
}

describe('PersonalInstructionsStore', () => {
  it('treats a missing global instructions file as empty', () => {
    expect(createStore().load()).toBe('')
  })

  it('atomically saves UTF-8 instructions with private permissions', () => {
    const store = createStore()
    const instructions = '优先使用中文回答。\n先给结论。\n'
    expect(store.save(instructions)).toBe(instructions)
    expect(store.load()).toBe(instructions)
    expect(readFileSync(store.path, 'utf8')).toBe(instructions)
    if (process.platform !== 'win32') expect(statSync(store.path).mode & 0o777).toBe(0o600)
  })

  it('rejects content beyond the DSH instruction budget', () => {
    const store = createStore()
    expect(() => store.save('a'.repeat(MAX_PERSONAL_INSTRUCTIONS_BYTES + 1))).toThrow('must not exceed')
    expect(store.load()).toBe('')
  })

  it('clears instructions without deleting the managed file', () => {
    const store = createStore()
    store.save('Keep this preference')
    expect(store.reset()).toBe('')
    expect(readFileSync(store.path, 'utf8')).toBe('')
  })
})
