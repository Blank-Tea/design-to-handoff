# WorkBuddy 适配

用于 WorkBuddy 桌面端。WorkBuddy、CodeBuddy 插件和 CodeBuddy Code CLI 的品牌与部分配置相近，但不能因此假定它们暴露相同的提问、浏览器和云写入工具。

## 安装、调用与更新

- 用户级安装到 `~/.workbuddy/skills/design-to-handoff/`；Windows 对应用户目录下 `.workbuddy/skills/`。
- 项目级按 WorkBuddy 官方代码开发兼容机制安装到 `.codebuddy/skills/design-to-handoff/`，不是猜测出来的 `.workbuddy/skills/` 项目目录。与 CodeBuddy 同时选中时，同一项目目录只复制/备份一次。
- 在 WorkBuddy“专家·技能·连接器 → 技能 → 已安装”中查看；用自然语言指定“使用 design-to-handoff”，或使用当前版本实际提供的技能选择入口。不要把某个 CLI 的 `/skills` 语法保证为所有桌面版本的入口。
- 终端首次运行 `design-to-handoff --agents workbuddy` 安装，以后用 `design-to-handoff update --agents workbuddy` 或不限定宿主的 update 同步已有副本。项目安装/更新沿用 `--scope project`，同一目标受项目优先级影响。
- 更新文件不等于当前已经开始的会话会自动卸载旧指令；按宿主提供的刷新/加载能力确认新内容。技能被关闭时先在已安装列表检查其启用状态，不擅自修改账号全局开关。

## 原生问答

1. 优先调用实际提供的 **AskUserQuestion**。本机 WorkBuddy 5.8.3 的应用代码包含该原生工具及其待答状态处理。若实际工具尚未加载，使用宿主工具发现能力查找，不直接退回普通文本问卷。
2. 依据当前 schema 组织 `questions` 数组；常见题目包含 `question`、`header`、`options`、`multiSelect`。以运行时参数为准，不照抄 Codex 的 title-only 文本题，也不因内部存在别名映射就擅自调用 CodeBuddy 插件的 ask_followup_question。
3. 开放路径题使用工具的自定义输入。若题目要求非空 options，就提供有意义的输入动作选项与自由输入入口；选中“填写地址”本身不是有效地址，不编造文件路径当作真实候选。
4. 按[统一问答](interactive-input.md)依次单独收集必填需求文档、可选补充文档；补充已有设计时在生成前收集目标链接、读取规范并解决冲突。授权完成题与 Penpot 密钥题也通过原生问答，不合并进需求地址题。
5. 问答卡片处于 waiting/pending、工具返回“已展示”或答案容器为空时，继续等待用户实际作答。问题卡片不是可以自动放行的执行权限，不用“自动批准权限”替代用户回答，不发最终完成消息结束等待；收到答案后沿用本阶段自动继续。
6. 密钥优先使用真实支持的秘密输入；没有掩码能力就如实采用专门文本题接收用户明确提供的 Penpot key，不承诺原生界面已隐藏输入，不主动回显、写入设计或仓库。

## 浏览器与云端连接

使用当前 WorkBuddy 实际可用的浏览器、连接器或 MCP 能力。若暴露 connect_cloud_service 等连接入口，先读真实参数与服务目录，只有服务确实存在时才选用，不能虚构 Figma/Penpot 的 serviceId 或 OAuth URL。

[设计前上下文](design-context.md)和[云端交付](cloud-handoff.md)的顺序保持不变：先读取已有设计及解决冲突，后生成；上传时复核并自动创建/追加真实图层。WorkBuddy 的本地预览、轻量网页发布或返回 HTML 产物不能替代远程 Figma/Penpot Design 文件。缺少云写入或浏览器能力时说明具体缺口并保留继续点，不把用户手动导入作为默认上传结果。

## 核对依据与边界

- [WorkBuddy 技能管理](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Skills-Market)
- [WorkBuddy 项目级 .codebuddy 配置](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Project)
- [WorkBuddy 更新日志中的原生提问等待状态](https://www.workbuddy.cn/docs/workbuddy/Changelog)
- 本机 WorkBuddy 5.8.3 的只读应用检查确认 `.workbuddy/skills` 原生路径与 AskUserQuestion 支持；核对日期 2026-10-30。没有修改 WorkBuddy 应用文件或账号设置，没有执行桌面问答与云端上传的端到端实测。
