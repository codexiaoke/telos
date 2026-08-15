import { describe, expect, it } from 'vitest'
import { markdownToPlainText, renderMarkdownEmail } from '../src/markdown-email.js'

describe('Markdown email rendering', () => {
  it('produces styled HTML and a plain-text fallback instead of Markdown source', () => {
    const markdown = '# 工作日报\n\n- 完成 **插件设计**\n- 修复 `RPC` 契约\n\n[项目地址](https://example.com)'
    const rendered = renderMarkdownEmail(markdown)

    expect(rendered.html).toContain('<h1')
    expect(rendered.html).toContain('<strong>插件设计</strong>')
    expect(rendered.html).toContain('<ul')
    expect(rendered.html).not.toContain('**插件设计**')
    expect(rendered.text).toBe('工作日报\n\n• 完成 插件设计\n• 修复 RPC 契约\n\n项目地址 (https://example.com)')
  })

  it('escapes embedded HTML and unsafe links', () => {
    const rendered = renderMarkdownEmail('# 标题\n\n<script>alert(1)</script>\n\n[危险](javascript:alert(1))')
    expect(rendered.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(rendered.html).not.toContain('<script>')
    expect(rendered.html).not.toContain('href="javascript:')
    expect(markdownToPlainText('## 标题\n\n> **内容**')).toBe('标题\n\n内容')
  })
})
