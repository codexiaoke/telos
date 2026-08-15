# ADR 0006: Personal continuity engine and DSH continuity plugin

- Status: Accepted for implementation
- Date: 2026-08-15

## Decision

Telos will implement a local-first Personal Continuity Engine as a Telos-owned
domain package and expose it to DeepSeek Harness through an additive Host/Client
plugin. The engine is the authority for personal entities, evidence, memory
claims, commitments, constraints, relationships, recall decisions, and action
receipts. DSH remains the authority for its own workspaces, sessions, tool loop,
and session log.

The first complete release must prove that a user can record a decision in one
session, resume it in a different session or model, correct it, understand why
it was recalled, have it constrain a later action, and revoke it without
silently leaving an active copy in a Telos projection.

The implementation is split into two product-owned packages:

- `@telos/personal-core`: runtime-neutral domain contracts, SQLite authority,
  indexes, projections, recall planning, deletion, and evaluation fixtures;
- `@telos/dsh-continuity`: the replaceable DSH adapter, memory tools, live
  hooks, per-session receipts, and Web Client contributions.

Removing the DSH plugin must leave the pinned default DSH composition usable.
Removing or replacing DSH must not delete or reinterpret the Personal Core
database.

## Product outcome

The capability is named **personal continuity**, not merely long-term memory.
It maintains four complementary forms of durable personal state:

1. semantic: preferences, facts, people, project decisions, and constraints;
2. episodic: what happened, when it happened, and the exact source evidence;
3. procedural: proven routines, working preferences, and learned methods;
4. prospective: commitments, deadlines, open loops, and intended next actions.

DSH's existing live Session remains working context. Personal continuity sits
above Sessions and obeys their Workspace boundaries; it does not collapse the
product into one conversation.

## Authority and projections

The authority chain is:

```text
DSH SessionEvent range or another admitted source
  -> SourceEpisode (lossless evidence reference)
  -> EntityEvent (what Telos observed or changed)
  -> MemoryClaim (a typed, governed interpretation)
  -> current relation/timeline/search projections
  -> RecallDecision and bounded ContextPack
  -> model response or action
  -> ActionReceipt
  -> new EntityEvent
```

Raw evidence and append-only entity events are authoritative. A `MemoryClaim`
is an interpretation with lifecycle, not ground truth by itself. Relation,
timeline, full-text, and future vector indexes are rebuildable projections.
No graph database is required for v1; personal-scale traversal uses relational
edges and recursive SQLite queries.

## Domain contracts

### Scope

Every claim, event, and recall decision has exactly one scope:

- `global`: available across the user's workspaces;
- `workspace`: bound to one stable DSH `WorkspaceId`;
- `session`: bound to one DSH `SessionId` and never recalled elsewhere.

Workspace scope references DSH identity but does not copy or own the Workspace
record. Unknown, detached, or deleted Workspaces do not promote their claims to
global scope.

### SourceEpisode

A source episode records:

- stable episode id and source kind;
- runtime id and source instance id;
- DSH session id plus inclusive event sequence range when applicable;
- observed and recorded timestamps;
- content hash and optional locally retained source content;
- sensitivity and deletion state.

Every durable non-system claim requires at least one source. Exact DSH event
ranges are preferred over reconstructed quotations.

### Entity

The initial entity kinds are `person`, `workspace`, `project`, `topic`, `goal`,
`commitment`, `decision`, `constraint`, `preference`, and `artifact`. Entity
kinds are data, not tables. Aliases are separate records with source and scope;
merging entities emits an event and remains reversible.

### EntityEvent

The v1 vocabulary is:

```text
claim.observed
claim.confirmed
claim.corrected
claim.superseded
claim.contradicted
claim.revoked
claim.expired
entity.created
entity.aliased
entity.merged
entity.split
scope.changed
source.detached
action.received
```

An event contains `eventId`, `eventType`, `aggregateId`, `payload`, `scope`,
`sourceEpisodeIds`, `actor`, `occurredAt`, and `recordedAt`. Events are immutable
after commit. Corrections and revocations append events.

