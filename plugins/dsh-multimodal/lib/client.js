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
  MediaProgressController: () => MediaProgressController,
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
  async resolveImageRoute(current, sessionId, imageCount) {
    const payload = { current, sessionId, imageCount };
    const result = await this.rpc.call(MULTIMODAL_RPC_CHANNEL, "resolve-image-route", payload);
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
function notify(conversation, sessions, session, level, message3) {
  const actx = sessions.scope(session.sessionId);
  if (actx !== void 0) conversation.input.for(actx).notify(level, message3);
}
function installImageRouting(ctx, controller, progress) {
  const conversation = ctx.get("conversation");
  const modelDirectories = ctx.get("modelDirectories");
  const sessions = ctx.get("sessions");
  if (conversation === void 0 || modelDirectories === void 0 || sessions === void 0) {
    throw new Error("telos-multimodal: conversation, modelDirectories, and sessions are required");
  }
  const original = conversation.sendSession;
  const routed = async (session, text, imageIds, mode) => {
    if (imageIds.length === 0) {
      progress.clearTerminal(String(session.sessionId));
      return original.call(conversation, session, text, imageIds, mode);
    }
    let operationId;
    try {
      const directory = modelDirectories.directoryFor(session.sessionId);
      const current = (await directory.load()).current;
      const resolution = await controller.resolveImageRoute(current, String(session.sessionId), imageIds.length);
      if (resolution.kind === "bridge") {
        operationId = resolution.operationId;
        progress.track(String(session.sessionId), resolution, imageIds.length);
        await directory.select(resolution.route);
      }
      await original.call(conversation, session, text, imageIds, mode);
    } catch (error) {
      if (operationId !== void 0) await progress.failBeforeRun(String(session.sessionId), operationId, error);
      notify(conversation, sessions, session, "error", errorMessage(error));
      throw error;
    }
  };
  conversation.sendSession = routed;
  return () => {
    if (conversation.sendSession === routed) conversation.sendSession = original;
  };
}

// src/client/MediaProgressDock.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function kindName(kind) {
  if (kind === "video") return "\u89C6\u9891";
  if (kind === "audio") return "\u8BED\u97F3";
  return "\u56FE\u7247";
}
function duration(ms) {
  return ms < 1e3 ? `${ms} ms` : `${(ms / 1e3).toFixed(1)} s`;
}
function primary(progress) {
  const name = kindName(progress.kind);
  if (progress.state === "completed") return `${name}\u8BC6\u522B\u5B8C\u6210`;
  if (progress.state === "failed") return `${name}\u8BC6\u522B\u5931\u8D25`;
  return `\u8BC6\u522B${name}\u4E2D...`;
}
function Detail({ progress }) {
  const route = `${progress.perceptionRoute.provider}/${progress.perceptionRoute.model}`;
  if (progress.state === "failed") {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "telosMmProgressDetail", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: progress.failure?.code ?? "UNKNOWN" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: progress.failure?.message ?? "\u672A\u77E5\u9519\u8BEF" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: duration(progress.elapsedMs) })
    ] });
  }
  if (progress.state === "completed") {
    const usage = progress.usage;
    const processedCount = progress.processedCount ?? progress.count;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "telosMmProgressDetail", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: progress.perceptionName }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: route }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: duration(progress.elapsedMs) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "\u8F93\u5165 ",
        usage?.inputTokens ?? 0
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "\u8F93\u51FA ",
        usage?.outputTokens ?? 0
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "\u7F13\u5B58\u547D\u4E2D ",
        progress.cacheHits,
        "/",
        processedCount
      ] })
    ] });
  }
  const contextCount = progress.processedCount;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "telosMmProgressDetail", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: progress.perceptionName }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: route }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
      "\u672C\u8F6E ",
      progress.count,
      " \u5F20"
    ] }),
    contextCount === void 0 || contextCount === progress.count ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
      "\u4E0A\u4E0B\u6587\u611F\u77E5 ",
      contextCount,
      " \u5F20"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: duration(progress.elapsedMs) })
  ] });
}
function MediaProgressDock({ progressController, session }) {
  const getSnapshot = (0, import_react.useCallback)(() => progressController.snapshot(session.sessionId), [progressController, session.sessionId]);
  const progress = (0, import_react.useSyncExternalStore)(progressController.subscribe, getSnapshot, getSnapshot);
  if (progress === void 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "telosMmProgress", "data-state": progress.state, "data-testid": "telos-media-progress", "aria-live": "polite", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telosMmProgressGlyph", "aria-hidden": true }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "telosMmProgressBody", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: primary(progress) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Detail, { progress })
    ] })
  ] });
}

