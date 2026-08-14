export const IPC_CHANNELS = {
  appInfo: 'telos:system:get-app-info',
  dshWebStatus: 'telos:dsh-web:get-status',
  dshWebRetry: 'telos:dsh-web:retry',
  dshWebState: 'telos:dsh-web:state',
  runtimeStatus: 'telos:runtime:get-status',
  runtimeRun: 'telos:runtime:run',
  runtimeEvent: 'telos:runtime:event',
} as const
