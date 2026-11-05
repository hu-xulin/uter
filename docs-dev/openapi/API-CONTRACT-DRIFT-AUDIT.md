# API 合同漂移审计（router ↔ OpenAPI）

- **生成方式**：在 `audit/api-contract-drift` 分支新增 `router/route_dump_test.go`
  （env `UTER_DUMP_ROUTES=1` 时 dump `engine.Routes()`），得到**权威路由表 357 条**，
  与 `docs-dev/openapi/api.json`（136 路径）/ `relay.json`（38 路径）做机器比对。
- **目的**：把"路由↔OpenAPI 实现漂移"这一 UAES PR #15 未完门禁，从静态扫描的噪声
  收敛为可复核的真值表；并为后续按路由表自动生成 OpenAPI 提供工具。
- **状态**：本审计只报事实，不替 API 合同负责人做 A/B/C 业务决策。

## 5. 决策门禁结果（2026-11-05 已关闭）

**合同负责人已拍板：方案 B。**

- 前提复核：消费者调查结论不变——`web/src` / `electron` 零引用三个遗留端点，
  唯一"消费者"是文档站自身的 `docs-web/content/api/*` markdown；故方案 C 的兼容期
  对外部调用方收益极低，方案 A（保留双 API 补齐实现）无外部硬合同依据，均不采纳。
- **执行结果（已落地 PR #15 分支 `ai/uaes-uter-integration-2026-11-05`）**：
  - `POST /api/oauth/wechat/bind`、`GET /api/verify/status` —— 已从 `api.json` 删除；
  - `GET /api/oauth/wechat`（旧微信 OAuth，已被 `/api/oauth/wechat-web` 取代）——
    标记 `deprecated: true`。
  - 三个遗留端点全部按方案 B 处置完毕，OpenAPI 与代码真实暴露的路由一致。
- 后续：§4「决策无关」的约 12 个新鉴权/验证端点补文档（本分支 `api.json` 增量）
  作为独立 PR 并入 PR #15；§3 末 ~240 端点反向生成列为独立工程。

## 1. 真值表：已实现的权威路由 vs 文档

| 集合 | 数量 | 含义 |
|---|---|---|
| 路由表（router，gin 权威） | 357 | 代码真实暴露的端点 |
| api.json 文档 | 136 路径 | 仅覆盖约 38% |
| **DRIFT A** 文档有、代码 404 | 8（api.json） | 含 3 个遗留端点（决策依赖） |
| **DRIFT B** 代码有、文档缺 | ~250 | 含新鉴权/验证表面（决策无关，可补文档） |

> 路径参数已归一（`/api/x/:id` ↔ `/api/x/{id}`）。`relay.json` 的 38 条全部为
> 文档有但代码 404（relay 路由未纳入本次 `SetApiRouter` dump，属另一路由表，单列）。

## 2. DRIFT A —— 文档化但代码已 404（决策依赖项）

以下端点**今天调用即 404**，对应 PR #15 的 A/B/C 决策对象：

| 端点 | 业务语义 | 替代实现（已存在） |
|---|---|---|
| `GET /api/oauth/wechat` | 旧微信 OAuth 登录 | `GET /api/oauth/wechat-web` |
| `POST /api/oauth/wechat/bind` | 旧微信绑定 | `GET /api/oauth/wechat-web`（两段式回调）+ `oauth/bindings` |
| `GET /api/verify/status` | 旧验证状态查询 | `GET /api/verify/methods` + `POST /api/verify` |

> 注：`GET /api/oauth/{discord,github,linuxdo,oidc}` 虽在文档里是独立路径，但代码用
> `GET /api/oauth/:provider` 通配实现，**功能正常、非 404**——属"文档按显式路径写、
> 代码用通配"的风格漂移，不应误报为损坏。
> 另：`GET /api/user/token` 文档有、dump 无，需负责人确认是否已被 `GET /api/user/self`
> 等取代或漏注册。

**消费者调查结论**（客观证据）：
- `web/src` / `electron` **零**对这三个遗留端点的引用——前端已全部切到 `wechat-web` / `verify/methods`。
- 唯一仍引用遗留端点的**源码**是 `docs-web/content/api/{en,fr,ja,ru,vi,zh,zh-TW}/` 下的
  `management-oauth.md`（`/api/oauth/wechat/bind`）、`management-security-verification.md`
  （`/api/verify/status`）。即"消费者"只剩文档站自身。
- 因此方案 B（确认废弃 + 修订 OpenAPI）的"零活跃调用方"前提**已成立**；方案 C 的兼容期
  对外部调用方收益极低。最终仍由合同负责人按 A/B/C 拍板。

## 3. DRIFT B —— 已实现但文档缺失（决策无关，可立即补文档）

与本次合同漂移**直接相关**的新鉴权/验证表面（决策无关，建议优先补文档）：

| 端点 | 说明 |
|---|---|
| `GET /api/oauth/:provider` | 通配 OAuth 登录（github/discord/linuxdo/oidc 等） |
| `POST /api/oauth/state` | OAuth state 签发 |
| `GET /api/oauth/wechat-web` | 开放平台网站应用扫码登录 |
| `GET /api/oauth/wechat-web/origin` | 两段式回调域名 |
| `POST /api/oauth/wechat-web/state` | 网站应用 state |
| `POST /api/oauth/email/bind` / `/start` / `/resend` | 邮箱 OAuth 绑定三段式 |
| `GET /api/verify/methods` | 可用验证方式 |
| `POST /api/verify` | 执行验证 |
| `POST /api/verify/email_code` | step-up 邮箱验证码 |
| `GET/POST /api/user/login/email-code` | 邮箱验证码登录 |
| `POST /api/user/login/verify` | 登录二次验证 |
| `POST /api/user/wechat/{webpay,query,notify}` | 微信支付（Native/H5） |

其余约 240 条未文档化端点（subscription / deployment / organization / channel / plugin /
performance / system-task 等）构成**系统性文档债**，建议用本分支的 `route_dump_test.go`
作为数据源做一次性 OpenAPI 反向生成，而不是手工补——列为独立工程，不在本次 A/B/C 决策范围。

## 4. 当前状态与后续工作（2026-11-05）

- **A/B/C 决策：已关闭。** 合同负责人已选择方案 B；两条遗留端点已从
  `api.json` 删除，旧微信 OAuth 路径已标记 deprecated，对应七种语言的文档站页面已同步清理。
- **决策无关的文档补齐：仍需单独核验。** §3 列出的新鉴权/验证端点不能因为遗留端点决策关闭
  就视为全部完成；应逐条对照当前 `api.json` 和真实路由核验。
- **全量路由合同：仍未完成。** 当前审计基线的约 240 条未文档化端点仍属于独立工程；
  应以权威路由表生成候选 OpenAPI，再经合同负责人审阅，不能把静态路由覆盖率等同于语义正确。
- **保留工具：** `router/route_dump_test.go` 作为长期审计工具。下一步应将归一化路由集合与
  OpenAPI operation 集合纳入 CI，并对有意不公开的内部路由维护显式 allowlist。
- **状态边界：** 本次 Option B 只关闭三条遗留 API 的处置决策，不代表 Uter 的
  router ↔ OpenAPI 漂移已全部解决，也不代表 P6 全仓库验收完成。
