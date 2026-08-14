import { app } from 'electron'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type {
  RuntimeEventObserver,
  RuntimePromptRequest,
  RuntimeRunResult,
  RuntimeStatus,
} from '@telos/runtime-contracts'
import { DshRuntimeAdapter } from '@telos/runtime-dsh'

interface RuntimePaths {
  sourceRoot: string
  profilePath: string
  workspacePath: string
  sessionRoot: string
}

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

function runtimePaths(): RuntimePaths {
  const userData = app.getPath('userData')
  if (app.isPackaged) {
    return {
      sourceRoot: join(process.resourcesPath, 'dsh-runtime'),
      profilePath: join(process.resourcesPath, 'dsh-profiles/telos-default/cordis.yml'),
      workspacePath: join(userData, 'runtime/dsh/workspace'),
      sessionRoot: join(userData, 'runtime/dsh/sessions'),
    }
  }

  const repositoryRoot = developmentRepositoryRoot()
  return {
    sourceRoot: join(repositoryRoot, 'third_party/deepseek-harness'),
    profilePath: join(repositoryRoot, 'integrations/dsh/profiles/telos-default/cordis.yml'),
    workspacePath: join(userData, 'runtime/dsh/workspace'),
    sessionRoot: join(userData, 'runtime/dsh/sessions'),
  }
}

export interface RuntimeGateway {
  getStatus(): RuntimeStatus
  run(request: RuntimePromptRequest, onEvent: RuntimeEventObserver): Promise<RuntimeRunResult>
}

export function createRuntimeGateway(): RuntimeGateway {
  const paths = runtimePaths()
  const runtime = new DshRuntimeAdapter({
    ...paths,
    route: { provider: 'deepseek-official', model: 'deepseek-v4-pro' },
    maxTokens: 8_192,
  })

  return {
    getStatus(): RuntimeStatus {
      if (!existsSync(join(paths.sourceRoot, 'package.json')) || !existsSync(paths.profilePath)) {
        return {
          descriptor: runtime.descriptor,
          availability: 'unavailable',
          detail: 'DSH 源码或 TELOS Profile 不存在。',
        }
      }
      if (
        !existsSync(join(paths.sourceRoot, 'packages/sdk/client/lib/index.js'))
        || !existsSync(join(paths.sourceRoot, 'packages/examples/jsonrpc-demo/lib/packaged-bin.js'))
      ) {
        return {
          descriptor: runtime.descriptor,
          availability: 'needs-build',
          detail: 'DSH 源码尚未构建，请先运行 pnpm dsh:build。',
        }
      }
      if (!process.env.DEEPSEEK_API_KEY) {
        return {
          descriptor: runtime.descriptor,
          availability: 'missing-credential',
          detail: '尚未配置 DeepSeek API 凭据。',
        }
      }
      return {
        descriptor: runtime.descriptor,
        availability: 'ready',
        detail: 'DeepSeek Harness 已就绪。',
      }
    },

    run(request, onEvent) {
      return runtime.run(request, onEvent)
    },
  }
}
