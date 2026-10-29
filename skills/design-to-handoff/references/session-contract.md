# 会话记录与文档

用于阶段衔接，不是用户表单。未选择本地保存时放会话内，选择保存可写 delivery/session.json。不写入凭证或含密钥 URL。

- project / stage：项目名、当前阶段。
- sources：来源 ID、类型（必填需求/可选补充）、实际文件/链接、版本、读取状态与原因；分别记录需求题 pending/provided/invalid 与补充题 pending/provided/skipped，不能将补充 skipped 当成需求已提供。
- requirements：稳定 REQ-001 等 ID、描述、来源定位、明确或假设。
- views：稳定 viewId（页面+状态+终端）、关联需求、内容和必要交互。
- conflicts / assumptions：冲突及影响、已说明的假设。
- direction：每项具体数值及 user / recommendation / reference 来源。
- references：结论、证据、实测/估计、是否采纳。
- localSave：是否保留、用户目录。
- platforms / deliveries：平台选择，各自目标、节点 ID、阶段、验证及链接。

## 正式设计文档

先展示浓缩需求；设计方向与参考确定后生成正式文档：
1. 目标、用户、终端、范围、需求来源。
2. 页面状态、入口、主要行为、成功和异常走向。
3. 字体、配色、间距、栅格、圆角、组件与素材。
4. 页面布局、真实文案、交互、权限和响应式。
5. REQ 到 viewId 的覆盖表、假设、未决项及验收标准。

## 用户选择本地保存时

项目子目录包含 design-brief.md、design-spec.md、tokens.json、
screens/（HTML/CSS）、assets/、previews/、
delivery/（会话、各平台验收证据和 verification.md）。

不复制原始私人文档，除非用户要求。截图仅作预览，远端图层和查看权限是在线验收对象。
