// src/contracts.ts
var MCP_MANAGER_RPC_CHANNEL = "/telos-mcp-manager";

// src/manager.ts
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import * as McpClient from "@deepseek-ai/dsh-mcp-client";

// src/store.ts
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
var SERVER_NAME = /^[A-Za-z0-9_-]{1,32}$/;
var BINDING_NAME = /^[^\s=:\u0000-\u001f]+$/;
var CREDENTIAL_REF = /^[A-Za-z_][A-Za-z0-9_]*$/;
function object(value, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}
function text(value, field, allowEmpty = false) {
  if (typeof value !== "string" || !allowEmpty && value.trim() === "") throw new TypeError(`${field} must be a string`);
  return value.trim();
}
function integer(value, field, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${field} must be an integer between ${String(minimum)} and ${String(maximum)}`);
  }
  return value;
}
function binding(value, field) {
  const item = object(value, field);
  const name2 = text(item.name, `${field}.name`);
  const credentialRef2 = text(item.credentialRef, `${field}.credentialRef`);
  if (!BINDING_NAME.test(name2)) throw new TypeError(`${field}.name is invalid`);
  if (!CREDENTIAL_REF.test(credentialRef2)) throw new TypeError(`${field}.credentialRef is invalid`);
  return { name: name2, credentialRef: credentialRef2 };
}
function bindings(value, field) {
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
  const result2 = value.map((item, index) => binding(item, `${field}[${String(index)}]`));
  if (new Set(result2.map((item) => item.name.toLowerCase())).size !== result2.length) throw new TypeError(`${field} contains duplicate names`);
  if (new Set(result2.map((item) => item.credentialRef)).size !== result2.length) throw new TypeError(`${field} contains duplicate credential refs`);
  return result2;
}
function reconnect(value) {
  const input = object(value, "reconnect");
  if (typeof input.enabled !== "boolean") throw new TypeError("reconnect.enabled must be a boolean");
  const initialDelayMs = integer(input.initialDelayMs, "reconnect.initialDelayMs", 1, 2147483647);
  const maxDelayMs = integer(input.maxDelayMs, "reconnect.maxDelayMs", initialDelayMs, 2147483647);
  return {
    enabled: input.enabled,
    initialDelayMs,
    maxDelayMs,
    maxAttempts: integer(input.maxAttempts, "reconnect.maxAttempts", 1, Number.MAX_SAFE_INTEGER)
  };
}
function parseServer(value) {
  const input = object(value, "server");
  const serverName2 = text(input.serverName, "serverName");
  if (!SERVER_NAME.test(serverName2)) throw new TypeError("serverName must match [A-Za-z0-9_-]{1,32}");
  const displayName = text(input.displayName, "displayName");
  if (typeof input.enabled !== "boolean") throw new TypeError("enabled must be a boolean");
  if (input.transport !== "stdio" && input.transport !== "streamable-http") throw new TypeError("transport is invalid");
  const env = bindings(input.env, "env");
  const headers = bindings(input.headers, "headers");
  const common = {
    serverName: serverName2,
    displayName,
    enabled: input.enabled,
    transport: input.transport,
    env,
    headers,
    toolCallTimeoutMs: integer(input.toolCallTimeoutMs, "toolCallTimeoutMs", 1e3, 3e5),
    reconnect: reconnect(input.reconnect)
  };
  if (input.transport === "stdio") {
    if (headers.length > 0) throw new TypeError("stdio servers cannot define headers");
    if (input.args !== void 0 && !Array.isArray(input.args)) throw new TypeError("args must be an array");
    const args = (input.args ?? []).map((entry, index) => text(entry, `args[${String(index)}]`, true));
    const cwd = input.cwd === void 0 ? "" : text(input.cwd, "cwd", true);
    return { ...common, transport: "stdio", command: text(input.command, "command"), args, cwd };
  }
  if (env.length > 0) throw new TypeError("HTTP servers cannot define environment variables");
  const url = text(input.url, "url");
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new TypeError("url must use http or https");
  return { ...common, transport: "streamable-http", url };
}
var McpServerStore = class {
  constructor(path) {
    this.path = path;
  }
  load() {
    let raw;
    try {
      raw = readFileSync(this.path, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
    const document = object(JSON.parse(raw), "document");
    if (document.schemaVersion !== 1 || !Array.isArray(document.servers)) throw new TypeError("unsupported MCP server store schema");
    const servers = document.servers.map(parseServer);
    if (new Set(servers.map((server) => server.serverName)).size !== servers.length) throw new TypeError("MCP server store contains duplicate serverName values");
    return servers;
  }
  save(servers) {
    const validated = servers.map(parseServer);
    if (new Set(validated.map((server) => server.serverName)).size !== validated.length) throw new TypeError("serverName must be unique");
    const document = { schemaVersion: 1, servers: validated };
    mkdirSync(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${String(process.pid)}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(document, null, 2)}
`, { mode: 384 });
    try {
      renameSync(temporary, this.path);
    } catch {
      rmSync(this.path, { force: true });
      renameSync(temporary, this.path);
    }
  }
};

