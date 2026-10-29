---
name: uter-design-spec
description: 依据 uter 设计规范（权威文档 /Users/lincolnhu/uter/_reports/uter-design-system-latest.md）审计并落地前端界面——字号阶梯、字体家族、语义色 Token、圆角/描边/投影、动效、图标、焦点与无障碍、组件排版。当用户说「审计设计规范」「检查 UI 是否符合设计规范」「字号/字体/颜色不对」「改完有没有违反设计规范」「按设计系统核对」时使用。含四层标题阶梯硬规则、禁止自定义 text-* token、品牌色 #5B5EE6、语义色分层、单焦点环等可复现检测命令。
agent_created: true
---

# uter 设计规范审计与落地

目标：让前端改动**可验证地**符合 uter 设计规范（Design System）。结论必须落到「文件:行 + 违反哪条规则 + 应改成什么」。

## 一、权威来源（唯一真源）

- 设计规范全文：`/Users/lincolnhu/uter/_reports/uter-design-system-latest.md`。
- 本 Skill 的可机检清单：`references/design-system-spec.md`（提炼自上述文档，覆盖字体/颜色/形状/描边/投影/动效/图标/无障碍/组件排版/布局的硬规则与 Token 表）。
- **该文档更新后优先重读原文**，不要凭本 Skill 记忆判违例；权威以文档为准。
- 代码侧真源：Design Token 来自 `web/src/styles/theme.css` 的 `--text-*` 等；新规范建议的 Token 分层见文档 §三。改动优先复用既有 `--text-*` 变量，**不要另建 `--font-size-*`/`--typography-*` 重叠体系**。

## 二、触发场景

- 改完前端，要求「确认是否符合设计规范 / 有没有违反字号/字体/颜色规范」。
- PR 评审阶段，对 `web/src/**`、`docs-web/**` 做规范体检。
- 「字太小/字距诡异/某页字号不一致/颜色写死/投影乱加/图标太细」类报告。
- 新增页面或组件，想知道「该用哪个字号档位 / 哪个语义色 Token」。

## 三、先查这 5 类高频违规

1. **自定义 `text-*` 命名 token**（如 `text-uk-*`）—— 会被 `tailwind-merge` 误判吞色。改用 `theme.css` 标准类，或任意值 `text-[<带单位>]`（如 13px 代码步用 `text-[0.8125rem]`）。
2. **字号越界**：`<12px`；或乱用 `text-xl`(20px) 当弹窗标题（阶梯只允许 30/24/18/16）。
3. **标题档位错配**：16/600 只作 `group-title`；`text-sm font-semibold` 不能当标题；`Label` 上加 `text-xs` 违规；卡片/区块同行的汇总值（`总计：$0.03`、`共 181 条`）须 `body-sm` 14px 而非 12px。
4. **硬编码十六进制颜色**（尤其 `#5B5EE6` 当正文色）—— 必须走语义 Token（`text-primary` 等）。
5. **描边/投影/图标**：描边出现小数（1.5px）、容器用 2px 描边；非浮层元素加阴影；图标用 1px 描边（应 2px）。

## 四、可复现检测命令

```bash
cd /Users/lincolnhu/uter
# 1) 自定义命名 text token（命中即违规，带单位的任意值除外）
grep -rnE 'text-[a-z][a-z0-9-]+-[a-z0-9]+' web/src --include='*.tsx' --include='*.ts' | grep -vE 'text-\[(0|0\.|1)'
# 2) 小于 12px 的任意值字号
grep -rnE 'text-\[([0-9]|1[01])px\]' web/src --include='*.tsx'
# 3) 残留字距（基线要求移除）
grep -rnE 'tracking-(tight|normal|wide|wider|widest|[0-9])' web/src --include='*.tsx'
# 4) 组件中硬编码品牌/十六进制色（应改用语义 Token）
grep -rnE '#5B5EE6|#5b5ee6|#[0-9a-fA-F]{6}' web/src --include='*.tsx' | grep -vE 'logo|favicon|svg'
# 5) 图标描边疑似 1px / 非 2px
grep -rnE 'strokeWidth=\{1\}|stroke-width="1"' web/src --include='*.tsx'
# 6) 非浮层元素加阴影（card/table/sidebar/button 等不应有 shadow）
grep -rnE 'shadow-(sm|md|lg|xl|2xl)' web/src --include='*.tsx' | grep -vE 'Dialog|Sheet|Drawer|Popover|Toast|Hover'
```

## 五、组件排版速查（详见 references §8）

| 组件 | 字号/字重 | 关键约束 |
|---|---|---|
| Button | label 14/500 | 尺寸 md36/sm32/lg40；`inline` 退文本行盒、`wrap` 内容高度 |
| Input / Textarea | 内容 14（全平台统一，无 16 例外）；标签 label | placeholder 用 muted-foreground |
| Label | label 14/500 | 永不加 `text-xs` |
| Badge | caption 12/400 | 取对应 -foreground |
| Card / Dialog | 标题 h3 18/600 | Dialog 宽约 420px、投影 overlay |
| Table | 表头 label；单元格 body-sm | 行高约 48px、数值右对齐 |
| Sidebar | 菜单项 label；分组标题 caption | 选中 `bg-primary-subtle` + `text-sidebar-active-foreground`（非 `text-primary`，对比度 4.44→4.93:1） |
| Model Card | 标题 mono-title 16/600；描述 body-sm 14 | 描述不用 16px（与标题抢层级） |

## 六、已知冻结偏差（审计勿误判为违规，亦需对照新规范复核）

新规范 14/16 基准与以下冻结态兼容，但**新增改动一律按新规范**：

- 四界面放大（home / dashboard / pricing / rankings）：`text-xs→text-sm`、`text-sm→text-base`（与规范 14/16 兼容）。
- 顶栏 6 链接 16px、登录/注册 16px、语言/主题下拉 16px、通知弹层 14/16、docs 导航 14px。
- 品牌色已是彩色 `#FC0/#F60/#C00` 体系（2026-10-22 起），与新规范的 `#5B5EE6` 紫蓝品牌色**存在张力**——以设计规范文档的 `#5B5EE6` 为准推进统一，旧彩色 logo 的迁移按文档落地顺序执行。

## 七、前端改动自检（重建前先跑）

```bash
cd /Users/lincolnhu/uter/web
./node_modules/.bin/tsgo -b                                   # 类型门禁（不带 --force 缓存误报 0 错误）
./node_modules/.bin/oxlint -c .oxlintrc.json <改动文件...>      # 务必定向！全项目有存量噪音
./node_modules/.bin/oxfmt -c .oxfmtrc.json --check <改动文件...>
./node_modules/.bin/vitest run <改动目录>
```

## 八、输出报告

结论优先：违规级别表（阻塞/建议）→ 每条 `文件:行` + 违反规则编号（references §1–§9）+ 应改成的具体类/值 → 已核对无问题的清单（避免下轮重复审）→ 修复顺序 → 验证命令。报告落 `~/Downloads/Uter/设计规范审计-YYYY-MM-DD.md`。
