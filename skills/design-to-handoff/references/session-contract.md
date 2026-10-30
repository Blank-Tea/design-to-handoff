# 会话记录与文档

用于阶段衔接，不是用户表单。未选择本地保存时放会话内，选择保存可写 delivery/session.json。不写入凭证或含密钥 URL。

- project / stage：项目名、当前阶段。
- sources：来源 ID、类型（必填需求/可选补充）、实际文件/链接、版本、读取状态与原因；分别记录需求题 pending/provided/invalid 与补充题 pending/provided/skipped，不能将补充 skipped 当成需求已提供。
- requirements：稳定 REQ-001 等 ID、描述、来源定位、明确或假设。
- views：稳定 viewId（页面+状态+终端）、关联需求、内容和必要交互。
- conflicts / assumptions：冲突及影响、已说明的假设。
- designContext：designMode、target 与 styleReference 的独立身份、context_ready/not_applicable/draft_only、相关 revision/摘要及读取时间、生成前的冲突取舍。
- direction：终端、用途和总体品牌气质及其来源。
- foundations：访谈模式（分组/全部推荐/指定少数；用户要求时可逐项）、当前 groupId、组内参数清单及各自 pending/answered/inherited/recommended/not_applicable、具体值/规则、来源定位、推荐授权事件、依赖重算和未决项；记录实际展示的组合建议与局部修改，区分本组跳过、单参数补问跳过和剩余推荐，不能只存整组已答来掩盖缺项。
- styleSpec：逻辑 projectId、specVersion/baseVersion、来源链接、适用模块/模式、token 与规则、局部例外、变更记录、文档/云端规范稳定 ID 和实际持久化/读回状态；结构见[项目规范约定](project-style-contract.md)。
- references：结论、证据、实测/估计、是否采纳。
- localSave：是否保留、用户目录。
- platforms / deliveries：平台选择；deliveryMode（new/append/update）；目标类型、账号/团队、projectId/fileId/pageId/nodeId 与真实链接。
- connection：每个平台的浏览器是否打开、awaiting_user/account_ready/target_ready 状态、用户完成事件、实际只读探测与可用写入路由；Penpot key 只记录“已配置/待配置”，不记录值或含凭证 URL。
- plannedChanges / baseline / createdIds：本次追加/更新范围、既有内容基线、成功节点与待补 viewId；用于防覆盖及中断续传。

## 正式设计文档

先展示浓缩需求；设计方向、参考及全局设计基础确定后生成正式文档。项目规范是正式文档的一部分，须按[项目规范约定](project-style-contract.md)完整记录并在上传后补齐真实链接与读回结果：
1. 目标、用户、终端、范围、需求来源。
2. 页面状态、入口、主要行为、成功和异常走向。
3. 项目身份/版本、全局设计基础决策表、完整 token/组件及交互规则、来源与适用范围、参考采纳、局部例外及变更记录；覆盖[基础目录](foundation-catalog.md)的全部适用维度。
4. 页面布局、真实文案、交互、权限和响应式。
5. REQ 到 viewId 的覆盖表、假设、未决项及验收标准。
6. 设计与规范的真实链接、应用版本、上传后差异和验证结果，下次同站扩展的读取入口。

## 用户选择本地保存时

项目子目录包含 design-brief.md、design-spec.md、tokens.json、
screens/（HTML/CSS）、assets/、previews/、
delivery/（会话、各平台验收证据和 verification.md）。

本地文档和 tokens 必须版本一致；上传后同步回写实际链接和验证结果。未选择本地保存时的云端/聊天交付按项目规范约定处理，不因此省略全局规范。

不复制原始私人文档，除非用户要求。截图仅作预览，远端图层和查看权限是在线验收对象。
