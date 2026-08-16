export const PERSONALIZATION_RPC_CHANNEL = '/telos-personalization'
export const MAX_PERSONAL_INSTRUCTIONS_BYTES = 64 * 1024

export interface PersonalizationView {
  instructions: string
  configured: boolean
  byteLength: number
  maxBytes: number
}

export type PersonalizationRpcError =
  | { code: 'bad-request'; message: string; details: { issues: never[] } }
  | { code: 'internal'; message: string; details: Record<string, never> }

export type PersonalizationRpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: PersonalizationRpcError }

export function instructionByteLength(instructions: string): number {
  return Buffer.byteLength(instructions, 'utf8')
}

export function validatePersonalInstructions(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('instructions must be a string')
  const bytes = instructionByteLength(value)
  if (bytes > MAX_PERSONAL_INSTRUCTIONS_BYTES) {
    throw new RangeError(`instructions must not exceed ${String(MAX_PERSONAL_INSTRUCTIONS_BYTES)} UTF-8 bytes`)
  }
  return value
}

export function personalizationView(instructions: string): PersonalizationView {
  const validated = validatePersonalInstructions(instructions)
  return {
    instructions: validated,
    configured: validated.trim().length > 0,
    byteLength: instructionByteLength(validated),
    maxBytes: MAX_PERSONAL_INSTRUCTIONS_BYTES,
  }
}
