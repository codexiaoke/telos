# ADR 0007: Telos-owned multimodal runtime and DSH projection

- Status: Proposed for product and architecture review
- Date: 2026-08-15
- Extends: ADR 0002, ADR 0003, ADR 0004, ADR 0006

## Context

Telos is a local-first, continuously present personal intelligence system. Its
multimodal capability cannot be a collection of chat upload widgets or a
DeepSeek-specific vision patch. Images, audio, video, documents, generated
artifacts, and future screen observations must remain understandable after a
session restarts, a model changes, or DSH is replaced.

The pinned DSH commit already supplies a sound version-one image path:

- browser images are validated before the user event is appended;
- encoded bytes are stored durably and addressed by content hash;
- the Session log carries an opaque `ImageAttachmentRef`, not base64 or a local
  path;
- model routes declare `inputModalities`, and the Host rejects an image before
  starting a turn when the selected route explicitly lacks image support;
- image-bearing sessions cannot switch to a route that explicitly lacks image
  support;
- DSH Content Blocks, browser prompt input, and the shipped attachment UI cover
  raster images only. Audio, video, PDF, and general files are not part of that
  contract.

The official DeepSeek adapter at the pinned commit declares text-only input.
DSH therefore does not automatically call OCR, a vision model, or an MCP server
when a user attaches an image to DeepSeek. Community vision bridges demonstrate
that an `LlmAdapter` can expose a logically image-capable route, describe an
image with a second model, and then continue with DeepSeek. They are useful
compatibility evidence, but they do not define Telos's durable content,
permissions, routing, or product experience.

Telos also intends to support governed Computer Use later. That future needs
visual descriptions, OCR, regions, coordinates, temporal observations, and
change evidence. This ADR does not authorize screen capture or computer
control, but the multimodal contract must not discard the spatial and temporal
information those capabilities will require.

## Decision summary

Telos will own a provider-neutral **Multimodal Runtime** above DSH. It owns the
canonical asset catalog, immutable local blobs, derived artifacts,
observations, processing jobs, capability registry, routing policy, outbound
media permissions, provenance, deletion reports, and UI-facing state.

DSH remains the interactive Agent Runtime. An out-of-tree Telos integration
projects canonical content into the vocabulary supported by the pinned DSH
version and registers one logical multimodal LLM provider. The selected main
model remains the reasoning, answer, and tool-calling model; auxiliary models
provide missing perception or generation operations.

The user-visible invariant is:

> Selecting a text-only main model never removes the ability to send media.
> Telos chooses an allowed supporting route, clearly identifies it, and keeps
> the main model responsible for the conversation.

The runtime covers both directions:

1. multimodal input and understanding: text, images, audio, video, documents,
   and future captured frames;
2. multimodal output transport: generated images, audio, video, documents, and
   other files become durable Telos assets and visible conversation artifacts.

"Complete multimodal integration" means that supported content can be
admitted, stored, routed, processed, cited, rendered, resumed, exported, and
deleted. It does not mean Telos implements every vision, speech, document, or
generation model itself.

## Scope

### Included

- a versioned canonical content envelope;
- immutable local asset storage and metadata;
- content-addressed deduplication;
- images and screenshots supplied by the user;
- recorded and uploaded audio;
- uploaded video with temporal understanding;
- PDFs and general document/file attachments;
- model- and tool-produced media artifacts;
- thumbnails, poster frames, waveforms, transcripts, OCR, page text, keyframes,
  regions, embeddings when enabled, and other derived artifacts;
- native, bridged, and hybrid model routing;
- one logical DSH provider that remains image-capable end to end;
- fixed Telos media composer, history, progress, permission, provenance, and
  error surfaces;
- persistence, retry, cancellation, restart recovery, export, and deletion;
- spatial and temporal metadata required by future Computer Use.

### Explicitly excluded

- mouse, keyboard, Accessibility, CDP, or operating-system action execution;
- automatic or continuous screen recording;
- active window capture initiated by the Agent;
- camera monitoring or ambient microphone monitoring;
- an `ActionIntent`, `SceneSnapshot`, or Computer Use execution loop;
- A2UI or model-generated UI schemas;
- replacing DSH Sessions, Workspaces, Agent presets, tools, approvals, jobs,
  subagents, or projections;
- a wholesale DSH Web fork;
- silently sending local media to a cloud provider;
- treating full transcripts, OCR text, or visual descriptions as durable
  personal memories by default.

User-selected screenshots, recordings, videos, and files are in scope. The
ability for an Agent to acquire those sources without an explicit attachment is
not.

## Product outcome

The user continues to select a main model in the ordinary conversation UI. A
capability line explains the effective route, for example:

```text
Main reasoning     DeepSeek V4 Pro
Image perception   Local vision model
Speech recognition Local speech model
Video perception   Local keyframes + vision model
Cloud media        Ask before sending
```

The main conversation does not expose provider plumbing as chat noise. Media
appears as normal image, audio, video, and document cards. Processing state is
fixed product UI:

```text
Storing -> Preparing -> Understanding -> Ready -> Answering
```

Each card can disclose, without entering a developer-only trace:

- original file name and media facts;
- whether processing was local or cloud;
- which capability produced an observation;
- page, region, or time citations used by the answer;
- failure, retry, cancel, export, and delete actions.

The user does not need to switch away from a preferred text-only model merely
to attach media. A native multimodal main model receives supported content
directly. A text-only main model receives a bounded, attributable projection
produced by supporting perception routes.

## Architectural principles

### Telos owns durable content

DSH events are runtime evidence, not the canonical media catalog. Model
providers, community plugins, browser object URLs, temporary files, and remote
URLs never become asset identity.

### Originals and derivations are immutable

An edit, transcode, crop, redaction, transcript correction, or regenerated
artifact produces a new asset or observation version connected by a derivation
edge. It does not overwrite the source.

