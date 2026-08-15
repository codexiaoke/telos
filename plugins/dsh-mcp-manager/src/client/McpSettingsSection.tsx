import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { CredentialBinding, McpServerConfig, McpServerView } from '../contracts.js'
import type { McpClientController } from './controller.js'
import type { ServerDraft } from './contracts.js'

export interface McpInjected { controller: McpClientController }

const reconnect = { enabled: true, initialDelayMs: 500, maxDelayMs: 30_000, maxAttempts: 8 }

function emptyServer(): McpServerConfig {
  return {
    serverName: '', displayName: '', enabled: false, transport: 'stdio', command: '', args: [], cwd: '',
    env: [], headers: [], toolCallTimeoutMs: 60_000, reconnect,
  }
}

function statusLabel(server: McpServerView): string {
  if (server.runtime === 'disabled') return '已停用'
  if (server.runtime === 'connecting') return '正在加载'
  if (server.runtime === 'error') return '加载失败'
  return `已加载 · ${String(server.toolNames.length)} 个工具`
}

function bindingLines(bindings: readonly CredentialBinding[]): string {
  return bindings.map(binding => `${binding.name}=`).join('\n')
}

function credentialRef(serverName: string, kind: 'ENV' | 'HEADER', name: string): string {
  const normalize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9_]/g, '_').replace(/^([^A-Z_])/, '_$1')
  return `TELOS_MCP_${normalize(serverName)}_${kind}_${normalize(name)}`
}

function parseBindings(serverName: string, kind: 'ENV' | 'HEADER', lines: string): {
  bindings: CredentialBinding[]
  values: Record<string, string>
} {
  const bindings: CredentialBinding[] = []
  const values: Record<string, string> = {}
  for (const line of lines.split('\n')) {
    if (line.trim() === '') continue
    const separator = line.indexOf('=')
    const name = (separator < 0 ? line : line.slice(0, separator)).trim()
    const value = separator < 0 ? '' : line.slice(separator + 1)
    const ref = credentialRef(serverName, kind, name)
    bindings.push({ name, credentialRef: ref })
    if (value !== '') values[ref] = value
  }
  return { bindings, values }
}

function Editor({ original, onClose, controller }: {
  original?: McpServerView
  onClose: () => void
  controller: McpClientController
}) {
  const [server, setServer] = useState<McpServerConfig>(original ?? emptyServer())
  const [args, setArgs] = useState((original?.args ?? []).join('\n'))
  const [bindings, setBindings] = useState(bindingLines(original?.transport === 'stdio' ? original.env : original?.headers ?? []))
  const [acknowledged, setAcknowledged] = useState(false)
  const update = (patch: Partial<McpServerConfig>) => setServer(current => ({ ...current, ...patch }))
  const save = async () => {
    const parsed = parseBindings(server.serverName, server.transport === 'stdio' ? 'ENV' : 'HEADER', bindings)
    const draft: ServerDraft = {
      server: {
        ...server,
        displayName: server.displayName.trim() || server.serverName,
        args: server.transport === 'stdio' ? args.split('\n').filter(Boolean) : [],
        env: server.transport === 'stdio' ? parsed.bindings : [],
        headers: server.transport === 'streamable-http' ? parsed.bindings : [],
      },
      credentialValues: parsed.values,
      acknowledgeLocalExecution: acknowledged,
    }
    await controller.save(draft)
    if (controller.getSnapshot().error === undefined) onClose()
  }

  return (
    <div aria-label="MCP 服务编辑器" className="telosMcpEditor">
      <div className="telosMcpEditorHeader"><h2>{original === undefined ? '添加 MCP 服务' : '编辑 MCP 服务'}</h2><button onClick={onClose} type="button">关闭</button></div>
      <div className="telosMcpGrid">
        <label>服务标识<input disabled={original !== undefined} onChange={event => update({ serverName: event.target.value })} placeholder="codegraph" value={server.serverName} /></label>
        <label>显示名称<input onChange={event => update({ displayName: event.target.value })} placeholder="CodeGraph" value={server.displayName} /></label>
        <label>传输方式<select onChange={event => update({ transport: event.target.value as McpServerConfig['transport'] })} value={server.transport}><option value="stdio">本机进程 (stdio)</option><option value="streamable-http">远程 HTTP</option></select></label>
        <label>工具超时（毫秒）<input min="1000" onChange={event => update({ toolCallTimeoutMs: Number(event.target.value) })} type="number" value={server.toolCallTimeoutMs} /></label>
      </div>
      {server.transport === 'stdio' ? <>
        <label>可执行命令<input onChange={event => update({ command: event.target.value })} placeholder="codegraph" value={server.command ?? ''} /></label>
        <label>参数（每行一个）<textarea onChange={event => setArgs(event.target.value)} placeholder={'serve\n--mcp'} rows={3} value={args} /></label>
        <label>工作目录<input onChange={event => update({ cwd: event.target.value })} placeholder="/path/to/workspace" value={server.cwd ?? ''} /></label>
        <label>环境变量（NAME=VALUE，每行一个；已保存的值不会回显）<textarea onChange={event => setBindings(event.target.value)} rows={3} value={bindings} /></label>
        {server.enabled ? <label className="telosMcpAcknowledgement"><input checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} type="checkbox" />我确认该服务会在本机启动进程，并获得其配置中的环境变量和工作目录权限。</label> : null}
      </> : <>
        <label>MCP URL<input onChange={event => update({ url: event.target.value })} placeholder="https://example.com/mcp" value={server.url ?? ''} /></label>
        <label>请求头（NAME=VALUE，每行一个；已保存的值不会回显）<textarea onChange={event => setBindings(event.target.value)} rows={4} value={bindings} /></label>
      </>}
      <label className="telosMcpAcknowledgement"><input checked={server.enabled} onChange={event => update({ enabled: event.target.checked })} type="checkbox" />保存后立即启用</label>
      <div className="telosMcpActions"><button onClick={onClose} type="button">取消</button><button data-primary disabled={server.serverName.trim() === '' || (server.transport === 'stdio' && server.enabled && !acknowledged)} onClick={() => { void save() }} type="button">保存</button></div>
    </div>
  )
}

