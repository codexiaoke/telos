import { describe, expect, it } from 'vitest'
import type { ComputerElement } from '../src/types.js'
import { diffElements } from '../src/diff.js'

function el(overrides: Partial<ComputerElement> = {}): ComputerElement {
  return {
    index: 0,
    targetHandle: 'h' as never,
    role: 'button',
    title: 'Save',
    actions: ['AXPress'],
    ...overrides,
  }
}

describe('diffElements', () => {
  it('reports no accessibility changes when identical', () => {
    expect(diffElements([el()], [el()], 1000)).toBe('(no accessibility changes)')
  })

  it('marks added, removed, and changed elements with current indexes', () => {
    const previous = [
      el({ index: 0, role: 'button', title: 'Save' }),
      el({ index: 1, role: 'text', title: 'Name', value: 'old' }),
    ]
    const current = [
      el({ index: 0, role: 'button', title: 'Save' }),
      el({ index: 1, role: 'text', title: 'Name', value: 'new' }),
      el({ index: 2, role: 'button', title: 'Delete' }),
    ]
    const diff = diffElements(previous, current, 1000)
    expect(diff).toContain('~ [1] text')
    expect(diff).toContain('+ [2] button')
    expect(diff).not.toContain('- [1]')
  })

  it('marks removed elements without a current index', () => {
    const previous = [el({ index: 0, role: 'button', title: 'Save' }), el({ index: 1, role: 'text', title: 'Old' })]
    const current = [el({ index: 0, role: 'button', title: 'Save' })]
    expect(diffElements(previous, current, 1000)).toContain('- text')
  })

  it('truncates output to the byte budget', () => {
    const previous = Array.from({ length: 20 }, (_, index) => el({ index, role: 'button', title: `Very long title number ${index}` }))
    const diff = diffElements(previous, [], 64)
    expect(Buffer.byteLength(diff)).toBeLessThanOrEqual(64 + Buffer.byteLength('… diff truncated'))
    expect(diff.endsWith('… diff truncated')).toBe(true)
  })
})
