import { describe, expect, it } from 'vitest'
import { detectImageDimensions, parseVisionResponse } from '../src/vision.js'

describe('vision grounding helpers', () => {
  it('reads PNG dimensions without decoding the image', () => {
    const png = Buffer.alloc(24)
    png.set([0x89, 0x50, 0x4e, 0x47], 0)
    png.write('IHDR', 12, 'ascii')
    png.writeUInt32BE(749, 16)
    png.writeUInt32BE(833, 20)
    expect(detectImageDimensions(png)).toEqual({ width: 749, height: 833 })
  })

  it('reads GIF and extended WebP dimensions', () => {
    const gif = Buffer.alloc(10)
    gif.write('GIF89a', 0, 'ascii')
    gif.writeUInt16LE(320, 6)
    gif.writeUInt16LE(240, 8)
    expect(detectImageDimensions(gif)).toEqual({ width: 320, height: 240 })

    const webp = Buffer.alloc(30)
    webp.write('RIFF', 0, 'ascii')
    webp.write('WEBP', 8, 'ascii')
    webp.write('VP8X', 12, 'ascii')
    webp.set([0x7f, 0x02, 0x00], 24)
    webp.set([0xdf, 0x01, 0x00], 27)
    expect(detectImageDimensions(webp)).toEqual({ width: 640, height: 480 })
  })

  it('returns only in-bounds structured pixel targets', () => {
    const result = parseVisionResponse(JSON.stringify({
      observation: '发送按钮位于右下角',
      targets: [
        { label: '发送', x: 700, y: 800, confidence: 0.96 },
        { label: '越界', x: 900, y: 900, confidence: 0.99 },
      ],
    }), { width: 749, height: 833 })
    expect(result).toEqual({
      observation: '发送按钮位于右下角',
      image: { width: 749, height: 833 },
      coordinateSpace: 'image-pixels',
      targets: [{ label: '发送', x: 700, y: 800, confidence: 0.96 }],
    })
  })

  it('keeps non-empty legacy prose but never invents coordinates', () => {
    expect(parseVisionResponse('看见一个微信聊天窗口。', { width: 400, height: 300 })).toEqual({
      observation: '看见一个微信聊天窗口。',
      image: { width: 400, height: 300 },
      coordinateSpace: 'image-pixels',
      targets: [],
    })
  })
})
