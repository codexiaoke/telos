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

.telos-workbench-sidebar {
  overflow: hidden;
  background: color-mix(in srgb, var(--dsw-specific-sidebar-fill) 96%, transparent);
  border-right: 1px solid var(--dsw-alias-border-l1);
}

.telos-workbench-center {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 98%, transparent);
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

@media (prefers-reduced-motion: reduce) {
  .telos-workbench-frame,
  .telos-workbench-resizer,
  .telos-workbench-resizer::after {
    transition: none;
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
