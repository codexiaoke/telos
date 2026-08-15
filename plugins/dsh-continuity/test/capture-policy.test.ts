import { describe, expect, it } from 'vitest'
import { explicitMemoryVetoRequested, explicitReviewRequested } from '../src/capture-policy.js'

const messages = (text: string) => [{ text }]

describe('durable memory capture policy', () => {
  it('lets explicit uncertainty lower confirmation without vetoing capture', () => {
    const input = messages('我不是很确定辅导员会不会批假，先帮我记成待确认。')
    expect(explicitReviewRequested(input)).toBe(true)
    expect(explicitMemoryVetoRequested(input)).toBe(false)
  })

  it('honors direct long-term-memory and mentions-only vetoes', () => {
    expect(explicitMemoryVetoRequested(messages(
      '我今天心血来潮想学吉他，这个先别进长期计划，最多放 mentions。',
    ))).toBe(true)
    expect(explicitMemoryVetoRequested(messages('这个不要保存成长期记忆。'))).toBe(true)
    expect(explicitMemoryVetoRequested(messages(
      '这个不用记成运动计划，我就是随口说。',
    ))).toBe(true)
  })

  it('does not confuse ordinary negation with a memory veto', () => {
    expect(explicitMemoryVetoRequested(messages('不是所有口语都不行，请记住这个范围。'))).toBe(false)
  })
})
