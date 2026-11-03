# DEVELOPMENT-STANDARD
# Uter 软件开发与编码规范

**项目：** Uter  
**文档类型：** 软件开发标准  
**适用范围：** Go、TypeScript、React、前端工程及其他实际使用的技术栈  
**规范级别：** 强制执行

---

## 1. 规范目标

统一代码风格、工程实践和开发质量，确保 AI 生成的代码能够长期维护、扩展和测试。

本规范不强制引入项目尚未使用的技术或框架。

## 2. 开发基本原则

1. 优先遵循现有代码风格。
2. 优先复用现有实现。
3. 保持代码职责单一。
4. 避免重复逻辑。
5. 优先使用明确的类型。
6. 保持错误处理完整。
7. 避免不必要的依赖。
8. 避免过度抽象。
9. 不隐藏异常。
10. 不通过降低质量绕过测试。

## 3. 命名规范

命名必须：

- 具有明确含义。
- 与业务概念一致。
- 遵循对应语言习惯。
- 避免过度缩写。
- 避免同一概念使用多个名称。

业务术语应在项目内保持统一。

## 4. Go 开发规范

### 4.1 语言规范

必须遵循 Go 官方格式与项目既有约定。

建议使用：

- gofmt。
- go vet。
- 项目已有 golangci-lint 配置。
- 项目已有静态分析工具。

不得为了满足检查而大范围关闭规则。

### 4.2 错误处理

- 不得无故忽略 error。
- 不得无依据地吞掉错误。
- 应保留必要的错误上下文。
- 错误包装应有助于定位问题。
- 不应通过字符串匹配错误文本代替结构化错误判断。

### 4.3 Context

涉及请求、数据库、外部服务和任务的操作，应正确传递 Context。

必须考虑：

- 取消传播。
- 超时控制。
- 请求生命周期。
- Goroutine 生命周期。

禁止无管理地创建长期运行的 Goroutine。

### 4.4 并发

涉及共享数据时必须评估：

- 数据竞争。
- 锁粒度。
- 死锁。
- Goroutine 泄漏。
- 并发写入。
- 取消和退出机制。

涉及并发逻辑时，应按适用情况执行 race 检查。

### 4.5 接口

接口应由实际使用场景驱动。

禁止为了形式化而创建大量没有实际价值的接口。

## 5. TypeScript 开发规范

- 优先使用明确类型。
- 尽量避免 any。
- 对外部数据进行运行时校验。
- 区分可选字段和可空字段。
- 正确处理 Promise 和异步错误。
- 不得通过不安全类型断言掩盖数据问题。
- 公共类型应集中维护并保持同步。

必要使用 any 时，应限制作用范围并说明原因。

## 6. React 开发规范

- 遵循 Hooks 使用规则。
- 组件职责应清晰。
- 避免过度复杂的组件。
- 避免不必要的重复渲染。
- 避免状态冗余。
- 正确处理异步请求生命周期。
- 避免过期闭包和竞态。
- 清理订阅、监听器和定时任务。
- 不得使用不稳定的列表 Key。
- 不得在渲染期间执行副作用。

## 7. 样式规范

必须遵循 Uter design-system（`docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`，可视化核查页 `docs/design-system/showcase-3.0.html`）。

要求：

- 优先使用设计 Token。
- 优先复用公共组件。
- 不随意添加独立色值。
- 不随意创建新的字体体系。
- 保持响应式规则一致。
- 保持浅色和深色主题一致。
- 避免全局样式污染。
- 避免无意义的 !important。

## 8. 错误处理

所有错误必须按性质处理：

- 参数错误。
- 权限错误。
- 资源不存在。
- 业务状态冲突。
- 网络错误。
- 超时。
- 外部服务错误。
- 数据库错误。
- 未知系统错误。

不得将真实失败伪装成成功响应。

用户可见错误应清晰，但不得暴露内部堆栈、密钥或敏感信息。

## 9. 日志规范

日志必须能够帮助排查问题。

适当记录：

- 请求或任务标识。
- 模块。
- 操作类型。
- 关键状态。
- 错误原因。
- 执行耗时。

禁止记录：

- 明文密码。
- 完整 API Key。
- 支付私钥。
- 访问令牌。
- 完整敏感个人信息。

## 10. 性能规范

AI 应关注：

- N+1 查询。
- 重复 API 请求。
- 不必要的数据库扫描。
- 不必要的对象分配。
- 内存泄漏。
- Goroutine 泄漏。
- 大数据量渲染。
- 不必要的组件更新。
- 缓存失效与一致性。

性能优化必须有合理依据，不得仅为追求理论性能增加复杂度。

## 11. 依赖管理

新增依赖前必须检查：

