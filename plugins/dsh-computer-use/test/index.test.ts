import { describe, expect, it } from 'vitest'
import { supportsComputerUsePlatform } from '../src/index.js'

describe('computer use platform support', () => {
  it('enables the provider only on macOS', () => {
    expect(supportsComputerUsePlatform('darwin')).toBe(true)
    expect(supportsComputerUsePlatform('win32')).toBe(false)
    expect(supportsComputerUsePlatform('linux')).toBe(false)
  })
})
