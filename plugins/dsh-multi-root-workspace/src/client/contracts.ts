import type { WorkspaceGroup } from '../contracts.js'

export interface ClientRpc {
  call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<
    | { ok: true; value: unknown }
    | { ok: false; error: { code: string; message: string } }
  >
}

export interface MultiRootWorkspaceClient {
  pickDirectory(): Promise<string | null>
  create(input: { title?: string; paths: string[] }): Promise<WorkspaceGroup>
}
