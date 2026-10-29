---
name: uter-auto-test
description: 对 uter（Go + Rsbuild React 的 AI API 网关，new-api 二开）做全面测试与缺陷修复——后端 `go test ./...`、前端 `vitest` 与 `tsgo -b` 类型门禁、扣费对账不变量断言、已知 flaky 与测试三坑（方言列名 / TokenKey 无 sk- 前缀 / 提升字段字面量）、覆盖率目标与「定位→最小修复→复跑→不引入新失败」闭环。当用户说「跑测试」「全面测试」「修复 bug」「覆盖率不够」「测试全红/有失败」「帮我定位测试失败」时使用。给出测试清单、失败定位、最小修复与复跑验证命令。
agent_created: true
---

# uter 自动测试与缺陷修复

目标：让 **全部可自动化测试通过且覆盖到位**，并把失败分成「真实 bug」与「已知存量」分别处置。结论必须能落到一次可复现的 `go test` / `vitest` 上。

## 一、触发场景

- 改动后要求「跑一遍测试 / 全面测试 / 提升覆盖率」。
- 出现测试失败、整包红、flaky 抖动。
- 「修复所有 bug」类诉求 → 走 §六 闭环，而不是盲目改测试。

## 二、测试体系总览

| 层 | 命令 | 门禁 |
|---|---|---|
| 后端单元/集成 | `go test ./...` | 0 FAIL |
| 后端类型/编译 | `go build ./...` / `go vet ./...` | 0 错误 |
| 前端类型 | `cd web && ./node_modules/.bin/tsgo -b --force` | 0 error（不带 `--force` 缓存会误报 0 错误） |
| 前端单测 | `cd web && ./node_modules/.bin/vitest run <目录>` | 0 FAIL |
| 前端 lint | `./node_modules/.bin/oxlint -c .oxlintrc.json <文件>` | 定向，避开存量 |

⚠️ 不要与 `./rebuild-all.sh` 并行跑 `go test ./...`：rsbuild 清空 `web/dist` → 根包 `//go:embed all:web/dist` 报 `embed ...: no such file or directory`（竞态假阳性）。

## 三、覆盖目标（全面）

优先保证以下高风险面有断言：计费/扣费、认证与会话、OAuth/CSRF、权限（Casbin）、支付网关回调、限流、option 读写、i18n。

- 扣费：**每个**请求类型（文本/异步任务/图像/实时语音 WSS）都要断言「初始余额 − 最终余额 == `logs` 表该次请求 `Quota`」（`service/billing_session.go:271` 声明的不变量）。实时语音 WSS 历史 P0：增量曾绕开会话直扣钱包导致 2× 收费，须断言增量经 `Billing.Reserve` 进入同一 `BillingSession`。
- 认证：OAuth state/nonce 一次性消费、登录 429 退款（`middleware/login_rate_limit_refund_test.go`）、iframe sandbox（`docs-iframe-sandbox.test.ts`）。
- 支付：`topup_gateway_contract_test.go` 门禁——验签+幂等+实付金额比对（只拦少付）、入账取本地订单、Creem 最小货币单位（分）。

## 四、已知 flaky 与必带参数

- 任何可疑 flaky **必须** `go test -count=1`（消除缓存）；高度怀疑抖动时 `-count=30` 复现。
- 前端 `vitest` 单次启动 45–110s（jsdom 最慢），不是卡死；但若只打印 `RUN vX / path` 一行就再无输出直到被 SIGKILL（exit 137），那是模块图里 jsdom 跑不动的依赖，**不是慢**——实测 `src/components/layout/**`（`SidebarProvider`、Base UI sidebar 一族）会稳定挂死，即使 mock 掉 `@/components/ui/sidebar` 仍挂。**结论：别为 `components/layout/**` 写 jsdom 单测**，把逻辑下沉到 hooks/纯函数再测。

## 五、🔴 写后端测试的三个坑（不踩必失败）

文件放 `service/<name>_test.go`，`package service`，复用 `task_billing_test.go` 的 `TestMain`（内存 sqlite，已 AutoMigrate + `truncate(t)`/`seedUser`/`seedToken`/`seedChannel`）。

1. **方言列名**：`TestMain` 直接赋值 `model.DB` 会跳过 `initCol()`，凡经 `commonKeyCol` 的查询（`GetTokenByKey`、渠道检索）报 `SQL logic error: near "=": syntax error`。修复：调 `model.InitColumnNames()`（先例 `model/task_cas_test.go:32`）。
2. **`relayInfo.TokenKey` 不含 `sk-` 前缀**：`middleware/auth.go:303` 会 strip `sk-` 再查库，故 `seedToken(..., "realtime710", ...)` 与 `TokenKey: "realtime710"` 必须同时无前缀。
3. **结构体字面量不能写提升字段**：`RelayInfo.ChannelId` 是内嵌 `ChannelMeta` 的提升字段，Go 1.25 下 `ChannelId: x` 报 `requires go1.27 or later`。必须写 `ChannelMeta: &relaycommon.ChannelMeta{ChannelId: x}`。

## 六、修复 bug 闭环（「修复所有 bug」的落地口径）

1. **复跑并采集**：`go test ./... -count=1 2>&1 | grep -E 'FAIL|ok ' | tee /tmp/uter_test.log`，记录失败包与用例名。
2. **分流**：
   - **真实 bug**（断言失败/panic/数据错误）→ 修代码，不修测试来凑绿。
   - **已知存量**（见 §七）→ 不视为本轮回归，单独记录，不阻塞。
   - **环境假阳性**（embed 缺 dist、并行清盘）→ 先解决环境再判。
3. **最小修复**：改最小必要面；遵守 `uter-code-review` 的 Go 约定与安全性要求；多扣费点须记同一 `BillingSession`；GORM `Select` 占位符内联常量。
4. **复跑验证**：只跑相关包 `go test ./<pkg>/... -count=1`，再全量 `go test ./... -count=1` 确认 0 新 FAIL。
5. **防回归**：为修复补一条针对性测试（如扣费不变量、限流退款）；确认未触碰「已知存量」之外的既有绿包。

## 七、已知存量失败（勿误判为新引入）

- `controller`：`TestGetUserModelsExpandsAutoGroupsInConfiguredOrder`、`TestGatewayCallbackRegistryCoversAllRechargePaths`（自 `5537c3fc6` 起失败）。
- `TestSecurityLoginAllPrimaryTransportsRequireAdditionalVerification` 的 wechat 子测试**已恢复通过**（走 state+cookie），不再是存量失败。
- 全量复跑期望基线：43 包 ok / 0 FAIL（其余存量红已消除，别再当红测）。

## 八、输出报告

结论优先：环境是否干净 → 失败分流表（真实 bug / 已知存量 / 环境）→ 每个真实 bug 的 `文件:行` + 根因 + 最小修复 + 复跑数字 → 新增测试清单 → 覆盖率缺口与下一步。报告落 `~/Downloads/Uter/测试与修复-YYYY-MM-DD.md`。
