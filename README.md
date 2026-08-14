# Telos

Telos 是一个本地优先、持续存在的个人智能系统。它希望把个人目标、长期记忆、知识、权限和执行历史组织成可审查的长期状态，再把具体工作交给可替换的 Agent Runtime、模型和工具执行。

> 当前仓库仍处于早期开发阶段。现阶段已经完成的是桌面产品基础、完整 DSH Web 功能基线、Telos 自有界面层和桌面发布基础设施；个人长期记忆、知识库、电脑自动化和多模型调度仍在后续范围内。

[架构决策](./docs/architecture/0003-full-dsh-web-baseline.md) · [DSH 同步规范](./docs/maintenance/dsh-upstream-sync.md) · [第三方声明](./THIRD_PARTY_NOTICES.md)

## 一句话理解

```text
个人长期状态 + 可替换 Agent Runtime + 受控现实能力 -> 持续推进个人目标
```

## 它到底是做什么的

用最直白的话说：

> Telos 不是每次从零开始回答问题，而是逐步理解一个人正在做什么、想完成什么、已经做过哪些决定，并在用户可控的前提下持续推进事情。

它最终要连接三类内容：

- 输入：用户请求、个人目标、项目上下文、本地文件、历史事件和外部服务；
- 状态：长期记忆、个人知识、权限、任务进度、决定依据和执行记录；
- 输出：回答、文档、代码、文件变更、自动化动作、提醒和可恢复的长期任务。

Telos 不打算成为：

- 一个换皮的 AI 聊天客户端；
- 一个只服务于代码仓库的 Coding Agent；
- 一个把聊天记录直接当作长期记忆的系统；
- 一个未经授权就操作电脑、发送消息或提交外部结果的后台程序；
- 一个为了展示“多 Agent”而进行无意义角色扮演的框架；
- 一个与 DeepSeek Harness 强绑定、无法更换 Runtime 的桌面壳。

## 当前阶段能做什么

| 能力 | 当前状态 | 说明 |
| --- | --- | --- |
| Electron 桌面应用 | 已完成基础能力 | React Renderer、主进程、Preload、安全边界和原生窗口框架 |
| 完整 DSH Web 工作台 | 已接入 | 从固定源码提交构建并由 Electron 监督启动，保留默认插件组合 |
| Telos 自有界面层 | 已接入 | 三栏布局、启动与恢复界面、主题、品牌和侧栏兼容组件 |
| 会话、工作区、设置和活动面板 | 已保留 | 继续复用固定版本 DSH 的 Session、Projection、Tool 和 Web Runtime |
| 桌面生命周期 | 已实现 | 单实例、关闭后驻留、系统托盘、显式退出和 DSH 优雅停止 |
| 打包与更新 | macOS arm64 已验证 | DMG、ZIP、更新元数据、包内 Node.js 和包内 DSH 真实启动已验证 |
| macOS x64、Windows、Linux | CI 已配置，尚未验收 | 必须以各平台原生 CI 结果为准 |
| 个人长期记忆 | 规划中 | 不是聊天归档，后续将维护来源、时间、置信度和删除能力 |
| 个人知识库与知识图谱 | 规划中 | 将与记忆、目标和项目状态建立可追溯关系 |
| 多模型与多模态调度 | 规划中 | DSH 是首个 Runtime，但不成为模型或能力的唯一入口 |
| 电脑操作与连接器 | 规划中 | OpenCLI、OpenConnector 和桌面自动化需要经过统一权限与执行记录 |

“已经接入完整 DSH Web”指 Telos 保留固定 DSH 提交中默认启用的 Web 组合，并通过自动化审计检查插件差异；它不代表未来 DSH 功能、未配置 Provider 或平台不可用能力已经自动获得验收。

## 系统边界

当前主要交互路径：

```text
Telos Desktop
  -> Electron main process
  -> DSH Web supervisor
  -> source-built `dsh web --port 0`
  -> DSH Host / Session / Projection / Tool / Web plugins
  -> Telos Renderer frame and compatible UI overlays
```

目标架构边界：

```text
Desktop / Browser / IDE / Mobile / Voice
                 |
                 v
       Telos Personal Core
 goals / memory / knowledge / policy / receipts
                 |
                 v
       Runtime and capability contracts
                 |
       +---------+---------+
       |                   |
       v                   v
 DeepSeek Harness     future runtimes
       |
       v
 models / files / terminal / browser / connectors
```

