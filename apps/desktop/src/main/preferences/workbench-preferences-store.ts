import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  validateEditorPanelPreferences,
  type EditorPanelPreferences,
} from '../../shared/workbench-preferences.js'

interface EditorPanelEntry extends EditorPanelPreferences {
  workspace: string
}

interface WorkbenchPreferencesDocument {
  version: 1
  editorPanels: EditorPanelEntry[]
}

function emptyDocument(): WorkbenchPreferencesDocument {
  return { version: 1, editorPanels: [] }
}

function workspaceKey(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4_096) {
    throw new TypeError('workspace preference key must be a non-empty string')
  }
  return value
}

function parseDocument(value: unknown): WorkbenchPreferencesDocument {
  if (typeof value !== 'object' || value === null) return emptyDocument()
  const candidate = value as Record<string, unknown>
  if (!Array.isArray(candidate.editorPanels)) return emptyDocument()

  const editorPanels: EditorPanelEntry[] = []
  for (const entry of candidate.editorPanels) {
    if (typeof entry !== 'object' || entry === null) continue
    const workspace = (entry as Record<string, unknown>).workspace
    const panels = validateEditorPanelPreferences(entry)
    if (typeof workspace !== 'string' || workspace.length === 0 || panels === undefined) continue
    editorPanels.push({ workspace, ...panels })
  }
  return { version: 1, editorPanels }
}

export class WorkbenchPreferencesStore {
  private document: Promise<WorkbenchPreferencesDocument> | undefined
  private writes: Promise<void> = Promise.resolve()

  constructor(private readonly path: string) {}

  async getEditorPanels(workspaceValue: unknown): Promise<EditorPanelPreferences | undefined> {
    const workspace = workspaceKey(workspaceValue)
    const document = await this.load()
    const entry = document.editorPanels.find(candidate => candidate.workspace === workspace)
    return entry === undefined ? undefined : { files: entry.files, conversation: entry.conversation }
  }

  async setEditorPanels(workspaceValue: unknown, value: unknown): Promise<void> {
    const workspace = workspaceKey(workspaceValue)
    const panels = validateEditorPanelPreferences(value)
    if (panels === undefined) throw new TypeError('invalid editor panel preferences')

    const document = await this.load()
    const existing = document.editorPanels.findIndex(candidate => candidate.workspace === workspace)
    const entry = { workspace, ...panels }
    if (existing === -1) document.editorPanels.push(entry)
    else document.editorPanels[existing] = entry

    this.writes = this.writes.then(
      () => this.write(document),
      () => this.write(document),
    )
    await this.writes
  }

  private load(): Promise<WorkbenchPreferencesDocument> {
    this.document ??= readFile(this.path, 'utf8')
      .then(source => parseDocument(JSON.parse(source)))
      .catch(() => emptyDocument())
    return this.document
  }

  private async write(document: WorkbenchPreferencesDocument): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true })
    const temporaryPath = `${this.path}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
    await rename(temporaryPath, this.path)
  }
}
