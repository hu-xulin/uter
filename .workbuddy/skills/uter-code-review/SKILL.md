---
name: uter-code-review
description: 对 uter（Go + Rsbuild React 的 AI API 网关，new-api 二开）做代码审查——安全性（OWASP ASVS 认证/会话/CSRF）、Go 现代约定、逻辑健壮性、简洁可读性，并覆盖 uter 项目级坑位（option 读写、gzip 双层中间件、iframe sandbox、扣费不变量、跨库事务、GORM 占位符、密钥掩码）。当用户说「审查代码」「做 code review」「这段代码安不安全」「逻辑有没有问题」「改完帮我看看」「评审这个 PR」时使用。给出 文件:行 + 问题级别 + 修复建议 + 验证命令。
agent_created: true
---

# uter 代码审查

目标：对改动给出**可复现、可落地**的审查结论，而非观感。每条发现必须落到 `文件:行 + 级别 + 违反原则 + 具体修复 + 验证方式`。

## 一、触发场景

- 提交/合并前评审：PR、单文件改动、整模块重构。
- 用户问「这段代码安全吗 / 逻辑对不对 / 有没有坑」。
- 安全敏感改动：认证、登录、密码、MFA、OAuth、会话、JWT、API 凭证、付费/扣费、权限（Casbin）。

## 二、安全性审查（OWASP ASVS，强制）

涉及认证相关流程，**必须**符合最新稳定版 OWASP ASVS 与 Cheat Sheet Series（先读 Authentication / Session Management / Password / Forgot Password / MFA / OAuth / CSRF）。起点：
`https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html`

审查清单：

1. **凭证存储与传输**：密码/验证码/恢复码/私钥/可用会话或认证令牌**绝不**进入审计日志；日志只留非敏感上下文。
2. **抗暴力/枚举**：登录限流与失败响应不得泄露账号是否存在；`CriticalRateLimit` 对成功与失败均计数但成功须退款（见 `uter-billing-audit` 的登录 429 锁死修复）。
3. **CSRF / 重放**：用户激活的顶层导航（iframe `sandbox` 缺 `allow-top-navigation-by-user-activation` 会被静默拦截）；OAuth state/nonce 一次性消费（微信两方案已接入）。
4. **会话**：服务端强制校验；旋转与失效；敏感操作重认证；前端校验**不能**替代服务端。
5. **恢复/替代登录路径**不得绕过应有的认证保证（如 `handleNavLinkClick` 拦截未登录 console 跳转，避免 `_authenticated` 守卫触发静默刷新卡死）。
6. 验证后用**聚焦回归测试**覆盖失败/过期/重放/绕过用例，并在变更摘要记录 ASVS 版本与需求 ID、已验证项、未决缺口。**任何适用安全要求未满足前，不得声称合规或完成。**

## 三、Go 现代约定（来自 AGENTS.md，保留行为且提升可读性时适用）

- 用 `any` 取代 `interface{}`（含 map 值、slice 元素、参数、返回）。
- 首次分隔用 `strings.Cut`；去前缀/后缀用 `strings.CutPrefix`/`CutSuffix`，不要先搜再切片。
- 单次遍历不分索引/复用时，用 `strings.SplitSeq` / `bytes.SplitSeq` 取代分配 slice 的 `Split`。
- 成员判断 `slices.Contains`/`ContainsFunc`；有序元素 `slices.Sort`。
- 浅拷贝/合并 `maps.Copy`（注意 nil-vs-empty 与后值覆盖）。
- 简单边界用内置 `min`/`max`（不替代计费校验与安全配额转换）。
- 循环内重复拼接用 `strings.Builder`；固定表达式仍用直接 `+`。
- 静态已知类型用 `reflect.TypeFor[T]()`，动态类型用 `reflect.TypeOf`；用 `reflect.Pointer` 而非 `reflect.Ptr`。
- 标准 `Add(1)`/goroutine/`defer Done` 优先 `sync.WaitGroup.Go`（生命周期与 panic 契约适用时）；传入 `Go` 的函数不得 panic。
- 删除为旧版闭包捕获而设的冗余 `tc := tc` 循环变量副本（Go 1.22+ 不再需要）；仅当确需快照语义时保留。
- 移除对非零指针结构体字段无效的 `omitempty`（确认后再改）。

## 四、逻辑健壮性

- 错误处理：不吞错、不裸 `panic`、不 `_ = err`；跨库/跨构建脚本的守卫条件不得严于该分支真实数据依赖（参考 `docs-web/scripts/sync-upstream-docs.py` 的 `--only legal` 假失败）。
- 并发：共享状态加锁/原子；goroutine 泄露与生命周期；`DecreaseUserQuota` 缓存扣减在 goroutine 异步 → 窗口内可超支，下限只能加在**准入侧**（`GetUserQuotaForAdmission`），结算侧刻意不加（失败请求也已消耗上游 token）。
- 幂等：扣费/回调三件套 = 验签 + 幂等 + 实付金额比对（只拦少付）；入账恒取本地订单；Creem 用最小货币单位（分）。
- 边界：nil 指针、空切片、负数、溢出；`pages === null`（未下发＝未升级）与 `[]`（运营全关）**两种语义不可混**；`QuotaPerUnit=500_000`=1 美元。
- 资源：`defer` 关闭连接/文件/解锁；不要在请求路径里做阻塞的全表扫描。

