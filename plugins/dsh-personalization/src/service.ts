import { personalizationView, type PersonalizationView } from './contracts.js'
import type { PersonalInstructionsStore } from './store.js'

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('payload must be an object')
  }
  return value as Record<string, unknown>
}

export class PersonalizationService {
  constructor(private readonly store: PersonalInstructionsStore) {}

  handle(endpoint: string, payload: unknown): PersonalizationView {
    if (endpoint === 'get') return personalizationView(this.store.load())
    if (endpoint === 'save') return personalizationView(this.store.save(object(payload).instructions))
    if (endpoint === 'reset') return personalizationView(this.store.reset())
    throw new TypeError(`unsupported personalization endpoint: ${endpoint}`)
  }
}
