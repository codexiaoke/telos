import { describe, expect, it } from 'vitest'
import { createManualUpdateFeedback } from './manual-update-feedback.js'

describe('createManualUpdateFeedback', () => {
  it('offers the public download page when a release is available', () => {
    const feedback = createManualUpdateFeedback({ status: 'available', version: '0.1.3' })

    expect(feedback.options).toMatchObject({
      type: 'info',
      message: '发现新版本 0.1.3',
      buttons: ['前往下载', '稍后'],
    })
    expect(feedback.openReleaseResponse).toBe(0)
  })

  it('confirms that the installed build is current', () => {
    const feedback = createManualUpdateFeedback({ status: 'not-available', version: '0.1.2' })

    expect(feedback.options).toMatchObject({
      message: 'Telos 已是最新版本',
      detail: '当前版本：0.1.2',
    })
    expect(feedback.openReleaseResponse).toBeUndefined()
  })

  it('surfaces a safe update error instead of failing silently', () => {
    const feedback = createManualUpdateFeedback({ status: 'error', detail: 'release metadata returned 404' })

    expect(feedback.options).toMatchObject({
      type: 'error',
      message: '检查更新失败',
      detail: 'release metadata returned 404',
    })
  })
})
