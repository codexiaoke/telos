# Telos DSH 工作报告插件

这是一个本地优先的 DSH Host + Client 插件。它让用户继续在普通对话里生成日报、周报和月报，并在需要时通过本机 SMTP 发送邮件。发送结果会保留在本地；还可以通过 IMAP 把已投递的工作报告同步到发件邮箱的“已发送”目录。

## 对话方式

- “帮我生成今天的日报：完成了工作报告插件设计，修复了 RPC 契约。”
- “根据这周已经保存的日报生成周报。”
- “根据 8 月已经保存的报告生成月报。”
- “把刚才的周报发给周报收件组。”

第一次生成某类报告时，Agent 必须先与用户确认受众、语气、篇幅和内容范围。确认后的规范保存在本地；日报只使用当前对话中用户提供的事实，周报只汇总本地日报，月报优先汇总本地周报，没有周报时才回退到日报。

## 本地数据

默认由 Telos overlay 把数据目录配置为 DSH Home 下的 `telos/work-report/`：

```text
work-report/
  reports/
    daily/*.md
    weekly/*.md
    monthly/*.md
  standards/*.md
  delivery-drafts/*.json
  contacts.json
  mail.json
  send-history.jsonl
```

每份报告正文就是一个完整的 Markdown 文件，不拆成数据库记录或结构化工作事实。联系人、分组、非敏感 SMTP 设置和发送审计是插件运行配置，不属于报告正文。

SMTP 密码使用 DSH 凭据引用 `TELOS_WORK_REPORT_SMTP_PASSWORD`。IMAP 可以复用 SMTP 密码，也可以使用独立的 `TELOS_WORK_REPORT_IMAP_PASSWORD`。密码不会写进 `mail.json`，也不会在设置页回显。

## 邮件安全边界

发送分两步：`work_report_prepare_email` 先冻结报告、主题、实际收件人和 HTML/纯文本正文并计算哈希；`work_report_send_email` 只接受该快照的 id 与哈希，并始终触发 DSH 原生工具审批。

邮件按实际收件人逐封发送，避免在群发邮件中泄露其他成员地址。收件人得到带内联样式的 HTML 正文和纯文本回退，不会收到 Markdown 源代码。

启用“已发送同步”后，只有全部收件人投递成功，插件才会通过 IMAP `APPEND` 写入一份带 `\\Seen` 标记的 RFC822 邮件副本。默认使用服务器标记为 `\\Sent` 的现有目录；无法识别时可以配置准确路径。插件不会创建、扫描或下载邮箱目录。

SMTP 投递状态和 IMAP 同步状态彼此独立：同步失败不会把已经发出的邮件当成失败，也绝不会再次向收件人投递。用户可以在对话中要求“重试同步已发送”，DSH 会再次展示原生工具审批；该工具只重试 IMAP 写入。设置页的“已发送工作报告”会展示本地记录、实际收件人数、投递状态和同步状态，但不会展示密码或原始邮件正文。

## 开发验证

```bash
corepack pnpm --filter @telos/dsh-work-report build
corepack pnpm vitest run --dir plugins/dsh-work-report
corepack pnpm dsh:audit
corepack pnpm dsh:parity
```

测试使用内存 SMTP transport 和假的 IMAP Client，不访问真实邮件服务器。真实 SMTP 发送和 IMAP 写入只有在用户配置账户、发起发送并通过 DSH 审批后才会发生。
