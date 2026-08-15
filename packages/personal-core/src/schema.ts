export const PERSONAL_CORE_SCHEMA_VERSION = 1

export const MIGRATION_1 = `
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
`
