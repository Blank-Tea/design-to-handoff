# 交付验收证据

## 六项检查

每个实际上传平台单独记录，不能共用一份通过结果：
- coverage：需求中的页面、状态与终端都对应正确画板。
- native_layers：文字为可编辑文字，按钮/卡片有独立容器，无整页 UI 栅格。
- properties：远端实际读回文字与容器样式，与规范比较，并说明有损转换。
- visual：最终远端画板整体构图无截断、错字、重叠和素材丢失。
- viewer_access：第二个免费、仅查看账号能打开最终链接并检查元素。
- code_inspection：同一免费查看账号能测距、检查文字并复制样式片段。

检查结果为 passed / pending / failed，passed 必须有说明证据；不能将“官网说支持”填为本次实测证据。第二账号由用户自行登录或提供已授权的会话，不能借用或寻找别人的账号。

## JSON 格式

以下为格式说明，所有实际内容都必须从本次交付取得。占位值不能作为验收证据。每个 viewId 一条，示例只说明一个页面。
```json
{
  "schema_version": 1,
  "platform": "figma",
  "url": "https://www.figma.com/design/ACTUAL_KEY/ACTUAL_NAME",
  "expected_views": ["home-default-desktop"],
  "views": [{
    "id": "home-default-desktop",
    "root_id": "ACTUAL_NODE_ID",
    "native_layers": true,
    "full_ui_raster": false,
    "requires_text": true,
    "elements": [
      {
        "remote_id": "ACTUAL_TEXT_ID",
        "kind": "text",
        "editable": true,
        "properties": {
          "fontFamily": "Actual family",
          "fontSize": 16,
          "fontWeight": 400,
          "lineHeight": 24,
          "color": "#222222"
        }
      },
      {
        "remote_id": "ACTUAL_CONTAINER_ID",
        "kind": "container",
        "editable": true,
        "properties": {
          "width": 320,
          "height": 80,
          "radius": 8,
          "fill": "#ffffff",
          "spacing": {
            "padding": [16,16,16,16],
            "gap": 8,
            "source": "remote-readback"
          }
        }
      }
    ]
  }],
  "checks": {
    "coverage": {"status": "pending", "evidence": ""},
    "native_layers": {"status": "pending", "evidence": ""},
    "properties": {"status": "pending", "evidence": ""},
    "visual": {"status": "pending", "evidence": ""},
    "viewer_access": {"status": "pending", "evidence": ""},
    "code_inspection": {"status": "pending", "evidence": ""}
  }
}
```

元素列表记录代表性且足以覆盖实际组件类型的远端样本；文字层和容器都至少有一项，重要混合字体、错误状态不能只抽样默认标题。

无法读回 spacing 时将 source 写为 documented，补 note，说明远端哪些语义不受支持；properties 只能 pending，直到用实际测量或说明图层完成检查并记录。不能把源 CSS 的值标为 remote-readback。

脚本运行成功只代表记录在结构上完整且六项声称通过，输出 COMPLETE_RECORDED；它不独立访问网站、不鉴别截图真假、不证明用户行为。pending 返回退出码 2，格式错误/失败返回 1；自动流程须处理这些状态，不为得到 0 把 pending 改成 passed。
