# Uter × 上游 new-api 功能差距清单

> 生成时间：2026-11-17 · 上游：`QuantumNous/new-api` @ `ce8fc49e4b1a874aa917dce4f1a8416c52ec8ec0`
> 机器可读版本：[`upstream-gap-register.json`](./upstream-gap-register.json)
> 许可证：上游与 Uter 均为 AGPL-3.0（移植需保留版权与 NOTICE 署名）

## 方法

1. 浅克隆上游（blobless），取得 2836 个受跟踪文件；
2. 与 Uter 文件树做差集，排除测试 / 文档 / CI / 资产等非功能文件；
3. 将剩余 225 个上游独有文件归入 10 个功能块；
4. 对每个功能块做路径级核实（Uter 是否确有等价实现），标注 `MISSING` / `PARTIAL`；
5. 上游测试文件单列为「验证项」，先确认 Uter 是否已有等价行为，再决定移植或补测试。

> 注意：文件存在不等于能力等价。上游与 Uter 均已分叉，**禁止整仓合并**；每批实施前必须重新核实语义差异，并遵守 Uter 的 UAP 治理、计费不变量与 UDS 8.0 设计系统。

## 差距总览

| ID | 功能块 | 状态 | 优先级 | 批次 | 上游文件 | 其中测试 |
|---|---|---|---|---|---|---|
| GAP-01 | 请求钩子插件运行时（request hooks / effects / 附件·媒体·PDF） | MISSING | P1 | B1 | 48 | 4 |
| GAP-05 | jsplugin 基础引擎扩展（configSchema / keywords / media / transform） | PARTIAL | P1 | B1 | 12 | 11 |
| GAP-02 | Provider 插件系统（登录、定时同步、中继路由） | MISSING | P1 | B2 | 30 | 7 |
| GAP-03 | 渠道凭据插件与余额查询 | MISSING | P1 | B3 | 7 | 2 |
| GAP-04 | 渠道控制器与适配器（WeChat / Image / newapi adaptor / 高级配置） | PARTIAL | P2 | B3 | 12 | 4 |
| GAP-06 | 任务插件控制台（README、部件徽标、变换说明、定价问题、吊销告警） | PARTIAL | P2 | B4 | 18 | 0 |
| GAP-10 | AI 对话组件库（task / plan / tool / attachment 等） | PARTIAL | P3 | B4 | 22 | 0 |
| GAP-08 | 系统设置定价工具（价格调整、价差对比、JSON 安全编辑） | PARTIAL | P2 | B5 | 10 | 0 |
| GAP-07 | 站点外壳 / 首页 / 公开路由 | PARTIAL | P3 | B5 | 31 | 0 |
| GAP-11 | 其余杂项与验证项 | PARTIAL | P2 | B0 | 35 | 4 |

## Uter 已具备（无需移植）

- OpenAI Chat / Responses、Claude Messages、Gemini、Realtime / Responses WebSocket
- 图片 / 音频 / 向量 / 重排 / 内容审查接口
- 65 种渠道类型；渠道优先级 / 权重 / 重试 / 亲和
- 配额、订阅、表达式计费、缓存计费
- OAuth/OIDC、Passkey、2FA、登录会话管理
- JS 任务插件运行时与插件市场（已验证 13 个官方任务插件可安装）
- UAP 治理、UDS 8.0 设计系统、7 语言前端与后端 i18n

## 批次计划与安全门槛

| 批次 | 范围 | 强制门槛 |
|---|---|---|
| B0 | GAP-11 验证项逐条确认 | 每项给出 PRESENT / EQUIVALENT / MISSING 结论与证据 |
| B1 | GAP-05 + GAP-01 请求钩子运行时 | go build/vet/test；6 个官方插件安装 + dry-run；JS 沙箱与 effects 白名单安全审计；计费不变量回归；SQLite/MySQL/PostgreSQL 三库；特性开关与回滚 |
| B2 | GAP-02 Provider 插件 | 凭据加密与登录回调安全测试；同步幂等；三库；回滚 |
| B3 | GAP-03 + GAP-04 渠道凭据/余额/控制器 | SSRF 与日志泄漏测试；适配器单测；渠道表单回归 |
| B4 | GAP-06 + GAP-10 控制台与组件 | 设计系统严格门禁；a11y；7 语言；页面回归 |
| B5 | GAP-07 + GAP-08 站点与设置 | 视觉回归；计费不变量；7 语言 |

