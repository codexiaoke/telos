import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import type { Readable } from 'node:stream'

const READY_LINE = /^dsh web: (http:\/\/127\.0\.0\.1:\d+)(?:\s|$)/
const MAX_DIAGNOSTIC_LINES = 80

export type DshWebState = 'idle' | 'starting' | 'ready' | 'stopping' | 'stopped' | 'failed'

export interface DshWebSnapshot {
  state: DshWebState
  url?: string
  detail?: string
  recentOutput: readonly string[]
}

export interface DshWebSupervisorOptions {
  sourceRoot: string
  dshHome: string
  /** Standalone Node.js executable; Electron's embedded Node is not a supported DSH host. */
  executablePath: string
  patchPaths?: readonly string[]
  environment?: NodeJS.ProcessEnv
  startupTimeoutMs?: number
  shutdownTimeoutMs?: number
  probeTimeoutMs?: number
  probe?: (url: string) => Promise<void>
}

type ManagedChild = ChildProcess & {
  stdout: Readable
  stderr: Readable
}

function safeLine(line: string): string {
  return line.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, 'sk-[redacted]')
}

export function parseDshWebReadyUrl(line: string): string | undefined {
  const match = READY_LINE.exec(line.trim())
  if (match === null) return undefined

  const value = match[1]
  if (value === undefined) return undefined
  const url = new URL(value)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.port === '') return undefined
  return url.origin
}

async function probeLocalWeb(url: string, timeoutMs: number): Promise<void> {
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`DSH Web readiness probe returned HTTP ${String(response.status)}`)
}

export class DshWebSupervisor {
  private state: DshWebState = 'idle'
  private url: string | undefined
  private detail: string | undefined
  private readonly output: string[] = []
  private child: ManagedChild | undefined
  private startPromise: Promise<string> | undefined
  private stopPromise: Promise<void> | undefined

  constructor(private readonly options: DshWebSupervisorOptions) {}

  getSnapshot(): DshWebSnapshot {
    return {
      state: this.state,
      ...(this.url === undefined ? {} : { url: this.url }),
      ...(this.detail === undefined ? {} : { detail: this.detail }),
      recentOutput: [...this.output],
    }
  }

  async start(): Promise<string> {
    if (this.state === 'ready' && this.url !== undefined) return this.url
    if (this.startPromise !== undefined) return this.startPromise
    if (this.state === 'stopping') throw new Error('DSH Web is still stopping')

    const pending = this.launch()
    this.startPromise = pending
    try {
      return await pending
    } finally {
      if (this.startPromise === pending) this.startPromise = undefined
    }
  }

  async stop(): Promise<void> {
    if (this.stopPromise !== undefined) return this.stopPromise
    const child = this.child
    if (child === undefined) {
      this.url = undefined
      if (this.state !== 'failed') this.state = 'stopped'
      return
    }

    this.state = 'stopping'
    this.stopPromise = new Promise<void>((resolve) => {
      let settled = false
      let forceTimer: NodeJS.Timeout | undefined
      const finish = (): void => {
        if (settled) return
        settled = true
        if (forceTimer !== undefined) clearTimeout(forceTimer)
        this.child = undefined
        this.url = undefined
        this.state = 'stopped'
        resolve()
      }
      child.once('exit', finish)
      child.kill('SIGTERM')

      forceTimer = setTimeout(() => {
        child.kill('SIGKILL')
        finish()
      }, this.options.shutdownTimeoutMs ?? 8_000)
      forceTimer.unref()
    })

    try {
      await this.stopPromise
    } finally {
      this.stopPromise = undefined
    }
  }

  private async launch(): Promise<string> {
    const cliPath = join(this.options.sourceRoot, 'apps/cli/lib/bin.js')
    const webIndex = join(this.options.sourceRoot, 'apps/web/dist/index.html')
    if (!existsSync(cliPath) || !existsSync(webIndex)) {
      this.fail('Complete DSH Web artifacts are missing; run pnpm dsh:build')
      throw new Error(this.detail)
    }

    mkdirSync(this.options.dshHome, { recursive: true })
    this.state = 'starting'
    this.url = undefined
    this.detail = undefined
    this.output.length = 0

    const child = spawn(
      this.options.executablePath,
      [
        cliPath,
        'web',
        ...(this.options.patchPaths ?? []).flatMap(path => ['--patch', path]),
        '--port',
        '0',
      ],
      {
        cwd: this.options.sourceRoot,
        env: {
          ...process.env,
          ...this.options.environment,
          DSH_HOME: this.options.dshHome,
          DSH_TELEMETRY_DISABLED: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    ) as ManagedChild
    this.child = child

    const stdout = createInterface({ input: child.stdout })
    const stderr = createInterface({ input: child.stderr })
    stdout.on('line', line => this.record('stdout', line))
    stderr.on('line', line => this.record('stderr', line))

    return new Promise<string>((resolve, reject) => {
      let startupSettled = false

      const rejectStartup = (error: Error): void => {
        if (startupSettled) return
        startupSettled = true
        clearTimeout(startupTimer)
        this.fail(error.message)
        child.kill('SIGTERM')
        reject(error)
      }

      const acceptStartup = (readyUrl: string): void => {
        if (startupSettled) return
        startupSettled = true
        clearTimeout(startupTimer)
        this.state = 'ready'
        this.url = readyUrl
        this.detail = undefined
        resolve(readyUrl)
      }

      stdout.on('line', (line) => {
        const readyUrl = parseDshWebReadyUrl(line)
        if (readyUrl === undefined || startupSettled) return
        const probe = this.options.probe ?? (url => probeLocalWeb(url, this.options.probeTimeoutMs ?? 5_000))
        void probe(readyUrl).then(
          () => acceptStartup(readyUrl),
          error => rejectStartup(error instanceof Error ? error : new Error(String(error))),
        )
      })

      child.once('error', (error) => {
        if (!startupSettled) rejectStartup(new Error(`Failed to start DSH Web: ${error.message}`))
        else if (this.state !== 'stopping' && this.state !== 'stopped') this.fail(error.message)
      })

      child.once('exit', (code, signal) => {
        if (this.child === child) this.child = undefined
        if (this.state === 'stopping') {
          if (!startupSettled) {
            startupSettled = true
            clearTimeout(startupTimer)
            reject(new Error('DSH Web stopped during startup'))
          }
          return
        }

        const reason = `DSH Web exited${code === null ? '' : ` with code ${String(code)}`}${signal === null ? '' : ` (${signal})`}`
        if (!startupSettled) rejectStartup(new Error(this.withDiagnostics(reason)))
        else if (this.state === 'ready') {
          this.url = undefined
          this.fail(this.withDiagnostics(reason))
        }
      })

      const startupTimer = setTimeout(() => {
        rejectStartup(new Error(this.withDiagnostics(
          `DSH Web did not become ready within ${String(this.options.startupTimeoutMs ?? 60_000)}ms`,
        )))
      }, this.options.startupTimeoutMs ?? 60_000)
      startupTimer.unref()
    })
  }

  private record(stream: 'stdout' | 'stderr', line: string): void {
    const normalized = safeLine(line.trim())
    if (normalized.length === 0) return
    this.output.push(`[${stream}] ${normalized}`)
    if (this.output.length > MAX_DIAGNOSTIC_LINES) this.output.shift()
  }

  private withDiagnostics(message: string): string {
    const tail = this.output.slice(-12)
    return tail.length === 0 ? message : `${message}\n${tail.join('\n')}`
  }

  private fail(detail: string): void {
    this.state = 'failed'
    this.detail = detail
  }
}
