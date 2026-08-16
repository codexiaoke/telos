// src/contracts.ts
var PERSONALIZATION_RPC_CHANNEL = "/telos-personalization";
var MAX_PERSONAL_INSTRUCTIONS_BYTES = 64 * 1024;
function instructionByteLength(instructions) {
  return Buffer.byteLength(instructions, "utf8");
}
function validatePersonalInstructions(value) {
  if (typeof value !== "string") throw new TypeError("instructions must be a string");
  const bytes = instructionByteLength(value);
  if (bytes > MAX_PERSONAL_INSTRUCTIONS_BYTES) {
    throw new RangeError(`instructions must not exceed ${String(MAX_PERSONAL_INSTRUCTIONS_BYTES)} UTF-8 bytes`);
  }
  return value;
}
function personalizationView(instructions) {
  const validated = validatePersonalInstructions(instructions);
  return {
    instructions: validated,
    configured: validated.trim().length > 0,
    byteLength: instructionByteLength(validated),
    maxBytes: MAX_PERSONAL_INSTRUCTIONS_BYTES
  };
}

// src/service.ts
function object(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("payload must be an object");
  }
  return value;
}
var PersonalizationService = class {
  constructor(store) {
    this.store = store;
  }
  handle(endpoint, payload) {
    if (endpoint === "get") return personalizationView(this.store.load());
    if (endpoint === "save") return personalizationView(this.store.save(object(payload).instructions));
    if (endpoint === "reset") return personalizationView(this.store.reset());
    throw new TypeError(`unsupported personalization endpoint: ${endpoint}`);
  }
};

// src/store.ts
import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
var PersonalInstructionsStore = class {
  constructor(path) {
    this.path = path;
  }
  load() {
    try {
      return validatePersonalInstructions(readFileSync(this.path, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return "";
      throw error;
    }
  }
  save(instructions) {
    const validated = validatePersonalInstructions(instructions);
    mkdirSync(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${String(process.pid)}.tmp`;
    writeFileSync(temporary, validated, { mode: 384 });
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
    return this.save("");
  }
};

// src/index.ts
var name = "telos-personalization";
var inject = ["connection"];
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
  if (typeof config.instructionsPath !== "string" || config.instructionsPath.trim() === "") {
    throw new TypeError("telos-personalization instructionsPath must be a non-empty string");
  }
  const service = new PersonalizationService(new PersonalInstructionsStore(config.instructionsPath));
  ctx.connection.rpc.handle(
    PERSONALIZATION_RPC_CHANNEL,
    (endpoint, payload) => result(() => service.handle(endpoint, payload)),
    { authority: "loopback" }
  );
}
export {
  MAX_PERSONAL_INSTRUCTIONS_BYTES,
  PERSONALIZATION_RPC_CHANNEL,
  PersonalInstructionsStore,
  PersonalizationService,
  apply,
  inject,
  instructionByteLength,
  name,
  personalizationView,
  validatePersonalInstructions
};
