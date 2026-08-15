const OWNER = '@telos/dsh-continuity'

export const CONTINUITY_CLIENT_CSS = `
.telosContinuityFooterButton,
.telosContinuityHeaderButton {
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.telosContinuityFooterButton:hover,
.telosContinuityHeaderButton:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}
.telosContinuityFooterButton {
  box-sizing: border-box;
  width: 100%;
  min-height: 40px;
  gap: 10px;
  justify-content: flex-start;
  padding: 8px 12px;
  font-size: 14px;
}
.telosContinuityFooterButton[data-rail] {
  width: 40px;
  padding: 8px;
}
.telosContinuityHeaderButton {
  min-height: 28px;
  gap: 5px;
  padding: 3px 7px;
  font-size: 12px;
  line-height: 18px;
}
.telosContinuityBadge {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  color: var(--dsw-alias-label-primary-inverted);
  background: var(--dsw-alias-brand-primary);
  border-radius: 999px;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}
.telosContinuityBackdrop {
  position: fixed;
  z-index: 1200;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 32px;
  background: rgb(8 11 18 / 52%);
  backdrop-filter: blur(8px);
  -webkit-app-region: no-drag;
}
.telosContinuityDialog {
  box-sizing: border-box;
  width: min(1120px, calc(100vw - 64px));
  height: min(760px, calc(100vh - 64px));
  min-height: 520px;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 20px;
  box-shadow: 0 28px 90px rgb(0 0 0 / 32%);
  animation: telosContinuityIn 160ms ease-out;
}
@keyframes telosContinuityIn {
  from { opacity: 0; transform: translateY(10px) scale(.99); }
}
.telosContinuityTopbar {
  min-height: 72px;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 0 22px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.telosContinuityTitleBlock { min-width: 190px; }
.telosContinuityTitle {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -.01em;
}
.telosContinuitySubtitle {
  margin: 3px 0 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
}
.telosContinuitySearch {
  box-sizing: border-box;
  flex: 1;
  height: 38px;
  padding: 0 12px;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  outline: none;
}
.telosContinuitySearch:focus { border-color: var(--dsw-alias-brand-primary); }
.telosContinuityIconButton {
  width: 34px;
  height: 34px;
  display: inline-grid;
  place-items: center;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 9px;
}
.telosContinuityIconButton:hover { background: var(--dsw-alias-interactive-bg-hover); }
.telosContinuityTabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 22px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.telosContinuityTab {
  min-height: 32px;
  padding: 5px 12px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 8px;
  font-size: 13px;
}
.telosContinuityTab[aria-selected='true'] {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-3);
  font-weight: 600;
}
.telosContinuityHealth {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
}
.telosContinuityHealthDot {
  width: 7px;
  height: 7px;
  background: var(--dsw-alias-label-tertiary);
  border-radius: 50%;
}
.telosContinuityHealthDot[data-health='ok'] { background: var(--dsw-alias-state-success-primary); }
.telosContinuityHealthDot[data-health='error'] { background: var(--dsw-alias-state-error-primary); }
.telosContinuityBody { min-height: 0; overflow: hidden; }
.telosContinuityMemoryGrid {
  height: 100%;
  display: grid;
  grid-template-columns: minmax(320px, 42%) minmax(0, 1fr);
}
.telosContinuityListPane,
.telosContinuityDetailPane,
.telosContinuityScrollPane {
  min-height: 0;
  overflow: auto;
}
.telosContinuityListPane { border-right: 1px solid var(--dsw-alias-border-l1); }
.telosContinuityFilters {
  position: sticky;
  z-index: 1;
  top: 0;
  display: flex;
  gap: 6px;
  padding: 12px 14px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 94%, transparent);
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  backdrop-filter: blur(8px);
}
.telosContinuityFilter {
  padding: 4px 8px;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 11px;
}
.telosContinuityFilter[data-active] {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-3);
  border-color: var(--dsw-alias-border-l1);
}
.telosContinuityClaim {
  width: 100%;
  box-sizing: border-box;
  display: block;
  padding: 13px 15px;
  text-align: left;
  color: inherit;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.telosContinuityClaim:hover { background: var(--dsw-alias-interactive-bg-hover); }
.telosContinuityClaim[data-selected] {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, var(--dsw-alias-bg-layer-1));
}
.telosContinuityClaimMeta,
.telosContinuityMetaRow {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.telosContinuityClaimStatement {
  margin: 8px 0 5px;
  font-size: 13px;
  line-height: 20px;
}
.telosContinuityMuted {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
}
.telosContinuityChip {
  display: inline-flex;
  align-items: center;
  min-height: 19px;
  padding: 0 6px;
  color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-fill-l2);
  border-radius: 5px;
  font-size: 10px;
  line-height: 19px;
}
.telosContinuityChip[data-status='confirmed'] { color: var(--dsw-alias-state-success-primary); }
.telosContinuityChip[data-status='revoked'],
.telosContinuityChip[data-status='superseded'] { color: var(--dsw-alias-label-tertiary); }
.telosContinuityDetailPane { padding: 22px; }
.telosContinuityDetailTitle { margin: 0 0 8px; font-size: 17px; line-height: 25px; }
.telosContinuitySection { margin-top: 24px; }
.telosContinuitySectionTitle {
  margin: 0 0 10px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.telosContinuityDefinition {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 8px 12px;
  margin: 16px 0 0;
  font-size: 12px;
  line-height: 19px;
}
.telosContinuityDefinition dt { color: var(--dsw-alias-label-tertiary); }
.telosContinuityDefinition dd { margin: 0; overflow-wrap: anywhere; }
.telosContinuitySource,
.telosContinuityReceipt,
.telosContinuityGraphRow {
  padding: 12px;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
}
.telosContinuitySource + .telosContinuitySource,
.telosContinuityReceipt + .telosContinuityReceipt,
.telosContinuityGraphRow + .telosContinuityGraphRow { margin-top: 8px; }
.telosContinuitySourceContent {
  margin: 8px 0 0;
  padding: 8px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--dsw-alias-bg-layer-1);
  border-radius: 7px;
  font-size: 12px;
}
.telosContinuityEditGrid { display: grid; gap: 9px; }
.telosContinuityField {
  box-sizing: border-box;
  width: 100%;
  min-height: 36px;
  padding: 7px 10px;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  font: inherit;
  resize: vertical;
}
.telosContinuityActions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.telosContinuityButton {
  min-height: 34px;
  padding: 6px 12px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  background: var(--dsw-alias-bg-layer-3);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  font-size: 12px;
}
.telosContinuityButton:hover { border-color: var(--dsw-alias-border-l2); }
.telosContinuityButton[data-primary] { color: white; background: var(--dsw-alias-brand-primary); border-color: transparent; }
.telosContinuityButton[data-danger] { color: var(--dsw-alias-state-error-primary); }
.telosContinuityButton:disabled { cursor: not-allowed; opacity: .5; }
.telosContinuityBanner {
  margin: 12px 18px 0;
  padding: 9px 11px;
  color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-bg-layer-2);
  border-radius: 8px;
  font-size: 12px;
}
.telosContinuityBanner[data-error] { color: var(--dsw-alias-state-error-primary); }
.telosContinuityEmpty {
  height: 100%;
  display: grid;
  place-items: center;
  padding: 30px;
  color: var(--dsw-alias-label-tertiary);
  text-align: center;
  font-size: 13px;
}
.telosContinuityContent { padding: 18px 22px 28px; }
.telosContinuityContentTitle { margin: 0 0 4px; font-size: 16px; }
.telosContinuityContentSubtitle { margin: 0 0 16px; color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.telosContinuityGraphRow {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(100px, auto) minmax(120px, 1fr);
  align-items: center;
  gap: 12px;
}
.telosContinuityNode {
  min-width: 0;
  padding: 9px 10px;
  text-align: center;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 9px;
  overflow-wrap: anywhere;
  font-size: 12px;
}
.telosContinuityEdge { color: var(--dsw-alias-label-tertiary); text-align: center; font-size: 11px; }
.telosContinuityEdge::after { content: ' →'; }
.telosContinuityReceiptHeader { display: flex; align-items: center; gap: 8px; }
.telosContinuityReceiptQuery { margin: 8px 0 0; font-size: 13px; line-height: 20px; }
.telosContinuityReceiptClaims { margin: 8px 0 0; color: var(--dsw-alias-label-secondary); font-size: 11px; }
.telosContinuityAuditGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.telosContinuityAuditColumn { min-width: 0; }
.telosContinuitySpinner { animation: telosContinuitySpin .8s linear infinite; }
@keyframes telosContinuitySpin { to { transform: rotate(360deg); } }
@media (max-width: 820px) {
  .telosContinuityBackdrop { padding: 12px; }
  .telosContinuityDialog { width: calc(100vw - 24px); height: calc(100vh - 24px); }
  .telosContinuityMemoryGrid { grid-template-columns: 1fr; }
  .telosContinuityDetailPane { display: none; }
  .telosContinuityAuditGrid { grid-template-columns: 1fr; }
}
`

export function installContinuityStyles(): () => void {
  const existing = document.querySelector<HTMLStyleElement>(`style[data-telos-style="${OWNER}"]`)
  if (existing !== null) return () => undefined
  const style = document.createElement('style')
  style.dataset.telosStyle = OWNER
  style.textContent = CONTINUITY_CLIENT_CSS
  document.head.append(style)
  return () => style.remove()
}