// src/client/MultimodalSettingsSection.tsx
var import_react2 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
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
  const state = (0, import_react2.useSyncExternalStore)(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [draft, setDraft] = (0, import_react2.useState)();
  const [resetArmed, setResetArmed] = (0, import_react2.useState)(false);
  (0, import_react2.useEffect)(() => {
    void controller.refresh();
  }, [controller]);
  (0, import_react2.useEffect)(() => {
    if (state.view !== void 0) setDraft(state.view.settings);
  }, [state.view]);
  const imageModels = (0, import_react2.useMemo)(() => {
    if (state.view === void 0) return [];
    return state.view.catalog.flatMap((group) => group.models.map((model) => ({ ...model, providerName: group.name })));
  }, [state.view]);
  if (draft === void 0 || state.view === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("section", { "aria-label": "\u591A\u6A21\u6001\u6A21\u578B\u914D\u7F6E", className: "telosMmSettings", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "telosMmLoading", children: state.error ?? "\u6B63\u5728\u8BFB\u53D6\u6A21\u578B\u76EE\u5F55\u2026" }) });
  }
  const view = state.view;
  const selectedMissing = draft.defaultModel !== void 0 && !imageModels.some((model) => routeKey(model) === routeKey(draft.defaultModel));
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { "aria-label": "\u591A\u6A21\u6001\u6A21\u578B\u914D\u7F6E", className: "telosMmSettings", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("header", { className: "telosMmHeader", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h1", { children: "\u9ED8\u8BA4\u591A\u6A21\u6001\u6A21\u578B" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: "\u5F53\u524D\u4F1A\u8BDD\u6A21\u578B\u770B\u4E0D\u61C2\u56FE\u7247\u65F6\uFF0C\u7531\u8FD9\u91CC\u7684\u6A21\u578B\u5148\u5B8C\u6210\u89C6\u89C9\u7406\u89E3\uFF1B\u6700\u7EC8\u56DE\u7B54\u3001\u63A8\u7406\u548C\u5DE5\u5177\u8C03\u7528\u4ECD\u7531\u5F53\u524D\u4F1A\u8BDD\u6A21\u578B\u8D1F\u8D23\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "telosMmActions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { disabled: state.loading, onClick: () => {
          void controller.refresh();
        }, type: "button", children: "\u5237\u65B0\u76EE\u5F55" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { "data-primary": true, disabled: state.loading, onClick: () => {
          void controller.save(draft);
        }, type: "button", children: "\u4FDD\u5B58" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "telosMmPhase", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: "\u56FE\u7247\u8DEF\u7531\u5DF2\u542F\u7528" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u539F\u751F\u56FE\u7247\u6A21\u578B\u76F4\u63A5\u5904\u7406\uFF1B\u6587\u672C\u6A21\u578B\u901A\u8FC7 Telos \u903B\u8F91\u8DEF\u7531\u4F7F\u7528\u9ED8\u8BA4\u591A\u6A21\u6001\u6A21\u578B\uFF0C\u4E0D\u7ECF\u8FC7 MCP\u3002" })
    ] }),
    state.error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "telosMmBanner", "data-error": true, children: state.error }),
    state.notice === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "telosMmBanner", children: state.notice }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "telosMmMaster", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: "\u81EA\u52A8\u8865\u8DB3\u56FE\u7247\u80FD\u529B" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("small", { children: "\u5173\u95ED\u540E\uFF0C\u5F53\u524D\u6A21\u578B\u4E0D\u652F\u6301\u56FE\u7247\u65F6\u76F4\u63A5\u4F7F\u7528 DSH \u539F\u751F\u9519\u8BEF\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { checked: draft.enabled, onChange: (event) => setDraft({ ...draft, enabled: event.target.checked }), type: "checkbox" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "telosMmSectionTitle", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { children: "\u6A21\u578B" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: "API \u5730\u5740\u4E0E\u5BC6\u94A5\u7EE7\u7EED\u5728\u201C\u6A21\u578B\u201D\u8BBE\u7F6E\u4E2D\u914D\u7F6E\uFF0C\u672C\u9875\u53EA\u4FDD\u5B58 Provider \u4E0E\u6A21\u578B ID\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("article", { className: "telosMmModelCard", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { children: [
        "\u9ED8\u8BA4\u591A\u6A21\u6001\u6A21\u578B",
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("select", { onChange: (event) => setDraft({ ...draft, defaultModel: parseRouteValue(event.target.value) }), value: routeValue(draft.defaultModel), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "", children: "\u672A\u914D\u7F6E" }),
          selectedMissing && draft.defaultModel !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("option", { value: routeValue(draft.defaultModel), children: [
            draft.defaultModel.provider,
            " \xB7 ",
            draft.defaultModel.model,
            "\uFF08\u5F85\u9A8C\u8BC1\uFF09"
          ] }) : null,
          view.catalog.map((group) => {
            const models = imageModels.filter((model) => model.provider === group.id);
            return models.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("optgroup", { label: group.name, children: models.map((model) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("option", { value: routeValue(model), children: [
              model.name,
              model.inputModalities?.includes("image") ? "" : "\uFF08\u4FDD\u5B58\u65F6\u58F0\u660E\u56FE\u7247\u80FD\u529B\uFF09"
            ] }, routeKey(model))) }, group.id);
          })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "telosMmStatus", "data-status": view.defaultModelStatus.state, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: statusLabel(view.defaultModelStatus) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: view.defaultModelStatus.message })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: "\u9009\u62E9\u5C1A\u672A\u58F0\u660E\u56FE\u7247\u80FD\u529B\u7684\u81EA\u5B9A\u4E49 OpenAI \u517C\u5BB9\u6A21\u578B\u65F6\uFF0C\u4FDD\u5B58\u4F1A\u901A\u8FC7 DSH Settings API \u5C06\u8BE5\u6A21\u578B\u58F0\u660E\u4E3A text + image\uFF1B\u4E0D\u76F4\u63A5\u6539\u5199\u914D\u7F6E\u6587\u4EF6\u3002\u82E5\u58F0\u660E\u6216\u8DEF\u7531\u5931\u8D25\uFF0C\u56FE\u7247\u4E0D\u4F1A\u63D0\u4EA4\u5230 Session\uFF0C\u8F93\u5165\u6587\u5B57\u548C\u56FE\u7247\u8349\u7A3F\u90FD\u4F1A\u4FDD\u7559\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "telosMmFlow", "aria-label": "\u56FE\u7247\u5904\u7406\u6D41\u7A0B", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u539F\u59CB\u56FE\u7247\u4FDD\u5B58\u5230 DSH Session" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("i", { children: "\u2192" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u9ED8\u8BA4\u6A21\u578B\u751F\u6210\u89C6\u89C9\u89C2\u5BDF" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("i", { children: "\u2192" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u5F53\u524D\u6A21\u578B\u56DE\u7B54\u4E0E\u8C03\u7528\u5DE5\u5177" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("footer", { className: "telosMmFooter", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: "\u914D\u7F6E\u6309\u5F53\u524D\u8BBE\u5907\u7684\u672C\u5730\u7528\u6237\u4FDD\u5B58\uFF0C\u4E0D\u968F\u5DE5\u4F5C\u533A\u5207\u6362\uFF1BAPI Key \u4E0D\u4F1A\u5199\u5165\u591A\u6A21\u6001\u914D\u7F6E\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { "data-danger": true, disabled: state.loading, onClick: () => {
        if (!resetArmed) setResetArmed(true);
        else {
          setResetArmed(false);
          void controller.reset();
        }
      }, type: "button", children: resetArmed ? "\u518D\u6B21\u786E\u8BA4\u6062\u590D\u9ED8\u8BA4" : "\u6062\u590D\u9ED8\u8BA4" })
    ] })
  ] });
}

