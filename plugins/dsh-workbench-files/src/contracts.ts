export const WORKBENCH_FILES_RPC_CHANNEL = '/telos-workbench-files'

export interface WorkbenchFileEntry {
  name: string
  path: string
  kind: 'directory' | 'file'
  hidden: boolean
}

export interface WorkbenchDirectoryView {
  path: string
  entries: WorkbenchFileEntry[]
  truncated: boolean
}

export interface WorkbenchTextFile {
  path: string
  content: string
  revision: string
  mtimeMs: number
  size: number
}

export type WorkbenchFilesRpcResult<T> =
  | { ok: true; value: T }
  | {
    ok: false
    error: {
      code: 'bad-request'
      message: string
      details: { issues: never[] }
    } | {
      code: 'internal'
      message: string
      details: Record<string, never>
    }
  }
