import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { LlmAdapter, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm'
import { afterEach, describe, expect, it } from 'vitest'
import { PersonalContinuityStore } from '@telos/personal-core'
import {
  formMemoriesWithMainModel,
  MEMORY_FORMATION_SYSTEM_PROMPT,
  parseMemoryFormationOutput,
  type FormedMemoryEvent,
} from '../src/formation.js'
import { processInferenceJobs } from '../src/formation-worker.js'
import { ContinuityGateway } from '../src/gateway.js'

const stores: PersonalContinuityStore[] = []

const POLICY = {
  maxInputBytes: 16_000,
  maxOutputTokens: 4_096,
  timeoutMs: 1_000,
} as const

const POSITIVE_OUTPUT = JSON.stringify({
  schemaVersion: 2,
  decision: 'remember',
  reason: '用户陈述了跨会话稳定偏好',
  entities: [],
  events: [{
    kind: 'semantic',
    statement: '用户长期偏好简洁且有证据的回答',
    predicate: 'preference.answer_style',
    subjectEntityRef: 'owner',
    objectEntityRef: null,
    objectValue: '简洁且有证据',
    confidence: 0.91,
    importance: 0.72,
    sensitivity: 'personal',
    evidence: '我长期偏好简洁且有证据的回答',
    durability: 'cross-session',
    validFrom: null,
    validTo: null,
  }],
})

const VISIT_OUTPUT = JSON.stringify({
  schemaVersion: 2,
  decision: 'remember',
  reason: '这是会影响后续安排的具体家庭来访事件',
  entities: [{
    ref: 'father',
    kind: 'person',
    canonicalName: '爸爸',
    aliases: [],
    evidence: '爸爸明天来我家',
  }],
  events: [{
    kind: 'prospective',
    statement: '爸爸将于 2026-08-16 来用户家',
    predicate: 'person.visits_home_of',
    subjectEntityRef: 'father',
    objectEntityRef: 'owner',
    objectValue: null,
    confidence: 0.94,
    importance: 0.78,
    sensitivity: 'personal',
    evidence: '爸爸明天来我家',
    durability: 'cross-session',
    validFrom: '2026-08-16T00:00:00+08:00',
    validTo: '2026-08-16T23:59:59.999+08:00',
  }],
})

class RecordingAdapter extends LlmAdapter {
  readonly requests: GenerateOptions[] = []

  constructor(private readonly output: string) {
    super()
  }

  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({
      provider,
      id: model,
      name: model,
      reasoning: {
        efforts: [
          { id: ReasoningEffortId('off'), name: 'Off' },
          { id: ReasoningEffortId('high'), name: 'High' },
        ],
      },
    })
  }

  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: this.output }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

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

function jobPayload(text: string, suffix: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sessionId: `session-${suffix}`,
    workspaceId: 'workspace-a',
    turn: 1,
    messages: [{ seq: 2, text }],
    assistantMessages: [{ seq: 4, text: '我会结合这个信息继续帮你安排。' }],
    referenceTime: '2026-08-15T04:00:00.000Z',
    timeZone: 'Asia/Shanghai',
    locale: 'zh-CN',
    route: { provider: 'main-provider', model: 'main-model', reasoningEffort: 'high' },
    policy: POLICY,
    contentHash: `hash-${suffix}`,
    observedAt: '2026-08-15T00:00:00.000Z',
    ...overrides,
  }
}

afterEach(() => {
  for (const store of stores.splice(0)) store.close()
})

