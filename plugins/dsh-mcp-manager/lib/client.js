window.__ModuleLoader__.load({
  id: "@telos/dsh-mcp-manager",
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
  McpClientController: () => McpClientController,
  McpSettingsSection: () => McpSettingsSection,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/contracts.ts
var MCP_MANAGER_RPC_CHANNEL = "/telos-mcp-manager";

// src/client/controller.ts
var EMPTY = { loading: false, servers: [] };
function message(error) {
  return error instanceof Error ? error.message : String(error);
}
var McpClientController = class {
  constructor(rpc) {
    this.rpc = rpc;
  }
  snapshot = EMPTY;
  listeners = /* @__PURE__ */ new Set();
  getSnapshot = () => this.snapshot;
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  async refresh() {
    await this.run("list", {}, void 0);
  }
  async save(draft) {
    await this.run("save", draft, "MCP \u670D\u52A1\u5DF2\u4FDD\u5B58");
  }
  async toggle(serverName, acknowledgeLocalExecution = false) {
    await this.run("toggle", { serverName, acknowledgeLocalExecution }, void 0);
  }
  async reconnect(serverName) {
    await this.run("reconnect", { serverName }, "\u5DF2\u91CD\u65B0\u52A0\u8F7D MCP \u670D\u52A1");
  }
  async delete(serverName) {
    await this.run("delete", { serverName }, "MCP \u670D\u52A1\u53CA\u5176\u53EF\u5199\u51ED\u636E\u5DF2\u5220\u9664");
  }
  async run(endpoint, payload, notice) {
    this.update({ loading: true, error: void 0, notice: void 0 });
    try {
      const result = await this.rpc.call(MCP_MANAGER_RPC_CHANNEL, endpoint, payload);
      if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
      this.update({ servers: result.value, loading: false, notice });
    } catch (error) {
      this.update({ loading: false, error: message(error) });
    }
  }
  update(patch) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
};

// src/client/McpSettingsSection.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var reconnect = { enabled: true, initialDelayMs: 500, maxDelayMs: 3e4, maxAttempts: 8 };
function emptyServer() {
  return {
    serverName: "",
    displayName: "",
    enabled: false,
    transport: "stdio",
    command: "",
    args: [],
    cwd: "",
    env: [],
    headers: [],
    toolCallTimeoutMs: 6e4,
    reconnect
  };
}
function statusLabel(server) {
  if (server.runtime === "disabled") return "\u5DF2\u505C\u7528";
  if (server.runtime === "connecting") return "\u6B63\u5728\u52A0\u8F7D";
  if (server.runtime === "error") return "\u52A0\u8F7D\u5931\u8D25";
  return `\u5DF2\u52A0\u8F7D \xB7 ${String(server.toolNames.length)} \u4E2A\u5DE5\u5177`;
}
function bindingLines(bindings) {
  return bindings.map((binding) => `${binding.name}=`).join("\n");
}
function credentialRef(serverName, kind, name) {
  const normalize = (value) => value.toUpperCase().replace(/[^A-Z0-9_]/g, "_").replace(/^([^A-Z_])/, "_$1");
  return `TELOS_MCP_${normalize(serverName)}_${kind}_${normalize(name)}`;
}
function parseBindings(serverName, kind, lines) {
  const bindings = [];
  const values = {};
  for (const line of lines.split("\n")) {
    if (line.trim() === "") continue;
    const separator = line.indexOf("=");
    const name = (separator < 0 ? line : line.slice(0, separator)).trim();
    const value = separator < 0 ? "" : line.slice(separator + 1);
    const ref = credentialRef(serverName, kind, name);
    bindings.push({ name, credentialRef: ref });
    if (value !== "") values[ref] = value;
  }
  return { bindings, values };
}
function Editor({ original, onClose, controller }) {
  const [server, setServer] = (0, import_react.useState)(original ?? emptyServer());
  const [args, setArgs] = (0, import_react.useState)((original?.args ?? []).join("\n"));
  const [bindings, setBindings] = (0, import_react.useState)(bindingLines(original?.transport === "stdio" ? original.env : original?.headers ?? []));
  const [acknowledged, setAcknowledged] = (0, import_react.useState)(false);
  const update = (patch) => setServer((current) => ({ ...current, ...patch }));
  const save = async () => {
    const parsed = parseBindings(server.serverName, server.transport === "stdio" ? "ENV" : "HEADER", bindings);
    const draft = {
      server: {
        ...server,
        displayName: server.displayName.trim() || server.serverName,
        args: server.transport === "stdio" ? args.split("\n").filter(Boolean) : [],
        env: server.transport === "stdio" ? parsed.bindings : [],
        headers: server.transport === "streamable-http" ? parsed.bindings : []
      },
      credentialValues: parsed.values,
      acknowledgeLocalExecution: acknowledged
    };
    await controller.save(draft);
    if (controller.getSnapshot().error === void 0) onClose();
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { "aria-label": "MCP \u670D\u52A1\u7F16\u8F91\u5668", className: "telosMcpEditor", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosMcpEditorHeader", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: original === void 0 ? "\u6DFB\u52A0 MCP \u670D\u52A1" : "\u7F16\u8F91 MCP \u670D\u52A1" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: onClose, type: "button", children: "\u5173\u95ED" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosMcpGrid", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        "\u670D\u52A1\u6807\u8BC6",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { disabled: original !== void 0, onChange: (event) => update({ serverName: event.target.value }), placeholder: "codegraph", value: server.serverName })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        "\u663E\u793A\u540D\u79F0",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { onChange: (event) => update({ displayName: event.target.value }), placeholder: "CodeGraph", value: server.displayName })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        "\u4F20\u8F93\u65B9\u5F0F",
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { onChange: (event) => update({ transport: event.target.value }), value: server.transport, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "stdio", children: "\u672C\u673A\u8FDB\u7A0B (stdio)" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "streamable-http", children: "\u8FDC\u7A0B HTTP" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        "\u5DE5\u5177\u8D85\u65F6\uFF08\u6BEB\u79D2\uFF09",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { min: "1000", onChange: (event) => update({ toolCallTimeoutMs: Number(event.target.value) }), type: "number", value: server.toolCallTimeoutMs })
      ] })
    ] }),
    server.transport === "stdio" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        "\u53EF\u6267\u884C\u547D\u4EE4",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { onChange: (event) => update({ command: event.target.value }), placeholder: "codegraph", value: server.command ?? "" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        "\u53C2\u6570\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF09",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { onChange: (event) => setArgs(event.target.value), placeholder: "serve\n--mcp", rows: 3, value: args })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        "\u5DE5\u4F5C\u76EE\u5F55",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { onChange: (event) => update({ cwd: event.target.value }), placeholder: "/path/to/workspace", value: server.cwd ?? "" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        "\u73AF\u5883\u53D8\u91CF\uFF08NAME=VALUE\uFF0C\u6BCF\u884C\u4E00\u4E2A\uFF1B\u5DF2\u4FDD\u5B58\u7684\u503C\u4E0D\u4F1A\u56DE\u663E\uFF09",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { onChange: (event) => setBindings(event.target.value), rows: 3, value: bindings })
      ] }),
      server.enabled ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "telosMcpAcknowledgement", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { checked: acknowledged, onChange: (event) => setAcknowledged(event.target.checked), type: "checkbox" }),
        "\u6211\u786E\u8BA4\u8BE5\u670D\u52A1\u4F1A\u5728\u672C\u673A\u542F\u52A8\u8FDB\u7A0B\uFF0C\u5E76\u83B7\u5F97\u5176\u914D\u7F6E\u4E2D\u7684\u73AF\u5883\u53D8\u91CF\u548C\u5DE5\u4F5C\u76EE\u5F55\u6743\u9650\u3002"
      ] }) : null
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        "MCP URL",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { onChange: (event) => update({ url: event.target.value }), placeholder: "https://example.com/mcp", value: server.url ?? "" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        "\u8BF7\u6C42\u5934\uFF08NAME=VALUE\uFF0C\u6BCF\u884C\u4E00\u4E2A\uFF1B\u5DF2\u4FDD\u5B58\u7684\u503C\u4E0D\u4F1A\u56DE\u663E\uFF09",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { onChange: (event) => setBindings(event.target.value), rows: 4, value: bindings })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "telosMcpAcknowledgement", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { checked: server.enabled, onChange: (event) => update({ enabled: event.target.checked }), type: "checkbox" }),
      "\u4FDD\u5B58\u540E\u7ACB\u5373\u542F\u7528"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosMcpActions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: onClose, type: "button", children: "\u53D6\u6D88" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { "data-primary": true, disabled: server.serverName.trim() === "" || server.transport === "stdio" && server.enabled && !acknowledged, onClick: () => {
        void save();
      }, type: "button", children: "\u4FDD\u5B58" })
    ] })
  ] });
}
function McpSettingsSection({ controller }) {
  const state = (0, import_react.useSyncExternalStore)(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [editing, setEditing] = (0, import_react.useState)();
  const [armed, setArmed] = (0, import_react.useState)();
  (0, import_react.useEffect)(() => {
    void controller.refresh();
  }, [controller]);
  const selected = (0, import_react.useMemo)(() => state.servers.find((server) => server.serverName === editing), [editing, state.servers]);
  if (editing !== void 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Editor, { controller, onClose: () => setEditing(void 0), original: editing === "new" ? void 0 : selected });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { "aria-label": "MCP \u7BA1\u7406", className: "telosMcpSettings", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "telosMcpHeader", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "MCP" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u8FDE\u63A5\u5916\u90E8\u5DE5\u5177\u670D\u52A1\u3002Telos \u7BA1\u7406\u914D\u7F6E\u548C\u6388\u6743\uFF0C\u5DE5\u5177\u8FD0\u884C\u4ECD\u7531 DSH \u5B98\u65B9 MCP Client \u627F\u8F7D\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosMcpActions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: state.loading, onClick: () => {
          void controller.refresh();
        }, type: "button", children: "\u5237\u65B0" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { "data-primary": true, onClick: () => setEditing("new"), type: "button", children: "\u6DFB\u52A0\u670D\u52A1" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosMcpWarning", children: "\u672C\u673A stdio \u670D\u52A1\u4F1A\u542F\u52A8\u72EC\u7ACB\u8FDB\u7A0B\uFF0C\u4E0D\u53D7 Agent \u5DE5\u5177\u6743\u9650\u6A21\u5F0F\u7EA6\u675F\u3002\u4EC5\u542F\u7528\u4F60\u4FE1\u4EFB\u7684\u547D\u4EE4\uFF1B\u5BC6\u94A5\u7531 DSH \u51ED\u636E\u5B58\u50A8\u4FDD\u7BA1\uFF0C\u4E0D\u5199\u5165 MCP \u914D\u7F6E\u3002" }),
    state.error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosMcpBanner", "data-error": true, children: state.error }),
    state.notice === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosMcpBanner", children: state.notice }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosMcpTable", role: "table", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosMcpRow telosMcpTableHead", role: "row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u670D\u52A1" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u76EE\u6807" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u72B6\u6001" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u64CD\u4F5C" })
      ] }),
      state.servers.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosMcpEmpty", children: "\u8FD8\u6CA1\u6709 MCP \u670D\u52A1\u3002\u53EF\u4EE5\u5148\u6DFB\u52A0\u672C\u673A CodeGraph \u8FDB\u884C\u9A8C\u8BC1\u3002" }) : state.servers.map((server) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosMcpServer", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosMcpRow", role: "row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: server.displayName }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: [
              server.serverName,
              " \xB7 ",
              server.transport
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: server.transport === "stdio" ? [server.command, ...server.args ?? []].join(" ") : server.url }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { "data-status": server.runtime, children: [
            statusLabel(server),
            server.error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { title: server.error, children: server.error })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "telosMcpRowActions", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => setEditing(server.serverName), type: "button", children: "\u7F16\u8F91" }),
            server.enabled ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: state.loading, onClick: () => {
              void controller.reconnect(server.serverName);
            }, type: "button", children: "\u91CD\u8FDE" }) : null,
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: state.loading, onClick: () => {
              if (server.enabled) void controller.toggle(server.serverName);
              else if (armed !== `enable:${server.serverName}`) setArmed(`enable:${server.serverName}`);
              else {
                setArmed(void 0);
                void controller.toggle(server.serverName, true);
              }
            }, type: "button", children: server.enabled ? "\u505C\u7528" : armed === `enable:${server.serverName}` ? "\u786E\u8BA4\u542F\u52A8\u672C\u673A\u8FDB\u7A0B" : "\u542F\u7528" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { "data-danger": true, disabled: state.loading, onClick: () => {
              if (armed !== server.serverName) setArmed(server.serverName);
              else {
                setArmed(void 0);
                void controller.delete(server.serverName);
              }
            }, type: "button", children: armed === server.serverName ? "\u518D\u6B21\u786E\u8BA4\u5220\u9664" : "\u5220\u9664" })
          ] })
        ] }),
        server.toolNames.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosMcpTools", children: server.toolNames.map((name) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: name }, name)) })
      ] }, server.serverName))
    ] })
  ] });
}

