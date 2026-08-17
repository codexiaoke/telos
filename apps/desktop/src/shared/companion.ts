import type {
  CustomPetRendererConfig,
  PetChoiceId,
  PetSettings,
  PetSnapshot,
} from '@petwhale/electron-host'

export type CompanionSnapshot = PetSnapshot

export const COMPANION_SIZE_PERCENT_MIN = 50
export const COMPANION_SIZE_PERCENT_MAX = 150
export const COMPANION_SIZE_PERCENT_STEP = 5
export const COMPANION_SIZE_PERCENT_DEFAULT = 100
export const COMPANION_SIZE_PERCENT_LEGACY_SMALL = 67

export function normalizeCompanionSizePercent(
  value: unknown,
  legacySize: PetSettings['size'] = 'large',
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return legacySize === 'small'
      ? COMPANION_SIZE_PERCENT_LEGACY_SMALL
      : COMPANION_SIZE_PERCENT_DEFAULT
  }
  return Math.min(
    COMPANION_SIZE_PERCENT_MAX,
    Math.max(COMPANION_SIZE_PERCENT_MIN, Math.round(value)),
  )
}

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
  sizePercent: number
  minSizePercent: number
  maxSizePercent: number
  stepSizePercent: number
  pets: readonly CompanionPetOption[]
}

export interface CompanionSettingsPatch {
  visible?: boolean
  locked?: boolean
  sizePercent?: number
  pet?: PetChoiceId
}

export type CompanionImportKind = 'image' | 'live2d'
