import { useCallback, useEffect, useState } from 'react'
import type { DshWebSnapshot } from '../../../shared/dsh-web'

const INITIAL_SNAPSHOT: DshWebSnapshot = {
  state: 'idle',
  recentOutput: [],
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Local bootstrap state; the complete workbench replaces this document once ready. */
export function useDshWebStatus() {
  const [snapshot, setSnapshot] = useState<DshWebSnapshot>(INITIAL_SNAPSHOT)
  const [retrying, setRetrying] = useState(false)
  const [bridgeError, setBridgeError] = useState<string>()

  useEffect(() => {
    let disposed = false
    let receivedEvent = false
    const unsubscribe = window.telos.dshWeb.onStatus((next) => {
      if (disposed) return
      receivedEvent = true
      setSnapshot(next)
      setBridgeError(undefined)
      if (next.state === 'failed' || next.state === 'ready') setRetrying(false)
    })

    void window.telos.dshWeb.getStatus().then(
      (next) => {
        if (!disposed && !receivedEvent) setSnapshot(next)
      },
      (error: unknown) => {
        if (!disposed) setBridgeError(messageOf(error))
      },
    )

    return () => {
      disposed = true
      unsubscribe()
    }
  }, [])

  const retry = useCallback((): void => {
    setRetrying(true)
    setBridgeError(undefined)
    void window.telos.dshWeb.retry().catch((error: unknown) => {
      setRetrying(false)
      setBridgeError(messageOf(error))
    })
  }, [])

  return {
    snapshot,
    retry,
    retrying,
    bridgeError,
  }
}
