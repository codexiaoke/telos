export type UpdateStatus =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'error'

export interface UpdateSnapshot {
  status: UpdateStatus
  version?: string
  checkedAt?: string
  detail?: string
}
