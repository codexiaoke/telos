const STYLE_ID = 'telos-personalization-styles'

export const PERSONALIZATION_STYLES = `
.telosPersonalization{box-sizing:border-box;width:100%;color:var(--dsw-alias-label-primary)}
.telosPersonalizationHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:20px}.telosPersonalizationHeader h1{margin:0;font-size:18px}.telosPersonalizationHeader p{margin:6px 0 0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.55}
.telosPersonalizationActions{display:flex;gap:8px}.telosPersonalization button{min-height:32px;padding:5px 11px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:inherit;cursor:pointer}.telosPersonalization button[data-primary]{border-color:transparent;background:var(--dsw-alias-brand-primary);color:#fff}.telosPersonalization button[data-danger]{color:var(--dsw-alias-state-error-primary)}.telosPersonalization button:disabled{cursor:not-allowed;opacity:.5}
.telosPersonalizationPhase{display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);font-size:12px}.telosPersonalizationPhase span{color:var(--dsw-alias-label-tertiary);line-height:1.55}
.telosPersonalizationBanner{margin-bottom:12px;padding:9px 12px;border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent);font-size:12px}.telosPersonalizationBanner[data-error]{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);color:var(--dsw-alias-state-error-primary)}
.telosPersonalizationEditor{display:grid;gap:8px}.telosPersonalizationEditor>span{font-size:12px;font-weight:600}.telosPersonalizationEditor textarea{box-sizing:border-box;width:100%;min-height:260px;padding:14px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;outline:none;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:13px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;resize:vertical}.telosPersonalizationEditor textarea:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent)}.telosPersonalizationEditor small{justify-self:end;color:var(--dsw-alias-label-tertiary);font-size:10px}.telosPersonalizationEditor small[data-error]{color:var(--dsw-alias-state-error-primary)}
.telosPersonalizationFooter{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-top:18px}.telosPersonalizationFooter p{max-width:760px;margin:0;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.6}.telosPersonalizationLoading{padding:24px;color:var(--dsw-alias-label-tertiary);font-size:12px}
`

export function installPersonalizationStyles(): () => void {
  const existing = document.getElementById(STYLE_ID)
  if (existing !== null) return () => undefined
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = PERSONALIZATION_STYLES
  document.head.append(style)
  return () => style.remove()
}
