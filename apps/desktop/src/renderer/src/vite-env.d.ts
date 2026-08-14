/// <reference types="vite/client" />

import type {
  RuntimeEvent,
  RuntimePromptRequest,
  RuntimeRunResult,
  RuntimeStatus,
} from '@telos/runtime-contracts'
import type { DshWebSnapshot } from '../../shared/dsh-web'

interface TelosAppInfo {
  name: string
  version: string
  platform: string
}

declare global {
  interface Window {
    telos: {
      system: {
        getAppInfo: () => Promise<TelosAppInfo>
      }
      dshWeb: {
        getStatus: () => Promise<DshWebSnapshot>
        retry: () => Promise<void>
        onStatus: (observer: (snapshot: DshWebSnapshot) => void) => () => void
      }
      runtime: {
        getStatus: () => Promise<RuntimeStatus>
        run: (request: RuntimePromptRequest) => Promise<RuntimeRunResult>
        onEvent: (observer: (event: RuntimeEvent) => void) => () => void
      }
    }
  }
}

export {}
