import { createUserMessage, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { describe, expect, it } from 'vitest'
import { TelosMultimodalAdapter } from '../src/adapter.js'
import { encodeLogicalModel } from '../src/routes.js'

const image = {
  type: 'image' as const,
  attachment: { attachmentId: 'image-1', mediaType: 'image/png', width: 10, height: 10, bytes: 20, contentHash: 'sha256:x' },
}

function finish(): StreamChunk {
  return { type: 'finish', reason: { kind: 'stop' } } as StreamChunk
}

function fixture(mainHasImage = false) {
  const calls: GenerateOptions[] = []
  const llm = {
    listProviders: () => [{ id: 'deepseek', name: 'DeepSeek' }, { id: 'vision', name: 'Vision' }, { id: 'telos-multimodal', name: 'Telos' }],
    listModels: async (provider: string) => [{ provider, id: `${provider}-model`, name: `${provider} model`, inputModalities: provider === 'vision' || mainHasImage ? ['text', 'image'] as const : ['text'] as const }],
    resolveModelInfo: async (provider: string, model: string) => ({
      provider, id: model, name: `${provider} model`,
      inputModalities: provider === 'vision' || mainHasImage ? ['text', 'image'] as const : ['text'] as const,
    }),
    stream: (options: GenerateOptions): AsyncIterable<StreamChunk> => {
      calls.push(options)
      return (async function* () {
        if (options.provider === 'vision') {
          yield { type: 'text-delta', index: 0, text: '图片中显示 TELOS 42。' } as StreamChunk
        } else {
          yield { type: 'text-delta', index: 0, text: '最终回答' } as StreamChunk
        }
        yield finish()
      })()
    },
  }
  const adapter = new TelosMultimodalAdapter({ llm } as never, () => ({
    schemaVersion: 2, enabled: true, defaultModel: { provider: 'vision', model: 'eyes' },
  }))
  return { adapter, calls }
}

async function collect(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const output: StreamChunk[] = []
  for await (const chunk of stream) output.push(chunk)
  return output
}

function request(withImage: boolean): GenerateOptions {
  return {
    provider: 'telos-multimodal',
    model: encodeLogicalModel({ provider: 'deepseek', model: 'reasoner' }),
    messages: [createUserMessage({
      content: [...(withImage ? [image as never] : []), { type: 'text', text: '图里写了什么？' }],
      source: { kind: 'user' },
    })],
    tools: [{ name: 'read', description: 'read', parameters: { type: 'object' } }],
  }
}

describe('TelosMultimodalAdapter', () => {
  it('delegates text with zero perception calls', async () => {
    const { adapter, calls } = fixture()
    await collect(adapter.stream(request(false)))
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ provider: 'deepseek', model: 'reasoner' })
  })

  it('turns images into bounded observations and keeps the main model and tools', async () => {
    const { adapter, calls } = fixture()
    const output = await collect(adapter.stream(request(true)))
    expect(output.some(chunk => chunk.type === 'text-delta' && chunk.text === '最终回答')).toBe(true)
    expect(calls.map(call => call.provider)).toEqual(['vision', 'deepseek'])
    expect(calls[1]?.tools).toEqual(request(true).tools)
    expect(calls[1]?.messages.some(message => message.content.some(block => block.type === 'image'))).toBe(false)
    expect(calls[1]?.messages[0]?.content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('TELOS 42') })
    expect(calls[1]?.messages[0]?.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('不是 Telos、视觉模型或当前回答模型的运行状态'),
    })

    await collect(adapter.stream(request(true)))
    expect(calls.filter(call => call.provider === 'vision')).toHaveLength(1)
  })

  it('passes original images directly to a native multimodal main model', async () => {
    const { adapter, calls } = fixture(true)
    await collect(adapter.stream(request(true)))
    expect(calls).toHaveLength(1)
    expect(calls[0]?.provider).toBe('deepseek')
    expect(calls[0]?.messages[0]?.content[0]?.type).toBe('image')
  })
})