// src/manager.ts
function message(error) {
  return error instanceof Error ? error.message : String(error);
}
function values(value) {
  if (value === void 0) return {};
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("credentialValues must be an object");
  const result2 = {};
  for (const [ref, entry] of Object.entries(value)) {
    credentialRef(ref);
    if (typeof entry !== "string" || entry.length === 0) throw new TypeError(`credentialValues.${ref} must be a non-empty string`);
    result2[ref] = entry;
  }
  return result2;
}
function mutation(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("payload must be an object");
  const input = value;
  return {
    server: parseServer(input.server),
    credentialValues: values(input.credentialValues),
    acknowledgeLocalExecution: input.acknowledgeLocalExecution === true
  };
}
function serverName(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("payload must be an object");
  const name2 = value.serverName;
  if (typeof name2 !== "string" || !/^[A-Za-z0-9_-]{1,32}$/.test(name2)) throw new TypeError("serverName is invalid");
  return name2;
}
function toggleRequest(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("payload must be an object");
  return {
    serverName: serverName(value),
    acknowledgeLocalExecution: value.acknowledgeLocalExecution === true
  };
}
var McpManager = class {
  constructor(ctx, store) {
    this.ctx = ctx;
    this.store = store;
    this.servers = store.load();
    for (const server of this.servers) this.runtime.set(server.serverName, { runtime: server.enabled ? "connecting" : "disabled" });
  }
  servers;
  runtime = /* @__PURE__ */ new Map();
  operation = Promise.resolve();
  closing = false;
  start() {
    for (const server of this.servers) {
      if (server.enabled) void this.serial(() => this.startServer(server.serverName));
    }
  }
  async close() {
    this.closing = true;
    await this.serial(async () => {
      for (const name2 of [...this.runtime.keys()]) await this.stopServer(name2);
    });
  }
  async handle(endpoint, payload) {
    switch (endpoint) {
      case "list":
        return this.serial(() => this.list());
      case "save":
        return this.serial(() => this.save(mutation(payload)));
      case "toggle": {
        const request = toggleRequest(payload);
        return this.serial(() => this.toggle(request.serverName, request.acknowledgeLocalExecution));
      }
      case "reconnect":
        return this.serial(() => this.reconnect(serverName(payload)));
      case "delete":
        return this.serial(() => this.delete(serverName(payload)));
      default:
        throw new TypeError(`unknown MCP manager endpoint: ${endpoint}`);
    }
  }
  serial(operation) {
    const next = this.operation.then(operation, operation);
    this.operation = next.then(() => void 0, () => void 0);
    return next;
  }
  find(name2) {
    const server = this.servers.find((candidate) => candidate.serverName === name2);
    if (server === void 0) throw new TypeError(`unknown MCP server: ${name2}`);
    return server;
  }
  async list() {
    return Promise.all(this.servers.map(async (server) => {
      const state = this.runtime.get(server.serverName) ?? { runtime: "disabled" };
      const prefix = `mcp__${server.serverName}__`;
      const toolNames = this.ctx.tools.schemas().map((schema) => schema.name).filter((name2) => name2.startsWith(prefix)).sort();
      return {
        ...server,
        runtime: server.enabled && toolNames.length > 0 ? "loaded" : state.runtime,
        ...state.error === void 0 ? {} : { error: state.error },
        toolNames,
        env: await this.describeBindings(server.env),
        headers: await this.describeBindings(server.headers)
      };
    }));
  }
  async describeBindings(bindings2) {
    return Promise.all(bindings2.map(async (binding2) => ({
      ...binding2,
      ...await this.ctx.credentials.describe(credentialRef(binding2.credentialRef))
    })));
  }
  async save(input) {
    const existing = this.servers.find((server) => server.serverName === input.server.serverName);
    if (input.server.transport === "stdio" && input.server.enabled && input.acknowledgeLocalExecution !== true) {
      throw new TypeError("enabling a stdio MCP server requires explicit local-execution acknowledgement");
    }
    const allowedRefs = new Set([...input.server.env, ...input.server.headers].map((binding2) => binding2.credentialRef));
    for (const ref of Object.keys(input.credentialValues ?? {})) {
      if (!allowedRefs.has(ref)) throw new TypeError(`credentialValues contains an unrelated reference: ${ref}`);
    }
    for (const [ref, value] of Object.entries(input.credentialValues ?? {})) {
      await this.ctx.credentials.set(credentialRef(ref), value);
    }
    const next = existing === void 0 ? [...this.servers, input.server] : this.servers.map((server) => server.serverName === input.server.serverName ? input.server : server);
    this.store.save(next);
    this.servers = next;
    await this.stopServer(input.server.serverName);
    this.runtime.set(input.server.serverName, { runtime: input.server.enabled ? "connecting" : "disabled" });
    if (input.server.enabled) await this.startServer(input.server.serverName);
    return this.list();
  }
  async toggle(name2, acknowledgeLocalExecution) {
    const current = this.find(name2);
    if (!current.enabled && current.transport === "stdio" && !acknowledgeLocalExecution) {
      throw new TypeError("enabling a stdio MCP server requires explicit local-execution acknowledgement");
    }
    const updated = { ...current, enabled: !current.enabled };
    this.store.save(this.servers.map((server) => server.serverName === name2 ? updated : server));
    this.servers = this.servers.map((server) => server.serverName === name2 ? updated : server);
    if (updated.enabled) await this.startServer(name2);
    else await this.stopServer(name2);
    return this.list();
  }
  async reconnect(name2) {
    const server = this.find(name2);
    if (!server.enabled) throw new TypeError("disabled MCP servers cannot reconnect");
    await this.stopServer(name2);
    await this.startServer(name2);
    return this.list();
  }
  async delete(name2) {
    const server = this.find(name2);
    await this.stopServer(name2);
    for (const binding2 of [...server.env, ...server.headers]) {
      const info = await this.ctx.credentials.describe(credentialRef(binding2.credentialRef));
      if (info.configured && info.writable) await this.ctx.credentials.unset(credentialRef(binding2.credentialRef));
    }
    this.servers = this.servers.filter((candidate) => candidate.serverName !== name2);
    this.store.save(this.servers);
    this.runtime.delete(name2);
    return this.list();
  }
  async resolveBindings(bindings2) {
    const result2 = {};
    for (const binding2 of bindings2) {
      const resolved = await this.ctx.credentials.resolve(credentialRef(binding2.credentialRef));
      if (resolved === void 0) throw new TypeError(`credential ${binding2.credentialRef} is not configured`);
      result2[binding2.name] = resolved.value;
    }
    return result2;
  }
  async startServer(name2) {
    if (this.closing) return;
    const server = this.find(name2);
    if (!server.enabled) {
      this.runtime.set(name2, { runtime: "disabled" });
      return;
    }
    this.runtime.set(name2, { runtime: "connecting" });
    try {
      const common = {
        serverName: server.serverName,
        toolCallTimeoutMs: server.toolCallTimeoutMs,
        failOnStartupError: true,
        reconnect: server.reconnect
      };
      const config = server.transport === "stdio" ? {
        ...common,
        transport: "stdio",
        command: server.command,
        args: server.args ?? [],
        cwd: server.cwd ?? "",
        env: await this.resolveBindings(server.env)
      } : {
        ...common,
        transport: "streamable-http",
        url: server.url,
        headers: await this.resolveBindings(server.headers)
      };
      const fiber = this.ctx.plugin(McpClient, config);
      await fiber;
      this.runtime.set(name2, { fiber, runtime: "loaded" });
    } catch (error) {
      this.runtime.set(name2, { runtime: "error", error: message(error) });
    }
  }
  async stopServer(name2) {
    const state = this.runtime.get(name2);
    if (state?.fiber !== void 0) await state.fiber.dispose();
    this.runtime.set(name2, { runtime: "disabled" });
  }
};

// src/index.ts
var name = "telos-mcp-manager";
var inject = ["connection", "credentials", "tools"];
function result(operation) {
  return Promise.resolve().then(operation).then(
    (value) => ({ ok: true, value }),
    (error) => {
      const message2 = error instanceof Error ? error.message : String(error);
      return error instanceof TypeError || error instanceof RangeError ? { ok: false, error: { code: "bad-request", message: message2, details: { issues: [] } } } : { ok: false, error: { code: "internal", message: message2, details: {} } };
    }
  );
}
function apply(ctx, config) {
  if (typeof config.storePath !== "string" || config.storePath.trim() === "") throw new TypeError("telos-mcp-manager storePath must be a non-empty string");
  const manager = new McpManager(ctx, new McpServerStore(config.storePath));
  ctx.connection.rpc.handle(
    MCP_MANAGER_RPC_CHANNEL,
    (endpoint, payload) => result(() => manager.handle(endpoint, payload)),
    { authority: "loopback" }
  );
  ctx.effect(() => () => manager.close(), "telos-mcp-manager: stop MCP servers");
  manager.start();
}
export {
  MCP_MANAGER_RPC_CHANNEL,
  McpManager,
  McpServerStore,
  apply,
  inject,
  name,
  parseServer
};
