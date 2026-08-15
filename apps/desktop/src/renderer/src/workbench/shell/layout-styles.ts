const STYLE_OWNER = '@telos/renderer/ui-layout'

export const TELOS_LAYOUT_CSS = `
.telos-workbench-frame {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-rows: 100%;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background:
    radial-gradient(circle at 72% -18%, rgb(102 117 255 / 7%), transparent 34%),
    var(--dsw-alias-bg-base);
  transition: grid-template-columns var(--ds-transition-duration-slow) var(--ds-ease-in-out);
}

.telos-workbench-frame[data-dragging] {
  cursor: col-resize;
  transition: none;
}

.telos-workbench-frame[data-view-mode='editor'] {
  background: var(--dsw-alias-bg-base);
}

.telos-editor-files-seat {
  display: none;
}

.telos-workbench-frame[data-view-mode='editor'] > .telos-editor-files-seat {
  display: contents;
}

.telos-workbench-sidebar,
.telos-workbench-center,
.telos-workbench-details {
  position: relative;
  min-width: 0;
}

/* Keep the columns in the frame's shared stacking context. DSH mounts the
   full-viewport Settings dialog as a fixed descendant of sidebar.settings;
   a z-index here would trap that dialog below the later center/details
   siblings even though the dialog itself owns z-index: 1000. */

/* Give the Settings workspace enough horizontal room for dense Telos pages
   such as Memory while preserving a consistent six-percent viewport gutter.
   The direct nav child distinguishes the Settings panel from onboarding and
   other dialogs that share the same sidebar-owned surface. */
.telos-workbench-sidebar [data-slot='sidebar.settings'] [role='dialog']:has(> nav) {
  width: 88vw;
  max-width: 88vw;
}

/* DSH's individual Settings features were designed for the original 800px
   dialog and cap their roots at 720–760px. Once Telos widens the shell those
   caps leave a large dead column, so every section and nested Plugins tab
   should consume the full content column. The stable slot anchors keep this
   independent of upstream CSS-module class names. */
.telos-workbench-sidebar [data-slot='settings.section'] > *,
.telos-workbench-sidebar [data-slot='settings.plugins.tab'] > * {
  box-sizing: border-box;
  width: 100%;
  max-width: none;
}

.telos-workbench-sidebar {
  overflow: hidden;
  background: color-mix(in srgb, var(--dsw-specific-sidebar-fill) 96%, transparent);
  border-right: 1px solid var(--dsw-alias-border-l1);
}

/* ui-workspace keeps ownership of search, ordering and add-workspace behavior.
   Telos only re-seats its stable sidebar.workspaces header in the productive
   desktop titlebar, alongside the sidebar fold control. */
.telos-workbench-sidebar [data-slot='sidebar.workspaces'] > div > div:first-child {
  position: absolute;
  z-index: 6;
  top: 12px;
  right: 24px;
  left: max(160px, calc(var(--telos-titlebar-left-safe, 88px) + 72px));
  height: 28px;
  margin: 0;
  padding: 0;
  overflow: visible;
  -webkit-app-region: no-drag;
}

.telos-workbench-sidebar [data-slot='sidebar.workspaces'] > div > div:first-child > span:first-child {
  display: none;
}

.telos-workbench-sidebar [data-slot='sidebar.workspaces'] > div > div:first-child button,
.telos-workbench-sidebar [data-slot='sidebar.workspaces'] > div > div:first-child input {
  -webkit-app-region: no-drag;
}

/* Workspace selection already lives in the composer. Keep the WorkBuddy-like
   fold/search/filter trio here and remove the duplicated Add Workspace entry. */
.telos-workbench-sidebar [data-slot='sidebar.workspaces'] > div > div:first-child > div:nth-of-type(2) > button:last-of-type {
  display: none;
}

/* In DSH's collapsed rail the workspace actions become the first div in the
   section header. Hide the same duplicated action there without touching the
   separate search control rendered below the header. */
.telos-workbench-sidebar [data-slot='sidebar.workspaces'] > div > div:first-child > div:first-of-type > button:last-of-type {
  display: none;
}

/* The upstream workspace browser exposes its search-open state through the
   search trigger's aria-expanded attribute. Reuse that stable state instead of
   stretching the titlebar control across the narrow sidebar. */
.telos-workbench-sidebar:has(
  [data-slot='sidebar.workspaces'] > div > div:first-child > div:first-of-type button[aria-expanded='true']
) {
  overflow: visible;
}

.telos-workbench-sidebar:has(
  [data-slot='sidebar.workspaces'] > div > div:first-child > div:first-of-type button[aria-expanded='true']
)::after {
  content: '';
  position: fixed;
  z-index: 99;
  inset: 0;
  background: rgb(0 0 0 / 48%);
  -webkit-app-region: no-drag;
}

.telos-workbench-sidebar [data-slot='sidebar.workspaces'] > div:has(
  > div:first-child > div:first-of-type button[aria-expanded='true']
) {
  position: fixed;
  z-index: 100;
  top: 50%;
  left: 50%;
  width: min(640px, calc(100vw - 64px));
  height: min(640px, calc(100vh - 112px));
  min-height: 360px;
  padding: 20px;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 24px;
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: 0 24px 72px rgb(0 0 0 / 24%);
  transform: translate(-50%, -50%);
  animation: telos-search-dialog-in 160ms var(--ds-ease-in-out);
  -webkit-app-region: no-drag;
}

.telos-workbench-sidebar [data-slot='sidebar.workspaces'] > div:has(
  > div:first-child > div:first-of-type button[aria-expanded='true']
) > div:first-child {
  position: relative;
  z-index: 1;
  inset: auto;
  width: 100%;
  height: 44px;
  margin: 0 0 16px;
  padding: 0;
  overflow: visible;
}

.telos-workbench-sidebar [data-slot='sidebar.workspaces'] > div:has(
  > div:first-child > div:first-of-type button[aria-expanded='true']
) > div:first-child > div:first-of-type {
  flex: 1;
  width: 100%;
  max-width: none;
  height: 44px;
  margin: 0;
  padding: 0;
}

.telos-workbench-sidebar [data-slot='sidebar.workspaces'] > div:has(
  > div:first-child > div:first-of-type button[aria-expanded='true']
) > div:first-child > div:first-of-type > div {
  width: 100%;
  height: 44px;
  margin: 0;
  padding: 0 8px;
  border: 0;
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l1);
}

.telos-workbench-sidebar [data-slot='sidebar.workspaces'] > div:has(
  > div:first-child > div:first-of-type button[aria-expanded='true']
) > div:first-child > div:first-of-type input {
  margin-left: 0;
  font-size: 15px;
  line-height: 22px;
}

.telos-workbench-sidebar [data-slot='sidebar.workspaces'] > div:has(
  > div:first-child > div:first-of-type button[aria-expanded='true']
) > div:first-child > div:nth-of-type(2) {
  display: none;
}

.telos-workbench-sidebar [data-slot='sidebar.workspaces'] > div:has(
  > div:first-child > div:first-of-type button[aria-expanded='true']
) > div:nth-of-type(2) {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.telos-workbench-sidebar [data-slot='sidebar.workspaces'] > div:has(
  > div:first-child > div:first-of-type button[aria-expanded='true']
) > div:nth-of-type(2) [role='treeitem'] {
  min-height: 40px;
  border-radius: 10px;
}

/* Content search is an optional upstream enhancement. Keep its pending and
   degraded-capability messages out of the product UI; DSH's regular empty
   state remains visible when neither local names nor remote content match. */
.telos-workbench-sidebar [data-slot='sidebar.workspaces'] > div:has(
  > div:first-child > div:first-of-type button[aria-expanded='true']
) > div:nth-of-type(2) [role='status'] {
  display: none;
}

@keyframes telos-search-dialog-in {
  from {
    opacity: 0;
    transform: translate(-50%, calc(-50% + 12px)) scale(0.985);
  }
}

.telos-workbench-sidebar [data-telos-search-sidebar-snapshot] {
  flex: 1;
  min-height: 0;
  pointer-events: none;
  user-select: none;
  animation: none;
}

.telos-workbench-center {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 98%, transparent);
}

/* The DSH session header is the desktop titlebar surface. It remains useful
   space: native controls occupy only their platform rectangles while the
   session title, tabs and utilities stay in the same row. */
.telos-workbench-center [data-slot='conversation.session.header'] > header {
  z-index: 2;
  padding-right: calc(28px + var(--telos-titlebar-right-safe, 0px));
  -webkit-app-region: drag;
  user-select: none;
}

.telos-workbench-center [data-slot='conversation.session.header'] > header button,
.telos-workbench-center [data-slot='conversation.session.header'] > header a,
.telos-workbench-center [data-slot='conversation.session.header'] > header input,
.telos-workbench-center [data-slot='conversation.session.header'] > header [role='button'] {
  -webkit-app-region: no-drag;
  user-select: auto;
}

.telos-workbench-frame[data-sidebar-collapsed] .telos-workbench-center [data-slot='conversation.session.header'] > header {
  padding-left: var(--telos-titlebar-collapsed-content-left, 132px);
}

.telos-workbench-frame[data-sidebar-collapsed] .telos-workbench-sidebar {
  visibility: hidden;
  pointer-events: none;
  border-right: 0;
}

/* A blank conversation hides the DSH session header. Keep just that empty
   top strip draggable without placing a full-width element over the hero. */
.telos-workbench-center:has([data-phase='hero'])::before,
.telos-workbench-center:has([data-phase='settling'])::before {
  content: '';
  position: absolute;
  z-index: 1;
  inset: 0 var(--telos-titlebar-right-safe, 0px) auto 0;
  height: var(--telos-titlebar-height, 52px);
  -webkit-app-region: drag;
}

.telos-workbench-details {
  overflow: hidden;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 98%, transparent);
  border-left: 1px solid var(--dsw-alias-border-l2);
}

.telos-workbench-frame[data-details-collapsed] .telos-workbench-details {
  border-left: none;
}

.telos-workbench-resizer {
  position: absolute;
  z-index: 4;
  top: 0;
  bottom: 0;
  width: 10px;
  margin-left: -5px;
  cursor: col-resize;
  touch-action: none;
  outline: none;
  transition: left var(--ds-transition-duration-slow) var(--ds-ease-in-out);
}

.telos-workbench-frame[data-dragging] .telos-workbench-resizer {
  transition: none;
}

.telos-workbench-resizer::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 3px;
  height: 42px;
  border-radius: 999px;
  background: rgb(102 114 250 / 0%);
  box-shadow: 0 0 0 1px rgb(102 114 250 / 0%);
  opacity: 0;
  transform: translate(-50%, -50%) scaleY(.76);
  transition:
    opacity 180ms ease,
    transform 240ms cubic-bezier(.22, 1, .36, 1),
    background 180ms ease,
    box-shadow 180ms ease;
}

.telos-workbench-resizer:hover::after,
.telos-workbench-resizer:focus-visible::after,
.telos-workbench-resizer[data-dragging='true']::after {
  background: rgb(102 114 250 / 52%);
  box-shadow: 0 0 0 1px rgb(102 114 250 / 13%), 0 0 18px rgb(102 114 250 / 20%);
  opacity: 1;
  transform: translate(-50%, -50%) scaleY(1);
}

.telos-workbench-overlay {
  position: absolute;
  z-index: 20;
  inset: 0;
  pointer-events: none;
}

.telos-workbench-overlay > * {
  pointer-events: auto;
}

.telos-view-mode-toggle {
  position: absolute;
  z-index: 9;
  top: 10px;
  left: calc(var(--telos-titlebar-left-safe, 12px) + 40px);
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 9px;
  color: var(--dsw-alias-label-secondary);
  background: transparent;
  cursor: pointer;
  -webkit-app-region: no-drag;
}

.telos-view-mode-toggle svg {
  width: 20px;
  height: 20px;
}

.telos-view-mode-toggle:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}

.telos-view-mode-toggle[data-active] {
  color: var(--dsw-alias-state-business-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 13%, transparent);
}

.telos-view-mode-toggle:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 62%, transparent);
  outline-offset: 2px;
}

.telos-editor-explorer {
  display: flex;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  background: color-mix(in srgb, var(--dsw-specific-sidebar-fill) 97%, transparent);
  border-right: 1px solid var(--dsw-alias-border-l1);
}

.telos-editor-explorer-header {
  display: flex;
  min-height: var(--telos-titlebar-height, 52px);
  padding: 0 10px 0 calc(var(--telos-titlebar-left-safe, 12px) + 82px);
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  -webkit-app-region: drag;
}

.telos-editor-explorer-header > span {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.telos-editor-explorer-header button,
.telos-editor-breadcrumb button {
  display: grid;
  width: 28px;
  height: 28px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 7px;
  color: var(--dsw-alias-label-secondary);
  background: transparent;
  cursor: pointer;
  -webkit-app-region: no-drag;
}

.telos-editor-explorer-header button:hover,
.telos-editor-breadcrumb button:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}

.telos-editor-explorer-header svg {
  width: 18px;
  height: 18px;
}

.telos-editor-explorer-body {
  min-height: 0;
  flex: 1;
  padding: 8px 6px 18px;
  overflow: auto;
}

.telos-file-tree-row {
  display: flex;
  width: 100%;
  height: 28px;
  padding-top: 0;
  padding-right: 8px;
  padding-bottom: 0;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  border: 0;
  border-radius: 6px;
  color: var(--dsw-alias-label-secondary);
  background: transparent;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: default;
}

.telos-file-tree-row:hover,
.telos-file-tree-row[data-active] {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}

.telos-file-tree-row[data-active] {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 11%, var(--dsw-alias-interactive-bg-hover));
}

.telos-file-tree-row[data-loading] {
  opacity: .62;
}

.telos-file-tree-chevron,
.telos-file-tree-icon {
  display: grid;
  width: 15px;
  min-width: 15px;
  height: 15px;
  place-items: center;
  color: var(--dsw-alias-label-tertiary);
}

.telos-file-tree-chevron svg,
.telos-file-tree-icon img {
  width: 15px;
  height: 15px;
}

.telos-file-tree-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.telos-file-tree-note,
.telos-editor-empty-small,
.telos-editor-error {
  padding: 10px 12px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 1.5;
}

.telos-editor-error,
.telos-editor-save-error {
  color: var(--dsw-alias-state-error);
}

.telos-editor-surface {
  display: flex;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  background: var(--dsw-alias-bg-base);
}

.telos-editor-tabs {
  display: flex;
  min-height: var(--telos-titlebar-height, 52px);
  padding: 0 12px 0 1px;
  align-items: stretch;
  overflow-x: auto;
  overflow-y: hidden;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 50%, var(--dsw-alias-bg-base));
  scrollbar-width: none;
  -webkit-app-region: drag;
}

.telos-editor-tabs::-webkit-scrollbar {
  display: none;
}

.telos-editor-tab {
  position: relative;
  display: flex;
  min-width: 112px;
  max-width: 190px;
  height: auto;
  align-items: center;
  border-right: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-tertiary);
  background: transparent;
  -webkit-app-region: no-drag;
}

.telos-editor-tab:hover,
.telos-editor-tab[data-menu-open] {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}

.telos-editor-tab[data-active] {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
}

.telos-editor-tab[data-active]::before {
  position: absolute;
  z-index: 1;
  top: 0;
  right: 0;
  left: 0;
  height: 2px;
  background: var(--dsw-alias-state-business-primary);
  content: '';
}

.telos-editor-tab > button:first-child {
  display: flex;
  min-width: 0;
  flex: 1;
  height: 100%;
  padding: 0 4px 0 10px;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  border: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.telos-editor-tab > button:first-child img {
  width: 15px;
  min-width: 15px;
  height: 15px;
}

.telos-editor-tab-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.telos-editor-dirty {
  width: 6px;
  min-width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.telos-editor-tab-close {
  position: relative;
  display: grid;
  width: 25px;
  min-width: 25px;
  height: 25px;
  margin-right: 4px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 4px;
  color: inherit;
  background: transparent;
  cursor: pointer;
}

.telos-editor-tab-close-icon {
  display: grid;
  width: 15px;
  height: 15px;
  place-items: center;
  opacity: 0;
}

.telos-editor-tab-close-icon svg {
  width: 15px;
  height: 15px;
}

.telos-editor-tab[data-active]:not([data-dirty]) .telos-editor-tab-close-icon,
.telos-editor-tab:hover .telos-editor-tab-close-icon,
.telos-editor-tab[data-menu-open] .telos-editor-tab-close-icon {
  opacity: .78;
}

.telos-editor-tab:hover .telos-editor-dirty,
.telos-editor-tab[data-menu-open] .telos-editor-dirty {
  display: none;
}

.telos-editor-tab-close:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

.telos-editor-tab-menu-layer {
  position: fixed;
  z-index: 1000;
  inset: 0;
  -webkit-app-region: no-drag;
}

.telos-editor-tab-menu {
  position: fixed;
  display: flex;
  width: 190px;
  padding: 5px;
  flex-direction: column;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: 0 10px 28px rgb(0 0 0 / 18%);
}

.telos-editor-tab-menu button {
  height: 31px;
  padding: 0 9px;
  border: 0;
  border-radius: 5px;
  color: inherit;
  background: transparent;
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: default;
}

.telos-editor-tab-menu button:hover:not(:disabled),
.telos-editor-tab-menu button:focus-visible {
  color: var(--dsw-alias-label-primary-foreground);
  background: var(--dsw-alias-state-business-primary);
  outline: none;
}

.telos-editor-tab-menu button:disabled {
  opacity: .38;
}

.telos-editor-tab-menu-separator {
  margin-top: 5px;
  border-top: 1px solid var(--dsw-alias-border-l1) !important;
  border-radius: 0 0 5px 5px !important;
}

.telos-editor-document {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.telos-editor-breadcrumb {
  display: flex;
  height: 34px;
  padding: 0 10px 0 14px;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
}

.telos-editor-breadcrumb span {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.telos-editor-breadcrumb button {
  width: auto;
  padding: 0 9px;
  font: inherit;
}

.telos-editor-breadcrumb button:disabled {
  opacity: .42;
  cursor: default;
}

.telos-monaco-shell {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow: visible;
  background: var(--dsw-alias-bg-base);
}

.telos-monaco-editor {
  width: 100%;
  height: 100%;
}

/* Shiki supplies TextMate colors while Monaco owns transient editor chrome.
   Keep hover labels readable even when a compact Shiki theme omits one of
   Monaco's editorHoverWidget color tokens. */
.monaco-hover.workbench-hover {
  color: var(--vscode-editorHoverWidget-foreground, var(--dsw-alias-label-primary));
  background: var(--vscode-editorHoverWidget-background, var(--dsw-alias-bg-layer-2));
  border-color: var(--vscode-editorHoverWidget-border, var(--dsw-alias-border-l2));
  box-shadow: 0 6px 18px rgb(0 0 0 / 16%);
}

.monaco-hover.workbench-hover .hover-contents {
  opacity: 1;
}

.telos-monaco-status {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--dsw-alias-label-tertiary);
  background: var(--dsw-alias-bg-base);
  font-size: 12px;
}

.telos-editor-save-error {
  padding: 8px 12px;
  border-top: 1px solid var(--dsw-alias-border-l1);
  font-size: 12px;
}

.telos-editor-empty {
  display: flex;
  min-height: 0;
  flex: 1;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: var(--dsw-alias-label-tertiary);
  text-align: center;
}

.telos-editor-empty strong {
  color: var(--dsw-alias-label-secondary);
  font-size: 14px;
  font-weight: 550;
}

.telos-editor-empty span:last-child {
  max-width: 320px;
  font-size: 12px;
  line-height: 1.6;
}

.telos-editor-empty-mark {
  display: grid;
  width: 34px;
  height: 34px;
  margin-bottom: 4px;
  place-items: center;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  color: var(--dsw-alias-label-tertiary);
  font: 600 14px/1 ui-monospace, monospace;
}

.telos-editor-conversation {
  display: flex;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 98%, transparent);
  border-left: 1px solid var(--dsw-alias-border-l2);
}

.telos-editor-conversation [data-slot='conversation.session.header'] > header {
  padding-right: calc(16px + var(--telos-titlebar-right-safe, 0px));
  -webkit-app-region: drag;
  user-select: none;
}

.telos-editor-conversation [data-slot='conversation.session.header'] > header button,
.telos-editor-conversation [data-slot='conversation.session.header'] > header a,
.telos-editor-conversation [data-slot='conversation.session.header'] > header input,
.telos-editor-conversation [data-slot='conversation.session.header'] > header [role='button'] {
  -webkit-app-region: no-drag;
  user-select: auto;
}

.telos-sidebar-reopen {
  position: absolute;
  z-index: 8;
  top: 10px;
  left: var(--telos-titlebar-left-safe, 12px);
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 9px;
  color: var(--dsw-alias-label-secondary);
  background: transparent;
  cursor: pointer;
  -webkit-app-region: no-drag;
  animation: telos-sidebar-reopen-in 220ms cubic-bezier(.22, 1, .36, 1) both;
}

.telos-sidebar-reopen svg {
  width: 20px;
  height: 20px;
}

.telos-sidebar-reopen:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}

.telos-sidebar-reopen:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 62%, transparent);
  outline-offset: 2px;
}

@keyframes telos-sidebar-reopen-in {
  from {
    opacity: 0;
    transform: translateX(-6px) scale(.94);
  }
}

@media (prefers-reduced-motion: reduce) {
  .telos-workbench-frame,
  .telos-workbench-resizer,
  .telos-workbench-resizer::after,
  .telos-sidebar-reopen,
  .telos-view-mode-toggle {
    transition: none;
    animation: none;
  }
}
`

export function installTelosLayoutStyles(): () => void {
  const previous = document.querySelector<HTMLStyleElement>(`style[data-telos-owner="${STYLE_OWNER}"]`)
  previous?.remove()
  const style = document.createElement('style')
  style.dataset.telosOwner = STYLE_OWNER
  style.textContent = TELOS_LAYOUT_CSS
  document.head.append(style)
  return () => style.remove()
}
