import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context } from '../third_party/deepseek-harness/vendor/cordis/lib/index.js'
import SystemPrompt from '../third_party/deepseek-harness/packages/core/system-prompt/lib/index.js'
import ToolRuntime from '../third_party/deepseek-harness/packages/core/tools/lib/index.js'
import { CallId } from '../third_party/deepseek-harness/packages/llm/llm/lib/index.js'
import { McpManager, McpServerStore } from '../plugins/dsh-mcp-manager/lib/index.js'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporaryRoot = mkdtempSync(join(tmpdir(), 'telos-codegraph-mcp-'))
const configuredCommand = process.env.TELOS_CODEGRAPH_COMMAND
const knownCommand = '/Users/xiaoke/.nvm/versions/node/v22.21.1/bin/codegraph'
const command = configuredCommand ?? (existsSync(knownCommand) ? knownCommand : 'codegraph')

const ctx = new Context()
await ctx.plugin(SystemPrompt)
await ctx.plugin(ToolRuntime)
const manager = new McpManager(ctx, new McpServerStore(join(temporaryRoot, 'mcp-servers.json')))

try {
  const views = await manager.handle('save', {
    acknowledgeLocalExecution: true,
    server: {
      serverName: 'codegraph',
      displayName: 'CodeGraph',
      enabled: true,
      transport: 'stdio',
      command,
      args: ['serve', '--mcp', '--path', repositoryRoot],
      cwd: repositoryRoot,
      env: [],
      headers: [],
      toolCallTimeoutMs: 60_000,
      reconnect: { enabled: true, initialDelayMs: 500, maxDelayMs: 5_000, maxAttempts: 3 },
    },
  })
  const server = views[0]
  if (server?.runtime !== 'loaded' || server.toolNames.length === 0) {
    throw new Error(`CodeGraph MCP did not load: ${JSON.stringify(server)}`)
  }
  const schema = ctx.tools.schemas().find(candidate => candidate.name.includes('codegraph_explore'))
    ?? ctx.tools.schemas().find(candidate => candidate.name.endsWith('__explore'))
  if (schema === undefined) throw new Error(`CodeGraph MCP did not publish an explore tool: ${server.toolNames.join(', ')}`)

  const result = await ctx.tools.execute({
    signal: AbortSignal.timeout(60_000),
    callId: CallId('telos-codegraph-live-smoke'),
    name: schema.name,
    arguments: { query: 'Locate the Telos MCP manager class and summarize its runtime responsibility.' },
  })
  if (result.isError) throw new Error(`CodeGraph MCP tool call failed: ${JSON.stringify(result)}`)
  const text = result.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n')
  if (!text.includes('McpManager')) throw new Error(`CodeGraph response did not identify McpManager: ${text.slice(0, 500)}`)
  process.stdout.write(`${JSON.stringify({
    transport: 'stdio',
    server: server.serverName,
    runtime: server.runtime,
    toolCount: server.toolNames.length,
    invokedTool: schema.name,
    responseContains: 'McpManager',
  }, null, 2)}\n`)
} finally {
  await manager.close()
  rmSync(temporaryRoot, { recursive: true, force: true })
}
