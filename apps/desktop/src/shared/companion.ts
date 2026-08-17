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