## B0 核实结果（2026-11-17）

对 GAP-11 全部文件与各功能块上游测试逐项核实：**11 项等价、4 项部分等价、20 项缺失、28 个测试随所属批次移植**。

- 等价（无需移植）：关于页（about-viewer）、Telegram 绑定（account-bindings）、主题切换（theme-switch）、日期选择（compact range picker）、各 lib/index 桶文件。
- 缺失且需移植：供应商管理弹窗、上游冲突弹窗、微信绑定、节点同步（前后端）、请求插件审计记录、密码强度组件、auto-skeleton 等。
- 4 个验证项测试对应的功能在 Uter 均不存在：provider 插件、请求钩子（两种入口）、任务插件渠道上下文。

## B1 进度

- **B1-I1a 已完成（PARTIAL_IMPLEMENTED）**：Meta 契约新增 `optional` / `configSchema` / `samples`，带形状与大小校验（object/array、≤64 KiB），经 API 返回；`go build`、`go test ./pkg/jsplugin/`、`go vet` 全部通过。
- **待完成**：configSchema/samples 语义校验与默认值（I1b）、transform/keywords/media 绑定（I2）、请求钩子运行时（I3）、控制面 API（I4）、控制台界面（I5）。B1 运行时尚未合入，避免半成品。

### B1-I3 阻塞点（已完成分析）

移植上游运行时后编译对照发现，I3 不能机械移植，需先完成四处结构性合并：

1. **Registry 分叉**：Uter `Registry.Get(platform)` 以任务平台为键；上游运行时按插件 key 查找，并需要 `GetIgnoringMasterSwitch`。
2. **setting**：Uter `Instance` 缺少 `PluginScope` / `Scope`（插件作用域实例）。
3. **model.Task**：缺少 `RequestPlugins` / `TaskRequestPlugins`（任务报告数据）。
4. **链路接入**：转发链路缺 ingress/outbound/egress 钩子点，Responses WebSocket 路径需单独接入。

后续按 I3.1 → I3.5 推进：Registry key 索引 → Scope → 任务字段（三库）→ 运行时接线 → 控制器/控制台。

## B2 / B3 进度（2026-11-17）

