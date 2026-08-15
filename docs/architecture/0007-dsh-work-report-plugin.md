# DSH 本地工作报告插件

## 目标

`@telos/dsh-work-report` 是一个对话优先的本地工作报告插件。用户在 DSH 会话中提供工作内容，当前模型负责整理和美化；插件负责读取报告规范、读取历史报告、保存普通 Markdown 文件，以及在 DSH 原生工具审批后发送邮件。

它不是工作事实数据库、项目管理器或另一套 Agent Runtime。DSH 继续拥有模型、会话、工具调度、审批与恢复；Telos 插件只拥有报告文件、报告规范、联系人分组、非敏感 SMTP 配置和本地发送记录。

## 明确不做

- 不建立结构化工作事实、证据、任务或报告区块表。
- 不复制 DSH 会话、LangGraph、SSE、模型配置或审批系统。
- 不要求登录，不使用云端数据库或云端文件存储。
- 不使用 A2UI；普通工具结果和 DSH 原生审批是完整降级路径。
- 不把 Markdown 源代码作为邮件正文发送。

“全部本地”约束覆盖报告、规范、联系人、配置和发送记录。报告美化仍使用用户在 DSH 中选择的模型；模型 Runtime 是否远程由 DSH 决定，与插件存储边界无关。

## 用户流程

### 日报

1. 用户说“生成今天的日报”，并提供今天完成的工作。
2. Agent 调用 `work_report_context` 读取日报规范和同日已有报告。
3. 如果规范不存在，Agent 先与用户确认受众、语气、长度和固定内容，再调用 `work_report_save_standard`。
4. Agent 只根据当前用户提供的内容生成 Markdown，不补造成果、数据或计划。
5. Agent 调用 `work_report_save` 保存报告，并把可读报告返回到对话。

### 周报和月报

1. Agent 调用 `work_report_context` 读取规范和目标周期内的本地报告。
2. 周报优先使用周期内的日报；月报优先使用周期内的周报，没有周报时回退到日报。
3. 没有可用历史报告时，Agent要求用户补充本周期内容，不凭空生成。
4. Agent合并重复事项并生成新的完整报告，然后调用 `work_report_save`。

报告覆盖同一类型和周期的已有文件时，必须由用户明确要求修改或重新生成，并在工具参数中声明 `overwrite: true`。

### 邮件发送

1. 用户说“把本周周报发给产品组”。
2. Agent 必要时调用 `work_report_recipients` 确认联系人和分组。
3. `work_report_prepare_email` 解析分组、读取报告、生成 HTML 和纯文本正文，并把实际收件人和正文保存为不可变的本地发送草稿。
4. Agent 使用准备结果中的 `delivery_id` 和 `delivery_hash` 调用 `work_report_send_email`。
5. 插件的 `tools/pre-execute` 门禁返回 `ask`，DSH 原生审批显示报告、主题、发件箱和实际收件人。
6. 批准后，发送工具重新校验草稿哈希，通过 SMTP 向每个收件人分别发送，避免分组成员相互暴露邮箱。
7. 成功结果写入本地 JSONL 发送历史；同一个草稿不能重复发送。

本地报告可以使用 Markdown，邮件必须发送 `multipart/alternative`：`text/html` 是经过转义和排版的正文，`text/plain` 是去除 Markdown 标记的回退正文。

## 本地文件

插件根目录由 Profile Patch 配置，默认落在 DSH Home 的 Telos 数据目录，不放入插件安装目录：

```text
work-report/
├── reports/
│   ├── daily/2026-08-15.md
│   ├── weekly/2026-08-11_2026-08-17.md
│   └── monthly/2026-08-01_2026-08-31.md
├── standards/
│   ├── daily.md
│   ├── weekly.md
│   └── monthly.md
├── delivery-drafts/
├── contacts.json
├── mail.json
└── send-history.jsonl
```

报告文件名承载类型和周期，正文保持完整、非结构化。`contacts.json` 和 `mail.json` 只保存完成邮件投递所需的本地配置；SMTP 密码由 DSH `credentials` 服务保管，不写入这些文件。

所有写入使用同目录临时文件加原子替换。配置和发送草稿使用仅当前操作系统用户可读写的权限。插件只在自己的固定根目录内解析文件，不接受模型提供任意路径。

## DSH 工具

| 工具 | 副作用 | 说明 |
|---|---|---|
| `work_report_context` | 无 | 返回规范、已有报告和可用于汇总的历史报告 |
| `work_report_list` | 无 | 按类型和周期查询本地报告 |
| `work_report_get` | 无 | 读取一篇本地报告 |
| `work_report_save_standard` | 本地写入 | 保存用户已经确认的普通文本规范 |
| `work_report_save` | 本地写入 | 保存模型已生成的 Markdown 报告 |
| `work_report_recipients` | 无 | 查询联系人和分组，不返回任何凭据 |
| `work_report_prepare_email` | 本地写入 | 固化发送草稿，不连接 SMTP |
| `work_report_send_email` | 外部副作用 | 必须经过 DSH 原生审批后发送 |

联系人、分组、报告规范和 SMTP 配置也通过一个普通 `settings.section` 管理。设置页不是发送审批入口，不能绕过 `work_report_send_email`。

## 包与升级边界

- Host 和 Client 都位于 `plugins/dsh-work-report`。
- Host 通过 `ctx.tools`、`ctx.credentials`、`ctx.connection` 和可选 `ctx.systemPrompt` 接入。
- Client 只注册一个附加的 `settings.section`，不替换 DSH 或 Telos 页面所有者。
- Telos Web Profile Patch 增加一行插件，不修改 source-pinned DSH 子模块。
- 插件停用后，DSH 会话、工作区和普通工具回放仍可工作；历史调用使用 DSH 通用工具呈现。

## 第一版验收

- 首次生成日报、周报或月报时，缺少规范会促使 Agent 先向用户确认。
- 日报只依据用户本轮内容；周报和月报只依据工具返回的本地历史报告。
- 报告正文保存为可直接打开的 Markdown 文件，没有报告数据库。
- 重启 DSH 后仍可列出、读取和汇总报告。
- 联系人可以加入一个或多个分组，发送准备结果包含展开后的实际邮箱。
- `work_report_send_email` 在没有批准、没有审批通道、草稿被修改、配置不完整或已发送时均不能连接 SMTP。
- 收件人看到排版后的 HTML 或纯文本，不会看到 Markdown 源代码。
- 插件构建、单元测试、Telos DSH parity/provenance 门禁和桌面打包资源检查通过。
