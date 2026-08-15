import type { ClientContext, ISessions, SessionFace } from '@deepseek-ai/dsh-client-runtime/client'
import type { IConversation, DraftAttachmentId } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ModelDirectoryResolver } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { MultimodalClientController } from './controller.js'
import type { MediaProgressController } from './progress-controller.js'

type InputSubmitMode = 'queue' | 'steer'

interface ConversationSendFace extends IConversation {
  sendSession(
    session: SessionFace,
    text: string,
    imageIds: readonly DraftAttachmentId[],
    mode: InputSubmitMode,
  ): Promise<void>
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function notify(
  conversation: IConversation,
  sessions: ISessions,
  session: SessionFace,
  level: 'info' | 'error',
  message: string,
): void {
  const actx = sessions.scope(session.sessionId)
  if (actx !== undefined) conversation.input.for(actx).notify(level, message)
}

/** Wrap the public DSH send seam without changing the pinned upstream package. */
export function installImageRouting(
  ctx: ClientContext,
  controller: MultimodalClientController,
  progress: MediaProgressController,
): () => void {
  const conversation = ctx.get('conversation') as ConversationSendFace | undefined
  const modelDirectories = ctx.get('modelDirectories') as ModelDirectoryResolver | undefined
  const sessions = ctx.get('sessions') as ISessions | undefined
  if (conversation === undefined || modelDirectories === undefined || sessions === undefined) {
    throw new Error('telos-multimodal: conversation, modelDirectories, and sessions are required')
  }

  const original = conversation.sendSession
  const routed: ConversationSendFace['sendSession'] = async (session, text, imageIds, mode) => {
    if (imageIds.length === 0) {
      progress.clearTerminal(String(session.sessionId))
      return original.call(conversation, session, text, imageIds, mode)
    }
    let operationId: string | undefined
    try {
      const directory = modelDirectories.directoryFor(session.sessionId)
      const current = (await directory.load()).current
      const resolution = await controller.resolveImageRoute(current, String(session.sessionId), imageIds.length)
      if (resolution.kind === 'bridge') {
        operationId = resolution.operationId
        progress.track(String(session.sessionId), resolution, imageIds.length)
        await directory.select(resolution.route as never)
      }
      await original.call(conversation, session, text, imageIds, mode)
    } catch (error) {
      if (operationId !== undefined) await progress.failBeforeRun(String(session.sessionId), operationId, error)
      notify(conversation, sessions, session, 'error', errorMessage(error))
      throw error
    }
  }
  conversation.sendSession = routed
  return () => {
    if (conversation.sendSession === routed) conversation.sendSession = original
  }
}
