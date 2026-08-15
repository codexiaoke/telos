import { app } from 'electron'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

function developmentRepositoryRoot(): string {
  const configured = process.env.TELOS_REPOSITORY_ROOT
  const candidates = [
    configured,
    resolve(app.getAppPath(), '../..'),
    process.cwd(),
  ].filter((candidate): candidate is string => candidate !== undefined && candidate.length > 0)

  return candidates.find((candidate) => existsSync(join(candidate, 'third_party/deepseek-harness/package.json')))
    ?? candidates[0]
    ?? process.cwd()
}

export function resolveDshSourceRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'dsh-runtime')
    : join(developmentRepositoryRoot(), 'third_party/deepseek-harness')
}

export function resolveTelosDshSidebarPackageRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'dsh-overlays/telos-ui-sidebar')
    : join(developmentRepositoryRoot(), 'integrations/dsh/plugins/telos-ui-sidebar')
}

export function resolveTelosDshLayoutPackageRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'dsh-overlays/telos-ui-layout')
    : join(developmentRepositoryRoot(), 'integrations/dsh/plugins/telos-ui-layout')
}

export function resolveTelosDshContinuityPackageRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'dsh-overlays/telos-continuity')
    : join(developmentRepositoryRoot(), 'plugins/dsh-continuity')
}

export function resolveTelosDshMcpManagerPackageRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'dsh-overlays/telos-mcp-manager')
    : join(developmentRepositoryRoot(), 'plugins/dsh-mcp-manager')
}

export function resolveTelosDshMultimodalPackageRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'dsh-overlays/telos-multimodal')
    : join(developmentRepositoryRoot(), 'plugins/dsh-multimodal')
}

export function resolveTelosDshWorkbenchFilesPackageRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'dsh-overlays/telos-workbench-files')
    : join(developmentRepositoryRoot(), 'plugins/dsh-workbench-files')
}

export function resolveTelosDshWorkReportPackageRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'dsh-overlays/telos-work-report')
    : join(developmentRepositoryRoot(), 'plugins/dsh-work-report')
}

export function loadDevelopmentEnvironment(): void {
  if (app.isPackaged) return
  const localEnvironment = join(developmentRepositoryRoot(), '.env.local')
  if (existsSync(localEnvironment)) process.loadEnvFile(localEnvironment)
}

export function resolveDshNodeExecutable(): string {
  const configured = process.env.TELOS_DSH_NODE_EXECUTABLE
  if (configured !== undefined && configured.length > 0) return configured

  if (app.isPackaged) {
    return process.platform === 'win32'
      ? join(process.resourcesPath, 'dsh-node', 'node.exe')
      : join(process.resourcesPath, 'dsh-node', 'bin', 'node')
  }

  // pnpm records the standalone Node executable that launched electron-vite.
  // Do not use process.execPath here: inside Electron that is the Electron
  // binary and its embedded Node loader is not equivalent to a supported
  // standalone DSH Node runtime.
  return process.env.npm_node_execpath ?? 'node'
}
