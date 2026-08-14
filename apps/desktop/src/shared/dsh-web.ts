/** Desktop-shell lifecycle exposed while the complete DSH Web workbench boots. */
export type DshWebState = 'idle' | 'starting' | 'ready' | 'stopping' | 'stopped' | 'failed'

/** Serializable, redacted supervisor state shared with the local bootstrap renderer. */
export interface DshWebSnapshot {
  state: DshWebState
  url?: string
  detail?: string
  recentOutput: readonly string[]
}