### DSH projections are replaceable

The DSH adapter may render a Telos asset as an `ImageBlock`, bounded text,
keyframes, or a tool-accessible reference. Those are projections of canonical
content, not alternate truth sources.

### Capability claims are end-to-end claims

A logical route may declare image input only when the complete composed route
can admit and process images. The UI must distinguish "main model supports
image" from "Telos supplies image perception". It must not claim that DeepSeek
itself became multimodal.

### Local-first is a routing policy, not a label

Local processing is eligible for automatic use inside configured resource
limits. Cloud media egress requires a recorded policy decision. An unavailable
local route never silently becomes a cloud upload.

### Media is untrusted data

OCR text, transcripts, document text, image descriptions, filenames, metadata,
and subtitles are observations, not instructions. Model projections delimit
them as untrusted content and preserve their source.

### Replay must be deterministic

The same immutable asset, processing operation, model route, processor version,
and policy version resolves to the same cache identity. Restart and compaction
must reuse committed observations rather than repeating paid or private calls.

### The UI never decodes heavy media on the Agent thread

Large file hashing, probing, decoding, keyframe extraction, OCR, speech
recognition, and transcoding run outside the renderer and outside the synchronous
DSH Agent loop.

## System shape

```text
Telos Renderer / DSH Client Plugin
  -> draft media controller
  -> loopback Remote control and streaming media data endpoint
  -> fixed media cards and permission surfaces
  -> ordinary DSH session prompt with stable asset references

@telos/dsh-multimodal (Telos-owned Host adapter)
  -> DSH prompt/reference projection
  -> DSH session and workspace binding
  -> logical LlmAdapter provider
  -> DSH attachment compatibility provider
  -> bounded media tools

@telos/multimodal-core (DSH-independent authority)
  -> asset catalog and blob store
  -> processing jobs and scheduler
  -> processor and model capability registry
  -> route planner and policy engine
  -> observations, derivations, cache, receipts, deletion

Capability providers
  -> native multimodal main model
  -> vision / OCR / grounding model
  -> speech recognition / synthesis model
  -> document extraction provider
  -> video temporal pipeline
  -> image / audio / video generation provider
```

Electron main owns application lifecycle and native security boundaries. It
does not become the multimodal domain store. The interactive DSH Host plugin is
the first process hosting `@telos/multimodal-core`; a future Telos Local Gateway
may host the same package without changing its contracts.

### Control plane and media data plane

DSH Remote/RPC carries small authenticated commands and state:

- create or resume a draft envelope;
- request an upload grant;
- finalize or cancel an upload;
- subscribe to or poll bounded job state;
- request metadata, observations, permissions, export, or deletion.

It does not carry whole audio, video, or document bodies as JSON/base64. The
Host plugin registers a loopback-only streaming media endpoint through the DSH
Web server seam. A short-lived, single-asset upload grant binds method, expected
byte limit, user/session scope, and expiry. The client streams bytes while the
Host hashes and validates them; the grant cannot read another asset or be used
after commit. Origin, Host, content length/range, and request method are checked
at the boundary.

Downloads and previews use equally scoped read grants or authenticated Host
routes. Neither an upload nor a preview URL is durable identity. This separates
low-volume orchestration from the binary data plane and allows the same core to
move behind a future Telos Local Gateway.

## Canonical content contract

### Identifiers

Identifiers are opaque branded strings. Consumers must not parse an identifier
to derive a path, provider, MIME type, or hash.

```ts
type AssetId = Branded<'AssetId'>
type BlobId = Branded<'BlobId'>
type ObservationId = Branded<'ObservationId'>
type ProcessingJobId = Branded<'ProcessingJobId'>
type ContentEnvelopeId = Branded<'ContentEnvelopeId'>
type RouteReceiptId = Branded<'RouteReceiptId'>
```

`AssetId` identifies one logical immutable asset. `BlobId` identifies one
deduplicated byte object. Different assets may intentionally share a blob while
retaining different names, sources, scopes, or deletion policy.

### Content envelope

```ts
interface TelosContentEnvelope {
  schemaVersion: 1
  envelopeId: ContentEnvelopeId
  parts: readonly TelosContentPart[]
  locale?: string
  clientTimeZone?: string
  createdAt: string
}

type TelosContentPart =
  | { type: 'text'; text: string }
  | {
      type: 'asset'
      assetId: AssetId
      modality: 'image' | 'audio' | 'video' | 'document' | 'file'
      purpose: 'user-input' | 'context' | 'generated-output' | 'tool-output'
      selection?: MediaSelection
    }
```

Content envelopes are ordered. Text may appear before, between, or after media.
The runtime must not flatten the envelope into "text plus attachments" because
provider order can affect meaning.

`MediaSelection` is a non-destructive view into an immutable asset:

```ts
type MediaSelection =
  | { kind: 'image-region'; region: SpatialRegion }
  | { kind: 'audio-range'; startMs: number; endMs: number }
  | { kind: 'video-range'; startMs: number; endMs: number }
  | { kind: 'document-pages'; pages: readonly number[] }
```

### Asset

```ts
interface MediaAsset {
  assetId: AssetId
  blobId: BlobId
  mediaType: string
  modality: 'image' | 'audio' | 'video' | 'document' | 'file'
  bytes: number
  contentHash: string
  displayName?: string
  source: MediaSource
  dimensions?: { width: number; height: number }
  durationMs?: number
  pageCount?: number
  createdAt: string
  sensitivity: 'normal' | 'personal' | 'sensitive' | 'restricted'
  lifecycle: 'active' | 'deleted' | 'purged'
}

type MediaSource =
  | { kind: 'upload' }
  | { kind: 'clipboard' }
  | { kind: 'microphone' }
  | { kind: 'generated'; provider: string; model?: string }
  | { kind: 'tool-output'; toolCallId: string }
  | { kind: 'screen-capture'; captureId: string } // reserved, not admitted now
```

