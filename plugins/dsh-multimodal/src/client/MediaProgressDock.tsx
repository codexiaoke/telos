import { useCallback, useSyncExternalStore } from 'react'
import type { MediaKind, MediaProgress } from '../contracts.js'
import type { MediaProgressController } from './progress-controller.js'

export interface MediaProgressInjected { progressController: MediaProgressController }

interface MediaProgressDockProps extends MediaProgressInjected {
  session: { sessionId: string }
}

function kindName(kind: MediaKind): string {
  if (kind === 'video') return '视频'
  if (kind === 'audio') return '语音'
  return '图片'
}

function duration(ms: number): string {
  return ms < 1_000 ? `${ms} ms` : `${(ms / 1_000).toFixed(1)} s`
}

function primary(progress: MediaProgress): string {
  const name = kindName(progress.kind)
  if (progress.state === 'completed') return `${name}识别完成`
  if (progress.state === 'failed') return `${name}识别失败`
  return `识别${name}中...`
}

function Detail({ progress }: { progress: MediaProgress }) {
  const route = `${progress.perceptionRoute.provider}/${progress.perceptionRoute.model}`
  if (progress.state === 'failed') {
    return <span className="telosMmProgressDetail"><code>{progress.failure?.code ?? 'UNKNOWN'}</code><span>{progress.failure?.message ?? '未知错误'}</span><span>{duration(progress.elapsedMs)}</span></span>
  }
  if (progress.state === 'completed') {
    const usage = progress.usage
    const processedCount = progress.processedCount ?? progress.count
    return <span className="telosMmProgressDetail">
      <span>{progress.perceptionName}</span><code>{route}</code><span>{duration(progress.elapsedMs)}</span>
      <span>输入 {usage?.inputTokens ?? 0}</span><span>输出 {usage?.outputTokens ?? 0}</span>
      <span>缓存命中 {progress.cacheHits}/{processedCount}</span>
    </span>
  }
  const contextCount = progress.processedCount
  return <span className="telosMmProgressDetail">
    <span>{progress.perceptionName}</span><code>{route}</code><span>本轮 {progress.count} 张</span>
    {contextCount === undefined || contextCount === progress.count ? null : <span>上下文感知 {contextCount} 张</span>}
    <span>{duration(progress.elapsedMs)}</span>
  </span>
}

export function MediaProgressDock({ progressController, session }: MediaProgressDockProps) {
  const getSnapshot = useCallback(() => progressController.snapshot(session.sessionId), [progressController, session.sessionId])
  const progress = useSyncExternalStore(progressController.subscribe, getSnapshot, getSnapshot)
  if (progress === undefined) return null
  return <section className="telosMmProgress" data-state={progress.state} data-testid="telos-media-progress" aria-live="polite">
    <span className="telosMmProgressGlyph" aria-hidden />
    <span className="telosMmProgressBody"><strong>{primary(progress)}</strong><Detail progress={progress} /></span>
  </section>
}
