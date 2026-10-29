# 跨宿主与跨系统执行约定

## 宿主

- Codex：通常以 `$design-to-handoff` 调用。
- Claude Code：通常以 `/design-to-handoff` 调用。
- CodeBuddy：用 `/skills` 确认已加载，使用自然语言指定 skill；不要将 `/skills` 列表命令误写成某个技能的专用调用语法。
- OpenCode：通过原生 skill 工具加载，或用自然语言指定 design-to-handoff；原生项目目录 .opencode/skills，全局目录 ~/.config/opencode/skills，尊重 XDG_CONFIG_HOME。
- 其他兼容宿主：按其发现机制调用，阶段顺序和产物要求不变。

agents/openai.yaml 只提供 Codex 界面元数据，不是运行的必需依赖。子 skill 通过实际相对路径读取，不依赖一个宿主才能理解的调用工具。相对路径始终以当前 SKILL.md 的目录解析，不能以终端当前目录猜测。

各宿主的问卷、网页工具和 MCP 名称不同，先发现实际能力，再执行。缺少结构化问卷就通过普通聊天分阶段提问；不能因为某个专用输入工具缺失而跳过必要回答。缺少在线平台工具时保留已完成的设计，说明连接缺口；不要假称换一个智能体仍会自动获得同样能力。

## 系统、路径与字体

识别 Windows / macOS、x64 / arm64 及实际 shell。使用平台提供的文件工具、Node path 或 Python pathlib 处理路径，不能拼接作者本机绝对路径。Windows 盘符、反斜杠、空格和中文路径都要保留；向 shell 传参按该 shell 的规则引用。

不把 shell 的 cp、rm、chmod、Bash heredoc 或 AppleScript 当成跨平台前提；优先使用可用的结构化文件工具或跨平台语言。安装器不会要求符号链接、管理员权限或修改 PowerShell 执行策略。

macOS 与 Windows 可用字体不同，先确认字体在浏览器和云平台都可用；用户指定字体缺失时提出替代，并保留视觉验收。不要因操作系统更换而默默替换已确认的字体。

## Python 验收脚本

安装技能不要求 Python。需运行可选 scripts/verify_delivery.py 时先探测 Python 版本：

- Windows 优先 `py -3 --version`，否则 `python --version`；必须确认为 Python 3.9+。
- macOS 优先 `python3 --version`，否则检查 `python` 是否为 Python 3.9+。

用已确认的解释器执行脚本，脚本路径及 JSON 文件路径作为独立参数传入，不使用依赖 Unix 可执行位的直接运行方式。验证器按 UTF-8 读 JSON，只使用标准库，没有芯片专用依赖。

若环境没有 Python，可按相同六项标准人工/工具检查并如实记录“脚本未运行”；不声称脚本通过，也不未经许可安装语言运行时。需要脚本验证的自动流程必须先解决解释器缺口。

## 平台连接

Figma/Penpot 使用当前宿主实际可连接的 MCP，账号、免费权益和工具限制分别验证。安装 skill 不会自动授权第三方账号。优先使用各系统可用的浏览器/连接器，不能把仅 macOS 支持的桌面操作作为唯一交付路线。
