// src/index.ts
import { createHash as createHash2 } from "node:crypto";
import { createUserMessage as createUserMessage2 } from "@deepseek-ai/dsh-llm";
import { defineTool } from "@deepseek-ai/dsh-tools";

// ../../packages/personal-core/dist/schema.js
var PERSONAL_CORE_SCHEMA_VERSION = 1;
var MIGRATION_1 = `
CREATE TABLE IF NOT EXISTS schema_migration (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
) STRICT;

CREATE TABLE source_episode (
  id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL,
  runtime_id TEXT,
  source_instance_id TEXT NOT NULL,
  session_id TEXT,
  seq_start INTEGER,
  seq_end INTEGER,
  observed_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  content TEXT,
  content_hash TEXT NOT NULL,
  sensitivity TEXT NOT NULL CHECK (sensitivity IN ('personal', 'sensitive', 'secret')),
  deletion_state TEXT NOT NULL CHECK (deletion_state IN ('active', 'detached', 'purged')),
  CHECK ((seq_start IS NULL AND seq_end IS NULL) OR (seq_start >= 0 AND seq_end >= seq_start))
) STRICT;

CREATE UNIQUE INDEX source_episode_origin_uq
ON source_episode(source_kind, source_instance_id, ifnull(session_id, ''), ifnull(seq_start, -1), ifnull(seq_end, -1));

CREATE TABLE entity (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'workspace', 'session')),
  scope_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'merged', 'split', 'deleted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  CHECK ((scope_type = 'global' AND scope_id IS NULL) OR (scope_type <> 'global' AND length(scope_id) > 0))
) STRICT;

CREATE TABLE entity_alias (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'workspace', 'session')),
  scope_id TEXT,
  source_episode_id TEXT REFERENCES source_episode(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  CHECK ((scope_type = 'global' AND scope_id IS NULL) OR (scope_type <> 'global' AND length(scope_id) > 0)),
  UNIQUE(entity_id, normalized_alias, scope_type, scope_id)
) STRICT;

CREATE INDEX entity_alias_lookup_idx ON entity_alias(normalized_alias, scope_type, scope_id);
CREATE UNIQUE INDEX entity_alias_identity_uq
ON entity_alias(entity_id, normalized_alias, scope_type, ifnull(scope_id, ''));

CREATE TABLE entity_event (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'workspace', 'session')),
  scope_id TEXT,
  source_episode_ids_json TEXT NOT NULL CHECK (json_valid(source_episode_ids_json)),
  actor TEXT NOT NULL CHECK (actor IN ('user', 'agent', 'system', 'runtime')),
  occurred_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  CHECK ((scope_type = 'global' AND scope_id IS NULL) OR (scope_type <> 'global' AND length(scope_id) > 0))
) STRICT;

CREATE INDEX entity_event_aggregate_idx ON entity_event(aggregate_id, recorded_at);

CREATE TABLE memory_claim (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('semantic', 'episodic', 'procedural', 'prospective', 'constraint')),
  statement TEXT NOT NULL,
  predicate TEXT NOT NULL,
  subject_entity_id TEXT NOT NULL REFERENCES entity(id),
  object_entity_id TEXT REFERENCES entity(id),
  object_value TEXT,
  status TEXT NOT NULL CHECK (status IN ('candidate', 'confirmed', 'superseded', 'contradicted', 'revoked', 'expired')),
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  importance REAL NOT NULL CHECK (importance >= 0 AND importance <= 1),
  sensitivity TEXT NOT NULL CHECK (sensitivity IN ('personal', 'sensitive', 'secret')),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'workspace', 'session')),
  scope_id TEXT,
  valid_from TEXT,
  valid_to TEXT,
  observed_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  supersedes_claim_id TEXT REFERENCES memory_claim(id) ON DELETE SET NULL,
  superseded_by_claim_id TEXT REFERENCES memory_claim(id) ON DELETE SET NULL,
  content_hash TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  CHECK ((object_entity_id IS NULL) <> (object_value IS NULL)),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  CHECK ((scope_type = 'global' AND scope_id IS NULL) OR (scope_type <> 'global' AND length(scope_id) > 0))
) STRICT;

CREATE INDEX memory_claim_scope_idx ON memory_claim(scope_type, scope_id, status, recorded_at);
CREATE INDEX memory_claim_subject_idx ON memory_claim(subject_entity_id, predicate, status);
CREATE INDEX memory_claim_object_entity_idx ON memory_claim(object_entity_id, status);

CREATE TABLE claim_source (
  claim_id TEXT NOT NULL REFERENCES memory_claim(id) ON DELETE CASCADE,
  source_episode_id TEXT NOT NULL REFERENCES source_episode(id) ON DELETE RESTRICT,
  PRIMARY KEY (claim_id, source_episode_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE relation_projection (
  claim_id TEXT PRIMARY KEY REFERENCES memory_claim(id) ON DELETE CASCADE,
  from_entity_id TEXT NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  predicate TEXT NOT NULL,
  to_entity_id TEXT REFERENCES entity(id) ON DELETE CASCADE,
  object_value TEXT,
  valid_from TEXT,
  valid_to TEXT,
  status TEXT NOT NULL,
  CHECK ((to_entity_id IS NULL) <> (object_value IS NULL))
) STRICT;

CREATE INDEX relation_projection_from_idx ON relation_projection(from_entity_id, predicate, status);
CREATE INDEX relation_projection_to_idx ON relation_projection(to_entity_id, predicate, status);

CREATE TABLE recall_run (
  id TEXT PRIMARY KEY,
  query_text TEXT NOT NULL,
  query_fingerprint TEXT NOT NULL,
  context_json TEXT NOT NULL CHECK (json_valid(context_json)),
  contradiction_sets_json TEXT NOT NULL CHECK (json_valid(contradiction_sets_json)),
  context_pack_text TEXT NOT NULL,
  context_pack_hash TEXT NOT NULL,
  selected_claim_ids_json TEXT NOT NULL CHECK (json_valid(selected_claim_ids_json)),
  char_count INTEGER NOT NULL,
  latency_ms REAL NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE recall_candidate (
  recall_id TEXT NOT NULL REFERENCES recall_run(id) ON DELETE CASCADE,
  claim_id TEXT NOT NULL,
  score REAL NOT NULL,
  reason TEXT NOT NULL,
  PRIMARY KEY (recall_id, claim_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE recall_materialization (
  id TEXT PRIMARY KEY,
  recall_id TEXT NOT NULL REFERENCES recall_run(id) ON DELETE CASCADE,
  claim_id TEXT NOT NULL,
  runtime_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  seq_start INTEGER NOT NULL CHECK (seq_start >= 0),
  seq_end INTEGER NOT NULL CHECK (seq_end >= seq_start),
  rendered_content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(recall_id, claim_id, runtime_id, session_id, seq_start, seq_end)
) STRICT;

CREATE INDEX recall_materialization_claim_idx ON recall_materialization(claim_id, session_id);

CREATE TABLE deletion_receipt (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  report_json TEXT NOT NULL CHECK (json_valid(report_json)),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX deletion_receipt_claim_idx ON deletion_receipt(claim_id, created_at);

CREATE TABLE action_receipt (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  authorization TEXT NOT NULL CHECK (authorization IN ('allowed', 'denied', 'not-required')),
  runtime_id TEXT NOT NULL,
  provider TEXT,
  result TEXT NOT NULL CHECK (result IN ('succeeded', 'failed', 'cancelled', 'denied')),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'workspace', 'session')),
  scope_id TEXT,
  source_episode_ids_json TEXT NOT NULL CHECK (json_valid(source_episode_ids_json)),
  affected_entity_ids_json TEXT NOT NULL CHECK (json_valid(affected_entity_ids_json)),
  occurred_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  CHECK ((scope_type = 'global' AND scope_id IS NULL) OR (scope_type <> 'global' AND length(scope_id) > 0))
) STRICT;

CREATE TABLE continuity_outbox (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TEXT NOT NULL,
  lease_until TEXT,
  last_error TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX continuity_outbox_ready_idx ON continuity_outbox(status, available_at, lease_until);

CREATE VIRTUAL TABLE memory_claim_fts USING fts5(
  claim_id UNINDEXED,
  statement,
  predicate,
  entity_names,
  tokenize = 'unicode61 remove_diacritics 2'
);
`;

// ../../packages/personal-core/dist/store.js
import { createHash, randomUUID } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

