import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { validatePersonalInstructions } from './contracts.js'

export class PersonalInstructionsStore {
  constructor(readonly path: string) {}

  load(): string {
    try {
      return validatePersonalInstructions(readFileSync(this.path, 'utf8'))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ''
      throw error
    }
  }

  save(instructions: unknown): string {
    const validated = validatePersonalInstructions(instructions)
    mkdirSync(dirname(this.path), { recursive: true })
    const temporary = `${this.path}.${String(process.pid)}.tmp`
    writeFileSync(temporary, validated, { mode: 0o600 })
    try {
      renameSync(temporary, this.path)
    } catch {
      rmSync(this.path, { force: true })
      renameSync(temporary, this.path)
    }
    chmodSync(this.path, 0o600)
    return validated
  }

  reset(): string {
    return this.save('')
  }
}
