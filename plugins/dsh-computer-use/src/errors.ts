/** Closed Computer Use failure vocabulary reported to the model and Settings. */

export type ComputerUseErrorCode =
  | 'COMPUTER_PROVIDER_FAILURE'
  | 'COMPUTER_UNSUPPORTED_PLATFORM'
  | 'COMPUTER_PERMISSION_REQUIRED'
  | 'COMPUTER_CANCELLED'
  | 'COMPUTER_TIMEOUT'
  | 'COMPUTER_STALE_OBSERVATION'
  | 'COMPUTER_ELEMENT_UNAVAILABLE'
  | 'COMPUTER_APP_NOT_FOUND'
  | 'COMPUTER_TARGET_UNAVAILABLE'
  | 'COMPUTER_TARGET_AMBIGUOUS'
  | 'COMPUTER_TARGET_LOW_CONFIDENCE'
  | 'COMPUTER_TARGET_REBIND_REQUIRES_CONFIRMATION'
  | 'COMPUTER_ACTION_BLOCKED'
  | 'COMPUTER_CONFIRMATION_REQUIRED'

/** Structured failure used at every provider and Service boundary. */
export class ComputerUseError extends Error {
  constructor(
    readonly code: ComputerUseErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'ComputerUseError'
  }
}

/** Preserve an existing structured failure or wrap an arbitrary one as a provider failure. */
export function computerUseError(error: unknown, fallback: string): ComputerUseError {
  if (error instanceof ComputerUseError) return error
  const message = error instanceof Error ? error.message : String(error)
  return new ComputerUseError('COMPUTER_PROVIDER_FAILURE', `${fallback}: ${message}`, { cause: error })
}
