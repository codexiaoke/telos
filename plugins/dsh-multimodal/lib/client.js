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
  async resolveImageRoute(current) {
    const result = await this.rpc.call(MULTIMODAL_RPC_CHANNEL, "resolve-image-route", current);
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
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

// src/client/image-routing.ts
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function notify(conversation, sessions, session, level, message2) {
  const actx = sessions.scope(session.sessionId);
  if (actx !== void 0) conversation.input.for(actx).notify(level, message2);
}
function installImageRouting(ctx, controller) {
  const conversation = ctx.get("conversation");
  const modelDirectories = ctx.get("modelDirectories");
  const sessions = ctx.get("sessions");
  if (conversation === void 0 || modelDirectories === void 0 || sessions === void 0) {
    throw new Error("telos-multimodal: conversation, modelDirectories, and sessions are required");
  }
  const original = conversation.sendSession;
  const routed = async (session, text, imageIds, mode) => {
    if (imageIds.length === 0) return original.call(conversation, session, text, imageIds, mode);
    try {
      const directory = modelDirectories.directoryFor(session.sessionId);
      const current = (await directory.load()).current;
      const resolution = await controller.resolveImageRoute(current);
      if (resolution.kind === "bridge") {
        await directory.select(resolution.route);
        notify(
          conversation,
          sessions,
          session,
          "info",
          `\u5DF2\u4F7F\u7528 ${resolution.perceptionName} \u7406\u89E3\u56FE\u7247\uFF0C\u4ECD\u7531 ${resolution.routeName} \u56DE\u7B54\u3002`
        );
      }
      await original.call(conversation, session, text, imageIds, mode);
    } catch (error) {
      notify(conversation, sessions, session, "error", errorMessage(error));
      throw error;
    }
  };
  conversation.sendSession = routed;
  return () => {
    if (conversation.sendSession === routed) conversation.sendSession = original;
  };
}

// src/client/MultimodalSettingsSection.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function routeValue(route) {
  return route === void 0 ? "" : JSON.stringify({ provider: route.provider, model: route.model });
}
function parseRouteValue(value) {
  if (value === "") return void 0;
  const route = JSON.parse(value);
  return { provider: route.provider, model: route.model };
}
function statusLabel(status) {
  if (status.state === "available") return "\u53EF\u7528";
  if (status.state === "incompatible") return "\u4E0D\u517C\u5BB9";
  if (status.state === "unverified") return "\u5F85\u9A8C\u8BC1";
  return "\u672A\u914D\u7F6E";
}
function routeKey(route) {
  return `${route.provider}\0${route.model}`;
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
  const imageModels = (0, import_react.useMemo)(() => {
    if (state.view === void 0) return [];
    return state.view.catalog.flatMap((group) => group.models.map((model) => ({ ...model, providerName: group.name })));
  }, [state.view]);
  if (draft === void 0 || state.view === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", { "aria-label": "\u591A\u6A21\u6001\u6A21\u578B\u914D\u7F6E", className: "telosMmSettings", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosMmLoading", children: state.error ?? "\u6B63\u5728\u8BFB\u53D6\u6A21\u578B\u76EE\u5F55\u2026" }) });
  }
  const view = state.view;
  const selectedMissing = draft.defaultModel !== void 0 && !imageModels.some((model) => routeKey(model) === routeKey(draft.defaultModel));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { "aria-label": "\u591A\u6A21\u6001\u6A21\u578B\u914D\u7F6E", className: "telosMmSettings", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "telosMmHeader", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "\u9ED8\u8BA4\u591A\u6A21\u6001\u6A21\u578B" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u5F53\u524D\u4F1A\u8BDD\u6A21\u578B\u770B\u4E0D\u61C2\u56FE\u7247\u65F6\uFF0C\u7531\u8FD9\u91CC\u7684\u6A21\u578B\u5148\u5B8C\u6210\u89C6\u89C9\u7406\u89E3\uFF1B\u6700\u7EC8\u56DE\u7B54\u3001\u63A8\u7406\u548C\u5DE5\u5177\u8C03\u7528\u4ECD\u7531\u5F53\u524D\u4F1A\u8BDD\u6A21\u578B\u8D1F\u8D23\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosMmActions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: state.loading, onClick: () => {
          void controller.refresh();
        }, type: "button", children: "\u5237\u65B0\u76EE\u5F55" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { "data-primary": true, disabled: state.loading, onClick: () => {
          void controller.save(draft);
        }, type: "button", children: "\u4FDD\u5B58" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosMmPhase", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "\u56FE\u7247\u8DEF\u7531\u5DF2\u542F\u7528" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u539F\u751F\u56FE\u7247\u6A21\u578B\u76F4\u63A5\u5904\u7406\uFF1B\u6587\u672C\u6A21\u578B\u901A\u8FC7 Telos \u903B\u8F91\u8DEF\u7531\u4F7F\u7528\u9ED8\u8BA4\u591A\u6A21\u6001\u6A21\u578B\uFF0C\u4E0D\u7ECF\u8FC7 MCP\u3002" })
    ] }),
    state.error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosMmBanner", "data-error": true, children: state.error }),
    state.notice === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosMmBanner", children: state.notice }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "telosMmMaster", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "\u81EA\u52A8\u8865\u8DB3\u56FE\u7247\u80FD\u529B" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "\u5173\u95ED\u540E\uFF0C\u5F53\u524D\u6A21\u578B\u4E0D\u652F\u6301\u56FE\u7247\u65F6\u76F4\u63A5\u4F7F\u7528 DSH \u539F\u751F\u9519\u8BEF\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { checked: draft.enabled, onChange: (event) => setDraft({ ...draft, enabled: event.target.checked }), type: "checkbox" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosMmSectionTitle", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "\u6A21\u578B" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "API \u5730\u5740\u4E0E\u5BC6\u94A5\u7EE7\u7EED\u5728\u201C\u6A21\u578B\u201D\u8BBE\u7F6E\u4E2D\u914D\u7F6E\uFF0C\u672C\u9875\u53EA\u4FDD\u5B58 Provider \u4E0E\u6A21\u578B ID\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { className: "telosMmModelCard", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        "\u9ED8\u8BA4\u591A\u6A21\u6001\u6A21\u578B",
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { onChange: (event) => setDraft({ ...draft, defaultModel: parseRouteValue(event.target.value) }), value: routeValue(draft.defaultModel), children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: "\u672A\u914D\u7F6E" }),
          selectedMissing && draft.defaultModel !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: routeValue(draft.defaultModel), children: [
            draft.defaultModel.provider,
            " \xB7 ",
            draft.defaultModel.model,
            "\uFF08\u5F85\u9A8C\u8BC1\uFF09"
          ] }) : null,
          view.catalog.map((group) => {
            const models = imageModels.filter((model) => model.provider === group.id);
            return models.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("optgroup", { label: group.name, children: models.map((model) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: routeValue(model), children: [
              model.name,
              model.inputModalities?.includes("image") ? "" : "\uFF08\u4FDD\u5B58\u65F6\u58F0\u660E\u56FE\u7247\u80FD\u529B\uFF09"
            ] }, routeKey(model))) }, group.id);
          })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosMmStatus", "data-status": view.defaultModelStatus.state, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: statusLabel(view.defaultModelStatus) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: view.defaultModelStatus.message })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u9009\u62E9\u5C1A\u672A\u58F0\u660E\u56FE\u7247\u80FD\u529B\u7684\u81EA\u5B9A\u4E49 OpenAI \u517C\u5BB9\u6A21\u578B\u65F6\uFF0C\u4FDD\u5B58\u4F1A\u901A\u8FC7 DSH Settings API \u5C06\u8BE5\u6A21\u578B\u58F0\u660E\u4E3A text + image\uFF1B\u4E0D\u76F4\u63A5\u6539\u5199\u914D\u7F6E\u6587\u4EF6\u3002\u82E5\u58F0\u660E\u6216\u8DEF\u7531\u5931\u8D25\uFF0C\u56FE\u7247\u4E0D\u4F1A\u63D0\u4EA4\u5230 Session\uFF0C\u8F93\u5165\u6587\u5B57\u548C\u56FE\u7247\u8349\u7A3F\u90FD\u4F1A\u4FDD\u7559\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosMmFlow", "aria-label": "\u56FE\u7247\u5904\u7406\u6D41\u7A0B", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u539F\u59CB\u56FE\u7247\u4FDD\u5B58\u5230 DSH Session" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: "\u2192" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u9ED8\u8BA4\u6A21\u578B\u751F\u6210\u89C6\u89C9\u89C2\u5BDF" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: "\u2192" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u5F53\u524D\u6A21\u578B\u56DE\u7B54\u4E0E\u8C03\u7528\u5DE5\u5177" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", { className: "telosMmFooter", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u914D\u7F6E\u6309\u5F53\u524D\u8BBE\u5907\u7684\u672C\u5730\u7528\u6237\u4FDD\u5B58\uFF0C\u4E0D\u968F\u5DE5\u4F5C\u533A\u5207\u6362\uFF1BAPI Key \u4E0D\u4F1A\u5199\u5165\u591A\u6A21\u6001\u914D\u7F6E\u3002" }),
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
.telosMmHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}.telosMmHeader h1{margin:0 0 5px;font-size:18px}.telosMmHeader p,.telosMmSectionTitle p{max-width:720px;margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.6}
.telosMmActions{display:flex;gap:8px}.telosMmSettings button{min-height:32px;padding:5px 11px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:inherit;cursor:pointer}.telosMmSettings button[data-primary]{border-color:transparent;background:var(--dsw-alias-brand-primary);color:white}.telosMmSettings button[data-danger]{color:var(--dsw-alias-state-error-primary)}.telosMmSettings button:disabled{cursor:not-allowed;opacity:.5}
.telosMmPhase,.telosMmBanner{display:flex;gap:9px;margin-bottom:14px;padding:10px 12px;border-radius:9px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55}.telosMmPhase strong{color:var(--dsw-alias-brand-primary);white-space:nowrap}.telosMmBanner[data-error]{color:var(--dsw-alias-state-error-primary)}
.telosMmMaster{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:16px 0;border-top:1px solid var(--dsw-alias-border-l1);border-bottom:1px solid var(--dsw-alias-border-l1)}.telosMmMaster span{display:grid;gap:4px}.telosMmMaster small{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5}.telosMmMaster input{width:18px;height:18px;accent-color:var(--dsw-alias-brand-primary)}
.telosMmSectionTitle{display:flex;align-items:baseline;gap:12px;margin:28px 0 12px}.telosMmSectionTitle h2{margin:0;font-size:14px;white-space:nowrap}
.telosMmModelCard{display:grid;gap:13px;padding:16px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}.telosMmModelCard>label{display:grid;grid-template-columns:180px minmax(260px,520px);align-items:center;gap:12px;color:var(--dsw-alias-label-secondary);font-size:12px}.telosMmSettings select{box-sizing:border-box;width:100%;min-height:36px;padding:6px 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit}.telosMmModelCard>p{margin:0;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.55}
.telosMmStatus{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-tertiary);font-size:11px}.telosMmStatus strong{padding:3px 7px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);font-size:10px}.telosMmStatus[data-status=available] strong{color:var(--dsw-alias-state-success-primary)}.telosMmStatus[data-status=incompatible] strong{color:var(--dsw-alias-state-error-primary)}
.telosMmFlow{display:flex;align-items:center;gap:9px;margin-top:18px;padding:13px;border-radius:9px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:11px}.telosMmFlow i{color:var(--dsw-alias-label-tertiary);font-style:normal}
.telosMmFooter{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:24px}.telosMmFooter p,.telosMmLoading{color:var(--dsw-alias-label-tertiary);font-size:11px}.telosMmLoading{padding:50px 20px;text-align:center}
@media(max-width:900px){.telosMmHeader,.telosMmFooter{align-items:stretch;flex-direction:column}.telosMmActions{justify-content:flex-end}.telosMmModelCard>label{grid-template-columns:1fr}.telosMmSectionTitle{align-items:flex-start;flex-direction:column;gap:3px}.telosMmFlow{align-items:flex-start;flex-direction:column}.telosMmFlow i{transform:rotate(90deg)}}
`;
function installMultimodalStyles() {
  const style = document.createElement("style");
  style.dataset.telosMultimodal = "true";
  style.textContent = MULTIMODAL_CLIENT_CSS;
  document.head.append(style);
  return () => style.remove();
}

// src/client/index.ts
var inject = ["slots", "connection", "conversation", "modelDirectories", "sessions"];
function apply(ctx) {
  const controller = new MultimodalClientController(ctx.connection.rpc);
  const injected = () => ({ controller });
  ctx.effect(() => installMultimodalStyles(), "telos-multimodal: client styles");
  ctx.effect(() => installImageRouting(ctx, controller), "telos-multimodal: image routing");
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