- 是否已有同类依赖。
- 是否确实必要。
- 是否仍在维护。
- 是否存在已知漏洞。
- License 是否允许使用。
- 是否增加不合理的体积或维护成本。

禁止未经评估引入不明来源依赖。

## 12. 代码修改要求

- 尽量保持修改范围最小。
- 保留已有兼容行为，除非需求明确要求变更。
- 不删除未理解的代码。
- 不删除测试以消除失败。
- 不修改无关格式或文件。
- 不提交调试代码。
- 不遗留临时密钥和测试数据。

## 13. Uter 代码事实锚点（2026-11-01 校准）

### 13.1 真实工具链（门禁命令即规范）

| 层 | 工具 | 命令 |
|---|---|---|
| Go 格式/静态检查 | gofmt + golangci-lint **v2.15.0**（v1.64.8 与当前 Go 不兼容勿用）+ go vet | `gofmt -l .`、`go vet ./...`、`golangci-lint run`（only-new-issues，存量 121 项基线只拦新增） |
| Go 测试 | go test（三模块 GOWORK=off） | `make test`；flaky 用 `go test -count=1`；竞态 `go test -race` |
| 前端类型检查 | tsgo（@typescript/native-preview，非 tsc） | `bun run typecheck`（`tsgo -b`） |
| 前端 Lint | oxlint（非 eslint）+ i18n key 校验 | `bun run lint`（= check-i18n-keys + oxlint -c .oxlintrc.json） |
| 前端测试 | vitest | `bun run test` |
| 设计 Token 门禁 | check-design-tokens.mjs（T1–T16） | `bun run lint:design:strict`（--strict；基线 web/design-tokens.baseline.json 当前 0 条） |
| 版权头 | add-copyright.mjs（AGPL） | `bun run copyright:check` |
| 构建 | rsbuild（非 vite/webpack） | `bun run build:check`（tsgo -b && rsbuild build） |
| 一键全量 | verify-all.sh | `./scripts/verify-all.sh`（--quick 跳慢套件）；`make verify` / `make verify-quick` |

CI 同款：`.github/workflows/ci.yml`（backend/race/coverage/vulnscan/desktop/frontend 六 job；coverage-gate.sh 阈值 controller=39 model=45 service=43 middleware=62）与 `release-gate.yml`。

### 13.2 Go 编码既有约定（AGENTS.md 摘要，全文以 AGENTS.md 为准）

- 新代码直接可读：早返回、清晰分支、命名良好的局部变量，避免深嵌套。
- 禁止只被调用一次、不表达稳定业务概念的包级 helper——内联到调用点；例外：可复用行为、框架回调、导出 API、测试 fixture、值得独立测试的复杂业务逻辑。
- 金额与配额计算用 decimal（`github.com/shopspring/decimal`），舍入统一走 `common/quota_math.go` 的 QuotaFromDecimalChecked / QuotaRound（half-away-from-zero → int 饱和）；禁止裸 float 运算资金。
- Context 与 Goroutine：后台任务范式为 `go xxx()` + sleep/ticker（main.go 集中启动），新建常驻 goroutine 必须有退出机制。

### 13.3 前端编码既有约定

- UI 底层为 **Base UI**（`@base-ui/react`），非 Radix；组件在 `web/src/components/ui/`（66 个），feature 代码在 `web/src/features/`（31 个域）。
- 路由为 TanStack Router 文件式（web/src/routes/，路由树 routeTree.gen.ts 由插件生成；新增路由后运行 `bunx @tanstack/router-cli generate`）。
- 状态管理仅 4 个 Zustand store（auth/notification/pricing-preferences/system-config，web/src/stores/）；新增全局状态前先确认这 4 个覆盖不了。
- API 请求统一走 `web/src/lib/http-client.ts` 的 axios 实例（`api`），禁止绕过直连 fetch/axios。
- i18n：7 份 locale 文件（en/fr/ja/ru/vi/zh/zh-TW，key 为英文源字符串）；改文案必须同步 7 份——prop/变量形式传 key 扫不到，必须同补 7 份并登记 static-keys.ts（check-i18n-keys 门禁）。
- 样式必须走 design-system Token（见 UX-INTERACTION-STANDARD §16 与 design-system.md），表格用 `components/ui/table.tsx`（dense 档），数据表用 `@/components/data-table` 包。

### 13.4 完成定义

代码必须满足：

- 格式检查通过。
- 类型检查通过。
- 静态检查通过。
- 相关测试通过。
- 错误处理完整。
- 安全要求满足。
- 无明显资源泄漏。
- 相关文档已更新。

具体检查项以 Uter Engineering Quality Engine 为准。

---

**所有代码应优先保证正确性、安全性和可维护性，而不是单纯追求生成速度。**