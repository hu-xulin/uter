# UAP Phase 2 独立验收整改报告（P2-01 ~ P2-11）

- **仓库 / 分支**：`uter` / 本地 `main`
- **验收 HEAD**：`d83e81f3ed69182c612b3c1dc8dec165caa0fccd`
- **执行 ID**：`UAP-EXEC-20261114050504-37d751d4`
- **日期**：2026-11-14
- **终态结论**：**FAILED / NOT_ACCEPTED**（诚实结论，未达成 FULLY_VERIFIED）

## 一、红线遵守（全程）

- 直接在本地 `main` 工作，未分支、未 PR、未推送、未提交远端。
- 未执行 `git reset --hard` / `clean` / `checkout -- .`；未覆盖任何 WIP。
- 未伪造任何验证结果；未以 BLOCKED / SKIPPED / NOT_RUN 充当 PASS；未降低验收标准。
- 未触碰生产 DB / 支付 / 凭据。视觉与业务 e2e 全部走 `scripts/phase2-test-stack.sh` 隔离栈（DB 副本 + 独立 Redis :6380 + 后端 :3100 + 前端 :3101），生产 :3000 / 生产库零改动。
- 验证结论与运行结果一致；未实际执行的用例均显式标注未执行/受限。

## 二、P2-04 可访问性（axe）—— 已验证通过（公开页）

**根因修复**（已提交入 HEAD `d83e81f3`）：GFM 任务清单复选框缺乏可访问名称，导致 `/docs` 在 axe 下报 `critical / label` 违规。采用双保险：
1. 构建期：`web/scripts/rehype-tasklist-labels.mjs`（`rehypeTasklistLabels`）在 MDX 编译时为 `disabled` checkbox 补 `aria-label`；已接入 `web/rsbuild.config.ts` 的 `rehypePlugins`。
2. 运行期：`web/src/lib/task-checkbox-a11y.ts` 的 `labelTaskListCheckboxes()` 在 DOM 挂载后从 `<li>` 文本补 `aria-label`；`native-docs-view.tsx` 已接线。

**验证**：隔离栈 `:3101`（live source）跑 axe 公开套件 → **13 passed / 0 failed / 1 skipped**，0 critical / 0 serious；`/docs` 的 GFM `critical/label` 违规彻底消除。

**受限项（诚实 SKIP，非洗白）**：鉴权页 axe 套件（`web/e2e/axe/authed.spec.ts`）因页面级会话无法建立而显式 `test.skip`——根因是后端 `new_api_refresh` 会话 cookie 的 `Path=/api/user/auth` 不随顶部导航携带，且 API 登录不写 SPA 存储（无 access_token），SPA 守卫据此将 `/dashboard` 客户端弹回 `/sign-in`。属测试链路环境性限制，属“测不了”而非“违规”，已如实标注 SKIP，未计入 PASS。

## 三、P2-05 视觉回归 + 业务 e2e —— 环境性受限，未达成干净通过

**运行结果**：
- `VISUAL-REGRESSION.json`：`PASS 0 / FAIL 29`，`exit_code 1`。
- `E2E-RESULTS.json`：axe 子套件 13/0/1（同 P2-04）；business 套件因会话限制失败 → 整体 FAIL。

**根因（29 项失败均为 `用例执行异常：failed`，非单页误判）**：
1. **鉴权页会话无法建立**（与 axe authed 同源）：`auth.setup.spec.ts` 冒烟在 API 登录后访问 `/dashboard` 被弹回 `/sign-in?redirect=%2Fdashboard`，触发 FAIL；其余鉴权截图用例随之失败。
2. **跨环境像素基线不一致**（项目自身 `playwright.config.ts` 决策 C 明文：视觉回归仅限开发机手动执行，明确不接 CI / 跨 OS，因字体与 GPU 合成会产生随机红灯）。提交基线在另一渲染环境采集，本机运行产生系统性像素差（公开页 `home`/`about`/`pricing` ratio 0.01~0.03，鉴权页因截到 /sign-in 达 0.05~0.11）。

**诚实分类**：上述失败为**环境性 / 工具链限制**，非本轮 P2-04 修复引入的回归。P2-04 仅改动 `/docs` 任务清单 a11y，不可能影响 `home`/`about`/`pricing`/`dashboard` 渲染；且已确认修复文件均在 HEAD 中、且 `:3101` 公开 axe 实测通过。

**未做之事**：未以 `bun run test:visual:e2e:update` 盲目重基线——README 明确“无脑 -u 等于把回归写进基线”，重基线会掩盖真实差异或把鉴权页错误截成 /sign-in。

## 四、已验证通过的能力卡（绑定 HEAD `d83e81f3`）