## 五、🔴 uter 项目级坑位（审查必查）

1. **option 读写**：权威源是 `common.OptionMap["Key"]`（`InitOptionMap` 后 `loadOptionsFromDatabase()` 装载；`UpdateOption` 无键白名单）。**不要另立包级 var 存 option 值**——那种 var 永不赋值，`/api/status` 读它恒得零值，运营改了不生效。`common.OptionMap` 是 nil 初始化的包级 map，测试里直接写会 panic——先 `= map[string]string{}` 并 cleanup 还原。前端 `/api/status` 单一数据源是 `web/src/lib/status-query.ts` 的 `statusQueryOptions`（React Query 缓存）；裸 `fetch('/api/status')` 会绕过缓存、拿不到保存后的刷新。保存后须即时生效的键须加入 `use-update-option.ts` 的 `STATUS_RELATED_KEYS`。
2. **gzip 双层**：`router.Use()` 与 `router.NoRoute()` 重复注册同一响应包装型中间件（gzip/缓存/限流/审计）会叠加执行 → 整站乱码（双层 gzip）。改动 `router/web-router.go` 中间件链后用 curl 确认压缩层数。
3. **iframe sandbox**：文档站登录点击被吞 = 缺 `target="_top"` + sandbox 缺 `allow-top-navigation-by-user-activation`（见 `uter-frontend-audit` §六）。
4. **扣费不变量**：任一请求内 >1 真实扣款项都必须记进同一 `BillingSession`（`preConsumedQuota` 或 `funding.consumed`）。断言 `初始余额 − 最终余额 == logs 表该次请求 Quota`（`service/billing_session.go:271` 声明）。
5. **GORM 占位符**：`Select` 占位符**必须内联常量**（`strconv.Itoa` 拼成 SQL 字面量），不能与 `Where` 参数混绑——GORM 按 clause 而非 SQL 顺序排参，混用会整体串位（如 `type = 8802`）。`model/user.go#GetSelfUserById` 的 Select 未含 `organization_id`。
6. **密钥掩码三件套**：`SecretInput`/`SecretTextarea`/`SecretFileInput` + `lib/secret.ts` 的 `maskSecret`/`isMaskedSecret`；后端 `common/secret_option_keys.go` + `controller/option.go`。页面三步：提交跳过掩码串 → 保存后 `form.reset` 回填 → 后端写入兜底。对端公钥/证书与私钥同等待遇（掩码）。
7. **ServerAddress 是全局站点根**不是回调地址，改它牵动一大片；`PaymentSiteAddress`/`CustomCallbackAddress` 均填 `https://uter.cc`。
8. **微信只保留 Native + H5**（小程序支付已删）；删路由必须同步 `middleware/access_token_routes.go`。
9. **多会话并发编辑同一文件**有实测风险（如 `oauth-section.tsx` 被抢提交）。编辑前重读最新内容，提交前 `git log -- <file>` 核对。
10. **分组体系只有 VIP0–VIP5，无 `default` 分组**（`DefaultUserGroup="VIP0"`）；三处 one-api 遗留种子已改为 VIP0。定价页分组列表=`GetPricing` 的 `usable_group`，徽标=`group_ratio`，两者不一致会出现「无徽标 default 卡片」。

## 六、简洁与可读

- 新代码直接可读：优先 early return、清晰分支、命名良好的局部变量，避免深层嵌套或分层控制流。
- 最小化嵌套函数定义；仅当回调 API 要求或闭包局部明显更简单时才用。
- 不添加只被调用一次、不表达稳定业务概念的包级/模块级 helper；其逻辑内联到调用点。可单独成函数的情况：可复用行为、所需接口/框架回调、导出 API、测试夹具、值得直接测试的复杂业务逻辑。单用 helper 命名必须描述持久领域概念而非机械步骤。
- 一致性：同义词术语全文统一；引入可能歧义的术语时首次定义。

## 七、静态检查与验证命令

```bash
cd /Users/lincolnhu/uter
/usr/local/go/bin/go vet ./...                       # 期望 0 条
/usr/local/go/bin/gofmt -l <改动文件>                 # 期望无输出
/usr/local/go/bin/go build ./...                      # 期望成功（注意 //go:embed web/dist 需产物存在）
/usr/local/go/bin/go test ./...                       # 全量复跑，记录 FAIL 包
cd web && ./node_modules/.bin/tsgo -b                 # 0 error
./node_modules/.bin/oxlint -c .oxlintrc.json <改动文件...>   # 定向，避开存量噪音
```

⚠️ 不要与 `./rebuild-all.sh` 并行跑 `go test ./...`：rsbuild 清空 `web/dist` 会导致根包 `//go:embed all:web/dist` 报 `embed ...: no such file or directory`。

## 八、输出报告

结论优先：问题级别表（阻塞 / 重要 / 建议）→ 每条 `文件:行` + 级别 + 违反原则（§二~§六编号）+ 具体修复 diff 要点 + 验证命令 → 已核对无问题的清单（避免下轮重复审）→ 整改顺序（阻塞优先）→ 覆盖边界（哪些仅代码阅读、需压测/真实上游量化）。报告落 `~/Downloads/Uter/代码审查报告-YYYY-MM-DD.md`。
