# Design to Handoff

通过分步访谈，把需求文档与补充说明整理成设计文档，生成可检查元素属性的分层界面，并按选择交付到 Figma 或 Penpot。

包含 1 个主 skill 和 6 个子 skill。安装后，AI 按阶段加载子 skill，不创建额外聊天或并发代理。

## 一条命令安装到 Codex

需要 Node.js/npm 和可访问 GitHub 的网络。下面使用已测试的 skills CLI 版本：

```sh
npx --yes skills@1.7.4 add Blank-Tea/design-to-handoff --skill '*' --agent codex --global --copy --yes
```

必须安装全部 7 个 skill，主入口会通过同级路径加载子 skill。不要只安装 design-to-handoff，也不要用 `--all` 替代：部分 CLI 版本的 `--all` 会同时安装到所有 AI 客户端。

只安装到当前项目，去掉 `--global`：

```sh
npx --yes skills@1.7.4 add Blank-Tea/design-to-handoff --skill '*' --agent codex --copy --yes
```

刷新技能列表或开始下一轮聊天；如果仍未发现，重新打开 Codex。使用：

```text
请使用 $design-to-handoff，按阶段向我提问，最后生成可查看元素标注的设计稿。
```

安装只放置技能说明和验收脚本，不替你安装/授权 Figma 或 Penpot MCP，不含任何作者账号或密钥。每位使用者使用自己的账号，在平台选择阶段连接。无需作者电脑上的路径、配置或文件。

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

重新执行同一安装命令可安装仓库当前版本；安装器可能覆盖这 7 个同名 skill 中的个人改动，修改前请保留副本。

卸载时只移除本包 skill，保留其他技能：

```sh
npx --yes skills@1.7.4 remove --skill design-to-handoff design-intake design-direction design-reference-analysis design-compose design-publish-figma design-publish-penpot --agent codex --global --yes
```

项目安装的卸载命令不带 `--global`。

## 维护者校验

```sh
python3 -m pip install -r requirements-dev.txt
python3 scripts/verify_bundle.py
python3 tests/test_delivery.py
```

交付验收脚本自身只依赖 Python 标准库；PyYAML 仅用于维护技能包元信息。

分发方式参考 [skills CLI](https://github.com/vercel-labs/skills)。本仓库不是 Figma、Penpot 或 OpenAI 官方发布的技能。
