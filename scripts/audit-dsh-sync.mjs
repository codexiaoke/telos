import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')
const dshPath = 'third_party/deepseek-harness'
const dshRoot = resolve(repositoryRoot, dshPath)
const sidebarRoot = resolve(repositoryRoot, 'integrations/dsh/plugins/telos-ui-sidebar')
const layoutRoot = resolve(repositoryRoot, 'integrations/dsh/plugins/telos-ui-layout')
const upstreamUrl = 'https://github.com/deepseek-ai/deepseek-harness.git'
const forkUrl = 'https://github.com/codexiaoke/deepseek-harness.git'
const remoteRequested = process.argv.includes('--remote')
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--remote')

if (unknownArguments.length > 0) {
  throw new Error(`Unknown arguments: ${unknownArguments.join(', ')}`)
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalizeSidebarCssModule(source) {
  const match = /const css = "\.([A-Za-z0-9_-]+)_root\{/.exec(source)
  assert(match !== null && match[1] !== undefined, 'upstream sidebar CSS module prefix is missing')
  return source.replaceAll(match[1], 'telosSidebar')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function pass(label, detail = '') {
  process.stdout.write(`[PASS] ${label}${detail.length > 0 ? `: ${detail}` : ''}\n`)
}

function check(label, operation) {
  try {
    const detail = operation()
    pass(label, detail ?? '')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    process.stderr.write(`[FAIL] ${label}: ${detail}\n`)
    process.exitCode = 1
  }
}

const actualCommit = git(dshRoot, ['rev-parse', 'HEAD'])
const sidebarProvenance = JSON.parse(readFileSync(resolve(sidebarRoot, 'UPSTREAM.json'), 'utf8'))
const layoutProvenance = JSON.parse(readFileSync(resolve(layoutRoot, 'UPSTREAM.json'), 'utf8'))

check('Parent index gitlink matches the checked-out DSH commit', () => {
  const entry = git(repositoryRoot, ['ls-files', '--stage', '--', dshPath])
  const match = /^160000 ([0-9a-f]{40}) 0\tthird_party\/deepseek-harness$/.exec(entry)
  assert(match !== null, `unexpected gitlink entry: ${entry}`)
  assert(match[1] === actualCommit, `indexed gitlink ${match[1]} != worktree ${actualCommit}`)
  return actualCommit
})

check('DSH Submodule worktree is clean', () => {
  const status = git(dshRoot, ['status', '--porcelain', '--untracked-files=all'])
  assert(status.length === 0, `uncommitted upstream files:\n${status}`)
})

check('Submodule clone source is the Telos fork', () => {
  const configured = git(repositoryRoot, [
    'config',
    '--file',
    '.gitmodules',
    '--get',
    'submodule.deepseek-harness.url',
  ])
  assert(configured === forkUrl, `${configured} != ${forkUrl}`)
})

check('DSH origin points to the Telos fork', () => {
  const configured = git(dshRoot, ['remote', 'get-url', 'origin'])
  assert(configured === forkUrl, `${configured} != ${forkUrl}`)
})

const upstreamRemote = spawnSync('git', ['remote', 'get-url', 'upstream'], {
  cwd: dshRoot,
  encoding: 'utf8',
})
if (upstreamRemote.status === 0) {
  check('Optional local upstream remote is canonical', () => {
    const configured = upstreamRemote.stdout.trim()
    assert(configured === upstreamUrl, `${configured} != ${upstreamUrl}`)
  })
} else {
  process.stdout.write('[INFO] Optional local upstream remote is not configured; remote audit uses the recorded URL.\n')
}

check('Overlay provenance points to the checked-out DSH commit', () => {
  assert(sidebarProvenance.schemaVersion === 1, `unsupported schema ${String(sidebarProvenance.schemaVersion)}`)
  assert(sidebarProvenance.upstream === upstreamUrl.replace(/\.git$/, ''), 'unexpected provenance upstream URL')
  assert(sidebarProvenance.commit === actualCommit, `${sidebarProvenance.commit} != ${actualCommit}`)
})

check('Derived sidebar source hash matches provenance', () => {
  const source = canonicalizeSidebarCssModule(readFileSync(resolve(dshRoot, sidebarProvenance.source), 'utf8'))
  const actual = sha256(source)
  assert(actual === sidebarProvenance.sourceSha256, `${actual} != ${sidebarProvenance.sourceSha256}`)
})

check('Generated sidebar hash matches provenance', () => {
  const generated = readFileSync(resolve(sidebarRoot, 'lib/client.js'))
  const actual = sha256(generated)
  assert(actual === sidebarProvenance.generatedSha256, `${actual} != ${sidebarProvenance.generatedSha256}`)
})

check('Derived sidebar carries the exact upstream license', () => {
  const upstreamLicense = readFileSync(resolve(dshRoot, 'LICENSE'))
  const copiedLicense = readFileSync(resolve(sidebarRoot, 'LICENSE.upstream'))
  assert(upstreamLicense.equals(copiedLicense), 'LICENSE.upstream differs from the pinned DSH license')
})

check('Renderer layout provenance points to the checked-out DSH commit', () => {
  assert(layoutProvenance.schemaVersion === 2, `unsupported schema ${String(layoutProvenance.schemaVersion)}`)
  assert(layoutProvenance.upstream === upstreamUrl.replace(/\.git$/, ''), 'unexpected layout provenance URL')
  assert(layoutProvenance.commit === actualCommit, `${layoutProvenance.commit} != ${actualCommit}`)
  assert(layoutProvenance.compatibilityPackage === '@deepseek-ai/dsh-client-ui-layout', 'layout package identity drifted')
})

check('Renderer layout source mappings match provenance', () => {
  assert(Array.isArray(layoutProvenance.sourceMappings), 'layout sourceMappings is not an array')
  assert(layoutProvenance.sourceMappings.length === 7, 'layout source mapping count changed')
  for (const mapping of layoutProvenance.sourceMappings) {
    const upstreamSource = readFileSync(resolve(dshRoot, mapping.upstream))
    const telosSource = readFileSync(resolve(repositoryRoot, mapping.telos))
    assert(sha256(upstreamSource) === mapping.upstreamSha256, `upstream source drift: ${mapping.upstream}`)
    assert(sha256(telosSource) === mapping.telosSha256, `Telos source drift: ${mapping.telos}`)
  }
})

check('Generated Renderer layout hash and module boundary match provenance', () => {
  const generated = readFileSync(resolve(layoutRoot, 'lib/client.js'))
  assert(sha256(generated) === layoutProvenance.generatedSha256, 'generated layout hash drifted')
  const source = generated.toString('utf8')
  assert(source.includes('id: "@deepseek-ai/dsh-client-ui-layout"'), 'layout client module id changed')
  for (const external of layoutProvenance.externalModules) {
    assert(source.includes(`require("${external}")`), `layout no longer externalizes ${external}`)
  }
  assert(!source.includes('react.production.min'), 'layout bundle contains a private React copy')
})

check('Renderer layout compatibility manifest is private and exact', () => {
  const manifest = JSON.parse(readFileSync(resolve(layoutRoot, 'package.json'), 'utf8'))
  assert(manifest.name === '@deepseek-ai/dsh-client-ui-layout', 'layout manifest name changed')
  assert(manifest.private === true, 'layout compatibility package must stay private')
  assert(manifest.exports?.['./client'] === './lib/client.js', 'layout client export changed')
})

check('Renderer layout derivative carries the exact upstream license', () => {
  const upstreamLicense = readFileSync(resolve(dshRoot, 'LICENSE'))
  const copiedLicense = readFileSync(resolve(layoutRoot, 'LICENSE.upstream'))
  assert(upstreamLicense.equals(copiedLicense), 'layout LICENSE.upstream differs from DSH')
})

check('Third-party notice records the checked-out DSH commit', () => {
  const notice = readFileSync(resolve(repositoryRoot, 'THIRD_PARTY_NOTICES.md'), 'utf8')
  assert(notice.includes(`Pinned source commit: \`${actualCommit}\``), 'pinned commit is missing from notice')
  assert(notice.includes('telos-ui-layout'), 'Renderer layout derivative is missing from notice')
})

if (remoteRequested && process.exitCode !== 1) {
  check('Canonical DSH upstream branch is reachable', () => {
    const output = execFileSync('git', ['ls-remote', upstreamUrl, 'refs/heads/master'], {
      cwd: dshRoot,
      encoding: 'utf8',
    }).trim()
    const match = /^([0-9a-f]{40})\trefs\/heads\/master$/.exec(output)
    assert(match !== null, `unexpected ls-remote response: ${output}`)
    if (match[1] === actualCommit) {
      return `UP_TO_DATE ${actualCommit}`
    }
    return `UPDATE_AVAILABLE pinned=${actualCommit} upstream=${match[1]}`
  })
}

if (process.exitCode !== 1) {
  process.stdout.write('DSH provenance and synchronization audit passed.\n')
}
