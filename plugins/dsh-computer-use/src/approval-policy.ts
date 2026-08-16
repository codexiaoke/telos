/** Shared DSH approval-policy read for Computer Use permission paths. */

import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Context } from '@deepseek-ai/cordis'
import type { ApprovalPolicy } from '@deepseek-ai/dsh-user-approval'

/**
 * The session's effective DSH approval policy: a logged override, else the
 * approval plugin's configured default.
 * @returns `'never'` when every approval ask would auto-reject without a prompt.
 */
export function approvalPolicy(ctx: Context, agent: Agent): ApprovalPolicy {
  return ctx.approval.overrideOf(agent.session) ?? ctx.approval.config.policy ?? 'ask'
}
