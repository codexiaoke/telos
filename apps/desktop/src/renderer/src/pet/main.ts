import { CompanionEngine, type CompanionRenderer } from '@petwhale/core'
import { isPetChoiceId, type PetChoiceId } from '@petwhale/electron-host/settings'
import { Live2DRenderer, isLive2DPetManifest } from '@petwhale/renderer-live2d'
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
const conversation = document.getElementById('conversation')
const conversationTitle = document.getElementById('conversation-title')
const conversationMessage = document.getElementById('conversation-message')
const conversationCount = document.getElementById('conversation-count')
const focusWorkbench = document.getElementById('focus-workbench')
const toggleConversation = document.getElementById('toggle-conversation')
if (
  !(container instanceof HTMLElement)
  || !(conversation instanceof HTMLElement)
  || !(conversationTitle instanceof HTMLElement)
  || !(conversationMessage instanceof HTMLElement)
  || !(conversationCount instanceof HTMLElement)
  || !(focusWorkbench instanceof HTMLButtonElement)
  || !(toggleConversation instanceof HTMLButtonElement)
) {
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
  const live2d = isLive2DPetManifest(config.customPet) && config.customPet.id === requested
    ? config.customPet
    : undefined
  const pet = isCustomPetId(requested) && custom === undefined && live2d === undefined ? 'orb' : requested
  if (pet === selected) return
  selected = pet
  const currentGeneration = ++generation
  const renderer: CompanionRenderer = live2d !== undefined
    ? new Live2DRenderer(live2d)
    : custom !== undefined
      ? new SpriteRenderer(custom)
    : isSpritePetId(pet)
      ? new SpriteRenderer(spritePetById(pet))
      : new OrbRenderer()
  try {
    await engine.setRenderer(renderer, petContainer, {
      scale: pet === 'orb' ? 1.5 : 1,
      onIntrinsicSize: size => window.telos.companion.reportIntrinsicSize(size.width, size.height),
    })
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
  const message = source.getConversation()
  document.body.classList.toggle('has-conversation', message !== undefined)
  conversationTitle.textContent = message === undefined
    ? ''
    : `${message.title} (${message.activeCount})`
  conversationMessage.textContent = message?.message ?? ''
  conversationCount.textContent = String(message?.activeCount ?? 0)
  toggleConversation.disabled = message === undefined
})

focusWorkbench.addEventListener('click', () => window.telos.companion.focusWorkbench())
toggleConversation.addEventListener('click', () => {
  const collapsed = document.body.classList.toggle('conversation-collapsed')
  toggleConversation.setAttribute('aria-label', collapsed ? '展开会话消息' : '收起会话消息')
})

container.addEventListener('contextmenu', (event) => {
  event.preventDefault()
  window.telos.companion.showMenu()
})
