import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import type { BackendObservation } from '../src/backend.js'

const ROOT = new URL('..', import.meta.url)
const HELPER = new URL('native/macos/bin/dsh-computer-use-helper', ROOT)
const FIXTURE_APP = new URL('native/macos/fixture/DSHComputerUseFixture.app', ROOT)
const MONITOR = new URL('native/macos/fixture/dsh-computer-use-input-monitor', ROOT)
const BUNDLE_ID = 'io.telos.dsh-computer-use-fixture'
const LIMITS = { maxNodes: 1000, maxDepth: 20, maxTextBytes: 128000 }

interface Envelope<T> {
  ok: boolean
  value?: T
  error?: { code: string; message: string }
}

interface InputMonitorResult {
  baselineCursor: { x: number; y: number }
  finalCursor: { x: number; y: number }
  maximumCursorDistance: number
  baselineFrontmostPid: number
  observedFrontmostPids: number[]
  samples: number
  eventTapAvailable: boolean
  monitoredSourcePointerEvents: number
  pointerEventSourceCounts: Record<string, number>
  maximumMatchingWindowCount: number
  matchingWindowFrames: Array<Record<string, number>>
}

interface FixtureTranscript {
  activationCount: number
  pointerClickCount: number
  pointerMouseDownCount: number
  pointerMouseUpCount: number
}

function invoke<T>(
  request: Record<string, unknown>,
  timeoutMs = 15000,
  beforeSend?: (pid: number) => Promise<void>,
): Promise<Envelope<T>> {
  return new Promise((resolve, reject) => {
    const child = spawn(HELPER.pathname, [], { detached: true, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('helper timed out')) }, timeoutMs)
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk })
    child.stderr.setEncoding('utf8').on('data', () => {})
    child.once('error', error => { clearTimeout(timer); reject(error) })
    child.once('close', () => {
      clearTimeout(timer)
      try { resolve(JSON.parse(stdout) as Envelope<T>) } catch (error) { reject(error) }
    })
    const pid = child.pid
    if (pid === undefined) {
      clearTimeout(timer)
      child.kill('SIGKILL')
      reject(new Error('native helper did not expose its pid'))
      return
    }
    void (async () => {
      try {
        await beforeSend?.(pid)
        child.stdin.write(`${JSON.stringify({ protocolVersion: 1, ...request })}\n`)
        child.stdin.end()
      } catch (error) {
        clearTimeout(timer)
        child.kill('SIGKILL')
        reject(error)
      }
    })()
  })
}

function launchFixture(transcript: string): void {
  spawn('open', ['-g', '-n', FIXTURE_APP.pathname, '--args', '--background', '--transcript', transcript], { stdio: 'ignore' })
}

function terminateFixture(): void {
  spawnSync('pkill', ['-f', 'DSHComputerUseFixture'])
}

async function fixtureApp(): Promise<{ bundleId: string; pid: number; name: string } | undefined> {
  const list = await invoke<Array<{ bundleId: string; pid: number; name: string }>>({ command: 'list-apps' })
  return list.ok === true ? list.value?.find(app => app.bundleId === BUNDLE_ID) : undefined
}

/** Start the input monitor right before the action and return its independent report. */
async function monitorInput<T>(
  action: (beforeSend: (pid: number) => Promise<void>) => Promise<T>,
): Promise<{ action: T; monitor: InputMonitorResult; sourcePid: number }> {
  let child: ReturnType<typeof spawn> | undefined
  let closed: Promise<number> | undefined
  let stdout = ''
  let stderr = ''
  let sourcePid: number | undefined
  const beforeSend = async (pid: number): Promise<void> => {
    sourcePid = pid
    const monitorChild = spawn(MONITOR.pathname, ['--duration-ms', '1200', '--interval-micros', '1000', '--source-pid', String(pid)], { stdio: ['ignore', 'pipe', 'pipe'] })
    child = monitorChild
    const monitorStdout = monitorChild.stdout
    const monitorStderr = monitorChild.stderr
    if (monitorStdout === null || monitorStderr === null) throw new Error('input monitor pipes are unavailable')
    closed = new Promise<number>((resolve, reject) => {
      monitorChild.once('error', reject)
      monitorChild.once('close', value => { resolve(value ?? -1) })
    })
    monitorStdout.setEncoding('utf8').on('data', value => { stdout += value })
    monitorStderr.setEncoding('utf8').on('data', value => { stderr += value })
    await new Promise<void>((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error(`input monitor did not become ready: ${stderr}`)), 5000)
      const inspect = (): void => {
        if (!stdout.startsWith('READY\n')) return
        clearTimeout(deadline)
        resolve()
      }
      monitorStdout.on('data', inspect)
      monitorChild.once('error', error => { clearTimeout(deadline); reject(error) })
      inspect()
    })
  }
  const actionResult = await action(beforeSend)
  if (child === undefined || closed === undefined || sourcePid === undefined) throw new Error('input monitor was not started before native input')
  const code = await closed
  if (code !== 0) throw new Error(`input monitor failed (${code}): ${stderr}`)
  const lines = stdout.trim().split(/\r?\n/u)
  if (lines[0] !== 'READY' || lines.length !== 2) throw new Error(`invalid input monitor output: ${stdout || stderr}`)
  return { action: actionResult, monitor: JSON.parse(lines[1]!) as InputMonitorResult, sourcePid }
}

