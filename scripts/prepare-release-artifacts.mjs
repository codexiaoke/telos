import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join, relative, resolve, sep } from 'node:path'
import { parse, stringify } from 'yaml'

const RELEASE_FILE_PATTERN = /\.(?:7z|AppImage|blockmap|deb|dmg|exe|zip)$/i
const UPDATE_METADATA_PATTERN = /^latest(?:-[a-z0-9-]+)?\.ya?ml$/i

function collectFiles(root) {
  const files = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) files.push(...collectFiles(path))
    else if (entry.isFile()) files.push(path)
  }
  return files
}

function assertUpdateMetadata(value, source) {
  if (typeof value !== 'object' || value === null || typeof value.version !== 'string' || !Array.isArray(value.files)) {
    throw new Error(`Invalid electron-builder update metadata: ${source}`)
  }
  for (const file of value.files) {
    if (typeof file !== 'object' || file === null || typeof file.url !== 'string' || typeof file.sha512 !== 'string') {
      throw new Error(`Invalid update file record in ${source}`)
    }
  }
  return value
}

function mergeUpdateMetadata(sources) {
  const documents = sources.map(source => ({
    source,
    value: assertUpdateMetadata(parse(readFileSync(source, 'utf8')), source),
  }))
  const versions = new Set(documents.map(document => document.value.version))
  if (versions.size !== 1) {
    throw new Error(`Cannot merge update metadata for different versions: ${[...versions].join(', ')}`)
  }

  const filesByUrl = new Map()
  for (const { source, value } of documents) {
    for (const file of value.files) {
      const previous = filesByUrl.get(file.url)
      if (previous !== undefined && previous.sha512 !== file.sha512) {
        throw new Error(`Conflicting update artifact ${file.url} in ${source}`)
      }
      filesByUrl.set(file.url, file)
    }
  }

  const files = [...filesByUrl.values()].sort((left, right) => left.url.localeCompare(right.url))
  const preferred = files.find(file => extname(file.url).toLowerCase() === '.zip') ?? files[0]
  if (preferred === undefined) throw new Error('Update metadata contains no downloadable files')

  const base = documents[0].value
  const releaseDates = documents
    .map(document => document.value.releaseDate)
    .filter(value => typeof value === 'string')
    .sort()

  return {
    ...base,
    files,
    path: preferred.url,
    sha512: preferred.sha512,
    ...(releaseDates.length === 0 ? {} : { releaseDate: releaseDates.at(-1) }),
  }
}

export function prepareReleaseArtifacts(input, output) {
  const inputRoot = resolve(input)
  const outputRoot = resolve(output)
  if (!existsSync(inputRoot)) throw new Error(`Downloaded artifact directory does not exist: ${inputRoot}`)
  const outputFromInput = relative(inputRoot, outputRoot)
  if (outputFromInput === '' || (!outputFromInput.startsWith(`..${sep}`) && outputFromInput !== '..')) {
    throw new Error('Release output must be separate from downloaded artifacts')
  }
  mkdirSync(outputRoot, { recursive: true })

  const metadataByName = new Map()
  for (const source of collectFiles(inputRoot)) {
    const name = basename(source)
    if (UPDATE_METADATA_PATTERN.test(name)) {
      const sources = metadataByName.get(name) ?? []
      sources.push(source)
      metadataByName.set(name, sources)
      continue
    }
    if (!RELEASE_FILE_PATTERN.test(name)) continue

    const destination = join(outputRoot, name)
    if (existsSync(destination)) throw new Error(`Duplicate release artifact name: ${name}`)
    copyFileSync(source, destination)
  }

  for (const [name, sources] of metadataByName) {
    const destination = join(outputRoot, name)
    if (existsSync(destination)) throw new Error(`Duplicate release metadata name: ${name}`)
    if (sources.length === 1) copyFileSync(sources[0], destination)
    else writeFileSync(destination, stringify(mergeUpdateMetadata(sources), { lineWidth: 0 }))
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const [input, output] = process.argv.slice(2)
  if (input === undefined || output === undefined) {
    throw new Error('Usage: node scripts/prepare-release-artifacts.mjs <download-directory> <release-directory>')
  }
  prepareReleaseArtifacts(input, output)
}
