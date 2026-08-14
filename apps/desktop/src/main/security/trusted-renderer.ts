export function isTrustedRenderer(urlValue: string): boolean {
  const developmentUrl = process.env.ELECTRON_RENDERER_URL

  try {
    if (developmentUrl) return new URL(urlValue).origin === new URL(developmentUrl).origin
    return new URL(urlValue).protocol === 'file:'
  } catch {
    return false
  }
}
