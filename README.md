# Design to Handoff

通过分步访谈，把需求文档与补充说明整理成设计文档，生成可检查元素属性的分层界面，并按选择交付到 Figma 或 Penpot。

包含 1 个主 skill 和 6 个子 skill。安装后，AI 按阶段加载子 skill，不创建额外聊天或并发代理。

## 一条命令，交互式多选安装

先安装 **Node.js 22.20+（含 npm/npx）**，并确保可访问 GitHub。无需 Git 或 Python。macOS Apple Silicon 安装 arm64 版 Node，Intel 安装 x64 版；Windows 使用与系统架构匹配的版本。

在自己的终端执行：

```text
npx --yes https://codeload.github.com/Blank-Tea/design-to-handoff/tar.gz/refs/heads/master
```

这会下载本仓库内的安装器，并显示多选菜单：

```text
◻ Codex
◻ Claude Code
◻ CodeBuddy
◻ Cursor
◻ OpenCode

↑/↓ 移动 · 空格勾选/取消勾选 · 回车确认 · Ctrl+C 取消
```

使用方向键移动，按空格勾选一个或多个目标，回车后核对目录，再选择“安装”。没有选择的智能体不写入。命令开头的 `--yes` 只允许 npx 下载运行包，不会跳过安装器的智能体选择和安装确认。

选择页、确认页按一次 Ctrl+C 即取消，退出码为 130，不再反复向已关闭的 readline 提问。输入流关闭同样会取消；写入期间收到中断则先回滚，不保留半套技能。

如果本机 npm 缓存仍运行旧的编号菜单，可使用固定修复版本入口：

```text
npx --yes https://codeload.github.com/Blank-Tea/design-to-handoff/tar.gz/refs/tags/v0.3.0
```

Windows 的 CMD 与 macOS 的 Terminal 可使用同一条命令。PowerShell 若提示 npx.ps1 被脚本策略禁止，将开头的 npx 改为 npx.cmd，其余参数不变；不需要修改执行策略。此入口直接下载 GitHub HTTPS 源码包，不依赖 Git 的 SSH 或凭证配置。

### 安装位置

默认安装到当前用户的全局技能目录，路径由 Node.js 自动按系统生成：

