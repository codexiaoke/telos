export const MCP_MANAGER_CLIENT_CSS = String.raw`
.telosMcpSettings,.telosMcpEditor{box-sizing:border-box;width:100%;height:100%;overflow:auto;padding:6px 0 28px;color:var(--dsw-alias-label-primary)}
.telosMcpHeader,.telosMcpEditorHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}
.telosMcpHeader h1,.telosMcpEditorHeader h2{margin:0 0 5px;font-size:18px}.telosMcpHeader p{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.6}
.telosMcpWarning,.telosMcpBanner{margin-bottom:14px;padding:10px 12px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55}.telosMcpBanner[data-error]{color:var(--dsw-alias-state-error-primary)}
.telosMcpTable{width:100%;border-top:1px solid var(--dsw-alias-border-l1)}.telosMcpRow{display:grid;grid-template-columns:minmax(140px,.8fr) minmax(220px,1.4fr) minmax(140px,.8fr) minmax(280px,auto);align-items:center;gap:16px;min-height:58px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.telosMcpTableHead{min-height:38px;color:var(--dsw-alias-label-tertiary);font-size:11px}.telosMcpRow small{display:block;margin-top:4px;color:var(--dsw-alias-label-tertiary);font-size:10px;overflow:hidden;text-overflow:ellipsis}.telosMcpRow code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.telosMcpRow [data-status=loaded]{color:var(--dsw-alias-state-success-primary)}.telosMcpRow [data-status=error]{color:var(--dsw-alias-state-error-primary)}
.telosMcpActions,.telosMcpRowActions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px}.telosMcpSettings button,.telosMcpEditor button{min-height:31px;padding:5px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:inherit;cursor:pointer}.telosMcpSettings button[data-primary],.telosMcpEditor button[data-primary]{border-color:transparent;background:var(--dsw-alias-brand-primary);color:white}.telosMcpSettings button[data-danger]{color:var(--dsw-alias-state-error-primary)}.telosMcpSettings button:disabled,.telosMcpEditor button:disabled{cursor:not-allowed;opacity:.5}
.telosMcpTools{display:flex;flex-wrap:wrap;gap:6px;padding:8px 0 12px;border-bottom:1px solid var(--dsw-alias-border-l1)}.telosMcpTools code{padding:4px 7px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);font-size:10px}.telosMcpEmpty{padding:50px 20px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:13px}
.telosMcpEditor{max-width:none}.telosMcpGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.telosMcpEditor label{display:grid;gap:6px;margin-bottom:12px;color:var(--dsw-alias-label-secondary);font-size:12px}.telosMcpEditor input,.telosMcpEditor textarea,.telosMcpEditor select{box-sizing:border-box;width:100%;min-height:36px;padding:7px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit}.telosMcpEditor textarea{resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.telosMcpAcknowledgement{display:flex!important;grid-template-columns:auto 1fr!important;align-items:start}.telosMcpAcknowledgement input{width:auto!important;min-height:auto!important;margin-top:2px}
@media(max-width:1000px){.telosMcpRow{grid-template-columns:1fr 1fr}.telosMcpGrid{grid-template-columns:1fr}.telosMcpRowActions{justify-content:flex-start}}
`

export function installMcpManagerStyles(): () => void {
  const style = document.createElement('style')
  style.dataset.telosMcpManager = 'true'
  style.textContent = MCP_MANAGER_CLIENT_CSS
  document.head.append(style)
  return () => style.remove()
}
