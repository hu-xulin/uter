# UTER DESIGN SYSTEM 7.0 — 视觉回归与无障碍验证报告

> 生成时间 2026-11-15T23:50:13.131Z · 由 `registry/finalize.mjs` 从真实运行日志派生
> **范围口径**：本报告只覆盖 7.0 Design Showcase 的自动化视觉 / 无障碍验证，**不等于** Phase 8 全站真实产品页面视觉回归。

## 1. 执行环境与真实命令

| 项目 | 实测值 |
|---|---|
| 渲染引擎 | `Playwright Chromium (headless)`（headless） |
| 视觉命令 | `node docs/design-system/registry/visual-check.mjs` · EXIT=0 |
| 无障碍引擎 | `axe-core (WCAG 2.0/2.1/2.2 A+AA) + real keyboard Tab` |
| 无障碍命令 | `node docs/design-system/registry/a11y-check.mjs` · EXIT=0 |
| 视觉日志 | `web/visual-regression/uds7/run-log.json` · verdict `PASS` |
| 无障碍日志 | `web/visual-regression/uds7/a11y-log.json` · verdict `PASS` |
| 单元测试 | `bun run test` · EXIT=0 |
| 构建校验 | `bun run build:check` · EXIT=0 |
| 校对对象 | `docs/design-system/SHOWCASE-7.0.html`（936026 字符） |

## 2. 四个真实渲染场景

| 主题 | 视口 | 分辨率 | 模块 | 小节 | Token 行 | 语言示例 | console error | 截图 |
|---|---|---|---|---|---|---|---|---|
| light | desktop | 1440×900 | 38 | 418 | 878 | 18 | 0 | web/visual-regression/uds7/screenshots/uds7-light-desktop.png |
| dark | desktop | 1440×900 | 38 | 418 | 878 | 18 | 0 | web/visual-regression/uds7/screenshots/uds7-dark-desktop.png |
| light | mobile | 390×844 | 38 | 418 | 878 | 18 | 0 | web/visual-regression/uds7/screenshots/uds7-light-mobile.png |
| dark | mobile | 390×844 | 38 | 418 | 878 | 18 | 0 | web/visual-regression/uds7/screenshots/uds7-dark-mobile.png |

- 视觉验证覆盖：模块数 38、小节数 418、语言数 12、Token 行 748、`prefers-reduced-motion` 规则存在、Light/Dark 计算样式必须不同。
- consoleErrors 合计 **0**。
- 截图清单（真实文件，非示意）：

- `web/visual-regression/uds7/screenshots/uds7-dark-desktop.png` · 236522 bytes
- `web/visual-regression/uds7/screenshots/uds7-dark-mobile.png` · 83936 bytes
- `web/visual-regression/uds7/screenshots/uds7-light-desktop.png` · 233566 bytes
- `web/visual-regression/uds7/screenshots/uds7-light-mobile.png` · 82437 bytes

## 3. Light / Dark 计算样式差异（真实 getComputedStyle）



- 该项验证主题切换不是「只换 class、值不变」的假实现；全部 0 项 changed=true。

## 4. axe-core 无障碍扫描

| 主题 | 视口 | 分辨率 | violations | 键盘焦点可见 | 结果 |
|---|---|---|---|---|---|
| light | desktop | 1440×900 | 0 | 12/12 | PASS |
| dark | desktop | 1440×900 | 0 | 12/12 | PASS |
| light | mobile | 390×844 | 0 | 12/12 | PASS |
| dark | mobile | 390×844 | 0 | 12/12 | PASS |

- 规则集：`wcag2a / wcag2aa / wcag21a / wcag21aa / wcag22aa`。
- 键盘焦点使用真实 `page.keyboard.press("Tab")` 逐次推进（不是 JS `.focus()`，后者不会触发 `:focus-visible`），每场景检查 12 个可聚焦元素，判定 `outlineWidth >= 2px`。
- violationsTotal **0**、blocking **0**、focusOk **undefined**。

### 4.1 由 axe 真实扫描驱动的两处修复（已落实到 Showcase）

1. Dark 下 Primary / Destructive 按钮曾以品牌浅化档 `#8B8DF5` 作底，白字约 2.8:1。改为主题无关实底 `--ds-color-brand-solid` / `--ds-color-status-danger-solid`，白字实测 5.01:1。
2. 代码行号 / 默认前景对比度不足。`--ds-color-code-gutter` 由 `#94A3B8 / #64748B` 调整为 `#5B6779 / #94A3B8`，实测 Light 5.39:1 / Dark 7.11:1。

## 5. 对比度数值验证（与本报告同源引擎）

| 项目 | Light | Dark | 阈值 | 结果 |
|---|---|---|---|---|
| 品牌渐变 1001 点 × 7 背景最差 | 5.99:1 | 8.37:1 | ≥4.5 | PASS |
| 历史渐变最差（对照） | 2.27:1 | 3.92:1 | ≥4.5 | FAIL（故注销 E28） |
| 20 个 syntax Token 最低 | 4.55:1 | 5.07:1 | ≥4.5 | PASS |
| 品牌实底白字最低 | 5.01:1 | 5.01:1 | ≥4.5 | PASS |
| 代码行号 | 5.39:1 | 7.11:1 | ≥4.5 | PASS |
| 代码默认前景 | 16.77:1 | 14.79:1 | ≥4.5 | PASS |

- 引擎 verdict：**PASS**。完整 1001 点 × 7 背景采样、20×2 syntax 表、8×2 文字/状态色表见 `CONTRAST-VERIFICATION-REPORT.md`。
- 公式：`(L_hi + 0.05) / (L_lo + 0.05), sRGB linearized at 0.04045`；采样：`linear-gradient(90deg in srgb), sRGB channel interpolation, 1001 points (0..100 step 0.1) + all gradient stops`。

## 6. 构建产物验证

- `web/dist/design-system/7.0.html` · exists=true · 998429 bytes
- `web/dist/design-system/7.0/index.html` · exists=true · 998429 bytes

- 说明：`web/dist` 被 `web/.gitignore:11` 忽略，不进提交；此项只证明 `build:check` 后 7.0 页面确实进入产物。

## 7. 明确未覆盖（不得写成已验证）

| 未覆盖项 | 原因 | 解除条件 |
|---|---|---|
| 全站真实产品页面像素级视觉回归 | Phase 6 全站迁移尚未执行；用户视觉审核未通过 | Phase 5 审核通过 + Phase 6 迁移完成 |
| 跨浏览器 / 跨引擎（WebKit、Firefox） | 本轮只用 Playwright Chromium | Phase 8 扩展矩阵 |
| `forced-colors` 高对比度模式、字体子像素抗锯齿差异 | 自动化脚本未覆盖 | Phase 8 人工 + 专项用例 |
| 真实叠加背景上的渐变文字 | Showcase 用固定 canvas/surface/code-bg | 真实页面迁移后复测 |
| 视觉基线快照 diff 冻结 | 7.0.0 视觉基线须用户审核后才冻结 | Phase 5 用户确认 |

## 8. 结论

- 7.0 **Showcase 范围内**视觉回归与无障碍验证：**PASS**（4 场景 × 2 类检查，0 console error、0 violations、焦点全可见）。
- 7.0 **全站范围内**视觉回归：**未执行、未验证**，不得标 `FULLY_VERIFIED`。
- 当前总体状态保持 `ACCEPTANCE_READY`，用户审核前不得标 `ACCEPTED`。

---

*证据文件：`GATE-EVIDENCE.json` · 重新生成：`node docs/design-system/registry/finalize.mjs`*