// src/client/styles.ts
var MCP_MANAGER_CLIENT_CSS = String.raw`
.telosMcpSettings,.telosMcpEditor{box-sizing:border-box;width:100%;height:100%;overflow:auto;padding:6px 0 28px;color:var(--dsw-alias-label-primary)}
.telosMcpHeader,.telosMcpEditorHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}
.telosMcpHeader h1,.telosMcpEditorHeader h2{margin:0 0 5px;font-size:18px}.telosMcpHeader p{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.6}
.telosMcpWarning,.telosMcpBanner{margin-bottom:14px;padding:10px 12px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55}.telosMcpBanner[data-error]{color:var(--dsw-alias-state-error-primary)}
.telosMcpTable{width:100%;border-top:1px solid var(--dsw-alias-border-l1)}.telosMcpRow{display:grid;grid-template-columns:minmax(140px,.8fr) minmax(220px,1.4fr) minmax(140px,.8fr) minmax(280px,auto);align-items:center;gap:16px;min-height:58px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.telosMcpTableHead{min-height:38px;color:var(--dsw-alias-label-tertiary);font-size:11px}.telosMcpRow small{display:block;margin-top:4px;color:var(--dsw-alias-label-tertiary);font-size:10px;overflow:hidden;text-overflow:ellipsis}.telosMcpRow code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.telosMcpRow [data-status=loaded]{color:var(--dsw-alias-state-success-primary)}.telosMcpRow [data-status=error]{color:var(--dsw-alias-state-error-primary)}
.telosMcpActions,.telosMcpRowActions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px}.telosMcpSettings button,.telosMcpEditor button{min-height:31px;padding:5px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:inherit;cursor:pointer}.telosMcpSettings button[data-primary],.telosMcpEditor button[data-primary]{border-color:transparent;background:var(--dsw-alias-brand-primary);color:white}.telosMcpSettings button[data-danger]{color:var(--dsw-alias-state-error-primary)}.telosMcpSettings button:disabled,.telosMcpEditor button:disabled{cursor:not-allowed;opacity:.5}
.telosMcpTools{display:flex;flex-wrap:wrap;gap:6px;padding:8px 0 12px;border-bottom:1px solid var(--dsw-alias-border-l1)}.telosMcpTools code{padding:4px 7px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);font-size:10px}.telosMcpEmpty{padding:50px 20px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:13px}
.telosMcpEditor{max-width:none}.telosMcpGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.telosMcpEditor label{display:grid;gap:6px;margin-bottom:12px;color:var(--dsw-alias-label-secondary);font-size:12px}.telosMcpEditor input,.telosMcpEditor textarea,.telosMcpEditor select{box-sizing:border-box;width:100%;min-height:36px;padding:7px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit}.telosMcpEditor textarea{resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.telosMcpAcknowledgement{display:flex!important;grid-template-columns:auto 1fr!important;align-items:start}.telosMcpAcknowledgement input{width:auto!important;min-height:auto!important;margin-top:2px}
@media(max-width:1000px){.telosMcpRow{grid-template-columns:1fr 1fr}.telosMcpGrid{grid-template-columns:1fr}.telosMcpRowActions{justify-content:flex-start}}
`;
function installMcpManagerStyles() {
  const style = document.createElement("style");
  style.dataset.telosMcpManager = "true";
  style.textContent = MCP_MANAGER_CLIENT_CSS;
  document.head.append(style);
  return () => style.remove();
}

// src/client/index.ts
var inject = ["slots", "connection"];
function apply(ctx) {
  const controller = new McpClientController(ctx.connection.rpc);
  const injected = () => ({ controller });
  ctx.effect(() => installMcpManagerStyles(), "telos-mcp-manager: client styles");
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "mcp",
    order: 25,
    label: "MCP",
    inject: injected
  }, McpSettingsSection));
}

    return module.exports;
  },
});
