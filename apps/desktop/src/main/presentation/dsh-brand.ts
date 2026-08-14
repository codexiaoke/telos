const DSH_PRODUCT_NAME = 'DeepSeek Harness'
const DSH_TITLE_SUFFIX = ` — ${DSH_PRODUCT_NAME}`

export const TELOS_PRODUCT_NAME = 'TELOS'

/**
 * Convert DSH's browser title into the title owned by the desktop shell.
 * Session titles remain untouched; only the product suffix changes.
 */
export function toTelosWindowTitle(documentTitle: string): string {
  if (documentTitle === DSH_PRODUCT_NAME) return TELOS_PRODUCT_NAME
  if (!documentTitle.endsWith(DSH_TITLE_SUFFIX)) return documentTitle
  return `${documentTitle.slice(0, -DSH_TITLE_SUFFIX.length)} — ${TELOS_PRODUCT_NAME}`
}

/**
 * TELOS presentation overrides only DSH's documented design-token surface.
 * Component selectors deliberately stay in the upstream Web application so
 * a DSH update can change layout and behavior without being shadowed here.
 */
export const TELOS_DSH_THEME_CSS = `
body {
  color-scheme: light;
  --telos-sidebar-top-inset: 30px;
  --telos-sidebar-rail-top-inset: 54px;
  --dsw-static-deepseek-50: rgb(244, 245, 255);
  --dsw-static-deepseek-100: rgb(234, 236, 255);
  --dsw-static-deepseek-200: rgb(216, 220, 255);
  --dsw-static-deepseek-300: rgb(181, 188, 255);
  --dsw-static-deepseek-400: rgb(126, 136, 255);
  --dsw-static-deepseek-450: rgb(104, 114, 250);
  --dsw-static-deepseek-500: rgb(82, 91, 235);
  --dsw-static-deepseek-600: rgb(69, 75, 204);
  --dsw-static-deepseek-800: rgb(49, 52, 98);
  --dsw-static-deepseek-900: rgb(35, 37, 70);
  --dsw-alias-bg-base: rgb(252, 252, 251);
  --dsw-alias-bg-layer-1: rgb(255, 255, 255);
  --dsw-alias-bg-layer-2: rgb(255, 255, 255);
  --dsw-alias-bg-layer-3: rgb(255, 255, 255);
  --dsw-alias-bg-module-platform: rgb(247, 247, 245);
  --dsw-specific-sidebar-fill: rgb(246, 246, 244);
  --dsw-specific-sidebar-nav-item-active: rgb(235, 235, 232);
  --dsw-specific-sidebar-nav-item-hover: rgb(240, 240, 237);
}

body[data-ds-dark-theme] {
  color-scheme: dark;
  --dsw-static-deepseek-50: rgb(35, 37, 70);
  --dsw-static-deepseek-100: rgb(49, 52, 98);
  --dsw-static-deepseek-200: rgb(61, 65, 127);
  --dsw-static-deepseek-300: rgb(79, 85, 165);
  --dsw-static-deepseek-400: rgb(104, 114, 230);
  --dsw-static-deepseek-450: rgb(126, 136, 255);
  --dsw-static-deepseek-500: rgb(145, 153, 255);
  --dsw-static-deepseek-600: rgb(165, 172, 255);
  --dsw-static-deepseek-800: rgb(216, 220, 255);
  --dsw-static-deepseek-900: rgb(234, 236, 255);
  --dsw-alias-bg-base: rgb(18, 19, 23);
  --dsw-alias-bg-layer-1: rgb(24, 25, 30);
  --dsw-alias-bg-layer-2: rgb(29, 30, 36);
  --dsw-alias-bg-layer-3: rgb(34, 35, 42);
  --dsw-alias-bg-module-platform: rgb(27, 28, 34);
  --dsw-specific-sidebar-fill: rgb(22, 23, 28);
  --dsw-specific-sidebar-nav-item-active: rgb(40, 41, 49);
  --dsw-specific-sidebar-nav-item-hover: rgb(33, 34, 41);
}
`
