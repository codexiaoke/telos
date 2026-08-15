import { describe, expect, it } from 'vitest'
import { MULTIMODAL_CLIENT_CSS } from '../src/client/styles.js'

describe('multimodal Settings styles', () => {
  it('uses the Settings body directly and provides a responsive model route', () => {
    const root = /\.telosMmSettings\{([^}]*)}/s.exec(MULTIMODAL_CLIENT_CSS)?.[1]
    expect(root).toContain('width:100%')
    expect(root).toContain('height:100%')
    expect(root).not.toContain('border:')
    expect(MULTIMODAL_CLIENT_CSS).toContain('.telosMmModelCard')
    expect(MULTIMODAL_CLIENT_CSS).toContain('@media(max-width:900px)')
  })

  it('styles the media progress row and respects reduced motion', () => {
    expect(MULTIMODAL_CLIENT_CSS).toContain('.telosMmProgress')
    expect(MULTIMODAL_CLIENT_CSS).toContain('@keyframes telosMmSpin')
    expect(MULTIMODAL_CLIENT_CSS).toContain('@media(prefers-reduced-motion:reduce)')
  })
})
