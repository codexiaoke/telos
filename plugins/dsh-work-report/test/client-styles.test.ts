import { describe, expect, it } from 'vitest'
import { WORK_REPORT_CLIENT_CSS } from '../src/client/styles.js'

describe('work report settings styles', () => {
  it('uses the Settings body without replacing the Telos shell', () => {
    const root = /\.telosReportSettings\{([^}]*)}/s.exec(WORK_REPORT_CLIENT_CSS)?.[1]
    expect(root).toContain('width:100%')
    expect(root).toContain('height:100%')
    expect(root).not.toContain('position:fixed')
  })

  it('keeps configuration usable on narrower settings pages', () => {
    expect(WORK_REPORT_CLIENT_CSS).toContain('.telosReportGrid')
    expect(WORK_REPORT_CLIENT_CSS).toContain('@media(max-width:760px)')
  })
})
