# Design to Handoff

通过分步访谈，把需求文档与补充说明整理成设计文档，生成可检查元素属性的分层界面，并按选择交付到 Figma 或 Penpot。

只提供 **design-to-handoff 一个可见技能入口**。需求、设计方向、参考、设计生成、Figma/Penpot 交付继续分为六份内部说明，按阶段读取，不单独出现在技能列表中。

**所有智能体采用同一交互规则**：优先调用宿主原生问答，选择题支持选项和自定义输入；先单独询问【需求文档｜必填】，再单独询问【补充文档｜可选、可跳过】。回答后自动继续，不要求再发送“继续”。Codex、Claude Code、CodeBuddy、WorkBuddy、Cursor、OpenCode 的差异仅是工具协议。当前模式确实没有原生问答时，须先说明能力限制，不能用文字菜单冒充控件。

## 安装一次，之后直接更新

先安装 **Node.js 22.20+（含 npm）**，并确保可访问 GitHub。无需 Git 或 Python。macOS Apple Silicon 安装 arm64 版 Node，Intel 安装 x64 版；Windows 使用与系统架构匹配的版本。

首次把命令行工具安装到 npm 的全局目录：

```sh
npm install --global https://codeload.github.com/Blank-Tea/design-to-handoff/tar.gz/refs/tags/v0.7.0
```

再选择要安装技能的智能体：

```sh
design-to-handoff
```

菜单支持 ↑/↓ 移动、空格勾选多个智能体、回车确认，核对目录后安装。选择页和确认页均可按一次 Ctrl+C 取消。没有选择的智能体不写入；失败或中断会回滚技能文件。

以后更新只需：

```sh
design-to-handoff update
```

默认检查已发布的稳定版本，自动检测已安装的全局技能目标，不重复选择智能体。有新版才下载并升级命令行，再同步技能；已经最新时只查版本，不下载技能包、不重复备份。命令行已是最新但某个技能副本较旧时，直接用本地文件更新该副本。

此前只用 npx 安装过技能的用户，需要执行一次上面的全局安装命令，之后即可用 update。命令行的 npm 全局目录需要可写，且其 bin 目录应在 PATH 中；按当前 Node.js 的用户级安装方式配置，不需要更改系统脚本策略。PowerShell 禁止 npm.ps1 时可把首次命令开头改为 npm.cmd。

仍保留一次性 npx 入口：

```sh
npx --yes https://codeload.github.com/Blank-Tea/design-to-handoff/tar.gz/refs/tags/v0.7.0
```

一次性入口不会永久注册终端命令；推荐使用全局安装获得 update。

### 安装位置

默认安装到当前用户的全局技能目录，路径由 Node.js 自动按系统生成：

