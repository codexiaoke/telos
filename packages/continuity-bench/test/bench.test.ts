import { describe, expect, it } from 'vitest'
import { runContinuityBench } from '../src/index.js'

describe('Telos ContinuityBench', () => {
  it('passes every deterministic continuity scenario and reports honest comparison status', () => {
    const report = runContinuityBench({
      dshParityVerified: true,
      now: () => new Date('2026-08-15T00:00:00.000Z'),
    })

    expect(report.status, JSON.stringify(report.scenarios.filter(scenario => scenario.status === 'FAIL'), null, 2)).toBe('PASS')
    expect(report.scenarios).toHaveLength(12)
    expect(report.scenarios.every(scenario => scenario.status === 'PASS')).toBe(true)
    expect(report.metrics).toMatchObject({
      validRecallPrecision: 1,
      staleMemoryErrorRate: 0,
      scopeLeakRate: 0,
      provenanceCoverage: 1,
      correctionConvergence: 1,
      continuationSuccess: 1,
      deletionCompleteness: 1,
      duplicateInjectionRate: 0,
    })
    expect(report.metrics.p95RecallLatencyMs).toBeLessThanOrEqual(100)
    expect(report.metrics.maxContextPackChars).toBeLessThanOrEqual(2_400)
    expect(report.comparison.communityAdapters).toBe('NOT_RUN')
  })

  it('fails rather than claiming baseline parity when the external gate was not run', () => {
    const report = runContinuityBench({ dshParityVerified: false })
    expect(report.status).toBe('FAIL')
    expect(report.scenarios.find(scenario => scenario.id === 'CB-12')).toMatchObject({ status: 'FAIL' })
  })
})
