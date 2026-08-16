window.__ModuleLoader__.load({
  id: "@telos/dsh-multi-root-workspace",
  factory: (require) => {
    var module = { exports: {} };
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

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  MultiRootDirectoryFlow: () => MultiRootDirectoryFlow,
  MultiRootWorkspaceController: () => MultiRootWorkspaceController,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/contracts.ts
var MULTI_ROOT_WORKSPACE_RPC_CHANNEL = "/telos-multi-root-workspace";

// src/client/controller.ts
var MultiRootWorkspaceController = class {
  constructor(rpc) {
    this.rpc = rpc;
  }
  async pickDirectory() {
    return this.call("pick-directory", {});
  }
  async create(input) {
    return this.call("create", input);
  }
  async call(endpoint, payload) {
    const result = await this.rpc.call(MULTI_ROOT_WORKSPACE_RPC_CHANNEL, endpoint, payload);
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  }
};

// src/client/MultiRootDirectoryFlow.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function folderName(path) {
  return path.replaceAll("\\", "/").split("/").filter(Boolean).at(-1) ?? "\u65B0\u5DE5\u4F5C\u533A";
}
function MultiRootDirectoryFlow(props) {
  const { open, busy: ownerBusy, controller, onCancel, onError, onPicked } = props;
  const [paths, setPaths] = (0, import_react.useState)([]);
  const [title, setTitle] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)();
  const wasOpen = (0, import_react.useRef)(false);
  (0, import_react.useEffect)(() => {
    if (open && !wasOpen.current) {
      setPaths([]);
      setTitle("");
      setError(void 0);
      setBusy(false);
    }
    wasOpen.current = open;
  }, [open]);
  if (!open) return null;
  const addFolder = async () => {
    setBusy(true);
    setError(void 0);
    try {
      const path = await controller.pickDirectory();
      if (path === null) return;
      setPaths((current) => current.includes(path) ? current : [...current, path]);
      setTitle((current) => current || folderName(path));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setError(message);
      onError(message);
    } finally {
      setBusy(false);
    }
  };
  const create = async () => {
    if (paths.length === 0) {
      setError("\u8BF7\u81F3\u5C11\u6DFB\u52A0\u4E00\u4E2A\u6587\u4EF6\u5939");
      return;
    }
    setBusy(true);
    setError(void 0);
    try {
      const group = await controller.create({ title: title.trim() || void 0, paths });
      const primary = group.roots.find((root) => root.primary);
      if (primary === void 0) throw new Error("\u5DE5\u4F5C\u533A\u6CA1\u6709\u4E3B\u6587\u4EF6\u5939");
      onPicked(primary.path);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setError(message);
    } finally {
      setBusy(false);
    }
  };
  const disabled = busy || ownerBusy;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosWorkspaceFlowBackdrop", role: "presentation", onMouseDown: (event) => {
    if (event.target === event.currentTarget && !disabled) onCancel();
  }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "telosWorkspaceFlow", role: "dialog", "aria-modal": "true", "aria-labelledby": "telosWorkspaceFlowTitle", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { id: "telosWorkspaceFlowTitle", children: "\u521B\u5EFA\u5DE5\u4F5C\u533A" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u4E00\u4E2A\u5DE5\u4F5C\u533A\u53EF\u4EE5\u7531\u524D\u7AEF\u3001\u540E\u7AEF\u3001\u6587\u6863\u7B49\u591A\u4E2A\u6587\u4EF6\u5939\u7EC4\u6210\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "telosWorkspaceFlowClose", "aria-label": "\u5173\u95ED", disabled, onClick: onCancel, children: "\xD7" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "telosWorkspaceFlowName", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u5DE5\u4F5C\u533A\u540D\u79F0" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: title, disabled, placeholder: "\u4F8B\u5982\uFF1ATelos", onChange: (event) => setTitle(event.target.value) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosWorkspaceFlowRoots", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosWorkspaceFlowRootsTitle", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u6587\u4EF6\u5939" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "\u7B2C\u4E00\u4E2A\u6587\u4EF6\u5939\u662F\u4E3B\u76EE\u5F55\uFF0C\u7528\u4E8E\u517C\u5BB9 DSH Runtime" })
      ] }),
      paths.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { type: "button", className: "telosWorkspaceFlowEmpty", disabled, onClick: () => void addFolder(), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "\uFF0B \u6DFB\u52A0\u7B2C\u4E00\u4E2A\u6587\u4EF6\u5939" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u9009\u62E9 Telos \u53EF\u4EE5\u8BFB\u53D6\u548C\u7F16\u8F91\u7684\u672C\u5730\u76EE\u5F55" })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosWorkspaceFlowRootList", children: [
        paths.map((path, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosWorkspaceFlowRoot", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telosWorkspaceFlowFolderIcon", children: "\u25B1" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: folderName(path) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: path })
          ] }),
          index === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: "\u4E3B\u76EE\u5F55" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              "aria-label": `\u79FB\u9664 ${folderName(path)}`,
              disabled,
              onClick: () => setPaths((current) => current.filter((value) => value !== path)),
              children: "\u79FB\u9664"
            }
          )
        ] }, path)),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "telosWorkspaceFlowAdd", disabled, onClick: () => void addFolder(), children: "\uFF0B \u6DFB\u52A0\u6587\u4EF6\u5939" })
      ] })
    ] }),
    error !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "telosWorkspaceFlowError", role: "alert", children: error }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled, onClick: onCancel, children: "\u53D6\u6D88" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", "data-primary": true, disabled: disabled || paths.length === 0, onClick: () => void create(), children: busy ? "\u5904\u7406\u4E2D\u2026" : "\u521B\u5EFA\u5DE5\u4F5C\u533A" })
    ] })
  ] }) });
}

