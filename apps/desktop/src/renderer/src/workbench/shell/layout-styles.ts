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
  .telos-sidebar-reopen {
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
