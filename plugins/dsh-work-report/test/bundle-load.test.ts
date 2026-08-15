import { describe, expect, it } from 'vitest'

describe('work report distribution bundle', () => {
  it('loads as ESM while bundled Nodemailer resolves Node built-ins', async () => {
    const bundleUrl = new URL('../lib/index.js', import.meta.url).href
    const plugin = await import(bundleUrl) as Record<string, unknown>
    expect(plugin.name).toBe('telos-work-report')
    expect(plugin.apply).toBeTypeOf('function')
    expect(plugin.WorkReportMailer).toBeTypeOf('function')
  })
})
