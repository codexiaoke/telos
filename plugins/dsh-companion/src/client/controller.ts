import type {
  CompanionDesktopApi,
  CompanionImportKind,
  CompanionSettingsPatch,
  CompanionSettingsView,
} from './contracts.js'

export interface CompanionClientState {
  loading: boolean
  view?: CompanionSettingsView
  error?: string
  notice?: string
}

export class CompanionClientController {
  private state: CompanionClientState = { loading: false }
  private readonly listeners = new Set<() => void>()
  private unsubscribeDesktop: (() => void) | undefined

  constructor(private readonly resolveApi: () => CompanionDesktopApi | undefined) {}

  readonly getSnapshot = (): CompanionClientState => this.state
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  start(): () => void {
    const api = this.resolveApi()
    if (api !== undefined && this.unsubscribeDesktop === undefined) {
      this.unsubscribeDesktop = api.onSettingsChanged(view => this.update({ view, loading: false }))
    }
    return () => this.dispose()
  }

  dispose(): void {
    this.unsubscribeDesktop?.()
    this.unsubscribeDesktop = undefined
    this.listeners.clear()
  }

  async refresh(): Promise<void> {
    await this.run(api => api.getSettings())
  }

  async updateSettings(patch: CompanionSettingsPatch): Promise<void> {
    await this.run(api => api.updateSettings(patch))
  }

  async importPet(kind: CompanionImportKind): Promise<void> {
    await this.run(api => api.importPet(kind), kind === 'live2d' ? 'Live2D 宠物已导入' : '图片宠物已导入')
  }

  async removePet(id: string): Promise<void> {
    await this.run(api => api.removePet(id), '自定义宠物已删除')
  }

  private async run(
    operation: (api: CompanionDesktopApi) => Promise<CompanionSettingsView>,
    notice?: string,
  ): Promise<void> {
    const api = this.resolveApi()
    if (api === undefined) {
      this.update({ loading: false, error: '桌面宠物设置仅在 Telos 桌面版中可用。' })
      return
    }
    this.update({ loading: true, error: undefined, notice: undefined })
    try {
      const view = await operation(api)
      this.update({ view, loading: false, notice })
    } catch (error) {
      this.update({ loading: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  private update(patch: Partial<CompanionClientState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }
}
