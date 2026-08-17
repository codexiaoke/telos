export type CompanionPetId = 'orb' | 'whale' | 'cat' | `custom:${string}`
export type CompanionImportKind = 'image' | 'live2d'

export interface CompanionPetOption {
  id: CompanionPetId
  label: string
  kind: 'orb' | 'sprite' | 'image' | 'live2d'
  removable: boolean
}

export interface CompanionSettingsView {
  visible: boolean
  connected: boolean
  pet: CompanionPetId
  locked: boolean
  sizePercent: number
  minSizePercent: number
  maxSizePercent: number
  stepSizePercent: number
  windowWidth: number
  windowHeight: number
  pets: readonly CompanionPetOption[]
}

export interface CompanionSettingsPatch {
  visible?: boolean
  locked?: boolean
  sizePercent?: number
  pet?: CompanionPetId
}

export interface CompanionDesktopApi {
  getSettings: () => Promise<CompanionSettingsView>
  updateSettings: (patch: CompanionSettingsPatch) => Promise<CompanionSettingsView>
  importPet: (kind: CompanionImportKind) => Promise<CompanionSettingsView>
  removePet: (id: string) => Promise<CompanionSettingsView>
  onSettingsChanged: (observer: (view: CompanionSettingsView) => void) => () => void
}

declare global {
  interface Window {
    telos?: {
      companion?: CompanionDesktopApi
    }
  }
}