// ../../packages/personal-core/dist/extraction.js
var CLAIM_KINDS = ["semantic", "episodic", "procedural", "prospective", "constraint"];
var MAX_PROPOSALS = 6;
var MAX_ENTITIES = 12;
var MAX_ALIASES = 6;
var MAX_TEXT_LENGTH = 240;
var PREDICATE_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
var ENTITY_REF_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
var SECRET_PATTERN = /(?:api[ _-]?key|password|passwd|secret|access[ _-]?token|refresh[ _-]?token|private[ _-]?key|密码|口令|密钥|令牌|sk-[a-z0-9_-]{8,})/iu;
var ENTITY_KINDS = [
  "person",
  "place",
  "organization",
  "workspace",
  "project",
  "topic",
  "goal",
  "commitment",
  "decision",
  "constraint",
  "preference",
  "artifact"
];
function containsCredentialLikeContent(value) {
  return SECRET_PATTERN.test(value);
}
function record(value, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`${field} must be an object`);
  return value;
}
function text(value, field, maximum = MAX_TEXT_LENGTH) {
  if (typeof value !== "string" || value.trim().length === 0)
    throw new TypeError(`${field} must be a non-empty string`);
  const normalized = value.trim().normalize("NFKC");
  if (normalized.length > maximum)
    throw new RangeError(`${field} exceeds ${String(maximum)} characters`);
  return normalized;
}
function unit(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${field} must be between 0 and 1`);
  }
  return value;
}
function optionalIso(value, field) {
  if (value === void 0)
    return void 0;
  const result = text(value, field, 64);
  if (!Number.isFinite(Date.parse(result)))
    throw new TypeError(`${field} must be an ISO-8601 timestamp`);
  return result;
}
function entityRef(value, field) {
  const result = text(value, field, 64).toLocaleLowerCase();
  if (!ENTITY_REF_PATTERN.test(result))
    throw new TypeError(`${field} is invalid`);
  return result;
}
function boundedScope(value, field) {
  const input = record(value, field);
  if (input.type !== "workspace" && input.type !== "session")
    throw new TypeError(`${field}.type must be workspace or session`);
  return { type: input.type, id: text(input.id, `${field}.id`, 160) };
}
function proposal(value, index) {
  const input = record(value, `proposals[${String(index)}]`);
  if (typeof input.kind !== "string" || !CLAIM_KINDS.includes(input.kind)) {
    throw new TypeError(`proposals[${String(index)}].kind is invalid`);
  }
  const statement = text(input.statement, `proposals[${String(index)}].statement`);
  const objectValue = text(input.objectValue, `proposals[${String(index)}].objectValue`);
  if (containsCredentialLikeContent(`${statement}
${objectValue}`)) {
    throw new TypeError(`proposals[${String(index)}] contains credential-like content`);
  }
  const predicate = text(input.predicate, `proposals[${String(index)}].predicate`, 80).toLocaleLowerCase();
  if (!PREDICATE_PATTERN.test(predicate))
    throw new TypeError(`proposals[${String(index)}].predicate is invalid`);
  const validFrom = optionalIso(input.validFrom, `proposals[${String(index)}].validFrom`);
  const validTo = optionalIso(input.validTo, `proposals[${String(index)}].validTo`);
  if (validFrom !== void 0 && validTo !== void 0 && validTo < validFrom) {
    throw new RangeError(`proposals[${String(index)}].validTo precedes validFrom`);
  }
  if (input.sensitivity !== "personal") {
    throw new TypeError(`proposals[${String(index)}].sensitivity must be personal`);
  }
  return {
    kind: input.kind,
    statement,
    predicate,
    objectValue,
    confidence: unit(input.confidence, `proposals[${String(index)}].confidence`),
    importance: unit(input.importance, `proposals[${String(index)}].importance`),
    sensitivity: "personal",
    scope: boundedScope(input.scope, `proposals[${String(index)}].scope`),
    ...validFrom === void 0 ? {} : { validFrom },
    ...validTo === void 0 ? {} : { validTo }
  };
}
function validateExtractionEnvelope(value) {
  const input = record(value, "extraction envelope");
  if (input.schemaVersion !== 1)
    throw new TypeError("extraction envelope schemaVersion must be 1");
  const sourceEpisodeId = text(input.sourceEpisodeId, "sourceEpisodeId", 160);
  if (!Array.isArray(input.proposals))
    throw new TypeError("proposals must be an array");
  if (input.proposals.length > MAX_PROPOSALS)
    throw new RangeError(`proposals exceeds ${String(MAX_PROPOSALS)} items`);
  return {
    schemaVersion: 1,
    sourceEpisodeId,
    proposals: input.proposals.map((entry, index) => proposal(entry, index))
  };
}
function graphEntity(value, index) {
  const input = record(value, `entities[${String(index)}]`);
  const ref = entityRef(input.ref, `entities[${String(index)}].ref`);
  if (ref === "owner")
    throw new TypeError(`entities[${String(index)}].ref owner is reserved`);
  if (typeof input.kind !== "string" || !ENTITY_KINDS.includes(input.kind)) {
    throw new TypeError(`entities[${String(index)}].kind is invalid`);
  }
  const canonicalName = text(input.canonicalName, `entities[${String(index)}].canonicalName`, 120);
  if (!Array.isArray(input.aliases) || input.aliases.length > MAX_ALIASES) {
    throw new TypeError(`entities[${String(index)}].aliases must contain at most ${String(MAX_ALIASES)} items`);
  }
  const aliases = [...new Set(input.aliases.map((alias, aliasIndex) => text(alias, `entities[${String(index)}].aliases[${String(aliasIndex)}]`, 120)))].filter((alias) => alias !== canonicalName);
  if (containsCredentialLikeContent([canonicalName, ...aliases].join("\n"))) {
    throw new TypeError(`entities[${String(index)}] contains credential-like content`);
  }
  return { ref, kind: input.kind, canonicalName, aliases };
}
function graphEvent(value, index, refs) {
  const input = record(value, `events[${String(index)}]`);
  if (typeof input.kind !== "string" || !CLAIM_KINDS.includes(input.kind)) {
    throw new TypeError(`events[${String(index)}].kind is invalid`);
  }
  const subjectEntityRef = entityRef(input.subjectEntityRef, `events[${String(index)}].subjectEntityRef`);
  if (subjectEntityRef !== "owner" && !refs.has(subjectEntityRef)) {
    throw new TypeError(`events[${String(index)}].subjectEntityRef is unknown`);
  }
  const objectEntityRef = input.objectEntityRef === void 0 ? void 0 : entityRef(input.objectEntityRef, `events[${String(index)}].objectEntityRef`);
  if (objectEntityRef !== void 0 && objectEntityRef !== "owner" && !refs.has(objectEntityRef)) {
    throw new TypeError(`events[${String(index)}].objectEntityRef is unknown`);
  }
  const objectValue = input.objectValue === void 0 ? void 0 : text(input.objectValue, `events[${String(index)}].objectValue`);
  if (objectEntityRef === void 0 && objectValue === void 0 || objectEntityRef !== void 0 && objectValue !== void 0) {
    throw new TypeError(`events[${String(index)}] requires exactly one objectEntityRef or objectValue`);
  }
  const statement = text(input.statement, `events[${String(index)}].statement`);
  if (containsCredentialLikeContent(`${statement}
${objectValue ?? ""}`)) {
    throw new TypeError(`events[${String(index)}] contains credential-like content`);
  }
  const predicate = text(input.predicate, `events[${String(index)}].predicate`, 80).toLocaleLowerCase();
  if (!PREDICATE_PATTERN.test(predicate))
    throw new TypeError(`events[${String(index)}].predicate is invalid`);
  const validFrom = optionalIso(input.validFrom, `events[${String(index)}].validFrom`);
  const validTo = optionalIso(input.validTo, `events[${String(index)}].validTo`);
  if (validFrom !== void 0 && validTo !== void 0 && validTo < validFrom) {
    throw new RangeError(`events[${String(index)}].validTo precedes validFrom`);
  }
  if (input.sensitivity !== "personal") {
    throw new TypeError(`events[${String(index)}].sensitivity must be personal`);
  }
  return {
    kind: input.kind,
    statement,
    predicate,
    subjectEntityRef,
    ...objectEntityRef === void 0 ? {} : { objectEntityRef },
    ...objectValue === void 0 ? {} : { objectValue },
    confidence: unit(input.confidence, `events[${String(index)}].confidence`),
    importance: unit(input.importance, `events[${String(index)}].importance`),
    sensitivity: "personal",
    ...validFrom === void 0 ? {} : { validFrom },
    ...validTo === void 0 ? {} : { validTo }
  };
}
function validateGraphExtractionEnvelope(value) {
  const input = record(value, "graph extraction envelope");
  if (input.schemaVersion !== 2)
    throw new TypeError("graph extraction envelope schemaVersion must be 2");
  const sourceEpisodeId = text(input.sourceEpisodeId, "sourceEpisodeId", 160);
  const scope2 = boundedScope(input.scope, "scope");
  if (!Array.isArray(input.entities) || input.entities.length > MAX_ENTITIES) {
    throw new RangeError(`entities must contain at most ${String(MAX_ENTITIES)} items`);
  }
  const entities = input.entities.map((entry, index) => graphEntity(entry, index));
  const refs = /* @__PURE__ */ new Set();
  for (const entity of entities) {
    if (refs.has(entity.ref))
      throw new TypeError(`duplicate entity ref ${entity.ref}`);
    refs.add(entity.ref);
  }
  if (!Array.isArray(input.events) || input.events.length > MAX_PROPOSALS) {
    throw new RangeError(`events must contain at most ${String(MAX_PROPOSALS)} items`);
  }
  const events = input.events.map((entry, index) => graphEvent(entry, index, refs));
  const usedRefs = new Set(events.flatMap((event) => [event.subjectEntityRef, event.objectEntityRef].filter((ref) => ref !== void 0 && ref !== "owner")));
  for (const entity of entities) {
    if (!usedRefs.has(entity.ref))
      throw new TypeError(`entity ref ${entity.ref} is not used by an event`);
  }
  return { schemaVersion: 2, sourceEpisodeId, scope: scope2, entities, events };
}

// ../../packages/personal-core/dist/store.js
var ACTIVE_CLAIM_STATUSES = /* @__PURE__ */ new Set(["confirmed"]);
var DEFAULT_ALLOWED_SENSITIVITIES = ["personal"];
var DEFAULT_MAX_CLAIMS = 8;
var DEFAULT_MAX_CHARS = 2400;
var DEFAULT_GRAPH_DEPTH = 2;
var DEFAULT_MIN_SCORE = 0.12;
function asString(value, field) {
  if (typeof value !== "string")
    throw new TypeError(`expected ${field} to be a string`);
  return value;
}
function asOptionalString(value) {
  return typeof value === "string" ? value : void 0;
}
function asNumber(value, field) {
  if (typeof value !== "number" && typeof value !== "bigint")
    throw new TypeError(`expected ${field} to be a number`);
  return Number(value);
}
function assertNonEmpty(value, field) {
  const normalized = value.trim();
  if (normalized.length === 0)
    throw new TypeError(`${field} must not be empty`);
  return normalized;
}
function assertUnitInterval(value, field) {
  if (!Number.isFinite(value) || value < 0 || value > 1)
    throw new RangeError(`${field} must be between 0 and 1`);
  return value;
}
function assertIso(value, field) {
  if (!Number.isFinite(Date.parse(value)))
    throw new TypeError(`${field} must be an ISO-8601 timestamp`);
  return value;
}
function normalizedText(value) {
  return value.trim().normalize("NFKC").toLocaleLowerCase();
}
function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}
function canonicalJson(value) {
  if (value === void 0 || value === null)
    return "null";
  if (typeof value !== "object")
    return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map(canonicalJson).join(",")}]`;
  const record5 = value;
  return `{${Object.keys(record5).filter((key) => record5[key] !== void 0).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record5[key])}`).join(",")}}`;
}
function scopeColumns(scope2) {
  if (scope2.type === "global")
    return { scopeType: "global", scopeId: null };
  return { scopeType: scope2.type, scopeId: assertNonEmpty(scope2.id, "scope.id") };
}
function scopeFromRow(row) {
  const type = asString(row.scope_type, "scope_type");
  if (type === "global")
    return { type };
  return { type, id: asString(row.scope_id, "scope_id") };
}
function parseJson(value, field) {
  return JSON.parse(asString(value, field));
}
function ftsQuery(query) {
  const tokens = normalizedText(query).match(/[\p{L}\p{N}_-]+/gu);
  if (tokens === null || tokens.length === 0)
    return void 0;
  return [...new Set(tokens)].slice(0, 12).map((token) => `"${token.replaceAll('"', '""')}"*`).join(" OR ");
}
function millisecondsBetween(now, past) {
  return Math.max(0, Date.parse(now) - Date.parse(past));
}
var PersonalCoreSchemaTooNewError = class extends Error {
  foundVersion;
  constructor(foundVersion) {
    super(`personal core schema ${String(foundVersion)} is newer than supported version ${String(PERSONAL_CORE_SCHEMA_VERSION)}`);
    this.foundVersion = foundVersion;
    this.name = "PersonalCoreSchemaTooNewError";
  }
};
var PersonalContinuityStore = class {
  databasePath;
  db;
  now;
  idFactory;
  closed = false;
  constructor(options) {
    this.databasePath = options.databasePath === ":memory:" ? ":memory:" : resolve(options.databasePath);
    this.now = options.now ?? (() => /* @__PURE__ */ new Date());
    this.idFactory = options.idFactory ?? ((prefix) => `${prefix}_${randomUUID()}`);
    if (this.databasePath !== ":memory:")
      mkdirSync(dirname(this.databasePath), { recursive: true, mode: 448 });
    this.db = new DatabaseSync(this.databasePath);
    if (this.databasePath !== ":memory:" && process.platform !== "win32")
      chmodSync(this.databasePath, 384);
    this.configure();
    this.migrate();
  }
  close() {
    if (this.closed)
      return;
    this.closed = true;
    this.db.close();
  }
  integrityCheck() {
    this.assertOpen();
    const row = this.db.prepare("PRAGMA integrity_check").get();
    return asString(Object.values(row)[0], "integrity_check");
  }
  schemaVersion() {
    this.assertOpen();
    const row = this.db.prepare("SELECT max(version) AS version FROM schema_migration").get();
    return row.version === null ? 0 : asNumber(row.version, "version");
  }
  createSourceEpisode(input) {
    this.assertOpen();
    const sourceKind = assertNonEmpty(input.sourceKind, "sourceKind");
    const sourceInstanceId = assertNonEmpty(input.sourceInstanceId, "sourceInstanceId");
    const hasSeqStart = input.seqStart !== void 0;
    const hasSeqEnd = input.seqEnd !== void 0;
    if (hasSeqStart !== hasSeqEnd) {
      throw new TypeError("seqStart and seqEnd must be provided together");
    }
    if (input.seqStart !== void 0 && (!Number.isInteger(input.seqStart) || input.seqStart < 0 || input.seqEnd < input.seqStart)) {
      throw new RangeError("source sequence range is invalid");
    }
    const observedAt = assertIso(input.observedAt ?? this.isoNow(), "observedAt");
    const recordedAt = this.isoNow();
    const contentHash = input.contentHash ?? hash(input.content ?? canonicalJson({
      sourceKind,
      sourceInstanceId,
      sessionId: input.sessionId,
      seqStart: input.seqStart,
      seqEnd: input.seqEnd
    }));
    const existing = this.db.prepare(`
      SELECT * FROM source_episode
      WHERE source_kind = ? AND source_instance_id = ? AND ifnull(session_id, '') = ifnull(?, '')
        AND ifnull(seq_start, -1) = ifnull(?, -1) AND ifnull(seq_end, -1) = ifnull(?, -1)
    `).get(sourceKind, sourceInstanceId, input.sessionId ?? null, input.seqStart ?? null, input.seqEnd ?? null);
    if (existing !== void 0) {
      const episode = this.sourceEpisodeFromRow(existing);
      if (episode.contentHash !== contentHash)
        throw new Error(`source episode origin already exists with different content: ${episode.id}`);
      return episode;
    }
    const id = input.id ?? this.newId("src");
    this.db.prepare(`
      INSERT INTO source_episode (
        id, source_kind, runtime_id, source_instance_id, session_id, seq_start, seq_end,
        observed_at, recorded_at, content, content_hash, sensitivity, deletion_state
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(id, sourceKind, input.runtimeId ?? null, sourceInstanceId, input.sessionId ?? null, input.seqStart ?? null, input.seqEnd ?? null, observedAt, recordedAt, input.content ?? null, contentHash, input.sensitivity ?? "personal");
    return this.requireSourceEpisode(id);
  }
  getSourceEpisode(id) {
    this.assertOpen();
    const row = this.db.prepare("SELECT * FROM source_episode WHERE id = ?").get(id);
    return row === void 0 ? void 0 : this.sourceEpisodeFromRow(row);
  }
  listSourceEpisodes(options = {}) {
    this.assertOpen();
    const conditions = [];
    const params = [];
    if (options.sessionId !== void 0) {
      conditions.push("session_id = ?");
      params.push(options.sessionId);
    }
    if (options.deletionStates !== void 0 && options.deletionStates.length > 0) {
      conditions.push(`deletion_state IN (${options.deletionStates.map(() => "?").join(",")})`);
      params.push(...options.deletionStates);
    }
    const limit = Math.max(1, Math.min(options.limit ?? 100, 1e3));
    const sql = `SELECT * FROM source_episode ${conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`} ORDER BY observed_at DESC, id DESC LIMIT ?`;
    params.push(limit);
    return this.db.prepare(sql).all(...params).map((row) => this.sourceEpisodeFromRow(row));
  }
  createEntity(input) {
    this.assertOpen();
    const existingEvent = this.eventByIdempotencyKey(input.idempotencyKey);
    if (existingEvent !== void 0)
      return this.requireEntity(existingEvent.aggregateId);
    const id = input.id ?? this.newId("ent");
    const canonicalName = assertNonEmpty(input.canonicalName, "canonicalName");
    const occurredAt = assertIso(input.occurredAt ?? this.isoNow(), "occurredAt");
    const recordedAt = this.isoNow();
    const { scopeType, scopeId } = scopeColumns(input.scope);
    const sourceEpisodeIds = [...input.sourceEpisodeIds ?? []];
    this.assertSources(sourceEpisodeIds);
    this.transaction(() => {
      this.db.prepare(`
        INSERT INTO entity (id, kind, canonical_name, scope_type, scope_id, status, created_at, updated_at, revision)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, 1)
      `).run(id, input.kind, canonicalName, scopeType, scopeId, recordedAt, recordedAt);
      this.insertEvent({
        eventType: "entity.created",
        aggregateId: id,
        payload: { kind: input.kind, canonicalNameHash: hash(canonicalName) },
        scope: input.scope,
        sourceEpisodeIds,
        actor: input.actor ?? "user",
        occurredAt,
        idempotencyKey: input.idempotencyKey
      });
    });
    return this.requireEntity(id);
  }
  getEntity(id) {
    this.assertOpen();
    const row = this.db.prepare("SELECT * FROM entity WHERE id = ?").get(id);
    return row === void 0 ? void 0 : this.entityFromRow(row);
  }
  listEntities(options = {}) {
    this.assertOpen();
    const conditions = ["status <> 'deleted'"];
    const params = [];
    if (options.scope !== void 0) {
      const { scopeType, scopeId } = scopeColumns(options.scope);
      conditions.push("scope_type = ? AND ifnull(scope_id, '') = ifnull(?, '')");
      params.push(scopeType, scopeId);
    }
    if (options.kinds !== void 0 && options.kinds.length > 0) {
      conditions.push(`kind IN (${options.kinds.map(() => "?").join(",")})`);
      params.push(...options.kinds);
    }
    const limit = Math.max(1, Math.min(options.limit ?? 100, 1e3));
    params.push(limit);
    return this.db.prepare(`
      SELECT * FROM entity WHERE ${conditions.join(" AND ")}
      ORDER BY updated_at DESC, id DESC LIMIT ?
    `).all(...params).map((row) => this.entityFromRow(row));
  }
  addAlias(input) {
    this.assertOpen();
    const existingEvent = this.eventByIdempotencyKey(input.idempotencyKey);
    if (existingEvent !== void 0) {
      const aliasId = String(existingEvent.payload.aliasId ?? "");
      return this.requireAlias(aliasId);
    }
    this.requireEntity(input.entityId);
    if (input.sourceEpisodeId !== void 0)
      this.requireSourceEpisode(input.sourceEpisodeId);
    const alias = assertNonEmpty(input.alias, "alias");
    const normalizedAlias = normalizedText(alias);
    const id = input.id ?? this.newId("alias");
    const recordedAt = this.isoNow();
    const occurredAt = assertIso(input.occurredAt ?? recordedAt, "occurredAt");
    const { scopeType, scopeId } = scopeColumns(input.scope);
    this.transaction(() => {
      this.db.prepare(`
        INSERT INTO entity_alias (id, entity_id, alias, normalized_alias, scope_type, scope_id, source_episode_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, input.entityId, alias, normalizedAlias, scopeType, scopeId, input.sourceEpisodeId ?? null, recordedAt);
      this.insertEvent({
        eventType: "entity.aliased",
        aggregateId: input.entityId,
        payload: { aliasId: id, aliasHash: hash(alias) },
        scope: input.scope,
        sourceEpisodeIds: input.sourceEpisodeId === void 0 ? [] : [input.sourceEpisodeId],
        actor: input.actor ?? "user",
        occurredAt,
        idempotencyKey: input.idempotencyKey
      });
      this.refreshClaimSearchForEntity(input.entityId);
    });
    return this.requireAlias(id);
  }
  listAliases(entityId) {
    this.assertOpen();
    return this.db.prepare("SELECT * FROM entity_alias WHERE entity_id = ? ORDER BY created_at, id").all(entityId).map((row) => this.aliasFromRow(row));
  }
  remember(input) {
    return this.writeClaim(input, void 0, input.status ?? "confirmed");
  }
  correct(input) {
    this.assertOpen();
    const existingEvent = this.eventByIdempotencyKey(input.idempotencyKey);
    if (existingEvent !== void 0) {
      return this.requireClaim(String(existingEvent.payload.claimId ?? existingEvent.aggregateId));
    }
    const previous = this.requireClaim(input.claimId);
    if (!ACTIVE_CLAIM_STATUSES.has(previous.status) && previous.status !== "candidate" && previous.status !== "contradicted") {
      throw new Error(`claim ${input.claimId} cannot be corrected from status ${previous.status}`);
    }
    const replacement = this.writeClaim(input, previous, input.status ?? "confirmed");
    return replacement;
  }
  contradict(claimId, input) {
    return this.transitionClaim(claimId, "contradicted", "claim.contradicted", input);
  }
  expire(claimId, input) {
    return this.transitionClaim(claimId, "expired", "claim.expired", { ...input, sourceEpisodeIds: [] });
  }
  revoke(claimId, input) {
    return this.transitionClaim(claimId, "revoked", "claim.revoked", {
      ...input,
      sourceEpisodeIds: input.sourceEpisodeIds ?? []
    });
  }
  confirmCandidate(input) {
    this.assertOpen();
    const existing = this.eventByIdempotencyKey(input.idempotencyKey);
    if (existing !== void 0)
      return this.requireClaim(input.claimId);
    const claim = this.requireClaim(input.claimId);
    if (claim.status !== "candidate")
      throw new Error(`claim ${claim.id} cannot be confirmed from status ${claim.status}`);
    this.assertSources(input.sourceEpisodeIds);
    const occurredAt = assertIso(input.occurredAt ?? this.isoNow(), "occurredAt");
    this.transaction(() => {
      this.db.prepare("UPDATE memory_claim SET status = 'confirmed', revision = revision + 1 WHERE id = ?").run(claim.id);
      const attach = this.db.prepare("INSERT OR IGNORE INTO claim_source (claim_id, source_episode_id) VALUES (?, ?)");
      for (const sourceEpisodeId of new Set(input.sourceEpisodeIds))
        attach.run(claim.id, sourceEpisodeId);
      this.projectClaim(this.requireClaim(claim.id));
      this.insertEvent({
        eventType: "claim.confirmed",
        aggregateId: claim.id,
        payload: { claimId: claim.id, contentHash: claim.contentHash, status: "confirmed" },
        scope: claim.scope,
        sourceEpisodeIds: input.sourceEpisodeIds,
        actor: input.actor ?? "user",
        occurredAt,
        idempotencyKey: input.idempotencyKey
      });
    });
    return this.requireClaim(claim.id);
  }
  applyExtractionBatch(value, input) {
    this.assertOpen();
    const envelope = validateExtractionEnvelope(value);
    this.requireEntity(input.subjectEntityId);
    this.requireSourceEpisode(envelope.sourceEpisodeId);
    const outcomes = [];
    this.transaction(() => {
      for (const [proposalIndex, proposal2] of envelope.proposals.entries()) {
        const { scopeType, scopeId } = scopeColumns(proposal2.scope);
        const rows = this.db.prepare(`
          SELECT * FROM memory_claim
          WHERE subject_entity_id = ? AND status IN ('candidate', 'confirmed')
            AND scope_type = ? AND ifnull(scope_id, '') = ifnull(?, '')
        `).all(input.subjectEntityId, scopeType, scopeId);
        const related = rows.map((row) => this.claimFromRow(row)).filter((claim2) => normalizedText(claim2.predicate) === normalizedText(proposal2.predicate));
        const duplicate = related.find((claim2) => normalizedText(claim2.objectValue ?? "") === normalizedText(proposal2.objectValue));
        const conflictingClaimIds = related.filter((claim2) => normalizedText(claim2.objectValue ?? "") !== normalizedText(proposal2.objectValue)).map((claim2) => claim2.id).sort();
        if (duplicate !== void 0) {
          outcomes.push({ proposalIndex, decision: "duplicate", claimId: duplicate.id, conflictingClaimIds });
          continue;
        }
        const claim = this.remember({
          ...proposal2,
          subjectEntityId: input.subjectEntityId,
          status: "candidate",
          sourceEpisodeIds: [envelope.sourceEpisodeId],
          actor: input.actor ?? "agent",
          idempotencyKey: `${assertNonEmpty(input.idempotencyKey, "idempotencyKey")}:${String(proposalIndex)}`
        });
        outcomes.push({ proposalIndex, decision: "created-candidate", claimId: claim.id, conflictingClaimIds });
      }
    });
    return { schemaVersion: 1, sourceEpisodeId: envelope.sourceEpisodeId, outcomes };
  }
  /**
   * Atomically resolves evidence-grounded identity handles and writes their
   * time-aware relations as reviewable candidates. The reserved `owner` ref
   * is supplied by the product boundary, never by the model.
   */
  applyGraphExtractionBatch(value, input) {
    this.assertOpen();
    const envelope = validateGraphExtractionEnvelope(value);
    this.requireEntity(input.ownerEntityId);
    const source2 = this.requireSourceEpisode(envelope.sourceEpisodeId);
    const entityIds = /* @__PURE__ */ new Map([["owner", input.ownerEntityId]]);
    const entities = [];
    const outcomes = [];
    const batchKey = assertNonEmpty(input.idempotencyKey, "idempotencyKey");
    this.transaction(() => {
      for (const entity of envelope.entities) {
        const existing = this.findExtractionEntity(entity.kind, entity.canonicalName, entity.aliases, envelope.scope);
        const resolved = existing ?? this.createEntity({
          kind: entity.kind,
          canonicalName: entity.canonicalName,
          scope: envelope.scope,
          sourceEpisodeIds: [envelope.sourceEpisodeId],
          actor: input.actor ?? "agent",
          occurredAt: source2.observedAt,
          idempotencyKey: `${batchKey}:entity:${entity.ref}`
        });
        entityIds.set(entity.ref, resolved.id);
        entities.push({
          ref: entity.ref,
          entityId: resolved.id,
          decision: existing === void 0 ? "created" : "reused"
        });
        const knownAliases = new Set(this.listAliases(resolved.id).map((alias) => alias.normalizedAlias));
        for (const [aliasIndex, alias] of entity.aliases.entries()) {
          if (knownAliases.has(normalizedText(alias)))
            continue;
          this.addAlias({
            entityId: resolved.id,
            alias,
            scope: envelope.scope,
            sourceEpisodeId: envelope.sourceEpisodeId,
            actor: input.actor ?? "agent",
            occurredAt: source2.observedAt,
            idempotencyKey: `${batchKey}:entity:${entity.ref}:alias:${String(aliasIndex)}`
          });
          knownAliases.add(normalizedText(alias));
        }
      }
      for (const [eventIndex, event] of envelope.events.entries()) {
        const subjectEntityId = entityIds.get(event.subjectEntityRef);
        const objectEntityId = event.objectEntityRef === void 0 ? void 0 : entityIds.get(event.objectEntityRef);
        if (subjectEntityId === void 0 || event.objectEntityRef !== void 0 && objectEntityId === void 0) {
          throw new Error(`graph extraction event ${String(eventIndex)} contains an unresolved entity ref`);
        }
        const { scopeType, scopeId } = scopeColumns(envelope.scope);
        const rows = this.db.prepare(`
          SELECT * FROM memory_claim
          WHERE subject_entity_id = ? AND status IN ('candidate', 'confirmed')
            AND scope_type = ? AND ifnull(scope_id, '') = ifnull(?, '')
        `).all(subjectEntityId, scopeType, scopeId);
        const related = rows.map((row) => this.claimFromRow(row)).filter((claim2) => normalizedText(claim2.predicate) === normalizedText(event.predicate));
        const duplicate = related.find((claim2) => claim2.objectEntityId === objectEntityId && normalizedText(claim2.objectValue ?? "") === normalizedText(event.objectValue ?? "") && claim2.validFrom === event.validFrom && claim2.validTo === event.validTo);
        const conflictingClaimIds = event.kind === "episodic" || event.kind === "prospective" ? [] : related.filter((claim2) => claim2.id !== duplicate?.id && (claim2.objectEntityId !== objectEntityId || normalizedText(claim2.objectValue ?? "") !== normalizedText(event.objectValue ?? ""))).map((claim2) => claim2.id).sort();
        if (duplicate !== void 0) {
          outcomes.push({ eventIndex, decision: "duplicate", claimId: duplicate.id, conflictingClaimIds });
          continue;
        }
        const claim = this.remember({
          kind: event.kind,
          statement: event.statement,
          predicate: event.predicate,
          subjectEntityId,
          ...objectEntityId === void 0 ? { objectValue: event.objectValue } : { objectEntityId },
          status: "candidate",
          confidence: event.confidence,
          importance: event.importance,
          sensitivity: event.sensitivity,
          scope: envelope.scope,
          validFrom: event.validFrom,
          validTo: event.validTo,
          observedAt: source2.observedAt,
          sourceEpisodeIds: [envelope.sourceEpisodeId],
          actor: input.actor ?? "agent",
          idempotencyKey: `${batchKey}:event:${String(eventIndex)}`
        });
        outcomes.push({ eventIndex, decision: "created-candidate", claimId: claim.id, conflictingClaimIds });
      }
    });
    return { schemaVersion: 2, sourceEpisodeId: envelope.sourceEpisodeId, entities, outcomes };
  }
  getClaim(id) {
    this.assertOpen();
    const row = this.db.prepare("SELECT * FROM memory_claim WHERE id = ?").get(id);
    return row === void 0 ? void 0 : this.claimFromRow(row);
  }
  listClaims(options = {}) {
    this.assertOpen();
    const conditions = [];
    const params = [];
    if (options.statuses !== void 0 && options.statuses.length > 0) {
      conditions.push(`status IN (${options.statuses.map(() => "?").join(",")})`);
      params.push(...options.statuses);
    }
    if (options.scope !== void 0) {
      const { scopeType, scopeId } = scopeColumns(options.scope);
      conditions.push("scope_type = ? AND ifnull(scope_id, '') = ifnull(?, '')");
      params.push(scopeType, scopeId);
    }
    const limit = Math.max(1, Math.min(options.limit ?? 100, 1e3));
    const sql = `SELECT * FROM memory_claim ${conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`} ORDER BY recorded_at DESC, id LIMIT ?`;
    params.push(limit);
    return this.db.prepare(sql).all(...params).map((row) => this.claimFromRow(row));
  }
  listEvents(aggregateId) {
    this.assertOpen();
    const rows = aggregateId === void 0 ? this.db.prepare("SELECT * FROM entity_event ORDER BY recorded_at, id").all() : this.db.prepare("SELECT * FROM entity_event WHERE aggregate_id = ? ORDER BY recorded_at, id").all(aggregateId);
    return rows.map((row) => this.eventFromRow(row));
  }
  listRelations(options = {}) {
    this.assertOpen();
    const conditions = [];
    const params = [];
    if (options.entityId !== void 0) {
      conditions.push("(from_entity_id = ? OR to_entity_id = ?)");
      params.push(options.entityId, options.entityId);
    }
    if (options.statuses !== void 0 && options.statuses.length > 0) {
      conditions.push(`status IN (${options.statuses.map(() => "?").join(",")})`);
      params.push(...options.statuses);
    }
    const limit = Math.max(1, Math.min(options.limit ?? 200, 2e3));
    params.push(limit);
    return this.db.prepare(`
      SELECT * FROM relation_projection
      ${conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`}
      ORDER BY claim_id LIMIT ?
    `).all(...params).map((row) => ({
      claimId: asString(row.claim_id, "claim_id"),
      fromEntityId: asString(row.from_entity_id, "from_entity_id"),
      predicate: asString(row.predicate, "predicate"),
      toEntityId: asOptionalString(row.to_entity_id),
      objectValue: asOptionalString(row.object_value),
      validFrom: asOptionalString(row.valid_from),
      validTo: asOptionalString(row.valid_to),
      status: asString(row.status, "status")
    }));
  }
  recall(query, context = {}, options = {}) {
    this.assertOpen();
    const started = performance.now();
    const createdAt = this.isoNow();
    const at = assertIso(context.at ?? createdAt, "context.at");
    const maxClaims = Math.max(1, Math.min(options.maxClaims ?? DEFAULT_MAX_CLAIMS, 50));
    const maxChars = Math.max(128, Math.min(options.maxChars ?? DEFAULT_MAX_CHARS, 2e4));
    const graphDepth = Math.max(0, Math.min(options.graphDepth ?? DEFAULT_GRAPH_DEPTH, 4));
    const minScore = Math.max(0, Math.min(options.minScore ?? DEFAULT_MIN_SCORE, 1));
    const allowedSensitivities = context.allowedSensitivities ?? DEFAULT_ALLOWED_SENSITIVITIES;
    const candidateIds = this.candidateClaimIds(query, context, graphDepth);
    const candidates = [];
    const scored = [];
    for (const claimId of candidateIds) {
      const claim = this.getClaim(claimId);
      if (claim === void 0)
        continue;
      const denied = this.recallDenialReason(claim, context, at, allowedSensitivities);
      if (denied !== void 0) {
        candidates.push({ claimId, score: 0, reason: denied });
        continue;
      }
      const score = this.scoreClaim(claim, query, at);
      if (score < minScore) {
        candidates.push({ claimId, score, reason: "below-score" });
      } else {
        scored.push({ claim, score });
      }
    }
    scored.sort((left, right) => right.score - left.score || right.claim.recordedAt.localeCompare(left.claim.recordedAt) || left.claim.id.localeCompare(right.claim.id));
    const selected = [];
    for (const entry of scored) {
      const tentative = [...selected, entry.claim];
      const tentativeContradictions = this.findContradictionSets(tentative);
      if (selected.length >= maxClaims || this.renderContextPack("budget-check", tentative, tentativeContradictions).length > maxChars) {
        candidates.push({ claimId: entry.claim.id, score: entry.score, reason: "over-budget" });
        continue;
      }
      selected.push(entry.claim);
      candidates.push({ claimId: entry.claim.id, score: entry.score, reason: "selected" });
    }
    const contradictionSets = this.findContradictionSets(selected);
    const id = this.newId("recall");
    const text3 = this.renderContextPack(id, selected, contradictionSets);
    const contextPack = {
      recallId: id,
      text: text3,
      claimIds: selected.map((claim) => claim.id),
      contentHash: hash(text3),
      charCount: text3.length
    };
    const latencyMs = performance.now() - started;
    this.transaction(() => {
      this.db.prepare(`
        INSERT INTO recall_run (
          id, query_text, query_fingerprint, context_json, contradiction_sets_json,
          context_pack_text, context_pack_hash, selected_claim_ids_json, char_count,
          latency_ms, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, query, hash(normalizedText(query)), canonicalJson({ ...context, at, allowedSensitivities }), canonicalJson(contradictionSets), text3, contextPack.contentHash, canonicalJson(contextPack.claimIds), contextPack.charCount, latencyMs, createdAt);
      const insert = this.db.prepare("INSERT INTO recall_candidate (recall_id, claim_id, score, reason) VALUES (?, ?, ?, ?)");
      for (const candidate of candidates)
        insert.run(id, candidate.claimId, candidate.score, candidate.reason);
    });
    return {
      id,
      query,
      queryFingerprint: hash(normalizedText(query)),
      context: { ...context, at, allowedSensitivities },
      candidates: candidates.sort((left, right) => right.score - left.score || left.claimId.localeCompare(right.claimId)),
      selectedClaims: selected,
      contradictionSets,
      contextPack,
      latencyMs,
      createdAt
    };
  }
  explainRecall(id) {
    this.assertOpen();
    const row = this.db.prepare("SELECT * FROM recall_run WHERE id = ?").get(id);
    if (row === void 0)
      return void 0;
    const context = parseJson(row.context_json, "context_json");
    const selectedIds = parseJson(row.selected_claim_ids_json, "selected_claim_ids_json");
    const candidates = this.db.prepare("SELECT * FROM recall_candidate WHERE recall_id = ? ORDER BY score DESC, claim_id").all(id).map((candidate) => ({
      claimId: asString(candidate.claim_id, "claim_id"),
      score: asNumber(candidate.score, "score"),
      reason: asString(candidate.reason, "reason")
    }));
    const selectedClaims = selectedIds.map((claimId) => this.getClaim(claimId)).filter((claim) => claim !== void 0);
    const text3 = asString(row.context_pack_text, "context_pack_text");
    return {
      id,
      query: asString(row.query_text, "query_text"),
      queryFingerprint: asString(row.query_fingerprint, "query_fingerprint"),
      context,
      candidates,
      selectedClaims,
      contradictionSets: parseJson(row.contradiction_sets_json, "contradiction_sets_json"),
      contextPack: {
        recallId: id,
        text: text3,
        claimIds: selectedIds,
        contentHash: asString(row.context_pack_hash, "context_pack_hash"),
        charCount: asNumber(row.char_count, "char_count")
      },
      latencyMs: asNumber(row.latency_ms, "latency_ms"),
      createdAt: asString(row.created_at, "created_at")
    };
  }
  listRecallDecisions(options = {}) {
    this.assertOpen();
    const conditions = [];
    const params = [];
    if (options.sessionId !== void 0) {
      conditions.push("json_extract(context_json, '$.sessionId') = ?");
      params.push(assertNonEmpty(options.sessionId, "sessionId"));
    }
    if (options.claimId !== void 0) {
      conditions.push("EXISTS (SELECT 1 FROM json_each(selected_claim_ids_json) WHERE value = ?)");
      params.push(assertNonEmpty(options.claimId, "claimId"));
    }
    const limit = Math.max(1, Math.min(Math.trunc(options.limit ?? 50), 500));
    params.push(limit);
    const where = conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`;
    const rows = this.db.prepare(`
      SELECT id FROM recall_run ${where}
      ORDER BY created_at DESC, id DESC LIMIT ?
    `).all(...params);
    return rows.map((row) => this.explainRecall(asString(row.id, "id"))).filter((decision) => decision !== void 0);
  }
  recordMaterialization(input) {
    this.assertOpen();
    if (!Number.isInteger(input.seqStart) || input.seqStart < 0 || !Number.isInteger(input.seqEnd) || input.seqEnd < input.seqStart) {
      throw new RangeError("materialization sequence range is invalid");
    }
    const recall = this.explainRecall(input.recallId);
    if (recall === void 0)
      throw new Error(`unknown recall ${input.recallId}`);
    const createdAt = this.isoNow();
    this.transaction(() => {
      const insert = this.db.prepare(`
        INSERT OR IGNORE INTO recall_materialization (
          id, recall_id, claim_id, runtime_id, session_id, seq_start, seq_end,
          rendered_content_hash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const claimId of recall.contextPack.claimIds) {
        insert.run(this.newId("mat"), input.recallId, claimId, assertNonEmpty(input.runtimeId, "runtimeId"), assertNonEmpty(input.sessionId, "sessionId"), input.seqStart, input.seqEnd, input.renderedContentHash, createdAt);
      }
    });
    return this.listMaterializationsForRecall(input.recallId);
  }
  listMaterializations(options = {}) {
    this.assertOpen();
    const conditions = [];
    const params = [];
    for (const [column, value, field] of [
      ["recall_id", options.recallId, "recallId"],
      ["claim_id", options.claimId, "claimId"],
      ["session_id", options.sessionId, "sessionId"]
    ]) {
      if (value === void 0)
        continue;
      conditions.push(`${column} = ?`);
      params.push(assertNonEmpty(value, field));
    }
    const limit = Math.max(1, Math.min(Math.trunc(options.limit ?? 100), 1e3));
    params.push(limit);
    const where = conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`;
    return this.db.prepare(`
      SELECT * FROM recall_materialization ${where}
      ORDER BY created_at DESC, id DESC LIMIT ?
    `).all(...params).map((row) => this.materializationFromRow(row));
  }
  forget(claimId, options) {
    this.assertOpen();
    const existingReceipt = this.db.prepare("SELECT report_json FROM deletion_receipt WHERE idempotency_key = ?").get(assertNonEmpty(options.idempotencyKey, "idempotencyKey"));
    if (existingReceipt !== void 0)
      return parseJson(existingReceipt.report_json, "report_json");
    const claim = this.requireClaim(claimId);
    const receiptId = this.newId("deletion");
    const completedAt = this.isoNow();
    const sourceStates = [];
    const derivatives = this.listMaterializationsForClaim(claimId).map((materialization) => ({
      runtimeId: materialization.runtimeId,
      sessionId: materialization.sessionId,
      seqStart: materialization.seqStart,
      seqEnd: materialization.seqEnd,
      state: "requires-session-deletion"
    }));
    const report = {
      receiptId,
      claimId,
      revoked: true,
      physicallyPurged: options.physical === true,
      sourceStates,
      derivatives,
      completedAt
    };
    this.transaction(() => {
      if (claim.status !== "revoked") {
        this.transitionClaimInTransaction(claim, "revoked", "claim.revoked", {
          sourceEpisodeIds: [],
          actor: options.actor ?? "user",
          occurredAt: completedAt,
          idempotencyKey: options.idempotencyKey
        });
      }
      for (const sourceEpisodeId of claim.sourceEpisodeIds) {
        const activeReferences = asNumber(this.db.prepare(`
          SELECT count(*) AS count
          FROM claim_source cs JOIN memory_claim mc ON mc.id = cs.claim_id
          WHERE cs.source_episode_id = ? AND cs.claim_id <> ? AND mc.status NOT IN ('revoked', 'expired')
        `).get(sourceEpisodeId, claimId).count, "count");
        if (options.purgeSourceContent === true && activeReferences === 0) {
          this.db.prepare("UPDATE source_episode SET content = NULL, deletion_state = 'purged' WHERE id = ?").run(sourceEpisodeId);
          sourceStates.push({ sourceEpisodeId, state: "purged" });
        } else {
          sourceStates.push({ sourceEpisodeId, state: "retained-reference" });
        }
      }
      if (options.physical === true) {
        this.db.prepare(`
          DELETE FROM recall_run WHERE id IN (
            SELECT rr.id
            FROM recall_run rr, json_each(rr.selected_claim_ids_json) selected
            WHERE selected.value = ?
            UNION
            SELECT recall_id FROM recall_candidate WHERE claim_id = ?
            UNION
            SELECT recall_id FROM recall_materialization WHERE claim_id = ?
          )
        `).run(claimId, claimId, claimId);
        this.db.prepare("DELETE FROM memory_claim WHERE id = ?").run(claimId);
      }
      this.db.prepare(`
        INSERT INTO deletion_receipt (id, claim_id, report_json, idempotency_key, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(receiptId, claimId, canonicalJson(report), options.idempotencyKey, completedAt);
    });
    return report;
  }
  listForgetReports(claimId) {
    this.assertOpen();
    const rows = claimId === void 0 ? this.db.prepare("SELECT report_json FROM deletion_receipt ORDER BY created_at DESC, id DESC").all() : this.db.prepare("SELECT report_json FROM deletion_receipt WHERE claim_id = ? ORDER BY created_at DESC, id DESC").all(claimId);
    return rows.map((row) => parseJson(row.report_json, "report_json"));
  }
  recordActionReceipt(input) {
    this.assertOpen();
    const existing = this.db.prepare("SELECT * FROM action_receipt WHERE idempotency_key = ?").get(input.idempotencyKey);
    if (existing !== void 0)
      return this.actionReceiptFromRow(existing);
    this.assertSources(input.sourceEpisodeIds);
    for (const entityId of input.affectedEntityIds ?? [])
      this.requireEntity(entityId);
    const id = input.id ?? this.newId("receipt");
    const occurredAt = assertIso(input.occurredAt ?? this.isoNow(), "occurredAt");
    const recordedAt = this.isoNow();
    const { scopeType, scopeId } = scopeColumns(input.scope);
    this.transaction(() => {
      this.db.prepare(`
        INSERT INTO action_receipt (
          id, action, authorization, runtime_id, provider, result, scope_type,
          scope_id, source_episode_ids_json, affected_entity_ids_json, occurred_at,
          recorded_at, idempotency_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, assertNonEmpty(input.action, "action"), input.authorization, assertNonEmpty(input.runtimeId, "runtimeId"), input.provider ?? null, input.result, scopeType, scopeId, canonicalJson(input.sourceEpisodeIds), canonicalJson(input.affectedEntityIds ?? []), occurredAt, recordedAt, input.idempotencyKey);
      this.insertEvent({
        eventType: "action.received",
        aggregateId: id,
        payload: {
          authorization: input.authorization,
          result: input.result,
          actionHash: hash(input.action),
          affectedEntityIds: input.affectedEntityIds ?? []
        },
        scope: input.scope,
        sourceEpisodeIds: input.sourceEpisodeIds,
        actor: "runtime",
        occurredAt,
        idempotencyKey: `event:${input.idempotencyKey}`
      });
    });
    return this.requireActionReceipt(id);
  }
  listActionReceipts(options = {}) {
    this.assertOpen();
    const params = [];
    let where = "";
    if (options.scope !== void 0) {
      const { scopeType, scopeId } = scopeColumns(options.scope);
      where = "WHERE scope_type = ? AND ifnull(scope_id, '') = ifnull(?, '')";
      params.push(scopeType, scopeId);
    }
    const limit = Math.max(1, Math.min(options.limit ?? 100, 1e3));
    params.push(limit);
    return this.db.prepare(`
      SELECT * FROM action_receipt ${where}
      ORDER BY recorded_at DESC, id DESC LIMIT ?
    `).all(...params).map((row) => this.actionReceiptFromRow(row));
  }
  evaluateActionConstraints(action, context = {}) {
    this.assertOpen();
    const normalizedAction = normalizedText(assertNonEmpty(action, "action"));
    const at = assertIso(context.at ?? this.isoNow(), "context.at");
    const allowedSensitivities = context.allowedSensitivities ?? DEFAULT_ALLOWED_SENSITIVITIES;
    const rows = this.db.prepare(`
      SELECT * FROM memory_claim
      WHERE kind = 'constraint' AND status = 'confirmed'
        AND predicate IN ('constraint.forbids', 'constraint.requires_confirmation')
      ORDER BY importance DESC, recorded_at DESC, id
    `).all();
    const conflicts = [];
    for (const row of rows) {
      const claim = this.claimFromRow(row);
      if (this.recallDenialReason(claim, context, at, allowedSensitivities) !== void 0)
        continue;
      const matchedTerm = normalizedText(claim.objectValue ?? "");
      if (matchedTerm.length === 0 || !normalizedAction.includes(matchedTerm))
        continue;
      conflicts.push({
        claimId: claim.id,
        reason: claim.predicate === "constraint.forbids" ? "forbidden-action-match" : "confirmation-required",
        matchedTerm: claim.objectValue,
        statement: claim.statement,
        scope: claim.scope
      });
    }
    return conflicts;
  }
  enqueue(jobType, payload, idempotencyKey, availableAt = this.isoNow()) {
    this.assertOpen();
    const existing = this.db.prepare("SELECT * FROM continuity_outbox WHERE idempotency_key = ?").get(idempotencyKey);
    if (existing !== void 0)
      return this.outboxFromRow(existing);
    const id = this.newId("job");
    const now = this.isoNow();
    this.db.prepare(`
      INSERT INTO continuity_outbox (
        id, job_type, payload_json, status, attempts, available_at, lease_until,
        last_error, idempotency_key, created_at, updated_at
      ) VALUES (?, ?, ?, 'pending', 0, ?, NULL, NULL, ?, ?, ?)
    `).run(id, assertNonEmpty(jobType, "jobType"), canonicalJson(payload), assertIso(availableAt, "availableAt"), idempotencyKey, now, now);
    return this.requireOutbox(id);
  }
  getOutbox(id) {
    this.assertOpen();
    const row = this.db.prepare("SELECT * FROM continuity_outbox WHERE id = ?").get(id);
    return row === void 0 ? void 0 : this.outboxFromRow(row);
  }
  claimOutbox(limit = 10, leaseMs = 6e4, jobType) {
    this.assertOpen();
    const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
    if (!Number.isFinite(leaseMs) || leaseMs < 1e3)
      throw new RangeError("leaseMs must be at least 1000");
    const now = this.isoNow();
    const leaseUntil = new Date(Date.parse(now) + leaseMs).toISOString();
    const ids = [];
    this.transaction(() => {
      const rows = this.db.prepare(`
        SELECT id FROM continuity_outbox
        WHERE ((status = 'pending' AND available_at <= ?)
           OR (status = 'processing' AND lease_until <= ?))
          AND (? IS NULL OR job_type = ?)
        ORDER BY available_at, created_at, id
        LIMIT ?
      `).all(now, now, jobType ?? null, jobType ?? null, boundedLimit);
      const update = this.db.prepare(`
        UPDATE continuity_outbox
        SET status = 'processing', attempts = attempts + 1, lease_until = ?, updated_at = ?
        WHERE id = ?
      `);
      for (const row of rows) {
        const id = asString(row.id, "id");
        update.run(leaseUntil, now, id);
        ids.push(id);
      }
    });
    return ids.map((id) => this.requireOutbox(id));
  }
  completeOutbox(id, options = {}) {
    this.assertOpen();
    const now = this.isoNow();
    const result = this.db.prepare(`
      UPDATE continuity_outbox
      SET status = 'completed', lease_until = NULL, last_error = NULL,
          payload_json = CASE WHEN ? THEN '{}' ELSE payload_json END,
          updated_at = ?
      WHERE id = ? AND status = 'processing'
    `).run(options.scrubPayload === true ? 1 : 0, now, id);
    if (Number(result.changes) !== 1)
      throw new Error(`outbox job ${id} is not processing`);
    return this.requireOutbox(id);
  }
  failOutbox(id, error, options = {}) {
    this.assertOpen();
    const job = this.requireOutbox(id);
    if (job.status !== "processing")
      throw new Error(`outbox job ${id} is not processing`);
    const maxAttempts = Math.max(1, Math.trunc(options.maxAttempts ?? 5));
    const retryDelayMs = Math.max(0, options.retryDelayMs ?? 1e3);
    const now = this.isoNow();
    const status = job.attempts >= maxAttempts ? "dead" : "pending";
    const availableAt = new Date(Date.parse(now) + retryDelayMs).toISOString();
    this.db.prepare(`
      UPDATE continuity_outbox
      SET status = ?, available_at = ?, lease_until = NULL, last_error = ?,
          payload_json = CASE WHEN ? THEN '{}' ELSE payload_json END,
          updated_at = ?
      WHERE id = ?
    `).run(status, availableAt, String(error), status === "dead" && options.scrubPayloadOnDead === true ? 1 : 0, now, id);
    return this.requireOutbox(id);
  }
  rebuildProjections() {
    this.assertOpen();
    this.transaction(() => {
      this.db.exec("DELETE FROM relation_projection; DELETE FROM memory_claim_fts;");
      const claims = this.db.prepare("SELECT * FROM memory_claim ORDER BY recorded_at, id").all();
      for (const row of claims) {
        const claim = this.claimFromRow(row);
        this.projectClaim(claim);
      }
    });
  }
  configure() {
    this.db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    if (this.databasePath !== ":memory:")
      this.db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;");
  }
  findExtractionEntity(kind, canonicalName, aliases, scope2) {
    const names = [...new Set([canonicalName, ...aliases].map(normalizedText))];
    const { scopeType, scopeId } = scopeColumns(scope2);
    const placeholders = names.map(() => "?").join(",");
    const rows = this.db.prepare(`
      SELECT DISTINCT e.*
      FROM entity e
      LEFT JOIN entity_alias a ON a.entity_id = e.id
      WHERE e.status <> 'deleted' AND e.kind = ?
        AND e.scope_type = ? AND ifnull(e.scope_id, '') = ifnull(?, '')
        AND (lower(trim(e.canonical_name)) IN (${placeholders}) OR a.normalized_alias IN (${placeholders}))
      ORDER BY e.id
    `).all(kind, scopeType, scopeId, ...names, ...names);
    if (rows.length > 1)
      throw new Error(`ambiguous extracted entity ${canonicalName}`);
    return rows[0] === void 0 ? void 0 : this.entityFromRow(rows[0]);
  }
  migrate() {
    this.db.exec("CREATE TABLE IF NOT EXISTS schema_migration (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL) STRICT;");
    const currentRow = this.db.prepare("SELECT max(version) AS version FROM schema_migration").get();
    const current = currentRow.version === null ? 0 : asNumber(currentRow.version, "version");
    if (current > PERSONAL_CORE_SCHEMA_VERSION)
      throw new PersonalCoreSchemaTooNewError(current);
    if (current < 1) {
      this.transaction(() => {
        this.db.exec(MIGRATION_1);
        this.db.prepare("INSERT INTO schema_migration(version, applied_at) VALUES (?, ?)").run(1, this.isoNow());
      });
    }
  }
  writeClaim(input, previous, status) {
    this.assertOpen();
    const existingEvent = this.eventByIdempotencyKey(input.idempotencyKey);
    if (existingEvent !== void 0) {
      const claimId = String(existingEvent.payload.claimId ?? existingEvent.aggregateId);
      return this.requireClaim(claimId);
    }
    this.requireEntity(input.subjectEntityId);
    const hasObjectEntity = input.objectEntityId !== void 0;
    const hasObjectValue = input.objectValue !== void 0;
    if (hasObjectEntity === hasObjectValue) {
      throw new TypeError("exactly one of objectEntityId or objectValue is required");
    }
    if (input.objectEntityId !== void 0)
      this.requireEntity(input.objectEntityId);
    this.assertSources(input.sourceEpisodeIds);
    const id = input.id ?? this.newId("claim");
    const statement = assertNonEmpty(input.statement, "statement");
    const predicate = assertNonEmpty(input.predicate, "predicate");
    const observedAt = assertIso(input.observedAt ?? this.isoNow(), "observedAt");
    const recordedAt = this.isoNow();
    const validFrom = input.validFrom === void 0 ? void 0 : assertIso(input.validFrom, "validFrom");
    const validTo = input.validTo === void 0 ? void 0 : assertIso(input.validTo, "validTo");
    if (validFrom !== void 0 && validTo !== void 0 && validTo < validFrom)
      throw new RangeError("validTo precedes validFrom");
    const { scopeType, scopeId } = scopeColumns(input.scope);
    const contentHash = hash(canonicalJson({
      kind: input.kind,
      statement: normalizedText(statement),
      predicate: normalizedText(predicate),
      subjectEntityId: input.subjectEntityId,
      objectEntityId: input.objectEntityId,
      objectValue: input.objectValue,
      scope: input.scope,
      validFrom,
      validTo
    }));
    this.transaction(() => {
      this.db.prepare(`
        INSERT INTO memory_claim (
          id, kind, statement, predicate, subject_entity_id, object_entity_id,
          object_value, status, confidence, importance, sensitivity, scope_type,
          scope_id, valid_from, valid_to, observed_at, recorded_at,
          supersedes_claim_id, superseded_by_claim_id, content_hash, revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 1)
      `).run(id, input.kind, statement, predicate, input.subjectEntityId, input.objectEntityId ?? null, input.objectValue ?? null, status, assertUnitInterval(input.confidence, "confidence"), assertUnitInterval(input.importance, "importance"), input.sensitivity ?? "personal", scopeType, scopeId, validFrom ?? null, validTo ?? null, observedAt, recordedAt, previous?.id ?? null, contentHash);
      const insertSource = this.db.prepare("INSERT INTO claim_source (claim_id, source_episode_id) VALUES (?, ?)");
      for (const sourceEpisodeId of new Set(input.sourceEpisodeIds))
        insertSource.run(id, sourceEpisodeId);
      if (previous !== void 0) {
        this.db.prepare(`
          UPDATE memory_claim
          SET status = 'superseded', superseded_by_claim_id = ?, revision = revision + 1
          WHERE id = ?
        `).run(id, previous.id);
        this.removeClaimProjection(previous.id);
        this.insertEvent({
          eventType: "claim.superseded",
          aggregateId: previous.id,
          payload: { claimId: previous.id, supersededByClaimId: id, contentHash: previous.contentHash },
          scope: previous.scope,
          sourceEpisodeIds: input.sourceEpisodeIds,
          actor: input.actor ?? "user",
          occurredAt: observedAt,
          idempotencyKey: `${input.idempotencyKey}:supersede`
        });
      }
      const claim = this.requireClaim(id);
      this.projectClaim(claim);
      this.insertEvent({
        eventType: previous === void 0 ? status === "confirmed" ? "claim.confirmed" : "claim.observed" : "claim.corrected",
        aggregateId: id,
        payload: {
          claimId: id,
          contentHash,
          status,
          supersedesClaimId: previous?.id
        },
        scope: input.scope,
        sourceEpisodeIds: input.sourceEpisodeIds,
        actor: input.actor ?? "user",
        occurredAt: observedAt,
        idempotencyKey: input.idempotencyKey
      });
    });
    return this.requireClaim(id);
  }
  transitionClaim(claimId, status, eventType, input) {
    this.assertOpen();
    const existing = this.eventByIdempotencyKey(input.idempotencyKey);
    if (existing !== void 0)
      return this.requireClaim(claimId);
    const claim = this.requireClaim(claimId);
    this.assertSources(input.sourceEpisodeIds);
    this.transaction(() => this.transitionClaimInTransaction(claim, status, eventType, input));
    return this.requireClaim(claimId);
  }
  transitionClaimInTransaction(claim, status, eventType, input) {
    this.db.prepare("UPDATE memory_claim SET status = ?, revision = revision + 1 WHERE id = ?").run(status, claim.id);
    this.removeClaimProjection(claim.id);
    this.insertEvent({
      eventType,
      aggregateId: claim.id,
      payload: { claimId: claim.id, contentHash: claim.contentHash, status },
      scope: claim.scope,
      sourceEpisodeIds: input.sourceEpisodeIds,
      actor: input.actor ?? "user",
      occurredAt: assertIso(input.occurredAt ?? this.isoNow(), "occurredAt"),
      idempotencyKey: input.idempotencyKey
    });
  }
  insertEvent(input) {
    this.assertSources(input.sourceEpisodeIds);
    const id = this.newId("evt");
    const recordedAt = this.isoNow();
    const { scopeType, scopeId } = scopeColumns(input.scope);
    this.db.prepare(`
      INSERT INTO entity_event (
        id, event_type, aggregate_id, payload_json, scope_type, scope_id,
        source_episode_ids_json, actor, occurred_at, recorded_at, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.eventType, input.aggregateId, canonicalJson(input.payload), scopeType, scopeId, canonicalJson([...new Set(input.sourceEpisodeIds)]), input.actor, assertIso(input.occurredAt, "occurredAt"), recordedAt, assertNonEmpty(input.idempotencyKey, "idempotencyKey"));
    return this.eventFromRow(this.db.prepare("SELECT * FROM entity_event WHERE id = ?").get(id));
  }
  projectClaim(claim) {
    if (!ACTIVE_CLAIM_STATUSES.has(claim.status) && claim.status !== "candidate")
      return;
    this.db.prepare(`
      INSERT OR REPLACE INTO relation_projection (
        claim_id, from_entity_id, predicate, to_entity_id, object_value,
        valid_from, valid_to, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(claim.id, claim.subjectEntityId, claim.predicate, claim.objectEntityId ?? null, claim.objectValue ?? null, claim.validFrom ?? null, claim.validTo ?? null, claim.status);
    const entityNames = this.entityNamesForClaim(claim);
    this.db.prepare("DELETE FROM memory_claim_fts WHERE claim_id = ?").run(claim.id);
    this.db.prepare("INSERT INTO memory_claim_fts (claim_id, statement, predicate, entity_names) VALUES (?, ?, ?, ?)").run(claim.id, claim.statement, claim.predicate, entityNames.join(" "));
  }
  removeClaimProjection(claimId) {
    this.db.prepare("DELETE FROM relation_projection WHERE claim_id = ?").run(claimId);
    this.db.prepare("DELETE FROM memory_claim_fts WHERE claim_id = ?").run(claimId);
  }
  refreshClaimSearchForEntity(entityId) {
    const rows = this.db.prepare(`
      SELECT mc.* FROM memory_claim mc
      WHERE mc.subject_entity_id = ? OR mc.object_entity_id = ?
    `).all(entityId, entityId);
    for (const row of rows)
      this.projectClaim(this.claimFromRow(row));
  }
  entityNamesForClaim(claim) {
    const ids = [claim.subjectEntityId, claim.objectEntityId].filter((id) => id !== void 0);
    const names = [];
    for (const id of ids) {
      const entity = this.requireEntity(id);
      names.push(entity.canonicalName, ...this.listAliases(id).map((alias) => alias.alias));
    }
    return names;
  }
  candidateClaimIds(query, context, graphDepth) {
    const ids = /* @__PURE__ */ new Set();
    const match = ftsQuery(query);
    if (match !== void 0) {
      const rows = this.db.prepare("SELECT claim_id FROM memory_claim_fts WHERE memory_claim_fts MATCH ? ORDER BY bm25(memory_claim_fts) LIMIT 200").all(match);
      for (const row of rows)
        ids.add(asString(row.claim_id, "claim_id"));
    }
    const normalizedQuery = normalizedText(query);
    const aliases = this.db.prepare("SELECT entity_id, normalized_alias FROM entity_alias ORDER BY length(normalized_alias) DESC").all();
    const entityIds = /* @__PURE__ */ new Set();
    for (const row of aliases) {
      const alias = asString(row.normalized_alias, "normalized_alias");
      if (alias.length > 0 && normalizedQuery.includes(alias))
        entityIds.add(asString(row.entity_id, "entity_id"));
    }
    const canonicalEntities = this.db.prepare("SELECT id, canonical_name FROM entity WHERE status = 'active'").all();
    for (const row of canonicalEntities) {
      const name2 = normalizedText(asString(row.canonical_name, "canonical_name"));
      if (name2.length > 0 && normalizedQuery.includes(name2))
        entityIds.add(asString(row.id, "id"));
    }
    if (entityIds.size > 0) {
      const placeholders = [...entityIds].map(() => "?").join(",");
      const direct = this.db.prepare(`
        SELECT id FROM memory_claim
        WHERE subject_entity_id IN (${placeholders}) OR object_entity_id IN (${placeholders})
      `).all(...entityIds, ...entityIds);
      for (const row of direct)
        ids.add(asString(row.id, "id"));
      if (graphDepth > 0) {
        const graph = this.db.prepare(`
          WITH RECURSIVE neighbors(entity_id, depth) AS (
            SELECT value, 0 FROM json_each(?)
            UNION
            SELECT CASE WHEN rp.from_entity_id = n.entity_id THEN rp.to_entity_id ELSE rp.from_entity_id END, n.depth + 1
            FROM neighbors n JOIN relation_projection rp
              ON rp.from_entity_id = n.entity_id OR rp.to_entity_id = n.entity_id
            WHERE n.depth < ? AND rp.to_entity_id IS NOT NULL AND rp.status = 'confirmed'
          )
          SELECT DISTINCT rp.claim_id
          FROM neighbors n JOIN relation_projection rp
            ON rp.from_entity_id = n.entity_id OR rp.to_entity_id = n.entity_id
          WHERE n.depth <= ?
        `).all(canonicalJson([...entityIds]), graphDepth, graphDepth);
        for (const row of graph)
          ids.add(asString(row.claim_id, "claim_id"));
      }
    }
    const prospective = this.db.prepare(`
      SELECT id FROM memory_claim
      WHERE kind IN ('prospective', 'constraint') AND status IN ('confirmed', 'candidate')
      ORDER BY importance DESC, recorded_at DESC LIMIT 100
    `).all();
    for (const row of prospective)
      ids.add(asString(row.id, "id"));
    if (ids.size === 0 && normalizedQuery.length > 0) {
      const like = `%${normalizedQuery.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
      const fallback = this.db.prepare("SELECT id FROM memory_claim WHERE lower(statement) LIKE ? ESCAPE '\\' LIMIT 100").all(like);
      for (const row of fallback)
        ids.add(asString(row.id, "id"));
    }
    if (ids.size === 0) {
      const recent = this.db.prepare("SELECT id FROM memory_claim ORDER BY importance DESC, recorded_at DESC LIMIT 50").all();
      for (const row of recent)
        ids.add(asString(row.id, "id"));
    }
    return [...ids];
  }
  recallDenialReason(claim, context, at, allowedSensitivities) {
    const active = ACTIVE_CLAIM_STATUSES.has(claim.status) || context.includeCandidates === true && claim.status === "candidate";
    if (!active)
      return "inactive";
    if (!allowedSensitivities.includes(claim.sensitivity))
      return "sensitivity-denied";
    if (claim.scope.type === "workspace" && claim.scope.id !== context.workspaceId)
      return "out-of-scope";
    if (claim.scope.type === "session" && claim.scope.id !== context.sessionId)
      return "out-of-scope";
    if (claim.validFrom !== void 0 && claim.validFrom > at || claim.validTo !== void 0 && claim.validTo < at)
      return "invalid-time";
    return void 0;
  }
  scoreClaim(claim, query, at) {
    const normalizedQuery = normalizedText(query);
    const normalizedStatement = normalizedText(claim.statement);
    const normalizedPredicate = normalizedText(claim.predicate);
    let relevance = 0;
    if (normalizedQuery.length > 0 && normalizedStatement.includes(normalizedQuery))
      relevance += 0.35;
    const queryTokens = new Set(normalizedQuery.match(/[\p{L}\p{N}_-]+/gu) ?? []);
    const claimTokens = new Set(`${normalizedStatement} ${normalizedPredicate}`.match(/[\p{L}\p{N}_-]+/gu) ?? []);
    if (queryTokens.size > 0) {
      const overlap = [...queryTokens].filter((token) => claimTokens.has(token)).length;
      relevance += 0.35 * (overlap / queryTokens.size);
    }
    const ageDays = millisecondsBetween(at, claim.recordedAt) / 864e5;
    const freshness = Math.exp(-ageDays / 180);
    const prospectiveBoost = claim.kind === "prospective" || claim.kind === "constraint" ? 0.12 : 0;
    return Math.min(1, relevance + claim.importance * 0.2 + claim.confidence * 0.18 + freshness * 0.15 + prospectiveBoost);
  }
  findContradictionSets(claims) {
    const groups = /* @__PURE__ */ new Map();
    for (const claim of claims) {
      const key = `${claim.subjectEntityId}:${normalizedText(claim.predicate)}`;
      const group = groups.get(key) ?? [];
      group.push(claim);
      groups.set(key, group);
    }
    return [...groups.values()].filter((group) => new Set(group.map((claim) => claim.objectEntityId === void 0 ? `value:${normalizedText(claim.objectValue ?? "")}` : `entity:${claim.objectEntityId}`)).size > 1).map((group) => group.map((claim) => claim.id));
  }
  renderClaim(claim) {
    const sources = claim.sourceEpisodeIds.join(",");
    return `- [${claim.id}; ${claim.kind}; confidence=${claim.confidence.toFixed(2)}; sources=${sources}] ${claim.statement}`;
  }
  renderContextPack(recallId, claims, contradictionSets) {
    if (claims.length === 0)
      return "";
    const lines = claims.map((claim) => this.renderClaim(claim));
    const contradiction = contradictionSets.length === 0 ? "" : `
Unresolved claim sets: ${contradictionSets.map((group) => group.join("|")).join(", ")}`;
    return `<telos_continuity recall_id="${recallId}">
${lines.join("\n")}${contradiction}
</telos_continuity>`;
  }
  listMaterializationsForRecall(recallId) {
    return this.db.prepare("SELECT * FROM recall_materialization WHERE recall_id = ? ORDER BY claim_id").all(recallId).map((row) => this.materializationFromRow(row));
  }
  listMaterializationsForClaim(claimId) {
    return this.db.prepare("SELECT * FROM recall_materialization WHERE claim_id = ? ORDER BY created_at, id").all(claimId).map((row) => this.materializationFromRow(row));
  }
  eventByIdempotencyKey(key) {
    const row = this.db.prepare("SELECT * FROM entity_event WHERE idempotency_key = ?").get(assertNonEmpty(key, "idempotencyKey"));
    return row === void 0 ? void 0 : this.eventFromRow(row);
  }
  assertSources(sourceEpisodeIds) {
    for (const id of new Set(sourceEpisodeIds))
      this.requireSourceEpisode(id);
  }
  requireSourceEpisode(id) {
    const episode = this.getSourceEpisode(id);
    if (episode === void 0)
      throw new Error(`unknown source episode ${id}`);
    return episode;
  }
  requireEntity(id) {
    const entity = this.getEntity(id);
    if (entity === void 0)
      throw new Error(`unknown entity ${id}`);
    return entity;
  }
  requireAlias(id) {
    const row = this.db.prepare("SELECT * FROM entity_alias WHERE id = ?").get(id);
    if (row === void 0)
      throw new Error(`unknown entity alias ${id}`);
    return this.aliasFromRow(row);
  }
  requireClaim(id) {
    const claim = this.getClaim(id);
    if (claim === void 0)
      throw new Error(`unknown claim ${id}`);
    return claim;
  }
  requireActionReceipt(id) {
    const row = this.db.prepare("SELECT * FROM action_receipt WHERE id = ?").get(id);
    if (row === void 0)
      throw new Error(`unknown action receipt ${id}`);
    return this.actionReceiptFromRow(row);
  }
  requireOutbox(id) {
    const row = this.db.prepare("SELECT * FROM continuity_outbox WHERE id = ?").get(id);
    if (row === void 0)
      throw new Error(`unknown outbox job ${id}`);
    return this.outboxFromRow(row);
  }
  sourceEpisodeFromRow(row) {
    return {
      id: asString(row.id, "id"),
      sourceKind: asString(row.source_kind, "source_kind"),
      runtimeId: asOptionalString(row.runtime_id),
      sourceInstanceId: asString(row.source_instance_id, "source_instance_id"),
      sessionId: asOptionalString(row.session_id),
      seqStart: row.seq_start === null ? void 0 : asNumber(row.seq_start, "seq_start"),
      seqEnd: row.seq_end === null ? void 0 : asNumber(row.seq_end, "seq_end"),
      observedAt: asString(row.observed_at, "observed_at"),
      recordedAt: asString(row.recorded_at, "recorded_at"),
      content: asOptionalString(row.content),
      contentHash: asString(row.content_hash, "content_hash"),
      sensitivity: asString(row.sensitivity, "sensitivity"),
      deletionState: asString(row.deletion_state, "deletion_state")
    };
  }
  entityFromRow(row) {
    return {
      id: asString(row.id, "id"),
      kind: asString(row.kind, "kind"),
      canonicalName: asString(row.canonical_name, "canonical_name"),
      scope: scopeFromRow(row),
      status: asString(row.status, "status"),
      createdAt: asString(row.created_at, "created_at"),
      updatedAt: asString(row.updated_at, "updated_at"),
      revision: asNumber(row.revision, "revision")
    };
  }
  aliasFromRow(row) {
    return {
      id: asString(row.id, "id"),
      entityId: asString(row.entity_id, "entity_id"),
      alias: asString(row.alias, "alias"),
      normalizedAlias: asString(row.normalized_alias, "normalized_alias"),
      scope: scopeFromRow(row),
      sourceEpisodeId: asOptionalString(row.source_episode_id),
      createdAt: asString(row.created_at, "created_at")
    };
  }
  eventFromRow(row) {
    return {
      id: asString(row.id, "id"),
      eventType: asString(row.event_type, "event_type"),
      aggregateId: asString(row.aggregate_id, "aggregate_id"),
      payload: parseJson(row.payload_json, "payload_json"),
      scope: scopeFromRow(row),
      sourceEpisodeIds: parseJson(row.source_episode_ids_json, "source_episode_ids_json"),
      actor: asString(row.actor, "actor"),
      occurredAt: asString(row.occurred_at, "occurred_at"),
      recordedAt: asString(row.recorded_at, "recorded_at"),
      idempotencyKey: asString(row.idempotency_key, "idempotency_key")
    };
  }
  claimFromRow(row) {
    const id = asString(row.id, "id");
    const sources = this.db.prepare("SELECT source_episode_id FROM claim_source WHERE claim_id = ? ORDER BY source_episode_id").all(id);
    return {
      id,
      kind: asString(row.kind, "kind"),
      statement: asString(row.statement, "statement"),
      predicate: asString(row.predicate, "predicate"),
      subjectEntityId: asString(row.subject_entity_id, "subject_entity_id"),
      objectEntityId: asOptionalString(row.object_entity_id),
      objectValue: asOptionalString(row.object_value),
      status: asString(row.status, "status"),
      confidence: asNumber(row.confidence, "confidence"),
      importance: asNumber(row.importance, "importance"),
      sensitivity: asString(row.sensitivity, "sensitivity"),
      scope: scopeFromRow(row),
      validFrom: asOptionalString(row.valid_from),
      validTo: asOptionalString(row.valid_to),
      observedAt: asString(row.observed_at, "observed_at"),
      recordedAt: asString(row.recorded_at, "recorded_at"),
      supersedesClaimId: asOptionalString(row.supersedes_claim_id),
      supersededByClaimId: asOptionalString(row.superseded_by_claim_id),
      sourceEpisodeIds: sources.map((source2) => asString(source2.source_episode_id, "source_episode_id")),
      contentHash: asString(row.content_hash, "content_hash"),
      revision: asNumber(row.revision, "revision")
    };
  }
  materializationFromRow(row) {
    return {
      id: asString(row.id, "id"),
      recallId: asString(row.recall_id, "recall_id"),
      claimId: asString(row.claim_id, "claim_id"),
      runtimeId: asString(row.runtime_id, "runtime_id"),
      sessionId: asString(row.session_id, "session_id"),
      seqStart: asNumber(row.seq_start, "seq_start"),
      seqEnd: asNumber(row.seq_end, "seq_end"),
      renderedContentHash: asString(row.rendered_content_hash, "rendered_content_hash"),
      createdAt: asString(row.created_at, "created_at")
    };
  }
  actionReceiptFromRow(row) {
    return {
      id: asString(row.id, "id"),
      action: asString(row.action, "action"),
      authorization: asString(row.authorization, "authorization"),
      runtimeId: asString(row.runtime_id, "runtime_id"),
      provider: asOptionalString(row.provider),
      result: asString(row.result, "result"),
      scope: scopeFromRow(row),
      sourceEpisodeIds: parseJson(row.source_episode_ids_json, "source_episode_ids_json"),
      affectedEntityIds: parseJson(row.affected_entity_ids_json, "affected_entity_ids_json"),
      occurredAt: asString(row.occurred_at, "occurred_at"),
      recordedAt: asString(row.recorded_at, "recorded_at"),
      idempotencyKey: asString(row.idempotency_key, "idempotency_key")
    };
  }
  outboxFromRow(row) {
    return {
      id: asString(row.id, "id"),
      jobType: asString(row.job_type, "job_type"),
      payload: parseJson(row.payload_json, "payload_json"),
      status: asString(row.status, "status"),
      attempts: asNumber(row.attempts, "attempts"),
      availableAt: asString(row.available_at, "available_at"),
      leaseUntil: asOptionalString(row.lease_until),
      lastError: asOptionalString(row.last_error),
      idempotencyKey: asString(row.idempotency_key, "idempotency_key"),
      createdAt: asString(row.created_at, "created_at"),
      updatedAt: asString(row.updated_at, "updated_at")
    };
  }
  transaction(work) {
    if (this.db.isTransaction)
      return work();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = work();
      this.db.exec("COMMIT");
      return value;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  newId(prefix) {
    return assertNonEmpty(this.idFactory(prefix), "generated id");
  }
  isoNow() {
    return this.now().toISOString();
  }
  assertOpen() {
    if (this.closed)
      throw new Error("personal continuity store is closed");
  }
};

// src/contracts.ts
var CONTINUITY_RPC_CHANNEL = "/telos-continuity";

// src/capture-policy.ts
function joined(messages2) {
  return messages2.map((message) => message.text).join("\n").normalize("NFKC");
}
function explicitReviewRequested(messages2) {
  return /待确认|先(?:别|不要)确认|暂(?:不|时不)?确认|不确定|可能记错|暂定/u.test(joined(messages2));
}
function explicitMemoryVetoRequested(messages2) {
  return /(?:先|暂时)?别进长期(?:记忆|计划)|(?:先|暂时)?不要(?:记住|记录|保存|进入长期)|(?:先|暂时)?别(?:记住|记录|保存)|不需要(?:记住|记录|保存)|最多放\s*mentions?|只(?:放|留)在\s*mentions?/iu.test(joined(messages2));
}

// src/formation.ts
import {
  BlockAssembler,
  createUserMessage,
  deepFreeze,
  ReasoningEffortId
} from "@deepseek-ai/dsh-llm";
import { SessionId } from "@deepseek-ai/dsh-session";
var MAX_EVENTS = 6;
var MAX_ENTITIES2 = 12;
var MAX_ALIASES2 = 6;
var MAX_EVIDENCE_LENGTH = 500;
var ENTITY_REF_PATTERN2 = /^[a-z][a-z0-9_-]{0,63}$/u;
var ENTITY_KINDS2 = /* @__PURE__ */ new Set([
  "person",
  "place",
  "organization",
  "workspace",
  "project",
  "topic",
  "goal",
  "commitment",
  "decision",
  "constraint",
  "preference",
  "artifact"
]);
var RESPONSE_KEYS = /* @__PURE__ */ new Set(["schemaVersion", "decision", "reason", "entities", "events"]);
var ENTITY_KEYS = /* @__PURE__ */ new Set(["ref", "kind", "canonicalName", "aliases", "evidence"]);
var EVENT_KEYS = /* @__PURE__ */ new Set([
  "kind",
  "statement",
  "predicate",
  "subjectEntityRef",
  "objectEntityRef",
  "objectValue",
  "confidence",
  "importance",
  "sensitivity",
  "evidence",
  "durability",
  "validFrom",
  "validTo"
]);
var MEMORY_FORMATION_SYSTEM_PROMPT = [
  "You are the memory-formation stage for a local-first personal AI.",
  "Convert direct human messages into evidence-grounded personal entities and time-aware memory events that will be useful beyond the current turn.",
  "Direct human messages are the only authoritative evidence. Assistant messages are non-authoritative context: they may help resolve wording or a typo, but can never introduce a fact or be copied as evidence.",
  "Do not extract ordinary one-turn instructions, response-format requests, tool-use controls, test/debug prompts, questions, brainstorming, quoted text, or facts stated only by the assistant.",
  "Ignore temporary control clauses instead of discarding an otherwise useful memory event.",
  "An explicit captureIntent means the human directly asked Telos to remember the situation. Treat that as strong durability evidence, while still rejecting secrets, test/debug prompts and content that has no useful memory event.",
  "Eligible memories include stable preferences, goals, decisions, commitments, procedures and constraints, plus concrete time-bounded events that matter across turns, such as a family visit, appointment, deadline, trip or promised follow-up.",
  'A concrete event may qualify even when stated only once. For example, "\u7238\u7238\u660E\u5929\u6765\u6211\u5BB6" is a prospective event about a person entity, not a disposable chat detail.',
  "Resolve relative time such as today or tomorrow from referenceTime in the supplied timeZone. Use ISO-8601 offsets; for an all-day event use the local day start and end.",
  "Use owner for the user. Create another entity only when its canonicalName is explicitly present in a direct human message, or when a normalized canonicalName has at least one explicitly observed alias. Aliases must be copied from direct human text; do not invent synonyms.",
  "Represent relationships as edges: subjectEntityRef + predicate + exactly one of objectEntityRef or objectValue. Prefer an entity edge when both endpoints are known.",
  "Never extract credentials, secrets, inferred sensitive attributes, or unsupported conclusions.",
  "Every entity and event must contain one evidence field copied verbatim from exactly one supplied direct human message.",
  "Use concise normalized statements and stable lowercase dotted predicates.",
  "Write statements and literal values in the direct human message language. Do not translate Chinese memory into English.",
  "Prefer a compact connected event graph. Create each explicitly named person, organization, project, goal, commitment, topic or artifact that participates in a durable event, but do not split one situation into redundant paraphrases.",
  "Return exactly one JSON object and no Markdown or commentary.",
  "The required shape is:",
  '{"schemaVersion":2,"decision":"remember|ignore","reason":"short reason","entities":[{"ref":"local_ref","kind":"person|place|organization|workspace|project|topic|goal|commitment|decision|constraint|preference|artifact","canonicalName":"exactly observed name","aliases":[],"evidence":"exact human substring"}],"events":[{"kind":"semantic|episodic|procedural|prospective|constraint","statement":"...","predicate":"lowercase.dotted_name","subjectEntityRef":"owner|local_ref","objectEntityRef":"owner|local_ref|null","objectValue":"literal|null","confidence":0.0,"importance":0.0,"sensitivity":"personal","evidence":"exact human substring","durability":"cross-session","validFrom":null,"validTo":null}]}',
  `Return at most ${String(MAX_ENTITIES2)} entities and ${String(MAX_EVENTS)} events. When nothing qualifies, decision must be ignore and both arrays must be empty.`
].join("\n");
function record2(value, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return value;
}
function text2(value, field, maximum) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  const normalized = value.trim().normalize("NFKC");
  if (normalized.length > maximum) throw new RangeError(`${field} exceeds ${String(maximum)} characters`);
  return normalized;
}
function assertKnownKeys(value, allowed, field) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${field} contains unknown field ${key}`);
  }
}
function optionalIso2(value, field) {
  if (value === void 0 || value === null) return void 0;
  const result = text2(value, field, 64);
  if (!Number.isFinite(Date.parse(result))) throw new TypeError(`${field} must be an ISO-8601 timestamp or null`);
  return result;
}
function optionalText(value, field, maximum) {
  return value === void 0 || value === null ? void 0 : text2(value, field, maximum);
}
function unit2(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${field} must be between 0 and 1`);
  }
  return value;
}
function unwrapJson(textValue) {
  const trimmed = textValue.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(trimmed);
  return fenced?.[1]?.trim() ?? trimmed;
}
function comparableEvidence(value) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{Z}\s]/gu, "");
}
function zonedParts(instant, timeZone) {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-CA-u-hc-h23", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(instant).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second
  };
}
function calendarFromEpoch(value) {
  const date = new Date(value);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}
