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

// apps/desktop/src/renderer/src/workbench/files/WorkbenchFiles.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var WORKBENCH_FILES_RPC_CHANNEL = "/telos-workbench-files";
var WorkbenchFilesClient = class {
  constructor(rpc) {
    this.rpc = rpc;
  }
  list(sessionId, path, signal) {
    return this.call("list", { sessionId, path }, signal);
  }
  read(sessionId, path, signal) {
    return this.call("read", { sessionId, path }, signal);
  }
  write(sessionId, file) {
    return this.call("write", {
      sessionId,
      path: file.path,
      content: file.content,
      expectedRevision: file.revision
    });
  }
  async call(endpoint, payload, signal) {
    const result = await this.rpc.call(WORKBENCH_FILES_RPC_CHANNEL, endpoint, payload, signal);
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
    return result.value;
  }
};
var configuredClient;
function configureWorkbenchFilesClient(client) {
  configuredClient = client;
}
function workbenchFilesClient() {
  if (configuredClient === void 0) throw new Error("Telos workbench files client is unavailable before plugin setup");
  return configuredClient;
}
function basename(path) {
  return path.split("/").at(-1) ?? path;
}
function ChevronIcon({ expanded }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { "aria-hidden": "true", fill: "none", viewBox: "0 0 16 16", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: expanded ? "m4 6 4 4 4-4" : "m6 4 4 4-4 4", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "1.35" }) });
}
function FileIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { "aria-hidden": "true", fill: "none", viewBox: "0 0 16 16", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3.5 1.75h5l4 4v8.5h-9z", stroke: "currentColor", strokeLinejoin: "round", strokeWidth: "1.2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8.5 1.9v4h3.85", stroke: "currentColor", strokeLinejoin: "round", strokeWidth: "1.2" })
  ] });
}
function RefreshIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { "aria-hidden": "true", fill: "none", viewBox: "0 0 18 18", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M14 6.1A5.75 5.75 0 1 0 14.35 11", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "1.45" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M10.9 5.9H14.2V2.6", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "1.45" })
  ] });
}
function FileTree({ activePath, directories, expanded, loading, onDirectory, onFile, path, depth = 0 }) {
  const directory = directories[path];
  if (directory === void 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { role: depth === 0 ? "tree" : "group", children: [
    directory.entries.map((entry) => entry.kind === "directory" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "button",
        {
          "aria-expanded": expanded.has(entry.path),
          className: "telos-file-tree-row",
          "data-loading": loading.has(entry.path) || void 0,
          onClick: () => onDirectory(entry.path),
          role: "treeitem",
          style: { paddingLeft: 12 + depth * 14 },
          type: "button",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telos-file-tree-chevron", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronIcon, { expanded: expanded.has(entry.path) }) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telos-file-tree-name", children: entry.name })
          ]
        }
      ),
      expanded.has(entry.path) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        FileTree,
        {
          activePath,
          depth: depth + 1,
          directories,
          expanded,
          loading,
          onDirectory,
          onFile,
          path: entry.path
        }
      )
    ] }, entry.path) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "button",
      {
        "aria-selected": activePath === entry.path,
        className: "telos-file-tree-row",
        "data-active": activePath === entry.path || void 0,
        onClick: () => onFile(entry.path),
        role: "treeitem",
        style: { paddingLeft: 30 + depth * 14 },
        type: "button",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telos-file-tree-file", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileIcon, {}) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telos-file-tree-name", children: entry.name })
        ]
      },
      entry.path
    )),
    directory.truncated && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telos-file-tree-note", children: "\u76EE\u5F55\u5185\u5BB9\u8FC7\u591A\uFF0C\u4EC5\u663E\u793A\u524D\u4E00\u90E8\u5206" })
  ] });
}
function WorkbenchFiles({ active, client, sessionId, workspaceLabel: workspaceLabel2 }) {
  const [directories, setDirectories] = (0, import_react.useState)({});
  const [expanded, setExpanded] = (0, import_react.useState)(() => /* @__PURE__ */ new Set());
  const [loading, setLoading] = (0, import_react.useState)(() => /* @__PURE__ */ new Set());
  const [files, setFiles] = (0, import_react.useState)([]);
  const [activePath, setActivePath] = (0, import_react.useState)();
  const [error, setError] = (0, import_react.useState)();
  const activeFile = files.find((file) => file.path === activePath);
  const loadDirectory = (0, import_react.useCallback)(async (path, signal) => {
    if (sessionId === void 0) return;
    setLoading((current) => new Set(current).add(path));
    try {
      const directory = await client.list(sessionId, path, signal);
      setDirectories((current) => ({ ...current, [path]: directory }));
      setError(void 0);
    } catch (reason) {
      if (signal?.aborted) return;
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading((current) => {
        const next = new Set(current);
        next.delete(path);
        return next;
      });
    }
  }, [client, sessionId]);
  (0, import_react.useEffect)(() => {
    if (!active) return;
    setDirectories({});
    setExpanded(/* @__PURE__ */ new Set());
    setFiles([]);
    setActivePath(void 0);
    setError(void 0);
    if (sessionId === void 0) return;
    const controller = new AbortController();
    void loadDirectory("", controller.signal);
    return () => controller.abort();
  }, [active, loadDirectory, sessionId]);
  const openDirectory = (0, import_react.useCallback)((path) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
    if (directories[path] === void 0) void loadDirectory(path);
  }, [directories, loadDirectory]);
  const openFile = (0, import_react.useCallback)(async (path) => {
    if (files.some((file) => file.path === path)) {
      setActivePath(path);
      return;
    }
    if (sessionId === void 0) return;
    try {
      const opened = await client.read(sessionId, path);
      setFiles((current) => current.some((file) => file.path === path) ? current : [
        ...current,
        { ...opened, savedContent: opened.content, saving: false }
      ]);
      setActivePath(path);
      setError(void 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }, [client, files, sessionId]);
  const updateActiveFile = (0, import_react.useCallback)((content) => {
    setFiles((current) => current.map((file) => file.path === activePath ? { ...file, content, error: void 0 } : file));
  }, [activePath]);
  const saveActiveFile = (0, import_react.useCallback)(async () => {
    if (activeFile === void 0 || sessionId === void 0 || activeFile.content === activeFile.savedContent) return;
    setFiles((current) => current.map((file) => file.path === activeFile.path ? { ...file, saving: true, error: void 0 } : file));
    try {
      const saved = await client.write(sessionId, activeFile);
      setFiles((current) => current.map((file) => file.path === activeFile.path ? {
        ...saved,
        savedContent: saved.content,
        saving: false
      } : file));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setFiles((current) => current.map((file) => file.path === activeFile.path ? { ...file, saving: false, error: message } : file));
    }
  }, [activeFile, client, sessionId]);
  const closeFile = (0, import_react.useCallback)((path) => {
    const closing = files.find((file) => file.path === path);
    if (closing !== void 0 && closing.content !== closing.savedContent && !window.confirm(`${basename(path)} \u8FD8\u6709\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\uFF0C\u786E\u5B9A\u5173\u95ED\u5417\uFF1F`)) return;
    const index = files.findIndex((file) => file.path === path);
    const next = files.filter((file) => file.path !== path);
    setFiles(next);
    if (activePath === path) setActivePath(next[Math.min(index, next.length - 1)]?.path);
  }, [activePath, files]);
  const rootLoading = loading.has("");
  const title = (0, import_react.useMemo)(() => workspaceLabel2?.trim() || "\u5DE5\u4F5C\u533A", [workspaceLabel2]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", { className: "telos-editor-explorer", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "telos-editor-explorer-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { title, children: title }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { "aria-label": "\u5237\u65B0\u6587\u4EF6", onClick: () => void loadDirectory(""), title: "\u5237\u65B0\u6587\u4EF6", type: "button", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshIcon, {}) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telos-editor-explorer-body", children: [
        sessionId === void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telos-editor-empty-small", children: "\u8BF7\u5148\u6253\u5F00\u4E00\u4E2A\u5DE5\u4F5C\u533A\u4F1A\u8BDD" }),
        sessionId !== void 0 && rootLoading && directories[""] === void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telos-editor-empty-small", children: "\u6B63\u5728\u8BFB\u53D6\u6587\u4EF6\u2026" }),
        error !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telos-editor-error", children: error }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          FileTree,
          {
            activePath,
            directories,
            expanded,
            loading,
            onDirectory: openDirectory,
            onFile: (path) => void openFile(path),
            path: ""
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { className: "telos-editor-surface", children: [
      files.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telos-editor-tabs", role: "tablist", children: files.map((file) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { "aria-selected": file.path === activePath, className: "telos-editor-tab", "data-active": file.path === activePath || void 0, role: "tab", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { onClick: () => setActivePath(file.path), title: file.path, type: "button", children: [
          file.content !== file.savedContent && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telos-editor-dirty" }),
          basename(file.path)
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { "aria-label": `\u5173\u95ED ${basename(file.path)}`, className: "telos-editor-tab-close", onClick: () => closeFile(file.path), type: "button", children: "\xD7" })
      ] }, file.path)) }),
      activeFile === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telos-editor-empty", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telos-editor-empty-mark", children: "T" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "\u6253\u5F00\u6587\u4EF6\u5F00\u59CB\u7F16\u8F91" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u4ECE\u5DE6\u4FA7\u5DE5\u4F5C\u533A\u9009\u62E9\u6587\u4EF6\uFF0C\u804A\u5929\u4F1A\u8BDD\u4F1A\u6301\u7EED\u4FDD\u7559\u5728\u53F3\u4FA7\u3002" })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telos-editor-document", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telos-editor-breadcrumb", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: activeFile.path }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: activeFile.saving || activeFile.content === activeFile.savedContent, onClick: () => void saveActiveFile(), type: "button", children: activeFile.saving ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "textarea",
          {
            "aria-label": `\u7F16\u8F91 ${activeFile.path}`,
            onChange: (event) => updateActiveFile(event.target.value),
            onKeyDown: (event) => {
              if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
                event.preventDefault();
                void saveActiveFile();
              }
            },
            spellCheck: false,
            value: activeFile.content
          }
        ),
        activeFile.error !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telos-editor-save-error", children: activeFile.error })
      ] })
    ] })
  ] });
}