### MemoryClaim

A claim contains:

- `claimId`, kind, natural-language statement, and normalized predicate;
- subject entity plus an entity or literal object;
- `candidate`, `confirmed`, `superseded`, `contradicted`, `revoked`, or
  `expired` status;
- confidence, importance, sensitivity, scope, and source episode ids;
- valid-time interval and recorded-time timestamps;
- optional superseding/superseded claim ids;
- deterministic content hash and optimistic revision.

Explicit user requests such as "remember this" may create confirmed claims.
Deterministic action receipts may create confirmed observations. Model-derived
facts begin as candidates unless a policy explicitly admits that claim kind and
source. A confidence score never silently grants write authority.

### RecallDecision

Every recall stores the query fingerprint, applicable scope, candidate ids,
selected ids, ignored ids with reason codes, contradiction sets, token/character
budget, latency, and produced ContextPack hash. This record is the answer to
"why did Telos remember or ignore this?"

### ActionReceipt

Receipts capture requested action, authorization decision, runtime/provider,
result, evidence references, and any affected goal, commitment, or constraint.
They are accepted source episodes and close the observe-recall-act-observe loop.

## Storage

The v1 authority is one local SQLite database opened through `node:sqlite` in
WAL mode with foreign keys enabled. The database and sidecars must be created
with user-only permissions where the platform supports them. Schema changes are
ordered, transactional migrations; startup fails loudly on an unknown future
schema version.

The initial physical model includes:

```text
schema_migration
source_episode
entity
entity_alias
entity_event
memory_claim
claim_source
relation_projection
recall_run
recall_candidate
recall_materialization
action_receipt
continuity_outbox
memory_claim_fts (FTS5)
```

The outbox isolates authoritative commits from background extraction and
projection retries. All write commands accept an idempotency key. The Core owns
one serialized writer; reads may use independent connections when needed.

## Formation and reconciliation

Continuity formation has three paths:

1. explicit: memory tools and direct user corrections, applied immediately;
2. deterministic: DSH action/tool receipts converted without an LLM;
3. inferred: a bounded extractor proposes candidates after a completed turn.

The extractor receives a versioned JSON contract and cannot write the store.
Core validates its output, resolves aliases, finds duplicate or contradictory
claims, applies policy, then emits events transactionally. Failed extraction is
recorded and retryable; it must never fail or delay the original DSH turn.

## Retrieval and context assembly

Recall is a policy-gated pipeline, not a dump of all memories:

1. reject inactive, unauthorized, sensitive, out-of-scope, or invalid-time
   claims;
2. generate candidates from exact entity/alias matches, FTS5, recent open loops,
   graph neighbors, and optional future vector providers;
3. fuse and rank candidates by relevance, evidence quality, importance,
   freshness, and active commitments;
4. resolve contradiction sets and retain uncertainty when no winner is valid;
5. build a bounded ContextPack with claim ids and evidence references;
6. persist the RecallDecision before or atomically with materialization.

Context is delivered in three tiers:

- L0: a small session-frozen core context for durable identity and hard policy;
- L1: a turn-specific bounded Recall Pack appended after the current user input;
- L2: on-demand evidence and graph expansion through tools.

L1 is added only for a newly claimed external user message, not every tool
continuation. Model-visible text is recorded through DSH's durable message
surface. A materialization record links every injected claim to the exact DSH
session/event range that contains its rendered copy.

## Deletion and privacy

Revocation immediately excludes a claim from every new query and projection.
Physical deletion is a separately reported operation that removes or rebuilds
Core source content, FTS rows, relation edges, caches, and future vector rows.

Because DSH durably logs model-visible context, a claim may also exist in an old
DSH Session after recall. `recall_materialization` must identify every such
session and range. A deletion result must report `purged`, `retained-reference`,
or `requires-session-deletion` for each derivative; it may not claim complete
erasure while a plaintext materialization remains. V1 supports deleting the
affected DSH session through an explicit user-approved operation when selective
redaction is unavailable.

