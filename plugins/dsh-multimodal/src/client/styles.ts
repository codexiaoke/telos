export const MULTIMODAL_CLIENT_CSS = String.raw`
.telosMmSettings{box-sizing:border-box;width:100%;height:100%;overflow:auto;padding:6px 0 32px;color:var(--dsw-alias-label-primary)}
.telosMmHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}.telosMmHeader h1{margin:0 0 5px;font-size:18px}.telosMmHeader p,.telosMmSectionTitle p{max-width:720px;margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.6}
.telosMmActions{display:flex;gap:8px}.telosMmSettings button{min-height:32px;padding:5px 11px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:inherit;cursor:pointer}.telosMmSettings button[data-primary]{border-color:transparent;background:var(--dsw-alias-brand-primary);color:white}.telosMmSettings button[data-danger]{color:var(--dsw-alias-state-error-primary)}.telosMmSettings button:disabled{cursor:not-allowed;opacity:.5}
.telosMmPhase,.telosMmBanner{display:flex;gap:9px;margin-bottom:14px;padding:10px 12px;border-radius:9px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55}.telosMmPhase strong{color:var(--dsw-alias-brand-primary);white-space:nowrap}.telosMmBanner[data-error]{color:var(--dsw-alias-state-error-primary)}
.telosMmMaster{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:16px 0;border-top:1px solid var(--dsw-alias-border-l1);border-bottom:1px solid var(--dsw-alias-border-l1)}.telosMmMaster span{display:grid;gap:4px}.telosMmMaster small{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5}.telosMmMaster input{width:18px;height:18px;accent-color:var(--dsw-alias-brand-primary)}
.telosMmSectionTitle{display:flex;align-items:baseline;gap:12px;margin:28px 0 12px}.telosMmSectionTitle h2{margin:0;font-size:14px;white-space:nowrap}
.telosMmModelCard{display:grid;gap:13px;padding:16px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}.telosMmModelCard>label{display:grid;grid-template-columns:180px minmax(260px,520px);align-items:center;gap:12px;color:var(--dsw-alias-label-secondary);font-size:12px}.telosMmSettings select{box-sizing:border-box;width:100%;min-height:36px;padding:6px 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit}.telosMmModelCard>p{margin:0;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.55}
.telosMmStatus{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-tertiary);font-size:11px}.telosMmStatus strong{padding:3px 7px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);font-size:10px}.telosMmStatus[data-status=available] strong{color:var(--dsw-alias-state-success-primary)}.telosMmStatus[data-status=incompatible] strong{color:var(--dsw-alias-state-error-primary)}
.telosMmFlow{display:flex;align-items:center;gap:9px;margin-top:18px;padding:13px;border-radius:9px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:11px}.telosMmFlow i{color:var(--dsw-alias-label-tertiary);font-style:normal}
.telosMmFooter{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:24px}.telosMmFooter p,.telosMmLoading{color:var(--dsw-alias-label-tertiary);font-size:11px}.telosMmLoading{padding:50px 20px;text-align:center}
@media(max-width:900px){.telosMmHeader,.telosMmFooter{align-items:stretch;flex-direction:column}.telosMmActions{justify-content:flex-end}.telosMmModelCard>label{grid-template-columns:1fr}.telosMmSectionTitle{align-items:flex-start;flex-direction:column;gap:3px}.telosMmFlow{align-items:flex-start;flex-direction:column}.telosMmFlow i{transform:rotate(90deg)}}
`

export function installMultimodalStyles(): () => void {
  const style = document.createElement('style')
  style.dataset.telosMultimodal = 'true'
  style.textContent = MULTIMODAL_CLIENT_CSS
  document.head.append(style)
  return () => style.remove()
}
