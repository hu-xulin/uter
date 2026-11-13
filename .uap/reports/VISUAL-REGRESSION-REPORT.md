# VISUAL-REGRESSION-REPORT（Phase 2 视觉差异逐项分类）

- 生成：2026-11-13
- 权威运行：`VISUAL_BASE_URL` 未设 → 目标 `:3000`（launchd 常驻 uter-bin，内嵌 dist），
  与基线采集口径完全一致；Playwright `maxDiffPixelRatio=0.0015`
- 结果：**29 项中 26 项 PASS，3 项差异；`baseline_updated=false`（零基线批量更新）**
- 能力卡：`.uap/reports/VISUAL-REGRESSION.json`（由 `uap verify-visual` 生成）

## 1. 逐项分类（禁批量更新基线）

| # | 用例 | 分类 | 判定依据 |
| --- | --- | --- | --- |
| 1 | 登录链路冒烟：凭据可登录 | `test_environment_credential` | 真实错误：`API 登录失败：HTTP 200 Password login has been disabled by administrator`。真实站点运营配置 `PasswordLoginEnabled=false`（运营数据，红线禁止自动改动）；非 UI 缺陷、非设计变更 |
| 2 | 鉴权页面基线 - desktop | `test_environment_credential` | 同上：登录态建立失败导致整组鉴权页用例不可达 |
| 3 | 鉴权页面基线 - mobile | `test_environment_credential` | 同上 |

**0 项真实 UI 缺陷、0 项设计变更待审、0 项基线过期更新。**

## 2. 解除条件（BLOCKED → 可验证）

站点管理员显式开启密码登录（或在隔离栈跑鉴权轨：对 /tmp 副本开启
`PasswordLoginEnabled=true`，本轮已验证该路径可行 —— 隔离栈上登录链路
23 项业务 E2E 全过，含真实表单登录渲染 dashboard）。

## 3. 附带证据：dev-server 伪差异（非缺陷，记录在案）

对当前源码 dev server（:3002，VITE 指向隔离后端 :3100）的试运行显示
29/29 全 diff，逐帧比对证实两类**环境伪差异**，均非 UI 缺陷：

1. **数据漂移**：首页统计条 `99+→100+ / 198+→200+ / 79+→80+`（真实库数据随时间增长，
   数据型基线天然漂移）。
2. **dev-only TanStack Router devtools 徽标**（左下角绿色 pill）：仅 dev 模式渲染，
   生产 dist（基线口径）无此元素。

结论：视觉基线轨必须以 :3000 内嵌 dist 为口径（配置注释既定决策），dev-server
的像素比对结果不作为缺陷依据。

## 4. 与上一阶段「19 项差异」计数的关系（诚实说明）

上一会话记录的 19 项差异是对当时更旧 binary/dist 状态的计数；本轮以当前
:3000 栈的权威运行为准（26/29 PASS）。差异收敛说明 dist 与基线差距已缩小；
3 项失败全部归因站点登录开关（运营配置），无一是像素回归。

## 5. 复验命令（可重放）

```bash
cd web && bun run test:visual:e2e        # 目标 :3000（默认）
node .uap/bin/uap.mjs verify-visual      # 能力卡 + 逐项分类，baseline_updated=false
```
