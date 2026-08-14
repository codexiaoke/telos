import { ipcMain } from 'electron'
import type { RuntimePromptRequest } from '@telos/runtime-contracts'
import type { RuntimeGateway } from '../application/runtime-gateway.js'
import { IPC_CHANNELS } from './channels.js'
import { isTrustedRenderer } from '../security/trusted-renderer.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parsePromptRequest(value: unknown): RuntimePromptRequest {
  if (!isRecord(value)) throw new Error('Runtime request must be an object')
  const runId = value.runId
  const conversationId = value.conversationId
  const input = value.input

  if (typeof runId !== 'string' || runId.length === 0 || runId.length > 128) {
    throw new Error('Runtime runId must be a non-empty string of at most 128 characters')
  }
  if (typeof conversationId !== 'string' || conversationId.length === 0 || conversationId.length > 128) {
    throw new Error('Runtime conversationId must be a non-empty string of at most 128 characters')
  }
  if (typeof input !== 'string' || input.trim().length === 0 || input.length > 100_000) {
    throw new Error('Runtime input must contain between 1 and 100000 characters')
  }

  const route = value.route
  if (route === undefined) return { runId, conversationId, input }
  if (!isRecord(route) || typeof route.provider !== 'string' || typeof route.model !== 'string') {
    throw new Error('Runtime route must contain string provider and model fields')
  }

  return {
    runId,
    conversationId,
    input,
    route: { provider: route.provider, model: route.model },
  }
}

export function registerRuntimeHandlers(gateway: RuntimeGateway): void {
  ipcMain.handle(IPC_CHANNELS.runtimeStatus, (event) => {
    const rendererUrl = event.senderFrame?.url
    if (!rendererUrl || !isTrustedRenderer(rendererUrl)) {
      throw new Error('Rejected IPC request from an untrusted renderer')
    }
    return gateway.getStatus()
  })

  ipcMain.handle(IPC_CHANNELS.runtimeRun, async (event, value: unknown) => {
    const rendererUrl = event.senderFrame?.url
    if (!rendererUrl || !isTrustedRenderer(rendererUrl)) {
      throw new Error('Rejected IPC request from an untrusted renderer')
    }

    const request = parsePromptRequest(value)
    return gateway.run(request, (runtimeEvent) => {
      if (!event.sender.isDestroyed()) event.sender.send(IPC_CHANNELS.runtimeEvent, runtimeEvent)
    })
  })
}