// src/client/styles.ts
var MULTI_ROOT_WORKSPACE_CSS = String.raw`
.telosWorkspaceFlowBackdrop{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:24px;background:color-mix(in srgb,#000 30%,transparent);backdrop-filter:blur(4px)}
.telosWorkspaceFlow{box-sizing:border-box;width:min(620px,100%);max-height:min(760px,calc(100vh - 48px));overflow:auto;padding:24px;border:1px solid var(--dsw-alias-border-l1);border-radius:18px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 24px 80px rgba(0,0,0,.22);color:var(--dsw-alias-label-primary)}
.telosWorkspaceFlow header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}.telosWorkspaceFlow h2{margin:0;font-size:20px;line-height:1.35}.telosWorkspaceFlow header p{margin:6px 0 0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.6}.telosWorkspaceFlow button{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-2);color:inherit;font:inherit;cursor:pointer}.telosWorkspaceFlow button:disabled{cursor:not-allowed;opacity:.48}.telosWorkspaceFlowClose{width:32px;height:32px;padding:0;font-size:22px;line-height:1}
.telosWorkspaceFlowName{display:grid;gap:8px;margin-top:24px;font-size:12px;font-weight:600}.telosWorkspaceFlowName input{box-sizing:border-box;width:100%;height:42px;padding:0 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;outline:none;background:var(--dsw-alias-bg-layer-2);color:inherit;font:inherit}.telosWorkspaceFlowName input:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent)}
.telosWorkspaceFlowRoots{margin-top:22px}.telosWorkspaceFlowRootsTitle{display:flex;align-items:baseline;justify-content:space-between;gap:14px;margin-bottom:9px;font-size:12px;font-weight:600}.telosWorkspaceFlowRootsTitle small{color:var(--dsw-alias-label-tertiary);font-weight:400}.telosWorkspaceFlowEmpty{display:grid;width:100%;min-height:132px;place-content:center;gap:7px;border-style:dashed!important}.telosWorkspaceFlowEmpty strong{font-size:13px}.telosWorkspaceFlowEmpty span{color:var(--dsw-alias-label-tertiary);font-size:11px}
.telosWorkspaceFlowRootList{display:grid;gap:8px}.telosWorkspaceFlowRoot{display:grid;grid-template-columns:26px minmax(0,1fr) auto auto;align-items:center;gap:10px;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2)}.telosWorkspaceFlowFolderIcon{font-size:20px}.telosWorkspaceFlowRoot>span:nth-child(2){display:grid;min-width:0;gap:3px}.telosWorkspaceFlowRoot strong,.telosWorkspaceFlowRoot small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.telosWorkspaceFlowRoot strong{font-size:12px}.telosWorkspaceFlowRoot small{color:var(--dsw-alias-label-tertiary);font-size:10px}.telosWorkspaceFlowRoot em{padding:3px 7px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);color:var(--dsw-alias-brand-primary);font-size:10px;font-style:normal}.telosWorkspaceFlowRoot button{padding:5px 8px;border-color:transparent;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:11px}.telosWorkspaceFlowAdd{min-height:38px;border-style:dashed!important}
.telosWorkspaceFlowError{margin:12px 0 0;color:var(--dsw-alias-state-error-primary);font-size:11px}.telosWorkspaceFlow footer{display:flex;justify-content:flex-end;gap:8px;margin-top:24px}.telosWorkspaceFlow footer button{min-width:88px;min-height:38px;padding:6px 14px}.telosWorkspaceFlow footer button[data-primary]{border-color:transparent;background:var(--dsw-alias-brand-primary);color:#fff}
@media(max-width:640px){.telosWorkspaceFlowBackdrop{padding:12px}.telosWorkspaceFlow{padding:18px;border-radius:14px}.telosWorkspaceFlowRootsTitle{align-items:flex-start;flex-direction:column;gap:3px}.telosWorkspaceFlowRoot{grid-template-columns:24px minmax(0,1fr) auto}.telosWorkspaceFlowRoot em{display:none}.telosWorkspaceFlow footer button{flex:1}}
`;
function installMultiRootWorkspaceStyles() {
  const style = document.createElement("style");
  style.dataset.telosMultiRootWorkspace = "true";
  style.textContent = MULTI_ROOT_WORKSPACE_CSS;
  document.head.append(style);
  return () => style.remove();
}

// src/client/index.ts
var inject = ["slots", "connection"];
function apply(ctx) {
  const controller = new MultiRootWorkspaceController(ctx.connection.rpc);
  const injected = () => ({ controller });
  ctx.effect(() => installMultiRootWorkspaceStyles(), "telos-multi-root-workspace: client styles");
  ctx.slots.inject("conversation.hero.workspace.directoryFlow", () => ctx.slots.inject("sidebar.workspaces.directoryFlow", function* () {
    yield ctx.slots.register({ name: "conversation.hero.workspace.directoryFlow", inject: injected }, MultiRootDirectoryFlow);
    yield ctx.slots.register({ name: "sidebar.workspaces.directoryFlow", inject: injected }, MultiRootDirectoryFlow);
  }));
}

    return module.exports;
  },
});
