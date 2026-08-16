import { PERSONALIZATION_RPC_CHANNEL, type PersonalizationView } from '../contracts.js'
import type { ClientRpc, PersonalizationClientSnapshot } from './contracts.js'

const EMPTY: PersonalizationClientSnapshot = { loading: false }

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export class PersonalizationClientController {
  private snapshot = EMPTY
  private readonly listeners = new Set<() => void>()

  constructor(private readonly rpc: ClientRpc) {}

  getSnapshot = (): PersonalizationClientSnapshot => this.snapshot
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async refresh(): Promise<void> { await this.run('get', {}, undefined) }
  async save(instructions: string): Promise<void> {
    await this.run('save', { instructions }, instructions.trim().length > 0 ? '个性化指令已保存' : '个性化指令已清空')
  }
  async reset(): Promise<void> { await this.run('reset', {}, '个性化指令已清空') }

  private async run(endpoint: string, payload: unknown, notice: string | undefined): Promise<void> {
    this.update({ loading: true, error: undefined, notice: undefined })
    try {
      const result = await this.rpc.call(PERSONALIZATION_RPC_CHANNEL, endpoint, payload)
      if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
      this.update({ view: result.value as PersonalizationView, loading: false, notice })
    } catch (error) {
      this.update({ loading: false, error: message(error) })
    }
  }

  private update(patch: Partial<PersonalizationClientSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }
}
