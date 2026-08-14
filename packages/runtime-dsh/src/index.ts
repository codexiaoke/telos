import { access, copyFile, lstat, mkdir, readlink, symlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type {
  AgentRuntime,
  RuntimeDescriptor,
  RuntimeEventObserver,
  RuntimeRoute,
  RuntimeRunRequest,
  RuntimeRunResult,
} from '@telos/runtime-contracts'
import { DshEventTranslator } from './translator.js'

const DEFAULT_ROUTE: RuntimeRoute = {
  provider: 'deepseek-official',
  model: 'deepseek-v4-pro',
}

const descriptor: RuntimeDescriptor = {
  id: 'dsh',
  displayName: 'DeepSeek Harness',
  capabilities: ['text-input', 'streaming-output', 'durable-session-log', 'subagents'],
  limitations: [
    'No protocol version negotiation in the pinned SDK.',
    'No per-prompt cancellation or per-session close in the pinned SDK.',
    'No server-to-client approval or user-question requests in the pinned SDK.',
  ],
  defaultRoute: DEFAULT_ROUTE,
}

interface DshRunResult {
  sessionId: string
  finalResponse: string
}

interface DshHarnessInstance {
  run(
    input: string,
    options: { sessionId: string; onNotification: (notification: unknown) => void },
  ): Promise<DshRunResult>
  close(): Promise<void>
}

interface DshHarnessOptions {
  launch: {
    command: string
    args: string[]
    cwd: string
    env: NodeJS.ProcessEnv
    shutdownTimeoutMs: number
    disposeEofGraceMs: number
    disposeGraceMs: number
  }
  cwd: string
  provider: string
  model: string
  maxTokens?: number
}

interface DshSdkModule {
  DeepSeekHarness: new (options: DshHarnessOptions) => DshHarnessInstance
}

export interface DshRuntimeAdapterOptions {
  sourceRoot: string
  profilePath: string
  workspacePath: string
  sessionRoot: string
  carrierPath: string
  nodeBinary?: string
  route?: RuntimeRoute
  maxTokens?: number
  systemPrompt?: string
  environment?: NodeJS.ProcessEnv
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/sk-[A-Za-z0-9_-]{8,}/gu, 'sk-[redacted]')
}

function sessionIdFor(request: RuntimeRunRequest): string {
  const suffix = request.runId.replaceAll(/[^A-Za-z0-9_-]/gu, '').slice(0, 80)
  return `telos-${suffix || Date.now()}`
}

async function requireFile(path: string, label: string): Promise<void> {
  try {
    await access(path)
  } catch {
    throw new Error(`${label} is missing at ${path}; run pnpm dsh:build from the Telos repository root`)
  }
}

async function ensureDirectoryLink(linkPath: string, targetPath: string): Promise<void> {
  try {
    const stat = await lstat(linkPath)
    if (!stat.isSymbolicLink()) {
      throw new Error(`DSH runtime carrier path is not a symbolic link: ${linkPath}`)
    }
    const currentTarget = resolve(dirname(linkPath), await readlink(linkPath))
    if (currentTarget !== resolve(targetPath)) {
      throw new Error(`DSH runtime carrier points to ${currentTarget}, expected ${resolve(targetPath)}`)
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      await symlink(targetPath, linkPath, 'junction')
      return
    }
    throw error
  }
}

async function prepareRuntimeCarrier(carrierPath: string, profilePath: string, dependencyRoot: string): Promise<string> {
  await mkdir(carrierPath, { recursive: true })
  await ensureDirectoryLink(join(carrierPath, 'node_modules'), dependencyRoot)
  const carriedProfile = join(carrierPath, 'cordis.yml')
  await copyFile(profilePath, carriedProfile)
  return carriedProfile
}

async function loadDshSdk(entryPath: string): Promise<DshSdkModule> {
  const loaded: unknown = await import(pathToFileURL(entryPath).href)
  if (typeof loaded !== 'object' || loaded === null || !('DeepSeekHarness' in loaded)) {
    throw new Error(`DSH SDK entry did not export DeepSeekHarness: ${entryPath}`)
  }
  const candidate = (loaded as { DeepSeekHarness?: unknown }).DeepSeekHarness
  if (typeof candidate !== 'function') {
    throw new Error(`DSH SDK DeepSeekHarness export is not constructable: ${entryPath}`)
  }
  return loaded as DshSdkModule
}