- **B2 Provider 插件（后端 PARTIALLY_VERIFIED）**：`pkg/jsplugin/provider.go` 与 `relay/channel/providerplugin/{adaptor,chain,eventstream,management,stream}` 移植完成；`meta.relay` / `channelConfig` / `keyHint` 解码与校验、任务/Provider/请求处理三部件互斥校验、ProviderHooks 完整性校验接入编译期；distributor 固定请求所用插件并把 `AdvancedCustom` 路由换为 `ChannelRelayConfig`，RelayInfo 采用 `APITypeProviderPlugin`；渠道测试按插件路由选择端点；渠道保存校验 `plugin_config`；登录/凭据路由（`plugin_login`、`plugin_credentials`）已注册。
- **B3 渠道凭据/余额（后端 PARTIALLY_VERIFIED）**：任务插件凭据行（submit/poll/batch/content）携带凭证头与签名，批量轮询按凭据账号分组，解析钩子可见轮询所用凭据；插件余额钩子接入 `UpdateChannelBalance` 与批量更新（多 key 分别查询、空额禁用）；上游模型列表优先走插件 `/v1/models` 路由；`GetChannelKey` 只回显凭据摘要；微信公众号登录/绑定（`controller/wechat.go`）与 `users.wechat_id` 列已移植，邮件事件键补齐 7 语言。
- **三库验证**：`TestUserWeChatIDColumnMigration` 在 SQLite、MySQL 8.0、PostgreSQL 16 通过（旧表升级、二次启动幂等、数据保留、写入读回）。
- **验证命令**：`go build ./...`、`go vet ./...`、`go test ./pkg/jsplugin/ ./relay/channel/providerplugin/ ./relay/channel/task/jsplugin/ ./service/ ./middleware/ ./relay/ ./controller/` 全部通过；`relaykit` 与 `tokenkit/tokenkit` 独立构建通过。
- **前端（2026-11-17 补）**：渠道编辑新增「插件设置」对话框：`plugin_config` JSON 编辑（保存时校验对象）、插件 `keyHint` 提示、凭据摘要列表与登录流程（fields/device 步骤）；插件选项接口下发 `channelConfig` / `keyHint`。7 语言文案、UDS 8.0 Token 门禁、版权头检查、i18n 检查全部通过；浏览器端到端（隔离栈 + root）验证了创建 type-61 渠道→保存配置→后端归一化持久化→重开回显，且 0 个 API 失败。
- **用量日志审计（2026-11-17 补）**：日志详情新增「Request plugins」区块，展示每次插件运行的阶段、修改/请求头/媒体/脱敏/发现计数、拒绝码、未检查与截断状态（不展示被修改的值）；7 语言文案齐全，浏览器端到端验证通过。
- **schema 字段表单（2026-11-17 补）**：`channelConfig` 的顶层字符串/数字/整数/布尔/枚举字段按 schema 渲染（localized 标题与说明、默认值），并与 JSON 编辑器双向同步；嵌套 object/array 仍走 JSON。浏览器端到端验证：选择 `eu` → 保存 → 渠道更新 → 后端持久化。
- **微信登录**：用户决定不引入微信公众号扫码登录，保留现有微信开放平台网页登录；相关试验代码已完整回退。
- **未完成**：嵌套 channelConfig 专用编辑器、凭据续期/多账号管理交互完善、B4 控制台组件、B5 站点设置、GAP-11 剩余项；任务链路端到端仍需真实上游插件验证。

## B1 出站钩子接线（2026-11-18）

- 真实链路接入 `Outbound` / `Egress` / `PassThrough`：OpenAI（TextHelper）、Claude、Gemini（含嵌入分支）、图片、嵌入、Rerank、Alpha Search、DeepSeek Tools、Chat→Responses 双阶段；Realtime 会话接入 `ClientEvent`/`ServerEvent` 与并发写锁；任务提交接入 `TaskAttempt`/`TaskEgress`；Midjourney 提交接入 request 的 ingress、渠道 late ingress 与 report；任务协议桥接补齐 report 与 `Stopped` 错误码透传。
- 修复两个真实缺陷：① `RecordConsumeLog` 未把结算参数写入上下文，插件 report 的 `cost.quota` 恒为 0；② 规则码（如 `reply.blocked`）被域名脱敏误伤为 `***.blocked`。
- 证据：移植上游 `relay/requestplugin/requestplugin_test.go`（2064 行）全部通过；`go build ./...`、`go vet`、`go test ./relay/... ./controller/ ./model/ ./relay/requestplugin/` 全部通过；`relaykit` 独立构建与 kitutil 测试通过。

## 双定价栈（2026-11-18）

- 新增 `setting/pricing_engine`：全局默认（`PricingEngine` 选项，默认 `uter`）+ 渠道 `pricing_engine` 覆盖；未知值回落实例默认。
- 第二套实现 `relay/helper/price_upstream.go`：上游 new-api 的定价计算规则（端点感知的任务价守卫、`param()` 按需读取请求体、`u()` 任务表达式拒绝普通请求等），与 Uter 栈共用已配置的价格数据。
- 入口：`ModelPriceHelper`（按量/表达式）与 `ModelPriceHelperPerCall`（按次：任务、Midjourney、图片）按渠道选择引擎；后续结算沿用各自产出的 `PriceData`，保证预扣与结算一致。
- 前端：系统设置 → Models → Pricing Engine 选择实例默认；渠道编辑 Other Settings 可选择跟随默认 / Uter / 上游。
- 验证：`setting/pricing_engine` 单测；比例与按次两种模型两栈预扣额一致；渠道覆盖设置往返；浏览器端到端（全局切换后刷新回显、渠道覆盖持久化）；`go build ./...`、`go test ./relay/helper/ ./controller/ ./model/`、前端 `typecheck/lint/design/copyright/build:check` 全部通过。
- 定价问题检测已补齐：`GET /api/option/model_pricing/issues` 返回 `unconfigured` / `incompatible` / `stale` 三类问题；系统设置新增「Pricing Issues」面板（原因本地化、可刷新）。访问令牌新增 `option:read`（issues）与 request-plugin 控制面作用域。
- 未完成：上游快照/预览端点的上游语义版本（当前两栈共用 Uter 的配置快照与选项存储）。

