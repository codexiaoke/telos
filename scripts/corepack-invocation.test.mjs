import { describe, expect, it } from 'vitest'
import { corepackInvocation } from './corepack-invocation.mjs'

describe('corepackInvocation', () => {
  it('uses the Corepack executable on POSIX platforms', () => {
    expect(corepackInvocation(['pnpm', 'build'], {
      platform: 'darwin',
      nodeExecutable: '/opt/node/bin/node',
    })).toEqual({ executable: 'corepack', args: ['pnpm', 'build'] })
  })

  it('runs the Corepack JavaScript entrypoint with Node on Windows', () => {
    expect(corepackInvocation(['pnpm', 'install'], {
      platform: 'win32',
      nodeExecutable: String.raw`C:\hostedtoolcache\node\22.21.1\x64\node.exe`,
    })).toEqual({
      executable: String.raw`C:\hostedtoolcache\node\22.21.1\x64\node.exe`,
      args: [
        String.raw`C:\hostedtoolcache\node\22.21.1\x64\node_modules\corepack\dist\corepack.js`,
        'pnpm',
        'install',
      ],
    })
  })
})
