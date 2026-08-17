import type { CompanionSnapshot as CoreCompanionSnapshot, CompanionSource } from '@petwhale/core'
import type { CompanionConversation, CompanionSnapshot } from '../../../shared/companion'

export class TelosIpcCompanionSource implements CompanionSource {
  private snapshot: CompanionSnapshot = {
    state: 'idle',
    emotion: 'neutral',
    since: Date.now(),
    context: { host: 'telos' },
  }
  private readonly listeners = new Set<() => void>()
  private unsubscribe: (() => void) | undefined

  getSnapshot(): CoreCompanionSnapshot {
    return this.snapshot as CoreCompanionSnapshot
  }

  getConversation(): CompanionConversation | undefined {
    return this.snapshot.conversation
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  start(): void {
    this.unsubscribe ??= window.telos.companion.onState((snapshot) => {
      // The Electron-host contract is a dependency-free structural mirror of
      // the Core snapshot and is validated in the main process before IPC.
      this.snapshot = snapshot as CompanionSnapshot
      for (const listener of this.listeners) listener()
    })
  }

  dispose(): void {
    this.unsubscribe?.()
    this.unsubscribe = undefined
    this.listeners.clear()
  }
}
