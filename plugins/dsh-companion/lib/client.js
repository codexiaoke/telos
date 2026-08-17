window.__ModuleLoader__.load({
  id: "@telos/dsh-companion",
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
  CompanionClientController: () => CompanionClientController,
  CompanionSettingsSection: () => CompanionSettingsSection,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/CompanionSettingsSection.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var KIND_LABEL = {
  orb: "\u52A8\u6001\u5149\u7403",
  sprite: "\u7CBE\u7075\u52A8\u753B",
  image: "\u56FE\u7247",
  live2d: "Live2D"
};
function CompanionSettingsSection({ controller }) {
  const state = (0, import_react.useSyncExternalStore)(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  (0, import_react.useEffect)(() => {
    void controller.refresh();
  }, [controller]);
  const view = state.view;
  const [draftSizePercent, setDraftSizePercent] = (0, import_react.useState)();
  (0, import_react.useEffect)(() => {
    if (view !== void 0) setDraftSizePercent(view.sizePercent);
  }, [view?.sizePercent]);
  (0, import_react.useEffect)(() => {
    if (view === void 0 || draftSizePercent === void 0 || draftSizePercent === view.sizePercent) return;
    const timer = window.setTimeout(() => {
      void controller.updateSettings({ sizePercent: draftSizePercent });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [controller, draftSizePercent, view?.sizePercent]);
  if (view === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", { "aria-label": "\u684C\u9762\u5BA0\u7269\u8BBE\u7F6E", className: "telosCompanionSettings", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosCompanionEmpty", children: state.error ?? "\u6B63\u5728\u8BFB\u53D6\u684C\u9762\u5BA0\u7269\u72B6\u6001\u2026" }) });
  }
  const customPets = view.pets.filter((pet) => pet.removable);
  const displayedSizePercent = draftSizePercent ?? view.sizePercent;
  const displayedWindowWidth = Math.round(view.windowWidth * displayedSizePercent / view.sizePercent);
  const displayedWindowHeight = Math.round(view.windowHeight * displayedSizePercent / view.sizePercent);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { "aria-label": "\u684C\u9762\u5BA0\u7269\u8BBE\u7F6E", className: "telosCompanionSettings", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "telosCompanionHeader", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "\u684C\u9762\u5BA0\u7269" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u5BA0\u7269\u4E0E Telos \u5171\u7528\u540C\u4E00\u4E2A\u5E94\u7528\u751F\u547D\u5468\u671F\uFF0C\u5E76\u6839\u636E Agent \u5DE5\u4F5C\u72B6\u6001\u5207\u6362\u52A8\u753B\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          "data-primary": !view.visible || void 0,
          disabled: state.loading,
          onClick: () => {
            void controller.updateSettings({ visible: !view.visible });
          },
          type: "button",
          children: view.visible ? "\u9690\u85CF\u5BA0\u7269" : "\u663E\u793A\u5BA0\u7269"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosCompanionStatus", "data-visible": view.visible || void 0, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: view.visible ? "\u5BA0\u7269\u6B63\u5728\u684C\u9762\u663E\u793A" : "\u5BA0\u7269\u5F53\u524D\u5DF2\u9690\u85CF" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: view.connected ? "\u5DF2\u8FDE\u63A5 Agent Runtime\uFF0C\u52A8\u753B\u4F1A\u968F\u4EFB\u52A1\u72B6\u6001\u53D8\u5316\u3002" : "\u6B63\u5728\u7B49\u5F85 Agent Runtime\uFF0C\u5F53\u524D\u4F7F\u7528\u7A7A\u95F2\u52A8\u753B\u3002" })
    ] }),
    state.error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosCompanionBanner", "data-error": true, children: state.error }),
    state.notice === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosCompanionBanner", children: state.notice }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosCompanionCard", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "\u5F53\u524D\u5BA0\u7269" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "\u5207\u6362\u540E\u7ACB\u5373\u751F\u6548" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "select",
          {
            disabled: state.loading,
            onChange: (event) => {
              void controller.updateSettings({ pet: event.target.value });
            },
            value: view.pet,
            children: view.pets.map((pet) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: pet.id, children: [
              pet.label,
              " \xB7 ",
              KIND_LABEL[pet.kind]
            ] }, pet.id))
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "telosCompanionRange", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "\u663E\u793A\u5C3A\u5BF8" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "\u62D6\u52A8\u8C03\u6574\u5BA0\u7269\u5927\u5C0F" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "telosCompanionRangeControl", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              "aria-label": "\u5BA0\u7269\u5927\u5C0F",
              max: view.maxSizePercent,
              min: view.minSizePercent,
              onChange: (event) => setDraftSizePercent(event.currentTarget.valueAsNumber),
              step: view.stepSizePercent,
              type: "range",
              value: displayedSizePercent
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("output", { children: [
            displayedSizePercent,
            "% \xB7 ",
            displayedWindowWidth,
            "\xD7",
            displayedWindowHeight,
            "px"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "telosCompanionSwitch", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "\u9501\u5B9A\u4F4D\u7F6E" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "\u9501\u5B9A\u540E\u4E0D\u518D\u54CD\u5E94\u684C\u9762\u62D6\u62FD" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            checked: view.locked,
            disabled: state.loading,
            onChange: (event) => {
              void controller.updateSettings({ locked: event.target.checked });
            },
            type: "checkbox"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosCompanionImport", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "\u81EA\u5B9A\u4E49\u5BA0\u7269" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u56FE\u7247\u652F\u6301 PNG\u3001APNG\u3001WebP\uFF1BLive2D \u4F7F\u7528\u7ECF\u8FC7\u5B89\u5168\u6821\u9A8C\u7684 ZIP \u6A21\u578B\u5305\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: state.loading, onClick: () => {
          void controller.importPet("image");
        }, type: "button", children: "\u5BFC\u5165\u56FE\u7247\u2026" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: state.loading, onClick: () => {
          void controller.importPet("live2d");
        }, type: "button", children: "\u5BFC\u5165 Live2D\u2026" })
      ] })
    ] }),
    customPets.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosCompanionCustomList", children: customPets.map((pet) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: pet.label }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: KIND_LABEL[pet.kind] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { "data-danger": true, disabled: state.loading, onClick: () => {
        void controller.removePet(pet.id);
      }, type: "button", children: "\u5220\u9664" })
    ] }, pet.id)) })
  ] });
}

