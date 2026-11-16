# UTER DESIGN SYSTEM 8.0.0 — 对比度验证报告

> 生成时间 2026-11-16T03:32:38.176Z · 计算引擎 `registry/contrast-engine.mjs` · 标准 WCAG 2.2 AA
> 公式 `(L_hi + 0.05) / (L_lo + 0.05), sRGB linearized at 0.04045` · 采样 `linear-gradient(90deg in srgb), sRGB channel interpolation, 1001 points (0..100 step 0.1) + all gradient stops`
> **总判定：`PASS`**

本报告的每一个数字都由 `contrast-engine.mjs` 真实计算得出，不是估算或声明。禁止其它脚本另写一套对比度公式。

## 1. 阈值

| 类型 | 阈值 |
|---|---|
| 普通文字 | ≥4.5:1 |
| 大号文字（≥24px 或 ≥18.66px bold） | ≥3:1 |
| 非文本（UI 组件边界 / 状态指示） | ≥3:1 |

7.0 渐变按更严格的 **4.5:1** 冻结，因此不存在字号例外。

## 2. 测试背景（7 种真实文字背景 · 取值来自 TOKEN-MANIFEST.json）

| 主题 | canvas | surface | raised | sunken | overlay | hero-glow | code-bg |
|---|---|---|---|---|---|---|---|
| Light | `#F8FAFC` | `#FFFFFF` | `#FFFFFF` | `#F1F5F9` | `#FFFFFF` | `#EEF2FF` | `#F6F8FA` |
| Dark | `#0B1120` | `#111827` | `#1B2436` | `#080D18` | `#1B2436` | `#131C33` | `#0E1524` |

CSS 唯一出口为 `linear-gradient(90deg in srgb, ...)`，插值空间与本引擎一致。

## 3. 品牌渐变（1001 点 / 主题，含全部插值与停靠点）

| 主题 | 起点 | 中点 | 终点 | 基线最差 | 冻结最差 | 历史实现最差 | 结果 |
|---|---|---|---|---|---|---|---|
| Light | `#1D4ED8` | `#6D28D9` | `#7E22CE` | 5.99:1 | **5.99:1** | 2.27:1 | `PASS` |
| Dark | `#93C5FD` | `#C4B5FD` | `#D8B4FE` | 8.37:1 | **8.37:1** | 3.92:1 | `PASS` |

- 最差点位置：Light `hero-glow` @ 0%；Dark `raised` @ 45.400000000000375%
- 基线调整次数：Light 0 / Dark 0（0 表示建议基线无需调整即达标）
- 历史实现 `#60A5FA → #A78BFA → #A855F7` 在 Light 仅 2.27:1、Dark 3.92:1，**均不满足 4.5:1**；3.0 的 E28 低对比度例外在 7.0 失去依据，登记为 `REVOKE_AFTER_MIGRATION`
- 优化算法（如触发）：保持 HSL 色相 / 饱和度，按 0.005 步长调整明度，最多 200 次迭代，轨迹写入引擎输出

### 3.1 Light 采样（每 10% 摘录；完整 1001 点 × 7 背景见 audit/gradient-validation.json 与 Showcase 渐变背景矩阵）

| 位置 | 色值 | canvas | surface | code-bg |
|---|---|---|---|---|
| 0% | `#1D4ED8` | 6.41:1 | 6.7:1 | 6.3:1 |

### 3.2 Dark 采样（每 10% 摘录）

| 位置 | 色值 | canvas | surface | code-bg |
|---|---|---|---|---|
| 0% | `#93C5FD` | 10.44:1 | 9.84:1 | 10.11:1 |

## 4. 语法高亮 20 Token × 2 主题

代码背景：Light `#F6F8FA` / Dark `#0E1524`。全部在**真实代码背景**上逐值计算，不只看色板。

| 主题 | Token 数 | 通过 | 失败 | 最低对比度 |
|---|---|---|---|---|
| Light | 20 | 20 | 0 | **4.55:1** |
| Dark | 20 | 20 | 0 | **5.07:1** |

