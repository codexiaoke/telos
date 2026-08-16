// src/contracts.ts
var MULTI_ROOT_WORKSPACE_RPC_CHANNEL = "/telos-multi-root-workspace";

// src/service.ts
import { randomUUID } from "node:crypto";
import { realpath, stat } from "node:fs/promises";
import { basename } from "node:path";
var MAX_ROOTS = 32;
function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}
function requiredObject(value, field = "payload") {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}
function aliasBase(path) {
  const value = basename(path).normalize("NFKC").replaceAll(/[^A-Za-z0-9._-]+/gu, "-").replaceAll(/^-+|-+$/gu, "");
  return (value || "root").slice(0, 48);
}
function uniqueAlias(path, roots) {
  const base = aliasBase(path);
  const used = new Set(roots.map((root2) => root2.id.toLocaleLowerCase()));
  if (!used.has(base.toLocaleLowerCase())) return base;
  for (let index = 2; index < 1e4; index++) {
    const candidate = `${base}-${String(index)}`;
    if (!used.has(candidate.toLocaleLowerCase())) return candidate;
  }
  return randomUUID();
}
function uniqueLabel(path, roots) {
  const base = basename(path) || "\u6587\u4EF6\u5939";
  const used = new Set(roots.map((root2) => root2.label.toLocaleLowerCase()));
  if (!used.has(base.toLocaleLowerCase())) return base;
  for (let index = 2; index < 1e4; index++) {
    const candidate = `${base} ${String(index)}`;
    if (!used.has(candidate.toLocaleLowerCase())) return candidate;
  }
  return randomUUID();
}
async function canonicalDirectory(path) {
  const canonical = await realpath(requiredText(path, "path"));
  if (!(await stat(canonical)).isDirectory()) throw new TypeError(`path is not a directory: ${canonical}`);
  return canonical;
}
var WorkspaceGroupService = class {
  constructor(options) {
    this.options = options;
    this.records = options.store.load();
  }
  records;
  list() {
    return this.options.registry.list().map((workspace) => this.ensure(workspace));
  }
  groupForWorkspaceId(workspaceId) {
    const workspace = this.options.registry.get(workspaceId);
    return workspace === void 0 ? void 0 : this.ensure(workspace);
  }
  groupForSession(sessionId2) {
    const workspace = this.options.registry.list().find((candidate) => candidate.sessionIds.some((id) => String(id) === sessionId2));
    return workspace === void 0 ? void 0 : this.ensure(workspace);
  }
  async pickDirectory(signal = new AbortController().signal) {
    const capability = this.options.directoryPicker.capability();
    if (capability.kind !== "native") throw new Error("\u5F53\u524D\u5DE5\u4F5C\u533A\u63D2\u4EF6\u9700\u8981\u672C\u673A\u76EE\u5F55\u9009\u62E9\u5668");
    return capability.pick(signal);
  }
  async create(inputValue) {
    const input = this.parseCreate(inputValue);
    const canonical = [];
    for (const path of input.paths) {
      const resolved = await canonicalDirectory(path);
      if (!canonical.includes(resolved)) canonical.push(resolved);
    }
    if (canonical.length === 0) throw new TypeError("paths must contain at least one directory");
    if (canonical.length > MAX_ROOTS) throw new RangeError(`a workspace supports at most ${String(MAX_ROOTS)} roots`);
    const workspace = await this.options.registry.create(canonical[0]);
    if (input.title !== void 0 && workspace.title !== input.title) await workspace.setTitle(input.title);
    let group = this.ensure(workspace);
    for (const path of canonical.slice(1)) group = await this.addRootInternal(workspace, group, path);
    return { ...group, title: workspace.title };
  }
  async addRoot(payload) {
    const input = requiredObject(payload);
    const workspace = this.requireWorkspace(requiredText(input.workspaceId, "workspaceId"));
    const group = this.ensure(workspace);
    return this.addRootInternal(workspace, group, await canonicalDirectory(requiredText(input.path, "path")), input.label);
  }
  removeRoot(payload) {
    const input = requiredObject(payload);
    const workspace = this.requireWorkspace(requiredText(input.workspaceId, "workspaceId"));
    const rootId = requiredText(input.rootId, "rootId");
    const group = this.ensure(workspace);
    if (rootId === group.primaryRootId) throw new TypeError("the primary workspace root cannot be removed");
    if (!group.roots.some((root2) => root2.id === rootId)) throw new TypeError(`unknown workspace root: ${rootId}`);
    return this.commit(workspace, {
      ...group,
      roots: group.roots.filter((root2) => root2.id !== rootId),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  renameRoot(payload) {
    const input = requiredObject(payload);
    const workspace = this.requireWorkspace(requiredText(input.workspaceId, "workspaceId"));
    const rootId = requiredText(input.rootId, "rootId");
    const label = requiredText(input.label, "label");
    const group = this.ensure(workspace);
    if (!group.roots.some((root2) => root2.id === rootId)) throw new TypeError(`unknown workspace root: ${rootId}`);
    if (group.roots.some((root2) => root2.id !== rootId && root2.label.toLocaleLowerCase() === label.toLocaleLowerCase())) {
      throw new TypeError(`workspace root label already exists: ${label}`);
    }
    return this.commit(workspace, {
      ...group,
      roots: group.roots.map((root2) => root2.id === rootId ? { ...root2, label } : root2),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  handle(endpoint, payload, signal) {
    if (endpoint === "list") return this.list();
    if (endpoint === "get-session") {
      const input = requiredObject(payload);
      const group = this.groupForSession(requiredText(input.sessionId, "sessionId"));
      if (group === void 0) throw new TypeError("session is not attached to a registered workspace");
      return group;
    }
    if (endpoint === "pick-directory") return this.pickDirectory(signal);
    if (endpoint === "create") return this.create(payload);
    if (endpoint === "add-root") return this.addRoot(payload);
    if (endpoint === "remove-root") return this.removeRoot(payload);
    if (endpoint === "rename-root") return this.renameRoot(payload);
    throw new TypeError(`unknown multi-root workspace endpoint: ${endpoint}`);
  }
  ensure(workspace) {
    const workspaceId = String(workspace.id);
    const existing = this.records.find((record2) => record2.workspaceId === workspaceId);
    if (existing !== void 0) {
      const primary = existing.roots.find((root2) => root2.id === existing.primaryRootId);
      if (primary?.path === workspace.path && primary.primary) return this.view(workspace, existing);
    }
    const roots = existing?.roots.filter((root2) => !root2.primary && root2.path !== workspace.path) ?? [];
    const primaryRoot = {
      id: uniqueAlias(workspace.path, roots),
      label: uniqueLabel(workspace.path, roots),
      path: workspace.path,
      primary: true
    };
    const record = {
      workspaceId,
      primaryRootId: primaryRoot.id,
      roots: [primaryRoot, ...roots],
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.upsert(record);
    return this.view(workspace, record);
  }
  async addRootInternal(workspace, group, path, labelValue) {
    if (group.roots.some((root3) => root3.path === path)) return group;
    if (group.roots.length >= MAX_ROOTS) throw new RangeError(`a workspace supports at most ${String(MAX_ROOTS)} roots`);
    const label = labelValue === void 0 ? uniqueLabel(path, group.roots) : requiredText(labelValue, "label");
    if (group.roots.some((root3) => root3.label.toLocaleLowerCase() === label.toLocaleLowerCase())) {
      throw new TypeError(`workspace root label already exists: ${label}`);
    }
    const root2 = { id: uniqueAlias(path, group.roots), label, path, primary: false };
    return this.commit(workspace, { ...group, roots: [...group.roots, root2], updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
  }
  commit(workspace, group) {
    const record = {
      workspaceId: group.workspaceId,
      primaryRootId: group.primaryRootId,
      roots: group.roots,
      updatedAt: group.updatedAt
    };
    this.upsert(record);
    return this.view(workspace, record);
  }
  upsert(record) {
    const index = this.records.findIndex((candidate) => candidate.workspaceId === record.workspaceId);
    this.records = index === -1 ? [...this.records, record] : this.records.map((candidate, position) => position === index ? record : candidate);
    this.options.store.save(this.records);
  }
  view(workspace, record) {
    return { ...record, title: workspace.title, roots: record.roots.map((root2) => ({ ...root2 })) };
  }
  requireWorkspace(workspaceId) {
    const workspace = this.options.registry.get(workspaceId);
    if (workspace === void 0) throw new TypeError(`unknown workspace: ${workspaceId}`);
    return workspace;
  }
  parseCreate(value) {
    const input = requiredObject(value);
    if (!Array.isArray(input.paths)) throw new TypeError("paths must be an array");
    const paths = input.paths.map((path, index) => requiredText(path, `paths[${String(index)}]`));
    const title = input.title === void 0 || input.title === "" ? void 0 : requiredText(input.title, "title");
    return { paths, ...title === void 0 ? {} : { title } };
  }
};

// src/store.ts
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
function object(value, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return value;
}
function text(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}
function root(value, field) {
  const input = object(value, field);
  if (typeof input.primary !== "boolean") throw new TypeError(`${field}.primary must be a boolean`);
  return {
    id: text(input.id, `${field}.id`),
    label: text(input.label, `${field}.label`),
    path: text(input.path, `${field}.path`),
    primary: input.primary
  };
}
function parseWorkspaceGroupRecord(value, field = "workspace") {
  const input = object(value, field);
  if (!Array.isArray(input.roots) || input.roots.length === 0) throw new TypeError(`${field}.roots must be a non-empty array`);
  const roots = input.roots.map((entry, index) => root(entry, `${field}.roots[${String(index)}]`));
  const ids = roots.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) throw new TypeError(`${field}.roots contains duplicate ids`);
  const labels = roots.map((entry) => entry.label.toLocaleLowerCase());
  if (new Set(labels).size !== labels.length) throw new TypeError(`${field}.roots contains duplicate labels`);
  const paths = roots.map((entry) => entry.path);
  if (new Set(paths).size !== paths.length) throw new TypeError(`${field}.roots contains duplicate paths`);
  const primaryRootId = text(input.primaryRootId, `${field}.primaryRootId`);
  if (roots.filter((entry) => entry.primary).length !== 1 || !roots.some((entry) => entry.id === primaryRootId && entry.primary)) {
    throw new TypeError(`${field} must identify exactly one primary root`);
  }
  return {
    workspaceId: text(input.workspaceId, `${field}.workspaceId`),
    primaryRootId,
    roots,
    updatedAt: text(input.updatedAt, `${field}.updatedAt`)
  };
}
var WorkspaceGroupStore = class {
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
    if (document.schemaVersion !== 1 || !Array.isArray(document.workspaces)) {
      throw new TypeError("unsupported multi-root workspace store schema");
    }
    const workspaces = document.workspaces.map((entry, index) => parseWorkspaceGroupRecord(entry, `workspaces[${String(index)}]`));
    if (new Set(workspaces.map((entry) => entry.workspaceId)).size !== workspaces.length) {
      throw new TypeError("multi-root workspace store contains duplicate workspace ids");
    }
    return workspaces;
  }
  save(workspaces) {
    const validated = workspaces.map((entry, index) => parseWorkspaceGroupRecord(entry, `workspaces[${String(index)}]`));
    if (new Set(validated.map((entry) => entry.workspaceId)).size !== validated.length) {
      throw new TypeError("workspaceId must be unique");
    }
    const document = { schemaVersion: 1, workspaces: validated };
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

// src/tools.ts
import { createHash, randomUUID as randomUUID2 } from "node:crypto";
import { mkdir, readFile, readdir, realpath as realpath2, rename, stat as stat2, unlink, writeFile } from "node:fs/promises";
import { basename as basename2, dirname as dirname2, isAbsolute, relative, resolve, sep } from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";
var MAX_READ_BYTES = 256 * 1024;
var MAX_WRITE_BYTES = 2 * 1024 * 1024;
function revisionOf(content) {
  return createHash("sha256").update(content).digest("hex");
}
function inside(root2, target) {
  const path = relative(root2, target);
  return path === "" || !path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path);
}
async function targetFor(root2, pathValue, allowMissing) {
  if (pathValue.trim() === "") throw new TypeError("path must be a non-empty relative path");
  const spelling = resolve(root2.path, pathValue);
  if (!inside(root2.path, spelling)) throw new TypeError("path escapes the selected workspace root");
  if (allowMissing) {
    const parent = await realpath2(dirname2(spelling));
    if (!inside(root2.path, parent)) throw new TypeError("resolved path escapes the selected workspace root");
    return spelling;
  }
  const target = await realpath2(spelling);
  if (!inside(root2.path, target)) throw new TypeError("resolved path escapes the selected workspace root");
  return target;
}
function groupAndRoot(service, sessionId2, rootId) {
  const group = service.groupForSession(sessionId2);
  if (group === void 0) throw new TypeError("session is not attached to a registered workspace");
  const root2 = group.roots.find((candidate) => candidate.id === rootId);
  if (root2 === void 0) throw new TypeError(`unknown workspace root: ${rootId}`);
  return { group, root: root2 };
}
function sessionId(exec) {
  const id = exec.agent?.session.id;
  if (id === void 0) throw new TypeError("multi-root workspace tools require a session");
  return String(id);
}
function applyWorkspaceGroupTools(ctx, service) {
  ctx.systemPrompt.context({
    name: "telos:multi-root-workspace",
    order: 112,
    text: (context) => {
      const id = context.agent?.session.id;
      if (id === void 0) return "";
      const group = service.groupForSession(String(id));
      if (group === void 0 || group.roots.length < 2) return "";
      const roots = group.roots.map((root2) => `- ${root2.id}: ${root2.label} (${root2.path})${root2.primary ? " [primary]" : ""}`).join("\n");
      return `This Telos workspace has multiple authorized roots:
${roots}
Use workspace_list, workspace_read, and workspace_write with root_id for files outside the primary root. Do not guess or traverse outside these roots.`;
    }
  });
  ctx.tools.register(defineTool({
    name: "workspace_list",
    description: "List files and directories inside one authorized root of the current multi-root workspace.",
    parameters: {
      root_id: { type: "string", required: true, description: "Stable root id from the Telos workspace context." },
      path: { type: "string", description: "Relative directory path. Defaults to the root." }
    },
    output: {
      schema: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string", required: true },
            kind: { type: "string", required: true }
          }
        }
      },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }]
    },
    async execute(args, exec) {
      const { root: root2 } = groupAndRoot(service, sessionId(exec), args.root_id);
      const target = args.path === void 0 || args.path === "" ? root2.path : await targetFor(root2, args.path, false);
      if (!(await stat2(target)).isDirectory()) throw new TypeError("path must identify a directory");
      const entries = await readdir(target, { withFileTypes: true });
      return entries.slice(0, 1e3).map((entry) => ({ name: entry.name, kind: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other" }));
    }
  }));
  ctx.tools.register(defineTool({
    name: "workspace_read",
    description: "Read one UTF-8 file from an authorized root of the current multi-root workspace.",
    parameters: {
      root_id: { type: "string", required: true, description: "Stable root id from the Telos workspace context." },
      path: { type: "string", required: true, description: "Relative file path inside the selected root." }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          rootId: { type: "string", required: true },
          path: { type: "string", required: true },
          content: { type: "string", required: true },
          revision: { type: "string", required: true }
        }
      },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }]
    },
    async execute(args, exec) {
      const { root: root2 } = groupAndRoot(service, sessionId(exec), args.root_id);
      const target = await targetFor(root2, args.path, false);
      const metadata = await stat2(target);
      if (!metadata.isFile()) throw new TypeError("path must identify a file");
      if (metadata.size > MAX_READ_BYTES) throw new RangeError(`file exceeds ${String(MAX_READ_BYTES)} byte read limit`);
      const content = await readFile(target);
      if (content.includes(0)) throw new TypeError("binary files cannot be read as text");
      return { rootId: root2.id, path: args.path, content: content.toString("utf8"), revision: revisionOf(content) };
    }
  }));
  ctx.tools.register(defineTool({
    name: "workspace_write",
    description: 'Create or replace one UTF-8 file inside an authorized root. Read existing files first and pass their revision; use expected_revision="new" only for a new path.',
    parameters: {
      root_id: { type: "string", required: true, description: "Stable root id from the Telos workspace context." },
      path: { type: "string", required: true, description: "Relative file path inside the selected root." },
      content: { type: "string", required: true, description: "Complete new UTF-8 file content." },
      expected_revision: { type: "string", required: true, description: 'Revision from workspace_read, or "new" when creating a file.' }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          rootId: { type: "string", required: true },
          path: { type: "string", required: true },
          revision: { type: "string", required: true },
          size: { type: "integer", required: true }
        }
      },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }]
    },
    async execute(args, exec) {
      if (Buffer.byteLength(args.content) > MAX_WRITE_BYTES) throw new RangeError(`content exceeds ${String(MAX_WRITE_BYTES)} byte write limit`);
      const { root: root2 } = groupAndRoot(service, sessionId(exec), args.root_id);
      const target = await targetFor(root2, args.path, args.expected_revision === "new");
      let current;
      try {
        current = await readFile(target);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (args.expected_revision === "new") {
        if (current !== void 0) throw new TypeError("file already exists; read it and pass its revision");
        await mkdir(dirname2(target), { recursive: true });
      } else {
        if (current === void 0) throw new TypeError('file does not exist; use expected_revision="new" to create it');
        if (revisionOf(current) !== args.expected_revision) throw new TypeError("file changed on disk; read it again before writing");
      }
      const temporary = resolve(dirname2(target), `.${basename2(target)}.${randomUUID2()}.telos-tmp`);
      try {
        await writeFile(temporary, args.content);
        await rename(temporary, target);
      } catch (error) {
        try {
          await unlink(temporary);
        } catch {
        }
        throw error;
      }
      const written = Buffer.from(args.content);
      return { rootId: root2.id, path: args.path, revision: revisionOf(written), size: written.byteLength };
    }
  }));
}

// src/index.ts
var name = "telos-multi-root-workspace";
var inject = ["connection", "directoryPicker", "systemPrompt", "tools", "workspaceRegistry"];
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
    throw new TypeError("telos-multi-root-workspace storePath must be a non-empty string");
  }
  const service = new WorkspaceGroupService({
    registry: ctx.workspaceRegistry,
    directoryPicker: ctx.directoryPicker,
    store: new WorkspaceGroupStore(config.storePath)
  });
  ctx.provide("telosWorkspaceGroups", service);
  ctx.connection.rpc.handle(
    MULTI_ROOT_WORKSPACE_RPC_CHANNEL,
    (endpoint, payload, signal) => result(() => service.handle(endpoint, payload, signal)),
    { authority: "loopback" }
  );
  applyWorkspaceGroupTools(ctx, service);
}
export {
  MULTI_ROOT_WORKSPACE_RPC_CHANNEL,
  WorkspaceGroupService,
  WorkspaceGroupStore,
  apply,
  inject,
  name,
  parseWorkspaceGroupRecord
};
