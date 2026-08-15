interface DirectTextMessage {
  text: string
}

function joined(messages: readonly DirectTextMessage[]): string {
  return messages.map(message => message.text).join('\n').normalize('NFKC')
}

/** Explicit uncertainty can only lower a requested confirmation to candidate. */
export function explicitReviewRequested(messages: readonly DirectTextMessage[]): boolean {
  return /待确认|先(?:别|不要)确认|暂(?:不|时不)?确认|不确定|可能记错|暂定/u.test(joined(messages))
}

/** A direct durable-memory veto outranks an accidental remember tool call. */
export function explicitMemoryVetoRequested(messages: readonly DirectTextMessage[]): boolean {
  return /(?:先|暂时)?别进长期(?:记忆|计划)|(?:先|暂时)?不要(?:记住|记录|保存|进入长期)|(?:先|暂时)?别(?:记住|记录|保存)|不(?:需要|用)(?:记住|记录|保存|记成|记为)|最多放\s*mentions?|只(?:放|留)在\s*mentions?/iu.test(joined(messages))
}
