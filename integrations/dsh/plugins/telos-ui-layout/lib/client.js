window.__ModuleLoader__.load({
  id: "@deepseek-ai/dsh-client-ui-layout",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// apps/desktop/src/renderer/src/workbench/dsh-client.ts
var dsh_client_exports = {};
__export(dsh_client_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(dsh_client_exports);

// apps/desktop/src/renderer/src/workbench/shell/TelosAppFrame.tsx
var import_react = require("react");

// apps/desktop/src/renderer/src/workbench/shell/layout-model.ts
var CENTER_MIN = 620;
var SIDEBAR_MIN = 264;
var SIDEBAR_MAX = 420;
var SIDEBAR_DEFAULT = 296;
var SIDEBAR_COLLAPSED = 0;
var SIDEBAR_AUTO_COLLAPSE = 1060;
var DETAILS_MIN = 300;
var DETAILS_MAX = 520;
var DETAILS_DEFAULT = 380;
function clampWidth(px, min, max) {
  return Math.min(max, Math.max(min, Math.round(px)));
}
function computeWorkbenchColumns(viewport, sidebar, details) {
  const resolvedSidebar = sidebar === 0 ? SIDEBAR_COLLAPSED : clampWidth(sidebar, SIDEBAR_MIN, SIDEBAR_MAX);
  const preferredDetails = details === 0 ? 0 : clampWidth(details, DETAILS_MIN, DETAILS_MAX);
  if (resolvedSidebar + preferredDetails + CENTER_MIN <= viewport) {
    return {
      sidebar: resolvedSidebar,
      center: viewport - resolvedSidebar - preferredDetails,
      details: preferredDetails
    };
  }
  const concededDetails = preferredDetails === 0 ? 0 : Math.max(DETAILS_MIN, viewport - resolvedSidebar - CENTER_MIN);
  if (resolvedSidebar + concededDetails + CENTER_MIN <= viewport) {
    return {
      sidebar: resolvedSidebar,
      center: CENTER_MIN,
      details: concededDetails
    };
  }
  return {
    sidebar: resolvedSidebar,
    center: Math.max(0, viewport - resolvedSidebar),
    details: 0
  };
}

// apps/desktop/src/renderer/src/workbench/shell/TelosAppFrame.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var OPEN_SEARCH_DIALOG_SELECTOR = ".telos-workbench-sidebar [data-slot='sidebar.workspaces'] > div:has(> div:first-child > div:first-of-type button[aria-expanded='true'])";
var SEARCH_SIDEBAR_SNAPSHOT_SELECTOR = "[data-telos-search-sidebar-snapshot]";
function CenterColumn({ children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telos-workbench-center", children });
}
function DetailsColumn({ children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telos-workbench-details", children });
}
function SidebarOpenIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { "aria-hidden": "true", fill: "none", viewBox: "0 0 20 20", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { height: "14", rx: "3.5", stroke: "currentColor", strokeWidth: "1.6", width: "16", x: "2", y: "3" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M7 3.8v12.4", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "1.6" })
  ] });
}
function Resizer({ side, left, value, onStart, onDrag, onEnd }) {
  const [dragging, setDragging] = (0, import_react.useState)(false);
  const origin = (0, import_react.useRef)(0);
  const latest = (0, import_react.useRef)(0);
  const frame = (0, import_react.useRef)(null);
  const callbacks = (0, import_react.useRef)({ onStart, onDrag, onEnd });
  callbacks.current = { onStart, onDrag, onEnd };
  const handlePointerDown = (0, import_react.useCallback)((event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    origin.current = event.clientX;
    latest.current = event.clientX;
    callbacks.current.onStart();
    setDragging(true);
  }, []);
  const handlePointerMove = (0, import_react.useCallback)((event) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    latest.current = event.clientX;
    frame.current ??= requestAnimationFrame(() => {
      frame.current = null;
      callbacks.current.onDrag(latest.current - origin.current);
    });
  }, []);
  const handlePointerUp = (0, import_react.useCallback)((event) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    callbacks.current.onDrag(latest.current - origin.current);
    setDragging(false);
    callbacks.current.onEnd();
  }, []);
  const handleKeyDown = (0, import_react.useCallback)((event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    callbacks.current.onStart();
    callbacks.current.onDrag(event.key === "ArrowLeft" ? -16 : 16);
    callbacks.current.onEnd();
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      "aria-label": side === "sidebar" ? "\u8C03\u6574\u4F1A\u8BDD\u680F\u5BBD\u5EA6" : "\u8C03\u6574\u6D3B\u52A8\u9762\u677F\u5BBD\u5EA6",
      "aria-orientation": "vertical",
      "aria-valuemax": side === "sidebar" ? SIDEBAR_MAX : DETAILS_MAX,
      "aria-valuemin": side === "sidebar" ? SIDEBAR_MIN : DETAILS_MIN,
      "aria-valuenow": Math.round(value),
      className: "telos-workbench-resizer",
      "data-dragging": dragging || void 0,
      "data-side": side,
      onKeyDown: handleKeyDown,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      role: "separator",
      style: { left },
      tabIndex: 0
    }
  );
}
function TelosAppFrame({
  useStore,
  useSessions,
  actions,
  renderSlot
}) {
  const panels = useStore((state) => state);
  const detailsSession = useSessions((sessions) => {
    const current = sessions.current;
    return current !== void 0 && sessions.byId[current]?.blank === false ? current : void 0;
  });
  const frameRef = (0, import_react.useRef)(null);
  const [viewport, setViewport] = (0, import_react.useState)(() => window.innerWidth);
  const lastSession = (0, import_react.useRef)(detailsSession);
  (0, import_react.useLayoutEffect)(() => {
    if (detailsSession === void 0) return;
    if (lastSession.current !== void 0 && lastSession.current !== detailsSession) {
      actions.closeDetails();
    }
    lastSession.current = detailsSession;
  }, [actions, detailsSession]);
  (0, import_react.useEffect)(() => {
    const element = frameRef.current;
    if (element === null) return;
    let resizeFrame = null;
    const observer = new ResizeObserver(() => {
      resizeFrame ??= requestAnimationFrame(() => {
        resizeFrame = null;
        const width = element.getBoundingClientRect().width;
        if (width > 0) setViewport(width);
      });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
    };
  }, []);
  (0, import_react.useEffect)(() => {
    const frame = frameRef.current;
    if (frame === null) return;
    const syncSidebarSnapshot = () => {
      const searchDialog = frame.querySelector(OPEN_SEARCH_DIALOG_SELECTOR);
      const existingSnapshot = frame.querySelector(SEARCH_SIDEBAR_SNAPSHOT_SELECTOR);
      if (searchDialog === null) {
        existingSnapshot?.remove();
        return;
      }
      if (existingSnapshot !== null) return;
      const slot = searchDialog.parentElement;
      const region = slot?.parentElement;
      if (slot === null || slot === void 0 || region === null || region === void 0) return;
      const snapshot = searchDialog.cloneNode(true);
      snapshot.dataset.telosSearchSidebarSnapshot = "";
      snapshot.setAttribute("aria-hidden", "true");
      snapshot.inert = true;
      snapshot.querySelector(":scope > div:first-child")?.remove();
      snapshot.querySelectorAll("[id]").forEach((element) => {
        element.removeAttribute("id");
      });
      region.insertBefore(snapshot, slot.nextSibling);
    };
    const observer = new MutationObserver(syncSidebarSnapshot);
    observer.observe(frame, {
      attributes: true,
      attributeFilter: ["aria-expanded"],
      childList: true,
      subtree: true
    });
    syncSidebarSnapshot();
    return () => {
      observer.disconnect();
      frame.querySelector(SEARCH_SIDEBAR_SNAPSHOT_SELECTOR)?.remove();
    };
  }, []);
  const narrow = viewport < SIDEBAR_AUTO_COLLAPSE;
  (0, import_react.useEffect)(() => actions.setNarrow(narrow), [actions, narrow]);
  const sidebarCollapsed = narrow ? !panels.narrowExpanded : panels.sidebar === 0;
  const sidebarPreference = sidebarCollapsed ? 0 : panels.sidebar === 0 ? SIDEBAR_DEFAULT : panels.sidebar;
  const columns = computeWorkbenchColumns(
    viewport,
    sidebarPreference,
    detailsSession === void 0 ? 0 : panels.details
  );
  const columnsRef = (0, import_react.useRef)(columns);
  columnsRef.current = columns;
  const sidebarBase = (0, import_react.useRef)(0);
  const detailsBase = (0, import_react.useRef)(0);
  const [dragging, setDragging] = (0, import_react.useState)(false);
  const endDrag = (0, import_react.useCallback)(() => setDragging(false), []);
  const startSidebarDrag = (0, import_react.useCallback)(() => {
    sidebarBase.current = columnsRef.current.sidebar;
    setDragging(true);
  }, []);
  const startDetailsDrag = (0, import_react.useCallback)(() => {
    detailsBase.current = columnsRef.current.details;
    setDragging(true);
  }, []);
  const dragSidebar = (0, import_react.useCallback)((dx) => {
    actions.setSidebar(sidebarBase.current + dx);
  }, [actions]);
  const dragDetails = (0, import_react.useCallback)((dx) => {
    actions.setDetails(detailsBase.current - dx);
  }, [actions]);
  const handleWorkbenchClick = (0, import_react.useCallback)((event) => {
    if (!(event.target instanceof Element)) return;
    const searchDialog = event.currentTarget.querySelector(OPEN_SEARCH_DIALOG_SELECTOR);
    if (searchDialog === null) return;
    const sessionRow = event.target.closest("[role='treeitem'][aria-selected]");
    const pickedSession = sessionRow !== null && searchDialog.contains(sessionRow);
    const clickedBackdrop = !searchDialog.contains(event.target);
    if (!pickedSession && !clickedBackdrop) return;
    const closeButton = searchDialog.querySelector(
      ":scope > div:first-child > div:first-of-type button:last-of-type"
    );
    if (closeButton === null) return;
    queueMicrotask(() => {
      closeButton.click();
    });
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      className: "telos-workbench-frame",
      "data-details-collapsed": columns.details === 0 || void 0,
      "data-dragging": dragging || void 0,
      "data-sidebar-collapsed": sidebarCollapsed || void 0,
      "data-telos-workbench": "",
      onClick: handleWorkbenchClick,
      ref: frameRef,
      style: { gridTemplateColumns: `${columns.sidebar}px minmax(0, 1fr) ${columns.details}px` },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telos-workbench-sidebar", children: renderSlot("sidebar", { collapsed: sidebarCollapsed, width: columns.sidebar }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CenterColumn, { children: renderSlot("conversation", {}) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DetailsColumn, { children: renderSlot("details", {}) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telos-workbench-overlay", "data-shell-overlay": true, children: renderSlot("shell.overlay", {}) }),
        sidebarCollapsed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            "aria-label": "\u6253\u5F00\u4FA7\u8FB9\u680F",
            className: "telos-sidebar-reopen",
            onClick: actions.toggleSidebar,
            title: "\u6253\u5F00\u4FA7\u8FB9\u680F",
            type: "button",
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SidebarOpenIcon, {})
          }
        ),
        !sidebarCollapsed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          Resizer,
          {
            left: columns.sidebar,
            onDrag: dragSidebar,
            onEnd: endDrag,
            onStart: startSidebarDrag,
            side: "sidebar",
            value: columns.sidebar
          }
        ),
        columns.details > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          Resizer,
          {
            left: viewport - columns.details,
            onDrag: dragDetails,
            onEnd: endDrag,
            onStart: startDetailsDrag,
            side: "details",
            value: columns.details
          }
        )
      ]
    }
  );
}

