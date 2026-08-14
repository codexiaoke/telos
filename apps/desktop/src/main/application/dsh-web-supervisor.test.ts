import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DshWebSupervisor, parseDshWebReadyUrl } from './dsh-web-supervisor.js'

const roots: string[] = []

function fixture(script: string): { sourceRoot: string; dshHome: string } {
  const sourceRoot = mkdtempSync(join(tmpdir(), 'telos-dsh-web-'))
  roots.push(sourceRoot)
  mkdirSync(join(sourceRoot, 'apps/cli/lib'), { recursive: true })
  mkdirSync(join(sourceRoot, 'apps/web/dist'), { recursive: true })
  writeFileSync(join(sourceRoot, 'apps/cli/lib/bin.js'), script)
  writeFileSync(join(sourceRoot, 'apps/web/dist/index.html'), '<div id="root"></div>')
  return { sourceRoot, dshHome: join(sourceRoot, 'home') }
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('parseDshWebReadyUrl', () => {
  it('accepts only the loopback readiness line', () => {
    expect(parseDshWebReadyUrl('dsh web: http://127.0.0.1:43123')).toBe('http://127.0.0.1:43123')
    expect(parseDshWebReadyUrl('dsh web: http://127.0.0.1:43123 (LAN: http://10.0.0.2:43123)'))
      .toBe('http://127.0.0.1:43123')
    expect(parseDshWebReadyUrl('dsh web: http://0.0.0.0:43123')).toBeUndefined()
    expect(parseDshWebReadyUrl('http://127.0.0.1:43123')).toBeUndefined()
  })
})

describe('DshWebSupervisor', () => {
  it('waits for readiness, probes the URL, and stops gracefully', async () => {
    const paths = fixture(`
      const http = require('node:http')
      const server = http.createServer((_request, response) => response.end('ready'))
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        process.stdout.write('dsh web: http://127.0.0.1:' + address.port + '\\n')
      })
      process.on('SIGTERM', () => server.close(() => process.exit(0)))
    `)
    const supervisor = new DshWebSupervisor({
      ...paths,
      executablePath: process.execPath,
      startupTimeoutMs: 2_000,
      shutdownTimeoutMs: 1_000,
    })
    const states: string[] = []
    const unsubscribe = supervisor.subscribe(snapshot => states.push(snapshot.state))

    const url = await supervisor.start()
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
    expect(supervisor.getSnapshot()).toMatchObject({ state: 'ready', url })

    await supervisor.stop()
    expect(supervisor.getSnapshot()).toMatchObject({ state: 'stopped' })
    expect(states).toEqual(['idle', 'starting', 'ready', 'stopping', 'stopped'])
    unsubscribe()
  })

  it('can restart a ready workbench as a fresh managed process', async () => {
    const paths = fixture(`
      const http = require('node:http')
      const server = http.createServer((_request, response) => response.end('ready'))
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        process.stdout.write('dsh web: http://127.0.0.1:' + address.port + '\\n')
      })
      process.on('SIGTERM', () => server.close(() => process.exit(0)))
    `)
    const supervisor = new DshWebSupervisor({
      ...paths,
      executablePath: process.execPath,
      startupTimeoutMs: 2_000,
      shutdownTimeoutMs: 1_000,
    })
    const states: string[] = []
    supervisor.subscribe(snapshot => states.push(snapshot.state))

    await supervisor.start()
    await supervisor.restart()

    expect(states.filter(state => state === 'ready')).toHaveLength(2)
    expect(states).toContain('stopping')
    await supervisor.stop()
  })

  it('reports process output when startup exits early', async () => {
    const paths = fixture(`
      process.stderr.write('profile failed to load\\n')
      process.exit(2)
    `)
    const supervisor = new DshWebSupervisor({
      ...paths,
      executablePath: process.execPath,
      startupTimeoutMs: 2_000,
    })

    await expect(supervisor.start()).rejects.toThrow(/profile failed to load/)
    expect(supervisor.getSnapshot()).toMatchObject({ state: 'failed' })
  })

  it('settles an in-flight start when the application stops', async () => {
    const paths = fixture('setInterval(() => {}, 1000)')
    const supervisor = new DshWebSupervisor({
      ...paths,
      executablePath: process.execPath,
      startupTimeoutMs: 5_000,
      shutdownTimeoutMs: 1_000,
    })

    const starting = supervisor.start()
    await supervisor.stop()

    await expect(starting).rejects.toThrow('stopped during startup')
    expect(supervisor.getSnapshot()).toMatchObject({ state: 'stopped' })
  })

  it('redacts API-key shaped values from diagnostics', async () => {
    const paths = fixture(`
      process.stderr.write('credential sk-testsecret123456789 leaked\\n')
      process.exit(1)
    `)
    const supervisor = new DshWebSupervisor({
      ...paths,
      executablePath: process.execPath,
      startupTimeoutMs: 2_000,
    })

    await expect(supervisor.start()).rejects.not.toThrow(/sk-testsecret123456789/)
    expect(supervisor.getSnapshot().recentOutput.join('\n')).toContain('sk-[redacted]')
  })
})
