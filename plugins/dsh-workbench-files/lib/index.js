// src/contracts.ts
var WORKBENCH_FILES_RPC_CHANNEL = "/telos-workbench-files";

// src/service.ts
import { copyFile, readFile, readdir, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";
var DEFAULT_MAX_ENTRIES = 1e3;
var DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024;
function requiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${field} must be a non-empty string`);
  return value;
}
function isInside(root, target) {
  const rel = relative(root, target);
  return rel === "" || !rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel);
}
function toWorkspacePath(root, target) {
  return relative(root, target).split(sep).join("/");
}
function revisionOf(content) {
  return createHash("sha256").update(content).digest("hex");
}
function errorCode(error) {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : void 0;
}
var WorkspaceFileService = class {
  constructor(options) {
    this.options = options;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  }
  maxEntries;
  maxFileBytes;
  async list(payload) {
    const request = this.parsePathRequest(payload);
    const { root, target } = await this.resolveExisting(request.sessionId, request.path);
    const targetStat = await stat(target);
    if (!targetStat.isDirectory()) throw new TypeError("path must identify a directory");
    const rows = await readdir(target, { withFileTypes: true });
    const entries = [];
    for (const row of rows) {
      if (entries.length >= this.maxEntries) break;
      const candidate = resolve(target, row.name);
      let resolved;
      try {
        resolved = await realpath(candidate);
      } catch {
        continue;
      }
      if (!isInside(root, resolved)) continue;
      let kind;
      if (row.isDirectory()) kind = "directory";
      else if (row.isFile()) kind = "file";
      else if (row.isSymbolicLink()) {
        const linked = await stat(resolved);
        if (linked.isDirectory()) kind = "directory";
        else if (linked.isFile()) kind = "file";
        else continue;
      } else continue;
      entries.push({ name: row.name, path: toWorkspacePath(root, resolved), kind, hidden: row.name.startsWith(".") });
    }
    entries.sort((left, right) => left.kind === right.kind ? left.name.localeCompare(right.name) : left.kind === "directory" ? -1 : 1);
    return { path: toWorkspacePath(root, target), entries, truncated: rows.length > this.maxEntries };
  }
  async read(payload) {
    const request = this.parsePathRequest(payload);
    const { root, target } = await this.resolveExisting(request.sessionId, request.path);
    const metadata = await stat(target);
    if (!metadata.isFile()) throw new TypeError("path must identify a file");
    if (metadata.size > this.maxFileBytes) throw Object.assign(new Error("file exceeds the workbench preview limit"), { code: "file-too-large" });
    const buffer = await readFile(target);
    if (buffer.includes(0)) throw Object.assign(new Error("binary files cannot be opened in the text editor"), { code: "binary-file" });
    return {
      path: toWorkspacePath(root, target),
      content: buffer.toString("utf8"),
      revision: revisionOf(buffer),
      mtimeMs: metadata.mtimeMs,
      size: metadata.size
    };
  }
  async write(payload) {
    if (typeof payload !== "object" || payload === null) throw new TypeError("payload must be an object");
    const input = payload;
    const sessionId = requiredString(input.sessionId, "sessionId");
    const path = requiredString(input.path, "path");
    if (typeof input.content !== "string") throw new TypeError("content must be a string");
    const expectedRevision = requiredString(input.expectedRevision, "expectedRevision");
    const bytes = Buffer.byteLength(input.content);
    if (bytes > this.maxFileBytes) throw Object.assign(new Error("file exceeds the workbench save limit"), { code: "file-too-large" });
    const { target } = await this.resolveExisting(sessionId, path);
    const metadata = await stat(target);
    if (!metadata.isFile()) throw new TypeError("path must identify a file");
    const current = await readFile(target);
    if (revisionOf(current) !== expectedRevision) {
      throw Object.assign(new Error("file changed on disk; reopen it before saving"), { code: "conflict" });
    }
    const temporary = resolve(dirname(target), `.${basename(target)}.${randomUUID()}.telos-tmp`);
    try {
      await writeFile(temporary, input.content, { mode: metadata.mode });
      try {
        await rename(temporary, target);
      } catch (error) {
        if (errorCode(error) !== "EEXIST" && errorCode(error) !== "EPERM") throw error;
        const latest = await readFile(target);
        if (revisionOf(latest) !== expectedRevision) {
          throw Object.assign(new Error("file changed on disk; reopen it before saving"), { code: "conflict" });
        }
        await copyFile(temporary, target);
        await unlink(temporary);
      }
    } catch (error) {
      try {
        await unlink(temporary);
      } catch {
      }
      throw error;
    }
    return this.read({ sessionId, path });
  }
  parsePathRequest(payload) {
    if (typeof payload !== "object" || payload === null) throw new TypeError("payload must be an object");
    const input = payload;
    const sessionId = requiredString(input.sessionId, "sessionId");
    const path = input.path === void 0 ? "" : typeof input.path === "string" ? input.path : requiredString(input.path, "path");
    return { sessionId, path };
  }
  async resolveExisting(sessionId, workspacePath) {
    const configuredRoot = this.options.rootForSession(sessionId);
    if (configuredRoot === void 0) throw Object.assign(new Error("session is not attached to a registered workspace"), { code: "workspace-unavailable" });
    const root = await realpath(configuredRoot);
    const targetSpelling = resolve(root, workspacePath);
    if (!isInside(root, targetSpelling)) throw Object.assign(new Error("path escapes the current workspace"), { code: "path-forbidden" });
    const target = await realpath(targetSpelling);
    if (!isInside(root, target)) throw Object.assign(new Error("resolved path escapes the current workspace"), { code: "path-forbidden" });
    return { root, target };
  }
};

// src/index.ts
var name = "telos-workbench-files";
var inject = ["connection", "workspaceRegistry"];
function workspaceFor(ctx, sessionId) {
  return ctx.workspaceRegistry.list().find((workspace) => workspace.sessionIds.some((id) => String(id) === sessionId));
}
function result(operation) {
  return Promise.resolve().then(operation).then(
    (value) => ({ ok: true, value }),
    (error) => {
      const message = error instanceof Error ? error.message : String(error);
      return error instanceof TypeError ? { ok: false, error: { code: "bad-request", message, details: { issues: [] } } } : { ok: false, error: { code: "internal", message, details: {} } };
    }
  );
}
function apply(ctx) {
  const service = new WorkspaceFileService({
    rootForSession: (sessionId) => workspaceFor(ctx, sessionId)?.path
  });
  ctx.connection.rpc.handle(
    WORKBENCH_FILES_RPC_CHANNEL,
    (endpoint, payload) => {
      if (endpoint === "list") return result(() => service.list(payload));
      if (endpoint === "read") return result(() => service.read(payload));
      if (endpoint === "write") return result(() => service.write(payload));
      return result(() => {
        throw new TypeError(`unknown workbench-files endpoint: ${endpoint}`);
      });
    },
    { authority: "loopback" }
  );
}
export {
  WORKBENCH_FILES_RPC_CHANNEL,
  WorkspaceFileService,
  apply,
  inject,
  name
};