// apps/desktop/src/renderer/src/workbench/shell/TelosAppFrame.tsx
var import_react2 = require("react");

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
var import_jsx_runtime2 = require("react/jsx-runtime");
var OPEN_SEARCH_DIALOG_SELECTOR = ".telos-workbench-sidebar [data-slot='sidebar.workspaces'] > div:has(> div:first-child > div:first-of-type button[aria-expanded='true'])";
var SEARCH_SIDEBAR_SNAPSHOT_SELECTOR = "[data-telos-search-sidebar-snapshot]";
var VIEW_MODE_STORAGE_PREFIX = "telos:view-mode:";
function CenterColumn({ children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "telos-workbench-center", children });
}
function DetailsColumn({ children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "telos-workbench-details", children });
}
function SidebarOpenIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { "aria-hidden": "true", fill: "none", viewBox: "0 0 20 20", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { height: "14", rx: "3.5", stroke: "currentColor", strokeWidth: "1.6", width: "16", x: "2", y: "3" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M7 3.8v12.4", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "1.6" })
  ] });
}
function WorkbenchModeIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { "aria-hidden": "true", fill: "none", viewBox: "0 0 20 20", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { height: "14", rx: "3", stroke: "currentColor", strokeWidth: "1.45", width: "16", x: "2", y: "3" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M7 3.7v12.6M13.1 3.7v12.6", stroke: "currentColor", strokeWidth: "1.35" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "m9.1 8.1-1.35 1.35L9.1 10.8m1.8-2.7 1.35 1.35-1.35 1.35", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "1.05" })
  ] });
}
function workspaceLabel(cwd) {
  if (cwd === void 0) return void 0;
  const segments = cwd.replace(/[/\\]+$/, "").split(/[/\\]/);
  return segments.at(-1) || cwd;
}
function Resizer({ side, left, value, onStart, onDrag, onEnd }) {
  const [dragging, setDragging] = (0, import_react2.useState)(false);
  const origin = (0, import_react2.useRef)(0);
  const latest = (0, import_react2.useRef)(0);
  const frame = (0, import_react2.useRef)(null);
  const callbacks = (0, import_react2.useRef)({ onStart, onDrag, onEnd });
  callbacks.current = { onStart, onDrag, onEnd };
  const handlePointerDown = (0, import_react2.useCallback)((event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    origin.current = event.clientX;
    latest.current = event.clientX;
    callbacks.current.onStart();
    setDragging(true);
  }, []);
  const handlePointerMove = (0, import_react2.useCallback)((event) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    latest.current = event.clientX;
    frame.current ??= requestAnimationFrame(() => {
      frame.current = null;
      callbacks.current.onDrag(latest.current - origin.current);
    });
  }, []);
  const handlePointerUp = (0, import_react2.useCallback)((event) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    callbacks.current.onDrag(latest.current - origin.current);
    setDragging(false);
    callbacks.current.onEnd();
  }, []);
  const handleKeyDown = (0, import_react2.useCallback)((event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    callbacks.current.onStart();
    callbacks.current.onDrag(event.key === "ArrowLeft" ? -16 : 16);
    callbacks.current.onEnd();
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
  const currentSession = useSessions((sessions) => {
    const current = sessions.current;
    return current === void 0 ? void 0 : sessions.byId[current];
  });
  const detailsSession = useSessions((sessions) => {
    const current = sessions.current;
    return current !== void 0 && sessions.byId[current]?.blank === false ? current : void 0;
  });
  const frameRef = (0, import_react2.useRef)(null);
  const searchDialogClick = (0, import_react2.useRef)(false);
  const [viewport, setViewport] = (0, import_react2.useState)(() => window.innerWidth);
  const viewModeStorageKey = `${VIEW_MODE_STORAGE_PREFIX}${currentSession?.cwd ?? "global"}`;
  const [viewMode, setViewMode] = (0, import_react2.useState)("chat");
  (0, import_react2.useEffect)(() => {
    const stored = window.localStorage.getItem(viewModeStorageKey);
    setViewMode(stored === "editor" ? "editor" : "chat");
  }, [viewModeStorageKey]);
  const toggleViewMode = (0, import_react2.useCallback)(() => {
    setViewMode((current) => {
      const next = current === "chat" ? "editor" : "chat";
      window.localStorage.setItem(viewModeStorageKey, next);
      return next;
    });
  }, [viewModeStorageKey]);
  (0, import_react2.useEffect)(() => {
    const handleShortcut = (event) => {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || event.key.toLowerCase() !== "e") return;
      event.preventDefault();
      toggleViewMode();
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [toggleViewMode]);
  const lastSession = (0, import_react2.useRef)(detailsSession);
  (0, import_react2.useLayoutEffect)(() => {
    if (detailsSession === void 0) return;
    if (lastSession.current !== void 0 && lastSession.current !== detailsSession) {
      actions.closeDetails();
    }
    lastSession.current = detailsSession;
  }, [actions, detailsSession]);
  (0, import_react2.useEffect)(() => {
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
  (0, import_react2.useEffect)(() => {
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
  (0, import_react2.useEffect)(() => actions.setNarrow(narrow), [actions, narrow]);
  const sidebarCollapsed = narrow ? !panels.narrowExpanded : panels.sidebar === 0;
  const sidebarPreference = sidebarCollapsed ? 0 : panels.sidebar === 0 ? SIDEBAR_DEFAULT : panels.sidebar;
  const columns = computeWorkbenchColumns(
    viewport,
    sidebarPreference,
    detailsSession === void 0 ? 0 : panels.details
  );
  const columnsRef = (0, import_react2.useRef)(columns);
  columnsRef.current = columns;
  const sidebarBase = (0, import_react2.useRef)(0);
  const detailsBase = (0, import_react2.useRef)(0);
  const [dragging, setDragging] = (0, import_react2.useState)(false);
  const endDrag = (0, import_react2.useCallback)(() => setDragging(false), []);
  const startSidebarDrag = (0, import_react2.useCallback)(() => {
    sidebarBase.current = columnsRef.current.sidebar;
    setDragging(true);
  }, []);
  const startDetailsDrag = (0, import_react2.useCallback)(() => {
    detailsBase.current = columnsRef.current.details;
    setDragging(true);
  }, []);
  const dragSidebar = (0, import_react2.useCallback)((dx) => {
    actions.setSidebar(sidebarBase.current + dx);
  }, [actions]);
  const dragDetails = (0, import_react2.useCallback)((dx) => {
    actions.setDetails(detailsBase.current - dx);
  }, [actions]);
  const handleWorkbenchClickCapture = (0, import_react2.useCallback)((event) => {
    searchDialogClick.current = false;
    if (!(event.target instanceof Element)) return;
    const searchDialog = event.currentTarget.querySelector(OPEN_SEARCH_DIALOG_SELECTOR);
    if (searchDialog === null) return;
    const clickedInsideDialog = searchDialog.contains(event.target);
    searchDialogClick.current = clickedInsideDialog;
    const sessionRow = event.target.closest("[role='treeitem'][aria-selected]");
    const pickedSession = sessionRow !== null && clickedInsideDialog;
    const clickedBackdrop = !clickedInsideDialog;
    if (!pickedSession && !clickedBackdrop) return;
    const closeButton = searchDialog.querySelector(
      ":scope > div:first-child > div:first-of-type button:last-of-type"
    );
    if (closeButton === null) return;
    queueMicrotask(() => {
      closeButton.click();
    });
  }, []);
  const handleWorkbenchClick = (0, import_react2.useCallback)((event) => {
    if (!searchDialogClick.current) return;
    searchDialogClick.current = false;
    event.stopPropagation();
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "div",
    {
      className: "telos-workbench-frame",
      "data-details-collapsed": columns.details === 0 || void 0,
      "data-dragging": dragging || void 0,
      "data-sidebar-collapsed": sidebarCollapsed || void 0,
      "data-telos-workbench": "",
      "data-view-mode": viewMode,
      onClick: handleWorkbenchClick,
      onClickCapture: handleWorkbenchClickCapture,
      ref: frameRef,
      style: viewMode === "chat" ? { gridTemplateColumns: `${columns.sidebar}px minmax(0, 1fr) ${columns.details}px` } : void 0,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "telos-editor-files-seat", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          WorkbenchFiles,
          {
            active: viewMode === "editor",
            client: workbenchFilesClient(),
            sessionId: currentSession === void 0 ? void 0 : String(currentSession.id),
            workspaceLabel: workspaceLabel(currentSession?.cwd)
          }
        ) }),
        viewMode === "chat" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "telos-workbench-sidebar", children: renderSlot("sidebar", { collapsed: sidebarCollapsed, width: columns.sidebar }) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CenterColumn, { children: renderSlot("conversation", {}) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(DetailsColumn, { children: renderSlot("details", {}) })
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "telos-editor-conversation", children: renderSlot("conversation", {}) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "telos-workbench-overlay", "data-shell-overlay": true, children: renderSlot("shell.overlay", {}) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            "aria-label": viewMode === "chat" ? "\u8FDB\u5165\u7F16\u8F91\u5DE5\u4F5C\u53F0" : "\u8FD4\u56DE\u81EA\u7531\u804A\u5929",
            "aria-pressed": viewMode === "editor",
            className: "telos-view-mode-toggle",
            "data-active": viewMode === "editor" || void 0,
            onClick: toggleViewMode,
            title: `${viewMode === "chat" ? "\u8FDB\u5165\u7F16\u8F91\u5DE5\u4F5C\u53F0" : "\u8FD4\u56DE\u81EA\u7531\u804A\u5929"} (\u2318\u21E7E)`,
            type: "button",
            children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(WorkbenchModeIcon, {})
          }
        ),
        viewMode === "chat" && sidebarCollapsed && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            "aria-label": "\u6253\u5F00\u4FA7\u8FB9\u680F",
            className: "telos-sidebar-reopen",
            onClick: actions.toggleSidebar,
            title: "\u6253\u5F00\u4FA7\u8FB9\u680F",
            type: "button",
            children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(SidebarOpenIcon, {})
          }
        ),
        viewMode === "chat" && !sidebarCollapsed && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
        viewMode === "chat" && columns.details > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
      throw new Error("Telos layout actions are unavailable before the root Slot mounts");
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

.telos-workbench-frame[data-view-mode='editor'] {
  grid-template-columns: 260px minmax(420px, 1fr) minmax(360px, 34vw);
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
   dialog and cap their roots at 720\u2013760px. Once Telos widens the shell those
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
.telos-file-tree-file {
  display: grid;
  width: 15px;
  min-width: 15px;
  height: 15px;
  place-items: center;
  color: var(--dsw-alias-label-tertiary);
}

.telos-file-tree-chevron svg,
.telos-file-tree-file svg {
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
  padding-right: 12px;
  align-items: flex-end;
  overflow-x: auto;
  overflow-y: hidden;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  -webkit-app-region: drag;
}

.telos-editor-tab {
  display: flex;
  max-width: 220px;
  height: 36px;
  align-items: center;
  border-right: 1px solid var(--dsw-alias-border-l1);
  border-top: 1px solid transparent;
  color: var(--dsw-alias-label-tertiary);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 72%, transparent);
  -webkit-app-region: no-drag;
}

.telos-editor-tab[data-active] {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
  border-top-color: var(--dsw-alias-state-business-primary);
}

.telos-editor-tab > button:first-child {
  display: flex;
  min-width: 0;
  height: 100%;
  padding: 0 5px 0 12px;
  align-items: center;
  gap: 7px;
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

.telos-editor-dirty {
  width: 6px;
  min-width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.telos-editor-tab-close {
  width: 24px;
  height: 24px;
  margin-right: 5px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  color: inherit;
  background: transparent;
  cursor: pointer;
}

.telos-editor-tab-close:hover {
  background: var(--dsw-alias-interactive-bg-hover);
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

.telos-editor-document textarea {
  width: 100%;
  min-height: 0;
  flex: 1;
  box-sizing: border-box;
  padding: 18px 22px 40px;
  resize: none;
  border: 0;
  outline: 0;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.65;
  tab-size: 2;
  white-space: pre;
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

@media (max-width: 1180px) {
  .telos-workbench-frame[data-view-mode='editor'] {
    grid-template-columns: 220px minmax(340px, 1fr) minmax(340px, 38vw);
  }
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
var inject = ["slots", "theme", "connection"];
function apply(ctx) {
  const layout = new TelosLayoutController();
  const connection = ctx.get("connection");
  if (connection === void 0) throw new Error("Telos workbench requires the DSH client connection service");
  const workbenchFiles = new WorkbenchFilesClient(connection.rpc);
  configureWorkbenchFilesClient(workbenchFiles);
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
