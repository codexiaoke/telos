import type {
  CustomPetRendererConfig,
  PetChoiceId,
  PetSettings,
  PetSnapshot,
} from '@petwhale/electron-host'

export type CompanionSnapshot = PetSnapshot

export interface CompanionConfig extends PetSettings {
  customPet?: CustomPetRendererConfig
}

export interface CompanionStatus {
  visible: boolean
  connected: boolean
  pet: PetChoiceId
}

export interface CompanionPetOption {
  id: PetChoiceId
  label: string
  kind: 'orb' | 'sprite' | 'image' | 'live2d'
  removable: boolean
}

export interface CompanionSettingsView extends CompanionStatus {
  locked: boolean
  size: PetSettings['size']
  pets: readonly CompanionPetOption[]
}

export interface CompanionSettingsPatch {
  visible?: boolean
  locked?: boolean
  size?: PetSettings['size']
  pet?: PetChoiceId
}

export type CompanionImportKind = 'image' | 'live2d'