describe('main-model memory formation', () => {
  it('uses the exact main-model route with no tools and parses evidence-grounded JSON', async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    const adapter = new RecordingAdapter(POSITIVE_OUTPUT)
    ctx.llm.registerAdapter(['main-provider'], adapter)

    const result = await formMemoriesWithMainModel(ctx, {
      sessionId: 'session-a',
      messages: [{ seq: 2, text: '我长期偏好简洁且有证据的回答。' }],
      assistantMessages: [{ seq: 4, text: '好的，我会保持简洁。' }],
      referenceTime: '2026-08-15T04:00:00.000Z',
      timeZone: 'Asia/Shanghai',
      locale: 'zh-CN',
      scope: { type: 'workspace', id: 'workspace-a' },
      route: { provider: 'main-provider', model: 'main-model', reasoningEffort: 'high' },
      policy: POLICY,
    })

    expect(result).toMatchObject({
      route: { provider: 'main-provider', model: 'main-model', reasoningEffort: 'off' },
      events: [{
        predicate: 'preference.answer_style',
        evidence: '我长期偏好简洁且有证据的回答',
        subjectEntityRef: 'owner',
      }],
    })
    expect(adapter.requests).toHaveLength(1)
    expect(adapter.requests[0]).toMatchObject({
      provider: 'main-provider',
      model: 'main-model',
      reasoningEffort: 'off',
      maxTokens: 4_096,
    })
    expect(adapter.requests[0]).not.toHaveProperty('tools')
    expect(adapter.requests[0]?.system).toBe(MEMORY_FORMATION_SYSTEM_PROMPT)
    expect(MEMORY_FORMATION_SYSTEM_PROMPT).toContain('concrete time-bounded events')
    expect(MEMORY_FORMATION_SYSTEM_PROMPT).toContain('Do not translate Chinese memory into English')
    const request = adapter.requests[0]?.messages[0]?.content[0]
    expect(request?.type === 'text' && request.text).toContain('我长期偏好简洁且有证据的回答')
    expect(request?.type === 'text' && request.text).toContain('Asia/Shanghai')
    expect(request?.type === 'text' && request.text).toContain('好的，我会保持简洁')
  })

  it('accepts an explicit no-memory result for temporary controls and test prompts', async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    const adapter = new RecordingAdapter('{"schemaVersion":2,"decision":"ignore","reason":"仅为本轮测试控制","entities":[],"events":[]}')
    ctx.llm.registerAdapter(['main-provider'], adapter)

    const result = await formMemoriesWithMainModel(ctx, {
      sessionId: 'session-test',
      messages: [{ seq: 8, text: '这是一次真实模型链路测试。不要调用任何工具，请只回复：TELOS_LIVE_OK' }],
      referenceTime: '2026-08-15T04:00:00.000Z',
      timeZone: 'Asia/Shanghai',
      locale: 'zh-CN',
      scope: { type: 'workspace', id: 'workspace-a' },
      route: { provider: 'main-provider', model: 'main-model' },
      policy: POLICY,
    })

    expect(result.events).toEqual([])
    expect(adapter.requests).toHaveLength(1)
    expect(result.decision).toBe('ignore')
  })

  it('forms a person node and local-day prospective edge from a family visit', () => {
    const result = parseMemoryFormationOutput(VISIT_OUTPUT, {
      messages: [{ seq: 2, text: '爸爸明天来我家' }],
      scope: { type: 'workspace', id: 'workspace-a' },
    })
    expect(result.entities).toEqual([expect.objectContaining({
      ref: 'father', kind: 'person', canonicalName: '爸爸', evidence: '爸爸明天来我家',
    })])
    expect(result.events).toEqual([expect.objectContaining({
      kind: 'prospective',
      subjectEntityRef: 'father',
      objectEntityRef: 'owner',
      validFrom: '2026-08-16T00:00:00+08:00',
      validTo: '2026-08-16T23:59:59.999+08:00',
    })])
  })

  it('accepts a normalized entity name only when an observed alias anchors it', () => {
    const output = JSON.parse(VISIT_OUTPUT) as {
      entities: Array<{ canonicalName: string; aliases: string[]; evidence: string }>
    }
    output.entities[0] = {
      ...output.entities[0]!,
      canonicalName: '父亲',
      aliases: ['爸爸'],
      evidence: '爸爸',
    }

    const result = parseMemoryFormationOutput(JSON.stringify(output), {
      messages: [{ seq: 2, text: '爸爸明天来我家' }],
      scope: { type: 'workspace', id: 'workspace-a' },
    })

    expect(result.entities).toEqual([expect.objectContaining({
      canonicalName: '父亲',
      aliases: ['爸爸'],
      evidence: '爸爸',
    })])
  })

  it('grounds punctuation-only evidence drift and fills a missing next-week range', () => {
    const output = JSON.parse(VISIT_OUTPUT) as {
      entities: Array<Record<string, unknown>>
      events: Array<Record<string, unknown>>
    }
    output.entities[0] = {
      ...output.entities[0],
      evidence: '爸爸下周来我家',
    }
    output.events[0] = {
      ...output.events[0],
      statement: '爸爸下周来我家',
      evidence: '爸爸 下周来我家。',
      validFrom: null,
      validTo: null,
    }

    const result = parseMemoryFormationOutput(JSON.stringify(output), {
      messages: [{ seq: 2, text: '爸爸下周来我家' }],
      scope: { type: 'workspace', id: 'workspace-a' },
      referenceTime: '2026-08-15T04:00:00.000Z',
      timeZone: 'Asia/Shanghai',
    })

    expect(result.events).toEqual([expect.objectContaining({
      evidence: '爸爸下周来我家',
      validFrom: '2026-08-16T16:00:00.000Z',
      validTo: '2026-08-23T15:59:59.999Z',
    })])
  })

  it('repairs a selected event with no object into a grounded literal relation', () => {
    const output = JSON.parse(POSITIVE_OUTPUT) as { events: Array<Record<string, unknown>> }
    output.events[0] = {
      ...output.events[0],
      objectValue: null,
      objectEntityRef: null,
    }

    const result = parseMemoryFormationOutput(JSON.stringify(output), {
      messages: [{ seq: 2, text: '我长期偏好简洁且有证据的回答。' }],
      scope: { type: 'workspace', id: 'workspace-a' },
    })

    expect(result.events[0]).toMatchObject({ objectValue: '用户长期偏好简洁且有证据的回答' })
    expect(result.events[0]).not.toHaveProperty('objectEntityRef')
  })

  it('drops an ungrounded extra entity without discarding valid events', () => {
    const output = JSON.parse(POSITIVE_OUTPUT) as {
      entities: Array<Record<string, unknown>>
    }
    output.entities.push({
      ref: 'hallucinated_goal',
      kind: 'goal',
      canonicalName: '长期目标',
      aliases: [],
      evidence: '我长期偏好简洁且有证据的回答',
    })

    const result = parseMemoryFormationOutput(JSON.stringify(output), {
      messages: [{ seq: 2, text: '我长期偏好简洁且有证据的回答。' }],
      scope: { type: 'workspace', id: 'workspace-a' },
    })

    expect(result.decision).toBe('remember')
    expect(result.entities).toEqual([])
    expect(result.events).toHaveLength(1)
  })

  it('forms place and organization nodes in the personal event graph', () => {
    const prompt = '下周去医院复查，之后参加辩论队训练'
    const result = parseMemoryFormationOutput(JSON.stringify({
      schemaVersion: 2,
      decision: 'remember',
      reason: '两个跨会话安排',
      entities: [
        { ref: 'hospital', kind: 'place', canonicalName: '医院', aliases: [], evidence: prompt },
        { ref: 'debate_team', kind: 'organization', canonicalName: '辩论队', aliases: [], evidence: prompt },
      ],
      events: [
        {
          kind: 'prospective', statement: '下周去医院复查', predicate: 'owner.visits',
          subjectEntityRef: 'owner', objectEntityRef: 'hospital', objectValue: null,
          confidence: 0.9, importance: 0.8, sensitivity: 'personal', evidence: prompt,
          durability: 'cross-session', validFrom: null, validTo: null,
        },
        {
          kind: 'prospective', statement: '之后参加辩论队训练', predicate: 'owner.attends_training_with',
          subjectEntityRef: 'owner', objectEntityRef: 'debate_team', objectValue: null,
          confidence: 0.85, importance: 0.7, sensitivity: 'personal', evidence: prompt,
          durability: 'cross-session', validFrom: null, validTo: null,
        },
      ],
    }), {
      messages: [{ seq: 2, text: prompt }],
      scope: { type: 'workspace', id: 'workspace-a' },
    })

    expect(result.entities.map(entity => [entity.kind, entity.canonicalName])).toEqual([
      ['place', '医院'],
      ['organization', '辩论队'],
    ])
  })

  it('rejects hallucinated evidence, non-durable shapes and credential-like content', () => {
    const input = {
      messages: [{ seq: 1, text: '我长期喜欢喝咖啡' }],
      scope: { type: 'workspace' as const, id: 'workspace-a' },
    }
    expect(() => parseMemoryFormationOutput(POSITIVE_OUTPUT, input)).toThrow(/grounded in a human message/)
    expect(() => parseMemoryFormationOutput(JSON.stringify({
      schemaVersion: 2, decision: 'remember', reason: 'test', entities: [],
      events: [{
        kind: 'semantic', statement: '测试', predicate: 'preference.test', objectValue: '测试',
        subjectEntityRef: 'owner', objectEntityRef: null,
        confidence: 0.9, importance: 0.5, sensitivity: 'personal', evidence: '我长期喜欢喝咖啡',
        durability: 'ephemeral', validFrom: null, validTo: null,
      }],
    }), input)).toThrow(/durability must be cross-session/)
    expect(() => parseMemoryFormationOutput(JSON.stringify({
      schemaVersion: 2, decision: 'remember', reason: 'test', entities: [],
      events: [{
        kind: 'semantic', statement: '用户的 API key', predicate: 'account.api_key', objectValue: 'sk-abcdefghijk',
        subjectEntityRef: 'owner', objectEntityRef: null,
        confidence: 0.9, importance: 0.5, sensitivity: 'personal', evidence: '我的 API key 是 sk-abcdefghijk',
        durability: 'cross-session', validFrom: null, validTo: null,
      }],
    }), {
      messages: [{ seq: 1, text: '我的 API key 是 sk-abcdefghijk' }],
      scope: input.scope,
    })).toThrow(/credential-like/)
  })
})

