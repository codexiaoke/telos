import { posix, win32 } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isStrictlyContained } from './path-containment.mjs'

describe('isStrictlyContained', () => {
  it('recognizes POSIX descendants without accepting siblings or the parent itself', () => {
    expect(isStrictlyContained('/repo/.local', '/repo/.local/runtime', posix)).toBe(true)
    expect(isStrictlyContained('/repo/.local', '/repo/other', posix)).toBe(false)
    expect(isStrictlyContained('/repo/.local', '/repo/.local', posix)).toBe(false)
  })

  it('recognizes Windows descendants without depending on slash direction', () => {
    expect(isStrictlyContained(String.raw`D:\a\telos\.local`, String.raw`D:\a\telos\.local\runtime`, win32)).toBe(true)
    expect(isStrictlyContained(String.raw`D:\a\telos\.local`, String.raw`D:\a\telos\other`, win32)).toBe(false)
    expect(isStrictlyContained(String.raw`D:\a\telos\.local`, String.raw`C:\temp\runtime`, win32)).toBe(false)
  })
})