## 任务插件控制台 parity（2026-11-18）

- 详情接口返回插件部件：`task` / `provider` / `transform`（含 `transform_hooks`）/ `login` / `refresh`；活动版本同时返回 `pricing_issues`。
- 插件选项下发部件标记，以及 `checkKey`、`balance`、`relayPaths`、`responsesWebsocket`、`name_i18n`。
- 上传、启停等响应携带 `pricing_issues`，控制台可即时提示价格问题。
- 前端详情页新增「Capabilities」徽标区与「Pricing Issues」列表（复用定价问题原因文案）。
- 验证：`go test ./controller/ ./router/`；前端 `typecheck / lint / design:strict / copyright / i18n / build:check` 通过；浏览器端到端（上传测试插件 → 表格菜单打开详情 → 显示 Capabilities / Task driver）通过。

## 请求插件实例 schema 表单（2026-11-18）

- 插件选项下发 `configSchema`；任务插件页「Request plugins」新增「Configuration fields」：选择实例后按其 `configSchema` 渲染字符串/数字/布尔/枚举字段（localized 标题与说明），编辑结果实时同步到整表 JSON 编辑器。
- 复用渠道插件配置的解析与字段组件（提取为 `src/components/plugin-config-fields.tsx`），避免两套字段渲染逻辑。
- 验证：单测（字段渲染 + JSON 同步）与浏览器端到端（上传带 configSchema 的请求插件 → 保存实例 → 选择 high → 保存 → 后端实例 config 持久化）通过；前端 typecheck/lint/design/copyright/i18n/build:check 全绿。

## 任务插件 README（2026-11-18）

- 按版本声明的 `readme` 下载使用文档：大小/超时上限、可选 sha256 校验、UTF-8 校验，按界面语言选择翻译并回退英文。
- 校验 front matter（仅 locale/translations）、一级标题；禁止 HTML、图片与非 http/https/mailto/相对链接，Markdown 相对链接按文档地址解析。
- 安装详情页展示指南；格式问题给出可读原因与源文件链接，下载失败可重试。
- 证据：移植上游 README 校验/组件测试共 26 例通过；typecheck、lint、design:strict、copyright、i18n、build:check 全绿；提交 `5bd76878d`。

## 市场撤下警示（2026-11-18）

- 上游 `MarketplaceIndex.revoked` 在 Uter 完全缺失，现已补齐：索引解析支持 `revoked[].sha256`（校验 64 位十六进制并归一化小写）、可选 `key` 与本地化 `reason`。
- 已安装插件按 `source_hash` 匹配已配置市场索引的撤下条目；命中时在表格与卡片视图显示警示（含原因，按界面语言本地化），提示管理员该版本已从市场撤下。
- 为避免每次加载都请求全部索引，仅在存在非 factory 且带 `source_hash` 的已安装插件时才拉取索引，且单个索引失败不影响其余索引。
- 证据：新增解析与匹配单测 5 例、组件单测 4 例、表格/卡片集成测试 2 例；`task-plugins` 全量 376 例通过；`lint`、`lint:design:strict`、`copyright:check`、`i18n:check` 通过。

## 使用方式

- 每批开始前：重新核对上游对应提交与 Uter 当前实现的语义差异，更新本清单状态；
- 每批完成时：补充证据链接（提交/测试/报告），并将状态改为 VERIFIED；
- 任何「全量合并上游」的做法均不通过安全审查。