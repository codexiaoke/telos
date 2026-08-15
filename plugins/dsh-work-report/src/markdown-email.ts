export interface EmailBodies {
  html: string
  text: string
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function inlineHtml(value: string): string {
  let output = escapeHtml(value)
  output = output.replace(/`([^`]+)`/g, '<code style="padding:1px 4px;border-radius:4px;background:#f3f4f6;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.92em">$1</code>')
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  output = output.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  output = output.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  output = output.replace(/_([^_]+)_/g, '<em>$1</em>')
  output = output.replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2" style="color:#2563eb;text-decoration:none">$1</a>')
  return output
}

function plainInline(value: string): string {
  return value
    .replace(/!\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
}

function markdownToHtmlBody(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const blocks: string[] = []
  let paragraph: string[] = []
  let list: 'ul' | 'ol' | undefined

  const closeParagraph = (): void => {
    if (paragraph.length === 0) return
    blocks.push(`<p style="margin:0 0 14px;line-height:1.75">${inlineHtml(paragraph.join(' '))}</p>`)
    paragraph = []
  }
  const closeList = (): void => {
    if (list === undefined) return
    blocks.push(`</${list}>`)
    list = undefined
  }
  const openList = (kind: 'ul' | 'ol'): void => {
    if (list === kind) return
    closeList()
    list = kind
    blocks.push(`<${kind} style="margin:0 0 14px;padding-left:24px;line-height:1.75">`)
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line === '') {
      closeParagraph()
      closeList()
      continue
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading?.[1] !== undefined && heading[2] !== undefined) {
      closeParagraph()
      closeList()
      const level = Math.min(heading[1].length, 3)
      const sizes = { 1: '24px', 2: '19px', 3: '16px' } as const
      blocks.push(`<h${String(level)} style="margin:${level === 1 ? '0' : '22px'} 0 12px;font-size:${sizes[level as 1 | 2 | 3]};line-height:1.35;color:#111827">${inlineHtml(heading[2])}</h${String(level)}>`)
      continue
    }
    const unordered = /^[-+*]\s+(.+)$/.exec(line)
    if (unordered?.[1] !== undefined) {
      closeParagraph()
      openList('ul')
      blocks.push(`<li style="margin:3px 0">${inlineHtml(unordered[1])}</li>`)
      continue
    }
    const ordered = /^\d+[.)]\s+(.+)$/.exec(line)
    if (ordered?.[1] !== undefined) {
      closeParagraph()
      openList('ol')
      blocks.push(`<li style="margin:3px 0">${inlineHtml(ordered[1])}</li>`)
      continue
    }
    const quote = /^>\s?(.+)$/.exec(line)
    if (quote?.[1] !== undefined) {
      closeParagraph()
      closeList()
      blocks.push(`<blockquote style="margin:0 0 14px;padding:8px 14px;border-left:3px solid #d1d5db;color:#4b5563">${inlineHtml(quote[1])}</blockquote>`)
      continue
    }
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(line)) {
      closeParagraph()
      closeList()
      blocks.push('<hr style="margin:20px 0;border:0;border-top:1px solid #e5e7eb">')
      continue
    }
    closeList()
    paragraph.push(line)
  }
  closeParagraph()
  closeList()
  return blocks.join('\n')
}

export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((rawLine) => {
      const line = rawLine.trimEnd()
      const heading = /^#{1,6}\s+(.+)$/.exec(line)
      if (heading?.[1] !== undefined) return plainInline(heading[1])
      const unordered = /^[-+*]\s+(.+)$/.exec(line)
      if (unordered?.[1] !== undefined) return `• ${plainInline(unordered[1])}`
      const ordered = /^(\d+)[.)]\s+(.+)$/.exec(line)
      if (ordered?.[1] !== undefined && ordered[2] !== undefined) return `${ordered[1]}. ${plainInline(ordered[2])}`
      const quote = /^>\s?(.+)$/.exec(line)
      if (quote?.[1] !== undefined) return plainInline(quote[1])
      if (/^(-{3,}|_{3,}|\*{3,})$/.test(line.trim())) return ''
      return plainInline(line)
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function renderMarkdownEmail(markdown: string): EmailBodies {
  const text = markdownToPlainText(markdown)
  const body = markdownToHtmlBody(markdown)
  return {
    text,
    html: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f5f6f8"><div style="box-sizing:border-box;max-width:760px;margin:0 auto;padding:32px 28px;background:#ffffff;color:#1f2937;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;font-size:15px;line-height:1.75">${body}</div></body></html>`,
  }
}
