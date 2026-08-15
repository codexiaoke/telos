import { afterEach, describe, expect, it } from 'vitest'
import { PersonalContinuityStore } from '@telos/personal-core'
import { candidateEvidence, extractCandidateEnvelope } from '../src/formation.js'
import { processInferenceJobs } from '../src/formation-worker.js'
import { ContinuityGateway } from '../src/gateway.js'

const stores: PersonalContinuityStore[] = []

function fixture() {
  let sequence = 0
  const store = new PersonalContinuityStore({
    databasePath: ':memory:',
    now: () => new Date('2026-08-15T00:00:00.000Z'),
    idFactory: prefix => `${prefix}-${String(++sequence)}`,
  })
  stores.push(store)
  return { store, gateway: new ContinuityGateway({ store }) }
}

afterEach(() => {
  for (const store of stores.splice(0)) store.close()
})

describe('bounded local formation', () => {
  it('extracts only direct high-precision statements and excludes questions, explicit remember requests and credentials', () => {
    const evidence = candidateEvidence([
      '我偏好简洁且有证据的回答。',
      '我的目标是发布 Telos。',
      '我喜欢什么？',
      '请记住我喜欢咖啡。',
      '我的 API key 是 sk-abcdefghijk。',
      '也许未来可以考虑图数据库。',
    ].join(''))
    expect(evidence).toEqual(['我偏好简洁且有证据的回答', '我的目标是发布 Telos'])

    const result = extractCandidateEnvelope({
      sourceEpisodeId: 'source-1',
      evidence: evidence.join('\n'),
      scope: { type: 'workspace', id: 'workspace-a' },
    })
    expect(result.proposals).toEqual([
      expect.objectContaining({ predicate: 'preference.stated', objectValue: '简洁且有证据的回答', scope: { type: 'workspace', id: 'workspace-a' } }),
      expect.objectContaining({ predicate: 'goal.stated', objectValue: '发布 Telos', kind: 'prospective' }),
    ])
  })

  it('processes the outbox into reviewable candidates without exposing other job types', () => {
    const { gateway, store } = fixture()
    const source = store.createSourceEpisode({
      sourceKind: 'dsh.turn-candidates',
      sourceInstanceId: 'session-a:turn:1:candidates',
      sessionId: 'session-a',
      seqStart: 2,
      seqEnd: 2,
      content: '我决定先完成连续记忆闭环',
    })
    store.enqueue('infer-turn-candidates', {
      sourceEpisodeId: source.id,
      sessionId: 'session-a',
      workspaceId: 'workspace-a',
      turn: 1,
    }, 'infer:session-a:1')
    const unrelatedJob = store.enqueue('unrelated-job', {}, 'unrelated')

    expect(processInferenceJobs(gateway)).toEqual({
      claimed: 1,
      completed: 1,
      failed: 0,
      candidatesCreated: 1,
    })
    expect(store.listClaims()).toEqual([expect.objectContaining({
      status: 'candidate',
      predicate: 'decision.stated',
      objectValue: '先完成连续记忆闭环',
      scope: { type: 'workspace', id: 'workspace-a' },
      sourceEpisodeIds: [source.id],
    })])
    expect(store.claimOutbox(10, 60_000, 'infer-turn-candidates')).toEqual([])
    expect(store.claimOutbox(10, 60_000, 'unrelated-job')).toEqual([expect.objectContaining({ id: unrelatedJob.id })])
  })
})