| Token | Light 值 | 对比度 | Dark 值 | 对比度 |
|---|---|---|---|---|
| `syntax-keyword` | `#0000FF` | 8.07:1 | `#569CD6` | 6.19:1 |
| `syntax-string` | `#A31515` | 7.37:1 | `#CE9178` | 6.9:1 |
| `syntax-number` | `#098255` | 4.55:1 | `#B5CEA8` | 10.73:1 |
| `syntax-function` | `#795E26` | 5.73:1 | `#DCDCAA` | 12.91:1 |
| `syntax-property` | `#001080` | 14.23:1 | `#9CDCFE` | 12.23:1 |
| `syntax-variable` | `#001080` | 14.23:1 | `#9CDCFE` | 12.23:1 |
| `syntax-type` | `#257B94` | 4.55:1 | `#4EC9B0` | 8.95:1 |
| `syntax-operator` | `#000000` | 19.73:1 | `#D4D4D4` | 12.3:1 |
| `syntax-punctuation` | `#000000` | 19.73:1 | `#D4D4D4` | 12.3:1 |
| `syntax-comment` | `#008000` | 4.83:1 | `#6A9955` | 5.47:1 |
| `syntax-constant` | `#0070C1` | 4.83:1 | `#4FC1FF` | 9.04:1 |
| `syntax-boolean` | `#0000FF` | 8.07:1 | `#569CD6` | 6.19:1 |
| `syntax-null` | `#0000FF` | 8.07:1 | `#569CD6` | 6.19:1 |
| `syntax-tag` | `#800000` | 10.29:1 | `#569CD6` | 6.19:1 |
| `syntax-attribute` | `#E50000` | 4.55:1 | `#9CDCFE` | 12.23:1 |
| `syntax-regexp` | `#811F3F` | 8.96:1 | `#D16969` | 5.16:1 |
| `syntax-builtin` | `#257B94` | 4.55:1 | `#4EC9B0` | 8.95:1 |
| `syntax-inserted` | `#098255` | 4.55:1 | `#B5CEA8` | 10.73:1 |
| `syntax-deleted` | `#A31515` | 7.37:1 | `#CE9178` | 6.9:1 |
| `syntax-invalid` | `#CD3131` | 4.84:1 | `#F44747` | 5.07:1 |

## 5. 基础文字 / 状态色（canvas + surface 双背景）

| 主题 | Token 数 | 通过 | 失败 |
|---|---|---|---|
| Light | 8 | 8 | 0 |
| Dark | 8 | 8 | 0 |

| Token | Light 值 | canvas | surface | Dark 值 | canvas | surface |
|---|---|---|---|---|---|---|
| `text-primary` | `#0F172A` | 17.06:1 | 17.85:1 | `#F1F5F9` | 17.19:1 | 16.19:1 |
| `text-secondary` | `#5B6779` | 5.48:1 | 5.74:1 | `#94A3B8` | 7.34:1 | 6.92:1 |
| `text-muted` | `#5B6779` | 5.48:1 | 5.74:1 | `#94A3B8` | 7.34:1 | 6.92:1 |
| `status-success` | `#15803D` | 4.79:1 | 5.02:1 | `#6EE7B7` | 12.35:1 | 11.64:1 |
| `status-warning` | `#A54600` | 5.77:1 | 6.04:1 | `#FCD34D` | 13.06:1 | 12.3:1 |
| `status-danger` | `#B91C1C` | 6.18:1 | 6.47:1 | `#FCA5A5` | 9.92:1 | 9.35:1 |
| `status-info` | `#1D4ED8` | 6.41:1 | 6.7:1 | `#93C5FD` | 10.44:1 | 9.84:1 |
| `code-foreground` | `#0F172A` | 17.06:1 | 17.85:1 | `#E2E8F0` | 15.27:1 | 14.39:1 |

## 6. 品牌实底按钮（白字三态）