| 智能体 | macOS 全局目录 | Windows 全局目录 |
|---|---|---|
| Codex | `~/.agents/skills/` | `%USERPROFILE%\.agents\skills\` |
| Claude Code | `~/.claude/skills/` | `%USERPROFILE%\.claude\skills\` |
| CodeBuddy | `~/.codebuddy/skills/` | `%USERPROFILE%\.codebuddy\skills\` |
| Cursor | `~/.cursor/skills/` | `%USERPROFILE%\.cursor\skills\` |
| OpenCode | `~/.config/opencode/skills/` | `%USERPROFILE%\.config\opencode\skills\` |

显式配置了 `CODEX_HOME` 或 `CLAUDE_CONFIG_DIR` 时，分别使用其 `skills` 子目录；OpenCode 尊重 `XDG_CONFIG_HOME`，使用其中 opencode/skills。安装器使用文件复制，不创建符号链接，不需要管理员权限。只有用户目录被系统限制时才需要另选可写位置。

安装到当前项目，用以下命令，菜单仍支持多选：

```text
npx --yes https://codeload.github.com/Blank-Tea/design-to-handoff/tar.gz/refs/heads/master --scope project
```

项目目录分别是 `.agents/skills/`、`.claude/skills/`、`.codebuddy/skills/`、`.cursor/skills/`、`.opencode/skills/`。

如需不交互、明确指定三个智能体：

```text
npx --yes https://codeload.github.com/Blank-Tea/design-to-handoff/tar.gz/refs/heads/master --agents codex,claude-code,codebuddy --yes
```

最后的 `--yes` 才是安装器确认选项。只看计划不写文件可使用 `--agents codex,claude-code,codebuddy --dry-run`。可用 `--root` 指定自定义用户/项目根目录；未指定时自动发现，不需要填写个人路径。

安装器永远把 7 个 skill 作为整体安装，保留主技能对子技能的相对引用。同名技能会先显示提醒，确认后备份到各智能体配置目录下 `.design-to-handoff-backups/`，再替换；无关技能不改变。中途失败会回滚已写入的技能。

### 安装后调用

刷新或重启对应智能体，必要时开始新聊天：

- Codex：`$design-to-handoff`。
- Claude Code：`/design-to-handoff`。
- CodeBuddy：用 `/skills` 查看已加载技能，然后说“请使用 design-to-handoff 按步骤完成设计交付”。
- OpenCode：通过其原生 skill 加载机制，或直接说“请加载 design-to-handoff”；无须读取 openai.yaml。
- Cursor 或其他兼容宿主：按其技能界面选择，或用自然语言指定技能名称。

安装只放置技能说明和验收脚本，不替你安装/授权 Figma 或 Penpot MCP，不含任何作者账号或密钥。每位使用者使用自己的账号，在平台选择阶段连接。无需作者电脑上的路径、配置或文件。

## 为什么存在 agents/openai.yaml

这是 Codex 的可选界面扩展，只有显示名称、简介和默认提示词，不是 OpenAI SDK、模型配置或运行依赖。通用入口是 SKILL.md；references/ 是按需阅读的补充文档，scripts/ 是按需执行的本地工具。此处 agents/ 不是多智能体安装目录，也不表示会启动额外 AI。

其他宿主按其标准技能机制读取 SKILL.md。本包有自动化测试：从全部技能中移除 agents/ 后，仍能为五种目标安装 35 个完整技能目录。因此无须编造各宿主不识别的 claude.yaml、cursor.yaml 等文件。独立宿主能否完成实际设计上传，仍取决于其可用工具与授权，不能用安装通过代替端到端验证。

## 工作流程

需求文档和补充说明 → 浓缩需求 → 风格、字体、字号、圆角、配色 → 可选网站或截图 → 可选本地保存 → 设计文档与预览 → 选择 Figma / Penpot / 两者 → 连接与目标位置 → 上传及标注验收 → 真实结果链接。

补充文档可为“无”，参考可跳过，设计方向可回答“你推荐”。不指定本地目录就不保留本地交付副本，过程可以使用临时文件。

## 平台方案

| 平台 | 方案 | 前提与边界 |
|---|---|---|
| Figma | 优先 Code to canvas，把 HTML 页面转换为可编辑 Design 图层 | 免费 Starter 路径以当前官方权益和连接器规则为准；宿主要求原生组件重建时须满足该要求 |
| Penpot | 官方 MCP 写入原生文字、容器和矢量图层 | 需启用并配置 MCP，打开目标文件并保持活动连接 |

两平台都要求验收真实文字、布局与样式；整页截图不能冒充分层设计。开发代码标注是样式片段，不是完整业务代码。没有第二个免费查看账号验证时，会保留“多人查看待验收”。

平台的账号、连接器、额度、字体和权限由使用者准备。免费指平台可用方案，不包含 AI 宿主或模型费用。当前未完成线上端到端上传与多账号验证，不把本地校验视为线上能力保证。

## 子技能

- `design-to-handoff`：主入口、顺序与状态。
- `design-intake`：文档提炼。
- `design-direction`：设计方向访谈。
- `design-reference-analysis`：网站与截图分析。
- `design-compose`：生成、真实图层要求与验收。
- `design-publish-figma`：Figma 交付。
- `design-publish-penpot`：Penpot 交付。

详细用法见[使用说明](使用说明.md)，验证边界见[验证记录](验证记录.md)。

## 更新与卸载

重新执行同一安装命令，选择需要更新的智能体，核对并确认后安装当前仓库版本；原同名技能会保留备份。

卸载时只移除本包 skill，保留其他技能：

```sh
npx --yes skills@1.7.4 remove --skill design-to-handoff design-intake design-direction design-reference-analysis design-compose design-publish-figma design-publish-penpot --agent codex claude-code codebuddy --global --yes
```

将 `--agent` 后面的名字改为实际需卸载的智能体；项目安装不带 `--global`。卸载不删除安装器保存的备份。

OpenCode 的原生项目安装目录为 `.opencode/skills/`，与部分通用安装器采用的 `.agents/skills/` 不同。项目级卸载请在 OpenCode 的技能管理中处理，或只移除 `.opencode/skills/` 下本包列出的 7 个目录；不要假设上述通用卸载命令会找到原生项目目录。自定义根目录也应按实际安装计划处理。

## 系统兼容性

安装器是纯 JavaScript：文件处理使用 Node.js 标准库，终端多选使用固定版本的 @clack/prompts，依赖随 npm 自动下载。无原生扩展、Bash/PowerShell 脚本、平台专用二进制和芯片相关依赖。技能正文使用通用 Agent Skills 格式；`agents/openai.yaml` 只是 Codex 可选界面元信息，其他宿主读取标准 SKILL.md。

Windows x64、macOS Intel x64、macOS Apple Silicon arm64 的独立真实系统测试均已通过，包含安装器、npm 打包和验收脚本。[本次三平台通过记录](https://github.com/Blank-Tea/design-to-handoff/actions/runs/40813988394)。该测试验证文件安装和脚本执行，不代表所有智能体的在线设计工具都已端到端测试。持续状态见[跨平台测试](https://github.com/Blank-Tea/design-to-handoff/actions/workflows/portability.yml)和[验证记录](验证记录.md)。

安装本身不需要 Python。运行可选交付验收脚本才需 Python 3.9+：Windows 用 `py -3` 或确认指向 Python 3 的 `python`，macOS 用 `python3`。执行技能的 AI 应先探测环境、选择可用命令，详见[运行兼容说明](skills/design-to-handoff/references/runtime-compatibility.md)。

技能安装成功不表示三种宿主具有相同 MCP、浏览器和授权能力。需求与设计流程通用，在线上传以各自连接器的实际能力为准。

## 维护者校验

```sh
npm ci --ignore-scripts
npm test
python3 -m pip install -r requirements-dev.txt
python3 scripts/verify_bundle.py
python3 tests/test_delivery.py
```

交付验收脚本自身只依赖 Python 标准库；PyYAML 仅用于维护技能包元信息。

分发方式参考 [skills CLI](https://github.com/vercel-labs/skills)。本仓库不是 Figma、Penpot 或 OpenAI 官方发布的技能。
