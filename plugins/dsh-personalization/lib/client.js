window.__ModuleLoader__.load({
  id: "@telos/dsh-personalization",
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
  PersonalizationClientController: () => PersonalizationClientController,
  PersonalizationSettingsSection: () => PersonalizationSettingsSection,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/contracts.ts
var PERSONALIZATION_RPC_CHANNEL = "/telos-personalization";
var MAX_PERSONAL_INSTRUCTIONS_BYTES = 64 * 1024;

// src/client/controller.ts
var EMPTY = { loading: false };
function message(error) {
  return error instanceof Error ? error.message : String(error);
}
var PersonalizationClientController = class {
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
  async save(instructions) {
    await this.run("save", { instructions }, instructions.trim().length > 0 ? "\u4E2A\u6027\u5316\u6307\u4EE4\u5DF2\u4FDD\u5B58" : "\u4E2A\u6027\u5316\u6307\u4EE4\u5DF2\u6E05\u7A7A");
  }
  async reset() {
    await this.run("reset", {}, "\u4E2A\u6027\u5316\u6307\u4EE4\u5DF2\u6E05\u7A7A");
  }
  async run(endpoint, payload, notice) {
    this.update({ loading: true, error: void 0, notice: void 0 });
    try {
      const result = await this.rpc.call(PERSONALIZATION_RPC_CHANNEL, endpoint, payload);
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

// src/client/PersonalizationSettingsSection.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function utf8Bytes(value) {
  return new TextEncoder().encode(value).byteLength;
}
function PersonalizationSettingsSection({ controller }) {
  const state = (0, import_react.useSyncExternalStore)(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [draft, setDraft] = (0, import_react.useState)();
  const [clearArmed, setClearArmed] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    void controller.refresh();
  }, [controller]);
  (0, import_react.useEffect)(() => {
    if (state.view !== void 0) setDraft(state.view.instructions);
  }, [state.view]);
  if (draft === void 0 || state.view === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", { "aria-label": "\u4E2A\u6027\u5316\u6307\u4EE4\u914D\u7F6E", className: "telosPersonalization", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosPersonalizationLoading", children: state.error ?? "\u6B63\u5728\u8BFB\u53D6\u4E2A\u6027\u5316\u6307\u4EE4\u2026" }) });
  }
  const byteLength = utf8Bytes(draft);
  const maxBytes = state.view.maxBytes || MAX_PERSONAL_INSTRUCTIONS_BYTES;
  const overLimit = byteLength > maxBytes;
  const dirty = draft !== state.view.instructions;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { "aria-label": "\u4E2A\u6027\u5316\u6307\u4EE4\u914D\u7F6E", className: "telosPersonalization", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "telosPersonalizationHeader", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "\u4E2A\u6027\u5316\u6307\u4EE4" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u544A\u8BC9 Telos \u4F60\u662F\u8C01\u3001\u5E0C\u671B\u5B83\u600E\u6837\u56DE\u7B54\uFF0C\u4EE5\u53CA\u5E94\u957F\u671F\u9075\u5FAA\u7684\u504F\u597D\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosPersonalizationActions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: state.loading || !dirty, onClick: () => setDraft(state.view?.instructions ?? ""), type: "button", children: "\u64A4\u9500\u4FEE\u6539" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { "data-primary": true, disabled: state.loading || !dirty || overLimit, onClick: () => {
          void controller.save(draft);
        }, type: "button", children: "\u4FDD\u5B58" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosPersonalizationPhase", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "\u5E94\u7528\u4E8E\u672C\u673A\u6240\u6709\u5DE5\u4F5C\u533A" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u7531 DSH \u539F\u751F AGENTS.md \u6307\u4EE4\u94FE\u52A0\u8F7D\uFF0C\u4E0D\u4FEE\u6539 Agent \u9884\u8BBE\uFF1B\u4E0B\u4E00\u6B21\u5BF9\u8BDD\u8BF7\u6C42\u5F00\u59CB\u751F\u6548\u3002" })
    ] }),
    state.error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosPersonalizationBanner", "data-error": true, children: state.error }),
    state.notice === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosPersonalizationBanner", children: state.notice }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "telosPersonalizationEditor", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u6307\u4EE4\u5185\u5BB9" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "textarea",
        {
          onChange: (event) => {
            setClearArmed(false);
            setDraft(event.target.value);
          },
          placeholder: "\u4F8B\u5982\uFF1A\n- \u8BF7\u4F18\u5148\u4F7F\u7528\u4E2D\u6587\u56DE\u7B54\n- \u5148\u7ED9\u7ED3\u8BBA\uFF0C\u518D\u89E3\u91CA\u539F\u56E0\n- \u6211\u5E38\u7528\u7684\u6280\u672F\u6808\u662F Electron\u3001React \u548C TypeScript",
          rows: 14,
          value: draft
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { "data-error": overLimit || void 0, children: [
        String(byteLength),
        " / ",
        String(maxBytes),
        " UTF-8 bytes",
        overLimit ? "\uFF0C\u5185\u5BB9\u8FC7\u957F\uFF0C\u65E0\u6CD5\u4FDD\u5B58" : ""
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", { className: "telosPersonalizationFooter", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u5185\u5BB9\u4EC5\u4FDD\u5B58\u5728\u5F53\u524D\u8BBE\u5907\u7684\u672C\u5730 DSH \u7528\u6237\u76EE\u5F55\uFF0C\u4E0D\u968F\u5DE5\u4F5C\u533A\u5207\u6362\u6216\u4E0A\u4F20\u3002\u8BF7\u4E0D\u8981\u5728\u8FD9\u91CC\u586B\u5199 API Key \u7B49\u79D8\u5BC6\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { "data-danger": true, disabled: state.loading || !state.view.configured && draft.trim().length === 0, onClick: () => {
        if (!clearArmed) setClearArmed(true);
        else {
          setClearArmed(false);
          setDraft("");
          void controller.reset();
        }
      }, type: "button", children: clearArmed ? "\u518D\u6B21\u786E\u8BA4\u6E05\u7A7A" : "\u6E05\u7A7A\u6307\u4EE4" })
    ] })
  ] });
}

