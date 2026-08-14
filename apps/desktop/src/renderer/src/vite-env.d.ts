/// <reference types="vite/client" />

import type {
  RuntimeEvent,
  RuntimePromptRequest,
  RuntimeRunResult,
  RuntimeStatus,
} from '@telos/runtime-contracts'

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
      runtime: {
        getStatus: () => Promise<RuntimeStatus>
        run: (request: RuntimePromptRequest) => Promise<RuntimeRunResult>
        onEvent: (observer: (event: RuntimeEvent) => void) => () => void
      }
    }
  }
}

export {}