function shiftCalendar(date, days) {
  return calendarFromEpoch(Date.UTC(date.year, date.month - 1, date.day + days));
}
function localInstant(date, timeZone, hour = 0) {
  const desiredWallTime = Date.UTC(date.year, date.month - 1, date.day, hour);
  let candidate = desiredWallTime;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const observed = zonedParts(new Date(candidate), timeZone);
    const observedWallTime = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second
    );
    candidate += desiredWallTime - observedWallTime;
  }
  return candidate;
}
function bounds(start, endExclusive, timeZone, startHour = 0) {
  return {
    validFrom: new Date(localInstant(start, timeZone, startHour)).toISOString(),
    validTo: new Date(localInstant(endExclusive, timeZone) - 1).toISOString()
  };
}
function inferRelativeTimeBounds(value, referenceTime, timeZone) {
  const normalized = value.normalize("NFKC").toLocaleLowerCase();
  const reference = new Date(referenceTime);
  if (!Number.isFinite(reference.getTime())) throw new TypeError("referenceTime must be ISO-8601");
  const local = zonedParts(reference, timeZone);
  const today = { year: local.year, month: local.month, day: local.day };
  if (/今晚|tonight/u.test(normalized)) return bounds(today, shiftCalendar(today, 1), timeZone, 18);
  if (/下周|next\s+week/u.test(normalized)) {
    const weekday = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay();
    const start = shiftCalendar(today, weekday === 0 ? 1 : 8 - weekday);
    return bounds(start, shiftCalendar(start, 7), timeZone);
  }
  if (/下个月|next\s+month/u.test(normalized)) {
    const start = calendarFromEpoch(Date.UTC(today.year, today.month, 1));
    const end = calendarFromEpoch(Date.UTC(today.year, today.month + 1, 1));
    return bounds(start, end, timeZone);
  }
  if (/明天|tomorrow/u.test(normalized)) {
    const start = shiftCalendar(today, 1);
    return bounds(start, shiftCalendar(start, 1), timeZone);
  }
  if (/昨天|yesterday/u.test(normalized)) {
    const start = shiftCalendar(today, -1);
    return bounds(start, today, timeZone);
  }
  if (/今天|今日|today/u.test(normalized)) return bounds(today, shiftCalendar(today, 1), timeZone);
  return void 0;
}
function frameMessages(input) {
  return [
    "Evaluate this turn for evidence-grounded personal entities and memory events.",
    "The host will enforce the supplied local scope; do not invent another scope.",
    JSON.stringify({
      scope: input.scope,
      captureIntent: input.captureIntent ?? "automatic",
      referenceTime: input.referenceTime,
      timeZone: input.timeZone,
      locale: input.locale,
      directHumanMessages: input.messages,
      assistantContext: input.assistantMessages ?? []
    })
  ].join("\n");
}
function finishError(finish) {
  switch (finish.kind) {
    case "stop":
      return void 0;
    case "error":
    case "aborted": {
      const error = new Error(finish.failure.message);
      error.code = finish.failure.code;
      return error;
    }
    case "max-tokens":
      return new Error("memory formation output reached maxOutputTokens");
    case "tool-calls":
      return new Error("memory formation model unexpectedly requested a tool");
    default:
      return new Error(`unsupported memory formation finish reason ${String(finish.kind)}`);
  }
}
function parseMemoryFormationOutput(output, input) {
  let decoded;
  try {
    decoded = JSON.parse(unwrapJson(output));
  } catch (error) {
    throw new TypeError("memory formation model returned invalid JSON", { cause: error });
  }
  const envelope = record2(decoded, "memory formation response");
  assertKnownKeys(envelope, RESPONSE_KEYS, "memory formation response");
  if (envelope.schemaVersion !== 2) throw new TypeError("memory formation response schemaVersion must be 2");
  if (envelope.decision !== "remember" && envelope.decision !== "ignore") {
    throw new TypeError("memory formation response decision must be remember or ignore");
  }
  const reason = text2(envelope.reason, "memory formation response reason", 500);
  if (!Array.isArray(envelope.entities)) throw new TypeError("memory formation response entities must be an array");
  if (!Array.isArray(envelope.events)) throw new TypeError("memory formation response events must be an array");
  if (envelope.entities.length > MAX_ENTITIES2) throw new RangeError(`memory formation response exceeds ${String(MAX_ENTITIES2)} entities`);
  if (envelope.events.length > MAX_EVENTS) throw new RangeError(`memory formation response exceeds ${String(MAX_EVENTS)} events`);
  if (envelope.decision === "ignore" && (envelope.entities.length > 0 || envelope.events.length > 0)) {
    throw new TypeError("ignored memory formation response must have empty entities and events");
  }
  if (envelope.decision === "remember" && envelope.events.length === 0) {
    throw new TypeError("remembered memory formation response must contain at least one event");
  }
  const normalizedMessages = input.messages.map((message) => message.text.normalize("NFKC"));
  const exactHumanExcerpt = (value, field) => {
    const excerpt = text2(value, field, MAX_EVIDENCE_LENGTH);
    const exact = normalizedMessages.find((message) => message.includes(excerpt));
    if (exact !== void 0) {
      if (containsCredentialLikeContent(excerpt)) throw new TypeError(`${field} contains credential-like content`);
      return excerpt;
    }
    const comparable = comparableEvidence(excerpt);
    const punctuationOnlyMatch = comparable.length >= 4 ? normalizedMessages.find((message) => message.length <= MAX_EVIDENCE_LENGTH && comparableEvidence(message).includes(comparable)) : void 0;
    if (punctuationOnlyMatch === void 0) {
      throw new TypeError(`${field} is not grounded in a human message`);
    }
    if (containsCredentialLikeContent(punctuationOnlyMatch)) throw new TypeError(`${field} contains credential-like content`);
    return punctuationOnlyMatch;
  };
  const entityEvidence = [];
  const rawEntities = [];
  const retainedRefs = /* @__PURE__ */ new Set();
  for (const [index, value] of envelope.entities.entries()) {
    const entity = record2(value, `entities[${String(index)}]`);
    assertKnownKeys(entity, ENTITY_KEYS, `entities[${String(index)}]`);
    const canonicalName = text2(entity.canonicalName, `entities[${String(index)}].canonicalName`, 120);
    if (!Array.isArray(entity.aliases) || entity.aliases.length > MAX_ALIASES2) {
      throw new TypeError(`entities[${String(index)}].aliases must contain at most ${String(MAX_ALIASES2)} items`);
    }
    const aliases = entity.aliases.flatMap((alias, aliasIndex) => {
      const result = text2(alias, `entities[${String(index)}].aliases[${String(aliasIndex)}]`, 120);
      return normalizedMessages.some((message) => message.includes(result)) ? [result] : [];
    });
    const observedNames = [canonicalName, ...aliases].filter((name2) => normalizedMessages.some((message) => message.includes(name2)));
    if (observedNames.length === 0) continue;
    const proposedEvidence = text2(entity.evidence, `entities[${String(index)}].evidence`, MAX_EVIDENCE_LENGTH);
    let excerpt;
    try {
      excerpt = exactHumanExcerpt(proposedEvidence, `entities[${String(index)}].evidence`);
    } catch {
      excerpt = observedNames[0];
    }
    if (typeof entity.ref !== "string" || typeof entity.kind !== "string") continue;
    const ref = entity.ref.trim().toLocaleLowerCase();
    if (!ENTITY_REF_PATTERN2.test(ref) || ref === "owner" || !ENTITY_KINDS2.has(entity.kind)) continue;
    const proposal2 = {
      ref,
      kind: entity.kind,
      canonicalName,
      aliases
    };
    if (retainedRefs.has(proposal2.ref)) continue;
    retainedRefs.add(proposal2.ref);
    rawEntities.push(proposal2);
    entityEvidence.push(observedNames.some((name2) => excerpt.includes(name2)) ? excerpt : observedNames[0]);
  }
  const eventEvidence = [];
  const rawEvents = [];
  const availableRefs = /* @__PURE__ */ new Set(["owner", ...rawEntities.map((entity) => entity.ref)]);
  for (const [index, value] of envelope.events.entries()) {
    const event = record2(value, `events[${String(index)}]`);
    assertKnownKeys(event, EVENT_KEYS, `events[${String(index)}]`);
    if (event.durability !== "cross-session") {
      throw new TypeError(`events[${String(index)}].durability must be cross-session`);
    }
    const excerpt = exactHumanExcerpt(event.evidence, `events[${String(index)}].evidence`);
    const statement = text2(event.statement, `events[${String(index)}].statement`, 500);
    const subjectEntityRef = text2(event.subjectEntityRef, `events[${String(index)}].subjectEntityRef`, 64);
    if (!availableRefs.has(subjectEntityRef)) continue;
    const proposedObjectEntityRef = optionalText(event.objectEntityRef, `events[${String(index)}].objectEntityRef`, 64);
    const objectEntityRef = proposedObjectEntityRef !== void 0 && availableRefs.has(proposedObjectEntityRef) ? proposedObjectEntityRef : void 0;
    const objectValue = optionalText(event.objectValue, `events[${String(index)}].objectValue`, 240);
    const inferredBounds = input.referenceTime === void 0 || input.timeZone === void 0 ? void 0 : inferRelativeTimeBounds(`${excerpt}
${statement}`, input.referenceTime, input.timeZone);
    const proposal2 = {
      kind: event.kind,
      statement,
      predicate: event.predicate,
      subjectEntityRef,
      objectEntityRef,
      objectValue: objectEntityRef === void 0 ? objectValue ?? statement : void 0,
      confidence: unit2(event.confidence, `events[${String(index)}].confidence`),
      importance: unit2(event.importance, `events[${String(index)}].importance`),
      sensitivity: event.sensitivity,
      validFrom: optionalIso2(event.validFrom, `events[${String(index)}].validFrom`) ?? inferredBounds?.validFrom,
      validTo: optionalIso2(event.validTo, `events[${String(index)}].validTo`) ?? inferredBounds?.validTo
    };
    try {
      const eventRefs = new Set([subjectEntityRef, objectEntityRef].filter((ref) => ref !== void 0 && ref !== "owner"));
      const validatedEvent = validateGraphExtractionEnvelope({
        schemaVersion: 2,
        sourceEpisodeId: "model-formation-event-validation",
        scope: input.scope,
        entities: rawEntities.filter((entity) => eventRefs.has(entity.ref)),
        events: [proposal2]
      }).events[0];
      if (validatedEvent === void 0) continue;
      rawEvents.push(validatedEvent);
      eventEvidence.push(excerpt);
    } catch {
    }
  }
  const usedEntityRefs = new Set(rawEvents.flatMap((event) => [event.subjectEntityRef, event.objectEntityRef].filter((ref) => ref !== void 0 && ref !== "owner")));
  const retainedEntityIndexes = rawEntities.map((entity, index) => ({ entity, index })).filter(({ entity }) => usedEntityRefs.has(entity.ref));
  const graphEntities = retainedEntityIndexes.map(({ entity }) => entity);
  const graphEntityEvidence = retainedEntityIndexes.map(({ index }) => entityEvidence[index]);
  const validated = validateGraphExtractionEnvelope({
    schemaVersion: 2,
    sourceEpisodeId: "model-formation-validation",
    scope: input.scope,
    entities: graphEntities,
    events: rawEvents
  });
  return {
    decision: rawEvents.length === 0 ? "ignore" : envelope.decision,
    reason,
    entities: rawEvents.length === 0 ? [] : validated.entities.map((entity, index) => ({ ...entity, evidence: graphEntityEvidence[index] })),
    events: validated.events.map((event, index) => ({ ...event, evidence: eventEvidence[index] }))
  };
}
async function formMemoriesWithMainModel(ctx, input) {
  if (input.messages.length === 0) throw new TypeError("memory formation requires at least one human message");
  if (input.route.provider.trim().length === 0 || input.route.model.trim().length === 0) {
    throw new TypeError("memory formation requires a non-empty main-model route");
  }
  const directText = input.messages.map((message) => message.text).join("\n");
  if (containsCredentialLikeContent(directText)) {
    throw new TypeError("credential-like human input cannot be sent to memory formation");
  }
  const framedInput = frameMessages(input);
  const inputBytes = Buffer.byteLength(framedInput, "utf8");
  if (inputBytes > input.policy.maxInputBytes) {
    throw new RangeError(`memory formation input is ${String(inputBytes)} bytes, exceeding maxInputBytes ${String(input.policy.maxInputBytes)}`);
  }
  const timeoutSignal = AbortSignal.timeout(input.policy.timeoutMs);
  const signal = input.signal === void 0 ? timeoutSignal : AbortSignal.any([input.signal, timeoutSignal]);
  signal.throwIfAborted();
  const modelInfo = await ctx.llm.resolveModelInfo(
    input.route.provider,
    input.route.model,
    signal
  );
  const supportsReasoningOff = modelInfo.reasoning?.efforts.some((effort) => String(effort.id) === "off") === true;
  const formationRoute = {
    ...input.route,
    ...supportsReasoningOff ? { reasoningEffort: "off" } : {}
  };
  const messages2 = [createUserMessage({
    content: [{ type: "text", text: framedInput }],
    source: { kind: "plugin", plugin: "telos-continuity" }
  })];
  const options = deepFreeze({
    provider: formationRoute.provider,
    model: formationRoute.model,
    ...formationRoute.reasoningEffort === void 0 ? {} : { reasoningEffort: ReasoningEffortId(formationRoute.reasoningEffort) },
    messages: messages2,
    system: MEMORY_FORMATION_SYSTEM_PROMPT,
    maxTokens: input.policy.maxOutputTokens,
    sessionId: SessionId(input.sessionId),
    signal
  });
  signal.throwIfAborted();
  const assembler = new BlockAssembler();
  for await (const chunk of ctx.llm.stream(options)) {
    signal.throwIfAborted();
    assembler.push(chunk);
  }
  signal.throwIfAborted();
  const terminalError = finishError(assembler.finish);
  if (terminalError !== void 0) throw terminalError;
  const blocks = assembler.blocks();
  if (blocks.some((block) => block.type === "tool-call")) {
    throw new Error("memory formation output must contain text only");
  }
  const output = blocks.filter((block) => block.type === "text").map((block) => block.text).join("");
  if (output.trim().length === 0) throw new Error("memory formation model produced no JSON output");
  return {
    route: formationRoute,
    ...parseMemoryFormationOutput(output, input)
  };
}