| Telos 自己维护 | Runtime 或能力提供方维护 |
| --- | --- |
| 个人目标、记忆、知识和权限 | 模型推理、工具循环和专业 Agent 执行 |
| 桌面生命周期与产品界面 | DSH Host、Session、Projection 和默认插件 |
| 长期任务状态、操作收据和审计 | OpenCLI、OpenConnector 等具体连接能力 |
| Runtime 契约和升级兼容边界 | 可替换模型、Runtime 和外部服务实现 |

DSH 是当前的第一个完整 Agent Runtime，不是 Telos 的个人事实来源。普通 Telos 功能不得直接修改 `third_party/deepseek-harness`。

## 快速开始

### 环境要求

- macOS、Windows 或 Linux；当前本地验收平台为 macOS arm64；
- Node.js `^22.19.0` 或 `>=24.0.0`；
- Corepack 和仓库固定的 pnpm `11.17.0`；
- 一个用于本地测试的模型 API Key。

### 1. 获取源码

```bash
git clone --recurse-submodules https://github.com/codexiaoke/telos.git
cd telos
corepack enable
pnpm install --frozen-lockfile
```

已有仓库需要先恢复固定的 DSH Submodule：

```bash
git submodule update --init --recursive
```

### 2. 构建固定版本 DSH

```bash
pnpm dsh:build
```

该命令会构建固定源码版本的 DSH Host、CLI、完整 Web 应用以及 Telos 的 Renderer 兼容包和侧栏覆盖层。它不会从 npm 下载另一个 DSH 版本替代仓库中的 Submodule。

### 3. 配置本地模型

在仓库根目录创建不会提交的 `.env.local`：

```dotenv
DEEPSEEK_API_KEY=your_local_key
```

不要把真实密钥写入 README、源码、Git 提交或截图。

### 4. 启动桌面端

```bash
pnpm dev
```

Electron 会启动本地 DSH Web Runtime，等待其健康检查通过，再把窗口交接给完整工作台。

## 验证当前仓库

提交代码前至少运行：

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm dsh:verify
```

`pnpm dsh:verify` 会检查：

- 父仓库 gitlink 与实际 DSH 提交一致；
- DSH Submodule 没有未说明的修改；
- Telos 派生 UI 的来源、哈希和许可证一致；
- 默认 DSH Web 插件组合没有未解释的缺失；
- Telos Renderer 兼容包仍能以正确的 DSH 包身份解析。

如需只读检查上游是否出现新提交：

```bash
pnpm dsh:upstream
```

它不会自动移动 Submodule 指针，也不会替你合并上游改动。

## 打包桌面应用

生成用于本地 Smoke Test 的目录包：

```bash
pnpm package:desktop:dir
```

生成当前平台的安装包和更新文件：

```bash
pnpm package:desktop
```

打包流程会：

1. 构建 Telos Workspace 和 Electron Renderer；
2. 复制完整、固定源码版本的 DSH Runtime；
3. 打包兼容版本的独立 Node.js 及其许可证；
4. 生成平台安装包、更新元数据和 blockmap；
5. 直接使用包内 Node.js 执行包内 DSH CLI，防止发布一个依赖开发机环境的空壳。

产物写入 `dist/`。当前首版采用完整 DSH Runtime 快照，体积较大；在依赖闭包能够通过相同 Smoke Test 之前，不会为了减小体积静默删除 DSH 功能。

## 发布方式

仓库的 [Desktop release workflow](./.github/workflows/desktop-release.yml) 使用原生 Runner 构建：

| 平台 | 架构 | 产物 |
| --- | --- | --- |
| macOS | arm64、x64 | DMG、ZIP、更新元数据和 blockmap |
| Windows | x64 | NSIS 安装包、更新元数据和 blockmap |
| Linux | x64 | AppImage、deb 和更新元数据 |

- 手动运行 Workflow：只生成 CI Artifact，不创建 GitHub Release；
- 推送 `vX.Y.Z` 标签：要求签名与公证 Secrets，通过后创建或更新草稿 Release；
- 草稿 Release 需要人工检查后才能发布给用户；
- 当前仓库尚未提供经过签名与多平台验收的正式公开版本。

详细边界见 [Desktop distribution and lifecycle](./docs/architecture/0005-desktop-distribution-and-lifecycle.md)。

## DSH 源码集成与同步

DSH 通过 Git Submodule 固定在：

```text
third_party/deepseek-harness
```

当前原则：

- Telos 提交记录精确的 DSH Commit；
- 日常产品开发不直接修改 Submodule；
- Telos 视觉与产品逻辑位于 `apps/desktop` 和 `integrations/dsh`；
- 通用 DSH 修复优先在 DSH Fork 中完成并考虑贡献上游；
- 升级必须单独提交、人工 Diff，并重新运行来源、功能和真实会话验证。

升级前请完整阅读 [DSH upstream synchronization runbook](./docs/maintenance/dsh-upstream-sync.md)。

## 仓库结构

```text
apps/
  desktop/                       Electron + React 桌面应用

