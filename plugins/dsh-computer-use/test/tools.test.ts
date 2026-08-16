import { describe, expect, it } from 'vitest'
import type { ComputerUseService } from '../src/service.js'
import { createComputerUseTools } from '../src/tools.js'

describe('Computer Use tools', () => {
  it('exposes a dedicated open-app tool before observation and input tools', () => {
    const tools = createComputerUseTools({} as ComputerUseService)
    expect(tools.map(tool => tool.name)).toEqual([
      'computer_list_apps',
      'computer_open_app',
      'computer_observe',
      'computer_click',
      'computer_set_value',
      'computer_type_text',
      'computer_press_key',
      'computer_scroll',
      'computer_drag',
      'computer_perform_action',
      'computer_wait',
      'computer_confirm',
    ])
  })
})
