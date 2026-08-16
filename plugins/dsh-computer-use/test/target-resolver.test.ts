import { describe, expect, it } from 'vitest'
import type { BackendElement, BackendObservation } from '../src/backend.js'
import { ComputerUseError } from '../src/errors.js'
import { describeComputerTarget, resolveComputerTarget } from '../src/target-resolver.js'

const APP = { bundleId: 'com.example.app', pid: 42, name: 'Example' }
const WINDOW = { title: 'Main', frame: { x: 0, y: 0, width: 800, height: 600 }, id: 7 }

function element(overrides: Partial<BackendElement> = {}): BackendElement {
  return {
    index: 0,
    role: 'button',
    title: 'Save',
    actions: ['AXPress'],
    locator: [0],
    ...overrides,
  }
}

function observation(overrides: Partial<BackendObservation> = {}): BackendObservation {
  return {
    app: APP,
    stateHash: 'h1',
    frontmost: true,
    window: WINDOW,
    treeText: 'Save',
    truncated: false,
    elements: [element()],
    permissions: { accessibility: 'granted', screenRecording: 'granted' },
    ...overrides,
  }
}

function resolveFrom(
  original: BackendObservation,
  fresh: BackendObservation,
  index = 0,
  allowRebind = false,
) {
  const target = original.elements[index]!
  return resolveComputerTarget(original, fresh, describeComputerTarget(target, original), allowRebind)
}

describe('describeComputerTarget', () => {
  it('records locator, native identifier, accessible name, and available actions', () => {
    const obs = observation({
      elements: [element({ locator: [0, 2], nativeIdentifier: 'save-btn', title: 'Save', label: 'Save file', actions: ['AXPress', 'AXRaise', 'AXPress'] })],
    })
    const descriptor = describeComputerTarget(obs.elements[0]!, obs)
    expect(descriptor.locator).toEqual([0, 2])
    expect(descriptor.nativeIdentifier).toBe('save-btn')
    expect(descriptor.accessibleName).toBe('Save file')
    expect(descriptor.availableActions).toEqual(['AXPress', 'AXRaise'])
    expect(descriptor.ancestorFingerprint).toHaveLength(0)
  })

  it('normalizes frame to window coordinates when a window is present', () => {
    const obs = observation({
      window: { title: 'Main', frame: { x: 100, y: 50, width: 800, height: 600 }, id: 7 },
      elements: [element({ frame: { x: 140, y: 70, width: 80, height: 24 } })],
    })
    const descriptor = describeComputerTarget(obs.elements[0]!, obs)
    expect(descriptor.normalizedFrame).toEqual({ x: 40, y: 20, width: 80, height: 24 })
  })

  it('builds an ancestor fingerprint from locator prefixes', () => {
    const obs = observation({
      elements: [
        element({ index: 0, role: 'group', title: 'Toolbar', locator: [0], actions: [] }),
        element({ index: 1, role: 'button', title: 'Save', locator: [0, 1], actions: ['AXPress'] }),
      ],
    })
    const descriptor = describeComputerTarget(obs.elements[1]!, obs)
    expect(descriptor.ancestorFingerprint).toEqual([{ role: 'group', accessibleName: 'Toolbar' }])
  })
})

describe('resolveComputerTarget', () => {
  it('resolves an unchanged locator as exact-locator', () => {
    const result = resolveFrom(observation(), observation())
    expect(result.resolution).toEqual({ mode: 'exact-locator', confidence: 1, candidateCount: 1, targetChanged: false })
    expect(result.element.locator).toEqual([0])
  })

  it('rejects when the application process changed', () => {
    const fresh = observation({ app: { ...APP, pid: 99 } })
    expect(() => resolveFrom(observation(), fresh)).toThrowError(ComputerUseError)
    expect(() => resolveFrom(observation(), fresh)).toThrow(/restarted or resolved to a different process/)
  })

  it('rejects when the window changed', () => {
    const fresh = observation({ window: { title: 'Main', frame: { x: 0, y: 0, width: 800, height: 600 }, id: 8 } })
    expect(() => resolveFrom(observation(), fresh)).toThrow(/selected window changed/)
  })

  it('rejects a stale locator when rebinding is not allowed', () => {
    const original = observation({ elements: [element({ locator: [0], title: 'Save' })] })
    const fresh = observation({ elements: [element({ locator: [1], title: 'Save' })] })
    expect(() => resolveFrom(original, fresh)).toThrow(/rebinding was not allowed/)
  })

  it('rebinds by unique native identifier', () => {
    const original = observation({ elements: [element({ locator: [0], nativeIdentifier: 'save-btn', title: 'Save' })] })
    const fresh = observation({ elements: [element({ locator: [1], nativeIdentifier: 'save-btn', title: 'Save' })] })
    const result = resolveFrom(original, fresh, 0, true)
    expect(result.resolution.mode).toBe('native-identifier')
    expect(result.resolution.targetChanged).toBe(true)
    expect(result.element.locator).toEqual([1])
  })

  it('rejects ambiguous native identifier matches', () => {
    const original = observation({ elements: [element({ locator: [0], nativeIdentifier: 'dup', title: 'Save' })] })
    const fresh = observation({
      elements: [
        element({ index: 0, locator: [0], nativeIdentifier: 'other', title: 'Cancel' }),
        element({ index: 1, locator: [1], nativeIdentifier: 'dup', title: 'Save' }),
        element({ index: 2, locator: [2], nativeIdentifier: 'dup', title: 'Save' }),
      ],
    })
    expect(() => resolveFrom(original, fresh, 0, true)).toThrow(/found 2 candidates/)
  })

  it('rebinds by a unique semantic match', () => {
    const original = observation({ elements: [element({ locator: [0], title: 'Save' })] })
    const fresh = observation({ elements: [element({ locator: [1], title: 'Save' })] })
    const result = resolveFrom(original, fresh, 0, true)
    expect(result.resolution.mode).toBe('semantic-rebind')
    expect(result.resolution.confidence).toBe(0.9)
    expect(result.element.locator).toEqual([1])
  })

  it('rejects ambiguous semantic matches', () => {
    const original = observation({ elements: [element({ locator: [0], title: 'Save' })] })
    const fresh = observation({
      elements: [
        element({ index: 0, locator: [0], title: 'Cancel' }),
        element({ index: 1, locator: [1], title: 'Save' }),
        element({ index: 2, locator: [2], title: 'Save' }),
      ],
    })
    expect(() => resolveFrom(original, fresh, 0, true)).toThrow(/found 2 candidates/)
  })

  it('rejects low confidence when no native identifier or accessible name remains', () => {
    const original = observation({ elements: [element({ locator: [0], title: undefined, label: undefined, nativeIdentifier: undefined })] })
    const fresh = observation({ elements: [element({ locator: [1], title: undefined, label: undefined, nativeIdentifier: undefined })] })
    expect(() => resolveFrom(original, fresh, 0, true)).toThrow(/no native identifier or accessible name/)
  })

  it('rejects rebinding from a truncated fresh observation', () => {
    const original = observation({ elements: [element({ locator: [0], nativeIdentifier: 'save-btn', title: 'Save' })] })
    const fresh = observation({ truncated: true, elements: [element({ locator: [1], nativeIdentifier: 'save-btn', title: 'Save' })] })
    expect(() => resolveFrom(original, fresh, 0, true)).toThrow(/truncated fresh observation/)
  })
})
