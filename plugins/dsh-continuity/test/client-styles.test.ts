import { describe, expect, it } from 'vitest'
import { CONTINUITY_CLIENT_CSS } from '../src/client/styles.js'

describe('continuity client styles', () => {
  it('owns the full body height and exposes a visible scrollbar', () => {
    expect(CONTINUITY_CLIENT_CSS).toMatch(/\.telosContinuityScrollPane\s*\{[^}]*height:\s*100%/s)
    expect(CONTINUITY_CLIENT_CSS).toContain('.telosContinuityScrollPane::-webkit-scrollbar')
    expect(CONTINUITY_CLIENT_CSS).toContain('.telosContinuityScrollPane::-webkit-scrollbar-thumb')
  })

  it('presents audit history as compact tables', () => {
    expect(CONTINUITY_CLIENT_CSS).toContain('.telosContinuityAuditTable')
    expect(CONTINUITY_CLIENT_CSS).toContain('border-collapse: collapse')
  })
})
