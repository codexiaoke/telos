export const MULTI_ROOT_WORKSPACE_RPC_CHANNEL = '/telos-multi-root-workspace'

export interface WorkspaceRoot {
  id: string
  label: string
  path: string
  primary: boolean
}

export interface WorkspaceGroup {
  workspaceId: string
  title: string
  primaryRootId: string
  roots: WorkspaceRoot[]
  updatedAt: string
}

export interface WorkspaceGroupRecord {
  workspaceId: string
  primaryRootId: string
  roots: WorkspaceRoot[]
  updatedAt: string
}

export interface CreateWorkspaceGroupInput {
  title?: string
  paths: string[]
}

export type MultiRootWorkspaceRpcResult<T> =
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