// apps/desktop/src/renderer/src/workbench/shell/layout-controller.ts
var TelosLayoutController = class {
  #panels;
  attachPanels(actions) {
    this.#panels = actions;
  }
  toggleSidebar() {
    this.#requirePanels().toggleSidebar();
  }
  openDetails() {
    this.#requirePanels().openDetails();
  }
  closeDetails() {
    this.#requirePanels().closeDetails();
  }
  #requirePanels() {
    if (this.#panels === void 0) {
      throw new Error("TELOS layout actions are unavailable before the root Slot mounts");
    }
    return this.#panels;
  }
};

// apps/desktop/src/renderer/src/workbench/shell/layout-store.ts
var import_client = require("@deepseek-ai/dsh-client-runtime/client");
function createTelosLayoutStore() {
  return (0, import_client.defineStore)({
    init: () => ({
      sidebar: SIDEBAR_DEFAULT,
      details: 0,
      narrow: false,
      narrowExpanded: false
    }),
    actions: {
      setSidebar: (draft, px) => {
        draft.sidebar = clampWidth(px, SIDEBAR_MIN, SIDEBAR_MAX);
      },
      setDetails: (draft, px) => {
        draft.details = clampWidth(px, DETAILS_MIN, DETAILS_MAX);
      },
      toggleSidebar: (draft) => {
        if (draft.narrow) draft.narrowExpanded = !draft.narrowExpanded;
        else draft.sidebar = draft.sidebar === 0 ? SIDEBAR_DEFAULT : 0;
      },
      setNarrow: (draft, narrow) => {
        if (draft.narrow === narrow) return;
        draft.narrow = narrow;
        draft.narrowExpanded = false;
      },
      openDetails: (draft) => {
        if (draft.details === 0) draft.details = DETAILS_DEFAULT;
      },
      closeDetails: (draft) => {
        draft.details = 0;
      }
    }
  });
}