Provider URLs, local filesystem paths, browser object URLs, credentials, and
signed bearer URLs are not persisted in `MediaAsset`.

### Spatial metadata

Spatial results are preserved now so a future perception-and-action runtime
does not have to reinterpret old observations.

```ts
interface SpatialRegion {
  coordinateSpace: 'asset-pixel' | 'normalized'
  x: number
  y: number
  width: number
  height: number
  assetWidth: number
  assetHeight: number
  transform?: readonly number[]
}
```

`display`, `window`, and operating-system coordinate spaces are deliberately
absent from version one. A future screen-capture source will add a separate
capture context that maps its pixels into those spaces. Generic image models
must not invent desktop coordinates.

### Observation

```ts
interface ModalityObservation {
  observationId: ObservationId
  assetId: AssetId
  operation:
    | 'describe'
    | 'ocr'
    | 'ground'
    | 'transcribe'
    | 'document-extract'
    | 'video-index'
    | 'compare'
    | 'detect-change'
  summary?: string
  textSegments: readonly TimedTextSegment[]
  regions: readonly ObservedRegion[]
  entities: readonly ObservedEntity[]
  uncertainty?: string
  provider: string
  model?: string
  processorVersion: string
  promptVersion?: string
  routeReceiptId: RouteReceiptId
  contentHash: string
  createdAt: string
}
```

Text segments carry page, time, or region citations instead of losing their
origin:

```ts
interface TimedTextSegment {
  text: string
  startMs?: number
  endMs?: number
  page?: number
  region?: SpatialRegion
  confidence?: number
}
```

Regions and entities remain evidence-shaped rather than pretending to be
operating-system controls:

```ts
interface ObservedRegion {
  regionId: string
  label?: string
  region: SpatialRegion
  text?: string
  confidence?: number
  parentRegionId?: string
}

interface ObservedEntity {
  entityId: string
  kind: string
  name?: string
  attributes: Readonly<Record<string, string | number | boolean>>
  regionIds: readonly string[]
  confidence?: number
}
```

Observations are model-derived interpretations. They never replace the original
asset and never become personal-memory claims merely because confidence is high.

### Derivation

Every thumbnail, waveform, transcript export, proxy video, extracted page,
keyframe, crop, redaction, or generated artifact records:

```ts
interface AssetDerivation {
  parentAssetId: AssetId
  childAssetId: AssetId
  operation: string
  processor: string
  processorVersion: string
  parametersHash: string
  createdAt: string
}
```

This relation is acyclic and append-only. Deleting a child never silently
deletes a parent; deleting a parent reports every retained derivative.

## Storage authority

The first authority is a local SQLite catalog plus a versioned content-addressed
blob directory. Both live below a Telos-owned directory in application data,
not in the source checkout, a Workspace, or a browser cache.

```text
<application-data>/telos/multimodal/
  multimodal.sqlite
  blobs/v1/<content-addressed layout>
  work/v1/<bounded temporary processing files>
```

Temporary work files are never stable references. Startup removes abandoned
work directories only after verifying that no active job owns them.

The initial physical model includes:

```text
schema_migration
media_blob
media_asset
asset_derivation
content_envelope
content_envelope_part
session_asset_binding
media_observation
media_processing_job
media_route_receipt
media_outbound_grant
media_deletion_report
multimodal_outbox
```

SQLite runs in WAL mode with foreign keys enabled. The catalog owns one
serialized writer and transactional migrations. Blob commit follows:

1. stream into a private temporary file while hashing and enforcing a byte
   limit;
2. inspect actual media signature and bounded metadata;
3. reject a declared/actual media mismatch, decompression bomb, invalid
   dimensions, unsupported codec, or policy violation;
4. atomically publish the immutable blob;
5. commit the blob and asset rows in one catalog transaction;
6. return an opaque `AssetId` only after durable commit.

Media is never fully buffered merely to hash it. General upload streams bounded
chunks over the loopback media data endpoint; Remote carries only its control
messages. Browser image compatibility with the pinned DSH prompt wire may still
require one bounded base64 projection at send time; this is a removable DSH
compatibility cost, not the Telos storage format.

## DSH image attachment compatibility

The pinned DSH `ctx.attachments` seam is abstract and already defines the
correct persist-before-event contract. Telos will provide a compatible
implementation backed by the Telos blob store and disable only the default
`attachment-local` implementation in the Telos Web Profile.

The replacement must preserve:

- the exact `AttachmentStore` service name and method behavior;
- current validation limits and supported raster formats unless explicitly
  configured otherwise;
- `ImageAttachmentRef` identity and verified metadata;
- content-addressed immutable reads;
- batch validation before any prompt member is published;
- session-authorized attachment reads;
- existing DSH image composer, history, lightbox, `read_image`, provider
  adapters, replay, and compaction behavior.

`saveImage()` creates or resolves a Telos blob and records the compatible DSH
attachment identity. It does not blindly create a second logical asset when the
same browser draft was already admitted through the Telos upload path. After
DSH appends the `user/message` event, the multimodal plugin observes the exact
event sequence, matches the attachment to the ordered draft envelope by blob
identity, and creates `session_asset_binding`. A prompt arriving from the
untouched DSH reference UI has no Telos draft envelope; in that case the
observer imports one logical asset from the committed blob. This avoids
requiring session identity in the generic DSH attachment store method while
preserving one blob and one intended logical asset.

The upstream `attachment-local` package remains a runnable reference. Replacing
it is an explicit parity delta with contract tests and an emergency fallback;
it is not a modification of the DSH Submodule.

## Non-image DSH projection

The pinned DSH browser prompt wire accepts only text and image parts. Telos does
not add audio/video/document blocks by editing DSH core.

The DSH Client Plugin registers durable Telos asset references through the
existing input-reference mechanism. The serialized fallback is an opaque,
non-secret token:

