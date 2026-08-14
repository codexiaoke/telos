export type UpdateStatus =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateSnapshot {
  status: UpdateStatus
  version?: string
  progressPercent?: number
  checkedAt?: string
  detail?: string
}
