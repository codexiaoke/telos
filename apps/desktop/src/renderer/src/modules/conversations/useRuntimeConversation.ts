import { useCallback, useEffect, useState } from 'react'
import type { RuntimeEvent, RuntimeStatus } from '@telos/runtime-contracts'

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  state: 'streaming' | 'complete' | 'error'
}

export interface ActivityEntry {
  id: string
  title: string
  detail: string
  tone: 'active' | 'success' | 'error' | 'neutral'
}

function activityFor(event: RuntimeEvent): ActivityEntry | undefined {
  const detail = event.source?.sequence === undefined ? 'DSH Runtime' : `DSH 事件 #${event.source.sequence}`
  switch (event.type) {
    case 'run.started':
      return { id: `${event.runId}-${event.sequence}`, title: `已启动 ${event.data.route.model}`, detail, tone: 'active' }
    case 'turn.started':
      return { id: `${event.runId}-${event.sequence}`, title: `开始第 ${event.data.turn} 轮`, detail, tone: 'active' }
    case 'output.phase':
      return {
        id: `${event.runId}-${event.sequence}`,
        title: event.data.phase === 'thinking' ? '正在思考' : '正在组织回答',
        detail,
        tone: 'active',
      }
    case 'tool.started':
      return { id: `${event.runId}-${event.sequence}`, title: `调用 ${event.data.toolName}`, detail, tone: 'active' }
    case 'tool.finished':
      return {
        id: `${event.runId}-${event.sequence}`,
        title: event.data.isError ? '工具调用失败' : '工具调用完成',
        detail,
        tone: event.data.isError ? 'error' : 'success',
      }
    case 'output.committed':
      return { id: `${event.runId}-${event.sequence}`, title: '回答已提交', detail, tone: 'success' }
    case 'run.completed':
      return { id: `${event.runId}-${event.sequence}`, title: '本轮运行完成', detail: '进程已安全关闭', tone: 'success' }
    case 'run.failed':
      return { id: `${event.runId}-${event.sequence}`, title: '本轮运行失败', detail: event.data.message, tone: 'error' }
    default:
      return undefined
  }
}

function updateAssistant(
  messages: ConversationMessage[],
  runId: string,
  update: (message: ConversationMessage) => ConversationMessage,
): ConversationMessage[] {
  const id = `${runId}:assistant`
  return messages.map((message) => (message.id === id ? update(message) : message))
}

export function useRuntimeConversation() {
  const [status, setStatus] = useState<RuntimeStatus>()
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [phase, setPhase] = useState('等待任务')

  useEffect(() => {
    void window.telos.runtime.getStatus().then(setStatus).catch((error: unknown) => {
      setStatus({
        descriptor: {
          id: 'dsh',
          displayName: 'DeepSeek Harness',
          capabilities: [],
          limitations: [],
          defaultRoute: { provider: 'deepseek-official', model: 'deepseek-v4-pro' },
        },
        availability: 'unavailable',
        detail: error instanceof Error ? error.message : String(error),
      })
    })

    return window.telos.runtime.onEvent((event) => {
      const activity = activityFor(event)
      if (activity !== undefined) setActivities((current) => [activity, ...current].slice(0, 12))

      switch (event.type) {
        case 'run.started':
          setIsRunning(true)
          setPhase('正在连接 DSH')
          break
        case 'session.status':
          if (event.data.status === 'running') setPhase('Agent 正在运行')
          break
        case 'output.phase':
          setPhase(event.data.phase === 'thinking' ? '正在思考' : '正在回答')
          break
        case 'output.delta':
          setMessages((current) => updateAssistant(current, event.runId, (message) => ({
            ...message,
            content: message.content + event.data.text,
          })))
          break
        case 'output.committed':
          setMessages((current) => updateAssistant(current, event.runId, (message) => ({
            ...message,
            content: event.data.text,
            state: 'complete',
          })))
          break
        case 'run.completed':
          setMessages((current) => updateAssistant(current, event.runId, (message) => ({
            ...message,
            content: event.data.finalResponse || message.content,
            state: 'complete',
          })))
          setIsRunning(false)
          setPhase('运行完成')
          break
        case 'run.failed':
          setMessages((current) => updateAssistant(current, event.runId, (message) => ({
            ...message,
            content: event.data.message,
            state: 'error',
          })))
          setIsRunning(false)
          setPhase('运行失败')
      }
    })
  }, [])

  const send = useCallback(async (input: string): Promise<void> => {
    const trimmed = input.trim()
    if (trimmed.length === 0 || isRunning || status?.availability !== 'ready') return

    const runId = crypto.randomUUID()
    setMessages((current) => [
      ...current,
      { id: `${runId}:user`, role: 'user', content: trimmed, state: 'complete' },
      { id: `${runId}:assistant`, role: 'assistant', content: '', state: 'streaming' },
    ])
    setIsRunning(true)
    setPhase('正在启动 DSH')

    try {
      const result = await window.telos.runtime.run({
        runId,
        conversationId: 'local-default',
        input: trimmed,
      })
      setMessages((current) => updateAssistant(current, runId, (message) => ({
        ...message,
        content: result.finalResponse || message.content,
        state: 'complete',
      })))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setMessages((current) => updateAssistant(current, runId, (item) => ({
        ...item,
        content: message,
        state: 'error',
      })))
      setIsRunning(false)
      setPhase('运行失败')
    }
  }, [isRunning, status?.availability])

  return { status, messages, activities, isRunning, phase, send }
}
