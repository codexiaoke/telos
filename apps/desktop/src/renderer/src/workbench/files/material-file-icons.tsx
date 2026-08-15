import type { CSSProperties } from 'react'
import cppIcon from 'material-icon-theme/icons/cpp.svg'
import csharpIcon from 'material-icon-theme/icons/csharp.svg'
import cssIcon from 'material-icon-theme/icons/css.svg'
import databaseIcon from 'material-icon-theme/icons/database.svg'
import dockerIcon from 'material-icon-theme/icons/docker.svg'
import eslintIcon from 'material-icon-theme/icons/eslint.svg'
import fileIcon from 'material-icon-theme/icons/file.svg'
import folderIcon from 'material-icon-theme/icons/folder.svg'
import folderOpenIcon from 'material-icon-theme/icons/folder-open.svg'
import gitIcon from 'material-icon-theme/icons/git.svg'
import goIcon from 'material-icon-theme/icons/go.svg'
import htmlIcon from 'material-icon-theme/icons/html.svg'
import imageIcon from 'material-icon-theme/icons/image.svg'
import javaIcon from 'material-icon-theme/icons/java.svg'
import javascriptIcon from 'material-icon-theme/icons/javascript.svg'
import jsonIcon from 'material-icon-theme/icons/json.svg'
import kotlinIcon from 'material-icon-theme/icons/kotlin.svg'
import lessIcon from 'material-icon-theme/icons/less.svg'
import licenseIcon from 'material-icon-theme/icons/license.svg'
import lockIcon from 'material-icon-theme/icons/lock.svg'
import markdownIcon from 'material-icon-theme/icons/markdown.svg'
import makefileIcon from 'material-icon-theme/icons/makefile.svg'
import npmIcon from 'material-icon-theme/icons/npm.svg'
import pdfIcon from 'material-icon-theme/icons/pdf.svg'
import pnpmIcon from 'material-icon-theme/icons/pnpm.svg'
import prettierIcon from 'material-icon-theme/icons/prettier.svg'
import pythonIcon from 'material-icon-theme/icons/python.svg'
import reactIcon from 'material-icon-theme/icons/react.svg'
import rustIcon from 'material-icon-theme/icons/rust.svg'
import sassIcon from 'material-icon-theme/icons/sass.svg'
import consoleIcon from 'material-icon-theme/icons/console.svg'
import svelteIcon from 'material-icon-theme/icons/svelte.svg'
import typescriptIcon from 'material-icon-theme/icons/typescript.svg'
import tomlIcon from 'material-icon-theme/icons/toml.svg'
import vueIcon from 'material-icon-theme/icons/vue.svg'
import xmlIcon from 'material-icon-theme/icons/xml.svg'
import yamlIcon from 'material-icon-theme/icons/yaml.svg'
import { languageForPath } from './editor-language'

const LANGUAGE_ICONS: Readonly<Record<string, string>> = {
  bash: consoleIcon,
  cpp: cppIcon,
  csharp: csharpIcon,
  css: cssIcon,
  dockerfile: dockerIcon,
  go: goIcon,
  html: htmlIcon,
  java: javaIcon,
  javascript: javascriptIcon,
  json: jsonIcon,
  jsonc: jsonIcon,
  jsx: reactIcon,
  kotlin: kotlinIcon,
  less: lessIcon,
  markdown: markdownIcon,
  python: pythonIcon,
  rust: rustIcon,
  scss: sassIcon,
  sql: databaseIcon,
  svelte: svelteIcon,
  toml: tomlIcon,
  tsx: reactIcon,
  typescript: typescriptIcon,
  vue: vueIcon,
  xml: xmlIcon,
  yaml: yamlIcon,
}

const EXACT_FILE_ICONS: Readonly<Record<string, string>> = {
  '.eslintignore': eslintIcon,
  '.eslintrc': eslintIcon,
  '.gitignore': gitIcon,
  '.prettierignore': prettierIcon,
  '.prettierrc': prettierIcon,
  'license': licenseIcon,
  'makefile': makefileIcon,
  'package-lock.json': npmIcon,
  'package.json': npmIcon,
  'pnpm-lock.yaml': pnpmIcon,
  'yarn.lock': lockIcon,
}

const IMAGE_EXTENSIONS = new Set(['avif', 'gif', 'ico', 'jpeg', 'jpg', 'png', 'svg', 'webp'])

export function materialIconForFile(path: string): string {
  const name = path.split('/').at(-1)?.toLowerCase() ?? ''
  const exact = EXACT_FILE_ICONS[name]
  if (exact !== undefined) return exact
  const extension = name.split('.').at(-1) ?? ''
  if (IMAGE_EXTENSIONS.has(extension)) return imageIcon
  if (extension === 'pdf') return pdfIcon
  return LANGUAGE_ICONS[languageForPath(path)] ?? fileIcon
}

interface MaterialFileIconProps {
  kind: 'file' | 'folder'
  name: string
  expanded?: boolean
  style?: CSSProperties
}

export function MaterialFileIcon({ expanded = false, kind, name, style }: MaterialFileIconProps) {
  const source = kind === 'folder' ? (expanded ? folderOpenIcon : folderIcon) : materialIconForFile(name)
  return <img alt="" aria-hidden="true" draggable={false} src={source} style={style} />
}
