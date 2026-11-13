# E2E 验证报告

> 本段落由 `.uap/tools/acceptance-report-generator.mjs` 于 2026-11-13T11:24:14.332Z 从本次真实执行产物自动生成；不覆盖任何已有内容。

- **执行日期**：2026-11-13
- **Git HEAD**：`412f0a28b12f60aadec5cfd21bb25d5cd5975ecc`
- **分支**：`main`
- **最终状态（程序化计算）**：**IMPLEMENTED_NOT_VERIFIED**（claim_allowed=false）
- **原始日志**：`.uap/state/acceptance-20261113/logs/`

**结论：PARTIAL / BLOCKED**

| 项目 | 真实状态 |
|---|---|
| 浏览器自动化工具 | Playwright 1.64 + Chromium 二进制已安装 |
| E2E 配置 | web/e2e/visual/playwright.config.ts、web/e2e/axe/playwright.config.ts |
| 目标服务 | :3000 uter-bin 在监听（Go 后端内嵌 web/dist） |
| 现有套件性质 | 视觉回归 / 可访问性，非完整业务流 E2E |
| 本轮真实执行 | bun run test:axe + bun run test:visual:e2e (真实 Chromium) |
| axe 轨 | 12 passed / 1 failed / 1 skipped，EXIT=1 |
| visual 轨 | 10 passed / 19 failed / 0 skipped，EXIT=1 |
| 真实失败 | /docs critical 可访问性违规（表单 label 缺失）；19 处视觉基线像素差异 |
| 覆盖缺口 | 登录、注册、控制台、API Key、模型列表、定价、Token 用量、余额、充值、订单状态、退款、后台管理、权限边界的完整业务流 E2E 套件不存在 |

> 不允许把「服务在跑 / 浏览器已安装 / 视觉回归」报成 §5.4 业务流 E2E 通过。
> **所需条件**：显式授权启动带隔离测试库的完整栈、编写业务流 spec、配置鉴权账号。

---

## 本次执行复验（2026-11-13，HEAD `412f0a28b12f60aadec5cfd21bb25d5cd5975ecc`）

以下两条命令均为真实 Chromium 执行，日志分别在 `/tmp/uter-axe-current.log` 与
`/tmp/uter-axe-current-source2.log`，数字取自 Playwright 输出，未手工填写。

| 命令 | 目标 | 结果 | EXIT |
| --- | --- | --- | --- |
| `bun run test:axe` | `http://localhost:3000`（launchd 常驻 `uter-bin`，编译于 09:20，内嵌旧 dist） | 12 passed / 1 failed / 1 skipped；`/docs` critical `label` 违规 | 1 |
| `VISUAL_BASE_URL=http://localhost:3399 bun run test:axe` | 隔离前端 dev server（当前源码，`/api` 代理到 :3000） | **13 passed / 0 failed / 1 skipped**，`/docs` 违规消失 | 0 |

根因已定位：`web/src/lib/task-checkbox-a11y.ts` 的 `labelTaskListCheckboxes()`
已在 HEAD 中接入 `native-docs-view.tsx` 与 `markdown.tsx`，当前源码不存在该
可访问性缺陷；旧红灯来自常驻二进制内嵌的旧构建产物。为避免干扰用户工作环境，
本次**未**重建/重启 :3000 服务，改用隔离 dev server 验证当前源码。

**仍未完成**：19 处视觉基线差异未逐项分类、未更新基线；登录/注册/控制台/API Key/
模型/定价/用量/余额/充值/订单/退款/后台管理/权限边界等完整业务流 E2E 套件不存在。
因此 `e2e` 能力仍为 `false`，不得据此宣称 `FULLY_OPERATIONAL`。
