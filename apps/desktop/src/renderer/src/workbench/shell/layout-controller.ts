import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import type { createTelosLayoutStore } from './layout-store'

export type PanelActions = BoundActions<ReturnType<typeof createTelosLayoutStore>>

/** Exact outward service face consumed by DSH sidebar and conversation UI. */
export interface TelosLayoutService {
  toggleSidebar(): void
  openDetails(): void
  closeDetails(): void
}

export class TelosLayoutController implements TelosLayoutService {
  #panels: PanelActions | undefined

  attachPanels(actions: PanelActions): void {
    this.#panels = actions
  }

  toggleSidebar(): void {
    this.#requirePanels().toggleSidebar()
  }

  openDetails(): void {
    this.#requirePanels().openDetails()
  }

  closeDetails(): void {
    this.#requirePanels().closeDetails()
  }

  #requirePanels(): PanelActions {
    if (this.#panels === undefined) {
      throw new Error('Telos layout actions are unavailable before the root Slot mounts')
    }
    return this.#panels
  }
}