```text
@telos-asset:<opaque-asset-id>
```

The normal Telos renderer hides the transport token behind a media card. The
untouched DSH reference mode may show the token as plain text, preserving a
recoverable fallback rather than an unreadable custom event.

Before send:

1. every draft file is already committed to the Telos asset store;
2. required preprocessing jobs are complete or explicitly allowed to continue
   lazily;
3. each reference resolves to an active asset in the current user scope;
4. the composer serializes references and calls the ordinary DSH
   `session.prompt` exactly once;
5. DSH remains responsible for queue/steer semantics, request identity, model
   admission, commands, Session events, and Agent acquisition.

At `agent/pre-step`, `@telos/dsh-multimodal` resolves referenced assets and adds
bounded, source-labelled model messages. It uses the same cooperative waterfall
behavior as other Telos context adapters and never mutates DSH's frozen loop
request.

`session_asset_binding` links the Telos envelope and assets to the exact DSH
Session and user-event sequence. The binding survives DSH compaction. Recent
bindings support natural follow-ups such as "the second file"; older or large
content remains available through bounded media tools rather than being dumped
into every prompt.

If DSH later accepts a generic durable attachment reference or a
plugin-extensible browser prompt part, the adapter may replace the token
projection without migrating `MediaAsset`, `TelosContentEnvelope`, or any
observation.

## Logical model and routing contract

### Composite provider

The Host plugin registers one provider route, provisionally named:

```text
telos-multimodal
```

Its model catalog mirrors eligible configured main-model routes. A logical model
id maps to one exact underlying provider/model/effort tuple. The normal selector
shows the underlying model name and a Telos capability badge; raw provider ids
remain visible in developer diagnostics.

The composite provider advertises image input only when an allowed complete
route exists:

- the underlying main route supports image; or
- a configured perception route can turn image content into an accepted main
  route projection.

A release claiming complete multimodal support must supply or guide the user to
an operational, permitted image-perception route and validate it during setup.
If every eligible route is missing, unhealthy, or denied, Telos preserves the
asset and draft and reports the missing capability; it never advertises image
support or submits a turn that cannot inspect the image.

It does not advertise audio or video to DSH because the pinned DSH modality
vocabulary contains only text and image. Audio, video, and documents are Telos
asset references resolved before provider dispatch.

Image-bearing sessions select the logical provider, not raw
`deepseek-official`. This satisfies DSH admission and model-switch invariants
without lying about the underlying DeepSeek model.

### Route planning

Model routing is operation-based, not file-extension-based.

```ts
type MultimodalOperation =
  | 'chat-understand-image'
  | 'ocr'
  | 'visual-grounding'
  | 'visual-compare'
  | 'visual-change-detect'
  | 'speech-to-text'
  | 'text-to-speech'
  | 'document-extract'
  | 'video-index'
  | 'image-generate'
  | 'audio-generate'
  | 'video-generate'
```

Every provider/model capability record declares at least:

```ts
interface CapabilityDescriptor {
  provider: string
  model?: string
  operations: readonly MultimodalOperation[]
  inputs: readonly ('text' | 'image' | 'audio' | 'video' | 'document')[]
  outputs: readonly ('text' | 'image' | 'audio' | 'video' | 'document')[]
  local: boolean
  privacyClass: 'local' | 'private-cloud' | 'public-cloud'
  limits: Record<string, number>
  streaming: boolean
  estimatedCostClass: 'free' | 'low' | 'medium' | 'high' | 'unknown'
  concurrencyClass: string
}
```

The route planner considers:

1. exact operation and modality support;
2. user-selected main model;
3. local/cloud policy and asset sensitivity;
4. provider credential and health state;
5. file size, duration, page count, and codec limits;
6. required spatial, temporal, or structured output;
7. configured quality, latency, and cost preferences;
8. cache availability;
9. cancellation and resource concurrency.

It returns a stable `RoutePlan` before external execution:

```ts
interface RoutePlan {
  operation: MultimodalOperation
  mainRoute?: { provider: string; model: string }
  stages: readonly {
    stageId: string
    provider: string
    model?: string
    receives: 'original' | 'derivative' | 'observation'
    produces: readonly string[]
  }[]
  requiredGrantIds: readonly string[]
  cacheKeys: readonly string[]
  planHash: string
  policyVersion: string
}

interface RouteReceipt {
  routeReceiptId: RouteReceiptId
  planHash: string
  stages: readonly {
    stageId: string
    outcome: 'cache-hit' | 'succeeded' | 'failed' | 'cancelled'
    startedAt?: string
    completedAt?: string
    sanitizedFailure?: { code: string; message: string }
  }[]
  grantIds: readonly string[]
  createdAt: string
}
```

The receipt records every provider that received media or derived content,
cache use, latency, failure/fallback, and policy decision. Credentials and raw
provider responses are excluded.

### Routing modes

#### Native

The main model supports the required modality and operation. The logical
provider forwards the original DSH `ImageBlock` or provider-supported projection
without visual transcription.

#### Bridged

The main model lacks the modality. A supporting provider creates a structured
observation; a bounded textual projection is then given to the main model.

#### Hybrid

The main model receives the original supported media while Telos also computes
structured OCR, grounding, transcript, or temporal observations required for
citation, reuse, or later tools. Hybrid processing is requested by an operation
or policy; it is not automatic duplicate spending for every asset.

### No-image fast path

A composite route with no media delegates directly to the underlying main route
without invoking a perception provider or changing the message prefix. This is
required to preserve provider caching and avoid a permanent multimodal tax on
ordinary text conversation.

### Failure policy

Fallback is explicit and typed:

- `retry-same-route`: bounded retry for transient failure;
- `use-allowed-local-alternative`: another pre-authorized local route;
- `request-cloud-permission`: wait for the user before egress;
- `continue-with-partial-observation`: only when the UI and model projection
  label the missing parts;
