import { describe, expect, it } from 'vitest'
import { describeUpdate } from './application-tray.js'

describe('describeUpdate', () => {
  it('describes the long-running update states without a spinner-only label', () => {
    expect(describeUpdate({ status: 'disabled' })).toBe('开发环境不检查更新')
    expect(describeUpdate({ status: 'checking' })).toBe('正在检查更新…')
    expect(describeUpdate({ status: 'downloading', progressPercent: 42.4 })).toBe('正在下载更新 42%')
    expect(describeUpdate({ status: 'downloaded', version: '0.2.0' })).toBe('版本 0.2.0 已准备安装')
  })
})
