import { MULTIMODAL_RPC_CHANNEL, type MultimodalSettings, type MultimodalSettingsView } from '../contracts.js'
import type { ClientRpc, MultimodalClientSnapshot } from './contracts.js'

const EMPTY: MultimodalClientSnapshot = { loading: false }

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export class MultimodalClientController {
  private snapshot = EMPTY
  private readonly listeners = new Set<() => void>()

  constructor(private readonly rpc: ClientRpc) {}

  getSnapshot = (): MultimodalClientSnapshot => this.snapshot
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async refresh(): Promise<void> { await this.run('get', {}, undefined) }
  async save(settings: MultimodalSettings): Promise<void> { await this.run('save', settings, '多模态模型配置已保存') }
  async reset(): Promise<void> { await this.run('reset', {}, '已恢复默认多模态配置') }

  private async run(endpoint: string, payload: unknown, notice: string | undefined): Promise<void> {
    this.update({ loading: true, error: undefined, notice: undefined })
    try {
      const result = await this.rpc.call(MULTIMODAL_RPC_CHANNEL, endpoint, payload)
      if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
      this.update({ view: result.value as MultimodalSettingsView, loading: false, notice })
    } catch (error) {
      this.update({ loading: false, error: message(error) })
    }
  }

  private update(patch: Partial<MultimodalClientSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }
}
