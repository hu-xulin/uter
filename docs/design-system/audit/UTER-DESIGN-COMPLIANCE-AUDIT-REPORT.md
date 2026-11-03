# UTER Design System 3.0 全项目设计合规审计报告

> 审计类型：全项目、全量、独立、证据驱动 · Audit Only（未修改任何被审计代码）
> 产物目录：`docs/design-system/audit/`（本报告 + `evidence/` 全部原始证据）

---

## A. 审计基本信息

| 项目 | 内容 |
|---|---|
| 审计 Commit SHA | `d74c092e50ac7782431725a25e3b9e725db6a159`（main） |
| 审计日期 | 2026-11-03 12:34–12:55 CST |
| 前端技术栈 | React 19.2 + Tailwind CSS 4.3（@theme）+ rsbuild 2.1 + TanStack Router，包管理 bun |
| 审计工具 | 静态：ripgrep/python3 自定义扫描、既有门禁（tsgo/check-design-tokens/vitest/verify-contrast）；浏览器：Playwright 1.64（chromium-1248）+ axe-core 4.10.2 |
| 执行环境 | 本机 dev server `http://127.0.0.1:3000`（rsbuild dev，已监听）+ 本地后端 3001 |
| 审计范围 | `web/` 全部路由/页面/组件/Token/主题；`docs-web` 仅盘点未深审（独立小应用）；浏览器渲染 + axe 自动化 |
| 基线未提交改动 | `VERSION`、9 份旧设计文档删除、`showcase-3.0.html` 新建（并行会话 WIP，审计期间未触碰） |

## B. 总体结论

**当前代码库未完全符合 UTER Design System 3.0，不允许整体验收**；但架构层（Token 三层、Tailwind v4 映射、门禁体系）与 3.0 同构，无 P0 阻断问题。主要缺口为：① 1 处 P1 文字对比度违规；② 3.0 已批准的视觉级迁移（字号刻度、焦点环 2px）尚未实施；③ 认证后页面视觉/无障碍审计被环境配置阻断。

- 是否存在阻断问题：**无 P0**；P1×1
- 未覆盖页面：认证后 27 组路由（Blocked，见 E）
- 未执行测试：全量 vitest 现状 6 FAIL（并行会话删除 showcase 旧文件所致，非本审计范围）

## C. 分项结果

| 审计维度 | 检查数量 | PASS | FAIL | PENDING | N/A |
|---|---:|---:|---:|---:|---:|
| Token | 32 项 | 24 | 4 | 3 | 1 |
| Code（静态扫描） | 12 类规则 | 11 | 1 | 0 | 0 |
| Components | 26 组件 | 25 | 1 | 0 | 0 |
| Pages（功能页面组） | 38 组 | 30 | 8 | 0 | 0 |
| Visual（浏览器） | 12 组截图 | 10 | 1 | 0 | 1（pricing 被门控） |
| Accessibility（axe 实测页面） | 12 页组 | 9 | 2 | 0 | 1 |
| Quality Gate | 7 项 | 5 | 1 | 1 | 0 |

数量均来自实际检查记录（evidence/01–08）。

## D. 问题清单

### P1（必须整改）

**AUDIT-001 · 浅色 tertiary-foreground 文字对比度不达标**
- 文件：`web/src/styles/theme.css:112`（定义）；使用点 `src/components/layout/components/footer.tsx:100,110,201,208`、`src/features/home/components/sections/hero.tsx:223,226`
- 违规代码：`--color-tertiary-foreground: color-mix(in oklch, var(--muted-foreground) 88%, var(--background))`
- 实测（axe，首页 light）：#758498 on #ffffff = **3.81:1**，14px 普通文字 < 4.5:1（共 5 节点，desktop/H5 同源）
- 规范章节：3.0 §3 文字色（AA 4.5:1）；注释自称 4.6:1（基准 #747474）已随 muted-foreground 改 slate 系而漂移
- 修复建议：将 mix 比例提高 muted-foreground 占比或直接取 `--fg-tertiary` #64748B（4.76:1 达标）；同步更正注释并纳入 verify-contrast.mjs 常规配对
- 验收方式：axe 复测 home light 零 serious；verify-contrast 新增该配对 PASS

### P2

