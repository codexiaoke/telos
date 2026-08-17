export const COMPANION_CLIENT_CSS = `
.telosCompanionSettings{box-sizing:border-box;width:100%;height:100%;overflow:auto;padding:6px 0 36px;color:var(--dsw-alias-label-primary)}
.telosCompanionHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:18px}.telosCompanionHeader h1,.telosCompanionImport h2{margin:0;font-size:18px}.telosCompanionHeader p,.telosCompanionImport p{max-width:680px;margin:6px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6}
.telosCompanionSettings button{min-height:32px;padding:5px 11px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:inherit;cursor:pointer}.telosCompanionSettings button[data-primary]{border-color:transparent;background:var(--dsw-alias-brand-primary);color:#fff}.telosCompanionSettings button[data-danger]{color:var(--dsw-alias-state-error-primary)}.telosCompanionSettings button:disabled{cursor:not-allowed;opacity:.5}
.telosCompanionStatus{display:grid;gap:4px;margin-bottom:14px;padding:14px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}.telosCompanionStatus[data-visible]{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 42%,var(--dsw-alias-border-l1))}.telosCompanionStatus strong{font-size:13px}.telosCompanionStatus span,.telosCompanionCard small,.telosCompanionCustomList small{color:var(--dsw-alias-label-tertiary);font-size:11px}
.telosCompanionBanner{margin-bottom:12px;padding:9px 12px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);font-size:12px}.telosCompanionBanner[data-error]{color:var(--dsw-alias-state-error-primary)}
.telosCompanionCard{display:grid;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}.telosCompanionCard>label{display:grid;grid-template-columns:minmax(180px,1fr) minmax(220px,360px);align-items:center;gap:20px;padding:14px 16px;border-bottom:1px solid var(--dsw-alias-border-l1)}.telosCompanionCard>label:last-child{border-bottom:0}.telosCompanionCard label>span{display:grid;gap:3px}.telosCompanionSettings select{box-sizing:border-box;width:100%;min-height:36px;padding:6px 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit}.telosCompanionSettings select:focus,.telosCompanionSettings button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.telosCompanionSwitch input{justify-self:end;width:18px;height:18px;accent-color:var(--dsw-alias-brand-primary)}
.telosCompanionImport{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-top:24px}.telosCompanionImport>div:last-child{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.telosCompanionCustomList{display:grid;gap:8px;margin-top:14px}.telosCompanionCustomList>div{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px}.telosCompanionCustomList span{display:grid;gap:2px}
.telosCompanionEmpty{padding:18px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1)}
@media(max-width:720px){.telosCompanionHeader,.telosCompanionImport{display:grid}.telosCompanionCard>label{grid-template-columns:1fr}.telosCompanionImport>div:last-child{justify-content:flex-start}}
`

const STYLE_ID = 'telos-companion-client-styles'

export function installCompanionStyles(): () => void {
  const existing = document.getElementById(STYLE_ID)
  if (existing !== null) return () => undefined
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = COMPANION_CLIENT_CSS
  document.head.append(style)
  return () => style.remove()
}
