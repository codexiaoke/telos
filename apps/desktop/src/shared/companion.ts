import type {
  CustomPetRendererConfig,
  PetChoiceId,
  PetSettings,
  PetSnapshot,
} from '@petwhale/electron-host'

export interface CompanionConversation {
  sessionId: string
  title: string
  message: string
  activeCount: number
}

export interface CompanionSnapshot extends PetSnapshot {
  conversation?: CompanionConversation
}

export const COMPANION_SIZE_PERCENT_MIN = 50
export const COMPANION_SIZE_PERCENT_MAX = 150
export const COMPANION_SIZE_PERCENT_STEP = 5
export const COMPANION_SIZE_PERCENT_DEFAULT = 100
export const COMPANION_SIZE_PERCENT_LEGACY_SMALL = 67
export const COMPANION_WINDOW_BASE_LONG_EDGE = 320
export const COMPANION_ASPECT_RATIO_MIN = 0.5
export const COMPANION_ASPECT_RATIO_MAX = 2

export function normalizeCompanionAspectRatio(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 1
  return Math.min(COMPANION_ASPECT_RATIO_MAX, Math.max(COMPANION_ASPECT_RATIO_MIN, width / height))
}

export function companionWindowSize(
  sizePercent: number,
  aspectRatio = 1,
): { width: number; height: number } {
  const longEdge = Math.round(COMPANION_WINDOW_BASE_LONG_EDGE * sizePercent / 100)
  const normalizedAspectRatio = normalizeCompanionAspectRatio(aspectRatio, 1)
  if (normalizedAspectRatio <= 1) {
    return {
      width: Math.round(longEdge * normalizedAspectRatio),
      height: longEdge,
    }
  }
  return {
    width: longEdge,
    height: Math.round(longEdge / normalizedAspectRatio),
  }
}

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
  live2dSoundEnabled: boolean
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
  live2dSoundEnabled: boolean
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
  live2dSoundEnabled?: boolean
  sizePercent?: number
  pet?: PetChoiceId
}

export type CompanionImportKind = 'image' | 'live2d'