packages/
  runtime-contracts/             Telos 稳定 Runtime 契约
  runtime-dsh/                   DSH Headless Adapter 与事件翻译

integrations/
  dsh/plugins/                   Telos 自有 DSH 兼容 UI 包和来源记录
  dsh/profiles/                  Telos 自有 Headless DSH 组合

third_party/
  deepseek-harness/              固定源码版本的 DSH Submodule

docs/
  architecture/                  架构决策记录
  maintenance/                   上游同步和维护规范

scripts/                         构建、审计、打包与发布脚本
```

未来的 `memory`、`knowledge`、`goals` 和 `automation` 模块尚未因为路线图而提前创建空目录；它们需要先完成领域模型和权限边界设计。

## 开发命令

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 构建 Workspace Package 并启动 Electron 开发环境 |
| `pnpm build` | 构建 Telos Package 和桌面应用 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm test` | 运行 Package、桌面端和发布脚本测试 |
| `pnpm lint` | 运行 Oxlint |
| `pnpm dsh:build` | 构建固定源码版本 DSH 和 Telos UI 派生包 |
| `pnpm dsh:verify` | 审计 DSH 来源、派生包和默认 Web 功能组合 |
| `pnpm dsh:upstream` | 只读检查 DSH 上游状态 |
| `pnpm package:desktop:dir` | 生成当前平台的目录包并验证包内 DSH |
| `pnpm package:desktop` | 生成当前平台的安装包和更新文件 |

## 安全与隐私边界

- 用户数据、运行历史和未来个人状态优先保存在本地；
- DSH Web 只允许由桌面端在 `127.0.0.1` 的临时端口启动；
- Renderer 使用 Context Isolation、Sandbox，并禁用直接 Node.js 访问；
- API Key 当前只允许放在被 Git 忽略的本地配置中；
- 高风险、不可逆或对外提交的操作必须进入明确的权限和确认边界；
- 记忆与模型推测必须区分，未来个人记忆需要来源、时间、置信度和删除能力。

如发现安全问题，请不要先创建包含利用细节的公开 Issue，可通过仓库的 [GitHub Security Advisory](https://github.com/codexiaoke/telos/security/advisories/new) 私下报告。

## 文档导航

- [Desktop foundation](./docs/architecture/0001-foundation.md)
- [DSH source integration](./docs/architecture/0002-dsh-source-integration.md)
- [Complete DSH Web baseline](./docs/architecture/0003-full-dsh-web-baseline.md)
- [Telos-owned Renderer](./docs/architecture/0004-telos-owned-renderer.md)
- [Desktop distribution and lifecycle](./docs/architecture/0005-desktop-distribution-and-lifecycle.md)
- [DSH upstream synchronization](./docs/maintenance/dsh-upstream-sync.md)
- [Third-party notices](./THIRD_PARTY_NOTICES.md)

## 下一阶段

当前优先级不是继续堆叠聊天功能，而是按顺序建立：

1. 稳定 DSH 完整功能基线和 Telos 自有界面层；
2. 定义个人长期记忆、知识、目标和项目之间的领域关系；
3. 建立可审查、可删除、可追溯的个人记忆与知识存储；
4. 增加多模型和多模态能力路由；
5. 通过 OpenCLI、OpenConnector 和桌面能力接入受控电脑自动化；
6. 为长期任务增加暂停、恢复、重试、权限收据和主动提醒。

## 参与开发

提交修改前：

1. 先确认功能属于 Telos 产品层、DSH Runtime 层还是外部能力层；
2. 涉及 DSH 时先阅读 ADR 0003、ADR 0004 和上游同步规范；
3. 不要为了修改 UI 直接编辑 Submodule；
4. 一个提交只解决一个可回退的问题；
5. 运行类型检查、测试、Lint 和 DSH 审计；
6. 不提交 API Key、用户数据、`.env.local`、构建产物或本地运行目录。

## License

Telos 自有代码计划开源，但仓库根目录尚未确定最终开源许可证。在正式添加 `LICENSE` 前，请不要默认 Telos 自有代码可以被重新分发。DSH、Node.js、thinking-orbs 派生实现及其他依赖的许可信息见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