**AUDIT-002 · 字号十档未迁移至 3.0 刻度**（已批准未实施）
- 现状 v1.2（h1 28 / h2 22 / h3 18 / display 36/44，`tokens/typography.css`）；3.0 §1.3 要求新十档（h1 24 / h2 30? 以 §1.3 表为准 / 页面标题 30/38）。全站标题层级牵动，属已批准的待执行迁移，非实现错误。PENDING→整改期执行。

**AUDIT-003 · Mono 档位与 3.0 §1.5 未对齐**
- 实现：mono 13 / mono-code 13 / mono-title 16（typography.css:74-81）；3.0（2026-11-03 修订）：mono-xs 12 / mono-sm 13 / mono-base 14 / mono-title 16。缺 12px 与 14px 档；mono-title 已一致（定价卡片 `Heading variant='mono-title'` 实测 16/22 ✓）。

**AUDIT-004 · H5 输入文字未达 16px**
- `components/ui/input.tsx` / `textarea.tsx` 无移动端 16px 策略（全局 CSS 亦无），输入框 text-sm 14px；违反 3.0 §1「H5 输入 ≥16px」，且有 iOS 聚焦自动放大风险。
- 修复建议：`@media (max-width: 767px) { input, textarea, select { font-size: max(14px, 16px) } }` 或输入组件 H5 档挂 text-base。

**AUDIT-005 · Light/Dark 配对缺口 3 组**
- `--term-online`（#10b981 字面值，theme.css:456，无 .dark 覆盖）、`--overview-accent-1/2/3`（浅色 oklch，theme.css:471-473，无 .dark 覆盖）。dark 下沿用浅色值，深底对比未验证。color-mix 派生 Token（destructive-subtle 等）自适配，无缺口。
- 修复建议：补 .dark 覆盖并纳入 verify-contrast 实算。

**AUDIT-006 · 焦点环 1px 与 3.0 §15「2px + offset 2px」不一致**（已批准按 3.0 执行、未实施）
- 实现：全组件 `focus-visible:ring-1` + foundations/accessibility.css 原生兜底 1px（2026-11-03 复裁定）。整改期需全站 ring-1→ring-2 + outline offset 迁移。

**AUDIT-007 · 质量门禁现状红：tokens.test.ts 6 FAIL**
- `showcase.html`/`showcase-2.0.html` 被并行会话删除（工作区 D 状态未提交），测试仍引用 → ENOENT×6。属并行迁移半成品，但 CI 会红。整改：由 3.0 迁移会话收尾（删除/改写引用 showcase-3.0.html）。

### P3

| ID | 问题 | 位置 |
|---|---|---|
| AUDIT-008 | 新增 Token 零引用（未接线）：--subtle / --border-strong / --chart-6 / {success,warning,info}-border | theme.css:372-387,622-636 |
| AUDIT-009 | --radius-3xl/--radius-4xl 定义未使用，超出 3.0 七档 | theme.css:265-266 |
| AUDIT-010 | Elevation 五档+glow-online 存在；3.0 §5「Brand Glow」独立档命名/语义差异 | tokens/elevation.css |
| AUDIT-011 | CustomerServiceWidget 16 处内联 style（布局/动画为主，已引 58 处语义引用） | features/customer-service |
| AUDIT-012 | button.tsx:27 注释陈旧（称 r-md 8px，实为 10px）；icon 档 12px vs 3.0 §5 图标按钮 14px | components/ui/button.tsx |
| AUDIT-013 | 8 处非 4px 网格任意间距（p-[3px]/[7px]/[11px]/[0.3rem]/[4.5rem]） | tabs.tsx:44、public-header.tsx:320-332、search.tsx:53、channel-priority-demo.tsx:142 |
| AUDIT-014 | disabled 仅 opacity-50（§10.5 建议补边框/底色区分） | ui 组件统一模式 |
| AUDIT-015 | 页面静态审计 8 组 FAIL（无 P0/P1：sign-in P2×1 + P3×13，手写 table、errors 组件色值等） | evidence/05-pages.md |

### PASS 面（关键项）

硬编码色 0 · 字面字号 0 · <12px 0 · 原生调色板业务引用 0 · Token 循环引用 0 · 品牌色 #5558D8/#A1A3F7 与 3.0 一致 · 圆角七档（6/8/10/12/14/16/full）全部在用 · 间距语义 Token 与 3.0 §7.1 一致 · Motion Token（foundations/motion.css，3 条 easing + duration 档 + reduced-motion 兜底）存在 · verify-contrast 13/13 PASS · typecheck exit 0 · 设计门禁 1255 文件 0 违规 · design-system 测试 58/58。

