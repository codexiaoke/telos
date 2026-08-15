import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { LlmAdapter, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm'
import { afterEach, describe, expect, it } from 'vitest'
import { PersonalContinuityStore } from '@telos/personal-core'
import {
  formMemoriesWithMainModel,
  MEMORY_FORMATION_SYSTEM_PROMPT,
  parseMemoryFormationOutput,
  type FormedMemoryProposal,
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
  schemaVersion: 1,
  proposals: [{
    kind: 'semantic',
    statement: '用户长期偏好简洁且有证据的回答',
    predicate: 'preference.answer_style',
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

function jobPayload(text: string, suffix: string): Record<string, unknown> {
  return {
    sessionId: `session-${suffix}`,
    workspaceId: 'workspace-a',
    turn: 1,
    messages: [{ seq: 2, text }],
    route: { provider: 'main-provider', model: 'main-model', reasoningEffort: 'high' },
    policy: POLICY,
    contentHash: `hash-${suffix}`,
    observedAt: '2026-08-15T00:00:00.000Z',
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
      scope: { type: 'workspace', id: 'workspace-a' },
      route: { provider: 'main-provider', model: 'main-model', reasoningEffort: 'high' },
      policy: POLICY,
    })

    expect(result).toMatchObject({
      route: { provider: 'main-provider', model: 'main-model', reasoningEffort: 'off' },
      proposals: [{
        predicate: 'preference.answer_style',
        evidence: '我长期偏好简洁且有证据的回答',
        scope: { type: 'workspace', id: 'workspace-a' },
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
    expect(MEMORY_FORMATION_SYSTEM_PROMPT).toContain('Ignore temporary clauses instead of discarding an otherwise durable message')
    const request = adapter.requests[0]?.messages[0]?.content[0]
    expect(request?.type === 'text' && request.text).toContain('我长期偏好简洁且有证据的回答')
  })

  it('accepts an explicit no-memory result for temporary controls and test prompts', async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    const adapter = new RecordingAdapter('{"schemaVersion":1,"proposals":[]}')
    ctx.llm.registerAdapter(['main-provider'], adapter)

    const result = await formMemoriesWithMainModel(ctx, {
      sessionId: 'session-test',
      messages: [{ seq: 8, text: '这是一次真实模型链路测试。不要调用任何工具，请只回复：TELOS_LIVE_OK' }],
      scope: { type: 'workspace', id: 'workspace-a' },
      route: { provider: 'main-provider', model: 'main-model' },
      policy: POLICY,
    })

    expect(result.proposals).toEqual([])
    expect(adapter.requests).toHaveLength(1)
    expect(MEMORY_FORMATION_SYSTEM_PROMPT).toContain('whose entire meaning is temporary')
  })

  it('rejects hallucinated evidence, non-durable shapes and credential-like content', () => {
    const input = {
      messages: [{ seq: 1, text: '我长期喜欢喝咖啡' }],
      scope: { type: 'workspace' as const, id: 'workspace-a' },
    }
    expect(() => parseMemoryFormationOutput(POSITIVE_OUTPUT, input)).toThrow(/exact human-message substring/)
    expect(() => parseMemoryFormationOutput(JSON.stringify({
      schemaVersion: 1,
      proposals: [{
        kind: 'semantic', statement: '测试', predicate: 'preference.test', objectValue: '测试',
        confidence: 0.9, importance: 0.5, sensitivity: 'personal', evidence: '我长期喜欢喝咖啡',
        durability: 'ephemeral', validFrom: null, validTo: null,
      }],
    }), input)).toThrow(/durability must be cross-session/)
    expect(() => parseMemoryFormationOutput(JSON.stringify({
      schemaVersion: 1,
      proposals: [{
        kind: 'semantic', statement: '用户的 API key', predicate: 'account.api_key', objectValue: 'sk-abcdefghijk',
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
    const proposal = parseMemoryFormationOutput(POSITIVE_OUTPUT, {
      messages: [{ seq: 2, text: prompt }],
      scope: { type: 'workspace', id: 'workspace-a' },
    })[0]!

    await expect(processInferenceJobs(gateway, {
      form: input => Promise.resolve({ route: { ...input.route, reasoningEffort: 'off' }, proposals: [proposal] }),
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
    expect(store.claimOutbox(10, 60_000, 'infer-turn-candidates')).toEqual([])
    expect(store.getOutbox(job.id)).toMatchObject({ status: 'completed', payload: {} })
    expect(store.claimOutbox(10, 60_000, 'unrelated-job')).toEqual([expect.objectContaining({ id: unrelatedJob.id })])
  })

  it('records a successful no-memory decision without creating claims or source plaintext', async () => {
    const { gateway, store } = fixture()
    store.enqueue('infer-turn-candidates', jobPayload('不要调用任何工具，请只回复 TELOS_OK', 'negative'), 'infer:negative')

    await processInferenceJobs(gateway, {
      form: input => Promise.resolve({ route: input.route, proposals: [] as FormedMemoryProposal[] }),
    })

    expect(store.listClaims()).toEqual([])
    expect(store.listSourceEpisodes()).toEqual([])
    expect(store.listActionReceipts()).toEqual([expect.objectContaining({ action: 'memory.formation', result: 'succeeded' })])
  })
})