// src/client/styles.ts
var STYLE_ID = "telos-personalization-styles";
var PERSONALIZATION_STYLES = `
.telosPersonalization{box-sizing:border-box;width:100%;color:var(--dsw-alias-label-primary)}
.telosPersonalizationHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:20px}.telosPersonalizationHeader h1{margin:0;font-size:18px}.telosPersonalizationHeader p{margin:6px 0 0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.55}
.telosPersonalizationActions{display:flex;gap:8px}.telosPersonalization button{min-height:32px;padding:5px 11px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:inherit;cursor:pointer}.telosPersonalization button[data-primary]{border-color:transparent;background:var(--dsw-alias-brand-primary);color:#fff}.telosPersonalization button[data-danger]{color:var(--dsw-alias-state-error-primary)}.telosPersonalization button:disabled{cursor:not-allowed;opacity:.5}
.telosPersonalizationPhase{display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);font-size:12px}.telosPersonalizationPhase span{color:var(--dsw-alias-label-tertiary);line-height:1.55}
.telosPersonalizationBanner{margin-bottom:12px;padding:9px 12px;border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent);font-size:12px}.telosPersonalizationBanner[data-error]{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);color:var(--dsw-alias-state-error-primary)}
.telosPersonalizationEditor{display:grid;gap:8px}.telosPersonalizationEditor>span{font-size:12px;font-weight:600}.telosPersonalizationEditor textarea{box-sizing:border-box;width:100%;min-height:260px;padding:14px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;outline:none;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:13px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;resize:vertical}.telosPersonalizationEditor textarea:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent)}.telosPersonalizationEditor small{justify-self:end;color:var(--dsw-alias-label-tertiary);font-size:10px}.telosPersonalizationEditor small[data-error]{color:var(--dsw-alias-state-error-primary)}
.telosPersonalizationFooter{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-top:18px}.telosPersonalizationFooter p{max-width:760px;margin:0;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.6}.telosPersonalizationLoading{padding:24px;color:var(--dsw-alias-label-tertiary);font-size:12px}
`;
function installPersonalizationStyles() {
  const existing = document.getElementById(STYLE_ID);
  if (existing !== null) return () => void 0;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = PERSONALIZATION_STYLES;
  document.head.append(style);
  return () => style.remove();
}

// src/client/index.ts
var inject = ["slots", "connection"];
function apply(ctx) {
  const controller = new PersonalizationClientController(ctx.connection.rpc);
  const injected = () => ({ controller });
  ctx.effect(() => installPersonalizationStyles(), "telos-personalization: client styles");
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "personalization",
    order: 15,
    label: "\u4E2A\u6027\u5316",
    inject: injected
  }, PersonalizationSettingsSection));
}

    return module.exports;
  },
});