Temporary/session-only memory, sensitive claim kinds, and automatic inference
are individually configurable. Secrets and credentials are rejected by default
and never embedded or projected.

## DSH integration

`@telos/dsh-continuity` is an out-of-tree Cordis package inserted by a Telos
Profile patch. It may depend on documented DSH services but does not edit the
Submodule.

The Host face:

- maps Session ids to stable Workspace ids without changing Workspace records;
- observes committed `session/event` ranges and queues turn extraction;
- participates cooperatively in `agent/pre-step` and preserves the waterfall;
- registers bounded `continuity_remember`, `continuity_search`,
  `continuity_forget`, and `continuity_explain` tools;
- publishes per-session receipt projections without making them authoritative;
- contains all background failures and exposes their health.

The Client face:

- renders memory-use and memory-change receipts in existing Slots;
- exposes source, scope, status, correction, undo, and deletion results;
- keeps all original DSH navigation, settings, workspace, session, tool,
  approval, and activity surfaces operational.

V1 management operations may use bounded unary Remote methods. Whole-graph
streams do not masquerade as Remote calls; the future Telos Local Gateway owns
streaming and multi-runtime coordination.

## User experience

Normal use stays conversational:

- "remember that all Telos additions must preserve DSH" creates a visible,
  undoable confirmed claim;
- a later session receives a compact Recall Pack when the statement is relevant;
- "that decision changed" creates a superseding claim rather than editing
  history;
- "why do you think that?" expands the RecallDecision and exact source range;
- "forget it" revokes immediately and returns a deletion/derivative report.

The UI uses lightweight receipts and an optional details surface. A graph
visualization is not an acceptance requirement; relationship-backed behavior is.

## ContinuityBench

The repository will ship deterministic fixtures and executable scenarios for:

1. cross-session decision recovery;
2. same-workspace sharing and cross-workspace isolation;
3. global and session-only scope;
4. model/runtime-independent recall contracts;
5. correction, contradiction, supersession, and expiration;
6. open-loop and commitment recovery;
7. action-versus-constraint conflict detection;
8. source expansion and explanation completeness;
9. immediate revocation and physical-deletion reporting;
10. idempotent replay, crash recovery, and projection rebuild;
11. prompt budget, latency, and duplicate-injection limits;
12. plugin-disabled DSH baseline parity.

Primary metrics are valid recall precision, stale-memory error rate, scope leak
rate, provenance coverage, correction convergence, continuation success,
deletion completeness, p95 recall latency, and ContextPack size. No claimed
advantage over a community plugin is accepted without running the same fixture
corpus through a pinned adapter or recording the comparison as `NOT_RUN`.

## Acceptance gates

Implementation is complete only when:

- Core unit, migration, property/invariant, concurrency, recovery, and deletion
  tests pass;
- DSH Host and Client plugin tests pass against the pinned rc.5 source;
- ContinuityBench passes every deterministic scenario;
- original Telos test, typecheck, lint, build, DSH provenance, and DSH parity
  gates pass;
- a source-built DSH Web process loads the additive plugin and runs a real local
  memory flow;
- a packaged desktop directory contains the plugin and starts its DSH child;
- macOS arm64 packaging is revalidated locally, while other platforms remain
  explicitly CI-dependent until their native jobs pass;
- every material code batch is independently committed without bypassing hooks.

## Rejected alternatives

### Install one community memory plugin as Telos truth

This couples personal continuity to one replaceable Runtime and cannot unify
future goals, permissions, connectors, and action receipts. Community plugins
remain design references and possible providers behind a Telos contract.

### Use a graph database as the sole authority

Graphs are excellent relationship projections but poor evidence and deletion
ledgers by themselves. The event/claim authority must survive graph rebuilds and
provider replacement.

### Copy Study-Pilo's growth model

Study-Pilo validates evidence-first events and rebuildable projections, but its
growth, study, family, and psychology domains are not Telos's ontology. Telos
reuses the boundary, not the product schema or source code.

### Inject every memory into every prompt

This increases cost, stale-memory errors, privacy exposure, and cache churn.
Bounded policy-gated recall is mandatory.
