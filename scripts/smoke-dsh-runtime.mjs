import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DshRuntimeAdapter } from '../packages/runtime-dsh/dist/index.js'

if (!process.env.DEEPSEEK_API_KEY) {
  process.stderr.write('DEEPSEEK_API_KEY is required for the real DSH smoke test.\n')
  process.exit(2)
}

const repositoryRoot = resolve(import.meta.dirname, '..')
const smokeRoot = resolve(repositoryRoot, '.local/dsh-smoke')
const prompt = process.argv.slice(2).join(' ').trim()
  || '请只回答：TELOS_DSH_SMOKE_OK'

await mkdir(smokeRoot, { recursive: true })

const events = []
const adapter = new DshRuntimeAdapter({
  sourceRoot: resolve(repositoryRoot, 'third_party/deepseek-harness'),
  profilePath: resolve(repositoryRoot, 'integrations/dsh/profiles/telos-default/cordis.yml'),
  workspacePath: resolve(smokeRoot, 'workspace'),
  sessionRoot: resolve(smokeRoot, 'sessions'),
  route: { provider: 'deepseek-official', model: 'deepseek-v4-pro' },
  maxTokens: 512,
})

const result = await adapter.run(
  {
    runId: `smoke-${randomUUID()}`,
    conversationId: 'dsh-smoke',
    input: prompt,
  },
  (event) => events.push(event),
)

const summary = {
  runtime: result.runtime,
  provider: result.route.provider,
  model: result.route.model,
  sessionId: result.sessionId,
  eventTypes: [...new Set(events.map((event) => event.type))],
  eventCount: result.eventCount,
  finalResponse: result.finalResponse,
}

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
