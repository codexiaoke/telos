// src/errors.ts
var ComputerUseError = class extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.code = code;
    this.name = "ComputerUseError";
  }
};
function computerUseError(error, fallback) {
  if (error instanceof ComputerUseError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new ComputerUseError("COMPUTER_PROVIDER_FAILURE", `${fallback}: ${message}`, { cause: error });
}

// src/config.ts
function integer(name2, value, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", `${name2} must be an integer between ${String(min)} and ${String(max)}`);
  }
  return value;
}
function option(name2, value, allowed) {
  if (!allowed.includes(value)) {
    throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", `${name2} must be one of ${allowed.join(", ")}`);
  }
  return value;
}
function resolveConfig(config = {}) {
  const observationTtl = config.observationTtlMs ?? 0;
  const observationTtlMs = observationTtl === 0 ? 0 : integer("observationTtlMs", observationTtl, 1e3, 864e5);
  const confirmationTtlMs = integer("confirmationTtlMs", config.confirmationTtlMs ?? 3e5, 1e3, 9e5);
  const actionTimeoutMs = integer("actionTimeoutMs", config.actionTimeoutMs ?? 15e3, 1e3, 12e4);
  const settleMs = integer("settleMs", config.settleMs ?? 250, 0, 1e4);
  const maxSettleMs = integer("maxSettleMs", config.maxSettleMs ?? 5e3, 100, 6e4);
  if (settleMs > maxSettleMs) {
    throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", "settleMs must be no greater than maxSettleMs");
  }
  const maxNodes = integer("maxNodes", config.maxNodes ?? 500, 10, 5e3);
  const maxDepth = integer("maxDepth", config.maxDepth ?? 14, 1, 64);
  const maxTextBytes = integer("maxTextBytes", config.maxTextBytes ?? 64e3, 1024, 1048576);
  const maxScreenshotBytes = integer("maxScreenshotBytes", config.maxScreenshotBytes ?? 33554432, 1024, 268435456);
  const maxComputerUseSteps = integer("maxComputerUseSteps", config.maxComputerUseSteps ?? 12, 1, 50);
  const maxActionsPerStep = integer("maxActionsPerStep", config.maxActionsPerStep ?? 8, 1, 20);
  const artifactRoot = (config.artifactRoot ?? ".dsh-computer-use/artifacts").trim();
  if (artifactRoot.length === 0 || artifactRoot.startsWith("/") || artifactRoot.split(/[\\/]+/u).includes("..")) {
    throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", "artifactRoot must be a non-empty workspace-relative path without ..");
  }
  const helperPath = config.helper?.path?.trim();
  if (helperPath !== void 0 && helperPath.length === 0) {
    throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", "helper.path must not be empty");
  }
  const focusPolicy = option("interaction.focusPolicy", config.interaction?.focusPolicy ?? "preserve", ["preserve", "activate"]);
  const keyboardPolicy = option("interaction.keyboardPolicy", config.interaction?.keyboardPolicy ?? "preserve", ["preserve", "activate"]);
  const pointerInputPolicy = option("interaction.pointerInputPolicy", config.interaction?.pointerInputPolicy ?? "targeted", ["deny", "targeted"]);
  const cursorVisualization = option("interaction.cursorVisualization", config.interaction?.cursorVisualization ?? "visible", ["hidden", "visible"]);
  const cursorMotionMs = integer("interaction.cursorMotionMs", config.interaction?.cursorMotionMs ?? 180, 0, 2e3);
  const cursorAutoHideMs = integer("interaction.cursorAutoHideMs", config.interaction?.cursorAutoHideMs ?? 0, 0, 3e4);
  const allowAllApps = config.allowAllApps ?? false;
  const seen = /* @__PURE__ */ new Set();
  const grants = (config.grants ?? []).map((grant) => {
    const bundleId = grant.bundleId.trim();
    if (bundleId.length === 0 || bundleId === "*" || bundleId.includes("*")) {
      throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", "grants[].bundleId must be one exact non-wildcard bundle id");
    }
    if (seen.has(bundleId)) {
      throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", `duplicate app grant for ${bundleId}`);
    }
    seen.add(bundleId);
    const control = grant.control ?? false;
    return { bundleId, read: (grant.read ?? false) || control, control };
  });
  return {
    observationTtlMs,
    confirmationTtlMs,
    actionTimeoutMs,
    settleMs,
    maxSettleMs,
    maxNodes,
    maxDepth,
    maxTextBytes,
    maxScreenshotBytes,
    maxComputerUseSteps,
    maxActionsPerStep,
    artifactRoot,
    helper: {
      ...helperPath === void 0 ? {} : { path: helperPath },
      allowSourceBuild: config.helper?.allowSourceBuild ?? false
    },
    interaction: {
      focusPolicy,
      keyboardPolicy,
      pointerInputPolicy,
      cursorVisualization,
      cursorMotionMs,
      cursorAutoHideMs
    },
    allowAllApps,
    grants
  };
}

// src/providers/macos.ts
import { setTimeout as delay } from "node:timers/promises";

// src/native-helper.ts
import { createHash } from "node:crypto";
import { access, chmod, lstat, readFile, realpath, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
var CURSOR_READY_TIMEOUT_MS = 2e3;
var CURSOR_PROTOCOL_MAX_BYTES = 64 * 1024;
function collected(reader) {
  if (reader === void 0) return "";
  const value = reader.readFrom(0);
  if (value.lossy) throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", "native helper output exceeded its protocol limit");
  return value.text;
}
async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}
function nativeRoot() {
  return fileURLToPath(new URL("../native/macos/", import.meta.url));
}
var NativeHelperClient = class {
  constructor(ctx, config, managedRoot = nativeRoot()) {
    this.ctx = ctx;
    this.config = config;
    this.managedRoot = managedRoot;
  }
  prepared;
  cursor;
  cursorStart;
  /** Absolute executable path selected by explicit override or the packaged managed binary. */
  get helperPath() {
    return this.prepared?.path ?? this.config.helper.path ?? resolve(this.managedRoot, "bin", "dsh-computer-use-helper");
  }
  /** Verify platform, file type, packaged hash, and executable mode before use. */
  async prepare(signal) {
    if (process.platform !== "darwin") {
      throw new ComputerUseError("COMPUTER_UNSUPPORTED_PLATFORM", `macOS provider cannot run on ${process.platform}`);
    }
    const managed = this.config.helper.path === void 0;
    let path = this.helperPath;
    let selectedInfo;
    try {
      selectedInfo = await lstat(path);
    } catch (error) {
      const missing = error.code === "ENOENT";
      if (!managed || !missing || !this.config.helper.allowSourceBuild) {
        throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", `native helper is missing or unreadable: ${path}`, { cause: error });
      }
      await this.buildManaged(signal);
      selectedInfo = await lstat(path);
    }
    if (!selectedInfo.isFile() || selectedInfo.isSymbolicLink()) {
      throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", "native helper must be a regular non-symbolic-link executable");
    }
    path = await realpath(path);
    const digest = await sha256(path);
    let version = "external";
    if (managed) {
      const manifestPath = resolve(this.managedRoot, "manifest.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      if (manifest.schemaVersion !== 1 || manifest.binary.path !== "bin/dsh-computer-use-helper") {
        throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", "native helper manifest is malformed");
      }
      if (manifest.binary.sha256 !== digest) {
        throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", "native helper hash does not match native/macos/manifest.json");
      }
      version = manifest.helperVersion;
    }
    try {
      await access(path, constants.X_OK);
    } catch (error) {
      if (!managed) {
        throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", `external native helper is not executable: ${path}`, { cause: error });
      }
      try {
        await chmod(path, selectedInfo.mode & 511 | 64);
        await access(path, constants.X_OK);
      } catch (chmodError) {
        throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", `managed native helper cannot be marked executable: ${path}`, { cause: chmodError });
      }
    }
    this.prepared = { path, version, sha256: digest };
    return this.prepared;
  }
  /** Invoke one fixed helper command and parse its bounded JSON envelope. */
  async invoke(request, signal) {
    const prepared = this.prepared ?? await this.prepare(signal);
    const timeout = AbortSignal.timeout(this.config.actionTimeoutMs);
    const combined = AbortSignal.any([signal, timeout]);
    const handle = this.ctx.subprocess.spawn({
      argv: [prepared.path],
      cwd: dirname(prepared.path),
      stdio: {
        stdin: { data: `${JSON.stringify({ protocolVersion: 1, ...request })}
` },
        stdout: { maxBytes: 4 * 1024 * 1024 },
        stderr: { maxBytes: 64 * 1024 }
      },
      graceMs: 1e3,
      signal: combined,
      env: {
        LANG: process.env.LANG ?? "en_US.UTF-8",
        LC_ALL: process.env.LC_ALL ?? "en_US.UTF-8"
      }
    });
    let outcome;
    try {
      outcome = await handle.done;
    } catch (error) {
      throw computerUseError(error, "native helper failed to start");
    }
    if (combined.aborted) {
      if (signal.aborted) throw new ComputerUseError("COMPUTER_CANCELLED", "native helper call was cancelled");
      throw new ComputerUseError("COMPUTER_TIMEOUT", `native helper exceeded ${this.config.actionTimeoutMs} milliseconds`);
    }
    const stdout = collected(handle.collected.stdout);
    const stderr = collected(handle.collected.stderr);
    if (outcome.exitCode !== 0 && stdout.trim().length === 0) {
      throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", `native helper exited ${String(outcome.exitCode)}${stderr.trim().length === 0 ? "" : `: ${stderr.trim().slice(0, 1e3)}`}`);
    }
    let envelope;
    try {
      envelope = JSON.parse(stdout);
    } catch (error) {
      throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", "native helper returned invalid JSON", { cause: error });
    }
    if (envelope.ok !== true) throw new ComputerUseError(envelope.error.code, envelope.error.message.slice(0, 1e3));
    return envelope.value;
  }
  /** Send one best-effort command to the persistent, click-through Agent cursor overlay. */
  async cursorCommand(command, signal) {
    const prepared = this.prepared ?? await this.prepare(signal);
    const cursor = await this.getCursor(prepared, signal);
    signal.throwIfAborted();
    try {
      await new Promise((resolveWrite, rejectWrite) => {
        cursor.stdin.write(`${JSON.stringify(command)}
`, (error) => {
          if (error === void 0 || error === null) resolveWrite();
          else rejectWrite(error);
        });
      });
    } catch (error) {
      if (this.cursor === cursor) this.cursor = void 0;
      cursor.terminate();
      throw computerUseError(error, "native cursor overlay command failed");
    }
  }
  /** Stop the cursor process and release prepared generation state. */
  async dispose() {
    const cursor = this.cursor ?? await this.cursorStart?.promise.catch(() => void 0);
    this.cursorStart = void 0;
    this.cursor = void 0;
    this.prepared = void 0;
    if (cursor === void 0) return;
    try {
      cursor.stdin.end(`${JSON.stringify({ op: "stop" })}
`);
    } catch {
    }
    if (await cursor.waitForExit(AbortSignal.timeout(1e3))) return;
    cursor.terminate();
    await cursor.waitForExit();
  }
  /** Prepared integrity facts used by provider health. */
  preparedInfo() {
    if (this.prepared === void 0) throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", "native helper is not prepared");
    return this.prepared;
  }
  async getCursor(prepared, signal) {
    signal.throwIfAborted();
    if (this.cursor !== void 0) return this.cursor;
    if (this.cursorStart === void 0) {
      const start = { promise: Promise.resolve(void 0) };
      start.promise = this.spawnCursor(prepared).then((cursor2) => {
        this.cursor = cursor2;
        void cursor2.done.catch(() => void 0).finally(() => {
          if (this.cursor === cursor2) this.cursor = void 0;
        });
        return cursor2;
      }).finally(() => {
        if (this.cursorStart === start) this.cursorStart = void 0;
      });
      this.cursorStart = start;
    }
    const cursor = await this.cursorStart.promise;
    signal.throwIfAborted();
    return cursor;
  }
  async spawnCursor(prepared) {
    const cursorSignal = new AbortController();
    const handle = this.ctx.subprocess.spawn({
      argv: [prepared.path, "--cursor-overlay"],
      cwd: dirname(prepared.path),
      stdio: {
        stdin: "pipe",
        stdout: "pipe",
        stderr: { maxBytes: 64 * 1024 }
      },
      graceMs: 1e3,
      signal: cursorSignal.signal,
      env: {
        LANG: process.env.LANG ?? "en_US.UTF-8",
        LC_ALL: process.env.LC_ALL ?? "en_US.UTF-8"
      }
    });
    if (handle.stdin === void 0 || handle.stdout === void 0) {
      handle.terminate();
      await handle.waitForExit();
      throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", "native cursor overlay protocol pipes are unavailable");
    }
    handle.stdin.on("error", () => {
    });
    try {
      await this.waitForCursorReady(handle);
    } catch (error) {
      handle.terminate();
      await handle.waitForExit();
      const stderr = collected(handle.collected.stderr).trim();
      throw new ComputerUseError(
        "COMPUTER_PROVIDER_FAILURE",
        `native cursor overlay failed to become ready${stderr.length === 0 ? "" : `: ${stderr.slice(0, 1e3)}`}`,
        { cause: error }
      );
    }
    handle.stdout.resume();
    return {
      stdin: handle.stdin,
      done: handle.done,
      terminate: () => {
        cursorSignal.abort();
        handle.terminate();
      },
      waitForExit: (signal) => handle.waitForExit(signal)
    };
  }
  async waitForCursorReady(handle) {
    const stdout = handle.stdout;
    if (stdout === void 0) throw new Error("cursor stdout is unavailable");
    const timeout = AbortSignal.timeout(CURSOR_READY_TIMEOUT_MS);
    await new Promise((resolveReady, rejectReady) => {
      let buffer = "";
      let settled = false;
      const cleanup = () => {
        clearListeners();
        timeout.removeEventListener("abort", onTimeout);
      };
      const succeed = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolveReady();
      };
      const fail = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        rejectReady(error);
      };
      const onData = (chunk) => {
        buffer += chunk.toString();
        if (Buffer.byteLength(buffer) > CURSOR_PROTOCOL_MAX_BYTES) {
          fail(new Error("cursor ready response exceeded its protocol limit"));
          return;
        }
        while (true) {
          const newline = buffer.indexOf("\n");
          if (newline < 0) return;
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          if (line.length === 0) continue;
          let response;
          try {
            response = JSON.parse(line);
          } catch (error) {
            fail(error);
            return;
          }
          if (typeof response === "object" && response !== null && response.ok === true && response.ready === true) {
            succeed();
            return;
          }
          fail(new Error("cursor overlay returned an unexpected ready response"));
          return;
        }
      };
      const onEnd = () => {
        fail(new Error("cursor overlay stdout closed before ready"));
      };
      const onError = (error) => {
        fail(error);
      };
      const onTimeout = () => {
        fail(new Error(`cursor overlay ready timeout after ${CURSOR_READY_TIMEOUT_MS} milliseconds`));
      };
      const clearListeners = () => {
        stdout.removeListener("data", onData);
        stdout.removeListener("end", onEnd);
        stdout.removeListener("error", onError);
      };
      stdout.on("data", onData);
      stdout.once("end", onEnd);
      stdout.once("error", onError);
      timeout.addEventListener("abort", onTimeout, { once: true });
      void handle.done.then(
        (outcome) => {
          fail(new Error(`cursor overlay exited before ready (${String(outcome.exitCode ?? outcome.signal)})`));
        },
        (error) => {
          fail(error);
        }
      );
    });
  }
  async buildManaged(signal) {
    const script = fileURLToPath(new URL("../scripts/build-native.mjs", import.meta.url));
    const handle = this.ctx.subprocess.spawn({
      argv: [process.execPath, script, "--helper-only"],
      cwd: dirname(script),
      stdio: {
        stdin: "ignore",
        stdout: { maxBytes: 256 * 1024 },
        stderr: { maxBytes: 256 * 1024 }
      },
      graceMs: 1e3,
      signal,
      env: {}
    });
    const outcome = await handle.done;
    if (outcome.exitCode !== 0) {
      const stderr = collected(handle.collected.stderr);
      throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", `explicit native source build failed: ${stderr.slice(0, 1e3)}`);
    }
    const info = await stat(this.helperPath).catch(() => void 0);
    if (info?.isFile() !== true) throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", "native source build completed without producing the helper");
  }
};

