window.__ModuleLoader__.load({
  id: "@telos/dsh-multimodal",
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
  MultimodalClientController: () => MultimodalClientController,
  MultimodalSettingsSection: () => MultimodalSettingsSection,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/contracts.ts
var MULTIMODAL_RPC_CHANNEL = "/telos-multimodal";
var MULTIMODAL_CAPABILITIES = [
  "image-understanding",
  "ocr",
  "speech-to-text",
  "text-to-speech",
  "video-understanding",
  "document-understanding"
];

// src/client/controller.ts
var EMPTY = { loading: false };
function message(error) {
  return error instanceof Error ? error.message : String(error);
}
var MultimodalClientController = class {
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
    await this.run("get", {}, void 0);
  }
  async save(settings) {
    await this.run("save", settings, "\u591A\u6A21\u6001\u6A21\u578B\u914D\u7F6E\u5DF2\u4FDD\u5B58");
  }
  async reset() {
    await this.run("reset", {}, "\u5DF2\u6062\u590D\u9ED8\u8BA4\u591A\u6A21\u6001\u914D\u7F6E");
  }
  async run(endpoint, payload, notice) {
    this.update({ loading: true, error: void 0, notice: void 0 });
    try {
      const result = await this.rpc.call(MULTIMODAL_RPC_CHANNEL, endpoint, payload);
      if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
      this.update({ view: result.value, loading: false, notice });
    } catch (error) {
      this.update({ loading: false, error: message(error) });
    }
  }
  update(patch) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
};

// src/client/MultimodalSettingsSection.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var CAPABILITY_COPY = {
  "image-understanding": { title: "\u56FE\u7247\u7406\u89E3", description: "\u770B\u61C2\u7167\u7247\u3001\u622A\u56FE\u3001\u56FE\u8868\u548C\u754C\u9762\u3002" },
  ocr: { title: "OCR", description: "\u4ECE\u56FE\u7247\u548C\u626B\u63CF\u4EF6\u4E2D\u63D0\u53D6\u6587\u5B57\u4E0E\u7248\u9762\u3002" },
  "speech-to-text": { title: "\u8BED\u97F3\u8F6C\u6587\u5B57", description: "\u8F6C\u5199\u8BED\u97F3\u6D88\u606F\u3001\u5F55\u97F3\u548C\u97F3\u89C6\u9891\u97F3\u8F68\u3002" },
  "text-to-speech": { title: "\u6587\u5B57\u8F6C\u8BED\u97F3", description: "\u628A\u56DE\u590D\u751F\u6210\u53EF\u64AD\u653E\u7684\u8BED\u97F3\u3002" },
  "video-understanding": { title: "\u89C6\u9891\u7406\u89E3", description: "\u5904\u7406\u89C6\u9891\u7684\u753B\u9762\u3001\u65F6\u95F4\u8F74\u548C\u97F3\u8F68\u3002" },
  "document-understanding": { title: "\u6587\u6863\u7406\u89E3", description: "\u5904\u7406 PDF\u3001Office \u6587\u6863\u3001\u626B\u63CF\u9875\u548C\u7248\u9762\u3002" }
};
var EMPTY_ROUTE = { provider: "", model: "" };
function routeOf(config) {
  return config.route ?? EMPTY_ROUTE;
}
function statusLabel(status) {
  if (status.state === "available") return "\u53EF\u7528";
  if (status.state === "incompatible") return "\u4E0D\u517C\u5BB9";
  if (status.state === "unverified") return "\u5F85\u9A8C\u8BC1";
  if (status.state === "disabled") return "\u5DF2\u505C\u7528";
  return "\u81EA\u52A8";
}
function RouteInputs({ route, catalog, id, onChange }) {
  const models = (0, import_react.useMemo)(
    () => catalog.find((group) => group.id === route.provider)?.models ?? catalog.flatMap((group) => group.models),
    [catalog, route.provider]
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosMmRouteInputs", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
      "Provider",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { list: `${id}-providers`, onChange: (event) => onChange({ ...route, provider: event.target.value }), placeholder: "\u4F8B\u5982 openai", value: route.provider }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("datalist", { id: `${id}-providers`, children: catalog.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: group.id, children: group.name }, group.id)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
      "Model",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { list: `${id}-models`, onChange: (event) => onChange({ ...route, model: event.target.value }), placeholder: "\u6A21\u578B ID", value: route.model }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("datalist", { id: `${id}-models`, children: models.map((model) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: model.model, children: model.name }, `${model.provider}:${model.model}`)) })
    ] })
  ] });
}
function CapabilityEditor({ capability, config, status, catalog, onChange }) {
  const copy = CAPABILITY_COPY[capability];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { className: "telosMmCapability", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosMmCapabilityHeader", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: copy.title }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: copy.description })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "data-status": status.state, children: statusLabel(status) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "telosMmMode", children: [
      "\u6A21\u578B\u8DEF\u7EBF",
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { onChange: (event) => {
        const mode = event.target.value;
        onChange(mode === "fixed" ? { mode, route: routeOf(config) } : { mode });
      }, value: config.mode, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "auto", children: "\u81EA\u52A8\u9009\u62E9" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "fixed", children: "\u6307\u5B9A\u6A21\u578B" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "disabled", children: "\u505C\u7528" })
      ] })
    ] }),
    config.mode === "fixed" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RouteInputs, { catalog, id: `telos-mm-${capability}`, onChange: (route) => onChange({ mode: "fixed", route }), route: routeOf(config) }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "telosMmStatusText", children: status.message })
  ] });
}
function MultimodalSettingsSection({ controller }) {
  const state = (0, import_react.useSyncExternalStore)(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [draft, setDraft] = (0, import_react.useState)();
  const [resetArmed, setResetArmed] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    void controller.refresh();
  }, [controller]);
  (0, import_react.useEffect)(() => {
    if (state.view !== void 0) setDraft(state.view.settings);
  }, [state.view]);
  if (draft === void 0 || state.view === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", { "aria-label": "\u591A\u6A21\u6001\u6A21\u578B\u914D\u7F6E", className: "telosMmSettings", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosMmLoading", children: state.error ?? "\u6B63\u5728\u8BFB\u53D6\u6A21\u578B\u76EE\u5F55\u2026" }) });
  }
  const view = state.view;
  const updateRoute = (capability, config) => {
    setDraft((current) => current === void 0 ? current : { ...current, routes: { ...current.routes, [capability]: config } });
  };
  const mainRoute = draft.mainModel.route ?? EMPTY_ROUTE;
  const fixedRoutesValid = MULTIMODAL_CAPABILITIES.every((capability) => {
    const route = draft.routes[capability];
    return route.mode !== "fixed" || route.route?.provider.trim() !== "" && route.route?.model.trim() !== "";
  });
  const mainRouteValid = draft.mainModel.mode !== "fixed" || mainRoute.provider.trim() !== "" && mainRoute.model.trim() !== "";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { "aria-label": "\u591A\u6A21\u6001\u6A21\u578B\u914D\u7F6E", className: "telosMmSettings", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "telosMmHeader", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "\u591A\u6A21\u6001\u6A21\u578B" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u4E3A\u4E0D\u540C\u5A92\u4F53\u80FD\u529B\u6307\u5B9A\u6A21\u578B\u8DEF\u7EBF\u3002Provider \u7684\u5730\u5740\u548C API Key \u4ECD\u5728\u201C\u6A21\u578B\u201D\u8BBE\u7F6E\u4E2D\u7BA1\u7406\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosMmActions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: state.loading, onClick: () => {
          void controller.refresh();
        }, type: "button", children: "\u5237\u65B0\u76EE\u5F55" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { "data-primary": true, disabled: state.loading || !fixedRoutesValid || !mainRouteValid, onClick: () => {
          void controller.save(draft);
        }, type: "button", children: "\u4FDD\u5B58" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosMmPhase", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "\u914D\u7F6E\u57FA\u7840" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u672C\u9875\u4F1A\u6301\u4E45\u5316\u6A21\u578B\u4E0E\u9690\u79C1\u8DEF\u7EBF\uFF1B\u591A\u6A21\u6001\u5904\u7406\u8FD0\u884C\u65F6\u5C1A\u672A\u5728\u8FD9\u4E00\u9636\u6BB5\u542F\u7528\u3002" })
    ] }),
    state.error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosMmBanner", "data-error": true, children: state.error }),
    state.notice === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosMmBanner", children: state.notice }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "telosMmMaster", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "\u542F\u7528 Telos \u591A\u6A21\u6001\u8DEF\u7EBF" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "\u5173\u95ED\u540E\u4FDD\u7559\u914D\u7F6E\uFF0C\u4F46\u672A\u6765\u8FD0\u884C\u65F6\u53EA\u4F7F\u7528 DSH \u539F\u751F\u80FD\u529B\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { checked: draft.enabled, onChange: (event) => setDraft({ ...draft, enabled: event.target.checked }), type: "checkbox" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosMmSectionTitle", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "\u4E3B\u6A21\u578B" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u7EE7\u7EED\u8D1F\u8D23\u63A8\u7406\u3001\u56DE\u7B54\u548C\u5DE5\u5177\u51B3\u7B56\uFF0C\u4E0D\u8981\u6C42\u5B83\u539F\u751F\u652F\u6301\u6240\u6709\u5A92\u4F53\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { className: "telosMmMainModel", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "telosMmMode", children: [
        "\u9009\u62E9\u65B9\u5F0F",
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { onChange: (event) => {
          const mode = event.target.value;
          setDraft({ ...draft, mainModel: mode === "fixed" ? { mode, route: mainRoute } : { mode } });
        }, value: draft.mainModel.mode, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "follow-session", children: "\u8DDF\u968F\u5F53\u524D\u4F1A\u8BDD" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "fixed", children: "\u56FA\u5B9A\u6A21\u578B" })
        ] })
      ] }),
      draft.mainModel.mode === "fixed" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RouteInputs, { catalog: view.catalog, id: "telos-mm-main", onChange: (route) => setDraft({ ...draft, mainModel: { mode: "fixed", route } }), route: mainRoute }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "telosMmStatusText", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "data-status": view.mainModelStatus.state, children: statusLabel(view.mainModelStatus) }),
        view.mainModelStatus.message
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosMmSectionTitle", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "\u80FD\u529B\u8DEF\u7EBF" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u201C\u81EA\u52A8\u201D\u4F1A\u5728\u8FD0\u884C\u65F6\u63A5\u5165\u540E\uFF0C\u7ED3\u5408\u80FD\u529B\u58F0\u660E\u3001\u53EF\u7528\u6027\u548C\u9690\u79C1\u7B56\u7565\u9009\u62E9\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosMmCapabilities", children: MULTIMODAL_CAPABILITIES.map((capability) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      CapabilityEditor,
      {
        capability,
        catalog: view.catalog,
        config: draft.routes[capability],
        onChange: (config) => updateRoute(capability, config),
        status: view.routeStatuses[capability]
      },
      capability
    )) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosMmSectionTitle", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "\u9690\u79C1\u4E0E\u672C\u5730\u4F18\u5148" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u8FD9\u4E9B\u662F\u672A\u6765\u8DEF\u7EBF\u89C4\u5212\u5668\u7684\u5F3A\u7EA6\u675F\uFF0C\u4E0D\u662F\u63D0\u793A\u8BCD\u5EFA\u8BAE\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosMmPrivacy", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "\u4F18\u5148\u4F7F\u7528\u672C\u5730\u80FD\u529B" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "\u540C\u7B49\u53EF\u7528\u65F6\u5148\u9009\u672C\u673A OCR\u3001\u8F6C\u5199\u6216\u89C6\u89C9\u6A21\u578B\u3002" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { checked: draft.privacy.preferLocal, onChange: (event) => setDraft({ ...draft, privacy: { ...draft.privacy, preferLocal: event.target.checked } }), type: "checkbox" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "\u5A92\u4F53\u53D1\u9001\u5230\u4E91\u7AEF" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "\u63A7\u5236\u539F\u59CB\u56FE\u7247\u3001\u97F3\u9891\u3001\u89C6\u9891\u548C\u6587\u6863\u80FD\u5426\u79BB\u5F00\u672C\u673A\u3002" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { onChange: (event) => setDraft({ ...draft, privacy: { ...draft.privacy, cloudMediaPolicy: event.target.value } }), value: draft.privacy.cloudMediaPolicy, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "ask", children: "\u6BCF\u6B21\u9996\u6B21\u8BE2\u95EE" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "allow-configured", children: "\u5141\u8BB8\u5DF2\u914D\u7F6E\u8DEF\u7EBF" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "local-only", children: "\u4EC5\u9650\u672C\u5730" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", { className: "telosMmFooter", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u914D\u7F6E\u6309\u5F53\u524D\u8BBE\u5907\u7684\u672C\u5730\u7528\u6237\u4FDD\u5B58\uFF0C\u4E0D\u968F\u5DE5\u4F5C\u533A\u5207\u6362\uFF1B\u6A21\u578B\u5BC6\u94A5\u4E0D\u4F1A\u5199\u5165\u6B64\u914D\u7F6E\u6587\u4EF6\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { "data-danger": true, disabled: state.loading, onClick: () => {
        if (!resetArmed) setResetArmed(true);
        else {
          setResetArmed(false);
          void controller.reset();
        }
      }, type: "button", children: resetArmed ? "\u518D\u6B21\u786E\u8BA4\u6062\u590D\u9ED8\u8BA4" : "\u6062\u590D\u9ED8\u8BA4" })
    ] })
  ] });
}

