/** Telos-owned macOS Computer Use bundle: provider, model-facing tools, and lifecycle. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-tools'
import { resolveConfig, type ComputerUseConfig } from './config.js'
import { MacOSBackend } from './providers/macos.js'
import { ComputerUseService } from './service.js'
import { createComputerUseTools } from './tools.js'

export { ComputerUseService } from './service.js'
export * from './errors.js'
export * from './types.js'

export const name = 'telos-computer-use'
export const inject = ['subprocess', 'approval', 'sessions', 'agents', 'tools', 'attachments']

export function supportsComputerUsePlatform(platform: NodeJS.Platform = process.platform): boolean {
  return platform === 'darwin'
}

export function apply(ctx: Context, config: ComputerUseConfig = {}): void {
  // The desktop profile is shared across platforms. Unsupported platforms load
  // the bundle inertly so the rest of Telos can still start and be packaged.
  if (!supportsComputerUsePlatform()) return
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