// apps/desktop/src/renderer/src/workbench/shell/layout-styles.ts
var STYLE_OWNER = "@telos/renderer/ui-layout";
var TELOS_LAYOUT_CSS = `
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

/* ui-workspace keeps ownership of search, ordering and add-workspace behavior.
   TELOS only re-seats its stable sidebar.workspaces header in the productive
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
`;
function installTelosLayoutStyles() {
  const previous = document.querySelector(`style[data-telos-owner="${STYLE_OWNER}"]`);
  previous?.remove();
  const style = document.createElement("style");
  style.dataset.telosOwner = STYLE_OWNER;
  style.textContent = TELOS_LAYOUT_CSS;
  document.head.append(style);
  return () => style.remove();
}

// apps/desktop/src/renderer/src/workbench/shell/theme-presenter.ts
var DARK_ATTRIBUTE = "data-ds-dark-theme";
var TelosThemePresenter = class {
  appliedTokens = [];
  themeColorMeta;
  constructor() {
    this.themeColorMeta = document.createElement("meta");
    this.themeColorMeta.name = "theme-color";
  }
  apply(snapshot) {
    const scheme = snapshot.active.colorScheme;
    document.documentElement.style.colorScheme = scheme;
    const body = document.body;
    if (scheme === "dark") body.setAttribute(DARK_ATTRIBUTE, "");
    else body.removeAttribute(DARK_ATTRIBUTE);
    for (const name of this.appliedTokens) body.style.removeProperty(name);
    this.appliedTokens = [];
    for (const [name, value] of Object.entries(snapshot.active.tokens)) {
      body.style.setProperty(name, value);
      this.appliedTokens.push(name);
    }
    this.themeColorMeta.content = getComputedStyle(body).backgroundColor;
    if (!this.themeColorMeta.isConnected) document.head.append(this.themeColorMeta);
  }
  dispose() {
    document.documentElement.style.removeProperty("color-scheme");
    const body = document.body;
    body.removeAttribute(DARK_ATTRIBUTE);
    for (const name of this.appliedTokens) body.style.removeProperty(name);
    this.appliedTokens = [];
    this.themeColorMeta.remove();
  }
};