function expectNoForegroundOrCursorInterference(result: InputMonitorResult, targetPid: number, sourcePid: number): void {
  expect(result.samples).toBeGreaterThan(100)
  expect(result.eventTapAvailable).toBe(true)
  const externalPointerInput = Object.entries(result.pointerEventSourceCounts)
    .some(([pid, count]) => pid !== String(sourcePid) && count > 0)
  if (!externalPointerInput) {
    expect(result.maximumCursorDistance, JSON.stringify(result)).toBe(0)
    expect(result.finalCursor, JSON.stringify(result)).toEqual(result.baselineCursor)
    expect(result.observedFrontmostPids, JSON.stringify(result)).toEqual([result.baselineFrontmostPid])
    expect(result.observedFrontmostPids, JSON.stringify(result)).not.toContain(targetPid)
  }
  expect(result.observedFrontmostPids, JSON.stringify(result)).not.toContain(sourcePid)
  expect(result.baselineFrontmostPid).not.toBe(targetPid)
}

describe.skipIf(process.platform !== 'darwin')('native never-active fixture', () => {
  it('resolves and opens an installed app without coordinate or Accessibility work', async () => {
    if (!existsSync(HELPER.pathname) || !existsSync(FIXTURE_APP.pathname)) return
    const transcriptRoot = mkdtempSync(join(tmpdir(), 'telos-open-fixture-'))
    const transcriptPath = join(transcriptRoot, 'transcript.json')
    launchFixture(transcriptPath)
    let app = await fixtureApp()
    const registrationDeadline = Date.now() + 5000
    while (app === undefined && Date.now() < registrationDeadline) {
      await delay(50)
      app = await fixtureApp()
    }
    if (app === undefined) {
      terminateFixture()
      rmSync(transcriptRoot, { recursive: true, force: true })
      return
    }

    try {
      terminateFixture()
      const stopDeadline = Date.now() + 5000
      while (await fixtureApp() !== undefined && Date.now() < stopDeadline) await delay(50)
      const resolved = await invoke<{ bundleId: string; name: string; path: string; pid?: number }>({
        command: 'resolve-launch-target',
        selector: { bundleId: BUNDLE_ID },
      })
      expect(resolved.ok).toBe(true)
      expect(resolved.value).toMatchObject({ bundleId: BUNDLE_ID })
      if (resolved.value === undefined) return

      const opened = await invoke<{
        app: { bundleId: string; pid: number; name: string }
        launched: boolean
        activation: string
      }>({
        command: 'open-app',
        target: resolved.value,
        activate: false,
        actionTimeoutMs: 15000,
      })
      expect(opened.ok).toBe(true)
      expect(opened.value).toMatchObject({
        app: { bundleId: BUNDLE_ID },
        launched: true,
        activation: 'not-requested',
      })
    } finally {
      terminateFixture()
      rmSync(transcriptRoot, { recursive: true, force: true })
    }
  }, 30000)

  it('operates the background fixture without stealing focus or moving the cursor', async () => {
    if (!existsSync(HELPER.pathname) || !existsSync(FIXTURE_APP.pathname) || !existsSync(MONITOR.pathname)) return
    const health = await invoke<{ accessibility: string }>({ command: 'health' })
    if (health.ok !== true || health.value?.accessibility !== 'granted') return

    const transcriptRoot = mkdtempSync(join(tmpdir(), 'telos-fixture-'))
    const transcriptPath = join(transcriptRoot, 'transcript.json')
    launchFixture(transcriptPath)
    let app = await fixtureApp()
    const deadline = Date.now() + 5000
    while (app === undefined && Date.now() < deadline) {
      await delay(50)
      app = await fixtureApp()
    }
    if (app === undefined) {
      terminateFixture()
      rmSync(transcriptRoot, { recursive: true, force: true })
      return
    }

    try {
      const observation = await invoke<BackendObservation>({
        command: 'observe',
        app: { bundleId: BUNDLE_ID, pid: app.pid },
        options: { screenshot: 'none', ...LIMITS },
      })
      expect(observation.ok).toBe(true)
      const observationValue = observation.value
      if (observation.ok !== true || observationValue === undefined) return

      const target = observationValue.elements.find(element => element.title === 'Targeted pointer probe')
        ?? observationValue.elements[0]
      if (target === undefined) return

      const { action: acted, monitor, sourcePid } = await monitorInput(beforeSend => invoke<{ activation: string; pointerRouting: string }>({
        command: 'act',
        request: {
          action: { kind: 'click', elementIndex: target.index, allowCoordinateFallback: true },
          app: { bundleId: BUNDLE_ID, pid: app.pid },
          expectedStateHash: observationValue.stateHash,
          interaction: { focusPolicy: 'preserve', keyboardPolicy: 'preserve', pointerInputPolicy: 'targeted' },
          element: target,
          window: observationValue.window,
          actionTimeoutMs: 15000,
          limits: LIMITS,
        },
      }, undefined, beforeSend))
      expect(acted.ok).toBe(true)
      expect(acted.value?.activation).toBe('not-requested')
      expect(acted.value?.pointerRouting).toBe('target-process')
      expectNoForegroundOrCursorInterference(monitor, app.pid, sourcePid)

      const transcriptDeadline = Date.now() + 5000
      while (!existsSync(transcriptPath) && Date.now() < transcriptDeadline) await delay(50)
      if (existsSync(transcriptPath)) {
        const transcript = JSON.parse(readFileSync(transcriptPath, 'utf8')) as FixtureTranscript
        // The fixture must never have activated; the target-process pointer
        // event delivery is recorded for diagnostics but not asserted because
        // its down/up split varies across macOS versions.
        expect(transcript.activationCount).toBe(0)
        console.log('fixture transcript:', JSON.stringify(transcript))
      }
    } finally {
      terminateFixture()
      rmSync(transcriptRoot, { recursive: true, force: true })
    }
  }, 30000)
})