describe('asynchronous formation worker', () => {
  it('persists only selected evidence, creates a reviewable candidate and scrubs the completed job payload', async () => {
    const { gateway, store } = fixture()
    const prompt = '我长期偏好简洁且有证据的回答。'
    const job = store.enqueue('infer-turn-candidates', jobPayload(prompt, 'positive'), 'infer:positive')
    const unrelatedJob = store.enqueue('unrelated-job', {}, 'unrelated')
    const formation = parseMemoryFormationOutput(POSITIVE_OUTPUT, {
      messages: [{ seq: 2, text: prompt }],
      scope: { type: 'workspace', id: 'workspace-a' },
    })

    await expect(processInferenceJobs(gateway, {
      form: input => Promise.resolve({
        route: { ...input.route, reasoningEffort: 'off' },
        ...formation,
      }),
    })).resolves.toEqual({
      claimed: 1,
      completed: 1,
      failed: 0,
      candidatesCreated: 1,
    })
    expect(store.listClaims()).toEqual([expect.objectContaining({
      status: 'candidate',
      predicate: 'preference.answer_style',
      scope: { type: 'workspace', id: 'workspace-a' },
    })])
    expect(store.listSourceEpisodes()).toEqual([expect.objectContaining({
      sourceKind: 'dsh.llm-memory-formation',
      content: '我长期偏好简洁且有证据的回答',
    })])
    expect(store.listActionReceipts()).toEqual([expect.objectContaining({
      action: 'memory.formation',
      provider: 'main-provider/main-model#off',
      result: 'succeeded',
    })])
    expect(store.listEntities({ kinds: ['preference'] })).toEqual([])
    expect(store.claimOutbox(10, 60_000, 'infer-turn-candidates')).toEqual([])
    expect(store.getOutbox(job.id)).toMatchObject({ status: 'completed', payload: {} })
    expect(store.claimOutbox(10, 60_000, 'unrelated-job')).toEqual([expect.objectContaining({ id: unrelatedJob.id })])
  })

  it('records a successful no-memory decision without creating claims or source plaintext', async () => {
    const { gateway, store } = fixture()
    store.enqueue('infer-turn-candidates', jobPayload('不要调用任何工具，请只回复 TELOS_OK', 'negative'), 'infer:negative')

    await processInferenceJobs(gateway, {
      form: input => Promise.resolve({
        route: input.route,
        decision: 'ignore',
        reason: '仅为本轮控制',
        entities: [],
        events: [] as FormedMemoryEvent[],
      }),
    })

    expect(store.listClaims()).toEqual([])
    expect(store.listSourceEpisodes()).toEqual([])
    expect(store.listActionReceipts()).toEqual([expect.objectContaining({ action: 'memory.formation', result: 'succeeded' })])
  })

  it('persists an extracted person node and time-aware edge without retaining assistant text', async () => {
    const { gateway, store } = fixture()
    const prompt = '爸爸明天来我家'
    store.enqueue('infer-turn-candidates', jobPayload(prompt, 'visit'), 'infer:visit')
    const formation = parseMemoryFormationOutput(VISIT_OUTPUT, {
      messages: [{ seq: 2, text: prompt }],
      scope: { type: 'workspace', id: 'workspace-a' },
    })

    await expect(processInferenceJobs(gateway, {
      form: input => Promise.resolve({ route: input.route, ...formation }),
    })).resolves.toMatchObject({ completed: 1, candidatesCreated: 1 })

    const father = store.listEntities({ kinds: ['person'] }).find(entity => entity.canonicalName === '爸爸')
    expect(father).toBeDefined()
    expect(store.listClaims()).toEqual([expect.objectContaining({
      status: 'candidate',
      subjectEntityId: father!.id,
      objectEntityId: gateway.ownerEntity.id,
      predicate: 'person.visits_home_of',
    })])
    expect(store.listSourceEpisodes()).toEqual([expect.objectContaining({
      content: '爸爸明天来我家',
    })])
    expect(store.listSourceEpisodes()[0]?.content).not.toContain('我会结合这个信息')
    expect(store.listActionReceipts()[0]?.affectedEntityIds).toEqual(expect.arrayContaining([
      father!.id,
      gateway.ownerEntity.id,
    ]))
  })

  it('promotes the structured graph result only for explicit confirmed capture', async () => {
    const { gateway, store } = fixture()
    const prompt = '爸爸明天来我家，帮我记一下。'
    store.enqueue('infer-turn-candidates', jobPayload(prompt, 'explicit-visit', {
      captureIntent: 'explicit',
      confirmationStatus: 'confirmed',
    }), 'infer:explicit-visit')
    const formation = parseMemoryFormationOutput(VISIT_OUTPUT, {
      messages: [{ seq: 2, text: prompt }],
      scope: { type: 'workspace', id: 'workspace-a' },
    })

    await expect(processInferenceJobs(gateway, {
      form: input => {
        expect(input.captureIntent).toBe('explicit')
        return Promise.resolve({ route: input.route, ...formation })
      },
    })).resolves.toMatchObject({ completed: 1, candidatesCreated: 1 })

    const [claim] = store.listClaims()
    expect(claim).toMatchObject({
      status: 'confirmed',
      predicate: 'person.visits_home_of',
    })
    expect(store.listActionReceipts()).toEqual([expect.objectContaining({
      action: 'memory.formation',
      authorization: 'allowed',
    })])
    expect(store.listEvents(claim!.id).map(event => event.eventType)).toEqual([
      'claim.observed',
      'claim.confirmed',
    ])
  })
})
