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

// src/store.ts
import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
var ROUTE_TEXT_MAX_LENGTH = 240;
var CLOUD_POLICIES = /* @__PURE__ */ new Set(["ask", "allow-configured", "local-only"]);
function object(value, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}
function boolean(value, field) {
  if (typeof value !== "boolean") throw new TypeError(`${field} must be a boolean`);
  return value;
}
function routeText(value, field) {
  if (typeof value !== "string") throw new TypeError(`${field} must be a string`);
  const trimmed = value.trim();
  const printable = [...trimmed].every((character) => {
    const code = character.charCodeAt(0);
    return code >= 32 && code !== 127;
  });
  if (trimmed.length === 0 || trimmed.length > ROUTE_TEXT_MAX_LENGTH || !printable) {
    throw new TypeError(`${field} must be a non-empty printable string no longer than ${String(ROUTE_TEXT_MAX_LENGTH)} characters`);
  }
  return trimmed;
}
function modelRoute(value, field) {
  const input = object(value, field);
  const provider = routeText(input.provider, `${field}.provider`);
  if (provider === "telos-multimodal") throw new TypeError(`${field}.provider cannot recursively target telos-multimodal`);
  return { provider, model: routeText(input.model, `${field}.model`) };
}
function mainModel(value) {
  const input = object(value, "mainModel");
  if (input.mode === "follow-session") return { mode: "follow-session" };
  if (input.mode !== "fixed") throw new TypeError("mainModel.mode must be follow-session or fixed");
  return { mode: "fixed", route: modelRoute(input.route, "mainModel.route") };
}
function capabilityRoute(value, field) {
  const input = object(value, field);
  if (input.mode === "auto" || input.mode === "disabled") return { mode: input.mode };
  if (input.mode !== "fixed") throw new TypeError(`${field}.mode must be auto, fixed, or disabled`);
  return { mode: "fixed", route: modelRoute(input.route, `${field}.route`) };
}
function defaultMultimodalSettings() {
  return {
    schemaVersion: 1,
    enabled: true,
    mainModel: { mode: "follow-session" },
    routes: Object.fromEntries(MULTIMODAL_CAPABILITIES.map((capability) => [capability, { mode: "auto" }])),
    privacy: { preferLocal: true, cloudMediaPolicy: "ask" }
  };
}
function parseMultimodalSettings(value) {
  const input = object(value, "settings");
  if (input.schemaVersion !== 1) throw new TypeError("unsupported multimodal settings schema");
  const routes = object(input.routes, "routes");
  const privacy = object(input.privacy, "privacy");
  if (!CLOUD_POLICIES.has(privacy.cloudMediaPolicy)) {
    throw new TypeError("privacy.cloudMediaPolicy is invalid");
  }
  return {
    schemaVersion: 1,
    enabled: boolean(input.enabled, "enabled"),
    mainModel: mainModel(input.mainModel),
    routes: Object.fromEntries(MULTIMODAL_CAPABILITIES.map((capability) => [
      capability,
      capabilityRoute(routes[capability], `routes.${capability}`)
    ])),
    privacy: {
      preferLocal: boolean(privacy.preferLocal, "privacy.preferLocal"),
      cloudMediaPolicy: privacy.cloudMediaPolicy
    }
  };
}
var MultimodalSettingsStore = class {
  constructor(path) {
    this.path = path;
  }
  load() {
    let raw;
    try {
      raw = readFileSync(this.path, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return defaultMultimodalSettings();
      throw error;
    }
    return parseMultimodalSettings(JSON.parse(raw));
  }
  save(settings) {
    const validated = parseMultimodalSettings(settings);
    mkdirSync(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${String(process.pid)}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(validated, null, 2)}
`, { mode: 384 });
    try {
      renameSync(temporary, this.path);
    } catch {
      rmSync(this.path, { force: true });
      renameSync(temporary, this.path);
    }
    chmodSync(this.path, 384);
    return validated;
  }
  reset() {
    const settings = defaultMultimodalSettings();
    this.save(settings);
    return settings;
  }
};

// src/service.ts
var IMAGE_CAPABILITIES = /* @__PURE__ */ new Set(["image-understanding", "ocr"]);
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
async function buildModelCatalog(ctx) {
  return Promise.all(ctx.llm.listProviders().map(async (provider) => {
    try {
      const models = await ctx.llm.listModels(provider.id);
      return {
        id: provider.id,
        name: provider.name,
        models: models.map((model) => ({
          provider: provider.id,
          model: model.id,
          name: model.name,
          ...model.description === void 0 ? {} : { description: model.description },
          ...model.inputModalities === void 0 ? {} : { inputModalities: model.inputModalities }
        }))
      };
    } catch (error) {
      return { id: provider.id, name: provider.name, models: [], failure: errorMessage(error) };
    }
  }));
}
function findModel(catalog, route) {
  return catalog.find((group) => group.id === route.provider)?.models.find((model) => model.model === route.model);
}
function fixedStatus(catalog, route, requireImage) {
  const model = findModel(catalog, route);
  if (model === void 0) {
    return { state: "unverified", message: "\u672A\u5728\u5F53\u524D DSH \u6A21\u578B\u76EE\u5F55\u4E2D\u627E\u5230\uFF1B\u8DEF\u7EBF\u5DF2\u4FDD\u5B58\uFF0C\u8FD0\u884C\u65F6\u63A5\u5165\u540E\u4ECD\u9700\u9A8C\u8BC1\u3002" };
  }
  if (requireImage && model.inputModalities !== void 0 && !model.inputModalities.includes("image")) {
    return { state: "incompatible", message: "\u8BE5\u6A21\u578B\u660E\u786E\u58F0\u660E\u4E0D\u652F\u6301\u56FE\u7247\u8F93\u5165\u3002" };
  }
  if (requireImage && model.inputModalities === void 0) {
    return { state: "unverified", message: "\u6A21\u578B\u5B58\u5728\uFF0C\u4F46\u6CA1\u6709\u58F0\u660E\u56FE\u7247\u80FD\u529B\uFF1B\u8FD0\u884C\u65F6\u4E0D\u4F1A\u628A\u5B83\u5F53\u4F5C\u5DF2\u9A8C\u8BC1\u89C6\u89C9\u6A21\u578B\u3002" };
  }
  return { state: "available", message: "\u6A21\u578B\u5DF2\u5728\u5F53\u524D DSH \u76EE\u5F55\u4E2D\u627E\u5230\u3002" };
}
function capabilityStatus(catalog, capability, route) {
  if (route.mode === "disabled") return { state: "disabled", message: "\u6B64\u80FD\u529B\u5DF2\u505C\u7528\u3002" };
  if (route.mode === "auto") return { state: "automatic", message: "\u8FD0\u884C\u65F6\u63A5\u5165\u540E\u6309\u80FD\u529B\u3001\u9690\u79C1\u548C\u53EF\u7528\u6027\u81EA\u52A8\u9009\u62E9\u3002" };
  return fixedStatus(catalog, route.route, IMAGE_CAPABILITIES.has(capability));
}
function buildSettingsView(settings, catalog) {
  const routeStatuses = Object.fromEntries(MULTIMODAL_CAPABILITIES.map((capability) => [
    capability,
    capabilityStatus(catalog, capability, settings.routes[capability])
  ]));
  const mainModelStatus = settings.mainModel.mode === "follow-session" ? { state: "automatic", message: "\u8DDF\u968F\u6BCF\u4E2A\u4F1A\u8BDD\u5F53\u524D\u9009\u62E9\u7684\u4E3B\u6A21\u578B\u3002" } : fixedStatus(catalog, settings.mainModel.route, false);
  return { settings, catalog, mainModelStatus, routeStatuses, runtimePhase: "configuration-only" };
}
var MultimodalSettingsService = class {
  constructor(ctx, store) {
    this.ctx = ctx;
    this.store = store;
  }
  async getView() {
    return buildSettingsView(this.store.load(), await buildModelCatalog(this.ctx));
  }
  async save(value) {
    const settings = this.store.save(parseMultimodalSettings(value));
    return buildSettingsView(settings, await buildModelCatalog(this.ctx));
  }
  async reset() {
    const settings = this.store.reset();
    return buildSettingsView(settings, await buildModelCatalog(this.ctx));
  }
  async handle(endpoint, payload) {
    if (endpoint === "get") return this.getView();
    if (endpoint === "save") return this.save(payload);
    if (endpoint === "reset") return this.reset();
    throw new TypeError(`unknown multimodal endpoint: ${endpoint}`);
  }
};

// src/index.ts
var name = "telos-multimodal";
var inject = ["connection", "llm"];
function result(operation) {
  return Promise.resolve().then(operation).then(
    (value) => ({ ok: true, value }),
    (error) => {
      const message = error instanceof Error ? error.message : String(error);
      return error instanceof TypeError || error instanceof RangeError ? { ok: false, error: { code: "bad-request", message, details: { issues: [] } } } : { ok: false, error: { code: "internal", message, details: {} } };
    }
  );
}
function apply(ctx, config) {
  if (typeof config.storePath !== "string" || config.storePath.trim() === "") {
    throw new TypeError("telos-multimodal storePath must be a non-empty string");
  }
  const service = new MultimodalSettingsService(ctx, new MultimodalSettingsStore(config.storePath));
  ctx.connection.rpc.handle(
    MULTIMODAL_RPC_CHANNEL,
    (endpoint, payload) => result(() => service.handle(endpoint, payload)),
    { authority: "loopback" }
  );
}
export {
  MULTIMODAL_RPC_CHANNEL,
  MultimodalSettingsService,
  MultimodalSettingsStore,
  apply,
  buildModelCatalog,
  buildSettingsView,
  defaultMultimodalSettings,
  inject,
  name,
  parseMultimodalSettings
};
