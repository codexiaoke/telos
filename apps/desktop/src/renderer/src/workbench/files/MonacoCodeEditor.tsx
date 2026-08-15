import { useEffect, useRef, useState } from 'react'
import * as monaco from 'monaco-editor/editor/editor.api.js'
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript'
import { shikiToMonaco, textmateThemeToMonacoTheme } from '@shikijs/monaco'
import { createHighlighterCore } from 'shiki/core'
import bash from 'shiki/langs/bash.mjs'
import cpp from 'shiki/langs/cpp.mjs'
import csharp from 'shiki/langs/csharp.mjs'
import css from 'shiki/langs/css.mjs'
import diff from 'shiki/langs/diff.mjs'
import dockerfile from 'shiki/langs/dockerfile.mjs'
import go from 'shiki/langs/go.mjs'
import html from 'shiki/langs/html.mjs'
import ini from 'shiki/langs/ini.mjs'
import java from 'shiki/langs/java.mjs'
import javascript from 'shiki/langs/javascript.mjs'
import json from 'shiki/langs/json.mjs'
import jsonc from 'shiki/langs/jsonc.mjs'
import jsx from 'shiki/langs/jsx.mjs'
import kotlin from 'shiki/langs/kotlin.mjs'
import less from 'shiki/langs/less.mjs'
import markdown from 'shiki/langs/markdown.mjs'
import python from 'shiki/langs/python.mjs'
import rust from 'shiki/langs/rust.mjs'
import scss from 'shiki/langs/scss.mjs'
import sql from 'shiki/langs/sql.mjs'
import svelte from 'shiki/langs/svelte.mjs'
import toml from 'shiki/langs/toml.mjs'
import tsx from 'shiki/langs/tsx.mjs'
import typescript from 'shiki/langs/typescript.mjs'
import vue from 'shiki/langs/vue.mjs'
import xml from 'shiki/langs/xml.mjs'
import yaml from 'shiki/langs/yaml.mjs'
import darkPlus from 'shiki/themes/dark-plus.mjs'
import lightPlus from 'shiki/themes/light-plus.mjs'
import { languageForPath } from './editor-language'
import './monaco-contributions'

const EDITOR_LANGUAGES = [
  bash, cpp, csharp, css, diff, dockerfile, go, html, ini, java, javascript, json, jsonc, jsx,
  kotlin, less, markdown, python, rust, scss, sql, svelte, toml, tsx, typescript, vue, xml, yaml,
]

let highlighterPromise: Promise<void> | undefined

function isDarkTheme(): boolean {
  return document.body.hasAttribute('data-ds-dark-theme')
}

function applyEditorTheme(): void {
  monaco.editor.setTheme(isDarkTheme() ? 'dark-plus' : 'light-plus')
}

function prepareMonaco(): Promise<void> {
  if (highlighterPromise !== undefined) return highlighterPromise
  highlighterPromise = createHighlighterCore({
    engine: createJavaScriptRegexEngine(),
    langs: EDITOR_LANGUAGES,
    themes: [lightPlus, darkPlus],
  }).then((highlighter) => {
    for (const language of highlighter.getLoadedLanguages()) {
      if (!monaco.languages.getLanguages().some(candidate => candidate.id === language)) {
        monaco.languages.register({ id: language })
      }
    }
    shikiToMonaco(highlighter, monaco)
    for (const themeName of ['light-plus', 'dark-plus'] as const) {
      const converted = textmateThemeToMonacoTheme(highlighter.getTheme(themeName)) as unknown as monaco.editor.IStandaloneThemeData
      monaco.editor.defineTheme(themeName, {
        base: converted.base,
        colors: converted.colors,
        encodedTokensColors: converted.encodedTokensColors,
        inherit: true,
        rules: converted.rules,
      })
    }
    applyEditorTheme()
  })
  return highlighterPromise
}

interface MonacoCodeEditorProps {
  content: string
  onChange: (content: string) => void
  onSave: () => void
  openPaths: readonly string[]
  path: string
}

export function MonacoCodeEditor({ content, onChange, onSave, openPaths, path }: MonacoCodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | undefined>(undefined)
  const modelsRef = useRef(new Map<string, monaco.editor.ITextModel>())
  const changeRef = useRef(onChange)
  const saveRef = useRef(onSave)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string>()

  changeRef.current = onChange
  saveRef.current = onSave

  useEffect(() => {
    let disposed = false
    void prepareMonaco().then(() => {
      if (disposed) return
      setReady(true)
    }).catch((reason: unknown) => {
      if (!disposed) setError(reason instanceof Error ? reason.message : String(reason))
    })
    return () => { disposed = true }
  }, [])

  useEffect(() => {
    if (!ready || hostRef.current === null || editorRef.current !== undefined) return
    const editor = monaco.editor.create(hostRef.current, {
      automaticLayout: true,
      bracketPairColorization: { enabled: true, independentColorPoolPerBracketType: true },
      cursorSmoothCaretAnimation: 'on',
      find: { addExtraSpaceOnTop: false, autoFindInSelection: 'multiline', seedSearchStringFromSelection: 'always' },
      folding: true,
      foldingHighlight: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      lineHeight: 21,
      minimap: { enabled: true },
      padding: { top: 12, bottom: 24 },
      renderWhitespace: 'selection',
      scrollBeyondLastLine: false,
      showFoldingControls: 'mouseover',
      smoothScrolling: true,
      tabSize: 2,
      theme: isDarkTheme() ? 'dark-plus' : 'light-plus',
    })
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveRef.current())
    const contentListener = editor.onDidChangeModelContent(() => {
      const value = editor.getValue()
      changeRef.current(value)
    })
    editorRef.current = editor

    const observer = new MutationObserver(applyEditorTheme)
    observer.observe(document.body, { attributeFilter: ['data-ds-dark-theme'], attributes: true })

    return () => {
      observer.disconnect()
      contentListener.dispose()
      editor.dispose()
      editorRef.current = undefined
      for (const model of modelsRef.current.values()) model.dispose()
      modelsRef.current.clear()
    }
  }, [ready])

  useEffect(() => {
    const editor = editorRef.current
    if (editor === undefined) return
    let model = modelsRef.current.get(path)
    if (model === undefined) {
      const uri = monaco.Uri.from({ scheme: 'telos-workspace', path: `/${path}` })
      model = monaco.editor.getModel(uri) ?? monaco.editor.createModel(content, languageForPath(path), uri)
      modelsRef.current.set(path, model)
    }
    if (editor.getModel() !== model) editor.setModel(model)
    if (model.getValue() !== content) model.setValue(content)
    editor.updateOptions({ ariaLabel: `编辑 ${path}` })
    editor.focus()
  }, [content, path, ready])

  useEffect(() => {
    const retained = new Set(openPaths)
    for (const [modelPath, model] of modelsRef.current) {
      if (!retained.has(modelPath)) {
        if (editorRef.current?.getModel() === model) editorRef.current.setModel(null)
        model.dispose()
        modelsRef.current.delete(modelPath)
      }
    }
  }, [openPaths])

  return (
    <div className="telos-monaco-shell">
      <div aria-label={`编辑 ${path}`} className="telos-monaco-editor" ref={hostRef} role="region" />
      {!ready && error === undefined && <div className="telos-monaco-status">正在加载编辑器…</div>}
      {error !== undefined && <div className="telos-monaco-status telos-editor-error">编辑器加载失败：{error}</div>}
    </div>
  )
}
