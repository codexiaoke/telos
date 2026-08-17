import { CompanionEngine, type CompanionRenderer } from '@petwhale/core'
import { isPetChoiceId, type PetChoiceId } from '@petwhale/electron-host/settings'
import { OrbRenderer } from '@petwhale/renderer-orb'
import {
  SpriteRenderer,
  isCustomPetId,
  isCustomPetManifest,
  isSpritePetId,
  spritePetById,
} from '@petwhale/renderer-sprite'
import type { CompanionConfig } from '../../../shared/companion'
import { TelosIpcCompanionSource } from './pet-source'
import './style.css'

const container = document.getElementById('pet')
const label = document.getElementById('label')
if (!(container instanceof HTMLElement) || !(label instanceof HTMLElement)) {
  throw new Error('Telos companion renderer surface is incomplete')
}
const petContainer = container

const source = new TelosIpcCompanionSource()
const engine = new CompanionEngine(source, {
  behaviorPolicy: { sleepAfterMs: 3 * 60_000 },
})
let selected: PetChoiceId | undefined
let generation = 0

async function applyConfig(config: CompanionConfig): Promise<void> {
  document.body.classList.toggle('locked', config.locked)
  const requested = isPetChoiceId(config.pet) ? config.pet : 'orb'
  const custom = isCustomPetManifest(config.customPet) && config.customPet.id === requested
    ? config.customPet
    : undefined
  const pet = isCustomPetId(requested) && custom === undefined ? 'orb' : requested
  if (pet === selected) return
  selected = pet
  const currentGeneration = ++generation
  const renderer: CompanionRenderer = custom !== undefined
    ? new SpriteRenderer(custom)
    : isSpritePetId(pet)
      ? new SpriteRenderer(spritePetById(pet))
      : new OrbRenderer()
  try {
    await engine.setRenderer(renderer, petContainer, { scale: pet === 'orb' ? 1.5 : 1 })
    if (currentGeneration !== generation) renderer.dispose()
  } catch (error) {
    renderer.dispose()
    window.telos.companion.reportRendererError(error instanceof Error ? error.message : String(error))
    if (currentGeneration === generation && pet !== 'orb') {
      selected = undefined
      await applyConfig({ ...config, pet: 'orb', customPet: undefined })
    }
  }
}

source.start()
engine.start()
void applyConfig({ locked: false, size: 'large', pet: 'orb' })
window.telos.companion.onConfig(config => void applyConfig(config))

engine.onUpdate(() => {
  const snapshot = engine.getLastSnapshot()
  const text = snapshot?.activity?.label
    ?? (snapshot !== null && snapshot.state !== 'idle' && snapshot.state !== 'sleeping' ? snapshot.state : '')
  label.textContent = text
  label.style.opacity = text.length > 0 ? '1' : '0'
})

container.addEventListener('contextmenu', (event) => {
  event.preventDefault()
  window.telos.companion.showMenu()
})
