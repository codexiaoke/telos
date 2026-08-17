/// <reference types="vite/client" />

import type {
  RuntimeEvent,
  RuntimePromptRequest,
  RuntimeRunResult,
  RuntimeStatus,
} from '@telos/runtime-contracts'
import type { DshWebSnapshot } from '../../shared/dsh-web'
import type { EditorPanelPreferences } from '../../shared/workbench-preferences'
import type {
  CompanionConfig,
  CompanionImportKind,
  CompanionSettingsPatch,
  CompanionSettingsView,
  CompanionSnapshot,
} from '../../shared/companion'

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
      companion: {
        onState: (observer: (snapshot: CompanionSnapshot) => void) => () => void
        onConfig: (observer: (config: CompanionConfig) => void) => () => void
        showMenu: () => void
        focusWorkbench: () => void
        reportRendererError: (message: string) => void
        getSettings: () => Promise<CompanionSettingsView>
        updateSettings: (patch: CompanionSettingsPatch) => Promise<CompanionSettingsView>
        importPet: (kind: CompanionImportKind) => Promise<CompanionSettingsView>
        removePet: (id: string) => Promise<CompanionSettingsView>
        onSettingsChanged: (observer: (view: CompanionSettingsView) => void) => () => void
      }
    }
  }
}

export {}