| 状态 | 背景 | 前景 | 对比度 |
|---|---|---|---|
| default | `#5B5EE6` | `#FFFFFF` | 5.01:1 |
| hover | `#494CC7` | `#FFFFFF` | 6.68:1 |
| active | `#3F42B0` | `#FFFFFF` | 8.02:1 |
| danger | `#B91C1C` | `#FFFFFF` | 6.47:1 |

Light / Dark 统一使用同一品牌实底，避免 Dark 下浅色品牌底导致白字失效。这也是 axe-core 真实扫描发现的缺陷修复：Dark 下若用品牌浅化档 `#8B8DF5` 做按钮底，白字仅约 2.8:1，不达 4.5:1；因此新增 `--ds-color-brand-solid` / `--ds-color-status-danger-solid` 两个主题无关实底 Token。

## 6.1 代码块行号 / 默认前景（axe color-contrast 依据）

| 主题 | 代码背景 | Token | 色值 | 对比度 | 结果 |
|---|---|---|---|---|---|
| Light | `#F6F8FA` | `code-gutter` | `#5B6779` | 5.39:1 | PASS |
| Light | `#F6F8FA` | `code-foreground` | `#0F172A` | 16.77:1 | PASS |
| Dark | `#0E1524` | `code-gutter` | `#94A3B8` | 7.11:1 | PASS |
| Dark | `#0E1524` | `code-foreground` | `#E2E8F0` | 14.79:1 | PASS |

## 6.2 相对初始基线的数值调整记录（PART 0.4 要求记录最终值与验证结果）

| 项目 | 初始值 | 最终值 | 调整原因 | 验证 |
|---|---|---|---|---|
| `--ds-color-chart-3` | `#7C3AED` / `#A78BFA` | `#9333EA` / `#C084FC` | 与 `--ds-syntax-keyword` Light 色值撞车，违反「图表色不得作为语法色」 | C13 检查器 0 交叉 |
| `--ds-color-chart-1..12` | 初版 5+7 色（chart-1..5 见左行历史） | v5 搜索定稿 12 色（Light minAll 10.50 / Dark 10.51） | 初版色板在 CVD 模拟下最小 ΔE00 仅 0.27，不达 §4.5；v5 以 CIEDE2000 >= 10（正常 + 三类色觉缺陷）+ canvas >= 3.2:1 + 色度下限搜索定稿，并接入真实图表运行时 | C-A04 / C-R09 双主题 PASS + resolveUds6ChartPalette 真实消费 |
| `--ds-color-code-gutter` | `#94A3B8` / `#64748B` | `#5B6779` / `#94A3B8` | axe `color-contrast` 实测行号不达 4.5:1 | 引擎 §6.1 + axe 0 violations |
| `--ds-color-brand-solid` | 无（新增） | `#5B5EE6`（主题无关） | Dark 下白字按钮对比度不足 | 引擎 §6 + axe 0 violations |
| `--ds-color-status-danger-solid` | 无（新增） | `#B91C1C`（主题无关） | 同上 | 引擎 §6 + axe 0 violations |
| 渐变三档 | 文档建议基线 | 未调整 | 1001 点采样已全部 ≥4.5:1 | 引擎 §3 |

## 7. 结论与未覆盖项

- **已验证**：渐变 1001 点 × 2 主题、20 × 2 语法 Token、8 × 2 文字 / 状态色、4 × 2 品牌 / 危险实底、2 × 2 代码前景，共 2070 个对比度数据点，全部 ≥4.5:1；另有 axe-core 在 4 个真实渲染场景下的 0 violations 佐证。
- **未验证（不得标 VERIFIED）**：真实浏览器渲染下的子像素抗锯齿、字体渲染差异、高对比度模式 (`forced-colors`)、真实产品页面上的实际叠加背景。这些需要 Phase 8 的真实页面视觉回归。
- **例外**：仅 `--ds-color-text-disabled` 属于 WCAG 1.4.3 禁用控件豁免，已登记 `EX-001`。

---

*重新生成：`node docs/design-system/registry/build.mjs`*