- `fail-turn`: preserve the draft/envelope and explain recovery options.

The default is never "insert a vague placeholder and let the main model answer
as if it saw the media".

## Modality pipelines

### Images and screenshots

The immutable original is preserved. Processing may produce:

- normalized metadata and orientation;
- thumbnail and preview assets;
- OCR segments with regions;
- dense description;
- detected elements and regions;
- grounding results for a user question;
- crops or redacted derivatives;
- perceptual hash for comparison, never as canonical identity.

Native multimodal routes receive the original. Text-only routes receive a
question-aware observation, not a single permanently cached generic caption.
Reusable generic OCR and layout observations may be cached separately from the
question-aware result.

### Audio and voice

The runtime preserves the original recording and produces:

- duration, codec, sample-rate, and channel metadata;
- waveform/preview derivative;
- language and optional speaker segments;
- timestamped transcript;
- confidence and unintelligible ranges;
- optional normalized audio derivative;
- optional text-to-speech output as a new generated asset.

Voice input is not a special text box. The transcript is a derived observation
linked to the original audio. User transcript corrections append a new
observation version and retain provenance.

Continuous interruptible realtime voice conversation is a separate future
transport. This ADR covers recorded turns and streamed processing progress, not
a permanent open microphone.

### Video

Video processing is temporal and query-aware. It may produce:

- technical metadata and poster frame;
- audio track derivative and timestamped transcript;
- scene boundaries and representative keyframes;
- OCR and visual observations tied to time ranges;
- a temporal index for seeking and follow-up questions;
- optional proxy media for preview.

The runtime never decode-loads every frame into memory or sends an entire video
to a model that accepts only images. A route plan chooses provider-native video
when allowed, otherwise audio plus adaptive keyframes and targeted refinement.
Answers must retain time citations such as `02:13-02:21`.

### Documents and general files

Document handling distinguishes:

- born-digital PDF/text extraction;
- scanned pages requiring OCR;
- page images and layout regions;
- tables with row/column structure;
- embedded images;
- unsupported encrypted or malformed documents;
- opaque general files that remain downloadable but are not claimed as
  understood.

Answers retain page and region citations. Extracted text is delimited as
document data. A document parser is a capability provider; it does not gain
filesystem access outside the admitted asset.

### Generated output

Generated images, audio, video, and files enter the same asset store before a
conversation receipt or tool result references them. The record includes the
generating provider/model, source prompt hash, safety/policy decision, and
parent assets when applicable.

The pinned DSH stream has no generic media-output block. Until that changes,
the Telos Host plugin publishes generated assets through a Telos-owned session
projection/receipt and the Client Plugin renders them in the existing
conversation Slots. The raw DSH fallback retains a textual opaque asset
reference. No generated output exists only at a remote URL.

## Model-visible projection

The main model receives the minimum useful evidence, not the entire media
catalog. A projection contains:

```text
<telos_media_observation asset="..." modality="video" untrusted="true">
  Source: user attachment "demo.mov"
  Processor: local-video-index / version ...
  Summary: ...
  Evidence:
    [00:14-00:19] ...
    [02:13-02:21] ...
  Omitted: full transcript available through media_transcript
</telos_media_observation>
```

Projection rules:

- media text is explicitly untrusted and non-instructional;
- provider/model and observation ids remain available for audit but do not
  dominate the prompt;
- bounded size is configured separately per modality and main-model context;
- exact citations survive projection;
- truncation is explicit;
- full content is retrieved through tools only when needed;
- one turn injects each observation at most once;
- history replay uses committed observations and route receipts.

## Bounded media tools

MCP is not the automatic admission path. The DSH plugin registers bounded
native tools over the same Multimodal Runtime:

```text
media_inspect(asset_id, question?, selection?)
media_ocr(asset_id, region?, pages?)
media_transcript(asset_id, start_ms?, end_ms?)
media_seek(asset_id, timestamp_ms)
media_compare(left_asset_id, right_asset_id, question?)
media_list_recent(limit?)
```

Tools accept opaque asset ids, enforce current Session/Workspace/user scope,
and return bounded observations with citations. They never accept arbitrary
host paths or remote URLs. An MCP facade may expose the same contract to another
runtime later, but MCP does not own assets, routing, permissions, or automatic
composer behavior.

## Processing and scheduling

Every non-trivial operation is a durable job with:

```text
queued -> running -> succeeded
                  -> failed
                  -> cancelled
                  -> waiting-permission
                  -> waiting-resource
```

Jobs carry an idempotency key, asset/selection, operation, resolved plan,
attempts, progress, cancellation state, result ids, and sanitized failure.

The scheduler separates resource classes such as CPU decode, local GPU vision,
local speech, network provider, and document sandbox. Concurrency is bounded per
class. A single GPU route may serialize heavyweight jobs without blocking text
chat or renderer updates.

Cache identity includes:

```text
asset content hash
+ selection hash
+ operation
+ provider/model route
+ processor version
+ prompt/schema version
+ normalized parameters hash
```

Policy or permission receipts are not inferred from a cache key. Cached cloud
output may be reused locally after permission is revoked, but the asset must not
be sent to that provider again.

## Draft and send lifecycle

Adding media begins upload and safe metadata extraction while the user is still
typing. The composer retains a durable Telos draft envelope separate from the
DSH Session until send.

On send:

1. mark the envelope `send-requested` with an idempotency key;
2. finish all mandatory admission and perception jobs;
3. stop in `waiting-permission` when egress approval is required;
4. preserve editable text and media if any mandatory job fails;
5. serialize Telos asset references and compatible images;
6. call ordinary DSH `session.prompt` once;
7. bind the accepted DSH user-event sequence to the envelope;
8. clear the draft only after both DSH acceptance and binding commit.

If Telos quits before step 6, the draft and jobs recover without a DSH user
message. If DSH accepts the prompt but the binding commit is interrupted, the
outbox reconciles by the request/event identity and never submits the prompt a
second time.

