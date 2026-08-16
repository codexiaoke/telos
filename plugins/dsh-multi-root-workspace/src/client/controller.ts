import { MULTI_ROOT_WORKSPACE_RPC_CHANNEL, type WorkspaceGroup } from '../contracts.js'
import type { ClientRpc, MultiRootWorkspaceClient } from './contracts.js'

export class MultiRootWorkspaceController implements MultiRootWorkspaceClient {
  constructor(private readonly rpc: ClientRpc) {}

  async pickDirectory(): Promise<string | null> {
    return this.call<string | null>('pick-directory', {})
  }

  async create(input: { title?: string; paths: string[] }): Promise<WorkspaceGroup> {
    return this.call<WorkspaceGroup>('create', input)
  }

  private async call<T>(endpoint: string, payload: unknown): Promise<T> {
    const result = await this.rpc.call(MULTI_ROOT_WORKSPACE_RPC_CHANNEL, endpoint, payload)
    if (!result.ok) throw new Error(result.error.message)
    return result.value as T
  }
}