// src/formation-worker.ts
function record3(value, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return value;
}
function requiredString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}
function optionalString(value, field) {
  return value === void 0 ? void 0 : requiredString(value, field);
}
function safeInteger(value, field) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative safe integer`);
  }
  return value;
}
function positiveInteger(value, field) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${field} must be a positive safe integer`);
  }
  return value;
}
function messages(value, field = "messages", allowEmpty = false) {
  if (allowEmpty && value === void 0) return [];
  if (!Array.isArray(value) || !allowEmpty && value.length === 0) {
    throw new TypeError(`${field} must be ${allowEmpty ? "an array" : "a non-empty array"}`);
  }
  return value.map((entry, index) => {
    const message = record3(entry, `${field}[${String(index)}]`);
    return {
      seq: safeInteger(message.seq, `${field}[${String(index)}].seq`),
      text: requiredString(message.text, `${field}[${String(index)}].text`)
    };
  });
}
function route(value) {
  const input = record3(value, "route");
  return {
    provider: requiredString(input.provider, "route.provider"),
    model: requiredString(input.model, "route.model"),
    reasoningEffort: optionalString(input.reasoningEffort, "route.reasoningEffort")
  };
}
function policy(value) {
  const input = record3(value, "policy");
  return {
    maxInputBytes: positiveInteger(input.maxInputBytes, "policy.maxInputBytes"),
    maxOutputTokens: positiveInteger(input.maxOutputTokens, "policy.maxOutputTokens"),
    timeoutMs: positiveInteger(input.timeoutMs, "policy.timeoutMs")
  };
}
function captureIntent(value) {
  if (value === void 0 || value === "automatic") return "automatic";
  if (value === "explicit") return "explicit";
  throw new TypeError("captureIntent must be automatic or explicit");
}
function confirmationStatus(value) {
  if (value === void 0 || value === "candidate") return "candidate";
  if (value === "confirmed") return "confirmed";
  throw new TypeError("confirmationStatus must be candidate or confirmed");
}
function entityWithoutEvidence(entity) {
  const { evidence: _evidence, ...identity } = entity;
  return identity;
}
function eventWithoutEvidence(event) {
  const { evidence: _evidence, ...memoryEvent } = event;
  return memoryEvent;
}
async function processJob(gateway, job, form) {
  const sessionId = requiredString(job.payload.sessionId, "sessionId");
  const workspaceId = optionalString(job.payload.workspaceId, "workspaceId");
  const turn = safeInteger(job.payload.turn, "turn");
  const directMessages = messages(job.payload.messages);
  const assistantMessages = messages(job.payload.assistantMessages, "assistantMessages", true);
  const formationRoute = route(job.payload.route);
  const contentHash = requiredString(job.payload.contentHash, "contentHash");
  const observedAt = requiredString(job.payload.observedAt, "observedAt");
  const referenceTime = optionalString(job.payload.referenceTime, "referenceTime") ?? observedAt;
  const timeZone = optionalString(job.payload.timeZone, "timeZone") ?? "UTC";
  const locale = optionalString(job.payload.locale, "locale") ?? "und";
  const intent = captureIntent(job.payload.captureIntent);
  const requestedStatus = confirmationStatus(job.payload.confirmationStatus);
  const scope2 = workspaceId === void 0 ? { type: "session", id: sessionId } : { type: "workspace", id: workspaceId };
  const result = await form({
    sessionId,
    captureIntent: intent,
    messages: directMessages,
    assistantMessages,
    referenceTime,
    timeZone,
    locale,
    scope: scope2,
    route: formationRoute,
    policy: policy(job.payload.policy)
  });
  let sourceEpisodeIds = [];
  let affectedEntityIds = [];
  let candidatesCreated = 0;
  if (result.events.length > 0) {
    const retainedEvidence = [.../* @__PURE__ */ new Set([
      ...result.entities.map((entity) => entity.evidence),
      ...result.events.map((event) => event.evidence)
    ])];
    const source2 = gateway.store.createSourceEpisode({
      sourceKind: "dsh.llm-memory-formation",
      runtimeId: "dsh",
      sourceInstanceId: `${sessionId}:turn:${String(turn)}:llm-memory-formation`,
      sessionId,
      seqStart: directMessages[0].seq,
      seqEnd: directMessages.at(-1).seq,
      observedAt,
      content: retainedEvidence.join("\n"),
      contentHash,
      sensitivity: "personal"
    });
    sourceEpisodeIds = [source2.id];
    const reconciliation = gateway.store.applyGraphExtractionBatch({
      schemaVersion: 2,
      sourceEpisodeId: source2.id,
      scope: scope2,
      entities: result.entities.map(entityWithoutEvidence),
      events: result.events.map(eventWithoutEvidence)
    }, {
      ownerEntityId: gateway.ownerEntity.id,
      actor: "agent",
      idempotencyKey: job.idempotencyKey
    });
    affectedEntityIds = [.../* @__PURE__ */ new Set([
      gateway.ownerEntity.id,
      ...reconciliation.entities.map((entity) => entity.entityId)
    ])];
    candidatesCreated = reconciliation.outcomes.filter((outcome) => outcome.decision === "created-candidate").length;
    if (requestedStatus === "confirmed") {
      for (const outcome of reconciliation.outcomes) {
        const claim = gateway.store.getClaim(outcome.claimId);
        if (claim?.status !== "candidate") continue;
        gateway.store.confirmCandidate({
          claimId: claim.id,
          sourceEpisodeIds: [source2.id],
          actor: "user",
          occurredAt: observedAt,
          idempotencyKey: `${job.idempotencyKey}:confirm:${String(outcome.eventIndex)}`
        });
      }
    }
  }
  gateway.store.recordActionReceipt({
    action: "memory.formation",
    authorization: requestedStatus === "confirmed" ? "allowed" : "not-required",
    runtimeId: "dsh",
    provider: `${result.route.provider}/${result.route.model}${result.route.reasoningEffort === void 0 ? "" : `#${result.route.reasoningEffort}`}`,
    result: "succeeded",
    scope: scope2,
    sourceEpisodeIds,
    affectedEntityIds,
    occurredAt: observedAt,
    idempotencyKey: `receipt:${job.idempotencyKey}`
  });
  return candidatesCreated;
}
async function processInferenceJobs(gateway, options) {
  const jobs = gateway.store.claimOutbox(options.limit ?? 4, 6e4, "infer-turn-candidates");
  let completed = 0;
  let failed = 0;
  let candidatesCreated = 0;
  for (const job of jobs) {
    try {
      candidatesCreated += await processJob(gateway, job, options.form);
      gateway.store.completeOutbox(job.id, { scrubPayload: true });
      completed += 1;
    } catch (error) {
      try {
        gateway.store.failOutbox(job.id, error, {
          maxAttempts: 5,
          retryDelayMs: 1e3,
          scrubPayloadOnDead: true
        });
      } catch {
      }
      try {
        options.onFailure?.(error, job);
      } catch {
      }
      failed += 1;
    }
  }
  return { claimed: jobs.length, completed, failed, candidatesCreated };
}

