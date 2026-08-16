import type { MessageBoxOptions } from 'electron'
import type { UpdateSnapshot } from '../../shared/update.js'

export interface ManualUpdateFeedback {
  options: MessageBoxOptions
  openReleaseResponse?: number
}

/** Build the native feedback shown after a user explicitly asks Telos to check for updates. */
export function createManualUpdateFeedback(snapshot: UpdateSnapshot): ManualUpdateFeedback {
  const base = {
    title: 'Telos 更新',
    noLink: true,
  } satisfies Partial<MessageBoxOptions>

  switch (snapshot.status) {
    case 'available':
      return {
        options: {
          ...base,
          type: 'info',
          message: `发现新版本 ${snapshot.version ?? ''}`.trim(),
          detail: '将打开 GitHub Releases 下载适合当前系统的安装包。',
          buttons: ['前往下载', '稍后'],
          defaultId: 0,
          cancelId: 1,
        },
        openReleaseResponse: 0,
      }
    case 'not-available':
      return {
        options: {
          ...base,
          type: 'info',
          message: 'Telos 已是最新版本',
          detail: snapshot.version === undefined ? undefined : `当前版本：${snapshot.version}`,
          buttons: ['好'],
        },
      }
    case 'error':
      return {
        options: {
          ...base,
          type: 'error',
          message: '检查更新失败',
          detail: snapshot.detail ?? '请检查网络连接后重试。',
          buttons: ['好'],
        },
      }
    case 'disabled':
      return {
        options: {
          ...base,
          type: 'info',
          message: '当前版本不支持在线检查更新',
          detail: '开发目录包没有发布元数据，请使用正式安装包测试更新。',
          buttons: ['好'],
        },
      }
    case 'idle':
    case 'checking':
      return {
        options: {
          ...base,
          type: 'info',
          message: '正在检查更新…',
          detail: '检查仍在进行，请稍后重试或查看系统托盘中的更新状态。',
          buttons: ['好'],
        },
      }
  }
}
