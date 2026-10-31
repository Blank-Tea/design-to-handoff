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
4. 按[统一问答](interactive-input.md)依次单独收集必填需求文档、可选补充文档；补充已有设计在生成前收集目标链接、读取规范并解决冲突。授权完成题也用原生问答，不与需求地址混合。
5. 问答卡片处于 waiting/pending、工具返回“已展示”或答案容器为空时，继续等待用户实际作答。问题卡片不是可以自动放行的执行权限，不用“自动批准权限”替代用户回答，不发最终完成消息结束等待；收到答案后沿用本阶段自动继续。
6. 平台 OAuth 在宿主正式连接卡片/浏览器完成，不索取 Ardot key、密码或授权码。

## 浏览器与云端连接

使用当前 WorkBuddy 实际可用的浏览器、连接器或 MCP 能力。初始工具列表不代表全部可连接服务；连接可能需要延迟加载、授权或启用。不能据此在平台选择之前结束设计交付。

### 平台选择后的连接引导

1. **先问平台**：预览验收后用 AskUserQuestion 先确定“上传 / 暂不上传”，平台题仅列“Figma / Ardot”。已有明确选择直接读取该平台说明并执行，不重复问；未连接不删平台选项。
2. **读宿主声明**：检查当前会话的 `<declared_mcp_server_names>`、已声明依赖和工具说明，匹配选定平台的精确服务器标识；展示名、平台品牌和 serverName 不能互相猜代。只请求本次所选平台需要的服务，不把全部已声明连接器都列入。
3. **原生连接优先**：所需 MCP/连接器未连接、授权失效/失败、工具未加载，或原操作返回 need_auth/authUrl/缺 API key 时，优先用 **ToolSearch** 加载 **workbuddy_request_mcp_connection**，随即按实际 schema 调用，将匹配的精确标识放入 **servers**。不能只搜索业务工具后说“不存在”，也不能先给手动设置教程、打开另一路浏览器或索取聊天凭证来替代宿主连接卡片。工具名称及参数以运行时为准，不能调用不存在的接口。
4. **等待并恢复**：原生卡片处于待处理时等实际结果；connected 后重新发现业务工具，重试原失败操作一次，做账号/目标只读探测，然后继续创建/上传与远端读回。连接成功只证明已连接，仍需核对写入能力。failed/skipped 本轮不再次请求同一服务，不通过直接密钥或浏览器路线绕过；说明该服务缺口并保留继续点。用户主动要求两平台时分别记录，继续另一已授权且可用的平台。
5. **没有对应声明时**：不得向 servers 填猜测的 `figma`/`ardot`/`ardot-remote`。先实际发现连接器候选，用真实 pluginName/ID 发起安装/连接卡片。无受管候选时，Ardot 还有官方自定义云端 MCP 路线：按[Ardot 接入](ardot-capability.md)使用宿主“自定义连接器 / 配置 MCP”，添加 `https://ardot.tencent.com/mcp` 并完成信任、OAuth 和工具刷新；该新配置名不是预先存在的声明。不要在查完受管目录后就以“本机没装”结束。确实无配置/启用能力才记录具体缺口和继续点；不以它绕过 failed/skipped。
6. **恢复现有设计**：若旧流程停在“当前会话没有可用的 Figma / Ardot 连接”，复用已经生成的源设计、规范和预览，从缺失的平台选择继续。不要重问需求/基础参数，也不要重新生成整套设计。

[设计前上下文](design-context.md)和[云端交付](cloud-handoff.md)的顺序保持不变：先读取已有设计及解决冲突，后生成；上传时复核并自动创建/追加真实图层。WorkBuddy 的本地预览、轻量网页发布或返回 HTML 产物不能替代远程 Figma/Ardot Design 文件。缺少云写入或浏览器能力时说明具体缺口并保留继续点，不把用户手动导入作为默认上传结果。

## 核对依据与边界

- [WorkBuddy 技能管理](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Skills-Market)
- [WorkBuddy 项目级 .codebuddy 配置](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Project)
- [WorkBuddy 更新日志中的原生提问等待状态](https://www.workbuddy.cn/docs/workbuddy/Changelog)
- 本机 WorkBuddy 5.8.3 的只读应用检查确认 `.workbuddy/skills` 原生路径与 AskUserQuestion 支持；核对日期 2026-10-30。另只读核对了当前应用的 mcp_connection_guidance：ToolSearch 加载 workbuddy_request_mcp_connection、servers 使用已声明精确标识、connected 后重试、failed/skipped 本轮停止同项。该指引只证明宿主有连接引导机制，不证明本次会话已声明 Figma/Ardot 或具备写入权限。没有修改 WorkBuddy 应用文件或账号设置，没有执行桌面问答与云端上传的端到端实测。
