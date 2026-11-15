# VSCODE-COLOR-MAPPING — VS Code Light+ / Dark+ 官方映射与差异登记

> 唯一权威：`audit/vscode/vscode-{light_vs,light_plus,dark_vs,dark_plus}.json`（microsoft/vscode `main` 分支官方 JSONC 原文）。
> 证据哈希：`audit/vscode/SOURCE-METADATA.json`。提取器：`registry/vscode-theme.mjs`。
> 生成时间：2026-11-15T14:29:17.441Z · Git SHA：3f4eb0d7afd640471368c49bfa71d8383eb7740b

## 1. 官方主题链

- `Light+ (default light)` = `light_plus.json` → `include ./light_vs.json`，15 条 tokenColors + 4 条 semanticTokenColors。
- `Dark+ (default dark)` = `dark_plus.json` → `include ./dark_vs.json`，15 条 tokenColors + 4 条 semanticTokenColors。
- 官方编辑器背景：`editor.background` Light `#FFFFFF` / Dark `#1E1E1E`；前景 `#000000` / `#D4D4D4`。
- Uter 实际代码块背景：`#F6F8FA` / `#0E1524`（来自 `contrast-engine.mjs` BACKGROUNDS），因此必须另做落地对比度验证。

## 2. 20 类语法映射（⚠ = 与文档候选基线不一致；(adj) = 为达 WCAG AA 做的有限调整）

| 类别 | 官方 TextMate scope | 官方 Light | 官方 Dark | 文档基线 Light | 文档基线 Dark | Uter 采用 Light | Uter 采用 Dark | 在 Uter 代码块背景上的对比度 |
|---|---|---|---|---|---|---|---|---|
| keyword | keyword | #0000FF | #569CD6 | #0000FF | #569CD6 | #0000FF | #569CD6 | 8.07 / 6.19 |
| string | string | #A31515 | #CE9178 | #A31515 | #CE9178 | #A31515 | #CE9178 | 7.37 / 6.9 |
| number | constant.numeric | #098658 | #B5CEA8 | #087443 ⚠ | #B5CEA8 | #098255 (adj) | #B5CEA8 | 4.55 / 10.73 |
| function | entity.name.function | #795E26 | #DCDCAA | #795E26 | #DCDCAA | #795E26 | #DCDCAA | 5.73 / 12.91 |
| property | meta.object-literal.key | #001080 | #9CDCFE | #001080 | #9CDCFE | #001080 | #9CDCFE | 14.23 / 12.23 |
| variable | variable | #001080 | #9CDCFE | #001080 | #9CDCFE | #001080 | #9CDCFE | 14.23 / 12.23 |
| type | entity.name.type | #267F99 | #4EC9B0 | #1F6B80 ⚠ | #4EC9B0 | #257B94 (adj) | #4EC9B0 | 4.55 / 8.95 |
| operator | keyword.operator | #000000 | #D4D4D4 | #000000 | #D4D4D4 | #000000 | #D4D4D4 | 19.73 / 12.3 |
| punctuation | meta.template.expression | #000000 | #D4D4D4 | #000000 | #D4D4D4 | #000000 | #D4D4D4 | 19.73 / 12.3 |
| comment | comment | #008000 | #6A9955 | #008000 | #6A9955 | #008000 | #6A9955 | 4.83 / 5.47 |
| constant | variable.other.constant | #0070C1 | #4FC1FF | #0070C1 | #4FC1FF | #0070C1 | #4FC1FF | 4.83 / 9.04 |
| boolean | constant.language | #0000FF | #569CD6 | #0000FF | #569CD6 | #0000FF | #569CD6 | 8.07 / 6.19 |
| null | constant.language | #0000FF | #569CD6 | #0000FF | #569CD6 | #0000FF | #569CD6 | 8.07 / 6.19 |
| tag | entity.name.tag | #800000 | #569CD6 | #800000 | #569CD6 | #800000 | #569CD6 | 10.29 / 6.19 |
| attribute | entity.other.attribute-name | #E50000 | #9CDCFE | #FF0000 ⚠ | #9CDCFE | #E50000 | #9CDCFE | 4.55 / 12.23 |
| regexp | string.regexp | #811F3F | #D16969 | #811F3F | #D16969 | #811F3F | #D16969 | 8.96 / 5.16 |
| builtin | support.type | #267F99 | #4EC9B0 | #267F99 | #4EC9B0 | #257B94 (adj) | #4EC9B0 | 4.55 / 8.95 |
| inserted | markup.inserted | #098658 | #B5CEA8 | #008000 ⚠ | #89D185 ⚠ | #098255 (adj) | #B5CEA8 | 4.55 / 10.73 |
| deleted | markup.deleted | #A31515 | #CE9178 | #A31515 | #F48771 ⚠ | #A31515 | #CE9178 | 7.37 / 6.9 |
| invalid | invalid | #CD3131 | #F44747 | #A31515 ⚠ | #F48771 ⚠ | #CD3131 | #F44747 | 4.84 / 5.07 |