// src/gateway.ts
var OWNER_ENTITY_ID = "telos:owner";
var CLAIM_KINDS2 = ["semantic", "episodic", "procedural", "prospective", "constraint"];
var CLAIM_STATUSES = ["candidate", "confirmed", "superseded", "contradicted", "revoked", "expired"];
var SENSITIVITIES = ["personal", "sensitive", "secret"];
var ENTITY_KINDS3 = ["person", "place", "organization", "workspace", "project", "topic", "goal", "commitment", "decision", "constraint", "preference", "artifact"];
function record4(value, field = "payload") {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}
function string(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}
function optionalString2(value, field) {
  return value === void 0 ? void 0 : string(value, field);
}
function boolean(value, field, fallback) {
  if (value === void 0) return fallback;
  if (typeof value !== "boolean") throw new TypeError(`${field} must be a boolean`);
  return value;
}
function number(value, field, fallback) {
  if (value === void 0 && fallback !== void 0) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${field} must be a finite number`);
  return value;
}
function optionalNumber(value, field) {
  return value === void 0 ? void 0 : number(value, field);
}
function member(value, values, field, fallback) {
  if (value === void 0 && fallback !== void 0) return fallback;
  if (typeof value !== "string" || !values.includes(value)) throw new TypeError(`${field} is invalid`);
  return value;
}
function stringArray(value, values, field) {
  if (value === void 0) return void 0;
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
  return value.map((entry, index) => member(entry, values, `${field}[${String(index)}]`));
}
function scope(value) {
  const input = record4(value, "scope");
  const type = member(input.type, ["global", "workspace", "session"], "scope.type");
  if (type === "global") return { type };
  return { type, id: string(input.id, "scope.id") };
}
function optionalScope(value) {
  return value === void 0 ? void 0 : scope(value);
}
function source(value) {
  const input = record4(value, "source");
  return {
    sourceKind: string(input.sourceKind, "source.sourceKind"),
    runtimeId: optionalString2(input.runtimeId, "source.runtimeId"),
    sourceInstanceId: string(input.sourceInstanceId, "source.sourceInstanceId"),
    sessionId: optionalString2(input.sessionId, "source.sessionId"),
    seqStart: optionalNumber(input.seqStart, "source.seqStart"),
    seqEnd: optionalNumber(input.seqEnd, "source.seqEnd"),
    observedAt: optionalString2(input.observedAt, "source.observedAt"),
    content: optionalString2(input.content, "source.content"),
    contentHash: optionalString2(input.contentHash, "source.contentHash"),
    sensitivity: input.sensitivity === void 0 ? void 0 : member(input.sensitivity, SENSITIVITIES, "source.sensitivity")
  };
}
function rememberCommand(value) {
  const input = record4(value);
  return {
    statement: string(input.statement, "statement"),
    predicate: string(input.predicate, "predicate"),
    objectValue: string(input.objectValue, "objectValue"),
    kind: member(input.kind, CLAIM_KINDS2, "kind", "semantic"),
    scope: scope(input.scope),
    sensitivity: member(input.sensitivity, SENSITIVITIES, "sensitivity", "personal"),
    confidence: number(input.confidence, "confidence", 1),
    importance: number(input.importance, "importance", 0.7),
    status: member(input.status, ["candidate", "confirmed"], "status", "confirmed"),
    source: source(input.source),
    actor: member(input.actor, ["user", "agent", "runtime"], "actor", "user"),
    idempotencyKey: string(input.idempotencyKey, "idempotencyKey"),
    validFrom: optionalString2(input.validFrom, "validFrom"),
    validTo: optionalString2(input.validTo, "validTo")
  };
}
function correctCommand(value) {
  const input = record4(value);
  return {
    ...rememberCommand(input),
    claimId: string(input.claimId, "claimId")
  };
}
function confirmCommand(value) {
  const input = record4(value);
  return {
    claimId: string(input.claimId, "claimId"),
    source: source(input.source),
    actor: member(input.actor, ["user"], "actor", "user"),
    idempotencyKey: string(input.idempotencyKey, "idempotencyKey")
  };
}
function forgetCommand(value) {
  const input = record4(value);
  return {
    claimId: string(input.claimId, "claimId"),
    physical: boolean(input.physical, "physical", false),
    purgeSourceContent: boolean(input.purgeSourceContent, "purgeSourceContent", false),
    idempotencyKey: string(input.idempotencyKey, "idempotencyKey"),
    actor: member(input.actor, ["user", "agent"], "actor", "user")
  };
}
function recallCommand(value) {
  const input = record4(value);
  return {
    query: string(input.query, "query"),
    workspaceId: optionalString2(input.workspaceId, "workspaceId"),
    sessionId: optionalString2(input.sessionId, "sessionId"),
    includeCandidates: boolean(input.includeCandidates, "includeCandidates", false),
    allowedSensitivities: stringArray(input.allowedSensitivities, SENSITIVITIES, "allowedSensitivities"),
    maxClaims: optionalNumber(input.maxClaims, "maxClaims"),
    maxChars: optionalNumber(input.maxChars, "maxChars"),
    graphDepth: optionalNumber(input.graphDepth, "graphDepth"),
    minScore: optionalNumber(input.minScore, "minScore")
  };
}
function listClaimsCommand(value) {
  const input = value === void 0 ? {} : record4(value);
  return {
    statuses: stringArray(input.statuses, CLAIM_STATUSES, "statuses"),
    scope: optionalScope(input.scope),
    limit: optionalNumber(input.limit, "limit")
  };
}
function assertNoCredentialContent(command) {
  const content = [command.statement, command.objectValue, command.source.content].filter(Boolean).join("\n");
  if (containsCredentialLikeContent(content)) {
    throw new TypeError("credentials and secrets cannot be stored in Telos continuity");
  }
}
function success(value) {
  return { ok: true, value };
}
function failure(error) {
  if (error instanceof TypeError || error instanceof RangeError || error instanceof Error && error.message.startsWith("unknown ")) {
    return { ok: false, error: { code: "bad-request", message: error.message, details: { issues: [] } } };
  }
  return {
    ok: false,
    error: { code: "internal", message: error instanceof Error ? error.message : String(error), details: {} }
  };
}
var ContinuityGateway = class {
  store;
  ownerEntity;
  ownsStore;
  onBackgroundError;
  constructor(options) {
    if (options.store === void 0 && options.databasePath === void 0) {
      throw new TypeError("continuity gateway requires databasePath or store");
    }
    this.store = options.store ?? new PersonalContinuityStore({ databasePath: options.databasePath });
    this.ownsStore = options.store === void 0;
    this.onBackgroundError = options.onBackgroundError ?? (() => void 0);
    this.ownerEntity = this.store.createEntity({
      id: OWNER_ENTITY_ID,
      kind: "person",
      canonicalName: "User",
      scope: { type: "global" },
      actor: "system",
      idempotencyKey: "telos:owner:v1"
    });
  }
  close() {
    if (this.ownsStore) this.store.close();
  }
  health() {
    const lastBackgroundError = this.onBackgroundError();
    return {
      schemaVersion: this.store.schemaVersion(),
      integrity: this.store.integrityCheck(),
      databasePath: this.store.databasePath,
      ...lastBackgroundError === void 0 ? {} : { lastBackgroundError }
    };
  }
  remember(command) {
    assertNoCredentialContent(command);
    const episode = this.store.createSourceEpisode(command.source);
    return this.store.remember({
      kind: command.kind,
      statement: command.statement,
      predicate: command.predicate,
      subjectEntityId: this.ownerEntity.id,
      objectValue: command.objectValue,
      status: command.status,
      confidence: command.confidence,
      importance: command.importance,
      sensitivity: command.sensitivity,
      scope: command.scope,
      validFrom: command.validFrom,
      validTo: command.validTo,
      sourceEpisodeIds: [episode.id],
      actor: command.actor,
      idempotencyKey: command.idempotencyKey
    });
  }
  correct(command) {
    assertNoCredentialContent(command);
    const episode = this.store.createSourceEpisode(command.source);
    return this.store.correct({
      claimId: command.claimId,
      kind: command.kind,
      statement: command.statement,
      predicate: command.predicate,
      subjectEntityId: this.ownerEntity.id,
      objectValue: command.objectValue,
      status: command.status,
      confidence: command.confidence,
      importance: command.importance,
      sensitivity: command.sensitivity,
      scope: command.scope,
      validFrom: command.validFrom,
      validTo: command.validTo,
      sourceEpisodeIds: [episode.id],
      actor: command.actor,
      idempotencyKey: command.idempotencyKey
    });
  }
  confirm(command) {
    const episode = this.store.createSourceEpisode(command.source);
    return this.store.confirmCandidate({
      claimId: command.claimId,
      sourceEpisodeIds: [episode.id],
      actor: command.actor,
      idempotencyKey: command.idempotencyKey
    });
  }
  forget(command) {
    return this.store.forget(command.claimId, {
      physical: command.physical,
      purgeSourceContent: command.purgeSourceContent,
      idempotencyKey: command.idempotencyKey,
      actor: command.actor
    });
  }
  recall(command) {
    return this.store.recall(command.query, {
      workspaceId: command.workspaceId,
      sessionId: command.sessionId,
      includeCandidates: command.includeCandidates,
      allowedSensitivities: command.allowedSensitivities
    }, {
      maxClaims: command.maxClaims,
      maxChars: command.maxChars,
      graphDepth: command.graphDepth,
      minScore: command.minScore
    });
  }
  async handle(endpoint, payload) {
    try {
      switch (endpoint) {
        case "health":
          return success(this.health());
        case "memory/list":
          return success(this.store.listClaims(listClaimsCommand(payload)));
        case "memory/remember":
          return success(this.remember(rememberCommand(payload)));
        case "memory/confirm":
          return success(this.confirm(confirmCommand(payload)));
        case "memory/correct":
          return success(this.correct(correctCommand(payload)));
        case "memory/forget":
          return success(this.forget(forgetCommand(payload)));
        case "memory/recall":
          return success(this.recall(recallCommand(payload)));
        case "memory/explain": {
          const input = record4(payload);
          return success(this.store.explainRecall(string(input.recallId, "recallId")) ?? null);
        }
        case "recall/list": {
          const input = payload === void 0 ? {} : record4(payload);
          return success(this.store.listRecallDecisions({
            sessionId: optionalString2(input.sessionId, "sessionId"),
            claimId: optionalString2(input.claimId, "claimId"),
            limit: optionalNumber(input.limit, "limit")
          }));
        }
        case "materialization/list": {
          const input = payload === void 0 ? {} : record4(payload);
          return success(this.store.listMaterializations({
            recallId: optionalString2(input.recallId, "recallId"),
            claimId: optionalString2(input.claimId, "claimId"),
            sessionId: optionalString2(input.sessionId, "sessionId"),
            limit: optionalNumber(input.limit, "limit")
          }));
        }
        case "source/get": {
          const input = record4(payload);
          return success(this.store.getSourceEpisode(string(input.sourceEpisodeId, "sourceEpisodeId")) ?? null);
        }
        case "entity/list": {
          const input = payload === void 0 ? {} : record4(payload);
          return success(this.store.listEntities({
            scope: optionalScope(input.scope),
            kinds: stringArray(input.kinds, ENTITY_KINDS3, "kinds"),
            limit: optionalNumber(input.limit, "limit")
          }));
        }
        case "graph/list": {
          const input = payload === void 0 ? {} : record4(payload);
          return success(this.store.listRelations({
            entityId: optionalString2(input.entityId, "entityId"),
            statuses: stringArray(input.statuses, CLAIM_STATUSES, "statuses"),
            limit: optionalNumber(input.limit, "limit")
          }));
        }
        case "receipt/list": {
          const input = payload === void 0 ? {} : record4(payload);
          return success(this.store.listActionReceipts({
            scope: optionalScope(input.scope),
            limit: optionalNumber(input.limit, "limit")
          }));
        }
        case "deletion/list": {
          const input = payload === void 0 ? {} : record4(payload);
          return success(this.store.listForgetReports(optionalString2(input.claimId, "claimId")));
        }
        default:
          throw new TypeError(`unknown continuity endpoint ${endpoint}`);
      }
    } catch (error) {
      return failure(error);
    }
  }
};

// src/index.ts
var name = "telos-continuity";
var inject = ["agents", "connection", "llm", "tools", "workspaceRegistry"];
var TEXT_OUTPUT = {
  schema: { type: "string" },
  render: (_args, value) => [{ type: "text", text: value }]
};
var CLAIM_KINDS3 = ["semantic", "episodic", "procedural", "prospective", "constraint"];
var SENSITIVITIES2 = ["personal", "sensitive"];
function boundedInteger(value, fallback, minimum, maximum, field) {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < minimum || resolved > maximum) {
    throw new RangeError(`${field} must be an integer between ${String(minimum)} and ${String(maximum)}`);
  }
  return resolved;
}
function resolveConfig(config) {
  if (typeof config.databasePath !== "string" || config.databasePath.trim().length === 0) {
    throw new TypeError("telos-continuity databasePath must be a non-empty string");
  }
  return {
    databasePath: config.databasePath,
    maxRecallClaims: boundedInteger(config.maxRecallClaims, 8, 1, 50, "maxRecallClaims"),
    maxRecallChars: boundedInteger(config.maxRecallChars, 2400, 128, 2e4, "maxRecallChars"),
    graphDepth: boundedInteger(config.graphDepth, 2, 0, 4, "graphDepth"),
    captureTurnSources: config.captureTurnSources ?? true,
    queueInference: config.queueInference ?? true,
    formationMaxInputBytes: boundedInteger(config.formationMaxInputBytes, 16e3, 512, 2e5, "formationMaxInputBytes"),
    formationMaxOutputTokens: boundedInteger(config.formationMaxOutputTokens, 4096, 64, 16384, "formationMaxOutputTokens"),
    formationTimeoutMs: boundedInteger(config.formationTimeoutMs, 6e4, 1e3, 3e5, "formationTimeoutMs")
  };
}
function eventHash(event) {
  return createHash2("sha256").update(JSON.stringify(event)).digest("hex");
}
function textOf(blocks) {
  return blocks.flatMap((block) => block.type === "text" ? [block.text] : []).join("\n").trim();
}
function workspaceFor(ctx, sessionId) {
  return ctx.workspaceRegistry.list().find((workspace) => workspace.sessionIds.some((id) => String(id) === sessionId));
}
function contextFor(ctx, agent) {
  const sessionId = String(agent.id);
  const workspaceId = workspaceFor(ctx, sessionId)?.id;
  return { sessionId, ...workspaceId === void 0 ? {} : { workspaceId: String(workspaceId) } };
}
function scopeFor(ctx, agent, requested) {
  if (requested === "global") return { type: "global" };
  if (requested === "session") return { type: "session", id: String(agent.id) };
  const workspace = workspaceFor(ctx, String(agent.id));
  if (workspace === void 0) throw new Error("current DSH session is not attached to a workspace");
  return { type: "workspace", id: String(workspace.id) };
}
function directHumanExecution(ctx, exec) {
  const agent = exec.agent;
  if (agent === void 0 || ctx.agents.get(agent.id) !== agent || agent.status !== "running" || ctx.agents.currentInitiator() !== agent || !ctx.agents.roots().includes(agent)) {
    throw new Error("continuity mutations require the exact live top-level agent");
  }
  const events = agent.session.events;
  let turnStart = -1;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.type === "turn/end") break;
    if (event?.type === "turn/start") {
      turnStart = index;
      break;
    }
  }
  if (turnStart < 0) throw new Error("continuity mutations require an open DSH turn");
  const sourceEvent = events.slice(turnStart + 1).findLast((event) => event.type === "user/message" && event.data.source.kind === "user");
  if (sourceEvent === void 0) throw new Error("continuity mutations require direct human input in the current turn");
  return { agent, sourceEvent };
}
function sourceFor(execution) {
  return {
    sourceKind: "dsh.user-message",
    runtimeId: "dsh",
    sourceInstanceId: `${String(execution.agent.id)}:${String(execution.sourceEvent.seq)}`,
    sessionId: String(execution.agent.id),
    seqStart: execution.sourceEvent.seq,
    seqEnd: execution.sourceEvent.seq,
    observedAt: new Date(execution.sourceEvent.time).toISOString(),
    contentHash: eventHash(execution.sourceEvent),
    sensitivity: "personal"
  };
}
function claimSummary(claim) {
  return JSON.stringify({
    claimId: claim.id,
    status: claim.status,
    kind: claim.kind,
    scope: claim.scope,
    statement: claim.statement,
    sourceEpisodeIds: claim.sourceEpisodeIds
  });
}
function rememberStatusFromArguments(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed.confirmation === "candidate" ? "candidate" : "confirmed";
  } catch {
    return "confirmed";
  }
}
function recallSummary(decision) {
  return JSON.stringify({
    recallId: decision.id,
    selected: decision.selectedClaims.map((claim) => ({
      claimId: claim.id,
      statement: claim.statement,
      scope: claim.scope,
      status: claim.status,
      sourceEpisodeIds: claim.sourceEpisodeIds
    })),
    contradictionSets: decision.contradictionSets,
    candidates: decision.candidates
  });
}
function assertClaimAccessible(ctx, agent, claim) {
  const current = contextFor(ctx, agent);
  if (claim.scope.type === "workspace" && claim.scope.id !== current.workspaceId) throw new Error("claim is outside the current workspace");
  if (claim.scope.type === "session" && claim.scope.id !== current.sessionId) throw new Error("claim is outside the current session");
}
function assertRecallAccessible(ctx, agent, decision) {
  const current = contextFor(ctx, agent);
  if (decision.context.workspaceId !== void 0 && decision.context.workspaceId !== current.workspaceId) {
    throw new Error("recall decision is outside the current workspace");
  }
  if (decision.context.sessionId !== void 0 && decision.context.sessionId !== current.sessionId) {
    throw new Error("recall decision is outside the current session");
  }
  for (const claim of decision.selectedClaims) assertClaimAccessible(ctx, agent, claim);
}
function installTools(ctx, gateway) {
  ctx.tools.register(defineTool({
    name: "continuity_remember",
    description: "Authorize Telos to form structured memory from the current direct human message. Call only when the human explicitly asks to remember it. This tool queues the same main-model entity/event formation used by automatic candidates; it does not write a flat fact. Choose candidate when the human says the memory is provisional, uncertain, or pending confirmation. Never capture secrets or inferred private attributes.",
    parameters: {
      confirmation: {
        type: "string",
        enum: ["confirmed", "candidate"],
        description: "Use confirmed for an explicit durable save; candidate when the human asks to keep it pending review. Defaults to confirmed."
      }
    },
    output: TEXT_OUTPUT,
    async execute(args, exec) {
      directHumanExecution(ctx, exec);
      return JSON.stringify({
        accepted: true,
        formation: "queued-after-turn",
        confirmation: args.confirmation === "candidate" ? "candidate" : "confirmed"
      });
    }
  }));
  ctx.tools.register(defineTool({
    name: "continuity_correct",
    description: "Supersede one accessible personal memory after the direct human corrects or changes it. Read the claim id with continuity_search first.",
    parameters: {
      claim_id: { type: "string", required: true },
      statement: { type: "string", required: true },
      predicate: { type: "string", required: true },
      value: { type: "string", required: true },
      kind: { type: "string", enum: [...CLAIM_KINDS3] },
      scope: { type: "string", enum: ["global", "workspace", "session"] },
      sensitivity: { type: "string", enum: [...SENSITIVITIES2] },
      importance: { type: "number" }
    },
    output: TEXT_OUTPUT,
    async execute(args, exec) {
      const execution = directHumanExecution(ctx, exec);
      const previous = gateway.store.getClaim(args.claim_id);
      if (previous === void 0) throw new Error(`unknown claim ${args.claim_id}`);
      assertClaimAccessible(ctx, execution.agent, previous);
      const command = {
        claimId: previous.id,
        statement: args.statement,
        predicate: args.predicate,
        objectValue: args.value,
        kind: args.kind ?? previous.kind,
        scope: args.scope === void 0 ? previous.scope : scopeFor(ctx, execution.agent, args.scope),
        sensitivity: args.sensitivity ?? previous.sensitivity,
        confidence: 1,
        importance: args.importance ?? previous.importance,
        status: "confirmed",
        source: sourceFor(execution),
        actor: "user",
        idempotencyKey: `dsh:${String(execution.agent.id)}:${String(exec.callId)}:correct`
      };
      return claimSummary(gateway.correct(command));
    }
  }));
  ctx.tools.register(defineTool({
    name: "continuity_search",
    description: "Search Telos personal continuity for relevant confirmed facts in the current session/workspace boundary, with claim ids and provenance.",
    parameters: {
      query: { type: "string", required: true },
      include_candidates: { type: "boolean", description: "Include unconfirmed candidate memories; defaults to false." },
      max_claims: { type: "integer", description: "Maximum returned claims, 1 to 20." }
    },
    output: TEXT_OUTPUT,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      if (exec.agent === void 0) throw new Error("continuity_search requires a calling agent");
      return recallSummary(gateway.recall({
        query: args.query,
        ...contextFor(ctx, exec.agent),
        includeCandidates: args.include_candidates ?? false,
        allowedSensitivities: ["personal"],
        maxClaims: Math.min(args.max_claims ?? 8, 20)
      }));
    }
  }));
  ctx.tools.register(defineTool({
    name: "continuity_explain",
    description: "Explain a prior Telos recall decision, including selected and ignored claim ids, reasons, sources, scope, and contradictions.",
    parameters: { recall_id: { type: "string", required: true } },
    output: TEXT_OUTPUT,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      if (exec.agent === void 0) throw new Error("continuity_explain requires a calling agent");
      const decision = gateway.store.explainRecall(args.recall_id);
      if (decision === void 0) return JSON.stringify({ recallId: args.recall_id, found: false });
      assertRecallAccessible(ctx, exec.agent, decision);
      return recallSummary(decision);
    }
  }));
  ctx.tools.register(defineTool({
    name: "continuity_forget",
    description: "Revoke one accessible Telos memory only after a direct human asks to forget it. Physical purge is optional and returns any DSH sessions that still contain a recalled copy.",
    parameters: {
      claim_id: { type: "string", required: true },
      physical: { type: "boolean", description: "Physically remove the claim after revocation; defaults to false." },
      purge_source_content: { type: "boolean", description: "Purge unshared locally retained evidence content; defaults to false." }
    },
    output: TEXT_OUTPUT,
    async execute(args, exec) {
      const execution = directHumanExecution(ctx, exec);
      const claim = gateway.store.getClaim(args.claim_id);
      if (claim === void 0) throw new Error(`unknown claim ${args.claim_id}`);
      assertClaimAccessible(ctx, execution.agent, claim);
      return JSON.stringify(gateway.forget({
        claimId: claim.id,
        physical: args.physical ?? false,
        purgeSourceContent: args.purge_source_content ?? false,
        actor: "user",
        idempotencyKey: `dsh:${String(execution.agent.id)}:${String(exec.callId)}:forget`
      }));
    }
  }));
}
function installRecallHook(ctx, gateway, config, reportBackgroundError) {
  ctx.on("agent/pre-step", async ({ agent, messages: messages2, signal }, next) => {
    if (signal.aborted) return next();
    const query = messages2.filter((message) => message.source.kind === "user").map((message) => textOf(message.content)).filter(Boolean).join("\n");
    if (query.length === 0) return next();
    let decision;
    try {
      decision = gateway.recall({
        query,
        ...contextFor(ctx, agent),
        allowedSensitivities: ["personal"],
        maxClaims: config.maxRecallClaims,
        maxChars: config.maxRecallChars,
        graphDepth: config.graphDepth
      });
    } catch (error) {
      reportBackgroundError(error);
      ctx.logger.warn(`telos-continuity recall failed: ${String(error)}`);
      return next();
    }
    const downstream = await next();
    if (downstream.kind !== "enter" || decision.contextPack.text.length === 0) return downstream;
    const recallMessage = createUserMessage2({
      content: [{ type: "text", text: decision.contextPack.text }],
      source: { kind: "plugin", plugin: "telos-continuity", form: "recall" }
    });
    return { kind: "enter", messages: [...downstream.messages, recallMessage] };
  });
}
function installSessionObserver(ctx, gateway, config, reportBackgroundError, scheduleInference) {
  const turns = /* @__PURE__ */ new WeakMap();
  const toolCalls = /* @__PURE__ */ new WeakMap();
  ctx.on("session/event", (session, event) => {
    try {
      if (event.type === "turn/start") {
        const digest = createHash2("sha256");
        digest.update(JSON.stringify(event));
        turns.set(session, {
          turn: event.data.turn,
          startSeq: event.seq,
          digest,
          directMessages: [],
          assistantMessages: [],
          continuityMutationCompleted: false
        });
      } else {
        turns.get(session)?.digest.update(JSON.stringify(event));
      }
      if (event.type === "tool/call") {
        const calls = toolCalls.get(session) ?? /* @__PURE__ */ new Map();
        calls.set(String(event.data.callId), {
          seq: event.seq,
          name: event.data.name,
          ...event.data.name === "continuity_remember" ? { rememberStatus: rememberStatusFromArguments(event.data.arguments) } : {}
        });
        toolCalls.set(session, calls);
      }
      if (event.type === "tool/result") {
        const callId = String(event.data.message.source.callId);
        const call = toolCalls.get(session)?.get(callId);
        if (call !== void 0) {
          const episode = gateway.store.createSourceEpisode({
            sourceKind: "dsh.tool-execution",
            runtimeId: "dsh",
            sourceInstanceId: `${String(session.id)}:${callId}`,
            sessionId: String(session.id),
            seqStart: call.seq,
            seqEnd: event.seq,
            observedAt: new Date(event.time).toISOString(),
            contentHash: eventHash(event)
          });
          const isError = event.data.message.content.some((block) => block.type === "tool-result" && block.isError);
          if (!isError && call.name === "continuity_remember") {
            const trace = turns.get(session);
            if (trace !== void 0) {
              const requested = call.rememberStatus ?? "confirmed";
              trace.explicitRememberStatus = trace.explicitRememberStatus === "candidate" ? "candidate" : requested;
            }
          } else if (!isError && ["continuity_correct", "continuity_forget"].includes(call.name)) {
            const trace = turns.get(session);
            if (trace !== void 0) trace.continuityMutationCompleted = true;
          }
          const workspace = workspaceFor(ctx, String(session.id));
          gateway.store.recordActionReceipt({
            action: call.name,
            authorization: "allowed",
            runtimeId: "dsh",
            provider: "dsh-tool",
            result: isError ? "failed" : "succeeded",
            scope: workspace === void 0 ? { type: "session", id: String(session.id) } : { type: "workspace", id: String(workspace.id) },
            sourceEpisodeIds: [episode.id],
            idempotencyKey: `dsh-action:${String(session.id)}:${callId}:${String(event.seq)}`
          });
          toolCalls.get(session)?.delete(callId);
        }
      }
      if (event.type === "user/message" && event.data.source.kind === "user" && config.queueInference) {
        const trace = turns.get(session);
        if (trace !== void 0) {
          const text3 = textOf(event.data.content);
          if (text3.length > 0) trace.directMessages.push({ seq: event.seq, time: event.time, text: text3 });
        }
      }
      if (event.type === "assistant/message" && config.queueInference) {
        const trace = turns.get(session);
        if (trace !== void 0) {
          const text3 = textOf(event.data.message.content);
          if (text3.length > 0 && !containsCredentialLikeContent(text3)) {
            trace.assistantMessages.push({ seq: event.seq, text: text3 });
          }
        }
      }
      if (event.type === "user/message" && event.data.source.kind === "plugin" && event.data.source.plugin === "telos-continuity" && event.data.source.form === "recall") {
        const text3 = textOf(event.data.content);
        const recallId = /<telos_continuity recall_id="([^"]+)">/.exec(text3)?.[1];
        if (recallId !== void 0) {
          gateway.store.recordMaterialization({
            recallId,
            runtimeId: "dsh",
            sessionId: String(session.id),
            seqStart: event.seq,
            seqEnd: event.seq,
            renderedContentHash: createHash2("sha256").update(text3).digest("hex")
          });
        }
      }
      if (event.type === "turn/end") {
        const trace = turns.get(session);
        turns.delete(session);
        if (trace === void 0 || trace.turn !== event.data.turn) return;
        const contentHash = trace.digest.digest("hex");
        if (config.captureTurnSources) {
          gateway.store.createSourceEpisode({
            sourceKind: "dsh.turn",
            runtimeId: "dsh",
            sourceInstanceId: `${String(session.id)}:turn:${String(trace.turn)}`,
            sessionId: String(session.id),
            seqStart: trace.startSeq,
            seqEnd: event.seq,
            observedAt: new Date(event.time).toISOString(),
            contentHash
          });
        }
        const directText = trace.directMessages.map((message) => message.text).join("\n");
        if (!config.queueInference || trace.directMessages.length === 0 || trace.continuityMutationCompleted || containsCredentialLikeContent(directText)) return;
        const workspace = workspaceFor(ctx, String(session.id));
        const scope2 = workspace === void 0 ? { type: "session", id: String(session.id) } : { type: "workspace", id: String(workspace.id) };
        if (explicitMemoryVetoRequested(trace.directMessages)) {
          gateway.store.recordActionReceipt({
            action: "memory.formation",
            authorization: "denied",
            runtimeId: "dsh",
            provider: "telos-durable-memory-policy",
            result: "denied",
            scope: scope2,
            sourceEpisodeIds: [],
            occurredAt: new Date(trace.directMessages.at(-1).time).toISOString(),
            idempotencyKey: `receipt:infer:${String(session.id)}:${String(trace.turn)}:veto`
          });
          return;
        }
        const route2 = session.requestHeader()?.config;
        if (route2 === void 0) return;
        gateway.store.enqueue("infer-turn-candidates", {
          sessionId: String(session.id),
          workspaceId: workspace === void 0 ? void 0 : String(workspace.id),
          turn: trace.turn,
          captureIntent: trace.explicitRememberStatus === void 0 ? "automatic" : "explicit",
          confirmationStatus: trace.explicitRememberStatus === void 0 || explicitReviewRequested(trace.directMessages) ? "candidate" : trace.explicitRememberStatus,
          messages: trace.directMessages.map((message) => ({ seq: message.seq, text: message.text })),
          assistantMessages: trace.assistantMessages,
          referenceTime: new Date(trace.directMessages.at(-1).time).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          locale: Intl.DateTimeFormat().resolvedOptions().locale || "und",
          route: {
            provider: route2.provider,
            model: route2.model,
            reasoningEffort: route2.reasoningEffort
          },
          policy: {
            maxInputBytes: config.formationMaxInputBytes,
            maxOutputTokens: config.formationMaxOutputTokens,
            timeoutMs: config.formationTimeoutMs
          },
          contentHash,
          observedAt: new Date(trace.directMessages.at(-1).time).toISOString()
        }, `infer:${String(session.id)}:${String(trace.turn)}`);
        scheduleInference();
      }
    } catch (error) {
      reportBackgroundError(error);
      ctx.logger.warn(`telos-continuity observer contained failure: ${String(error)}`);
    }
  });
}
function apply(ctx, input) {
  const config = resolveConfig(input);
  let lastBackgroundError;
  const reportBackgroundError = (error) => {
    lastBackgroundError = error instanceof Error ? error.message : String(error);
  };
  const gateway = new ContinuityGateway({
    databasePath: config.databasePath,
    onBackgroundError: () => lastBackgroundError
  });
  const inferenceAbort = new AbortController();
  let closing = false;
  let inferenceRequested = false;
  let inferenceRunning;
  let inferenceRetryTimer;
  const scheduleRetry = () => {
    if (closing || inferenceRetryTimer !== void 0) return;
    inferenceRetryTimer = setTimeout(() => {
      inferenceRetryTimer = void 0;
      scheduleInference();
    }, 1e3);
  };
  const scheduleInference = () => {
    if (!config.queueInference || closing) return;
    inferenceRequested = true;
    if (inferenceRunning !== void 0) return;
    inferenceRunning = (async () => {
      while (inferenceRequested && !closing) {
        inferenceRequested = false;
        try {
          const result = await processInferenceJobs(gateway, {
            form: (input2) => formMemoriesWithMainModel(ctx, { ...input2, signal: inferenceAbort.signal }),
            onFailure: (error, job) => {
              reportBackgroundError(error);
              ctx.logger.warn(`telos-continuity inference job ${job.id} failed: ${String(error)}`);
            }
          });
          if (result.claimed === 4 && result.failed === 0) inferenceRequested = true;
          if (result.failed > 0) scheduleRetry();
        } catch (error) {
          reportBackgroundError(error);
          ctx.logger.warn(`telos-continuity inference worker failed: ${String(error)}`);
          scheduleRetry();
        }
      }
    })().finally(() => {
      inferenceRunning = void 0;
      if (inferenceRequested && !closing) scheduleInference();
    });
  };
  ctx.provide("telosContinuity", gateway);
  ctx.effect(() => async () => {
    closing = true;
    inferenceAbort.abort(new Error("telos-continuity is stopping"));
    if (inferenceRetryTimer !== void 0) clearTimeout(inferenceRetryTimer);
    await inferenceRunning;
    gateway.close();
  }, "telos-continuity: close personal core");
  ctx.connection.rpc.handle(
    CONTINUITY_RPC_CHANNEL,
    async (endpoint, payload) => gateway.handle(endpoint, payload),
    { authority: "loopback" }
  );
  installTools(ctx, gateway);
  installRecallHook(ctx, gateway, config, reportBackgroundError);
  installSessionObserver(ctx, gateway, config, reportBackgroundError, scheduleInference);
  scheduleInference();
  ctx.inject(["systemPrompt"], (promptCtx) => {
    promptCtx.systemPrompt.section({
      name: "tool:telos-continuity",
      order: 112,
      text: "Telos personal continuity is distinct from DSH session history. Use continuity_remember only as explicit human authorization to queue main-model entity/event formation; never call it when the human says not to save something as long-term memory or says mentions only. Set confirmation=candidate for provisional, uncertain, or pending-review memory. continuity_correct instead of overwriting history, continuity_forget for explicit revocation, and continuity_search or continuity_explain for evidence. Never store credentials, secrets, inferred sensitive attributes, or an entire conversation."
    });
  });
}
export {
  CONTINUITY_RPC_CHANNEL,
  ContinuityGateway,
  apply,
  inject,
  name
};