// src/providers/macos.ts
var MacOSBackend = class {
  constructor(ctx, config) {
    this.config = config;
    this.client = new NativeHelperClient(ctx, config);
  }
  name = "macos-ax";
  client;
  get helperPath() {
    return this.client.helperPath;
  }
  async resolveApp(selector, signal) {
    return await this.client.invoke({ command: "resolve-app", selector }, signal);
  }
  async listApps(signal) {
    return await this.client.invoke({ command: "list-apps" }, signal);
  }
  async resolveLaunchTarget(selector, signal) {
    return await this.client.invoke({ command: "resolve-launch-target", selector }, signal);
  }
  async openApp(target, activate, signal) {
    return await this.client.invoke({
      command: "open-app",
      target,
      activate,
      actionTimeoutMs: this.config.actionTimeoutMs
    }, signal);
  }
  async observe(app, options, signal) {
    return await this.client.invoke({ command: "observe", app, options }, signal);
  }
  async act(request, signal) {
    return await this.client.invoke({
      command: "act",
      request: {
        ...request,
        actionTimeoutMs: this.config.actionTimeoutMs,
        limits: {
          maxNodes: this.config.maxNodes,
          maxDepth: this.config.maxDepth,
          maxTextBytes: this.config.maxTextBytes
        }
      }
    }, signal);
  }
  async visualizeCursor(action, phase, signal) {
    if (this.config.interaction.cursorVisualization !== "visible") return;
    const autoHideMs = this.config.interaction.cursorAutoHideMs;
    const move = async (point, durationMs) => {
      await this.client.cursorCommand({
        op: "move",
        x: point.x,
        y: point.y,
        durationMs,
        autoHideMs,
        targetPid: action.targetPid,
        targetWindowNumber: action.targetWindowNumber,
        targetWindowFrame: action.targetWindowFrame
      }, signal);
    };
    if (phase === "after") {
      if (action.kind === "drag") await this.client.cursorCommand({
        op: "release",
        autoHideMs,
        targetPid: action.targetPid,
        targetWindowNumber: action.targetWindowNumber,
        targetWindowFrame: action.targetWindowFrame
      }, signal);
      return;
    }
    const start = action.kind === "drag" ? action.from : action.to;
    if (start === void 0) return;
    await move(start, this.config.interaction.cursorMotionMs);
    if (this.config.interaction.cursorMotionMs > 0) {
      await delay(this.config.interaction.cursorMotionMs, void 0, { signal });
    }
    if (action.kind === "scroll") return;
    await this.client.cursorCommand({
      op: "press",
      autoHideMs,
      targetPid: action.targetPid,
      targetWindowNumber: action.targetWindowNumber,
      targetWindowFrame: action.targetWindowFrame,
      sustainedPress: action.kind === "drag"
    }, signal);
    if (action.kind === "drag") {
      await move(action.to, Math.max(this.config.interaction.cursorMotionMs, 240));
    }
  }
  async dispose() {
    await this.client.dispose();
  }
  async health(signal) {
    const prepared = await this.client.prepare(signal);
    const health = await this.client.invoke({ command: "health" }, signal);
    return {
      helperVersion: health.helperVersion || prepared.version,
      helperSha256: prepared.sha256,
      accessibility: health.accessibility,
      screenRecording: health.screenRecording
    };
  }
  async openSettings(kind, signal) {
    await this.client.invoke({ command: "open-settings", kind }, signal);
  }
};

// src/service.ts
import { randomUUID as randomUUID3 } from "node:crypto";
import { readFile as readFile2 } from "node:fs/promises";
import { setTimeout as delay2 } from "node:timers/promises";
import { Service } from "@deepseek-ai/cordis";

// src/artifacts.ts
import { randomUUID } from "node:crypto";
import { lstat as lstat2, mkdir, realpath as realpath2, stat as stat2 } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve as resolve2, sep } from "node:path";
var COMPUTER_SCREENSHOT_DESCRIPTION = "Current macOS application window after the latest Computer Use step. The image is embedded directly in this Tool result; ground the next action only from this fresh frame and do not call vision_glance or recreate OCR with scripts.";
function isWithin(root, candidate) {
  const rel = relative(root, candidate);
  return rel === "" || !rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel);
}
async function rejectSymlinkComponents(root, target) {
  const rel = relative(root, target);
  let current = root;
  for (const part of rel.split(sep).filter(Boolean)) {
    current = resolve2(current, part);
    try {
      const info = await lstat2(current);
      if (info.isSymbolicLink()) {
        throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", `artifact path component must not be a symbolic link: ${part}`);
      }
    } catch (error) {
      if (error instanceof ComputerUseError) throw error;
      const code = error.code;
      if (code !== "ENOENT") throw error;
    }
  }
}
async function allocateScreenshotPath(workspace, artifactRoot, sessionId) {
  const realWorkspace = await realpath2(workspace);
  const directory = resolve2(realWorkspace, artifactRoot, String(sessionId));
  if (!isWithin(realWorkspace, directory)) {
    throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", "artifactRoot escapes the Session workspace");
  }
  await rejectSymlinkComponents(realWorkspace, directory);
  await mkdir(directory, { recursive: true, mode: 448 });
  const realDirectory = await realpath2(directory);
  if (!isWithin(realWorkspace, realDirectory)) {
    throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", "artifact directory escaped the Session workspace");
  }
  return resolve2(realDirectory, `observation-${randomUUID()}.png`);
}
async function describeScreenshot(path, width, height, maxBytes, sourceTool) {
  const link = await lstat2(path).catch((error) => {
    throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", "the screenshot artifact was not created", { cause: error });
  });
  if (link.isSymbolicLink() || !link.isFile()) {
    throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", "the screenshot artifact must be a regular non-symbolic-link file");
  }
  const info = await stat2(path);
  if (info.size > maxBytes) {
    throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", `screenshot exceeds maxScreenshotBytes (${String(info.size)} > ${String(maxBytes)})`);
  }
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", "provider returned invalid screenshot dimensions");
  }
  return {
    path,
    filename: basename(path),
    mimeType: "image/png",
    kind: "image",
    description: COMPUTER_SCREENSHOT_DESCRIPTION,
    sourceTool,
    previewIntent: "image",
    bytes: info.size,
    width,
    height
  };
}

// src/confirmations.ts
import { createHash as createHash2, randomUUID as randomUUID2 } from "node:crypto";

// src/approval-policy.ts
function approvalPolicy(ctx, agent) {
  return ctx.approval.overrideOf(agent.session) ?? ctx.approval.config.policy ?? "ask";
}

// src/types.ts
var ComputerObservationId = (value) => value;
var ComputerTargetHandle = (value) => value;
var ComputerConfirmationToken = (value) => value;

// src/confirmations.ts
function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const record = value;
  return `{${Object.keys(record).sort().filter((key) => record[key] !== void 0).map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(",")}}`;
}
function actionHash(action) {
  const { confirmationToken: _token, ...rest } = action;
  return createHash2("sha256").update(stable(rest)).digest("hex");
}
var ComputerConfirmationManager = class {
  constructor(ctx, config, now = Date.now) {
    this.ctx = ctx;
    this.config = config;
    this.now = now;
  }
  records = /* @__PURE__ */ new Map();
  /** Request user approval and mint one token bound to the exact action. */
  async confirm(agent, app, request, callId, signal) {
    if (approvalPolicy(this.ctx, agent) === "never") {
      throw new ComputerUseError(
        "COMPUTER_CONFIRMATION_REQUIRED",
        "sensitive action confirmation is blocked because approval prompts are disabled in this Session (approval/policy: never); do not execute the action, and ask the user to switch the permission preset to one with approval ask or run it manually"
      );
    }
    const outcome = await this.ctx.approval.request({
      agent,
      toolName: "computer_confirm",
      ...callId === void 0 ? {} : { callId },
      reason: `${request.reason} Target: ${request.target}.${request.dataSummary === void 0 ? "" : ` Data: ${request.dataSummary}.`}`,
      signal
    });
    if (outcome === "cancelled") throw new ComputerUseError("COMPUTER_CANCELLED", "sensitive action confirmation was cancelled");
    if (outcome !== "allowed-once") {
      throw new ComputerUseError("COMPUTER_CONFIRMATION_REQUIRED", `sensitive action was not confirmed (${outcome})`);
    }
    const token = ComputerConfirmationToken(randomUUID2());
    const expiresAt = this.now() + this.config().confirmationTtlMs;
    let agentRecords = this.records.get(agent);
    if (agentRecords === void 0) {
      agentRecords = /* @__PURE__ */ new Map();
      this.records.set(agent, agentRecords);
    }
    agentRecords.set(token, {
      app,
      observationId: request.action.observationId,
      actionHash: actionHash(request.action),
      expiresAt
    });
    return { token, observationId: request.action.observationId, app, expiresAt: new Date(expiresAt).toISOString() };
  }
  /** Require and consume the one matching token when an action is marked sensitive. */
  consume(agent, app, action) {
    if (action.sensitive !== true) {
      if (action.confirmationToken !== void 0) {
        throw new ComputerUseError("COMPUTER_CONFIRMATION_REQUIRED", "confirmationToken is valid only when sensitive is true");
      }
      return;
    }
    const token = action.confirmationToken;
    if (token === void 0) {
      throw new ComputerUseError("COMPUTER_CONFIRMATION_REQUIRED", "sensitive action requires a token from computer_confirm");
    }
    const agentRecords = this.records.get(agent);
    const record = agentRecords?.get(token);
    if (record === void 0) {
      throw new ComputerUseError("COMPUTER_CONFIRMATION_REQUIRED", "confirmation token is unknown, expired, or already consumed");
    }
    agentRecords?.delete(token);
    if (record.expiresAt < this.now()) {
      throw new ComputerUseError("COMPUTER_CONFIRMATION_REQUIRED", "confirmation token expired");
    }
    if (record.app.bundleId !== app.bundleId || record.app.pid !== app.pid || record.observationId !== action.observationId || record.actionHash !== actionHash(action)) {
      throw new ComputerUseError("COMPUTER_CONFIRMATION_REQUIRED", "confirmation token does not match this app, observation, or action");
    }
  }
  /** Invalidate one pending token after target identity changes before input. */
  invalidate(agent, token) {
    if (token !== void 0) this.records.get(agent)?.delete(token);
  }
  /** Release every pending token owned by one Agent. */
  releaseAgent(agent) {
    this.records.delete(agent);
  }
  /** Release all pending tokens on provider teardown or generation replacement. */
  clear() {
    this.records.clear();
  }
};

