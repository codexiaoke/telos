import { describe, expect, it } from 'vitest'
import { MCP_MANAGER_CLIENT_CSS } from '../src/client/styles.js'

describe('MCP manager styles', () => {
  it('uses the Settings body directly without a nested outer card', () => {
    const root = /\.telosMcpSettings,\.telosMcpEditor\{([^}]*)}/s.exec(MCP_MANAGER_CLIENT_CSS)?.[1]
    expect(root).toContain('width:100%')
    expect(root).toContain('height:100%')
    expect(root).not.toContain('border:')
    expect(root).not.toContain('border-radius:')
  })

  it('uses a compact table and responsive fallback', () => {
    expect(MCP_MANAGER_CLIENT_CSS).toContain('.telosMcpTable')
    expect(MCP_MANAGER_CLIENT_CSS).toContain('grid-template-columns:')
    expect(MCP_MANAGER_CLIENT_CSS).toContain('@media(max-width:1000px)')
  })
})
