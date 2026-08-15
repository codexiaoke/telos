import { describe, expect, it } from 'vitest'
import { describeUpdate } from './application-tray.js'

describe('describeUpdate', () => {
  it('describes update checks and manual release downloads', () => {
    expect(describeUpdate({ status: 'disabled' })).toBe('开发环境不检查更新')
    expect(describeUpdate({ status: 'checking' })).toBe('正在检查更新…')
    expect(describeUpdate({ status: 'available', version: '0.2.0' })).toBe('发现新版本 0.2.0')
  })
})
