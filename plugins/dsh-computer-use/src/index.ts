/** Telos-owned macOS Computer Use bundle: provider, model-facing tools, and lifecycle. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-tools'
import { resolveConfig, type ComputerUseConfig } from './config.js'
import { ComputerUseError } from './errors.js'
import { MacOSBackend } from './providers/macos.js'
import { ComputerUseService } from './service.js'
import { createComputerUseTools } from './tools.js'

export { ComputerUseService } from './service.js'
export * from './errors.js'
export * from './types.js'

export const name = 'telos-computer-use'
export const inject = ['subprocess', 'approval', 'sessions', 'agents', 'tools', 'attachments']

export function apply(ctx: Context, config: ComputerUseConfig = {}): void {
  if (process.platform !== 'darwin') {
    throw new ComputerUseError('COMPUTER_UNSUPPORTED_PLATFORM', `telos-computer-use supports macOS only; current platform is ${process.platform}`)
  }
  const resolved = resolveConfig(config)
  const backend = new MacOSBackend(ctx, resolved)
  const service = new ComputerUseService(ctx, backend, resolved)
  for (const definition of createComputerUseTools(service)) {
    ctx.tools.register(definition)
  }
  ctx.on('agent/disposed', ({ agent }: { agent: import('@deepseek-ai/dsh-agent').Agent }) => {
    service.releaseAgent(agent)
  })
}
