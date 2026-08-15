import { win32 } from 'node:path'

export function corepackInvocation(args, options = {}) {
  const platform = options.platform ?? process.platform
  const nodeExecutable = options.nodeExecutable ?? process.execPath
  if (platform !== 'win32') return { executable: 'corepack', args }

  return {
    executable: nodeExecutable,
    args: [
      win32.join(win32.dirname(nodeExecutable), 'node_modules', 'corepack', 'dist', 'corepack.js'),
      ...args,
    ],
  }
}
