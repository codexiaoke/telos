import { describe, expect, it } from 'vitest'
import { dshWorkspaceRuntimeClosure } from './stage-dsh-workspace-closure.mjs'

function workspacePackage(name, manifest = {}) {
  return [name, { root: `/fixture/${name}`, manifest: { name, ...manifest } }]
}

describe('dshWorkspaceRuntimeClosure', () => {
  it('includes runtime dependencies and required workspace peers transitively', () => {
    const packages = new Map([
      workspacePackage('cli', { dependencies: { host: 'workspace:^' }, devDependencies: { tests: 'workspace:^' } }),
      workspacePackage('host', {
        optionalDependencies: { optionalRuntime: 'workspace:^' },
        peerDependencies: { requiredPeer: 'workspace:^', optionalPeer: 'workspace:^' },
        peerDependenciesMeta: { optionalPeer: { optional: true } },
      }),
      workspacePackage('optionalRuntime'),
      workspacePackage('requiredPeer', { dependencies: { transitive: 'workspace:^' } }),
      workspacePackage('optionalPeer'),
      workspacePackage('transitive'),
      workspacePackage('tests'),
    ])

    expect(dshWorkspaceRuntimeClosure('cli', packages)).toEqual([
      'cli',
      'host',
      'optionalRuntime',
      'requiredPeer',
      'transitive',
    ])
  })

  it('rejects an unknown runtime root', () => {
    expect(() => dshWorkspaceRuntimeClosure('missing', new Map())).toThrow('Unknown DSH runtime root')
  })
})