export class DshRuntimeAdapter implements AgentRuntime {
  readonly descriptor = descriptor
  private active = false

  constructor(private readonly options: DshRuntimeAdapterOptions) {}

  async run(request: RuntimeRunRequest, onEvent: RuntimeEventObserver = () => undefined): Promise<RuntimeRunResult> {
    if (this.active) {
      throw new Error('The initial DSH adapter allows only one active run per adapter instance')
    }
    if (request.input.trim().length === 0) throw new Error('Runtime input must not be empty')

    this.active = true
    const route = request.route ?? this.options.route ?? DEFAULT_ROUTE
    const sessionId = sessionIdFor(request)
    const translator = new DshEventTranslator(request.runId, sessionId, onEvent)
    translator.runStarted(route)

    const sourceRoot = resolve(this.options.sourceRoot)
    const sdkEntry = join(sourceRoot, 'packages/sdk/client/lib/index.js')
    const runtimeEntry = join(sourceRoot, 'packages/examples/jsonrpc-demo/lib/bin.js')
    const dependencyRoot = join(sourceRoot, 'python/sdk-runtime/node_modules')
    const profilePath = resolve(this.options.profilePath)
    const workspacePath = resolve(request.workspacePath ?? this.options.workspacePath)
    const sessionRoot = resolve(this.options.sessionRoot)
    const carrierPath = resolve(this.options.carrierPath)
    let harness: DshHarnessInstance | undefined

    try {
      await Promise.all([
        requireFile(sdkEntry, 'Built DSH SDK client'),
        requireFile(runtimeEntry, 'Built DSH JSON-RPC runtime'),
        requireFile(dependencyRoot, 'Installed DSH runtime dependency closure'),
        requireFile(profilePath, 'Telos DSH profile'),
        mkdir(workspacePath, { recursive: true }),
        mkdir(sessionRoot, { recursive: true }),
      ])

      const carriedProfile = await prepareRuntimeCarrier(carrierPath, profilePath, dependencyRoot)

      const sdk = await loadDshSdk(sdkEntry)
      harness = new sdk.DeepSeekHarness({
        launch: {
          command: this.options.nodeBinary ?? 'node',
          args: [runtimeEntry, carriedProfile],
          cwd: sourceRoot,
          env: {
            ...(this.options.environment ?? process.env),
            DSH_CORDIS_CONFIG: carriedProfile,
            DSH_CWD: workspacePath,
            DSH_SESSION_ROOT: sessionRoot,
            DSH_SYSTEM_PROMPT:
              this.options.systemPrompt
              ?? 'You are Telos, a precise and helpful personal AI assistant. Answer the user directly and do not claim tools or memories you were not given.',
          },
          shutdownTimeoutMs: 2_000,
          disposeEofGraceMs: 8_000,
          disposeGraceMs: 4_000,
        },
        cwd: workspacePath,
        provider: route.provider,
        model: route.model,
        ...(this.options.maxTokens === undefined ? {} : { maxTokens: this.options.maxTokens }),
      })

      const result = await harness.run(request.input, {
        sessionId,
        onNotification: (notification) => translator.accept(notification),
      })
      await harness.close()
      harness = undefined
      translator.runCompleted(result.finalResponse)

      return {
        runId: request.runId,
        sessionId: result.sessionId,
        runtime: 'dsh',
        route,
        finalResponse: result.finalResponse,
        eventCount: translator.eventCount,
      }
    } catch (error) {
      if (harness !== undefined) {
        try {
          await harness.close()
        } catch {
          // The original run failure remains the actionable error.
        }
      }
      const message = safeErrorMessage(error)
      translator.runFailed(message)
      throw new Error(message, { cause: error })
    } finally {
      this.active = false
    }
  }
}

export { DshEventTranslator } from './translator.js'
