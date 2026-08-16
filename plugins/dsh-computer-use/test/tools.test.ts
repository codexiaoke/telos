import { describe, expect, it } from 'vitest'
import type { ComputerUseService } from '../src/service.js'
import { createComputerUseTools } from '../src/tools.js'

describe('Computer Use tools', () => {
  it('exposes a dedicated open-app tool before observation and input tools', () => {
    const tools = createComputerUseTools({} as ComputerUseService)
    expect(tools.map(tool => tool.name)).toEqual([
      'computer_list_apps',
      'computer_open_app',
      'computer_use',
      'computer_observe',
      'computer_click',
      'computer_set_value',
      'computer_type_text',
      'computer_press_key',
      'computer_scroll',
      'computer_drag',
      'computer_move',
      'computer_perform_action',
      'computer_wait',
      'computer_confirm',
    ])
  })

  it('renders the fresh computer_use screenshot in-band for the next model turn', () => {
    const tool = createComputerUseTools({} as ComputerUseService).find(candidate => candidate.name === 'computer_use')
    const attachment = {
      attachmentId: 'screen-1',
      mediaType: 'image/png' as const,
      bytes: 4,
      width: 800,
      height: 600,
    }
    const render = tool?.output?.render
    expect(render).toBeTypeOf('function')
    const blocks = render?.({}, { observation: { screenshot: { attachment } } })
    expect(blocks).toEqual([
      { type: 'text', text: JSON.stringify({ observation: { screenshot: { attachment } } }, null, 2) },
      { type: 'image', attachment },
    ])
  })
})
