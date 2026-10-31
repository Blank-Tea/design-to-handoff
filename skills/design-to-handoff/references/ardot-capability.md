# Ardot：宿主可行性与接入依据

核对日期：2026-10-31。结论：Ardot 可作为直接写入分层设计的第二交付平台，优先走官方云端 MCP，无需本机安装 Ardot，也无需先上传 Figma。官方明确列出的宿主有接入依据；其他宿主需具备远程 HTTP MCP、OAuth 及工具调用能力。协议兼容与文档接入说明不等于逐宿主端到端上传已通过。

## 宿主评估

| 宿主 | 证据与判断 | 执行条件 / 未验证项 |
|---|---|---|
| WorkBuddy | Ardot 官方提供自定义连接器、HTTP MCP、信任和 OAuth 步骤，可接入 | 已声明时优先宿主连接卡片；无受管候选时走官方自定义连接器，不能直接放弃 |
| CodeBuddy Code CLI | Ardot 官方提供 CLI 接入命令，可接入 | 验证当前 CLI 版本、认证后实际工具及文件权限 |
| Claude Code | Ardot 官方提供 CLI 接入命令，可接入 | 验证 OAuth、工具刷新及写入权限 |
| Codex CLI | Ardot 官方提供接入命令，可接入 | 桌面/托管会话仍要检查实际连接入口与工具可见性，不能把 CLI 文档当成所有界面均已实测 |
| Cursor | Ardot 官方提供设置与配置示例，可接入 | 当前版本须支持该远程 MCP 和 OAuth |
| OpenCode | 宿主官方支持 remote MCP 与 OAuth，协议层面可行 | Ardot 未单列实测；核对当前版本配置结构并验证 OAuth、tools/list、实际写入 |
| CodeBuddy IDE/插件 | 不能由同品牌 CLI 支持推定插件也已通过 | 检查当前插件是否支持远程 HTTP MCP + OAuth；只有本地 stdio 或只读连接不够，需补齐宿主能力 |

所有宿主最终都要验证：服务可达 → OAuth/信任完成 → 实际工具可发现 → 文件可创建或浏览器可创建 → 原生图层可写 → 远端读回与渲染通过。缺失某一步记录准确状态，不把“支持安装 skill”当作上传能力。

## 配置适配

这些是维护时核对的官方示例，执行前先检查当前宿主、版本、已有配置及 CLI 帮助。只操作用户选择的宿主和 Ardot 服务，不批量改全部智能体，不覆盖其他 MCP。配置成功后用宿主的重连/刷新机制加载，并启动正式 OAuth；不能仅写完配置就宣称已连接。

| 宿主 | 官方接入方式 |
|---|---|
| CodeBuddy Code | `codebuddy mcp add ardot-remote --transport http https://ardot.tencent.com/mcp --scope user` |
| Claude Code | `claude mcp add ardot-remote --transport http https://ardot.tencent.com/mcp --scope user` |
| Codex CLI | `codex mcp add ardot-remote --url https://ardot.tencent.com/mcp` |
| WorkBuddy / Cursor | 正式 MCP 设置，合并 HTTP 服务条目；不拿配置示例名冒充已声明服务 |
| OpenCode | 按当前版本的 remote MCP 配置及 `opencode mcp auth <实际服务名>`；不要直接照搬 mcpServers schema |

WorkBuddy / Cursor 的 Ardot 官方示例：

```json
{
  "mcpServers": {
    "ardot-remote": {
      "type": "http",
      "url": "https://ardot.tencent.com/mcp"
    }
  }
}
```

OpenCode 的旧版配置在 `mcp` 下直接放服务条目，V2 改为 `mcp.servers`，类型为 `remote`。先识别版本，不能把某一版本配置通用于所有宿主。需要宿主重载才能暴露工具时说明具体恢复动作，保留已验收设计及非敏感继续点。

## 能力与限制

- 官方说明支持创建文件、创建/修改 Frame、文本、组件实例、布局和样式、读写变量及导出资源。具体工具名与参数以运行时契约为准，不维护猜测的 API 列表。
- 云端无需客户端，通过真实文件/节点链接定位；本地 MCP 才依赖客户端活动文件。不要混用两套前提。
- 需可编辑及以上权限才可写画布。核对时云端限时免费，单用户每分钟 20 次、每日 600 次，后续商业化；额度与价格在执行时重新核对，不把它宣传为永久免费。
- 本次未对任何宿主进行真实账号授权、文件创建、图层写入或多人查看测试。当前会话没有 Ardot 连接不影响官方可行性判断，也不构成已接通的证据。

## 来源

- [Ardot 官方 MCP 简介](https://docs.ardot.tencent.com/ardot-mcp/introduction.html)
- [各宿主云端接入与创建文件示例](https://docs.ardot.tencent.com/ardot-mcp/remote-mcp.html)
- [云端与本地区别](https://docs.ardot.tencent.com/ardot-mcp/installation.html)
- [权限、限流与计费](https://docs.ardot.tencent.com/ardot-mcp/permissions-billing.html)
- [OpenCode MCP 与 OAuth](https://opencode.ai/docs/en/mcp-servers/)
- [OpenCode V2 MCP 配置](https://opencode.ai/v2/docs/mcp-servers)
