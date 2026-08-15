/// <reference types="vite/client" />

import type {
  RuntimeEvent,
  RuntimePromptRequest,
  RuntimeRunResult,
  RuntimeStatus,
} from '@telos/runtime-contracts'
import type { DshWebSnapshot } from '../../shared/dsh-web'
import type { EditorPanelPreferences } from '../../shared/workbench-preferences'

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
      workbench: {
        getEditorPanels: (workspace: string) => Promise<EditorPanelPreferences | undefined>
        setEditorPanels: (workspace: string, value: EditorPanelPreferences) => Promise<void>
      }
    }
  }
}

export {}