| 能力卡 | 结果 |
|---|---|
| DATABASE-INTEGRATION.json | PASS 47 / 0 |
| DATABASE-MIGRATIONS.json | PASS 6 / 0 |
| SECURITY-VERIFICATION.json | PASS 48 / 0 |
| PAYMENT-SANDBOX.json | PASS 30 / 0（但支付网关整体 BLOCKED，见下） |
| REQUIREMENT-VERIFICATION-RESULTS.json | VERIFIED 6 / NOT_VERIFIED 526 / BLOCKED 6（共 538） |

**支付网关**：本地模拟通过，但 `EXT-PROVIDER-SANDBOX` 因仓库内无真实支付服务商沙箱凭据/端点（ValidateConfig fail-closed）而 **BLOCKED**；本地模拟绝不被当作真实沙箱，故 FULLY_VERIFIED 不被允许。

## 五、终态门禁（`uap accept`）

- `overall_status = FAILED`，`claim_allowed = false`。
- `necessary_unverified = 532`，`necessary_blocked = 2`（支付沙箱 + 需求未全覆盖），`gate_groups_fail = 3`。
- 阻塞因子：532 项需求无当前有效证据、视觉 29/29 失败（环境性）、支付沙箱 BLOCKED、鉴权页 axe 受限 SKIP。

## 六、工作树未提交改动（须保留，勿误提交）

`git status` 显示 19 个 `web/` 文件 + 一批 `.uap/` 产物改动。区分如下：

1. **本会话有意为之的 e2e 测试基建改动（9 文件）**：`e2e/axe/authed.spec.ts`、`e2e/business/lib/service-gate.ts`、`e2e/visual/{auth.setup,authed}.spec.ts`、`e2e/visual/lib/{login,service-gate,target}.ts`、`e2e/visual/public.spec.ts`、`package.json`（注：`design:5:*` 脚本与 `visual-regression.mjs` 的 showcase 重命名疑属并行设计系统 5.0 工作，见下）。这些使鉴权不可用场景 fail-closed（SKIP/BLOCKED + 机读注解），属测试基建，非产品代码。
2. **既存 WIP（非本会话所写，须原样保留）**：`src/components/search.tsx`（aria-label a11y）、`src/styles/theme.css`、`src/design-system/__tests__/tokens.test.ts`、`src/components/layout/components/system-brand.tsx`、`src/components/quota-details-popover.tsx`、`features/keys/components/{api-key-quota-cell,api-keys-cells}.tsx`、`features/playground/input/playground-parameter-panel.tsx`、`features/users/components/user-quota-cell.tsx`，以及 `package.json` 的 `design:5:*` 与 `scripts/visual-regression.mjs` 的 showcase 重命名——疑为并行“设计系统 5.0 / a11y”会话遗留，与本轮 P2 整改无关。
3. **`.uap/` 产物**：各能力卡与状态文件由验证命令生成，属机器产物。

**以上均未提交、未推送。** 因树内混有未知 WIP，且 AGENTS.md 红线禁止擅自推送远端，提交/推送范围须用户显式授权后单独确定。

## 七、证据新鲜度注记

部分能力卡生成于今日较早执行（如 DATABASE `2afbb0f4`、SECURITY `07c59bb9`、PAYMENT `9b967b8b`、REQUIREMENTS `749`），与当前执行 `37d751d4` 的 `execution_id` / `worktree_fingerprint` 不完全一致，但均指向同一 HEAD `d83e81f3`，证据真实有效；`VALIDATION-RESULTS.json` 来自更早 HEAD `80b38608`，为既有产物。该差异不影响终态结论（532 项需求未覆盖已锁定 FAILED）。

## 八、达成 FULLY_VERIFIED 所需条件（后续）

1. 在目标开发机重采集视觉基线（决策 C 口径），消除跨 OS 渲染噪声。
2. 解决 e2e/视觉的 SPA 会话建立问题（API 登录后写入 SPA access_token，或改走真实 UI 登录流），使鉴权页可达“已登录”视图。
3. 以真实行为探针验证 532 项未覆盖需求。
4. 提供真实支付服务商沙箱凭据并授权沙箱调用后重跑 `uap verify-payment`。
5. H5 真机与生成部署授权（UAP 既有两类受限项）。
6. 提交/推送前澄清 WIP 范围，避免误将并行会话改动一并提交。

## 九、GitHub 推送

用户早前指令“全部提交GitHub”**尚未执行**：AGENTS.md 红线禁止擅自推送远端，且树内混有非本会话 WIP，盲目 `git add -A` 会将其一并提交。已就范围向用户澄清，未做任何提交/推送动作。