## E. 页面覆盖率

- 路由文件 70 条 → 功能页面组 38 组：**静态审计 38/38（100%）**；浏览器视觉审计 **12/38**。
- **Blocked（环境配置所致，非代码问题）**：认证后 27 组（dashboard/keys/models/usage-logs/profile/playground/system-settings/channels/users 等）。原因：本地服务器 `password_login_enabled=false` + `email_code_login=true`（/api/status 实测），UI 与 API 登录双路均不可用（e2e/visual/lib/login.ts 注释亦实测记录同款失败）。/pricing 匿名访问被模块访问控制重定向 sign-in（`_public/pricing/index.tsx:43` beforeLoad `requireAuth`）。
- 整改期补测方案：临时开启本地密码登录或提供一次性会话注入（需负责人授权，审计阶段未执行）。

## F. 截图证据

`evidence/shots/`：home / pricing(实为 sign-in 重定向) / sign-in × desktop 1440 + H5 390 × light/dark 共 12 张（8 组有效页面 + 4 组重定向记录）。人工复核：sign-in 桌面/移动无叠压、无溢出、表单清晰；dark 下无浅色残留（home/sign-in 抽检）。

## G. 测试证据

| 命令 | 结果 | 证据 |
|---|---|---|
| `bun run typecheck` | exit 0 | evidence/08-quality-gates.txt |
| `bun run lint:design:strict` | exit 0（1255 文件 0 违规） | 同上 |
| `node scripts/verify-contrast.mjs` | exit 0（13/13 PASS） | 同上 |
| `bunx vitest run src/design-system`（除 tokens） | 8 文件 58/58 通过 | 同上 |
| `bunx vitest run tokens.test.ts` | 37 过 / 6 FAIL（ENOENT showcase） | 同上 |
| Playwright + axe（12 页组） | 12/12 采集成功；axe serious：color-contrast×5（仅 home light） | evidence/06-visual-a11y.json + shots/ |
| API 登录复测 | 失败：Password login has been disabled（本地配置） | 命令行记录 |

## H. 未完成项目

| 项 | 状态 | 原因 |
|---|---|---|
| 认证后 27 组页面视觉/a11y | Blocked | 本地禁用密码登录，无法建立登录态（见 E） |
| /pricing 渲染检查 | N/A（本环境） | 模块访问控制 requireAuth，重定向 sign-in |
| docs-web 深度审计 | PENDING | 独立小应用，本轮仅盘点（01-inventory.txt），建议单列轮次 |
| 键盘人工走查（Tab 顺序/弹窗焦点环游） | PENDING | axe 自动化已覆盖 Label/对比度/Focus-name-appearance；键盘深度走查留整改期与登录态一并执行 |
| 字号刻度/焦点环迁移验证 | PENDING | 已批准未实施（AUDIT-002/006） |
| 3.0 §2.3 全量候选色值逐对实算 | PENDING | verify-contrast 现覆盖品牌 13 对；fg/status/chart 配对需扩充 |

## I. 整改优先级

1. **P1**：AUDIT-001 tertiary-foreground 对比度（改 color-mix 比例或取 #64748B，1 处定义 + 验证脚本，半天内可完成）
2. **P2（先解除门禁红）**：AUDIT-007 showcase 测试引用收尾（并行会话）
3. **P2（已批准迁移执行）**：AUDIT-002 字号刻度、AUDIT-006 焦点环 2px、AUDIT-003 Mono 四档补 12/14px
4. **P2（新增修正）**：AUDIT-004 H5 输入 16px、AUDIT-005 dark 配对 3 组
5. **P3**：AUDIT-008~015（Token 接线、注释修正、间距任意值、disabled 强化等，随 3.0 迁移批量处理）
6. 补测：恢复本地密码登录后完成认证后 27 组页面的视觉 + axe 审计，回填 E/F/G 表

---

**最终判定**：3.0 合规度约 78%（C 表加权），核心架构合规、视觉级迁移完成约 60%、覆盖缺口集中在认证后页面。完成 P1/P2 整改与补测后方可进入验收。