## 3. 与文档候选基线的差异（6 个类别 / 8 处主题取值）

| 类别 | 主题 | 文档候选 | VS Code 官方 | 裁决 |
|---|---|---|---|---|
| number | Light | #087443 | #098658 | 以官方为准 |
| type | Light | #1F6B80 | #267F99 | 以官方为准 |
| attribute | Light | #FF0000 | #E50000 | 以官方为准 |
| inserted | Light | #008000 | #098658 | 以官方为准 |
| inserted | Dark | #89D185 | #B5CEA8 | 以官方为准 |
| deleted | Dark | #F48771 | #CE9178 | 以官方为准 |
| invalid | Light | #A31515 | #CD3131 | 以官方为准 |
| invalid | Dark | #F48771 | #F44747 | 以官方为准 |

## 4. 有限调整记录（WCAG 2.2 AA ≥ 4.5:1）

| 类别 | 主题 | 官方原值 | 原对比度 | 采用值 | 新对比度 | 明度步数 | 原因 |
|---|---|---|---|---|---|---|---|
| number | Light | #098658 | 4.32:1 | #098255 | 4.55:1 | 3 | 落在 Uter code-bg #F6F8FA 上低于 4.5 |
| type | Light | #267F99 | 4.31:1 | #257B94 | 4.55:1 | 3 | 落在 Uter code-bg #F6F8FA 上低于 4.5 |
| builtin | Light | #267F99 | 4.31:1 | #257B94 | 4.55:1 | 3 | 落在 Uter code-bg #F6F8FA 上低于 4.5 |
| inserted | Light | #098658 | 4.32:1 | #098255 | 4.55:1 | 3 | 落在 Uter code-bg #F6F8FA 上低于 4.5 |

## 5. 官方作用域派生说明

- **keyword**：Light+ 另对 keyword.control 定义 #AF00DB（控制流关键字），Dark+ 对应 #C586C0；Uter 20 Token 不细分控制流，统一用 keyword 基色，差异已登记。
- **punctuation**：VS Code 官方无 punctuation 独立 tokenColor；使用 editor.foreground（meta.template.expression 的 reset 值与之相同）。
- **regexp**：VS Code 存在两套 regexp 作用域：constant.regexp（Light #811F3F / Dark #646695）与 string.regexp（Light 无独立 / Dark #D16969）。本规范采用 string.regexp 语义（正则字面量），Light 保留 constant.regexp 的 #811F3F。
- **builtin**：VS Code 官方无 builtin 独立 tokenColor；使用 support.type / entity.name.type 的类型色。

## 6. 官方编辑器与终端颜色（用于 §5.3 代码样式）

```json
{
  "editor": {
    "light": {
      "background": "#FFFFFF",
      "foreground": "#000000"
    },
    "dark": {
      "background": "#1E1E1E",
      "foreground": "#D4D4D4"
    }
  },
  "uterCodeBackground": {
    "light": "#F6F8FA",
    "dark": "#0E1524"
  },
  "wcagTarget": 4.5
}
```

## 7. 可复现命令

```bash
curl -fsSL https://raw.githubusercontent.com/microsoft/vscode/main/extensions/theme-defaults/themes/light_vs.json
node docs/design-system/registry/vscode-theme.mjs > /tmp/vscode-syntax.json
node docs/design-system/registry/generate-audit.mjs
```