// src/client/progress-controller.ts
var POLL_INTERVAL_MS = 400;
function message2(error) {
  return error instanceof Error ? error.message : String(error);
}
var MediaProgressController = class {
  constructor(rpc) {
    this.rpc = rpc;
  }
  sessions = /* @__PURE__ */ new Map();
  timers = /* @__PURE__ */ new Map();
  listeners = /* @__PURE__ */ new Set();
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  snapshot(sessionId) {
    return this.sessions.get(sessionId);
  }
  track(sessionId, route, count) {
    const previous = this.sessions.get(sessionId);
    if (previous !== void 0) this.stop(previous.operationId);
    const createdAt = Date.now();
    this.sessions.set(sessionId, {
      operationId: route.operationId,
      sessionId,
      kind: "image",
      count,
      state: "queued",
      perceptionRoute: route.perceptionRoute,
      perceptionName: route.perceptionName,
      createdAt,
      elapsedMs: 0,
      cacheHits: 0
    });
    this.emit();
    void this.poll(sessionId, route.operationId);
  }
  clearTerminal(sessionId) {
    const current = this.sessions.get(sessionId);
    if (current === void 0 || current.state === "queued" || current.state === "running") return;
    this.sessions.delete(sessionId);
    this.emit();
  }
  async failBeforeRun(sessionId, operationId, error) {
    this.stop(operationId);
    const current = this.sessions.get(sessionId);
    if (current?.operationId === operationId) {
      const finishedAt = Date.now();
      this.sessions.set(sessionId, {
        ...current,
        state: "failed",
        finishedAt,
        elapsedMs: Math.max(0, finishedAt - current.createdAt),
        failure: { code: "SEND_REJECTED", message: message2(error) }
      });
      this.emit();
    }
    await this.rpc.call(MULTIMODAL_RPC_CHANNEL, "cancel-media-progress", { operationId }).catch(() => void 0);
  }
  dispose() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.listeners.clear();
  }
  async poll(sessionId, operationId) {
    try {
      const result = await this.rpc.call(MULTIMODAL_RPC_CHANNEL, "media-progress", { operationId });
      if (!result.ok) throw new Error(result.error.message);
      const progress = result.value;
      if (progress !== void 0 && this.sessions.get(sessionId)?.operationId === operationId) {
        this.sessions.set(sessionId, progress);
        this.emit();
        if (progress.state === "completed" || progress.state === "failed") {
          this.stop(operationId);
          return;
        }
      }
    } catch {
    }
    if (this.sessions.get(sessionId)?.operationId !== operationId) return;
    const timer = setTimeout(() => {
      void this.poll(sessionId, operationId);
    }, POLL_INTERVAL_MS);
    this.timers.set(operationId, timer);
  }
  stop(operationId) {
    const timer = this.timers.get(operationId);
    if (timer !== void 0) clearTimeout(timer);
    this.timers.delete(operationId);
  }
  emit() {
    for (const listener of this.listeners) listener();
  }
};

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
.telosMmProgress{box-sizing:border-box;display:flex;align-items:flex-start;gap:10px;width:100%;padding:11px 13px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 4px 18px rgba(0,0,0,.04);color:var(--dsw-alias-label-secondary)}
.telosMmProgressGlyph{flex:none;width:13px;height:13px;margin-top:2px;border:1.5px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 28%,transparent);border-top-color:var(--dsw-alias-brand-primary);border-radius:50%;animation:telosMmSpin .8s linear infinite}.telosMmProgress[data-state=completed] .telosMmProgressGlyph{border-color:var(--dsw-alias-state-success-primary);animation:none}.telosMmProgress[data-state=failed] .telosMmProgressGlyph{border-color:var(--dsw-alias-state-error-primary);animation:none}
.telosMmProgressBody{display:grid;min-width:0;gap:5px}.telosMmProgressBody>strong{color:var(--dsw-alias-label-primary);font-size:12px;font-weight:600}.telosMmProgress[data-state=failed] .telosMmProgressBody>strong{color:var(--dsw-alias-state-error-primary)}.telosMmProgressDetail{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:1.45}.telosMmProgressDetail code{max-width:320px;overflow:hidden;text-overflow:ellipsis;padding:1px 5px;border-radius:5px;background:var(--dsw-alias-bg-layer-2);color:inherit;font:inherit;white-space:nowrap}
@keyframes telosMmSpin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.telosMmProgressGlyph{animation:none}}
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
  const progressController = new MediaProgressController(ctx.connection.rpc);
  const injected = () => ({ controller });
  const progressInjected = () => ({ progressController });
  ctx.effect(() => installMultimodalStyles(), "telos-multimodal: client styles");
  ctx.effect(() => installImageRouting(ctx, controller, progressController), "telos-multimodal: image routing");
  ctx.effect(() => () => {
    progressController.dispose();
  }, "telos-multimodal: progress controller");
  ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
    name: "conversation.input.dock",
    id: "telos-multimodal-progress",
    order: 10,
    inject: progressInjected
  }, MediaProgressDock));
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