Queue and steer retain DSH semantics. Media preparation does not invent a
parallel Agent queue.

## Privacy, permissions, and security

### Outbound media policy

Every cloud media operation resolves a grant over:

```text
provider + operation + asset sensitivity + scope + expiry
```

Possible decisions are:

- local only;
- allow once;
- allow this provider for this Workspace;
- allow this configured route until revoked;
- deny.

Selecting a cloud-native multimodal main model is a visible route choice, not
blanket consent for every auxiliary provider. A second cloud vision provider
still needs its own allowed route.

Permission UI identifies the provider, modality, asset count, approximate
bytes, purpose, and whether originals or derivatives leave the device. It never
shows or stores API keys.

### Admission defenses

- inspect actual bytes rather than trusting file extension or browser MIME;
- apply encoded-byte, decoded-pixel, page-count, duration, archive, and codec
  limits before expensive processing;
- sandbox or isolate complex document and media decoders;
- reject path traversal and archive expansion outside private work space;
- never pass local paths to a provider;
- remove metadata from outbound derivatives when policy requires it;
- redact diagnostics and cap retained provider errors;
- contain processor crashes and clean bounded temporary files;
- treat extracted content as untrusted model data;
- bind reads and tools to current authorized Session/Workspace/user scope.

### Personal continuity boundary

`@telos/personal-core` may retain an admitted source reference when a later
memory claim genuinely depends on media, but it does not copy the original,
transcript, OCR, or description into memory by default. A model-derived media
observation remains a candidate source, not a confirmed personal fact.

Deleting media returns the same honest derivative posture as memory deletion:
Telos reports remaining DSH Session references, generated derivatives, cached
observations, provider receipts, and backups or exported copies it cannot erase.

## Deletion and retention

Logical deletion immediately blocks new reads, tools, routing, and model
projection. Physical purge is a separate operation.

Purge traverses:

- observations and processing cache;
- derived assets according to explicit user selection;
- thumbnails, waveforms, proxies, pages, keyframes, and transcripts;
- full-text/vector indexes;
- temporary work files;
- unreferenced blobs;
- pending jobs and outbound retries.

An immutable DSH Session event may retain an attachment id, asset reference
token, name, dimensions, or model-visible projection. `media_deletion_report`
classifies each derivative as:

```text
purged
retained-reference
requires-session-deletion
external-copy-uncontrolled
```

The UI must not claim complete erasure while an old Session still contains
plain model-visible content or identifying metadata. A user-approved DSH
Session deletion may complete that operation when selective redaction is not
available.

Reference-aware garbage collection is conservative. A forked or resumed
Session may share a blob; deleting one binding does not remove bytes still
referenced by another active asset.

## Renderer and fixed product UI

User-facing multimodal React source remains Telos-owned under
`apps/desktop/src/renderer`. A thin generated DSH Client Plugin adapter registers
components through stable conversation input, chat, details, and overlay Slots.
Generated bundles are not hand-edited.

The fixed UI includes:

- attachment picker and drag/drop admission;
- paste and recorded-audio drafts;
- media rail with upload/processing progress;
- image preview;
- audio waveform/player and transcript disclosure;
- video player, poster frame, temporal markers, and citations;
- document card, page preview, and page citations;
- generated artifact cards;
- route/provider disclosure;
- permission confirmation;
- cancel, retry, remove, export, and delete;
- accessible keyboard and screen-reader behavior;
- reduced-motion behavior.

It does not include model-generated layouts. Developer mode may add raw job,
provider, token, cache, and request diagnostics without changing ordinary-user
media semantics.

The untouched DSH image UI remains the reference and fallback until the Telos
media UI passes image parity. Telos may adapt compatible DSH presentation but
must not replace Session controllers, queue semantics, or Host projections with
React-local state.

## Future Computer Use compatibility

This ADR deliberately completes perception primitives before action
primitives. A future Computer Use design may add:

```text
screen acquisition
+ capture context and coordinate transforms
+ Accessibility / DOM observations
+ SceneSnapshot fusion
+ governed ActionIntent execution
+ post-action verification
```

It will reuse without migration:

- `MediaAsset` with the reserved `screen-capture` source;
- immutable blobs and derived crops;
- OCR, describe, ground, compare, and change-detection operations;
- `SpatialRegion` and observation confidence;
- route planning across local and cloud perception;
- asset sensitivity and outbound grants;
- processing scheduler, cache, provenance, and deletion;
- media citations and evidence rendering.

The future capture layer must supply a separately versioned mapping from asset
pixels to display/window coordinates. The current runtime neither guesses that
mapping nor grants input-control permissions. No Computer Use package is a
dependency of `@telos/multimodal-core`.

## Package and integration boundaries

The intended source shape is:

```text
packages/multimodal-core/
  contracts, schema, store, jobs, processors, routing, policy, deletion

plugins/dsh-multimodal/
  Host service, DSH AttachmentStore compatibility, LlmAdapter,
  agent/pre-step projection, media tools, Remote contracts, session bindings

apps/desktop/src/renderer/src/features/multimodal/
  Telos-owned draft controller, media cards, progress, permission, history

integrations/dsh/plugins/telos-multimodal-ui/
  generated private DSH Client Plugin distribution and provenance
```

Only `plugins/dsh-multimodal` and the generated Client adapter import unstable
DSH contracts. `packages/multimodal-core` imports neither DSH nor Electron.

The Telos Web Profile patch will eventually contain two explicit changes:

1. replace DSH's `attachment-local` implementation with the compatible Telos
   attachment provider;
2. add the multimodal Host/Client integration.

All other DSH rows remain unchanged. `dsh:parity` must classify and verify the
service replacement instead of treating it as an unexplained removal.

## Configuration

Ordinary settings expose:

- automatic local media processing;
- preferred local perception routes;
- allowed cloud media routes;
- ask-before-cloud behavior;
- media retention and automatic cleanup;
- recording device and speech language;
- generated-audio playback preference.

Developer mode additionally exposes:

- exact provider/model mapping;
- operation capability matrix;
- processor versions and health;
- cache and job diagnostics;
- concurrency/resource limits;
- raw route receipts and sanitized failures;
- DSH logical/underlying model ids.

Settings are stored in Telos-owned local configuration. Credentials continue
through the existing credential seam. Workspace-specific permissions override
device defaults only for that Workspace; sensitive-asset policy may still
require a one-time decision.

## Observability

Normal activity events are stable and product-level:

```text
asset.storing
asset.stored
media.preparing
media.waiting-permission
media.understanding
media.ready
media.failed
media.cancelled
media.output-created
```

Developer diagnostics may correlate:

```text
assetId -> jobId -> routeReceiptId -> observationId
       -> DSH session/event sequence -> provider request id
```

No diagnostic event contains binary content, credentials, full transcripts,
signed URLs, or arbitrary provider response bodies.

## Performance requirements

- The renderer performs previews only and does not synchronously hash, decode,
  transcode, OCR, or index large media.
- Upload and blob copy are streamed with bounded memory.
- Video frame extraction is adaptive and bounded; it never materializes the
  whole frame sequence.
- Processing progress becomes observable promptly and remains cancellable.
- Text-only prompts on the logical provider perform no perception call.
- A cache hit performs no provider network request.
- Reopening history loads lightweight metadata and previews before originals.
- Full transcripts, page text, and temporal indexes are paged or queried, not
  pushed wholesale to the renderer or model.
- Local GPU concurrency is bounded independently from ordinary chat.
- Failed processors cannot block DSH shutdown indefinitely.

Exact latency thresholds belong to hardware-specific acceptance fixtures. The
architecture gates are bounded memory, cancellability, progressive disclosure,
and absence of redundant provider work.

## Implementation sequence

The sequence is an integration order, not a reduction of the final scope. Each
batch is independently reviewable and committed; "complete multimodal" is
claimed only after the full acceptance matrix passes.

1. Freeze version-one contracts, schema, blob commit, deletion, and fixtures.
2. Implement the DSH-compatible Telos attachment store and prove untouched
   image parity.
3. Implement capability registry, route planner, route receipts, and the
   logical composite provider.
4. Prove native-image passthrough, text-only visual bridge, compaction, model
   switching, and cache behavior.
5. Add durable draft envelopes, generalized asset references, fixed media UI,
   and restart recovery.
6. Add audio admission, waveform, timestamped transcript, correction, and TTS
   output assets.
7. Add documents, scanned-page OCR, table/page citations, and bounded tools.
8. Add video metadata, audio extraction, scene/keyframe index, temporal
   refinement, and time citations.
9. Add generated media/artifact output transport and history rendering.
10. Complete cloud permissions, sensitive-media policy, export, deletion,
    failure recovery, stress tests, packaging, and upgrade gates.

Computer Use starts only under a separate reviewed ADR after this runtime meets
its perception and lifecycle acceptance.

## Acceptance matrix

### Authority and storage

- two identical uploads deduplicate bytes but retain independent asset records;
- MIME spoofing, corrupt media, oversized images, decompression bombs, and
  unsupported codecs fail before asset publication;
- no session event or database field contains base64, a browser object URL, or
  a local bearer path;
- an interrupted write leaves no published partial asset;
- restart recovers committed jobs and removes only provably abandoned work;
- source and every derivative retain content hash and provenance.

### DSH parity

- the pinned DSH Submodule remains clean and unchanged;
- DSH's existing image paste, drag/drop, gallery, lightbox, `read_image`,
  history, resume, fork, replay, and compaction pass against the Telos attachment
  implementation;
- Session, Workspace, model, permission, question, Plan, Job, subagent,
  deliverable, plugin, and activity surfaces remain reachable;
- disabling the Telos multimodal UI leaves a recoverable DSH reference mode;
- the allowed profile delta contains only the compatible attachment replacement
  and Telos multimodal packages.

### Routing

- a text-only DeepSeek main model accepts an image through the logical route
  and answers from an attributable visual observation;
- a native image model receives the original image without forced caption
  replacement;
- a no-media request delegates directly to the selected main route;
- model switching does not strand an image-bearing Session;
- local failure does not send media to cloud without permission;
- a denied cloud grant preserves the local asset and recoverable draft;
- cache replay performs no repeated paid or private call;
- route receipts identify every provider that received original or derived
  media.

### Images

- multiple image order is preserved;
- OCR answers cite regions when available;
- question-aware visual analysis does not poison the reusable generic cache;
- orientation, transparent images, animated-image policy, and large dimensions
  are deterministic;
- deletion reports remaining DSH image references honestly.

### Audio

- recorded and uploaded audio survive restart;
- transcript segments retain timestamps and confidence;
- a corrected transcript creates a new version;
- long audio is processed incrementally and can be cancelled;
- text-only main models can answer with time citations;
- TTS output is a durable generated asset, not a temporary URL.

### Documents

- born-digital and scanned PDFs follow distinct extraction routes;
- answers cite pages and, when available, page regions;
- tables preserve row/column structure rather than flattening into arbitrary
  prose;
- encrypted, malformed, or unsupported files are displayed without a false
  claim of understanding;
- arbitrary document text cannot become Agent instructions.

### Video

- the original, poster, audio, keyframes, transcript, and temporal index retain
  derivation links;
- answers cite time ranges;
- targeted follow-up around one timestamp refines only the necessary range;
- local keyframe mode and provider-native video mode produce the same canonical
  observation shape;
- large video processing remains bounded and cancellable;
- restart and cache reuse do not repeat completed indexing.

### Output artifacts

- generated image/audio/video/file output is committed before it appears in
  history;