export function McpSettingsSection({ controller }: McpInjected) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const [editing, setEditing] = useState<string | 'new' | undefined>()
  const [armed, setArmed] = useState<string | undefined>()
  useEffect(() => { void controller.refresh() }, [controller])
  const selected = useMemo(() => state.servers.find(server => server.serverName === editing), [editing, state.servers])
  if (editing !== undefined) return <Editor controller={controller} onClose={() => setEditing(undefined)} original={editing === 'new' ? undefined : selected} />

  return (
    <section aria-label="MCP 管理" className="telosMcpSettings">
      <header className="telosMcpHeader">
        <div><h1>MCP</h1><p>连接外部工具服务。Telos 管理配置和授权，工具运行仍由 DSH 官方 MCP Client 承载。</p></div>
        <div className="telosMcpActions"><button disabled={state.loading} onClick={() => { void controller.refresh() }} type="button">刷新</button><button data-primary onClick={() => setEditing('new')} type="button">添加服务</button></div>
      </header>
      <div className="telosMcpWarning">本机 stdio 服务会启动独立进程，不受 Agent 工具权限模式约束。仅启用你信任的命令；密钥由 DSH 凭据存储保管，不写入 MCP 配置。</div>
      {state.error === undefined ? null : <div className="telosMcpBanner" data-error>{state.error}</div>}
      {state.notice === undefined ? null : <div className="telosMcpBanner">{state.notice}</div>}
      <div className="telosMcpTable" role="table">
        <div className="telosMcpRow telosMcpTableHead" role="row"><span>服务</span><span>目标</span><span>状态</span><span>操作</span></div>
        {state.servers.length === 0 ? <div className="telosMcpEmpty">还没有 MCP 服务。可以先添加本机 CodeGraph 进行验证。</div> : state.servers.map(server => (
          <div className="telosMcpServer" key={server.serverName}>
            <div className="telosMcpRow" role="row">
              <span><strong>{server.displayName}</strong><small>{server.serverName} · {server.transport}</small></span>
              <code>{server.transport === 'stdio' ? [server.command, ...(server.args ?? [])].join(' ') : server.url}</code>
              <span data-status={server.runtime}>{statusLabel(server)}{server.error === undefined ? null : <small title={server.error}>{server.error}</small>}</span>
              <span className="telosMcpRowActions">
                <button onClick={() => setEditing(server.serverName)} type="button">编辑</button>
                {server.enabled ? <button disabled={state.loading} onClick={() => { void controller.reconnect(server.serverName) }} type="button">重连</button> : null}
                <button disabled={state.loading} onClick={() => {
                  if (server.enabled) void controller.toggle(server.serverName)
                  else if (armed !== `enable:${server.serverName}`) setArmed(`enable:${server.serverName}`)
                  else { setArmed(undefined); void controller.toggle(server.serverName, true) }
                }} type="button">{server.enabled ? '停用' : armed === `enable:${server.serverName}` ? '确认启动本机进程' : '启用'}</button>
                <button data-danger disabled={state.loading} onClick={() => {
                  if (armed !== server.serverName) setArmed(server.serverName)
                  else { setArmed(undefined); void controller.delete(server.serverName) }
                }} type="button">{armed === server.serverName ? '再次确认删除' : '删除'}</button>
              </span>
            </div>
            {server.toolNames.length === 0 ? null : <div className="telosMcpTools">{server.toolNames.map(name => <code key={name}>{name}</code>)}</div>}
          </div>
        ))}
      </div>
    </section>
  )
}
