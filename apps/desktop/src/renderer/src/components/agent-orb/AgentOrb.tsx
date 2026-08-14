import { useEffect, useRef, type CanvasHTMLAttributes } from 'react'
import { drawAgentOrb } from './orbEngine'

export interface AgentOrbProps extends Omit<CanvasHTMLAttributes<HTMLCanvasElement>, 'width' | 'height'> {
  size?: number
  state?: 'idle' | 'working'
}

export function AgentOrb({ size = 64, state = 'idle', style, ...props }: AgentOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    const pixelRatio = Math.min(2, window.devicePixelRatio || 1)
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    canvas.width = Math.round(size * pixelRatio)
    canvas.height = Math.round(size * pixelRatio)

    const render = (time: number): void => {
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.clearRect(0, 0, size, size)
      drawAgentOrb(context, size, time, darkQuery.matches, state === 'working')
    }

    if (reducedMotionQuery.matches) {
      render(0.8)
      return
    }

    let frameId = 0
    let isVisible = true
    let isRunning = false

    const loop = (): void => {
      render(performance.now() / 1000)
      if (isRunning) frameId = requestAnimationFrame(loop)
    }

    const start = (): void => {
      if (isRunning || !isVisible || document.visibilityState === 'hidden') return
      isRunning = true
      frameId = requestAnimationFrame(loop)
    }

    const stop = (): void => {
      isRunning = false
      cancelAnimationFrame(frameId)
    }

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      isVisible = entry.isIntersecting
      if (isVisible) start()
      else stop()
    })

    const handleVisibility = (): void => {
      if (document.visibilityState === 'hidden') stop()
      else start()
    }

    const handleTheme = (): void => render(performance.now() / 1000)

    observer.observe(canvas)
    document.addEventListener('visibilitychange', handleVisibility)
    darkQuery.addEventListener('change', handleTheme)
    render(performance.now() / 1000)
    start()

    return () => {
      stop()
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
      darkQuery.removeEventListener('change', handleTheme)
    }
  }, [size, state])

  return (
    <canvas
      {...props}
      ref={canvasRef}
      role="img"
      style={{ display: 'block', height: size, width: size, ...style }}
    />
  )
}
