const EXACT_LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  'package.json': 'json',
  'package-lock.json': 'json',
  'pnpm-lock.yaml': 'yaml',
  'yarn.lock': 'yaml',
  'tsconfig.json': 'jsonc',
}

const EXTENSION_LANGUAGES: Readonly<Record<string, string>> = {
  bash: 'bash',
  c: 'cpp',
  cc: 'cpp',
  cjs: 'javascript',
  cpp: 'cpp',
  cs: 'csharp',
  cts: 'typescript',
  css: 'css',
  diff: 'diff',
  go: 'go',
  h: 'cpp',
  hpp: 'cpp',
  htm: 'html',
  html: 'html',
  ini: 'ini',
  java: 'java',
  js: 'javascript',
  json: 'json',
  jsonc: 'jsonc',
  jsx: 'jsx',
  kt: 'kotlin',
  kts: 'kotlin',
  less: 'less',
  md: 'markdown',
  mdx: 'markdown',
  mjs: 'javascript',
  mts: 'typescript',
  py: 'python',
  rs: 'rust',
  sass: 'scss',
  scss: 'scss',
  sh: 'bash',
  sql: 'sql',
  svelte: 'svelte',
  toml: 'toml',
  ts: 'typescript',
  tsx: 'tsx',
  txt: 'plaintext',
  vue: 'vue',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  zsh: 'bash',
}

export function languageForPath(path: string): string {
  const name = path.split('/').at(-1)?.toLowerCase() ?? ''
  const exact = EXACT_LANGUAGE_NAMES[name]
  if (exact !== undefined) return exact
  const extension = name.split('.').at(-1) ?? ''
  return EXTENSION_LANGUAGES[extension] ?? 'plaintext'
}