// src/diff.ts
function identity(element) {
  const frame = element.frame === void 0 ? "" : `${Math.round(element.frame.x)},${Math.round(element.frame.y)},${Math.round(element.frame.width)},${Math.round(element.frame.height)}`;
  return [element.role, element.subrole ?? "", element.title ?? "", element.label ?? "", frame].join("|");
}
function summary(element, includeIndex) {
  const parts = [includeIndex ? `[${element.index}]` : void 0, element.role];
  if (element.title !== void 0) parts.push(JSON.stringify(element.title));
  else if (element.label !== void 0) parts.push(JSON.stringify(element.label));
  if (element.value !== void 0) parts.push(`value=${JSON.stringify(element.value)}`);
  if (element.enabled === false) parts.push("disabled");
  if (element.focused === true) parts.push("focused");
  if (element.selected === true) parts.push("selected");
  return parts.filter((part) => part !== void 0).join(" ");
}
function state(element) {
  return JSON.stringify({
    value: element.value,
    enabled: element.enabled,
    focused: element.focused,
    selected: element.selected,
    actions: element.actions
  });
}
function diffElements(previous, current, maxBytes) {
  const before = new Map(previous.map((element) => [identity(element), element]));
  const after = new Map(current.map((element) => [identity(element), element]));
  const lines = [];
  for (const [key, element] of before) {
    if (!after.has(key)) lines.push(`- ${summary(element, false)}`);
  }
  for (const [key, element] of after) {
    const old = before.get(key);
    if (old === void 0) lines.push(`+ ${summary(element, true)}`);
    else if (state(old) !== state(element)) lines.push(`~ ${summary(element, true)}`);
  }
  if (lines.length === 0) return "(no accessibility changes)";
  const text = lines.join("\n");
  const bytes = Buffer.byteLength(text);
  if (bytes <= maxBytes) return text;
  const suffix = "\n\u2026 diff truncated";
  return `${Buffer.from(text).subarray(0, Math.max(0, maxBytes - Buffer.byteLength(suffix))).toString("utf8")}${suffix}`;
}

// src/leases.ts
import { z } from "zod";
import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";
var nonNegativeSafeInteger = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
var leaseScopeSchema = z.union([z.literal("read"), z.literal("control")]);
var sessionIdentitySchema = z.object({
  createdAt: nonNegativeSafeInteger,
  cwd: z.string().optional()
});
var deniedLeaseSchema = z.object({
  bundleId: z.string().min(1),
  scope: leaseScopeSchema
});
var computerUseSessionStateSchema = z.object({
  session: sessionIdentitySchema,
  readGrants: z.array(z.string().min(1)),
  denied: z.array(deniedLeaseSchema)
}).superRefine((row, ctx) => {
  const readGrants = /* @__PURE__ */ new Set();
  row.readGrants.forEach((bundleId, index) => {
    if (readGrants.has(bundleId)) {
      ctx.addIssue({
        code: "custom",
        path: ["readGrants", index],
        message: `duplicate Computer Use read grant '${bundleId}'`
      });
    }
    readGrants.add(bundleId);
  });
  const denials = /* @__PURE__ */ new Set();
  row.denied.forEach((denial, index) => {
    const key = `${denial.scope}\0${denial.bundleId}`;
    if (denials.has(key)) {
      ctx.addIssue({
        code: "custom",
        path: ["denied", index],
        message: `duplicate Computer Use ${denial.scope} denial '${denial.bundleId}'`
      });
    }
    denials.add(key);
  });
});
var computerUseStateDomainSpec = defineDomain({
  name: "computer_use_state",
  version: 0,
  tables: {
    sessions: domainTable(computerUseSessionStateSchema)
  }
});
function configuredAccess(config, bundleId, scope) {
  if (config.allowAllApps) return true;
  return config.grants.find((grant) => grant.bundleId === bundleId)?.[scope] === true;
}
function currentTurn(events) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.type === "turn/end") return void 0;
    if (event?.type === "turn/start") return event.data.turn;
  }
  return void 0;
}
function identityOf(header) {
  return Object.freeze({
    createdAt: header.createdAt,
    ...header.cwd === void 0 ? {} : { cwd: header.cwd }
  });
}
function sameIdentity(row, header) {
  return row.session.createdAt === header.createdAt && row.session.cwd === header.cwd;
}
function stateSnapshot(header, readGrants, denied) {
  const readGrantSnapshot = Object.freeze([...readGrants]);
  const deniedSnapshot = Object.freeze([...denied].map((item) => Object.freeze({ ...item })));
  return Object.freeze({
    session: identityOf(header),
    readGrants: readGrantSnapshot,
    denied: deniedSnapshot
  });
}
function boundedFailure(error) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}
var ComputerLeaseManager = class {
  constructor(ctx, config) {
    this.ctx = ctx;
    this.config = config;
    this.storageFiber = ctx.inject(["storageDomain"], async (storageCtx) => {
      const domain = await storageCtx.storageDomain.open(computerUseStateDomainSpec);
      const binding = { table: domain.table("sessions") };
      this.storage = binding;
      return async () => {
        if (this.storage === binding) this.storage = void 0;
        await Promise.all(this.mutationTails.values());
        await domain.close();
      };
    });
    ctx.effect(() => () => this.storageFiber.dispose(), "dsh-computer-use: optional lease sidecar");
  }
  storage;
  storageFiber;
  decisionTails = /* @__PURE__ */ new Map();
  mutationTails = /* @__PURE__ */ new Map();
  controlGrants = /* @__PURE__ */ new WeakMap();
  /** Wait for an already-composed storage-domain service to finish opening. */
  async initialize() {
    await this.prepareStorage();
  }
  /** Ensure one Agent may read or control one exact running application. */
  async ensure(agent, app, scope, toolName, callId, signal) {
    if (configuredAccess(this.config(), app.bundleId, scope)) return "configured";
    return await this.enqueueDecision(agent.session.id, async () => {
      if (configuredAccess(this.config(), app.bundleId, scope)) return "configured";
      return await this.ensureInteractive(agent, app, scope, toolName, callId, signal);
    });
  }
  /** Forget process-local control grants when their Agent is disposed. */
  releaseAgent(agent) {
    this.controlGrants.delete(agent);
  }
  async ensureInteractive(agent, app, scope, toolName, callId, signal) {
    await this.prepareStorage();
    const turn = currentTurn(agent.session.events);
    if (turn === void 0) {
      throw new ComputerUseError("COMPUTER_PERMISSION_REQUIRED", `${scope} access for ${app.name} must be requested inside an open Agent turn`);
    }
    if (scope === "control" && this.controlGrants.get(agent)?.get(app.bundleId) === turn) {
      return "approved";
    }
    const stored = this.currentState(agent);
    if (scope === "read" && stored?.readGrants.includes(app.bundleId) === true) {
      return "approved";
    }
    if (stored?.denied.some((denial) => denial.bundleId === app.bundleId && denial.scope === scope) === true) {
      throw new ComputerUseError(
        "COMPUTER_PERMISSION_REQUIRED",
        `${scope} access for ${app.name} was rejected earlier in this Session; do not retry without new user instructions`
      );
    }
    if (approvalPolicy(this.ctx, agent) === "never") {
      throw new ComputerUseError(
        "COMPUTER_PERMISSION_REQUIRED",
        `${scope} access for ${app.name} is blocked because approval prompts are disabled in this Session (approval/policy: never, e.g. the danger-full-access preset); add "${app.bundleId}" to the computer-use grants in Settings, or switch the permission preset to one with approval ask`
      );
    }
    if (scope === "read" && this.storage === void 0) {
      throw this.storageRequired(app, scope, "a Session-wide interactive read grant");
    }
    const outcome = await this.ctx.approval.request({
      agent,
      toolName,
      ...callId === void 0 ? {} : { callId },
      reason: scope === "read" ? `Allow this Agent to inspect the Accessibility state and requested screenshot of ${app.name} (${app.bundleId}) for this Session.` : `Allow this Agent to send UI input to ${app.name} (${app.bundleId}) for the current turn.`,
      signal
    });
    if (outcome === "cancelled") {
      throw new ComputerUseError("COMPUTER_CANCELLED", `${scope} access request for ${app.name} was cancelled`);
    }
    if (outcome === "rejected") {
      if (this.storage === void 0) {
        throw this.storageRequired(app, scope, "the rejected interactive decision");
      }
      await this.persist(agent, app, { kind: "denied", scope });
      throw new ComputerUseError("COMPUTER_PERMISSION_REQUIRED", `${scope} access for ${app.name} was not granted (rejected); do not retry in this Session without new user instructions`);
    }
    if (outcome !== "allowed-once") {
      throw new ComputerUseError("COMPUTER_PERMISSION_REQUIRED", `${scope} access for ${app.name} was not granted (${outcome})`);
    }
    if (scope === "control") {
      let grants = this.controlGrants.get(agent);
      if (grants === void 0) {
        grants = /* @__PURE__ */ new Map();
        this.controlGrants.set(agent, grants);
      }
      grants.set(app.bundleId, turn);
      return "approved";
    }
    await this.persist(agent, app, { kind: "read-granted" });
    return "approved";
  }
  currentState(agent) {
    const row = this.storage?.table.get(agent.session.id);
    return row !== void 0 && sameIdentity(row, agent.session.header) ? row : void 0;
  }
  async prepareStorage() {
    if (this.storage !== void 0) return this.storage;
    if (this.ctx.get("storageDomain") === void 0) return void 0;
    await this.storageFiber;
    return this.storage;
  }
  async persist(agent, app, decision) {
    const purpose = decision.kind === "read-granted" ? "the Session-wide read grant" : `the Session-wide ${decision.scope} denial`;
    try {
      const participated = await this.ctx.sessions.flush(agent.session);
      if (!participated) {
        throw new Error("no Session persistence listener participated in ctx.sessions.flush");
      }
      await this.enqueueMutation(agent.session.id, async () => {
        const binding = this.storage;
        if (binding === void 0) throw this.storageRequired(app, decision.kind === "read-granted" ? "read" : decision.scope, purpose);
        const current = binding.table.get(agent.session.id);
        const row = current !== void 0 && sameIdentity(current, agent.session.header) ? current : stateSnapshot(agent.session.header, [], []);
        const readGrants = new Set(row.readGrants);
        const denied = [...row.denied];
        if (decision.kind === "read-granted") {
          readGrants.add(app.bundleId);
        } else if (!denied.some((item) => item.bundleId === app.bundleId && item.scope === decision.scope)) {
          denied.push({ bundleId: app.bundleId, scope: decision.scope });
        }
        await binding.table.put(agent.session.id, stateSnapshot(agent.session.header, readGrants, denied));
      });
    } catch (error) {
      if (error instanceof ComputerUseError) throw error;
      throw new ComputerUseError(
        "COMPUTER_PERMISSION_REQUIRED",
        `${purpose} for ${app.name} could not be persisted after the approval audit: ${boundedFailure(error)}; configure working Session persistence and @deepseek-ai/dsh-storage-domain before retrying`,
        { cause: error }
      );
    }
  }
  storageRequired(app, scope, purpose) {
    return new ComputerUseError(
      "COMPUTER_PERMISSION_REQUIRED",
      `${scope} access for ${app.name} requires ctx.storageDomain to persist ${purpose}; compose @deepseek-ai/dsh-storage-domain or add an exact static grant for "${app.bundleId}" before retrying`
    );
  }
  enqueueDecision(sessionId, operation) {
    const previous = this.decisionTails.get(sessionId) ?? Promise.resolve();
    const result = previous.then(operation);
    const tail = result.then(() => void 0, () => void 0);
    this.decisionTails.set(sessionId, tail);
    return result.finally(() => {
      if (this.decisionTails.get(sessionId) === tail) this.decisionTails.delete(sessionId);
    });
  }
  enqueueMutation(sessionId, operation) {
    const previous = this.mutationTails.get(sessionId) ?? Promise.resolve();
    const result = previous.then(operation);
    const tail = result.then(() => void 0, () => void 0);
    this.mutationTails.set(sessionId, tail);
    return result.finally(() => {
      if (this.mutationTails.get(sessionId) === tail) this.mutationTails.delete(sessionId);
    });
  }
};