// src/client/styles.ts
var MULTIMODAL_CLIENT_CSS = String.raw`
.telosMmSettings{box-sizing:border-box;width:100%;height:100%;overflow:auto;padding:6px 0 32px;color:var(--dsw-alias-label-primary)}
.telosMmHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}.telosMmHeader h1{margin:0 0 5px;font-size:18px}.telosMmHeader p,.telosMmSectionTitle p{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.6}
.telosMmActions{display:flex;gap:8px}.telosMmSettings button{min-height:32px;padding:5px 11px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:inherit;cursor:pointer}.telosMmSettings button[data-primary]{border-color:transparent;background:var(--dsw-alias-brand-primary);color:white}.telosMmSettings button[data-danger]{color:var(--dsw-alias-state-error-primary)}.telosMmSettings button:disabled{cursor:not-allowed;opacity:.5}
.telosMmPhase,.telosMmBanner{display:flex;gap:9px;margin-bottom:14px;padding:10px 12px;border-radius:9px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55}.telosMmPhase strong{color:var(--dsw-alias-brand-primary);white-space:nowrap}.telosMmBanner[data-error]{color:var(--dsw-alias-state-error-primary)}
.telosMmMaster{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:16px 0;border-top:1px solid var(--dsw-alias-border-l1);border-bottom:1px solid var(--dsw-alias-border-l1)}.telosMmMaster span,.telosMmPrivacy label span{display:grid;gap:4px}.telosMmMaster small,.telosMmPrivacy small{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5}.telosMmMaster input,.telosMmPrivacy input{width:18px;height:18px;accent-color:var(--dsw-alias-brand-primary)}
.telosMmSectionTitle{display:flex;align-items:baseline;gap:12px;margin:28px 0 12px}.telosMmSectionTitle h2{margin:0;font-size:14px;white-space:nowrap}
.telosMmMainModel,.telosMmCapability{padding:14px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}.telosMmCapabilities{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.telosMmCapabilityHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.telosMmCapabilityHeader h3{margin:0 0 4px;font-size:13px}.telosMmCapabilityHeader p{margin:0;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.45}.telosMmCapabilityHeader>span,.telosMmStatusText>span{padding:3px 7px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);font-size:10px;white-space:nowrap}.telosMmCapabilityHeader>[data-status=available],.telosMmStatusText>[data-status=available]{color:var(--dsw-alias-state-success-primary)}.telosMmCapabilityHeader>[data-status=incompatible],.telosMmStatusText>[data-status=incompatible]{color:var(--dsw-alias-state-error-primary)}
.telosMmMode{display:grid;grid-template-columns:92px 1fr;align-items:center;gap:10px;margin-top:13px;color:var(--dsw-alias-label-secondary);font-size:11px}.telosMmRouteInputs{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:9px}.telosMmRouteInputs label{display:grid;gap:5px;color:var(--dsw-alias-label-secondary);font-size:10px}.telosMmSettings input[type=text],.telosMmSettings input:not([type]),.telosMmSettings select{box-sizing:border-box;width:100%;min-height:34px;padding:6px 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit}.telosMmStatusText{display:flex;align-items:center;gap:7px;margin:10px 0 0;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:1.45}
.telosMmPrivacy{border-top:1px solid var(--dsw-alias-border-l1)}.telosMmPrivacy>label{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:64px;border-bottom:1px solid var(--dsw-alias-border-l1)}.telosMmPrivacy select{width:190px}
.telosMmFooter{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:24px}.telosMmFooter p,.telosMmLoading{color:var(--dsw-alias-label-tertiary);font-size:11px}.telosMmLoading{padding:50px 20px;text-align:center}
@media(max-width:900px){.telosMmHeader,.telosMmFooter{align-items:stretch;flex-direction:column}.telosMmActions{justify-content:flex-end}.telosMmCapabilities{grid-template-columns:1fr}.telosMmRouteInputs{grid-template-columns:1fr}.telosMmSectionTitle{align-items:flex-start;flex-direction:column;gap:3px}}
`;
function installMultimodalStyles() {
  const style = document.createElement("style");
  style.dataset.telosMultimodal = "true";
  style.textContent = MULTIMODAL_CLIENT_CSS;
  document.head.append(style);
  return () => style.remove();
}

// src/client/index.ts
var inject = ["slots", "connection"];
function apply(ctx) {
  const controller = new MultimodalClientController(ctx.connection.rpc);
  const injected = () => ({ controller });
  ctx.effect(() => installMultimodalStyles(), "telos-multimodal: client styles");
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "multimodal",
    order: 20,
    label: "\u591A\u6A21\u6001",
    inject: injected
  }, MultimodalSettingsSection));
}

    return module.exports;
  },
});
