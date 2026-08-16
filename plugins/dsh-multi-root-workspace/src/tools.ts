import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { WorkspaceRoot } from './contracts.js'
import type { WorkspaceGroupService } from './service.js'

const MAX_READ_BYTES = 256 * 1024
const MAX_WRITE_BYTES = 2 * 1024 * 1024

function revisionOf(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex')
}

function inside(root: string, target: string): boolean {
  const path = relative(root, target)
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path))
}

async function targetFor(root: WorkspaceRoot, pathValue: string, allowMissing: boolean): Promise<string> {
  if (pathValue.trim() === '') throw new TypeError('path must be a non-empty relative path')
  const spelling = resolve(root.path, pathValue)
  if (!inside(root.path, spelling)) throw new TypeError('path escapes the selected workspace root')
  if (allowMissing) {
    const parent = await realpath(dirname(spelling))
    if (!inside(root.path, parent)) throw new TypeError('resolved path escapes the selected workspace root')
    return spelling
  }
  const target = await realpath(spelling)
  if (!inside(root.path, target)) throw new TypeError('resolved path escapes the selected workspace root')
  return target
}

function groupAndRoot(service: WorkspaceGroupService, sessionId: string, rootId: string) {
  const group = service.groupForSession(sessionId)
  if (group === undefined) throw new TypeError('session is not attached to a registered workspace')
  const root = group.roots.find(candidate => candidate.id === rootId)
  if (root === undefined) throw new TypeError(`unknown workspace root: ${rootId}`)
  return { group, root }
}

function sessionId(exec: { agent?: { session: { id: unknown } } }): string {
  const id = exec.agent?.session.id
  if (id === undefined) throw new TypeError('multi-root workspace tools require a session')
  return String(id)
}

export function applyWorkspaceGroupTools(ctx: Context, service: WorkspaceGroupService): void {
  ctx.systemPrompt.context({
    name: 'telos:multi-root-workspace',
    order: 112,
    text: (context) => {
      const id = context.agent?.session.id
      if (id === undefined) return ''
      const group = service.groupForSession(String(id))
      if (group === undefined || group.roots.length < 2) return ''
      const roots = group.roots.map(root => `- ${root.id}: ${root.label} (${root.path})${root.primary ? ' [primary]' : ''}`).join('\n')
      return `This Telos workspace has multiple authorized roots:\n${roots}\nUse workspace_list, workspace_read, and workspace_write with root_id for files outside the primary root. Do not guess or traverse outside these roots.`
    },
  })

  ctx.tools.register(defineTool({
    name: 'workspace_list',
    description: 'List files and directories inside one authorized root of the current multi-root workspace.',
    parameters: {
      root_id: { type: 'string', required: true, description: 'Stable root id from the Telos workspace context.' },
      path: { type: 'string', description: 'Relative directory path. Defaults to the root.' },
    },
    output: {
      schema: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', required: true },
            kind: { type: 'string', required: true },
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      const { root } = groupAndRoot(service, sessionId(exec), args.root_id)
      const target = args.path === undefined || args.path === '' ? root.path : await targetFor(root, args.path, false)
      if (!(await stat(target)).isDirectory()) throw new TypeError('path must identify a directory')
      const entries = await readdir(target, { withFileTypes: true })
      return entries.slice(0, 1_000).map(entry => ({ name: entry.name, kind: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other' }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'workspace_read',
    description: 'Read one UTF-8 file from an authorized root of the current multi-root workspace.',
    parameters: {
      root_id: { type: 'string', required: true, description: 'Stable root id from the Telos workspace context.' },
      path: { type: 'string', required: true, description: 'Relative file path inside the selected root.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          rootId: { type: 'string', required: true },
          path: { type: 'string', required: true },
          content: { type: 'string', required: true },
          revision: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      const { root } = groupAndRoot(service, sessionId(exec), args.root_id)
      const target = await targetFor(root, args.path, false)
      const metadata = await stat(target)
      if (!metadata.isFile()) throw new TypeError('path must identify a file')
      if (metadata.size > MAX_READ_BYTES) throw new RangeError(`file exceeds ${String(MAX_READ_BYTES)} byte read limit`)
      const content = await readFile(target)
      if (content.includes(0)) throw new TypeError('binary files cannot be read as text')
      return { rootId: root.id, path: args.path, content: content.toString('utf8'), revision: revisionOf(content) }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'workspace_write',
    description: 'Create or replace one UTF-8 file inside an authorized root. Read existing files first and pass their revision; use expected_revision="new" only for a new path.',
    parameters: {
      root_id: { type: 'string', required: true, description: 'Stable root id from the Telos workspace context.' },
      path: { type: 'string', required: true, description: 'Relative file path inside the selected root.' },
      content: { type: 'string', required: true, description: 'Complete new UTF-8 file content.' },
      expected_revision: { type: 'string', required: true, description: 'Revision from workspace_read, or "new" when creating a file.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          rootId: { type: 'string', required: true },
          path: { type: 'string', required: true },
          revision: { type: 'string', required: true },
          size: { type: 'integer', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      if (Buffer.byteLength(args.content) > MAX_WRITE_BYTES) throw new RangeError(`content exceeds ${String(MAX_WRITE_BYTES)} byte write limit`)
      const { root } = groupAndRoot(service, sessionId(exec), args.root_id)
      const target = await targetFor(root, args.path, args.expected_revision === 'new')
      let current: Buffer | undefined
      try { current = await readFile(target) } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
      if (args.expected_revision === 'new') {
        if (current !== undefined) throw new TypeError('file already exists; read it and pass its revision')
        await mkdir(dirname(target), { recursive: true })
      } else {
        if (current === undefined) throw new TypeError('file does not exist; use expected_revision="new" to create it')
        if (revisionOf(current) !== args.expected_revision) throw new TypeError('file changed on disk; read it again before writing')
      }
      const temporary = resolve(dirname(target), `.${basename(target)}.${randomUUID()}.telos-tmp`)
      try {
        await writeFile(temporary, args.content)
        await rename(temporary, target)
      } catch (error) {
        try { await unlink(temporary) } catch { /* no temporary artifact */ }
        throw error
      }
      const written = Buffer.from(args.content)
      return { rootId: root.id, path: args.path, revision: revisionOf(written), size: written.byteLength }
    },
  }))
}