// src/target-resolver.ts
var TARGET_RESOLUTION_CONFIDENCE = {
  exactLocator: 1,
  nativeIdentifier: 1,
  semantic: 0.9,
  semanticThreshold: 0.9
};
function normalizedText(value) {
  const normalized = value?.normalize("NFKC").trim().replace(/\s+/gu, " ");
  return normalized === void 0 || normalized.length === 0 ? void 0 : normalized;
}
function accessibleName(element) {
  return normalizedText(element.label ?? element.title);
}
function locatorKey(locator) {
  return locator.join(".");
}
function sameLocator(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function sameActions(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function sameAncestorFingerprint(left, right) {
  if (left.length !== right.length) return false;
  return left.every((entry, index) => {
    const candidate = right[index];
    return candidate !== void 0 && entry.role === candidate.role && entry.subrole === candidate.subrole && entry.accessibleName === candidate.accessibleName;
  });
}
function sameStableFields(left, right) {
  return left.role === right.role && left.subrole === right.subrole && left.accessibleName === right.accessibleName && sameActions(left.availableActions, right.availableActions) && sameAncestorFingerprint(left.ancestorFingerprint, right.ancestorFingerprint);
}
function sameSemanticIdentity(left, right) {
  return left.accessibleName !== void 0 && sameStableFields(left, right);
}
function sameRect(left, right) {
  return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;
}
function sameExactIdentity(left, right) {
  if (left.nativeIdentifier !== void 0 || right.nativeIdentifier !== void 0) {
    return left.nativeIdentifier === right.nativeIdentifier && sameStableFields(left, right);
  }
  if (!sameStableFields(left, right)) return false;
  if (left.normalizedFrame === void 0 || right.normalizedFrame === void 0) {
    return left.normalizedFrame === right.normalizedFrame;
  }
  return sameRect(left.normalizedFrame, right.normalizedFrame);
}
function sameWindow(left, right) {
  if (left === void 0 || right === void 0) return left === right;
  return left.id === right.id && left.title === right.title && sameRect(left.frame, right.frame);
}
function failAmbiguous(mode, candidateCount) {
  throw new ComputerUseError(
    "COMPUTER_TARGET_AMBIGUOUS",
    `${mode} resolution found ${candidateCount} candidates in the selected process and window`
  );
}
function failLowConfidence(candidateCount, reason) {
  throw new ComputerUseError(
    "COMPUTER_TARGET_LOW_CONFIDENCE",
    `${reason}; candidateCount=${candidateCount}, confidence=0, required=${TARGET_RESOLUTION_CONFIDENCE.semanticThreshold}`
  );
}
function describeComputerTarget(element, observation) {
  const byLocator = new Map(observation.elements.map((candidate) => [locatorKey(candidate.locator), candidate]));
  const ancestors = [];
  for (let depth = 0; depth < element.locator.length; depth += 1) {
    const ancestor = byLocator.get(locatorKey(element.locator.slice(0, depth)));
    if (ancestor === void 0) continue;
    const name3 = accessibleName(ancestor);
    ancestors.push({
      role: ancestor.role,
      ...ancestor.subrole === void 0 ? {} : { subrole: ancestor.subrole },
      ...name3 === void 0 ? {} : { accessibleName: name3 }
    });
  }
  const nativeIdentifier = normalizedText(element.nativeIdentifier);
  const name2 = accessibleName(element);
  const normalizedFrame = element.frame === void 0 ? void 0 : observation.window === void 0 ? { ...element.frame } : {
    x: element.frame.x - observation.window.frame.x,
    y: element.frame.y - observation.window.frame.y,
    width: element.frame.width,
    height: element.frame.height
  };
  return {
    locator: [...element.locator],
    ...nativeIdentifier === void 0 ? {} : { nativeIdentifier },
    role: element.role,
    ...element.subrole === void 0 ? {} : { subrole: element.subrole },
    ...name2 === void 0 ? {} : { accessibleName: name2 },
    ancestorFingerprint: ancestors.slice(-4),
    ...normalizedFrame === void 0 ? {} : { normalizedFrame },
    availableActions: [...new Set(element.actions)].sort()
  };
}
function resolveComputerTarget(original, fresh, expected, allowRebind) {
  if (fresh.app.bundleId !== original.app.bundleId || fresh.app.pid !== original.app.pid) {
    throw new ComputerUseError("COMPUTER_STALE_OBSERVATION", "the selected application restarted or resolved to a different process");
  }
  if (!sameWindow(original.window, fresh.window)) {
    throw new ComputerUseError("COMPUTER_STALE_OBSERVATION", "the selected window changed after the referenced observation");
  }
  const descriptors = fresh.elements.map((element) => ({ element, descriptor: describeComputerTarget(element, fresh) }));
  const exact = descriptors.find((candidate) => sameLocator(candidate.element.locator, expected.locator));
  if (exact !== void 0 && sameExactIdentity(expected, exact.descriptor)) {
    return {
      element: exact.element,
      observation: fresh,
      resolution: {
        mode: "exact-locator",
        confidence: TARGET_RESOLUTION_CONFIDENCE.exactLocator,
        candidateCount: 1,
        targetChanged: false
      }
    };
  }
  if (!allowRebind) {
    throw new ComputerUseError("COMPUTER_STALE_OBSERVATION", "the target locator no longer identifies the selected element and rebinding was not allowed");
  }
  if (fresh.truncated) {
    failLowConfidence(0, "target uniqueness cannot be established from a truncated fresh observation");
  }
  if (expected.nativeIdentifier !== void 0) {
    const nativeMatches = descriptors.filter((candidate) => candidate.descriptor.nativeIdentifier === expected.nativeIdentifier);
    if (nativeMatches.length > 1) failAmbiguous("native identifier", nativeMatches.length);
    if (nativeMatches.length === 1) {
      const match2 = nativeMatches[0];
      if (!sameStableFields(expected, match2.descriptor)) {
        failLowConfidence(1, "the native identifier resolved to an element with different stable semantics");
      }
      return {
        element: match2.element,
        observation: fresh,
        resolution: {
          mode: "native-identifier",
          confidence: TARGET_RESOLUTION_CONFIDENCE.nativeIdentifier,
          candidateCount: 1,
          targetChanged: true
        }
      };
    }
  }
  if (expected.accessibleName === void 0) {
    failLowConfidence(0, "the target has no native identifier or accessible name");
  }
  const semanticMatches = descriptors.filter((candidate) => sameSemanticIdentity(expected, candidate.descriptor));
  if (semanticMatches.length > 1) failAmbiguous("semantic", semanticMatches.length);
  if (semanticMatches.length === 0) failLowConfidence(0, "no candidate retained the target role, accessible name, actions, and ancestor fingerprint");
  if (TARGET_RESOLUTION_CONFIDENCE.semantic < TARGET_RESOLUTION_CONFIDENCE.semanticThreshold) {
    failLowConfidence(semanticMatches.length, "the deterministic semantic score is below the configured threshold");
  }
  const match = semanticMatches[0];
  return {
    element: match.element,
    observation: fresh,
    resolution: {
      mode: "semantic-rebind",
      confidence: TARGET_RESOLUTION_CONFIDENCE.semantic,
      candidateCount: semanticMatches.length,
      targetChanged: true
    }
  };
}

// src/service.ts
var MAX_UNCHANGED_SETTLE_SAMPLES = 2;
var SEMANTIC_CLICK_SNAP_DISTANCE = 24;
function distanceFromPointToFrame(point, frame) {
  const dx = Math.max(frame.x - point.x, 0, point.x - (frame.x + frame.width));
  const dy = Math.max(frame.y - point.y, 0, point.y - (frame.y + frame.height));
  return Math.hypot(dx, dy);
}
function observationTransitioned(before, after) {
  if (before.stateHash !== after.stateHash || before.frontmost !== after.frontmost) return true;
  const beforeWindow = before.window;
  const afterWindow = after.window;
  if (beforeWindow === void 0 || afterWindow === void 0) return beforeWindow !== afterWindow;
  return beforeWindow.id !== afterWindow.id || beforeWindow.title !== afterWindow.title || beforeWindow.frame.x !== afterWindow.frame.x || beforeWindow.frame.y !== afterWindow.frame.y || beforeWindow.frame.width !== afterWindow.frame.width || beforeWindow.frame.height !== afterWindow.frame.height;
}
function publicElements(observation) {
  const targets = /* @__PURE__ */ new Map();
  const elements = observation.elements.map((backendElement) => {
    const { locator: _locator, nativeIdentifier: _nativeIdentifier, ...element } = backendElement;
    const targetHandle2 = ComputerTargetHandle(randomUUID3());
    targets.set(targetHandle2, describeComputerTarget(backendElement, observation));
    return { ...element, targetHandle: targetHandle2 };
  });
  return { elements, targets };
}
function matchesWait(observation, action) {
  const condition = action.condition;
  if (condition.text !== void 0 && !observation.treeText.toLocaleLowerCase().includes(condition.text.toLocaleLowerCase())) return false;
  if (condition.elementRole !== void 0 && !observation.elements.some((element) => element.role === condition.elementRole)) return false;
  if (condition.elementTitle !== void 0 && !observation.elements.some((element) => element.title === condition.elementTitle || element.label === condition.elementTitle)) return false;
  return condition.text !== void 0 || condition.elementRole !== void 0 || condition.elementTitle !== void 0;
}
function targetIndex(action) {
  switch (action.kind) {
    case "click":
    case "scroll":
    case "set-value":
    case "perform-action":
      return action.elementIndex;
    case "type-text":
    case "press-key":
    case "drag":
    case "move":
    case "wait":
      return void 0;
  }
}
function targetHandle(action) {
  switch (action.kind) {
    case "click":
    case "scroll":
    case "set-value":
    case "perform-action":
      return action.targetHandle;
    case "type-text":
    case "press-key":
    case "drag":
    case "move":
    case "wait":
      return void 0;
  }
}
function allowsTargetRebind(action) {
  switch (action.kind) {
    case "click":
    case "scroll":
    case "set-value":
    case "perform-action":
      return action.allowRebind === true;
    case "type-text":
    case "press-key":
    case "drag":
    case "move":
    case "wait":
      return false;
  }
}
function requiresElement(action) {
  return action.kind === "set-value" || action.kind === "perform-action";
}
function requiresPointerInput(action, element) {
  switch (action.kind) {
    case "click":
      if (action.x !== void 0 || action.y !== void 0) return true;
      return element !== void 0 && !element.actions.includes("AXPress") && action.allowCoordinateFallback === true;
    case "scroll":
    case "drag":
    case "move":
      return true;
    case "set-value":
    case "type-text":
    case "press-key":
    case "perform-action":
      return false;
  }
}
function requiresForegroundPermission(action) {
  return action.kind === "perform-action" && action.action === "AXRaise";
}
function cursorAction(action, element, window, app) {
  if (window?.id === void 0) return void 0;
  const target = {
    targetPid: app.pid,
    targetWindowNumber: window.id,
    targetWindowFrame: { ...window.frame }
  };
  const elementPoint = element?.frame === void 0 ? void 0 : { x: element.frame.x + element.frame.width / 2, y: element.frame.y + element.frame.height / 2 };
  const coordinateSpace = action.kind === "click" || action.kind === "scroll" || action.kind === "drag" || action.kind === "move" ? action.coordinateSpace : void 0;
  const windowPoint = (x, y) => {
    if (x === void 0 || y === void 0 || window === void 0) return void 0;
    return coordinateSpace === "screen" ? { x, y } : { x: window.frame.x + x, y: window.frame.y + y };
  };
  switch (action.kind) {
    case "click":
    case "scroll": {
      const point = elementPoint ?? windowPoint(action.x, action.y);
      return point === void 0 ? void 0 : { kind: action.kind, to: point, ...target };
    }
    case "drag": {
      const from = windowPoint(action.fromX, action.fromY);
      const to = windowPoint(action.toX, action.toY);
      return from === void 0 || to === void 0 ? void 0 : { kind: "drag", from, to, ...target };
    }
    case "move": {
      const point = windowPoint(action.x, action.y);
      return point === void 0 ? void 0 : { kind: "move", to: point, ...target };
    }
    case "set-value":
    case "type-text":
    case "press-key":
    case "perform-action":
      return void 0;
  }
}
var COMPUTER_KEY_MODIFIERS = /* @__PURE__ */ new Map([
  ["CMD", "command"],
  ["COMMAND", "command"],
  ["CTRL", "control"],
  ["CONTROL", "control"],
  ["ALT", "option"],
  ["OPTION", "option"],
  ["SHIFT", "shift"]
]);
function normalizedComputerKey(value) {
  const key = value.trim().toUpperCase();
  const aliases = {
    ENTER: "return",
    RETURN: "return",
    ESC: "escape",
    ESCAPE: "escape",
    BACKSPACE: "delete",
    DELETE: "delete",
    TAB: "tab",
    SPACE: "space",
    ARROWUP: "up",
    ARROWDOWN: "down",
    ARROWLEFT: "left",
    ARROWRIGHT: "right",
    HOME: "home",
    END: "end",
    PAGEUP: "pageup",
    PAGEDOWN: "pagedown"
  };
  return aliases[key] ?? key.toLocaleLowerCase();
}
function rejectPointerModifiers(action) {
  if ("keys" in action && action.keys !== void 0 && action.keys.length > 0) {
    throw new ComputerUseError(
      "COMPUTER_ACTION_BLOCKED",
      `${action.type} modifier keys are not supported by the targeted macOS pointer route`
    );
  }
}
function actionRequests(action, observationId, observation) {
  switch (action.type) {
    case "click": {
      rejectPointerModifiers(action);
      const window = observation.window;
      const point = window === void 0 ? void 0 : { x: window.frame.x + action.x, y: window.frame.y + action.y };
      const semanticTarget = point === void 0 || (action.button ?? "left") !== "left" ? void 0 : observation.elements.filter((element) => element.enabled !== false && element.actions.includes("AXPress") && element.frame !== void 0 && distanceFromPointToFrame(point, element.frame) <= SEMANTIC_CLICK_SNAP_DISTANCE).sort((left, right) => {
        const leftDistance = distanceFromPointToFrame(point, left.frame);
        const rightDistance = distanceFromPointToFrame(point, right.frame);
        if (leftDistance !== rightDistance) return leftDistance - rightDistance;
        const leftArea = (left.frame?.width ?? Number.POSITIVE_INFINITY) * (left.frame?.height ?? Number.POSITIVE_INFINITY);
        const rightArea = (right.frame?.width ?? Number.POSITIVE_INFINITY) * (right.frame?.height ?? Number.POSITIVE_INFINITY);
        return leftArea - rightArea;
      })[0];
      return [{
        kind: "click",
        observationId,
        x: action.x,
        y: action.y,
        coordinateSpace: "window",
        button: action.button ?? "left",
        clickCount: 1,
        ...semanticTarget === void 0 ? {} : { elementIndex: semanticTarget.index, allowCoordinateFallback: true }
      }];
    }
    case "double_click":
      rejectPointerModifiers(action);
      return [{
        kind: "click",
        observationId,
        x: action.x,
        y: action.y,
        coordinateSpace: "window",
        button: action.button ?? "left",
        clickCount: 2
      }];
    case "scroll": {
      rejectPointerModifiers(action);
      const horizontal = Math.abs(action.scroll_x) > Math.abs(action.scroll_y);
      const delta = horizontal ? action.scroll_x : action.scroll_y;
      if (!Number.isFinite(delta) || delta === 0) {
        throw new ComputerUseError("COMPUTER_ACTION_BLOCKED", "scroll requires one non-zero finite scroll_x or scroll_y delta");
      }
      const direction = horizontal ? delta < 0 ? "left" : "right" : delta < 0 ? "up" : "down";
      return [{
        kind: "scroll",
        observationId,
        x: action.x,
        y: action.y,
        coordinateSpace: "window",
        direction,
        pages: Math.min(10, Math.max(1, Math.ceil(Math.abs(delta) / 500)))
      }];
    }
    case "type":
      if (action.text === "") return [];
      return [{ kind: "type-text", observationId, text: action.text }];
    case "keypress": {
      if (action.keys.length === 0) {
        throw new ComputerUseError("COMPUTER_ACTION_BLOCKED", "keypress requires at least one key");
      }
      if (action.keys.length === 1 && action.keys[0].includes("+")) {
        const parts = action.keys[0].split("+").map((part) => part.trim()).filter(Boolean);
        return actionRequests({ type: "keypress", keys: parts }, observationId, observation);
      }
      const modifiers = [];
      const ordinary = [];
      for (const raw of action.keys) {
        const modifier = COMPUTER_KEY_MODIFIERS.get(raw.trim().toUpperCase());
        if (modifier === void 0) ordinary.push(normalizedComputerKey(raw));
        else modifiers.push(modifier);
      }
      if (ordinary.length === 1) {
        return [{ kind: "press-key", observationId, key: ordinary[0], ...modifiers.length === 0 ? {} : { modifiers } }];
      }
      if (modifiers.length > 0) {
        throw new ComputerUseError("COMPUTER_ACTION_BLOCKED", "keypress modifiers must accompany exactly one ordinary key");
      }
      return ordinary.map((key) => ({ kind: "press-key", observationId, key }));
    }
    case "drag": {
      rejectPointerModifiers(action);
      if (action.path.length < 2) {
        throw new ComputerUseError("COMPUTER_ACTION_BLOCKED", "drag path requires at least two points");
      }
      const from = action.path[0];
      const to = action.path[action.path.length - 1];
      return [{
        kind: "drag",
        observationId,
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
        coordinateSpace: "window"
      }];
    }
    case "move":
      rejectPointerModifiers(action);
      return [{ kind: "move", observationId, x: action.x, y: action.y, coordinateSpace: "window" }];
    case "wait":
    case "screenshot":
      return [];
  }
}
var ComputerUseService = class extends Service {
  backend;
  config;
  generation = 1;
  agents = /* @__PURE__ */ new Map();
  leases;
  confirmations;
  lifecycle = new AbortController();
  host;
  healthState = {
    ready: false,
    accessibility: "unavailable",
    screenRecording: "unavailable"
  };
  /** Register `ctx.computerUse` using one validated backend and configuration generation. */
  constructor(ctx, backend, config) {
    super(ctx, "computerUse");
    this.host = ctx;
    this.backend = backend;
    this.config = config;
    this.leases = new ComputerLeaseManager(ctx, () => this.config);
    this.confirmations = new ComputerConfirmationManager(ctx, () => this.config);
    ctx.effect(() => async () => {
      this.lifecycle.abort();
      this.clearState();
      await this.backend.dispose();
    }, "dsh-computer-use: service lifecycle");
  }
  /** Verify the active backend before consumers become injectable. */
  async initialize() {
    try {
      const health = await this.backend.health(this.lifecycle.signal);
      this.healthState = { ready: true, ...health };
    } catch (error) {
      const failure = computerUseError(error, "Computer Use provider initialization failed");
      this.healthState = { ready: false, accessibility: "unavailable", screenRecording: "unavailable", lastError: failure.message };
      throw failure;
    }
  }
  /** Replace the backend/config generation after a validated live Settings update. */
  async reconfigure(backend, config) {
    const health = await backend.health(this.lifecycle.signal);
    const previous = this.backend;
    this.backend = backend;
    this.config = config;
    this.generation += 1;
    this.clearState();
    this.healthState = { ready: true, ...health };
    await previous.dispose();
  }
  /** Current provider and permission diagnostics. */
  status() {
    return {
      platform: process.platform,
      provider: "macos-ax",
      generation: this.generation,
      helperPath: this.backend.helperPath,
      ...this.healthState
    };
  }
  /** Re-run non-mutating provider health checks. */
  async health(signal) {
    try {
      const health = await this.backend.health(AbortSignal.any([signal, this.lifecycle.signal]));
      this.healthState = { ready: true, ...health };
    } catch (error) {
      const failure = computerUseError(error, "Computer Use health check failed");
      this.healthState = { ...this.healthState, ready: false, lastError: failure.message };
      throw failure;
    }
    return this.status();
  }
  /** Open the exact macOS privacy pane after an explicit Settings-page action. */
  async openPermissionSettings(kind, signal) {
    await this.backend.openSettings(kind, AbortSignal.any([signal, this.lifecycle.signal]));
  }
  /** List bounded running applications without inspecting their UI contents. */
  async listApps(context) {
    return await this.backend.listApps(AbortSignal.any([context.signal, this.lifecycle.signal]));
  }
  /** Resolve authorization before deterministically launching or activating one installed app. */
  async openApp(request, context) {
    const signal = AbortSignal.any([context.signal, this.lifecycle.signal]);
    const target = await this.backend.resolveLaunchTarget(request.app, signal);
    await this.leases.ensure(context.agent, {
      bundleId: target.bundleId,
      name: target.name,
      pid: target.pid ?? 0
    }, "control", "computer_open_app", context.callId, signal);
    const result = await this.backend.openApp(target, this.config.interaction.focusPolicy === "activate", signal);
    this.state(context.agent).computerUseStepsByApp.set(`${result.app.bundleId}:${result.app.pid}`, 0);
    return result;
  }
  /** Obtain a fresh, scoped observation after enforcing the app read lease. */
  async observe(request, context) {
    const signal = AbortSignal.any([context.signal, this.lifecycle.signal]);
    const app = await this.backend.resolveApp(request.app, signal);
    await this.leases.ensure(context.agent, app, "read", "computer_observe", context.callId, signal);
    return await this.capture(app, request, context, "computer_observe");
  }
  /** Ask for a one-use token bound to an exact proposed sensitive action. */
  async confirm(request, context) {
    const stored = this.requireObservation(request.action.observationId, context.agent);
    return await this.confirmations.confirm(
      context.agent,
      stored.backend.app,
      request,
      context.callId,
      AbortSignal.any([context.signal, this.lifecycle.signal])
    );
  }
  /** Execute one observation-bound action and always return a fresh post-action observation. */
  async act(action, context) {
    return await this.actWithScreenshot(action, context);
  }
  async actWithScreenshot(action, context, postScreenshot) {
    const signal = AbortSignal.any([context.signal, this.lifecycle.signal]);
    const stored = this.requireObservation(action.observationId, context.agent);
    if (action.kind === "wait") return await this.wait(stored, action, context, signal);
    const index = targetIndex(action);
    const handle = targetHandle(action);
    const originalElement = index === void 0 ? void 0 : stored.backend.elements.find((candidate) => candidate.index === index);
    if (index !== void 0 && originalElement === void 0) {
      throw new ComputerUseError("COMPUTER_ELEMENT_UNAVAILABLE", `element ${index} is not part of observation ${String(action.observationId)}`);
    }
    if (allowsTargetRebind(action) && handle === void 0) {
      throw new ComputerUseError("COMPUTER_TARGET_UNAVAILABLE", "allowRebind requires a targetHandle from the referenced observation");
    }
    const descriptor = handle === void 0 ? void 0 : stored.targets.get(handle);
    if (handle !== void 0 && descriptor === void 0) {
      throw new ComputerUseError("COMPUTER_TARGET_UNAVAILABLE", "targetHandle is unknown or does not belong to the referenced observation");
    }
    if (descriptor !== void 0 && index !== void 0 && (descriptor.locator.length !== originalElement?.locator.length || !descriptor.locator.every((part, position) => part === originalElement.locator[position]))) {
      throw new ComputerUseError("COMPUTER_TARGET_UNAVAILABLE", "elementIndex and targetHandle select different elements");
    }
    const selectedOriginalElement = originalElement ?? (descriptor === void 0 ? void 0 : stored.backend.elements.find((candidate) => candidate.locator.length === descriptor.locator.length && candidate.locator.every((part, position) => part === descriptor.locator[position])));
    if (descriptor !== void 0 && selectedOriginalElement === void 0) {
      throw new ComputerUseError("COMPUTER_TARGET_UNAVAILABLE", "targetHandle no longer has provider evidence in the referenced observation");
    }
    if (requiresElement(action) && selectedOriginalElement === void 0) {
      throw new ComputerUseError("COMPUTER_ELEMENT_UNAVAILABLE", `${action.kind} requires elementIndex or targetHandle`);
    }
    if (requiresPointerInput(action, selectedOriginalElement) && this.config.interaction.pointerInputPolicy === "deny") {
      throw new ComputerUseError(
        "COMPUTER_ACTION_BLOCKED",
        `${action.kind} requires target-process pointer input, which interaction.pointerInputPolicy denies; use an Accessibility action or enable targeted pointer input in host Settings`
      );
    }
    if (requiresForegroundPermission(action) && this.config.interaction.focusPolicy === "preserve") {
      throw new ComputerUseError(
        "COMPUTER_ACTION_BLOCKED",
        "AXRaise may raise the target window, which interaction.focusPolicy preserve denies; enable explicit activation in host Settings before using this action"
      );
    }
    await this.leases.ensure(context.agent, stored.backend.app, "control", `computer_${action.kind}`, context.callId, signal);
    let actionObservation = stored.backend;
    let element = selectedOriginalElement;
    let resolution = selectedOriginalElement === void 0 ? void 0 : { mode: "exact-locator", confidence: 1, candidateCount: 1, targetChanged: false };
    if (descriptor !== void 0) {
      const fresh = await this.backend.observe(stored.backend.app, {
        screenshot: "none",
        maxNodes: this.config.maxNodes,
        maxDepth: this.config.maxDepth,
        maxTextBytes: this.config.maxTextBytes
      }, signal);
      const resolved = resolveComputerTarget(stored.backend, fresh, descriptor, allowsTargetRebind(action));
      actionObservation = resolved.observation;
      element = resolved.element;
      resolution = resolved.resolution;
      if (action.sensitive === true && resolution.targetChanged) {
        this.confirmations.invalidate(context.agent, action.confirmationToken);
        throw new ComputerUseError(
          "COMPUTER_TARGET_REBIND_REQUIRES_CONFIRMATION",
          "the sensitive target rebound to a fresh element; observe the current UI and request a new one-use confirmation before acting"
        );
      }
    }
    this.confirmations.consume(context.agent, stored.backend.app, action);
    const visualization = cursorAction(action, element, actionObservation.window, actionObservation.app);
    let cursorStarted = false;
    if (visualization !== void 0 && this.config.interaction.cursorVisualization === "visible") {
      try {
        await this.backend.visualizeCursor(visualization, "before", signal);
        cursorStarted = true;
      } catch {
      }
    }
    let outcome;
    try {
      outcome = await this.backend.act({
        action,
        app: actionObservation.app,
        expectedStateHash: actionObservation.stateHash,
        interaction: this.config.interaction,
        ...element === void 0 ? {} : { element },
        ...actionObservation.window === void 0 ? {} : { window: actionObservation.window }
      }, signal);
    } catch (error) {
      throw computerUseError(error, `Computer Use ${action.kind} failed`);
    } finally {
      if (cursorStarted && visualization !== void 0) {
        try {
          await this.backend.visualizeCursor(visualization, "after", signal);
        } catch {
        }
      }
    }
    const started = Date.now();
    let latest;
    let unchangedSamples = 0;
    do {
      if (this.config.settleMs > 0) await delay2(this.config.settleMs, void 0, { signal });
      latest = await this.backend.observe(stored.backend.app, {
        screenshot: "none",
        maxNodes: this.config.maxNodes,
        maxDepth: this.config.maxDepth,
        maxTextBytes: this.config.maxTextBytes
      }, signal);
      if (observationTransitioned(actionObservation, latest)) break;
      unchangedSamples += 1;
    } while (unchangedSamples < MAX_UNCHANGED_SETTLE_SAMPLES && Date.now() - started < this.config.maxSettleMs);
    const observation = await this.capture(
      stored.backend.app,
      {
        app: { bundleId: stored.backend.app.bundleId, pid: stored.backend.app.pid },
        screenshot: postScreenshot ?? (stored.public.screenshot === void 0 ? "none" : "optional")
      },
      context,
      "computer_action",
      latest
    );
    return {
      action: action.kind,
      channel: outcome.channel,
      activation: outcome.activation,
      pointerInput: outcome.pointerInput,
      pointerRouting: outcome.pointerRouting,
      ...resolution === void 0 ? {} : { resolution },
      observation
    };
  }
  /**
   * Run one screenshot-grounded action batch and return a new screenshot.
   * This is the custom-harness form of the OpenAI Computer Use loop: callers
   * begin with an empty batch, then ground each subsequent batch only in the
   * returned frame.
   */
  async computerUse(request, context) {
    const signal = AbortSignal.any([context.signal, this.lifecycle.signal]);
    if (request.actions.length > this.config.maxActionsPerStep) {
      throw new ComputerUseError(
        "COMPUTER_ACTION_BLOCKED",
        `computer_use accepts at most ${String(this.config.maxActionsPerStep)} ordered actions per screenshot`
      );
    }
    if (request.observationId === void 0) {
      if (request.actions.length !== 0) {
        throw new ComputerUseError(
          "COMPUTER_STALE_OBSERVATION",
          "the first computer_use call must use actions=[] so actions can be grounded in its returned screenshot"
        );
      }
      const opened = await this.openApp({ app: request.app }, context);
      await this.leases.ensure(context.agent, opened.app, "read", "computer_use", context.callId, signal);
      const key2 = `${opened.app.bundleId}:${opened.app.pid}`;
      this.state(context.agent).computerUseStepsByApp.set(key2, 0);
      const observation2 = await this.capture(
        opened.app,
        { app: { bundleId: opened.app.bundleId, pid: opened.app.pid }, screenshot: "required", full: true },
        context,
        "computer_use"
      );
      return { step: 0, actions: [], observation: observation2 };
    }
    const initial = this.requireObservation(request.observationId, context.agent);
    const selector = request.app;
    let selectorMismatch = selector.bundleId !== void 0 && selector.bundleId !== initial.backend.app.bundleId || selector.pid !== void 0 && selector.pid !== initial.backend.app.pid;
    const nameDiffers = selector.name !== void 0 && selector.name.localeCompare(initial.backend.app.name, void 0, { sensitivity: "accent" }) !== 0;
    if (!selectorMismatch && nameDiffers && selector.bundleId === void 0 && selector.pid === void 0) {
      try {
        const resolved = await this.backend.resolveApp(selector, signal);
        selectorMismatch = resolved.bundleId !== initial.backend.app.bundleId || resolved.pid !== initial.backend.app.pid;
      } catch {
        selectorMismatch = true;
      }
    }
    if (selectorMismatch) {
      throw new ComputerUseError("COMPUTER_STALE_OBSERVATION", "computer_use app selector does not match the referenced screenshot");
    }
    const key = `${initial.backend.app.bundleId}:${initial.backend.app.pid}`;
    const state2 = this.state(context.agent);
    const step = (state2.computerUseStepsByApp.get(key) ?? 0) + 1;
    if (step > this.config.maxComputerUseSteps) {
      throw new ComputerUseError(
        "COMPUTER_TIMEOUT",
        `computer_use stopped after ${String(this.config.maxComputerUseSteps)} screenshot/action steps; report the blocker instead of retrying`
      );
    }
    state2.computerUseStepsByApp.set(key, step);
    let currentId = request.observationId;
    const outcomes = [];
    for (const callAction of request.actions) {
      signal.throwIfAborted();
      if (callAction.type === "wait") {
        const waitMs = callAction.ms ?? 500;
        if (!Number.isInteger(waitMs) || waitMs < 0) {
          throw new ComputerUseError("COMPUTER_TIMEOUT", "computer_use wait.ms must be a non-negative integer");
        }
        const boundedWaitMs = Math.min(waitMs, 2e3);
        if (boundedWaitMs > 0) await delay2(boundedWaitMs, void 0, { signal });
        outcomes.push({ type: callAction.type, status: "completed", channel: "wait" });
        continue;
      }
      if (callAction.type === "screenshot") {
        outcomes.push({ type: callAction.type, status: "completed", channel: "screenshot" });
        continue;
      }
      const requests = actionRequests(
        callAction,
        currentId,
        this.requireObservation(currentId, context.agent).backend
      );
      let channel = "wait";
      for (const action of requests) {
        const rebound = { ...action, observationId: currentId };
        const result = await this.actWithScreenshot(rebound, context, "none");
        currentId = result.observation.observationId;
        channel = result.channel;
      }
      outcomes.push({ type: callAction.type, status: "completed", channel });
    }
    const latest = this.requireObservation(currentId, context.agent);
    const observation = await this.capture(
      latest.backend.app,
      { app: { bundleId: latest.backend.app.bundleId, pid: latest.backend.app.pid }, screenshot: "required", full: true },
      context,
      "computer_use"
    );
    return { step, actions: outcomes, observation };
  }
  /** Release all scoped observations and confirmations for one disposed Agent. */
  releaseAgent(agent) {
    this.agents.delete(agent);
    this.leases.releaseAgent(agent);
    this.confirmations.releaseAgent(agent);
  }
  state(agent) {
    let state2 = this.agents.get(agent);
    if (state2 === void 0) {
      state2 = { observations: /* @__PURE__ */ new Map(), latestByApp: /* @__PURE__ */ new Map(), computerUseStepsByApp: /* @__PURE__ */ new Map() };
      this.agents.set(agent, state2);
    }
    return state2;
  }
  requireObservation(id, agent) {
    this.prune(agent);
    const stored = this.state(agent).observations.get(id);
    if (stored === void 0 || stored.generation !== this.generation) {
      throw new ComputerUseError("COMPUTER_STALE_OBSERVATION", `observation ${String(id)} is unknown, expired, or belongs to another provider generation`);
    }
    return stored;
  }
  prune(agent) {
    const state2 = this.agents.get(agent);
    if (state2 === void 0) return;
    const now = Date.now();
    for (const [id, stored] of state2.observations) {
      if (Date.parse(stored.public.expiresAt) <= now || stored.generation !== this.generation) state2.observations.delete(id);
    }
    for (const [app, id] of state2.latestByApp) {
      if (!state2.observations.has(id)) state2.latestByApp.delete(app);
    }
  }
  async capture(app, request, context, sourceTool, preObserved) {
    const signal = AbortSignal.any([context.signal, this.lifecycle.signal]);
    const screenshot = request.screenshot ?? "none";
    const screenshotPath = screenshot === "none" ? void 0 : await allocateScreenshotPath(context.workspace, this.config.artifactRoot, context.agent.session.id);
    const backend = preObserved !== void 0 && screenshot === "none" ? preObserved : await this.backend.observe(app, {
      screenshot,
      ...screenshotPath === void 0 ? {} : { screenshotPath },
      maxNodes: this.config.maxNodes,
      maxDepth: this.config.maxDepth,
      maxTextBytes: this.config.maxTextBytes
    }, signal);
    if (backend.app.bundleId !== app.bundleId || backend.app.pid !== app.pid) {
      throw new ComputerUseError("COMPUTER_STALE_OBSERVATION", "the selected application restarted or resolved to a different process");
    }
    const state2 = this.state(context.agent);
    this.prune(context.agent);
    const key = `${app.bundleId}:${app.pid}`;
    const previousId = state2.latestByApp.get(key);
    const previous = previousId === void 0 ? void 0 : state2.observations.get(previousId);
    const projected = publicElements(backend);
    const elements = projected.elements;
    const full = request.full === true || previous === void 0;
    const createdAt = Date.now();
    const observationId = ComputerObservationId(randomUUID3());
    const describedArtifact = backend.screenshot === void 0 ? void 0 : await describeScreenshot(
      backend.screenshot.path,
      backend.screenshot.width,
      backend.screenshot.height,
      this.config.maxScreenshotBytes,
      sourceTool
    );
    let artifact;
    if (describedArtifact !== void 0) {
      const saved = await this.host.attachments.saveImage({
        data: await readFile2(describedArtifact.path),
        mediaType: "image/png",
        name: describedArtifact.filename
      });
      if (saved.mediaType !== "image/png") {
        throw new ComputerUseError("COMPUTER_PROVIDER_FAILURE", "attachment storage changed the verified screenshot media type");
      }
      artifact = { ...describedArtifact, attachment: { ...saved, mediaType: "image/png" } };
    }
    const observation = {
      observationId,
      app: backend.app,
      createdAt: new Date(createdAt).toISOString(),
      expiresAt: this.config.observationTtlMs === 0 ? "9999-12-31T23:59:59.999Z" : new Date(createdAt + this.config.observationTtlMs).toISOString(),
      frontmost: backend.frontmost,
      ...backend.window === void 0 ? {} : { window: backend.window },
      tree: {
        mode: full ? "full" : "diff",
        text: full ? backend.treeText : diffElements(previous.public.elements, elements, this.config.maxTextBytes),
        truncated: backend.truncated
      },
      elements,
      ...artifact === void 0 ? {} : { screenshot: artifact },
      permissions: backend.permissions
    };
    state2.observations.set(observationId, { public: observation, backend, targets: projected.targets, generation: this.generation });
    state2.latestByApp.set(key, observationId);
    while (state2.observations.size > 64) {
      const oldest = state2.observations.keys().next().value;
      if (oldest === void 0) break;
      state2.observations.delete(oldest);
    }
    return observation;
  }
  async wait(stored, action, context, signal) {
    await this.leases.ensure(context.agent, stored.backend.app, "read", "computer_wait", context.callId, signal);
    const timeoutMs = action.timeoutMs ?? this.config.maxSettleMs;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > this.config.maxSettleMs) {
      throw new ComputerUseError("COMPUTER_TIMEOUT", `wait timeout must be between 100 and ${this.config.maxSettleMs} milliseconds`);
    }
    const deadline = Date.now() + timeoutMs;
    let latest = stored.backend;
    while (!matchesWait(latest, action)) {
      if (Date.now() >= deadline) throw new ComputerUseError("COMPUTER_TIMEOUT", "wait condition was not met before the configured deadline");
      await delay2(Math.min(this.config.settleMs || 100, Math.max(1, deadline - Date.now())), void 0, { signal });
      latest = await this.backend.observe(stored.backend.app, {
        screenshot: "none",
        maxNodes: this.config.maxNodes,
        maxDepth: this.config.maxDepth,
        maxTextBytes: this.config.maxTextBytes
      }, signal);
    }
    const observation = await this.capture(
      stored.backend.app,
      { app: { bundleId: stored.backend.app.bundleId, pid: stored.backend.app.pid }, screenshot: stored.public.screenshot === void 0 ? "none" : "optional" },
      context,
      "computer_action",
      latest
    );
    return {
      action: "wait",
      channel: "wait",
      activation: "not-requested",
      pointerInput: false,
      pointerRouting: "none",
      observation
    };
  }
  clearState() {
    this.agents.clear();
    this.confirmations.clear();
  }
};

// src/tools.ts
import { defineTool } from "@deepseek-ai/dsh-tools";
function renderJson(_args, value) {
  return [{ type: "text", text: JSON.stringify(value, null, 2) }];
}
function renderComputerResult(args, value) {
  const record = value;
  const attachment = record.observation?.screenshot?.attachment ?? record.screenshot?.attachment;
  const modelValue = record.observation?.screenshot?.attachment === void 0 ? value : {
    ...value,
    observation: {
      ...record.observation,
      tree: { mode: "full", text: "[visual frame embedded; accessibility tree retained by host]", truncated: false },
      elements: []
    }
  };
  const json = JSON.stringify(modelValue, (key, nested) => {
    if (key === "path" || key === "filename" || key === "attachment") return void 0;
    return nested;
  }, 2);
  const blocks = [{ type: "text", text: json }];
  if (attachment !== void 0) {
    blocks.push({ type: "image", attachment });
  }
  return blocks;
}
function contextOf(exec) {
  const agent = exec.agent;
  if (agent === void 0) throw new Error(`${exec.name}: an Agent Session is required`);
  return {
    agent,
    workspace: agent.session.header.cwd ?? process.cwd(),
    callId: exec.callId,
    signal: exec.signal
  };
}
var rectSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    x: { type: "number", required: true },
    y: { type: "number", required: true },
    width: { type: "number", required: true },
    height: { type: "number", required: true }
  }
};
var appSelectorSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    bundleId: { type: "string", description: "Preferred exact macOS bundle identifier." },
    pid: { type: "integer", description: "Exact current process id when already observed." },
    name: { type: "string", description: "Display name accepted only when it resolves uniquely." }
  }
};
var appSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    bundleId: { type: "string", required: true },
    pid: { type: "integer", required: true },
    name: { type: "string", required: true }
  }
};
var elementSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    index: { type: "integer", required: true },
    targetHandle: { type: "string", required: true },
    role: { type: "string", required: true },
    subrole: { type: "string" },
    title: { type: "string" },
    label: { type: "string" },
    value: { type: "string" },
    enabled: { type: "boolean" },
    focused: { type: "boolean" },
    selected: { type: "boolean" },
    frame: rectSchema,
    actions: { type: "array", items: { type: "string" }, required: true }
  }
};
var artifactSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    path: { type: "string", required: true },
    filename: { type: "string", required: true },
    mimeType: { type: "string", enum: ["image/png"], required: true },
    kind: { type: "string", enum: ["image"], required: true },
    description: { type: "string", required: true },
    sourceTool: { type: "string", enum: ["computer_observe", "computer_action", "computer_use"], required: true },
    previewIntent: { type: "string", enum: ["image"], required: true },
    bytes: { type: "integer", required: true },
    width: { type: "integer", required: true },
    height: { type: "integer", required: true },
    attachment: {
      type: "object",
      additionalProperties: false,
      properties: {
        attachmentId: { type: "string", required: true },
        mediaType: { type: "string", enum: ["image/png"], required: true },
        bytes: { type: "integer", required: true },
        width: { type: "integer", required: true },
        height: { type: "integer", required: true },
        name: { type: "string" }
      }
    }
  }
};
var observationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    observationId: { type: "string", required: true },
    app: { ...appSchema, required: true },
    createdAt: { type: "string", required: true },
    expiresAt: { type: "string", required: true },
    frontmost: { type: "boolean", required: true },
    window: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        frame: { ...rectSchema, required: true },
        id: { type: "integer" }
      }
    },
    tree: {
      type: "object",
      additionalProperties: false,
      required: true,
      properties: {
        mode: { type: "string", enum: ["full", "diff"], required: true },
        text: { type: "string", required: true },
        truncated: { type: "boolean", required: true }
      }
    },
    elements: { type: "array", items: elementSchema, required: true },
    screenshot: artifactSchema,
    permissions: {
      type: "object",
      additionalProperties: false,
      required: true,
      properties: {
        accessibility: { type: "string", enum: ["granted", "denied", "not-determined", "unavailable"], required: true },
        screenRecording: { type: "string", enum: ["granted", "denied", "not-determined", "unavailable"], required: true }
      }
    }
  }
};
var actionResultSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: { type: "string", enum: ["click", "set-value", "type-text", "press-key", "scroll", "drag", "move", "perform-action", "wait"], required: true },
    channel: { type: "string", enum: ["accessibility", "coordinates", "keyboard", "wait"], required: true },
    activation: { type: "string", enum: ["not-requested", "already-frontmost", "activated", "raised"], required: true },
    pointerInput: { type: "boolean", required: true },
    pointerRouting: { type: "string", enum: ["none", "target-process"], required: true },
    resolution: {
      type: "object",
      additionalProperties: false,
      properties: {
        mode: { type: "string", enum: ["exact-locator", "native-identifier", "semantic-rebind"], required: true },
        confidence: { type: "number", required: true },
        candidateCount: { type: "integer", required: true },
        targetChanged: { type: "boolean", required: true }
      }
    },
    observation: { ...observationSchema, required: true }
  }
};
var sensitiveParameters = {
  sensitive: { type: "boolean", description: "Set true for an action classified by the Skill as high impact or sensitive." },
  confirmationToken: { type: "string", description: "One-use token from computer_confirm for this exact action." }
};
var keyNames = [
  "a",
  "s",
  "d",
  "f",
  "h",
  "g",
  "z",
  "x",
  "c",
  "v",
  "b",
  "q",
  "w",
  "e",
  "r",
  "y",
  "t",
  "1",
  "2",
  "3",
  "4",
  "6",
  "5",
  "=",
  "9",
  "7",
  "-",
  "8",
  "0",
  "]",
  "o",
  "u",
  "[",
  "i",
  "p",
  "return",
  "l",
  "j",
  "'",
  "k",
  ";",
  "\\",
  ",",
  "/",
  "n",
  "m",
  ".",
  "tab",
  "space",
  "delete",
  "escape",
  "home",
  "pageup",
  "forwarddelete",
  "end",
  "pagedown",
  "left",
  "right",
  "down",
  "up"
];
function actionBase(args) {
  return {
    observationId: ComputerObservationId(args.observationId),
    ...args.sensitive === void 0 ? {} : { sensitive: args.sensitive },
    ...args.confirmationToken === void 0 ? {} : { confirmationToken: ComputerConfirmationToken(args.confirmationToken) }
  };
}
function elementTarget(args) {
  return {
    ...args.elementIndex === void 0 ? {} : { elementIndex: args.elementIndex },
    ...args.targetHandle === void 0 ? {} : { targetHandle: ComputerTargetHandle(args.targetHandle) },
    ...args.allowRebind === void 0 ? {} : { allowRebind: args.allowRebind }
  };
}
function actionOutput() {
  return {
    schema: actionResultSchema,
    render: renderComputerResult
  };
}
var computerCallActionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    type: {
      type: "string",
      enum: ["click", "double_click", "scroll", "type", "wait", "keypress", "drag", "move", "screenshot"],
      required: true
    },
    x: { type: "number" },
    y: { type: "number" },
    button: { type: "string", enum: ["left", "right", "middle"] },
    keys: { type: "array", items: { type: "string" } },
    scroll_x: { type: "number" },
    scroll_y: { type: "number" },
    text: { type: "string" },
    ms: { type: "integer", description: "Optional wait duration. The host caps this at 2000 ms to keep the loop responsive." },
    path: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          x: { type: "number", required: true },
          y: { type: "number", required: true }
        }
      }
    }
  }
};
function createComputerUseTools(service) {
  const listApps = defineTool({
    name: "computer_list_apps",
    description: "List bounded running user-facing macOS applications. Use this only when the task does not already identify a unique bundle id.",
    parameters: {},
    output: {
      schema: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            ...appSchema.properties,
            frontmost: { type: "boolean", required: true },
            accessibility: { type: "string", enum: ["granted", "denied", "not-determined", "unavailable"], required: true },
            screenRecording: { type: "string", enum: ["granted", "denied", "not-determined", "unavailable"], required: true }
          }
        }
      },
      render: renderJson
    },
    execute: (_args, exec) => service.listApps(contextOf(exec)),
    presentCall: () => ({ card: "generic", title: "List macOS apps", kind: "read" })
  });
  const openApp = defineTool({
    name: "computer_open_app",
    description: "Use only when the task ends after launching, showing, switching to, or bringing an app forward. If the user also wants any interaction inside the app, do not call this first: start directly with computer_use actions=[], which opens/restores the app itself. When host focusPolicy is activate, this returns after a visible normal app window is activated or raised; it never treats the menu bar as an app window.",
    parameters: {
      app: { ...appSelectorSchema, required: true }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          app: { ...appSchema, required: true },
          launched: { type: "boolean", required: true },
          activation: { type: "string", enum: ["not-requested", "already-frontmost", "activated", "raised"], required: true },
          windowReady: { type: "boolean", required: true },
          window: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              frame: { ...rectSchema, required: true },
              id: { type: "integer", required: true }
            }
          }
        }
      },
      render: renderJson
    },
    execute: (args, exec) => service.openApp({ app: args.app }, contextOf(exec)),
    presentCall: () => ({ card: "generic", title: "Open macOS app", kind: "execute" })
  });
  const computerUse = defineTool({
    name: "computer_use",
    description: "Preferred visual control loop for macOS apps, following the OpenAI Computer Use custom-harness pattern. First call with the target app and actions=[]; this opens/restores the app and returns a fresh screenshot directly in the Tool result. Then send one bounded ordered actions[] batch grounded only in that screenshot, using its observationId. The result always includes the next fresh screenshot. Repeat until complete. Do not call vision_glance, Bash screenshot/OCR, AppleScript, or the individual computer_* action tools inside this loop. Stop and report a blocker after an error; the host enforces a finite step budget. Purchases, credential entry, destructive actions, or other high-impact operations must use the existing confirmation flow instead of this batch tool.",
    parameters: {
      app: { ...appSelectorSchema, required: true },
      observationId: { type: "string", description: "Omit only on the first call. Later calls must use the id from the immediately preceding screenshot." },
      actions: {
        type: "array",
        items: computerCallActionSchema,
        required: true,
        description: "Ordered OpenAI-style UI actions grounded only in the referenced screenshot. Use [] to obtain the initial screenshot."
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          step: { type: "integer", required: true },
          actions: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                type: { type: "string", enum: ["click", "double_click", "scroll", "type", "wait", "keypress", "drag", "move", "screenshot"], required: true },
                status: { type: "string", enum: ["completed"], required: true },
                channel: { type: "string", enum: ["accessibility", "coordinates", "keyboard", "wait", "screenshot"], required: true }
              }
            }
          },
          observation: { ...observationSchema, required: true }
        }
      },
      render: renderComputerResult
    },
    execute: (args, exec) => service.computerUse({
      app: args.app,
      ...args.observationId === void 0 ? {} : { observationId: ComputerObservationId(args.observationId) },
      actions: args.actions
    }, contextOf(exec)),
    presentCall: () => ({ card: "generic", title: "Use macOS app visually", kind: "execute" })
  });
  const observe = defineTool({
    name: "computer_observe",
    description: "Diagnostics-only compatibility tool for a user who explicitly asks to inspect the Accessibility tree. Never use this during a visual UI task: computer_use already returns the current screenshot in-band and owns the bounded action/observation loop. Element indexes belong only to the returned observationId. This tool does not launch or activate apps.",
    parameters: {
      app: { ...appSelectorSchema, required: true },
      screenshot: { type: "string", enum: ["none", "optional", "required"], description: "Default none for low latency. Required fails when Screen Recording is unavailable." },
      full: { type: "boolean", description: "Return a full tree instead of a diff from the previous observation." }
    },
    output: { schema: observationSchema, render: renderComputerResult },
    execute: (args, exec) => service.observe(args, contextOf(exec)),
    presentCall: () => ({ card: "generic", title: "Observe macOS app", kind: "read" })
  });
  const click = defineTool({
    name: "computer_click",
    description: "Compatibility primitive for one click. Prefer computer_use for screenshot-grounded visual workflows. Click an observed element, preferring AXPress, or use a window-relative or screen-global coordinate when host pointer policy allows it. Use computer_open_app instead of clicks to activate an app. For safe recovery after harmless tree reordering, pass targetHandle and allowRebind=true. After one stale-state failure, obtain one fresh observation and do not repeat the same guessed coordinate.",
    parameters: {
      observationId: { type: "string", required: true },
      elementIndex: { type: "integer" },
      targetHandle: { type: "string" },
      allowRebind: { type: "boolean", description: "Allow fail-closed native-identifier or unique semantic rebinding. Requires targetHandle." },
      x: { type: "number" },
      y: { type: "number" },
      coordinateSpace: { type: "string", enum: ["window", "screen"], description: "Default window interprets x/y inside the observed window frame; screen uses screen-global coordinates." },
      button: { type: "string", enum: ["left", "right", "middle"] },
      clickCount: { type: "integer" },
      allowCoordinateFallback: { type: "boolean" },
      ...sensitiveParameters
    },
    output: actionOutput(),
    execute: (args, exec) => service.act({
      kind: "click",
      ...actionBase(args),
      ...elementTarget(args),
      ...args.x === void 0 ? {} : { x: args.x },
      ...args.y === void 0 ? {} : { y: args.y },
      ...args.coordinateSpace === void 0 ? {} : { coordinateSpace: args.coordinateSpace },
      ...args.button === void 0 ? {} : { button: args.button },
      ...args.clickCount === void 0 ? {} : { clickCount: args.clickCount },
      ...args.allowCoordinateFallback === void 0 ? {} : { allowCoordinateFallback: args.allowCoordinateFallback }
    }, contextOf(exec)),
    presentCall: () => ({ card: "generic", title: "Click macOS app", kind: "execute" })
  });
  const setValue = defineTool({
    name: "computer_set_value",
    description: "Compatibility primitive for one Accessibility value change. Prefer computer_use for screenshot-grounded visual workflows. Set one observed editable value without using the clipboard. Supply elementIndex or targetHandle; targetHandle plus allowRebind=true permits deterministic fail-closed recovery after harmless tree reordering.",
    parameters: {
      observationId: { type: "string", required: true },
      elementIndex: { type: "integer" },
      targetHandle: { type: "string" },
      allowRebind: { type: "boolean" },
      value: { type: "string", required: true },
      ...sensitiveParameters
    },
    output: actionOutput(),
    execute: (args, exec) => service.act({ kind: "set-value", ...actionBase(args), ...elementTarget(args), value: args.value }, contextOf(exec)),
    presentCall: () => ({ card: "generic", title: "Set app value", kind: "execute" })
  });
  const typeText = defineTool({
    name: "computer_type_text",
    description: "Compatibility primitive for one text entry. Prefer computer_use for screenshot-grounded visual workflows. Type Unicode into the currently focused control without reading or replacing the clipboard. Focus a control using fresh state first; keyboard fallback may require host-authorized foreground activation. The result does not echo the supplied text.",
    parameters: {
      observationId: { type: "string", required: true },
      text: { type: "string", required: true },
      ...sensitiveParameters
    },
    output: actionOutput(),
    execute: (args, exec) => service.act({ kind: "type-text", ...actionBase(args), text: args.text }, contextOf(exec)),
    presentCall: () => ({ card: "generic", title: "Type in macOS app", kind: "execute" })
  });
  const pressKey = defineTool({
    name: "computer_press_key",
    description: "Compatibility primitive for one keypress. Prefer computer_use for screenshot-grounded visual workflows. Press one validated key or chord by routing it to the selected app process. The default host policy preserves the current foreground app; read the returned fresh observation.",
    parameters: {
      observationId: { type: "string", required: true },
      key: { type: "string", enum: keyNames, required: true },
      modifiers: { type: "array", items: { type: "string", enum: ["command", "control", "option", "shift"] } },
      ...sensitiveParameters
    },
    output: actionOutput(),
    execute: (args, exec) => service.act({ kind: "press-key", ...actionBase(args), key: args.key, ...args.modifiers === void 0 ? {} : { modifiers: args.modifiers } }, contextOf(exec)),
    presentCall: () => ({ card: "generic", title: "Press app key", kind: "execute" })
  });
  const scroll = defineTool({
    name: "computer_scroll",
    description: "Compatibility primitive for one scroll. Prefer computer_use for screenshot-grounded visual workflows. Route a wheel event only to the selected app process at an observed element or window-relative/screen-global coordinate. The system cursor is not moved.",
    parameters: {
      observationId: { type: "string", required: true },
      elementIndex: { type: "integer" },
      targetHandle: { type: "string" },
      allowRebind: { type: "boolean" },
      x: { type: "number" },
      y: { type: "number" },
      coordinateSpace: { type: "string", enum: ["window", "screen"] },
      direction: { type: "string", enum: ["up", "down", "left", "right"], required: true },
      pages: { type: "integer" },
      ...sensitiveParameters
    },
    output: actionOutput(),
    execute: (args, exec) => service.act({
      kind: "scroll",
      ...actionBase(args),
      ...elementTarget(args),
      direction: args.direction,
      ...args.x === void 0 ? {} : { x: args.x },
      ...args.y === void 0 ? {} : { y: args.y },
      ...args.coordinateSpace === void 0 ? {} : { coordinateSpace: args.coordinateSpace },
      ...args.pages === void 0 ? {} : { pages: args.pages }
    }, contextOf(exec)),
    presentCall: () => ({ card: "generic", title: "Scroll macOS app", kind: "execute" })
  });
  const drag = defineTool({
    name: "computer_drag",
    description: "Compatibility primitive for one drag. Prefer computer_use for screenshot-grounded visual workflows. Route mouse events only to the selected app process between two points in the observed-window or screen-global coordinate space. The system cursor is not moved.",
    parameters: {
      observationId: { type: "string", required: true },
      fromX: { type: "number", required: true },
      fromY: { type: "number", required: true },
      toX: { type: "number", required: true },
      toY: { type: "number", required: true },
      coordinateSpace: { type: "string", enum: ["window", "screen"] },
      ...sensitiveParameters
    },
    output: actionOutput(),
    execute: (args, exec) => service.act({
      kind: "drag",
      ...actionBase(args),
      fromX: args.fromX,
      fromY: args.fromY,
      toX: args.toX,
      toY: args.toY,
      ...args.coordinateSpace === void 0 ? {} : { coordinateSpace: args.coordinateSpace }
    }, contextOf(exec)),
    presentCall: () => ({ card: "generic", title: "Drag in macOS app", kind: "execute" })
  });
  const move = defineTool({
    name: "computer_move",
    description: "Compatibility primitive for one target-process pointer move. Prefer computer_use for screenshot-grounded visual workflows.",
    parameters: {
      observationId: { type: "string", required: true },
      x: { type: "number", required: true },
      y: { type: "number", required: true },
      coordinateSpace: { type: "string", enum: ["window", "screen"] },
      ...sensitiveParameters
    },
    output: actionOutput(),
    execute: (args, exec) => service.act({
      kind: "move",
      ...actionBase(args),
      x: args.x,
      y: args.y,
      ...args.coordinateSpace === void 0 ? {} : { coordinateSpace: args.coordinateSpace }
    }, contextOf(exec)),
    presentCall: () => ({ card: "generic", title: "Move in macOS app", kind: "execute" })
  });
  const perform = defineTool({
    name: "computer_perform_action",
    description: "Perform one Accessibility action advertised by an observed element. Supply elementIndex or targetHandle; targetHandle plus allowRebind=true permits deterministic fail-closed recovery after harmless tree reordering.",
    parameters: {
      observationId: { type: "string", required: true },
      elementIndex: { type: "integer" },
      targetHandle: { type: "string" },
      allowRebind: { type: "boolean" },
      action: { type: "string", required: true },
      ...sensitiveParameters
    },
    output: actionOutput(),
    execute: (args, exec) => service.act({ kind: "perform-action", ...actionBase(args), ...elementTarget(args), action: args.action }, contextOf(exec)),
    presentCall: () => ({ card: "generic", title: "Perform app action", kind: "execute" })
  });
  const wait = defineTool({
    name: "computer_wait",
    description: "Wait for one bounded Accessibility condition and return fresh state without mutating the app.",
    parameters: {
      observationId: { type: "string", required: true },
      condition: {
        type: "object",
        additionalProperties: false,
        required: true,
        properties: {
          text: { type: "string" },
          elementRole: { type: "string" },
          elementTitle: { type: "string" }
        }
      },
      timeoutMs: { type: "integer" }
    },
    output: actionOutput(),
    execute: (args, exec) => service.act({ kind: "wait", observationId: ComputerObservationId(args.observationId), condition: args.condition, ...args.timeoutMs === void 0 ? {} : { timeoutMs: args.timeoutMs } }, contextOf(exec)),
    presentCall: () => ({ card: "generic", title: "Wait for app state", kind: "read" })
  });
  const confirm = defineTool({
    name: "computer_confirm",
    description: "Request just-in-time approval for one exact sensitive action. Call immediately before the action, then repeat the same action with sensitive=true and the returned token.",
    parameters: {
      action: { type: "json", required: true },
      reason: { type: "string", required: true },
      target: { type: "string", required: true },
      dataSummary: { type: "string" }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          token: { type: "string", required: true },
          observationId: { type: "string", required: true },
          app: { ...appSchema, required: true },
          expiresAt: { type: "string", required: true }
        }
      },
      render: renderJson
    },
    execute: (args, exec) => service.confirm({
      action: { ...args.action, observationId: ComputerObservationId(String(args.action.observationId)), sensitive: true },
      reason: args.reason,
      target: args.target,
      ...args.dataSummary === void 0 ? {} : { dataSummary: args.dataSummary }
    }, contextOf(exec)),
    presentCall: () => ({ card: "generic", title: "Confirm sensitive app action", kind: "execute" })
  });
  return [listApps, openApp, computerUse, observe, click, setValue, typeText, pressKey, scroll, drag, move, perform, wait, confirm];
}

// src/index.ts
var name = "telos-computer-use";
var inject = ["subprocess", "approval", "sessions", "agents", "tools", "attachments"];
function apply(ctx, config = {}) {
  if (process.platform !== "darwin") {
    throw new ComputerUseError("COMPUTER_UNSUPPORTED_PLATFORM", `telos-computer-use supports macOS only; current platform is ${process.platform}`);
  }
  const resolved = resolveConfig(config);
  const backend = new MacOSBackend(ctx, resolved);
  const service = new ComputerUseService(ctx, backend, resolved);
  for (const definition of createComputerUseTools(service)) {
    ctx.tools.register(definition);
  }
  ctx.on("agent/disposed", ({ agent }) => {
    service.releaseAgent(agent);
  });
}
export {
  ComputerConfirmationToken,
  ComputerObservationId,
  ComputerTargetHandle,
  ComputerUseError,
  ComputerUseService,
  apply,
  computerUseError,
  inject,
  name
};
