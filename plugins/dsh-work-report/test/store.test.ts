import { mkdtemp, readFile, stat } from 'node:fs/promises'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseDirectory, WorkReportStore } from '../src/store.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

async function fixture(): Promise<{ root: string; store: WorkReportStore }> {
  const root = await mkdtemp(join(tmpdir(), 'telos-work-report-'))
  roots.push(root)
  return { root, store: new WorkReportStore(root) }
}

describe('WorkReportStore', () => {
  it('stores each report as one ordinary Markdown file and requires explicit overwrite', async () => {
    const { root, store } = await fixture()
    const markdown = '# 8 月 15 日工作日报\n\n- 完成报告插件设计\n'

    const report = await store.saveReport({
      type: 'daily', periodStart: '2026-08-15', periodEnd: '2026-08-15', markdown,
    })

    expect(report).toMatchObject({ id: 'daily:2026-08-15:2026-08-15', title: '8 月 15 日工作日报' })
    const path = join(root, 'reports/daily/2026-08-15.md')
    expect(await readFile(path, 'utf8')).toBe(markdown)
    expect((await stat(path)).mode & 0o777).toBe(0o600)
    await expect(store.saveReport({
      type: 'daily', periodStart: '2026-08-15', periodEnd: '2026-08-15', markdown: '# 新版本\n',
    })).rejects.toThrow(/overwrite/)
    await expect(store.saveReport({
      type: 'daily', periodStart: '2026-08-15', periodEnd: '2026-08-15', markdown: '# 新版本\n', overwrite: true,
    })).resolves.toMatchObject({ title: '新版本' })
  })

  it('returns only grounded daily sources for weekly reports and weekly sources for monthly reports', async () => {
    const { store } = await fixture()
    await store.saveStandard('weekly', '面向直属主管，简洁、事实化。')
    await store.saveReport({ type: 'daily', periodStart: '2026-08-10', periodEnd: '2026-08-10', markdown: '# 周一\n\n完成 A。' })
    await store.saveReport({ type: 'daily', periodStart: '2026-08-11', periodEnd: '2026-08-11', markdown: '# 周二\n\n完成 B。' })

    await expect(store.context({ type: 'weekly', periodStart: '2026-08-10', periodEnd: '2026-08-16' })).resolves.toMatchObject({
      standardConfigured: true,
      sourceType: 'daily',
      sources: [
        { id: 'daily:2026-08-10:2026-08-10' },
        { id: 'daily:2026-08-11:2026-08-11' },
      ],
    })

    const fallback = await store.context({ type: 'monthly', periodStart: '2026-08-01', periodEnd: '2026-08-31' })
    expect(fallback.sourceType).toBe('daily')
    expect(fallback.sources).toHaveLength(2)

    await store.saveReport({ type: 'weekly', periodStart: '2026-08-10', periodEnd: '2026-08-16', markdown: '# 第 33 周周报\n\n完成 A、B。' })
    const monthly = await store.context({ type: 'monthly', periodStart: '2026-08-01', periodEnd: '2026-08-31' })
    expect(monthly.sourceType).toBe('weekly')
    expect(monthly.sources.map(source => source.id)).toEqual(['weekly:2026-08-10:2026-08-16'])
  })

  it('validates local contacts and recipient groups', async () => {
    const { store } = await fixture()
    const directory = parseDirectory({
      contacts: [
        { id: 'manager', name: '直属主管', email: 'Manager@example.com' },
        { id: 'team', name: '项目同事', email: 'team@example.com' },
      ],
      groups: [{ id: 'weekly-review', name: '周报收件组', contactIds: ['manager', 'team'] }],
    })
    await expect(store.saveDirectory(directory)).resolves.toMatchObject({
      contacts: [{ email: 'manager@example.com' }, { email: 'team@example.com' }],
    })
    expect(await store.directory()).toEqual(directory)
    expect(() => parseDirectory({
      contacts: [{ id: 'manager', name: '主管', email: 'manager@example.com' }],
      groups: [{ id: 'bad', name: '错误分组', contactIds: ['missing'] }],
    })).toThrow(/unknown contact/)
  })

  it('rejects invalid dates and daily ranges', async () => {
    const { store } = await fixture()
    await expect(store.saveReport({
      type: 'daily', periodStart: '2026-02-30', periodEnd: '2026-02-30', markdown: '# 无效日期',
    })).rejects.toThrow(/real calendar date/)
    await expect(store.saveReport({
      type: 'daily', periodStart: '2026-08-14', periodEnd: '2026-08-15', markdown: '# 无效范围',
    })).rejects.toThrow(/one date/)
  })
})