// apps/desktop/src/renderer/src/workbench/dsh-client.ts
var inject = ["slots", "theme"];
function apply(ctx) {
  const layout = new TelosLayoutController();
  ctx.effect(() => {
    const disposeService = ctx.reflect.provide("layout", layout);
    const disposeRegistration = ctx.slots.register({
      name: "root",
      children: {
        sidebar: { kind: "single", scope: "root" },
        conversation: { kind: "single", scope: "session-maybe" },
        details: { kind: "single", scope: "session" },
        "shell.overlay": { kind: "list", scope: "root" }
      },
      store: createTelosLayoutStore,
      inject: (actions) => {
        layout.attachPanels(actions);
        return {};
      }
    }, TelosAppFrame);
    return () => {
      disposeRegistration();
      void disposeService();
    };
  }, "telos-ui-layout: service + root registration");
  ctx.effect(() => installTelosLayoutStyles(), "telos-ui-layout: styles");
  ctx.effect(() => {
    const presenter = new TelosThemePresenter();
    presenter.apply(ctx.theme.getTheme());
    const off = ctx.on("theme/change", (snapshot) => presenter.apply(snapshot));
    return () => {
      off();
      presenter.dispose();
    };
  }, "telos-ui-layout: theme presenter");
}

    return module.exports;
  },
});
