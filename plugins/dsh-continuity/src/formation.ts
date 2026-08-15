import type {
  ClaimKind,
  ExtractionEnvelopeV1,
  ExtractionProposal,
} from '@telos/personal-core'

type InferenceScope = ExtractionProposal['scope']

interface Pattern {
  expression: RegExp
  kind: ClaimKind
  predicate: string
  importance: number
}

const PATTERNS: readonly Pattern[] = [
  { expression: /^我(?:更|一直|通常)?(?:偏好|喜欢|习惯|常用)\s*(.+)$/u, kind: 'semantic', predicate: 'preference.stated', importance: 0.7 },
  { expression: /^我的(?:长期|当前|近期)?目标是\s*(.+)$/u, kind: 'prospective', predicate: 'goal.stated', importance: 0.85 },
  { expression: /^我(?:已经)?决定(?:了)?\s*(.+)$/u, kind: 'episodic', predicate: 'decision.stated', importance: 0.8 },
  { expression: /^(?:以后)?请(?:一直|总是|优先)?\s*(.+)$/u, kind: 'procedural', predicate: 'procedure.requested', importance: 0.75 },
  { expression: /^不要(?:再)?\s*(.+)$/u, kind: 'constraint', predicate: 'constraint.stated', importance: 0.9 },
  { expression: /^提醒我\s*(.+)$/u, kind: 'prospective', predicate: 'commitment.stated', importance: 0.8 },
  { expression: /^I (?:strongly )?(?:prefer|like|usually use)\s+(.+)$/iu, kind: 'semantic', predicate: 'preference.stated', importance: 0.7 },
  { expression: /^My (?:long-term |current )?goal is\s+(.+)$/iu, kind: 'prospective', predicate: 'goal.stated', importance: 0.85 },
  { expression: /^I (?:have )?decided(?: to)?\s+(.+)$/iu, kind: 'episodic', predicate: 'decision.stated', importance: 0.8 },
  { expression: /^Please (?:always |preferentially )?\s*(.+)$/iu, kind: 'procedural', predicate: 'procedure.requested', importance: 0.75 },
  { expression: /^(?:Do not|Never)\s+(.+)$/iu, kind: 'constraint', predicate: 'constraint.stated', importance: 0.9 },
  { expression: /^Remind me(?: to| about)?\s+(.+)$/iu, kind: 'prospective', predicate: 'commitment.stated', importance: 0.8 },
]

const EXPLICIT_MEMORY_PATTERN = /(?:记住|记下来|写入记忆|remember|save (?:this|that))/iu
const SECRET_PATTERN = /(?:api[ _-]?key|password|passwd|secret|access[ _-]?token|refresh[ _-]?token|private[ _-]?key|密码|口令|密钥|令牌|sk-[a-z0-9_-]{8,})/iu
const QUESTION_VALUE_PATTERN = /(?:什么|吗|呢|是否|为什么|怎么|哪一个|what|why|which|should i)$/iu

function segments(text: string): string[] {
  return text.normalize('NFKC').slice(0, 20_000).split(/[。！？!?\n]+/u)
    .map(segment => segment.trim())
    .filter(segment => segment.length >= 4 && segment.length <= 240)
}

function matchSegment(segment: string, scope: InferenceScope): ExtractionProposal | undefined {
  if (EXPLICIT_MEMORY_PATTERN.test(segment) || SECRET_PATTERN.test(segment)) return undefined
  for (const pattern of PATTERNS) {
    const match = pattern.expression.exec(segment)
    const objectValue = match?.[1]?.trim()
    if (objectValue === undefined || objectValue.length < 2 || objectValue.length > 240 || QUESTION_VALUE_PATTERN.test(objectValue)) continue
    return {
      kind: pattern.kind,
      statement: segment,
      predicate: pattern.predicate,
      objectValue,
      confidence: 0.92,
      importance: pattern.importance,
      sensitivity: 'personal',
      scope,
    }
  }
  return undefined
}

/** Returns only short, high-precision evidence snippets; full turns are never retained for inference. */
export function candidateEvidence(text: string): string[] {
  const seen = new Set<string>()
  const results: string[] = []
  for (const segment of segments(text)) {
    if (matchSegment(segment, { type: 'session', id: 'evidence-only' }) === undefined) continue
    const key = segment.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    results.push(segment)
    if (results.length >= 6) break
  }
  return results
}

export function extractCandidateEnvelope(input: {
  sourceEpisodeId: string
  evidence: string
  scope: InferenceScope
}): ExtractionEnvelopeV1 {
  const seen = new Set<string>()
  const proposals: ExtractionProposal[] = []
  for (const segment of segments(input.evidence)) {
    const proposal = matchSegment(segment, input.scope)
    if (proposal === undefined) continue
    const key = `${proposal.predicate}\u0000${proposal.objectValue.toLocaleLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    proposals.push(proposal)
    if (proposals.length >= 6) break
  }
  return { schemaVersion: 1, sourceEpisodeId: input.sourceEpisodeId, proposals }
}