| 智能体 | macOS 全局目录 | Windows 全局目录 |
|---|---|---|
| Codex | `~/.agents/skills/` | `%USERPROFILE%\.agents\skills\` |
| Claude Code | `~/.claude/skills/` | `%USERPROFILE%\.claude\skills\` |
| CodeBuddy | `~/.codebuddy/skills/` | `%USERPROFILE%\.codebuddy\skills\` |
| WorkBuddy | `~/.workbuddy/skills/` | `%USERPROFILE%\.workbuddy\skills\` |
| Cursor | `~/.cursor/skills/` | `%USERPROFILE%\.cursor\skills\` |
| OpenCode | `~/.config/opencode/skills/` | `%USERPROFILE%\.config\opencode\skills\` |

显式配置了 `CODEX_HOME` 或 `CLAUDE_CONFIG_DIR` 时，分别使用其 `skills` 子目录；OpenCode 尊重 `XDG_CONFIG_HOME`，使用其中 opencode/skills。安装器使用文件复制，不创建符号链接，不需要管理员权限。只有用户目录被系统限制时才需要另选可写位置。

安装到当前项目，用以下命令，菜单仍支持多选：

```text
design-to-handoff --scope project
```

项目目录分别是 `.agents/skills/`、`.claude/skills/`、`.codebuddy/skills/`、`.cursor/skills/`、`.opencode/skills/`；WorkBuddy 按官方项目兼容机制也使用 `.codebuddy/skills/`。同时勾选 WorkBuddy 和 CodeBuddy 时，同一项目目录只安装、备份或更新一次。

如需不交互、明确指定三个智能体：

```text
design-to-handoff --agents codex,claude-code,codebuddy --yes
```

`--yes` 是安装器的非交互确认选项。只看计划不写文件可使用 `--agents codex,claude-code,codebuddy --dry-run`。可用 `--root` 指定自定义用户/项目根目录；未指定时自动发现，不需要填写个人路径。

安装器只安装一个完整的 `design-to-handoff/` 目录，包含全部内部说明、问答适配和验收脚本。同名入口会先显示提醒，确认后备份到各智能体配置目录下 `.design-to-handoff-backups/` 再替换。从 0.3.x 及更早版本更新时，本包旧的六个子技能入口也会完整备份并移出技能目录，避免列表继续混乱；无关技能不改变。安装或迁移中途失败会恢复旧入口及原有内容。

### 安装后调用

刷新或重启对应智能体，必要时开始新聊天：

- Codex：`$design-to-handoff`。
- Claude Code：`/design-to-handoff`。
- CodeBuddy：用 `/skills` 查看已加载技能，然后说“请使用 design-to-handoff 按步骤完成设计交付”。
- WorkBuddy：在“专家·技能·连接器 → 技能 → 已安装”查看，用自然语言指定 design-to-handoff；原生问答使用实际提供的 AskUserQuestion。
- OpenCode：通过其原生 skill 加载机制，或直接说“请加载 design-to-handoff”；无须读取 openai.yaml。
- Cursor 或其他兼容宿主：按其技能界面选择，或用自然语言指定技能名称。

首次安装只放置技能说明、维护信息和验收脚本，不含作者账号或密钥。实际读取已有设计时就发现平台工具并引导必要连接/授权，新建设计的上传连接可留到验收后；平台仍须提供可用的浏览器/写入能力。每位使用者使用自己的账号，通过问答完成连接；后续文件操作由智能体执行。无需作者电脑上的路径、配置或文件。

### WorkBuddy 安装与更新

更新命令行后，首次为 WorkBuddy 安装技能：

```sh
design-to-handoff update
design-to-handoff --agents workbuddy
```

第一条只更新已有目标，不会自动给尚未安装的宿主新增技能；第二条才安装 WorkBuddy。已安装后直接使用 `design-to-handoff update`，或限定 `design-to-handoff update --agents workbuddy`。项目安装/更新沿用 `--scope project`。

WorkBuddy 原生用户级目录与 CodeBuddy 不同，不能只更新 `.codebuddy/skills` 就宣称桌面原生副本已同步。[WorkBuddy 适配说明](skills/design-to-handoff/references/workbuddy-input.md)记录了路径、提问和连接器规则；项目兼容目录的来源是 [WorkBuddy 官方项目配置](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Project)。

## 为什么存在 agents/openai.yaml

这是 Codex 的可选界面扩展，只有显示名称、简介和默认提示词，不是 OpenAI SDK、模型配置或运行依赖。通用入口是 SKILL.md；references/ 是按需阅读的补充文档，scripts/ 是按需执行的本地工具。此处 agents/ 不是多智能体安装目录，也不表示会启动额外 AI。

其他宿主按其标准技能机制读取 SKILL.md。本包有自动化测试：移除可选 agents/ 后，仍能为六种目标各安装一个完整技能目录。因此无须编造各宿主不识别的 claude.yaml、cursor.yaml 等文件。独立宿主能否完成实际设计上传，仍取决于其可用工具与授权，不能用安装通过代替端到端验证。

## 工作流程

【需求文档｜必填】 → 【补充文档｜可选、可跳过】 → 浓缩需求 → 确认新建/补充/修改 → 读取已有链接与规范、解决冲突 → 风格、字体、字号、圆角、配色 → 可选网站或截图 → 可选本地保存 → 设计文档与预览 → 选择 Figma / Penpot / 两者 → 连接与目标位置 → 上传及标注验收 → 真实结果链接。

需求文档必须提供有效的文件、目录、链接或已给附件；补充文档可回答“无”或跳过。参考可跳过，设计方向可回答“你推荐”。明确选择不保留本地副本才不写交付目录；过程可以使用临时文件。

## 选择平台后自动完成云端交付

先在设计生成前确认新建还是补充/修改。已有设计必须提前提供实际项目/文件/画板链接，读取样式和组件并处理冲突后才生成；需要的浏览器授权、Penpot MCP key 问答也提前完成，只读不写。新建设计可以在验收后再选择上传平台。上传时复用目标和既有连接，只复核身份、权限及相关基线，再自动创建/追加、命名、构建并读回。默认不要求你自己建目录、手动导入或改名。

Penpot 官方远程 MCP 首次需要 MCP key。本技能会通过独立的【Penpot MCP 密钥】问答收集，优先秘密输入，然后配置所选宿主连接；不回显、不写入设计、仓库或交付记录。有效连接复用，不每次重新索取。普通网页登录和提供 key 不代表目标文件已可写，仍需验证并连接实际文件。

补充已有项目的链接在生成前收集：项目默认新增独立文件，文件默认新增业务页面，画板默认在可用区域追加设计。先读已有样式/组件，保留旧内容；只有明确要求才更新指定节点。中断后复用真实 ID 续传，避免重复空文件。

前置步骤见[设计上下文](skills/design-to-handoff/references/design-context.md)，上传流程见[云端交付](skills/design-to-handoff/references/cloud-handoff.md)。宿主需实际具备浏览器/连接和云写入能力；缺失时会说明具体缺口并保留继续点。技能不能自行产生 OAuth 客户端或让仅有读取权限的连接获得写权限。

## 平台方案

| 平台 | 方案 | 前提与边界 |
|---|---|---|
| Figma | 优先 Code to canvas，把 HTML 页面转换为可编辑 Design 图层 | 免费 Starter 路径以当前官方权益和连接器规则为准；宿主要求原生组件重建时须满足该要求 |
| Penpot | 官方 MCP 写入原生文字、容器和矢量图层 | 需启用并配置 MCP，打开目标文件并保持活动连接 |

两平台都要求验收真实文字、布局与样式；整页截图不能冒充分层设计。开发代码标注是样式片段，不是完整业务代码。没有第二个免费查看账号验证时，会保留“多人查看待验收”。

平台的账号、连接器、额度、字体和权限由使用者准备。免费指平台可用方案，不包含 AI 宿主或模型费用。当前未完成线上端到端上传与多账号验证，不把本地校验视为线上能力保证。

## 一个入口，六个内部阶段

唯一的技能清单是 `skills/design-to-handoff/SKILL.md`。内部阶段位于 `references/stages/`，文件是普通 Markdown，不注册为 skill：

- `intake.md`：文档提炼。
- `direction.md`：设计方向访谈。
- `reference-analysis.md`：网站与截图分析。
- `compose.md`：生成设计与图层检查。
- `publish-figma.md` / `publish-penpot.md`：平台交付。

所有阶段共用[内置问答契约](skills/design-to-handoff/references/interactive-input.md)，CodeBuddy 插件另有协议适配。交互期间只提示当前业务进度，不要求用户认识内部模块名。

详细用法见[使用说明](使用说明.md)，验证边界见[验证记录](验证记录.md)。

## 更新与卸载

运行 `design-to-handoff update` 更新已安装的全局技能。它检查当前环境配置的目录以及标准目录，只更新已经存在的本包入口；不会给未安装的智能体新建技能。旧入口先备份，技能同步失败则回滚。更新全局命令行需要 npm 全局目录的写权限；若命令行已升级但技能同步失败，下次 update 会继续同步本地副本。

项目和自定义根目录需要沿用原来的选项：

```sh
design-to-handoff update --scope project
design-to-handoff update --root /path/to/custom-root
design-to-handoff update --agents codex,codebuddy
```

`update --dry-run` 仅查询版本并显示目标，不下载、不写入；`--version` 显示当前命令行版本。查询失败、网络超时或下载失败会报错，技能文件保持原状，不要求登录 GitHub，也不自动重试覆盖本地内容。

全局更新不会自动遍历磁盘查找项目副本。源码使用者仍可 `git pull --ff-only` 后运行 `node bin/install.mjs`；只拉取源码不会替换已安装副本。

卸载时只移除本包 skill，保留其他技能：

```sh
npx --yes skills@1.7.4 remove --skill design-to-handoff --agent codex claude-code codebuddy --global --yes
```

将 `--agent` 后面的名字改为该工具实际支持的目标；项目安装不带 `--global`。卸载不删除安装器保存的备份。WorkBuddy 原生副本可通过其已安装技能界面移除，或仅移除 `.workbuddy/skills/design-to-handoff`；不假定旧版通用卸载器识别 `workbuddy`。项目级 `.codebuddy/skills/design-to-handoff` 与 CodeBuddy 共用，移除这份副本会同时影响两者。

OpenCode 的原生项目安装目录为 `.opencode/skills/`，与部分通用安装器采用的 `.agents/skills/` 不同。项目级卸载请在 OpenCode 的技能管理中处理，或只移除 `.opencode/skills/` 下本包的 design-to-handoff 目录；不要假设上述通用卸载命令会找到原生项目目录。自定义根目录也应按实际安装计划处理。

## 系统兼容性

安装器是纯 JavaScript：文件处理使用 Node.js 标准库，终端多选使用固定版本的 @clack/prompts，依赖随 npm 自动下载。无原生扩展、Bash/PowerShell 脚本、平台专用二进制和芯片相关依赖。技能正文使用通用 Agent Skills 格式；`agents/openai.yaml` 只是 Codex 可选界面元信息，其他宿主读取标准 SKILL.md。

Windows x64、macOS Intel x64、macOS Apple Silicon arm64 通过仓库 Actions 持续验证安装器、npm 打包和验收脚本。此前版本的[三平台通过记录](https://github.com/Blank-Tea/design-to-handoff/actions/runs/40813988394)仅对应历史提交，当前版本结果请查看对应提交的 Actions。该测试验证文件安装和脚本执行，不代表所有智能体的在线设计工具都已端到端测试。持续状态见[跨平台测试](https://github.com/Blank-Tea/design-to-handoff/actions/workflows/portability.yml)和[验证记录](验证记录.md)。

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

可选的 HTTP 故障模拟使用 Postman CLI 1.77+：先运行 `postman simulation run postman/simulations/updater/updater.sim.yaml --port auto --no-history`，再用输出的 github 成员地址执行 `node tests/simulation-check.mjs <成员地址>`；错误配置为同目录 updater-error.sim.yaml，检查命令另加 `error`。模拟不随 npm 包分发，不需要部署云服务。

分发方式参考 [skills CLI](https://github.com/vercel-labs/skills)。本仓库不是 Figma、Penpot 或 OpenAI 官方发布的技能。