// src/client/controller.ts
var CompanionClientController = class {
  constructor(resolveApi) {
    this.resolveApi = resolveApi;
  }
  state = { loading: false };
  listeners = /* @__PURE__ */ new Set();
  unsubscribeDesktop;
  getSnapshot = () => this.state;
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  start() {
    const api = this.resolveApi();
    if (api !== void 0 && this.unsubscribeDesktop === void 0) {
      this.unsubscribeDesktop = api.onSettingsChanged((view) => this.update({ view, loading: false }));
    }
    return () => this.dispose();
  }
  dispose() {
    this.unsubscribeDesktop?.();
    this.unsubscribeDesktop = void 0;
    this.listeners.clear();
  }
  async refresh() {
    await this.run((api) => api.getSettings());
  }
  async updateSettings(patch) {
    await this.run((api) => api.updateSettings(patch));
  }
  async importPet(kind) {
    await this.run((api) => api.importPet(kind), kind === "live2d" ? "Live2D \u5BA0\u7269\u5DF2\u5BFC\u5165" : "\u56FE\u7247\u5BA0\u7269\u5DF2\u5BFC\u5165");
  }
  async removePet(id) {
    await this.run((api) => api.removePet(id), "\u81EA\u5B9A\u4E49\u5BA0\u7269\u5DF2\u5220\u9664");
  }
  async run(operation, notice) {
    const api = this.resolveApi();
    if (api === void 0) {
      this.update({ loading: false, error: "\u684C\u9762\u5BA0\u7269\u8BBE\u7F6E\u4EC5\u5728 Telos \u684C\u9762\u7248\u4E2D\u53EF\u7528\u3002" });
      return;
    }
    this.update({ loading: true, error: void 0, notice: void 0 });
    try {
      const view = await operation(api);
      this.update({ view, loading: false, notice });
    } catch (error) {
      this.update({ loading: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  update(patch) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
};

// src/client/styles.ts
var COMPANION_CLIENT_CSS = `
.telosCompanionSettings{box-sizing:border-box;width:100%;height:100%;overflow:auto;padding:6px 0 36px;color:var(--dsw-alias-label-primary)}
.telosCompanionHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:18px}.telosCompanionHeader h1,.telosCompanionImport h2{margin:0;font-size:18px}.telosCompanionHeader p,.telosCompanionImport p{max-width:680px;margin:6px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6}
.telosCompanionSettings button{min-height:32px;padding:5px 11px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:inherit;cursor:pointer}.telosCompanionSettings button[data-primary]{border-color:transparent;background:var(--dsw-alias-brand-primary);color:#fff}.telosCompanionSettings button[data-danger]{color:var(--dsw-alias-state-error-primary)}.telosCompanionSettings button:disabled{cursor:not-allowed;opacity:.5}
.telosCompanionStatus{display:grid;gap:4px;margin-bottom:14px;padding:14px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}.telosCompanionStatus[data-visible]{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 42%,var(--dsw-alias-border-l1))}.telosCompanionStatus strong{font-size:13px}.telosCompanionStatus span,.telosCompanionCard small,.telosCompanionCustomList small{color:var(--dsw-alias-label-tertiary);font-size:11px}
.telosCompanionBanner{margin-bottom:12px;padding:9px 12px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);font-size:12px}.telosCompanionBanner[data-error]{color:var(--dsw-alias-state-error-primary)}
.telosCompanionCard{display:grid;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}.telosCompanionCard>label{display:grid;grid-template-columns:minmax(180px,1fr) minmax(220px,360px);align-items:center;gap:20px;padding:14px 16px;border-bottom:1px solid var(--dsw-alias-border-l1)}.telosCompanionCard>label:last-child{border-bottom:0}.telosCompanionCard label>span{display:grid;gap:3px}.telosCompanionSettings select{box-sizing:border-box;width:100%;min-height:36px;padding:6px 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit}.telosCompanionSettings select:focus,.telosCompanionSettings button:focus-visible,.telosCompanionRange input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.telosCompanionSwitch input{justify-self:end;width:18px;height:18px;accent-color:var(--dsw-alias-brand-primary)}.telosCompanionRangeControl{grid-template-columns:minmax(140px,1fr) 130px;align-items:center;gap:12px}.telosCompanionRange input{width:100%;height:24px;margin:0;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}.telosCompanionRange output{justify-self:end;color:var(--dsw-alias-label-secondary);font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}
.telosCompanionImport{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-top:24px}.telosCompanionImport>div:last-child{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.telosCompanionCustomList{display:grid;gap:8px;margin-top:14px}.telosCompanionCustomList>div{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px}.telosCompanionCustomList span{display:grid;gap:2px}
.telosCompanionEmpty{padding:18px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1)}
@media(max-width:720px){.telosCompanionHeader,.telosCompanionImport{display:grid}.telosCompanionCard>label{grid-template-columns:1fr}.telosCompanionImport>div:last-child{justify-content:flex-start}}
`;
var STYLE_ID = "telos-companion-client-styles";
function installCompanionStyles() {
  const existing = document.getElementById(STYLE_ID);
  if (existing !== null) return () => void 0;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = COMPANION_CLIENT_CSS;
  document.head.append(style);
  return () => style.remove();
}

// src/client/index.ts
var inject = ["slots"];
function apply(ctx) {
  const controller = new CompanionClientController(() => window.telos?.companion);
  const injected = () => ({ controller });
  ctx.effect(() => controller.start(), "telos-companion: desktop state bridge");
  ctx.effect(() => installCompanionStyles(), "telos-companion: client styles");
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "companion",
    order: 12,
    label: "\u684C\u9762\u5BA0\u7269",
    inject: injected
  }, CompanionSettingsSection));
}

    return module.exports;
  },
});
