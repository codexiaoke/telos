import { describe, expect, it } from 'vitest'
import { languageForPath } from './editor-language'

describe('languageForPath', () => {
  it('detects editor languages from common file names and extensions', () => {
    expect(languageForPath('apps/desktop/src/App.tsx')).toBe('tsx')
    expect(languageForPath('scripts/build.mjs')).toBe('javascript')
    expect(languageForPath('pnpm-lock.yaml')).toBe('yaml')
    expect(languageForPath('container/Dockerfile')).toBe('dockerfile')
    expect(languageForPath('docs/readme.MD')).toBe('markdown')
  })

  it('falls back to plaintext for files without a known language', () => {
    expect(languageForPath('LICENSE')).toBe('plaintext')
    expect(languageForPath('data.unknown')).toBe('plaintext')
  })
})