- provider/model and parent assets are attributable;
- remote-only URLs are imported or explicitly reported as external, never
  silently treated as durable;
- export and deletion operate through the same asset lifecycle.

### Privacy and deletion

- local-only policy is enforced under provider failure;
- permission identifies provider, purpose, modality, and byte scope;
- revoked grants stop new egress without destroying allowed cached results;
- logical deletion immediately blocks reads and model projection;
- physical deletion enumerates retained DSH/session and external derivatives;
- raw media, transcript, OCR, and descriptions do not become personal memory
  without an admitted source and memory policy.

### Packaging and upgrade

- the packaged Electron app includes all Telos multimodal packages, native
  decoder dependencies, licenses, and the source-pinned DSH runtime;
- packaged-app smoke covers upload, local asset read, one native or bridged
  image turn, restart recovery, and deletion;
- DSH sync review detects changes to attachment, prompt, content block,
  LlmAdapter, compaction, conversation Slot, and model-admission contracts;
- an upstream change cannot silently bypass Telos media permissions or replace
  the canonical asset store.

## Upgrade-sensitive DSH seams

Every DSH pointer update must explicitly review:

- `ctx.attachments` and `ImageAttachmentRef`;
- browser `PromptContentPart` and prompt admission;
- `ContentBlockMap`, `ModelModalityMap`, and model capability resolution;
- `LlmAdapter`, `llm/stream`, replay, retry, and compaction;
- image-bearing Session model-switch checks;
- conversation draft attachment and input-reference contracts;
- conversation input/chat/details/overlay Slots;
- authenticated Session attachment reads;
- Session event and projection extension points.

If DSH adds native audio, video, document, or generated-media blocks, Telos
adopts them only as improved projections. Canonical Telos asset ids,
observations, route receipts, permission grants, and deletion semantics remain
unchanged.

## Source anchors

This decision is grounded in the Telos-pinned DSH commit
`47f943859bef60e4160492346772ded9b24f765a`:

- [`docs/subsystems/attachment.md`](../../third_party/deepseek-harness/docs/subsystems/attachment.md)
  defines persist-before-event durable image storage;
- [`packages/attachment/attachment/src/index.ts`](../../third_party/deepseek-harness/packages/attachment/attachment/src/index.ts)
  defines the replaceable `ctx.attachments` service;
- [`packages/llm/llm/src/types.ts`](../../third_party/deepseek-harness/packages/llm/llm/src/types.ts)
  defines merge-extensible Content Blocks and the current text/image modality
  vocabulary;
- [`packages/llm/llm/src/index.ts`](../../third_party/deepseek-harness/packages/llm/llm/src/index.ts)
  defines `LlmAdapter` and the streaming registry seam;
- [`packages/host/apiproxy/src/api/sessions.ts`](../../third_party/deepseek-harness/packages/host/apiproxy/src/api/sessions.ts)
  defines the current browser text/image prompt wire;
- [`packages/host/apiproxy/src/api-proxy.ts`](../../third_party/deepseek-harness/packages/host/apiproxy/src/api-proxy.ts)
  enforces model image admission and durable prompt commit;
- [`packages/client/ui-attachment/README.md`](../../third_party/deepseek-harness/packages/client/ui-attachment/README.md)
  records the shipped image-only UI scope;
- [`packages/client/ui-conversation/src/client/contract/slots.ts`](../../third_party/deepseek-harness/packages/client/ui-conversation/src/client/contract/slots.ts)
  defines the conversation extension Slots used by the Telos renderer adapter.

Community bridges such as
[`dsh-llm-vision-bridge`](https://github.com/Einskyle/dsh-llm-vision-bridge)
are implementation references for a composed `LlmAdapter`, not product
dependencies or Telos authorities.

## Rejected alternatives

### MCP-only multimodality

DSH rejects an unsupported image before a text-only Agent can decide to call a
tool. MCP also does not own composer admission, storage, automatic routing,
session replay, privacy, or deletion. MCP may expose bounded operations but is
not the primary multimodal path.

### One permanent caption per image

A generic caption loses OCR, regions, uncertainty, question context, and future
grounding. It also becomes stale when better processing is available.

### Pretend DeepSeek itself accepts images

The logical composed provider may truthfully accept images; the underlying
model capability must remain visible in provenance and settings.

### Send all media to the selected cloud model

This violates local-first expectations, ignores operation quality and limits,
and prevents safe fallback. Route planning and permission remain explicit.

### Add every modality directly to the pinned DSH core

That creates a Telos-specific DSH fork and forces every provider, compactor,
projection, API schema, and UI renderer to advance in lockstep. Telos uses a
canonical contract with replaceable DSH projections instead.

### Keep DSH images and Telos non-images in unrelated stores

This splits deletion, deduplication, permissions, provenance, packaging, and
future Computer Use. The compatible attachment provider places DSH images on
the Telos asset backend while preserving DSH behavior.

### Implement Computer Use together with multimodal admission

Computer Use adds capture authority, Accessibility/DOM fusion, action risk,
input execution, postcondition verification, and operating-system permissions.
Combining it with media ingestion makes neither boundary reviewable. This ADR
preserves the required perception contract and defers action under a separate
decision.

## Consequences

- Telos gains one durable media and perception foundation independent of DSH
  and model providers.
- The selected main model can remain text-only without losing multimodal UX.
- DSH image parity is retained through a compatible service implementation,
  but that replacement becomes an explicit upgrade and test obligation.
- Non-image media initially uses an opaque DSH text projection because the
  pinned prompt wire is image-only; the canonical contract is unaffected.
- The first complete release requires significant storage, processing,
  permission, UI, packaging, and acceptance work beyond a community vision
  bridge.
- Future Computer Use can reuse perception, spatial evidence, routing,
  permissions, caching, and deletion without making DSH or a vision plugin the
  owner of the computer.
