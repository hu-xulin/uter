\---  
title: Uter 上线验收测试用例集  
version: V1.5.1  
baseline: eedf3e2ce（main，v1.3.77）  
updated: 2026-10-23（V1.5.1 修复轮）  
\---

# Uter 上线验收测试用例集 · V1.5.1

> **V1.5.1 修复轮说明（2026-10-23）**
>
> V1.5.0 实测出的 5 个缺陷（DEF-4~DEF-8）全部修复，3 个待裁决项完成裁定，对应用例由 FAIL/观察项改回**回归通过**：
> - DEF-4 密码强度：`ValidateNewAccountPasswordStrength` 接入全部存密码路径（注册/建号/改号/自助改密/初始化），模型层 `prepareForInsert` / `UpdateWithTx` / `EditWithTx` / `ChangeUserPassword` 兜底；强度校验排在二次验证之后；重置密码改强随机生成；上限与前端统一 128
> - DEF-5 令牌明文：新增 `VerificationScopeTokenKeyRead`，`/api/token/:id/key` 与 `/api/token/batch/keys` 挂 `TokenKeySecureVerificationRequired`，PAT 不可用
> - DEF-6 计费击穿：准入余额（减债务下限）延续为会话级计费上限，结算时对钱包会话硬截断，日志记截断后生效额，不变量不被打破
> - DEF-7/8 webhook：secret 未回传即保留原值（指针区分缺失与显式清空）；URL 限定 http(s)
> - 待裁决：PRIO-006/007 增加稳定错误码（已修复）；BE-CHN-003 裁定为「空串即脱敏形态，有意设计」（不修复）；`GET /api/setup` 的 `database_type` 空值已修复
>
> 各修复均有对应回归测试（见 §8.1「状态」列）；全量 Go 单测、前端单测、`tsgo` 类型检查、i18n 键检查通过。
>
> **黑盒复测（同日，20/20 通过）**：以修复后构建在 SQLite + mock 上游环境对 DEF-4~DEF-8、BE-TOK-020/021、PRIO-006/007、SETUP-001、BE-BIL-031 全部关联检查点复跑，20 个检查点全部通过（弱口令四拒一收、令牌明文 403 `SECURITY_PROOF_REQUIRED`、secret 保留/显式清空、非 http(s) URL 四拒一收、`database_type=sqlite`、渠道优先级两个稳定错误码、计费截断 + 不变量 + 耗尽后准入 403）。复跑期间曾遇 `CriticalRateLimit`（20 次 / 20 分钟 / IP）429，重启 QA 服务清内存计数后通过，属测试基建行为。

> **V1.5.0 修订说明（2026-10-23，基线 `eedf3e2ce` / v1.3.77）**
>
> 本次对 `d4c540ebc` 之后的 32 个提交（10-18 ~ 10-22）做覆盖，并把**安全 / 计费 / 支付**三条主线按可复现的黑盒断言重写。
>
> **1）新增（第 10 章 + 续号，共约 100 条；全文用例行 821 → 888）**
> - 渠道优先级子系统（PRIO-*，17 条）：revision 乐观锁、preview 不落库、restore 撤销、channels+abilities 双写、拖拽即时生效
> - DeepSeek 托管工具 `/v1/tools/search`、`/v1/tools/fetch`（BE-DST-*，9 条）：强制 RoutingModel、按次计价 375 quota、忽略请求体 model
> - 通知体系（BE-NOT-*，14 条）：`quota_warning_enabled`、`channel_notify_enabled`、阈值跨点提醒、通知限额窗口、webhook 校验
> - Resend 邮件（BE-EML 续号，5 条）：`ResendKeyConfigured` 只回布尔、非法值拒绝、发送失败降级
> - 缓存 token 看板（BE-BIL 续号，6 条）：`cache_read_tokens` / `cache_creation_tokens` 独立列、`/api/data/self` 暴露、quota_data 累加
> - 过载哨兵（BE-SEC 续号，6 条）：cgroup 配额采样、连续 3 次超阈值才熔断、阈值热更新、503 + `system_*_overloaded`
> - Redis NOSCRIPT 回退（BE-INF 续号，3 条）、任务重试补预扣（BE-TASK 续号，4 条）、`settle_error` 标记（BE-BIL 续号）
> - kling 插件 1.1.1（BE-PLG 续号，5 条）：单 Key 直传、`sk-` 走网关、`access|secret` 两段仍兼容
> - 阿里多模态 embedding（BE-RLY 续号，5 条）：`qwen3-vl-embedding` 走原生 `multimodal-embedding` 端点
> - 审计索引（BE-AUD 续号，3 条）：`idx_audit_time_event` 覆盖 `created_at + event_id`
>
> **2）修订（原断言与实现不符，按实测行为改写并登记缺陷）**
> - `BE-PWD-001~008`：密码强度校验曾整体失效（DEF-4，V1.5.1 已修复），现为**缺陷回归用例**
> - `BE-TOK-020/021/022`：二次验证中间件曾在路由上缺失（DEF-5，V1.5.1 已修复），现为回归用例
> - `BE-BIL-009`：无限额度令牌仍会扣减用户余额（实测 delta=10000），原断言「不扣余额」错误
> - `BE-BIL-006`：余额不足需以 `max_tokens` 触发预扣才可复现；小额余额 + 大额实扣曾击穿不变量（DEF-6，V1.5.1 已修复）
> - `BE-SEL-002`：渠道优先级已由 revision 子系统接管，原「priority 数值比较」口径改为「优先级序列 + 落库一致性」
> - `BE-CHN-003`：渠道详情 key 返回空串即脱敏形态（明文不泄露，前端显式不回填密钥），V1.5.1 裁定为有意设计
>
> **3）删除 / 合并（实现已下线或口径被取代）**
> - `BE-CST-007` 语义缓存：功能已整体下线，用例标注 ⛔ 并保留占位（避免编号复用导致追溯断链）
> - `BE-SEL-002` 旧「priority 数值比较」口径被渠道优先级子系统取代，改写为「优先级序列 + 落库一致性」（详见 PRIO-*）
> - 原「有损降本」整组（V1.2.2 已下线）：用例保留为**勿回退断言**（BE-CST-010/011/013），不再作为功能验收项
>
> **4）新增缺陷 / 缺口**
> - DEF-4 密码策略失效、DEF-5 令牌明文无二次验证、DEF-6 计费不变量可击穿、DEF-7 webhook secret 静默清空、DEF-8 webhook URL 未限定 http(s)（**五个缺陷均已在 V1.5.1 修复**，见 §8.1 状态列）
> - GAP-17 渠道 BaseURL 不受 SSRF 约束（**经复核为设计如此**，见 §10.7）、GAP-18 `relaykit` 独立模块导致 `./relaykit/...` 在主模块下 `[setup failed]`


> **本次修订说明**
>
> 上一版（V1.1.0）文档在流转过程中发生结构损坏：章节乱序重复、表格被拍平为纯文本、  
> 大量用例正文丢失。本版在**原 456 条用例全部保留去重**的基础上做了三件事：
>
> 1. **修复**：还原被拍平的表格，按模块重排，去掉重复段落与残留的分隔噪音。
> 2. **补齐**：V1.1.0 丢失的用例正文重新编写（核心是 BE-CHN 渠道管理整段 29 条全丢，  
>    另有 BE-OAU/BE-PLG/BE-PAY/BE-OPS 等 12 个模块共 45 条断号）。
> 3. **新增**：
>    - **第 3 章 前端用例（FE-*）**：V1.1.0 仅在第 0 章提及「第 3 章是前端」，  
>      但正文一条 FE 用例都没有。本次补齐 103 条。
>    - **第 4 章 新增后端模块**：降本优化（BE-CST）、运行时多语言（BE-I18N）、  
>      热更新（BE-HOT）、智能客服集成（BE-CS）——这 4 个模块路由/代码已存在但零用例。
>    - **第 5～8 章**：非功能测试、上线冒烟清单、自动化回归映射、缺陷与已知缺口登记  
>      （V1.1.0 正文引用了「§8.5 GAP-01~04」但该章从未落地）。
>
> 用例总数：**V1.1.0 456 条 → V1.2.0 695 条**（BE 558 / FE 103 / NF 24 / SMOKE 10）。

#### V1.2.1 增量（本次安全/计费加固）

在 V1.2.0 基础上新增 4 条，并修订基线说明（代码改动落在 `b5120fe` 之后的两个提交）：

- **BE-TOK-022（P0）**：新增——PAT（无实时会话）取令牌明文被 403 `SECURITY_PROOF_INVALID` 拦截，敏感操作仅限交互式会话。
- **BE-BIL-022（P0）**：新增——扣费落库失败时用量日志 `quota` 记为 0 并打 `settle_error`，杜绝「全额已扣」虚假账单。
- **BE-CHN-033（P0）**：新增——openai-sb 余额查询的 API Key 不再进 URL query，改走 `Authorization` 头。
- **FE-LST-009（P0）**：新增——API Keys 页查看/复制明文必须先过二次验证弹窗。
- **BE-TOK-020/021** 仍有效：已登录但未持有效安全证明时取明文一律 403 `SECURITY_PROOF_REQUIRED`。

#### V1.2.2 增量（本次：缓存用量统计 + 有损降本下线 + 密钥掩码）

对齐 `9dd3d1b`（缓存统计）、`274107b`（有损降本下线）、`9fd750a`（模型描述兜底）、`15c93dc`（密钥掩码）、`ebabb48`（日志列展示）五个提交。

**新增 20 条**

- **BE-LOG-015~020（缓存写入/读取统计）**：缓存量从 `other` JSON 提升为独立列后的落库、聚合接口、历史回填、计价倍率、流式与非流式对称性。其中 BE-LOG-015/017 为 P0。
- **BE-CST-010~013（有损降本已下线）**：反向验收——模型名恒等于客户所选、客户传入内容不被改写或裁剪、压缩/上下文窗口/工具精简/图像下采样/结构化输出/短路的调用点已不存在、普通问答不被注入 `json_object`。BE-CST-010/011/012 为 P0。
- **BE-MDL-021~024（模型描述多语化兜底）**：上游目录未提供中文条目时 zh 须兜底补译、既有 zh/ja 不被覆盖、默认 6 语与后端一致。
- **BE-OPT-015~017（密钥掩码）**：微信支付三键与 `batch_embed_api_key` 不得明文下发；新增敏感配置项必须登记。BE-OPT-015/017 为 P0。
- **FE-LST-010~012（前端展示）**：汇总条缓存项**恒显示含 0**，token 列四项竖排且缓存项 >0 才显示。

**关闭 2 条（功能已删除，不再执行）**

- **BE-CST-007**（语义缓存命中）：语义缓存整体移除，用例保留删除线标记说明下线原因，编号不复用以免历史执行记录错位。
- **GAP-05**（语义缓存为内存 O(n) 线性扫描）：缺口随功能下线关闭。

#### V1.3.0 增量（本次：new-api rc.38–rc.44 对齐 + 安全/计费加固）

对齐 `d6475f263`（Go 后端）与 `7b4ed2a98`（SPA 前端）两个「align with new-api (rc.38–rc.44)」提交，
以及其后一串定向修复（限流 ctx、计费热路径、支付金额比对、孤儿 token、jsplugin 看门狗、模型描述翻译、
渠道价格重试、XSS 加固、i18n 懒加载）。新增 5 个后端子系统的验收用例，为既有模块续号，并登记本次
执行发现且已修复的 1 个构建缺陷。**详细用例见第 9 章**。

**新增 5 个模块**

- **BE-ATK-001~014（访问令牌 Access Tokens）**：区别于 API Key 的「面板个人访问令牌（PAT）」子系统。
  范围化权限（scope）、仅交互式会话可管理令牌、创建/改权限/吊销须过二次验证、旧版 `users.access_token` 退役、
  每用户数量上限与最短有效期、审计四连（generate/rename/update/revoke）。其中 001/002/003/006/010 为 P0。
- **BE-RQP-001~008（请求策略 Request Policies）**：`/api/option/request_policy` 校验读模型、重试次数与
  渠道亲和选项合法域、非法值拒绝且不落库、已下线的 `mode` 开关不再接受。其中 001/004/006 为 P0。
- **BE-AFF-001~008（渠道亲和 Channel Affinity）**：会话规则（正则/请求头来源/会话模式）、亲和缓存统计与清空、
  渠道被删后轮询锁回收、`keep_on_channel_disabled` 语义。其中 001/005 为 P0。
- **BE-WSR-001~008（托管联网搜索 Web Search）**：OpenAI `web_search_*` 工具到 DashScope/XAI/智谱的映射、
  语义损失诊断（`blocked_domains`/`max_uses`/`user_location` 丢弃须上报）、按 `usage.x_tools.web_search.count` 计价。其中 002/005 为 P0。
- **BE-PERF-001~004（性能指标与结果归因）**：`pkg/perf_metrics/outcome` 对请求结果的归类与暴露。

**既有模块续号**

- **BE-LOG-021~024（日志导出）**：`GET /api/log/export` 并发互斥、组织管理员仅见本组织、`log_export_enabled` 开关、导出内容不含密钥。其中 021/023 为 P0。
- **BE-RLY-030~032（Responses over WebSocket）**：新协议握手工序、结算打 request policy 成功标记、断连不重复扣费。
- **BE-CHN-034~037（AdvancedCustom 预设 / Rerank / 推理状态 / 重定向）**：SGLang 预设 URL 前缀、rerank 通道、渠道推理状态、模型重定向/批量映射/头部透传。
- **BE-OPS-014~016（运维维护）**：历史日志清理、服务端日志文件查看、`usedata` 迁移守卫。

**加固修复回归（BE-FIX-001~006）**：Redis 限流 ctx 生命周期、计费热路径组织归属复用、易支付/Creem 实付金额比对、
孤儿 token 401 + 可信代理收紧为回环、jsplugin 堆看门狗与无符号下溢误杀、渠道价格重试释放响应体与响应客户端断开。

**本次执行发现并修复**

- **DEF-130-1（P1，已修复）**：`tokenkit` 子模块 `go.mod` 的 `go` 指令为 `1.25.1`，低于其直接依赖
  `tiktoken-go/tokenizer` 要求的 `1.26`，`go build ./...` 与 `go test ./...` 均报
  「updates to go.mod needed」而无法编译/测试（由对齐提交 `d6475f263` 引入）。已 `go mod tidy`
  升至 `go 1.26`（与主模块一致），无依赖/`go.sum` 变更，三模块测试转绿。

#### V1.4.0 增量（本次：渠道编号迁移 + 前端对齐收尾 + 安全加固 8 项 + 计费/中继竞争修复）

基线从 `ebabb48` 推进到 `d4c540ebc`（33 个提交，版本 v1.3.60→v1.3.62）。本次逐条核对代码后：
**修订 15 条、关闭 6 个缺口、新增 29 条、新登记 2 个缺口**。

**修订（行为/编号已变，原断言会误判）**

- **渠道类型编号迁移**（`b1655a5d2`）：对齐上游 new-api 编号——`NewAPI=60`/`TaskPlugin=61`/
  `vLLM=62`/`SGLang=63`；Uter 品牌渠道移至 `600/601/602`（原 62/63/64），`ChannelTypeDummy=602`。
  受影响用例：BE-MAP-001/003/004/005、BE-RLY-021/023/024/025、BE-CHN-034、BE-SEL-006、
  FE-CHN-008、§1.4 数据准备清单。**渠道类型编号会落库，禁止再次漂移。**
- **BE-RLY-021**：RelayMode 实为 **35 个**（0–34，`RelayModeAlphaSearch` 为最大值），
  原文档记 37 系笔误，本次按常量表改正。
- **BE-SEC-004**：敏感词过滤**默认已改为关闭**（`862cd120f` 对齐上游 4013729f：
  `CheckSensitiveEnabled`/`CheckSensitiveOnPromptEnabled` 默认 false、默认词表清空）。
  全新安装/未设置该 option 时不过滤；已在库显式设置过的实例不受影响。
- **BE-TOK-016**：`GET /api/token/search` 之外新增 `POST /api/token/search`（`742410cb2`），
  筛选条件改走请求体，GET 端点保留给仅用名称关键字的既有调用方。
- **BE-ORG-016**：补充并发超支的已量化语义（预扣为 0 时唯一闸门是只读 `EnforceOrgQuota`，
  并发突发放行笔数可达并发度量级；顺序执行时超支被单次调用成本界定）。

**关闭（GAP-09～GAP-14 全部修复，`4edfd912f`/`be46331f5`/`3b896af44`）**

- GAP-09 审计渲染函数签名漂移：已接入 `scopeResources` 三参与 `showBillingSource`。
- GAP-10 渠道亲和「会话规则」页 prop 契约冲突：`ChannelAffinitySection` 已支持表单驱动入参。
- GAP-11 `UpstreamUpdateDialog` props 形态：已改扁平 props。
- GAP-12 `ChannelConfiguration` 缺 `quickOptions`：已接入并补透传确认流。
- GAP-13 `section-registry` 的 `defaultValues`/`trust_quota_usd`：quotaSchema 已补字段。
- GAP-14 上游测试引用 uter 不存在的常量：5 个测试文件已本地化，**逐文件单跑全绿**
  （details 56/56、responses-websocket-setting 19/19、channel-quick-options 17/17、
  theme-preferences 8/8、group-pricing-decimals 2/2；`group-settings.test.tsx` 9/9 亦转绿）。

**新增 29 条**

- **安全加固 8 项回归**（`742410cb2`/`e11551977`/`4b39b86f8`）：组织预算负数不再静默折算为
  不限额（BE-ORG-024）、支付计价失败不再打开确认框（BE-PAY-015）、支付跳转统一校验
  （BE-PAY-016）、Stripe 零小数币种（BE-PAY-017）、WaffoPancake 负金额拦截（BE-PAY-018）、
  OAuth 登录 nonce 防 CSRF（BE-OAU-016）、未验证邮箱 fail-closed（BE-OAU-017）、
  密码重置凭证清 URL（FE-FRM-012）。
- **并发超支不变量**（BE-ORG-025）：固化 e2e `TestOrgBillingOvershootBoundedByOneCall` 与
  `TestOrgBillingOvershootConcurrent` 的安全不变量。
- **预扣新设置**（`7384e088e`）：`quota_setting.pre_consume_multiplier`（默认 1）与
  `quota_setting.trust_quota_usd`（默认 10，0=禁用）的读写与非法值拒绝（BE-OPT-018/BE-BIL-023/024）。
- **渠道编号迁移回归**（BE-RLY-033/BE-MAP-006）：全表遍历 + 前后端 constants.ts 一致性。
- **语言切换修复**（`b7a4e58a8`/`272a07e47`）：首点即生效、切换不回退、语言包合并后重渲染
  （FE-I18N-009/010/011）。
- **页脚备案三件套**（`c42a0275c`/`b84f5f7d7`）：横排布局、仅备案号可点击、7 语种译文
  （FE-SITE-008/009/010）。
- **其余前端对齐**：playground reasoning 透传与 iframe 同源沙箱（FE-PG-007/008）、
  命令菜单权限过滤与管理员创建身份确认（FE-PRM-008/009）、定价 6 项排序（FE-BIL-009）、
  钱包/组织页加载失败态（FE-LST-013）。

**新登记缺口**

- **GAP-15（P1）**：品牌渠道 600/601/602 在 `ChannelType2APIType` 无显式 case，回落
  `(APITypeOpenAI, false)`——中继走 OpenAI adaptor 而非 AdvancedCustom adaptor，与
  `IsAdvancedCustomChannelType`「必须处处等同处理」的注释及前端「后端行为与 Advanced Custom
  完全一致」的宣称相悖。预存问题（旧编号 62/63/64 时同样如此），零测试覆盖，需确认后二选一：
  补 case 或修改注释与前端宣称。
- **GAP-16（P1）**：组织预算并发超支放大（TOCTOU）已量化并固化不变量，但是否加硬闸门
  （如预扣下限）需产品决策。

> 用例总数：V1.3.0 基线 789 条（BE 639 生效 + 1 条删除线保留 / FE 107 / NF 24 / SMOKE 10）
> → **V1.4.0 821 条**（BE 653 生效 + 1 条删除线保留 / FE 122 / NF 24 / SMOKE 10）。

---

## 0. 使用说明与通用约定

### 0.1 这份文档怎么用

按模块领取：**第 2 章是后端，第 3 章是前端，第 4 章是新增后端模块**。每条用例有唯一 ID，  
可直接用于提单与回归追踪。

每条用例四要素：**前置条件 → 操作步骤 → 预期结果 → 优先级**。前置条件不满足的用例不得执行，否则结果无效。

结果判定：与「预期结果」完全一致记 **Pass**；任一子项不符记 **Fail**；  
因环境/数据问题无法执行记 **Block**，需补数据后重跑。

- **P0** 100% 通过才允许上线；
- **P1** 允许遗留但需有规避方案；
- **P2** 可排期。

### 0.2 用例编号规则

| 段位 | 含义                                    |
| -- | ------------------------------------- |
| 前缀 | `BE-` 后端（接口/服务/数据）；`FE-` 前端（页面/交互/视觉） |
| 中段 | 模块缩写，见各章标题（如 AUTH/TOK/CHN/THM）        |
| 末段 | 三位序号，从 001 起                          |

示例：`BE-TOK-007` = 后端·令牌模块·第 7 条；`FE-I18N-003` = 前端·国际化·第 3 条。

### 0.3 优先级与缺陷等级

| 优先级 | 定义                        | 举例                       |
| --- | ------------------------- | ------------------------ |
| P0  | 阻断上线：资金错误、越权、核心链路不可用、数据丢失 | 扣费金额错误、普通用户可访问管理接口、登录不可用 |
| P1  | 主要功能受损，有替代路径              | 某筛选条件失效、某语言缺文案、导出格式错     |
| P2  | 体验/一致性/边缘场景               | 文案不统一、动画卡顿、极端窗口尺寸下错位     |

| 缺陷等级 | 判定                  |
| ---- | ------------------- |
| 致命   | 资损、越权、崩溃、数据不一致、安全漏洞 |
| 严重   | 主流程不可用且无绕行方案        |
| 一般   | 次流程异常 / 明显体验问题      |
| 轻微   | 文案、样式、边缘场景          |

### 0.4 通用断言（所有接口用例的默认预期，文中不再逐条重复）

1. 成功响应体为 `{"success": true, "message": "", "data": ...}`；失败为  
   `{"success": false, "message": "<可读文案>"}`，HTTP 状态码通常仍为 200，  
   **判成败必须看 `success` 字段**。
2. 失败文案必须是可读的业务句，不得是裸英文技术串（如 `status code: 404`），  
   不得包含密钥 / 完整令牌 / 上游域名。
3. 鉴权失败：未登录 → 401 或 `success:false`；权限不足 → 403；  
   **不得返回 200 + 他人数据**。
4. 所有写操作必须可在审计日志（`/api/audit`）或令牌操作审计中查到记录。
5. 响应不得泄露：渠道密钥、用户密码哈希、Access Token 明文、上游原始 URL 的 query 凭据。

---

## 1. 测试环境与数据准备

### 1.1 环境矩阵

| 环境         | 用途      | 地址                      | 数据库                | 备注                     |
| ---------- | ------- | ----------------------- | ------------------ | ---------------------- |
| 本地 dev     | 用例开发、调试 | `http://localhost:3000` | SQLite（one-api.db） | `./rebuild-all.sh` 后使用 |
| 预发 staging | 全量回归、性能 | 独立域名 + HTTPS            | PostgreSQL / MySQL | 必须与生产同版本、同配置项          |
| 生产 prod    | 上线后冒烟   | `https://uter.ai`       | 生产库                | 仅执行第 6 章冒烟清单           |

> Uter 的 SPA 与 API 共用同一端口（默认 3000，可用 `PORT` 覆盖）。前端由  
> `//go:embed all:web/dist` 内嵌进二进制，**不存在独立的前端进程**。所谓「前端没生效」  
> 通常是二进制没重建。

### 1.2 环境就绪验证（执行任何用例前必做）

| ID         | 步骤                                                                                                           | 预期                                                                        | P  |
| ---------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | -- |
| BE-ENV-001 | `curl --noproxy '*' -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/status`                      | 200，且响应包含 `success: true`                                                 | P0 |
| BE-ENV-002 | 核对运行进程是否为最新二进制：`ls -i uter-bin` 与 `lsof -nP -p <pid> \| awk '$4=="txt"{print $8}'` 比对                        | inode 一致（注意：`lsof` 第 7 列是字节数不是 inode）                                     | P0 |
| BE-ENV-003 | `ls web/dist/docs-content/docs` 与 `web/dist/docs-content/about`                                              | 两目录均存在且有 `index.html`                                                     | P0 |
| BE-ENV-004 | `strings uter-bin \| grep -c 'docs-content/docs/zh'`                                                         | 计数 > 0（为 0 说明二进制未含文档站，`/docs`、`/about` 会白屏返回 SPA 壳且 HTTP 200，极易误判为「页面没坏」） | P0 |
| BE-ENV-005 | `curl --noproxy '*' -s http://localhost:3000/docs-content/docs/zh/index.html \| head -c 200`                 | 返回真实文档 HTML，而非 SPA 壳                                                      | P0 |
| BE-ENV-006 | `curl --noproxy '*' -sI http://localhost:3000/favicon.ico`                                                   | 302 → `/logo.png`                                                         | P2 |
| BE-ENV-007 | 前端自检：`cd web && npx tsgo -b --force && npx oxlint -c .oxlintrc.json src scripts && node scripts/check-i18n-keys.mjs && bun run copyright:check` | 四者均 0 错误（`copyright:check` 为 V1.4.0 新增门禁，校验 AGPL 版权头） | P0 |
| BE-ENV-008 | 后端自检：`GOWORK=off go test -p 1 -count=1 ./...`（DB 型用例先停本机服务）                                                  | 全绿                                                                        | P0 |

> **关于 `bun run lint`**：项目 lint 含 `format:check`，会剥离 AGPL 版权头，  
> 不要作为环境自检项。用 `oxlint` 定向扫 `src scripts` 即可，  
> **不要扫 `web/public/plugins`**。

### 1.3 账号与角色矩阵（必须提前建好）

| 代号           | 角色       | role | 组织身份             | 用途                                      |
| ------------ | -------- | ---- | ---------------- | --------------------------------------- |
| U-ROOT       | 超管       | 100  | 无                | 系统设置、组织创建、任务插件                          |
| U-ADMIN      | 管理员      | 10   | 无                | 渠道/模型/用户/兑换码/订阅管理                       |
| U-USER       | 普通用户     | 1    | 无                | 令牌、日志、钱包、Playground                     |
| U-ORG-OWNER  | 普通用户     | 1    | owner            | 组织预算与成员管理                               |
| U-ORG-ADMIN  | 普通用户     | 1    | admin            | 组织管理（受限）                                |
| U-ORG-DEPT   | 普通用户     | 1    | department_admin | 仅本部门                                    |
| U-ORG-MEMBER | 普通用户     | 1    | member           | 仅看自己的额度                                 |
| U-NOORG      | 普通用户     | 1    | 无组织              | 越权与空态验证                                 |
| U-PERM       | 管理员（被降权） | 10   | 无                | 取消 ChannelSensitiveWrite 后验证按钮禁用与接口 403 |

> 组织归属与系统角色**正交**：组织管理员不会因此获得全局 Admin 权限；超管也不是任何组织的成员。  
> 所有越权用例都围绕这条设计。

### 1.4 基础数据准备清单

| 类别  | 准备内容                                                                                         | 数量/要求                             |
| --- | -------------------------------------------------------------------------------------------- | --------------------------------- |
| 渠道  | OpenAI、Anthropic、Gemini、Azure、Ollama、Custom、AdvancedCustom(58)、Codex(57)、TaskPlugin(61)、vLLM(62)、SGLang(63)、BrandedShared(600)/BrandedAggregate(601)/BrandedProxy(602)、Uter(60，即 NewAPI) | 每类 ≥1；含 1 条故意填错密钥的渠道（验证错误提示与自动禁用） |
| 渠道  | 带 tag 的渠道、多 Key 渠道、禁用态渠道                                                                     | 各 ≥2                              |
| 分组  | default、vip、auto                                                                             | ≥3                                |
| 令牌  | 无限额度、有限额度、已过期、禁用、带模型限制、带 IP 白名单（含 CIDR）、跨分组重试                                                | 各 ≥1                              |
| 模型  | 已上架/隐藏/部分可用三种状态；含图片、音频、embedding、rerank 模型                                                   | 各 ≥1                              |
| 供应商 | 真实供应商 + 1 个合成默认品牌（负 ID）                                                                      | ≥2                                |
| 兑换码 | 未使用/已使用/已禁用/已过期                                                                              | 各 ≥1                              |
| 订阅  | 套餐 2 个（月/年），含 1 个已绑定用户                                                                       | ≥2                                |
| 日志  | 成功/失败/流式/多模态/任务/绘图 各类型                                                                       | 各 ≥10 条                           |
| 支付  | 至少 1 个渠道开通（Epay/Alipay/WeChat/Stripe/Creem/Waffo 之一），测试环境用沙箱                                 | ≥1                                |

> ⚠️ **渠道类型编号（V1.4.0 起，`b1655a5d2`，会落库勿漂移）**：0–63 为与上游 new-api 共享的编号段
> （`Uter=NewAPI=60`、`TaskPlugin=61`、`vLLM=62`、`SGLang=63`）；Uter 品牌渠道独占 600 起：
> `BrandedShared=600`/`BrandedAggregate=601`/`BrandedProxy=602`（`ChannelTypeDummy=602`）。
> 全部有效类型共 63 个；`IsAdvancedCustomChannelType` 为 true 的集合是
> **{58, 62, 63, 600, 601, 602}**（AdvancedCustom 及其五个一等变体）。

> ⚠️ **本地 dev 环境现状（2026-10-09 实测）**：仅 1 条渠道、1 个组织、4 条令牌、  
> 638 条日志、1 张兑换码，**不满足上述清单**。因此依赖真实上游的用例（BE-RLY/BE-TASK/  
> BE-BIL 的大部分）在本地只能判 **Block**，须在预发环境执行。

### 1.5 测试工具

| 用途  | 工具                                            | 备注                                                    |
| --- | --------------------------------------------- | ----------------------------------------------------- |
| 接口  | curl（**必须加 `--noproxy '*'`**）、Postman / Bruno | 本机有出站代理，不加会拿到代理返回的 000/502                            |
| 浏览器 | Chrome + Playwright CLI                       | 前端 iframe、软导航、主题必须实测，不能只看代码                           |
| 数据库 | sqlite3 / psql / mysql                        | ⚠️ 改 `options` 或裸写库**必须先停服务**（SyncOptions 会把内存值写回 DB） |
| 日志  | `/tmp/uter-console.log`、`logs/`               | 扣费、鉴权、中继错误排查                                          |
| 前端  | `web/` 目录下的 `npx vitest` / `tsgo`             | ⚠️ 运行 vitest 必须 `env -u NODE_OPTIONS`（见 §7.3）         |

---

## 2. 后端测试用例

### 2.1 系统初始化与安装向导（BE-SET）

| ID         | 前置                            | 步骤                                                                                                | 预期                                                 | P  |
| ---------- | ----------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -- |
| BE-SET-001 | 全新空库                          | GET /api/setup                                                                                    | data.status=false、root_init=false、database_type 正确 | P0 |
| BE-SET-002 | 未初始化                          | 浏览器访问 /                                                                                           | 自动跳转 /setup，展示向导                                   | P0 |
| BE-SET-003 | 未初始化                          | POST /api/setup 传 username=root、password=Uter@Test2026、confirmPassword 一致、SelfUseModeEnabled=true | success:true，创建 role=100 的账号                       | P0 |
| BE-SET-004 | 未初始化                          | 两次密码不一致提交                                                                                         | success:false，提示两次输入不一致，不创建用户                      | P0 |
| BE-SET-005 | 未初始化                          | 密码 7 位 / 19 位提交                                                                                   | 拒绝，提示长度 8–18                                       | P0 |
| BE-SET-006 | 未初始化                          | 密码为弱口令（password、12345678、qwerty123）                                                               | 拒绝                                                 | P0 |
| BE-SET-007 | 已初始化                          | 再次 POST /api/setup（任意参数）                                                                          | 拒绝并返回「已初始化」，不改写 SelfUseModeEnabled/DemoSiteEnabled | P0 |
| BE-SET-008 | 库内已存在 role=100 用户但 setups 表缺失 | POST /api/setup                                                                                   | 拒绝（防止匿名接管），原账号可正常登录                                | P0 |
| BE-SET-009 | 已初始化                          | GET /api/setup                                                                                    | status=true；再访问 /setup 重定向到 /                      | P0 |
| BE-SET-010 | 已初始化                          | 重置：make reset-setup（删 setups + role=100 用户 + 两个 option 后重启）                                       | 回到未初始化态，向导可重跑                                      | P1 |
| BE-SET-011 | 未初始化                          | 并发 5 个 POST /api/setup                                                                            | 仅 1 个成功创建 root，其余返回已初始化；不产生多个 root                 | P1 |


### 2.2 注册（BE-REG）

| ID         | 前置                    | 步骤                                                           | 预期                                            | P  |
| ---------- | --------------------- | ------------------------------------------------------------ | --------------------------------------------- | -- |
| BE-REG-001 | 允许注册                  | POST /api/user/register 合法用户名+邮箱+合规密码                        | 创建成功，role=1，可直接登录                             | P0 |
| BE-REG-002 | 同上                    | 用户名重复                                                        | 拒绝，提示用户名已存在                                   | P0 |
| BE-REG-003 | 同上                    | 邮箱重复                                                         | 拒绝，错误码 EMAIL_ALREADY_TAKEN 映射到可读句             | P0 |
| BE-REG-004 | 关闭注册开关                | 提交注册                                                         | 拒绝；前端不展示注册入口                                  | P0 |
| BE-REG-005 | 邮箱域名白名单开启，白名单=uter.ai | 用 [a@gmail.com](a@gmail.com) 注册                              | 拒绝，错误码 EMAIL_DOMAIN_NOT_SUPPORTED，文案为可读句非英文裸串 | P0 |
| BE-REG-006 | 同上                    | 用 [a@uter.ai](a@uter.ai) 注册                                  | 成功                                            | P0 |
| BE-REG-007 | 白名单开启但列表为空            | 任意邮箱注册                                                       | 全部拒绝（不能放行）                                    | P0 |
| BE-REG-008 | 别名限制开启                | 用 [a+1@uter.ai](a+1@uter.ai) / [a.b@uter.ai](a.b@uter.ai) 注册 | 拒绝，错误码 EMAIL_ALIAS_NOT_SUPPORTED              | P1 |
| BE-REG-009 | 开启 Turnstile          | 不带人机校验令牌注册                                                   | 被拦截                                           | P1 |
| BE-REG-010 | 开启法务同意                | 未勾选协议直接提交                                                    | 前端拦截并 Toast 提示                                | P1 |
| BE-REG-011 | 同 IP 连续注册 20 次        | 触发 CriticalRateLimit                                         | 返回限流提示，服务不崩                                   | P1 |
| BE-REG-012 | 注册成功需邮箱验证             | 注册后未验证直接登录                                                   | 按配置：需验证则拦截并提示；可配置关闭                           | P1 |
| BE-REG-013 | 邀请码/推广 ?aff=xxx       | 带 aff 注册                                                     | aff 关系落库，GET /api/user/aff 可查                 | P2 |

### 2.3 登录与会话（BE-SES）

| ID         | 前置                              | 步骤                                                              | 预期                                                           | P  |
| ---------- | ------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------ | -- |
| BE-SES-001 | 有效账号                            | POST /api/user/login（密码走 GET /api/user/login/encryption-key 加密） | 成功，下发会话 Cookie + refresh Cookie                              | P0 |
| BE-SES-003 | 有效账号                            | 错密码连续 5 次后，再输正确密码登录                                             | 达阈值后触发限流；限流解除后正确密码可登录，账号不被永久锁定                               | P0 |
| BE-SES-004 | 已登录                             | POST /api/user/auth/refresh（带 refresh Cookie + Origin 头）        | 返回新 access，refresh 轮换（旧 refresh 失效）                          | P0 |
| BE-SES-005 | 已登录                             | 用已轮换掉的旧 refresh 再刷新                                             | 拒绝；同 SID 下会话整体失效                                             | P0 |
| BE-SES-006 | 已登录                             | POST /api/user/auth/refresh 不带 Origin / 带伪造 Origin              | 被 SessionCookieOriginGuard 拦截                                | P0 |
| BE-SES-007 | 已登录                             | 1 分钟内连续 refresh 200 次                                           | 触发 SessionRateLimit（默认档 120 次/20min，续期档 ×6）                  | P1 |
| BE-SES-008 | 已登录                             | POST /api/user/auth/logout                                      | 当前会话失效，再访问受保护接口 401                                          | P0 |
| BE-SES-009 | 多端登录                            | GET /api/user/sessions                                          | 列出全部会话（IP/UA/时间），当前会话有标记                                     | P1 |
| BE-SES-010 | 多端登录                            | DELETE /api/user/sessions/:sid                                  | 指定会话被踢，其余不受影响                                                | P1 |
| BE-SES-011 | 多端登录                            | POST /api/user/sessions/revoke-others                           | 仅保留当前，其余全部失效                                                 | P1 |
| BE-SES-012 | 已登出                             | 再次 auth/logout                                                  | 幂等，不报错                                                       | P2 |
| BE-SES-013 | A 标签页已登录                        | B 标签页登出                                                         | A 页收到会话事件并跳转登录页                                              | P1 |
| BE-SES-014 | 无 Cookie                        | 直连 /api/user/self                                               | 401；不得返回 200 + 空对象                                           | P0 |
| BE-SES-015 | 伪造/篡改 Cookie                    | 访问受保护接口                                                         | 401，且不泄露校验细节                                                 | P0 |
| BE-SES-016 | 已开启 2FA 的账号                     | 仅用户名密码登录                                                        | 进入待验证态（login/verify 挑战），不直接发放会话                              | P0 |
| BE-SES-017 | USER_SESSION_ISSUANCE_LIMIT=100 | 同一账号在窗口内连续签发 101 个会话                                            | 超限被拒并给出可读提示；不因会话膨胀拖垮性能                                       | P1 |
| BE-SES-018 | —                               | 触发 StartAuthArtifactCleanup（1h 周期），检查过期会话与 auth_flows 状态        | 过期产物被清理，保留期 7 天（USER_SESSION_REVOKED_RETENTION_DAYS）内的数据不被误删 | P1 |

### 2.4 密码策略与找回（BE-PWD）

| ID         | 前置          | 步骤                                             | 预期                                        | P  |
| ---------- | ----------- | ---------------------------------------------- | ----------------------------------------- | -- |
| BE-PWD-001 | 注册/改密       | 密码长度 7 / 8 / 18 / 19（按 Unicode 码点计，中文算 1 位）    | 7、19 拒绝；8、18 通过。**实测通过**（边界 8/128 生效）    | P0 |
| BE-PWD-002 | 同上          | 仅字母 / 仅数字 / 仅符号                                | 拒绝（字母、数字、符号至少两类）。**✅ 已修复（V1.5.1）：`abcdefgh` 被拒**（DEF-4 回归） | P0 |
| BE-PWD-003 | 同上          | 含用户名（≥4 字符时判定）或邮箱本地部分                          | 拒绝。**✅ 已修复（V1.5.1）：策略在服务端全入口生效**（DEF-4 回归）                | P0 |
| BE-PWD-004 | 同上          | leet 变形绕过：usern@me123（@→a）                     | 拒绝（符号归一化后命中）。**✅ 已修复（V1.5.1）**（DEF-4 回归）            | P0 |
| BE-PWD-005 | 同上          | 弱口令 password / 12345678 / qwerty123 / iloveyou | 拒绝。**✅ 已修复（V1.5.1）：`password` 被拒**（DEF-4 回归）        | P0 |
| BE-PWD-006 | 同上          | 连续升降序 abcd1234 / 4321dcba                      | 拒绝。**✅ 已修复（V1.5.1）**（DEF-4 回归）       | P0 |
| BE-PWD-007 | 同上          | 去重后 ≤2 种字符（如 aaaa1111）                         | 拒绝。**✅ 已修复（V1.5.1）**（DEF-4 回归）       | P0 |
| BE-PWD-008 | 同上          | P@ssw0rd123                                    | 拒绝（只被第三种归一化抓住，缺一不可）。**✅ 已修复（V1.5.1）**（DEF-4 回归）    | P0 |
| BE-PWD-009 | 已登录         | 修改密码：旧密码错误                                     | 拒绝                                        | P0 |
| BE-PWD-010 | 已登录         | 修改密码成功                                         | 成功；按配置决定是否踢掉其他会话；审计有记录                    | P0 |
| BE-PWD-011 | 未登录         | GET /api/reset_password?email=... 发送重置邮件       | 邮件标题「<目的>-Uter.ai 优特智能」，正文含品牌 logo，链接无下划线 | P1 |
| BE-PWD-012 | 收到重置邮件      | 用链接内 token POST /api/user/reset 设新密码           | 成功，token 单次有效                             | P0 |
| BE-PWD-013 | 同上          | 重复使用同一 token                                   | 拒绝                                        | P0 |
| BE-PWD-014 | 同上          | token 超期后使用                                    | 拒绝，提示过期                                   | P1 |
| BE-PWD-015 | 同上          | 新密码不符合策略                                       | 拒绝，且 token 不失效                            | P1 |
| BE-PWD-016 | 未知邮箱        | 请求重置                                           | 返回统一成功语义（防账号枚举），不泄露邮箱是否注册                 | P0 |
| BE-PWD-017 | 连续请求 20 次重置 | 触发 CriticalRateLimit                           | 限流生效                                      | P1 |

### 2.5 邮箱绑定、验证码与域名限制（BE-EML）

| ID         | 前置                              | 步骤                                                 | 预期                                                  | P  |
| ---------- | ------------------------------- | -------------------------------------------------- | --------------------------------------------------- | -- |
| BE-EML-001 | 已登录                             | GET /api/verification?email=...                    | 发送 6 位验证码，前端 30s 倒计时生效                              | P0 |
| BE-EML-002 | 收到验证码                           | POST /api/oauth/email/bind 提交正确码                   | 绑定成功，GET /api/user/oauth/bindings 可见                | P0 |
| BE-EML-003 | 同上                              | 提交错误码 5 次                                          | 达上限后拒绝并要求重发                                         | P0 |
| BE-EML-004 | 同上                              | POST /api/oauth/email/bind/resend                  | 重发成功，旧码立即失效                                         | P0 |
| BE-EML-005 | 域名白名单开启                         | 绑定非白名单邮箱                                           | 拒绝，EMAIL_DOMAIN_NOT_SUPPORTED 映射为可读句                | P0 |
| BE-EML-006 | 别名限制开启                          | 绑定 [a+1@uter.ai](a+1@uter.ai)                      | 拒绝，EMAIL_ALIAS_NOT_SUPPORTED                        | P1 |
| BE-EML-007 | 邮箱已被他人绑定                        | 绑定该邮箱                                              | 拒绝，EMAIL_ADDRESS_REJECTED / 已占用语义文案                 | P0 |
| BE-EML-008 | SMTP 不可用                        | 请求发送验证码                                            | 拒绝，EMAIL_BINDING_DELIVERY_FAILED 可读句；不暴露 SMTP 地址/账号 | P1 |
| BE-EML-009 | 同账号 1 分钟内请求 10 次验证码             | 触发 EmailVerificationRateLimit                      | 限流生效                                                | P1 |
| BE-EML-010 | 管理员                             | DELETE /api/user/:id/bindings/:binding_type（email） | 解绑成功，审计有记录                                          | P1 |
| BE-EML-011 | 开启 EmailAliasRestrictionEnabled | 绑定 a+1@domain 与 a.b@domain                         | 均被拒，错误码映射为可读句（EMAIL_ALIAS_NOT_SUPPORTED），不回显英文裸串    | P1 |

### 2.6 两步验证 2FA（BE-2FA）

| ID         | 前置        | 步骤                                   | 预期                                              | P  |
| ---------- | --------- | ------------------------------------ | ----------------------------------------------- | -- |
| BE-2FA-001 | 已登录       | GET /api/user/2fa/status             | 返回未启用                                           | P0 |
| BE-2FA-002 | 已登录、需安全验证 | POST /api/user/2fa/setup             | 返回 otpauth:// 密钥与二维码数据，此时尚未启用                   | P0 |
| BE-2FA-003 | 拿到密钥      | 用错误 TOTP 码 POST /api/user/2fa/enable | 拒绝，仍未启用                                         | P0 |
| BE-2FA-005 | 已启用       | 用正确 TOTP 码 POST /api/user/2fa/enable | 启用成功，返回备用码（仅此一次明文）                              | P0 |
| BE-2FA-006 | 已启用       | 用备用码登录                               | 成功，该备用码单次有效                                     | P0 |
| BE-2FA-007 | 已启用       | 重复使用同一备用码                            | 拒绝                                              | P0 |
| BE-2FA-008 | 已启用       | 使用过期（上一窗口）TOTP 码                     | 按配置：窗口内容差通过 / 超窗拒绝                              | P1 |
| BE-2FA-009 | 已启用       | POST /api/user/2fa/backup_codes 重新生成 | 旧备用码全部失效，新码可用                                   | P0 |
| BE-2FA-010 | 已启用       | POST /api/user/2fa/disable（带正确码）     | 关闭成功                                            | P0 |
| BE-2FA-011 | 已启用       | 带错误码禁用                               | 拒绝                                              | P1 |
| BE-2FA-012 | 管理员       | DELETE /api/user/:id/2fa             | 管理员重置成功；审计有记录                                   | P0 |
| BE-2FA-013 | 管理员       | GET /api/user/2fa/stats              | 返回平台 2FA 启用统计，数值与实际一致                           | P2 |
| BE-2FA-014 | 已启用       | 连续 10 次错误 TOTP                       | 触发 UserCriticalRateLimit(security-verification) | P0 |

### 2.7 Passkey / WebAuthn（BE-PK）

| ID        | 前置                | 步骤                                                                                           | 预期                                               | P  |
| --------- | ----------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------ | -- |
| BE-PK-001 | 已登录               | GET /api/user/passkey                                                                        | 返回当前状态与已注册凭据列表（不含私钥）                             | P0 |
| BE-PK-002 | 已登录               | POST /api/user/passkey/register/begin → 浏览器 navigator.credentials.create() → register/finish | 注册成功                                             | P0 |
| BE-PK-003 | 已注册               | 登出 → POST /api/user/passkey/login/begin → login/finish                                       | 无密码登录成功                                          | P0 |
| BE-PK-004 | 已注册               | 换域名/换 RP ID 登录                                                                               | 拒绝（RPID 已含 r.Host + 回环 origin 补全）                | P0 |
| BE-PK-006 | 已注册               | DELETE /api/user/passkey/:id                                                                 | 删除指定凭据成功；其余凭据不受影响                                | P1 |
| BE-PK-007 | 安全验证场景            | POST /api/user/passkey/verify/begin → verify/finish                                          | 验证通过，可用于渠道密钥解锁等敏感操作                              | P0 |
| BE-PK-008 | 管理员               | DELETE /api/user/:id/reset_passkey                                                           | 清空该用户 Passkey，审计有记录                              | P1 |
| BE-PK-009 | 不支持 WebAuthn 的浏览器 | 访问登录页                                                                                        | 提示「Passkey is not supported on this device.」，不报错 | P2 |
| BE-PK-010 | 已注册               | 重放同一个 assertion（challenge 复用）                                                                | 拒绝                                               | P0 |
| BE-PK-011 | 超管                | PUT /api/option/passkey/domains 更新可信域                                                        | 生效；域外登录被拒                                        | P1 |

### 2.8 统一安全验证（BE-SV）

| ID        | 前置                      | 步骤                                                                                         | 预期                                              | P  |
| --------- | ----------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------- | -- |
| BE-SV-001 | 已登录                     | GET /api/verify/methods                                                                    | 返回可用方式（passkey / 2fa / 其他），与账号实际配置一致            | P0 |
| BE-SV-002 | 已登录                     | POST /api/verify 正确因子                                                                      | 通过；返回可用于后续敏感请求的凭证                               | P0 |
| BE-SV-003 | 已登录                     | 错误因子                                                                                       | 拒绝；计数器递增                                        | P0 |
| BE-SV-004 | 已登录                     | 连续 10 次错误                                                                                  | 触发 UserCriticalRateLimit(security-verification) | P0 |
| BE-SV-005 | 无平台认证器但有安全密钥            | 发起 Passkey 验证                                                                              | 放行安全密钥（不误判为不可用）                                 | P1 |
| BE-SV-006 | 验证中途切换因子（Passkey → 2FA） | 切换后完成                                                                                      | 成功，不产生两个待定态                                     | P1 |
| BE-SV-007 | 未通过验证                   | 直接调用需验证的接口（如 POST /api/channel/:id/key、POST /api/token/:id/key、POST /api/token/batch/keys） | 403 / 提示需二次验证，不返回密钥                             | P0 |

### 2.9 第三方登录与绑定（BE-OAU）

| ID         | 前置                            | 步骤                                              | 预期                         | P  |
| ---------- | ----------------------------- | ----------------------------------------------- | -------------------------- | -- |
| BE-OAU-001 | 开启 GitHub                     | GET /api/oauth/github                           | 302 到 GitHub 授权页，state 可校验 | P0 |
| BE-OAU-002 | 同上                            | 回调带篡改 state                                     | 拒绝，不创建会话                   | P0 |
| BE-OAU-004 | 开启 GitHub                     | 回调时账号已存在且已绑定同平台                                 | 直接登录，不创建新账号                | P0 |
| BE-OAU-005 | 开启 GitHub                     | 回调时邮箱已被本地账号占用                                   | 拒绝并提示，不静默绑定（防账号接管）         | P0 |
| BE-OAU-006 | 已登录                           | GET /api/oauth/bindings                         | 返回已绑定列表                    | P1 |
| BE-OAU-007 | 已登录                           | DELETE /api/oauth/unbind/:type                  | 解绑成功；只剩一种登录方式时拒绝（防自锁）      | P0 |
| BE-OAU-008 | 开启 OIDC                       | GET /api/oauth/oidc → 回调                        | 登录成功；issuer/sub 正确落库       | P1 |
| BE-OAU-009 | 开启 OIDC                       | 伪造 id_token / 篡改 issuer                         | 拒绝                         | P0 |
| BE-OAU-010 | 开启微信/Telegram/Discord/LinuxDo | 各自回调                                            | 登录或绑定成功                    | P2 |
| BE-OAU-011 | 管理员                           | GET/DELETE /api/user/:id/bindings/:binding_type | 管理员解绑成功，审计有记录              | P1 |
| BE-OAU-012 | 关闭第三方登录                       | GET /api/oauth/github                           | 拒绝；前端不展示入口                 | P1 |
| BE-OAU-013 | 回调异常                          | 上游 provider 返回错误                                | provider 有明确处理，返回可读错误不 500 | P1 |
| BE-OAU-014 | 超管                            | 保存含 client_secret 的配置后 GET 回读                   | 密钥脱敏返回，不出现明文               | P0 |
| BE-OAU-015 | POST /api/oauth/state         | 伪造 redirect 到外站                                 | 拒绝（仅允许白名单/站内回跳）            | P0 |
| BE-OAU-016 | 开启任意第三方登录 | 从头发起 OAuth 登录，检查 `oauth_login_nonce` Cookie：回调时缺失 / 篡改 / 与登录意图不一致 | 登录意图生成 nonce 并写入 Cookie；回调用常数时间比对，不一致即拒绝且不创建会话（`e11551977` 防 OAuth 登录 CSRF） | P0 |
| BE-OAU-017 | 第三方回调创建新账号 | 回调携带的邮箱未验证（provider 标记 verified=false） | fail-closed：不直接发放完整会话，按需验证流程走；不放行未验证邮箱的新账号（`e11551977`） | P0 |

### 2.10 Personal Access Token（BE-PAT）

| ID         | 前置             | 步骤                                     | 预期                                         | P  |
| ---------- | -------------- | -------------------------------------- | ------------------------------------------ | -- |
| BE-PAT-001 | 已登录 + 通过安全验证   | GET/POST /api/user/token               | 生成 PAT，仅此次明文返回                             | P0 |
| BE-PAT-002 | 生成后            | GET /api/user/token/status             | 显示存在/过期时间，不返回明文                            | P0 |
| BE-PAT-003 | 未通过安全验证        | 生成 PAT                                 | 拒绝，不生成                                     | P0 |
| BE-PAT-004 | 已有 PAT         | 再次生成                                   | 旧的立即失效（或按配置提示），无并存明文                       | P0 |
| BE-PAT-005 | 已有 PAT         | 用它访问 /api/user/self                    | 成功                                         | P0 |
| BE-PAT-006 | 已撤销            | 用旧 PAT 访问                              | 401                                        | P0 |
| BE-PAT-007 | 已登录            | DELETE /api/user/token                 | 撤销成功，审计有记录                                 | P0 |
| BE-PAT-008 | 1 分钟内连续生成 20 次 | 触发 UserCriticalRateLimit(access-token) | 限流生效                                       | P1 |
| BE-PAT-009 | 审计             | 用 PAT 调用敏感接口                           | /api/audit/self 能查到，AccessTokenAudit 记录了用途 | P1 |

### 2.11 用户管理（BE-USR）

| ID         | 前置      | 步骤                                 | 预期                                     | P  |
| ---------- | ------- | ---------------------------------- | -------------------------------------- | -- |
| BE-USR-001 | 管理员     | GET /api/user/?p=0                 | 分页返回用户列表                               | P0 |
| BE-USR-002 | 管理员     | POST /api/user/ 创建用户（合规密码）         | 创建成功，role 正确                           | P0 |
| BE-USR-003 | 管理员     | 创建用户时密码不合策略                        | 拒绝                                     | P0 |
| BE-USR-004 | 管理员     | PUT /api/user/ 改资料/角色/分组           | 更新成功                                   | P0 |
| BE-USR-005 | 管理员     | POST /api/user/manage（启用/禁用/提权/降权） | 状态变更成功，审计有记录                           | P0 |
| BE-USR-006 | 管理员     | 降权/禁用自己                            | 按配置拒绝或明确提示（防自锁）                        | P1 |
| BE-USR-007 | 管理员     | 删除 root 账号                         | 拒绝                                     | P0 |
| BE-USR-008 | 管理员     | DELETE                             | provider 有明确处理                         | P1 |
| BE-USR-009 | 管理员     | DELETE /api/user/:id 删除普通用户        | 删除成功；其令牌与会话失效，审计有记录                    | P0 |
| BE-USR-010 | 管理员     | GET /api/user/search?keyword=...   | 搜索命中，支持用户名/邮箱/ID                       | P1 |
| BE-USR-011 | 管理员     | 按 status/role/group 筛选             | 筛选结果正确                                 | P1 |
| BE-USR-012 | 管理员     | PUT /api/user/ 改他人额度               | 成功；额度日志可追溯                             | P0 |
| BE-USR-013 | 已登录     | GET /api/user/self                 | 返回本人资料，不含他人字段                          | P0 |
| BE-USR-014 | 已登录     | PUT /api/user/self 改昵称/语言等         | 成功；DELETE /api/user/self 注销（需验证+用户名确认） | P0 |
| BE-USR-015 | 已登录     | DELETE /api/user/self 但用户名确认串错误    | 拒绝，不删除                                 | P0 |
| BE-USR-016 | 管理员     | GET /api/user/:id 不存在的 ID          | 404 语义，不返回空成功                          | P2 |
| BE-USR-017 | 演示站模式开启 | 敏感写操作                              | 拒绝（演示站只读）                              | P1 |


### 2.12 权限与授权目录（BE-RBAC）

| ID          | 前置                             | 步骤                                                                    | 预期                     | P  |
| ----------- | ------------------------------ | --------------------------------------------------------------------- | ---------------------- | -- |
| BE-RBAC-001 | 管理员                            | GET /api/authz/catalog                                                | 返回资源+动作+角色基线的完整 schema | P0 |
| BE-RBAC-002 | 被取消 ChannelSensitiveWrite 的管理员 | POST /api/channel/、DELETE /api/channel/:id、POST /api/channel/copy/:id | 全部 403                 | P0 |
| BE-RBAC-003 | 同上                             | GET /api/channel/（仅保留 Read）                                           | 200 可读                 | P0 |
| BE-RBAC-004 | 缺 ChannelOperate               | GET /api/channel/test/:id、POST /api/channel/:id/status                | 403                    | P0 |
| BE-RBAC-005 | 缺 AuditRead                    | GET /api/audit                                                        | 403                    | P0 |
| BE-RBAC-006 | 缺 TaskPluginBind               | GET /api/task_plugin_options                                          | 403                    | P1 |
| BE-RBAC-007 | 普通用户                           | 访问所有 /api/channel/*、/api/token/ 以外管理接口                                | 403                    | P0 |
| BE-RBAC-008 | 管理员                            | 修改自己的权限                                                               | 拒绝（不能自我提权）             | P0 |
| BE-RBAC-009 | 超管                             | 修改管理员权限后立即生效（Redis 缓存同步）                                              | 无需重启即生效                | P0 |

### 2.13 组织与租户（BE-ORG）

| ID         | 前置       | 步骤                                                                    | 预期                                                                                | P  |
| ---------- | -------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -- |
| BE-ORG-001 | 超管       | POST /api/organizations 创建组织（名称/预算/成员上限）                              | 创建成功，GET /api/organizations 可见                                                    | P0 |
| BE-ORG-002 | 普通用户     | POST /api/organizations                                               | 403（组织创建仅超管，防绕过个人钱包的免费通道）                                                         | P0 |
| BE-ORG-003 | 组织成员     | GET /api/organization/self                                            | 返回所属组织                                                                            | P0 |
| BE-ORG-004 | U-NOORG  | GET /api/organization/self                                            | 空态，不报错                                                                            | P1 |
| BE-ORG-005 | 组织 owner | GET /api/organization/:id / :id/stats                                 | 返回预算/已用/剩余/成员数                                                                    | P0 |
| BE-ORG-006 | 组织 owner | POST /api/organization/:id/members 批量添加（User ID + 子额度上限 + 部门）         | 添加成功；逐行返回成功/失败原因                                                                  | P0 |
| BE-ORG-007 | 组织 owner | 添加不存在的用户 ID                                                           | 该行返回失败原因，不影响其他行                                                                   | P1 |
| BE-ORG-008 | 部门管理员    | 添加其他部门成员                                                              | 拒绝                                                                                | P0 |
| BE-ORG-009 | 部门管理员    | 调整本部门成员子额度                                                            | 成功                                                                                | P0 |
| BE-ORG-010 | 普通成员     | GET /api/organization/:id（含预算字段）                                      | 仅返回自己的额度；预算字段不可见（前端 MyQuotaCard）                                                  | P0 |
| BE-ORG-011 | 非本组织成员   | GET /api/organization/:id/*                                           | 403 / 不返回数据                                                                       | P0 |
| BE-ORG-013 | 组织 owner | PUT /api/organization/:id（非预算字段）                                      | 改名/改描述成功；改预算仍拒绝（仅超管）                                                              | P1 |
| BE-ORG-014 | 组织 owner | PUT /api/organization/:id/members/:uid 改角色                            | 成功；不得把自己降为 member 后仍保留管理权                                                         | P0 |
| BE-ORG-015 | 组织管理员    | DELETE /api/organization/:id/members/:uid 移除成员                        | 成功；该成员令牌不再消耗组织预算                                                                  | P0 |
| BE-ORG-016 | 组织成员超额   | 成员用令牌发起请求，组织预算已耗尽                                                     | 请求被 EnforceOrgQuota 拦截；账本如实记账（used_quota > quota 暴露超支），OrgRemainingQuota 钳 0，不得截断。顺序执行时超支被「单次调用成本」界定（预算低于单笔实耗时最多超一笔，越过预算后一律拒绝且不留下账本痕迹，见 e2e TestOrgBillingOvershootBoundedByOneCall） | P0 |
| BE-ORG-017 | 组织成员     | 子额度上限耗尽                                                               | 该成员被拦截，其他成员不受影响                                                                   | P0 |
| BE-ORG-018 | 组织管理员    | GET /api/organization/:id/logs / :id/logs/stat                        | 仅返回本组织成员日志                                                                        | P0 |
| BE-ORG-019 | 部门管理员    | 查日志                                                                   | 仅本部门                                                                              | P0 |
| BE-ORG-020 | 组织管理员    | GET /api/organization/:id/quota-dates / :id/quota-dates/users         | 按日/按人聚合，与日志口径一致                                                                   | P1 |
| BE-ORG-021 | 组织管理员    | GET /api/organization/:id/flow / :id/tasks / :id/drawings / :id/audit | 返回且仅含本组织数据                                                                        | P1 |
| BE-ORG-022 | 数据一致性    | 移除 owner 后                                                            | organizations.owner_user_id 与 users.org_role 同步（无继任者写 0）                          | P0 |
| BE-ORG-023 | e2e      | 跑 e2e/org_billing_e2e_test.go、e2e/org_permissions_e2e_test.go         | 全绿                                                                                | P0 |
| BE-ORG-024 | 组织 owner，超管已开启编辑 | 创建/编辑组织时预算填负数 / 非有限数字 / 非法输入 | 显式拒绝提交，**不静默折算**（后端语义 quota=0 = 不限额，负数被折算即「预算负数变不限额」漏洞，`742410cb2` 修复）；成员上限同口径校验 | P0 |
| BE-ORG-025 | e2e      | 跑 e2e/org_billing_e2e_test.go 的 TestOrgBillingOvershootBoundedByOneCall 与 TestOrgBillingOvershootConcurrent | 全绿：账本 == 放行笔数 × 单笔实耗（无幻影扣费）、账本 == 日志汇总、超支额被「并发度 × 单笔实耗」界定、并发结束后再发必被拒且账本不变 | P0 |

### 2.14 API Key 令牌（BE-TOK）

| ID         | 前置                            | 步骤                                           | 预期                                                                      | P  |
| ---------- | ----------------------------- | -------------------------------------------- | ----------------------------------------------------------------------- | -- |
| BE-TOK-001 | 已登录                           | POST /api/token/ 创建（名称/分组/额度/过期/模型限制/IP 白名单） | 创建成功，返回 sk- 前缀 key                                                      | P0 |
| BE-TOK-003 | 有令牌                           | GET /api/token/?p=0                          | 分页返回本人令牌列表；不返回明文 key，仅前缀                                                | P0 |
| BE-TOK-004 | 已登录 + 已通过安全验证（Passkey/2FA/密码） | POST /api/token/:id/key 取明文                  | 返回明文；操作进令牌审计                                                            | P0 |
| BE-TOK-005 | 已登录 + 已通过安全验证                 | POST /api/token/batch/keys 批量取明文             | 返回全部；超限拒绝                                                               | P1 |
| BE-TOK-006 | 有令牌                           | PUT /api/token/ 改名/改额度/改分组                   | 更新成功并立即生效                                                               | P0 |
| BE-TOK-007 | 有令牌                           | 批量创建 quantity=N                              | 生成 N 个，key 各不相同                                                         | P1 |
| BE-TOK-008 | 有令牌                           | POST /api/token/batch 批量删除                   | 删除成功；被删 key 立即失效                                                        | P0 |
| BE-TOK-009 | 过期令牌                          | 用它调 /v1/chat/completions                     | 拒绝，提示令牌已过期                                                              | P0 |
| BE-TOK-010 | 禁用令牌                          | 同上                                           | 拒绝                                                                      | P0 |
| BE-TOK-011 | 额度为 0 的令牌                     | 同上                                           | 拒绝，提示额度不足                                                               | P0 |
| BE-TOK-012 | 带模型限制                         | 请求白名单外的模型                                    | 拒绝                                                                      | P0 |
| BE-TOK-013 | 带 IP 白名单（含 CIDR）              | 白名单外 IP 请求                                   | 拒绝                                                                      | P0 |
| BE-TOK-014 | 跨分组重试（auto 分组）                | 主分组全部失败                                      | 按序跨组重试成功                                                                | P1 |
| BE-TOK-015 | 已登录                           | GET /api/token/auto-groups                   | 返回可用 auto 分组配置                                                          | P1 |
| BE-TOK-016 | 已登录                           | GET /api/token/search?keyword=... 与 POST /api/token/search（筛选条件走请求体） | 两者均命中；触发 SearchRateLimit。GET 保留给仅用名称关键字的既有调用方，POST 支持按 token 过滤（`742410cb2`：API Key 筛选不再进 URL query） | P1 |
| BE-TOK-017 | 只读 key                        | GET /api/usage/token/                        | 返回用量；不能发起写操作                                                            | P1 |
| BE-TOK-018 | 已登录                           | 创建时填非法 CIDR / 非法过期时间                         | 拒绝，提示明确                                                                 | P1 |
| BE-TOK-019 | 审计                            | 创建/删除/取明文                                    | /api/audit/self 与令牌操作审计均有记录                                             | P0 |
| BE-TOK-020 | 已登录但未通过安全验证                   | POST /api/token/:id/key 取明文                  | 403 `SECURITY_PROOF_REQUIRED`（`需要安全验证`），**不返回**明文；与渠道密钥门禁一致。**✅ 已修复（V1.5.1）：实测 403 `SECURITY_PROOF_REQUIRED`**（DEF-5 回归；路由已挂 `TokenKeySecureVerificationRequired`） | P0 |
| BE-TOK-021 | 已登录但未通过安全验证                   | POST /api/token/batch/keys                   | 403 `SECURITY_PROOF_REQUIRED`，不泄露任一明文。**✅ 已修复（V1.5.1）：实测 403，不泄露任一明文**（DEF-5 回归） | P1 |
| BE-TOK-022 | 使用 PAT（无实时会话）                 | POST /api/token/:id/key 取明文                  | 403 `SECURITY_PROOF_INVALID`：PAT 没有活动会话、无法完成二次验证，**不返回**明文（敏感操作仅限交互式会话）。**✅ 已修复（V1.5.1）：PAT 实测 403 `SECURITY_PROOF_INVALID`**（DEF-5 回归） | P0 |
| BE-TOK-023 | 普通用户（role=user）                 | POST /api/token/:id/key 取**他人**令牌明文          | 不得跨用户读取。**实测：200 + `success=false`「record not found」，不返回明文；batch/keys 返回空 `{"keys":{}}`**——本条锁死「即使放开二次验证也不得跨用户」 | P0 |
| BE-TOK-024 | 普通用户                           | 连续 20 次 POST /api/token/:id/key            | `CriticalRateLimit` 生效（实测第 N 次起 429）。**注意：限流是当前唯一缓解手段，不能替代二次验证**（DEF-5） | P1 |
| BE-TOK-025 | 对照：渠道密钥                       | POST /api/channel/:id/key                   | 200 仅在 `RootAuth + SecureVerificationRequired` 同时满足时返回；未验证 403。**实测 PASS，可作为修复 BE-TOK-020 的参照实现** | P0 |

### 2.15 渠道管理（BE-CHN）

> **本节说明**：V1.1.0 中 BE-CHN-001～029 整段正文丢失，仅残留 030/031。  
> 本版依据 `router/channel-router.go` 的真实路由重新编写（V1.4.0 复核为 42 条，注册样式已由
> 逐行 `channelRoute.X()` 改为 `{method, path, permission, handler}` 表驱动）。
> 权限分四档：ChannelRead / ChannelWrite / ChannelOperate / ChannelSensitiveWrite；  
> 查看渠道密钥额外要求 `RootAuth` + `SecureVerificationRequired` + `CriticalRateLimit`。

| ID         | 前置               | 步骤                                                                                    | 预期                                                                         | P  |
| ---------- | ---------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -- |
| BE-CHN-001 | 有 ChannelRead    | GET /api/channel/?p=0                                                                 | 分页返回渠道列表；不返回 key 字段                                                        | P0 |
| BE-CHN-002 | 有 ChannelRead    | GET /api/channel/search?keyword=...                                                   | 按名称/key/模型命中                                                               | P1 |
| BE-CHN-003 | 有 ChannelRead    | GET /api/channel/:id                                                                  | 返回单渠道；key 脱敏（**实测返回空串 `""` 而非掩码**，明文未泄露；掩码形态与前端展示不一致，见 §8.1 待裁决）                                                               | P0 |
| BE-CHN-004 | 有 ChannelRead    | GET /api/channel/models、/models_enabled                                               | 分别返回渠道可选模型与已启用模型                                                           | P1 |
| BE-CHN-005 | 有 ChannelRead    | GET /api/channel/default_base_urls                                                    | 返回各 type 的内置默认 Base URL 占位提示                                               | P2 |
| BE-CHN-006 | 有 ChannelRead    | GET /api/channel/ops                                                                  | 返回渠道运维统计                                                                   | P2 |
| BE-CHN-007 | 有 ChannelRead    | GET /api/channel/tag/models                                                           | 返回 tag 与模型映射                                                               | P2 |
| BE-CHN-008 | 有 SensitiveWrite | POST /api/channel/ 创建各类型渠道                                                            | 创建成功；类型/分组/模型列表正确落库                                                        | P0 |
| BE-CHN-009 | 有 ChannelWrite   | PUT /api/channel/ 改配置                                                                 | 更新成功并立即生效（abilities 同步刷新）                                                  | P0 |
| BE-CHN-010 | 有 SensitiveWrite | DELETE /api/channel/:id                                                               | 删除成功；其 abilities 一并清理                                                      | P0 |
| BE-CHN-011 | 有 SensitiveWrite | POST /api/channel/batch 批量删、DELETE /api/channel/disabled                              | 批量删除生效；禁用渠道被清理                                                             | P1 |
| BE-CHN-012 | 有 SensitiveWrite | POST /api/channel/copy/:id                                                            | 复制出一条禁用态新渠道，key 独立                                                         | P1 |
| BE-CHN-013 | 有 ChannelOperate | GET /api/channel/test/:id                                                             | 返回连通性与延迟；失败给出可读分类原因                                                        | P0 |
| BE-CHN-014 | 有 ChannelOperate | GET /api/channel/test（全量）                                                             | 逐条测试；并发可控不超时                                                               | P1 |
| BE-CHN-015 | 有 ChannelOperate | POST /api/channel/:id/status、POST /api/channel/status/batch                           | 启停生效；批量操作返回逐条结果                                                            | P0 |
| BE-CHN-016 | 有 ChannelOperate | GET /api/channel/update_balance/:id、/update_balance（全量）                               | 余额查询成功；上游失败时给出可读错误，不清空已有余额                                                 | P1 |
| BE-CHN-017 | 有 ChannelOperate | POST /api/channel/tag/disabled、/tag/enabled                                           | 按 tag 批量启停                                                                 | P1 |
| BE-CHN-018 | 有 ChannelWrite   | PUT /api/channel/tag、POST /api/channel/batch/tag                                      | 改 tag / 批量打标成功                                                             | P2 |
| BE-CHN-019 | 有 ChannelOperate | POST /api/channel/fix                                                                 | 重建 abilities；修复后「没可用渠道」问题消失                                                | P1 |
| BE-CHN-020 | 有 ChannelOperate | GET /api/channel/fetch_models/:id                                                     | 返回上游模型列表；失败给出可读错误                                                          | P1 |
| BE-CHN-021 | 有 SensitiveWrite | POST /api/channel/fetch_models                                                        | 按上游模型回填渠道模型列表                                                              | P1 |
| BE-CHN-022 | 有 SensitiveWrite | POST /api/channel/:id/codex/refresh                                                   | Codex 凭据刷新成功；失败不覆盖旧凭据                                                      | P1 |
| BE-CHN-023 | 有 ChannelRead    | GET /api/channel/:id/codex/usage、/codex/usage/reset-credits                           | 返回用量与重置额度                                                                  | P2 |
| BE-CHN-024 | 有 ChannelOperate | POST /api/channel/:id/codex/usage/reset                                               | 重置成功                                                                       | P2 |
| BE-CHN-025 | 有 SensitiveWrite | POST /api/channel/ollama/pull、/pull/stream、DELETE /ollama/delete                      | 拉取/删除模型成功；stream 返回进度事件                                                    | P2 |
| BE-CHN-026 | 有 SensitiveWrite | GET /api/channel/ollama/version/:id                                                   | 返回 Ollama 版本                                                               | P2 |
| BE-CHN-027 | 有 ChannelOperate | POST /api/channel/multi_key/manage                                                    | 多 Key 增删改生效；单 Key 失效不影响其他                                                  | P0 |
| BE-CHN-028 | 有 ChannelOperate | POST /api/channel/upstream_updates/detect、/detect_all                                 | 检测出上游模型变更                                                                  | P1 |
| BE-CHN-029 | 有 ChannelWrite   | POST /api/channel/upstream_updates/apply、/apply_all                                   | 应用变更；有冲突时提示而非静默覆盖                                                          | P1 |
| BE-CHN-030 | 自动禁用开启           | 渠道连续失败达阈值                                                                             | 自动禁用并告警                                                                    | P0 |
| BE-CHN-031 | 渠道健康检查           | 观察定时任务                                                                                | 按 CHANNEL_TEST_FREQUENCY 执行，结果落库                                           | P1 |
| BE-CHN-032 | 权限矩阵             | 用 U-PERM（缺 ChannelSensitiveWrite）依次调用 POST /、DELETE /:id、POST /copy/:id、POST /:id/key | 全部 403；GET / 仍 200                                                         | P0 |
| BE-CHN-033 | openai-sb 渠道余额查询 | 代码/抓包核对上游请求 `https://api.openai-sb.com/sb-api/user/status`                            | API Key **不在 URL query**（不落入上游访问日志），改由 `Authorization: Bearer <key>` 请求头传递 | P0 |

### 2.16 模型元数据与供应商（BE-MDL）

| ID         | 前置                     | 步骤                                                                     | 预期                                                                                | P  |
| ---------- | ---------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -- |
| BE-MDL-001 | 管理员                    | GET /api/models/                                                       | 分页返回模型元数据                                                                         | P0 |
| BE-MDL-002 | 管理员                    | POST /api/models/ 新建                                                   | 创建成功                                                                              | P0 |
| BE-MDL-003 | 管理员                    | PUT /api/models/ 改归属/状态/图标                                             | 更新成功                                                                              | P0 |
| BE-MDL-004 | 管理员                    | DELETE /api/models/:id                                                 | 删除成功；渠道上的模型可按选项保留                                                                 | P1 |
| BE-MDL-005 | 管理员                    | POST /api/models/delete 批量删                                            | 生效                                                                                | P1 |
| BE-MDL-006 | 管理员                    | GET /api/models/sync_upstream/preview → POST /api/models/sync_upstream | 预览展示新增/变更字段，显式确认后才写入                                                              | P0 |
| BE-MDL-007 | 有缺失模型                  | GET /api/models/missing                                                | 返回未纳入元数据的模型                                                                       | P1 |
| BE-MDL-008 | 管理员                    | POST /api/models/sync_upstream/auto_fill                               | 按官方数据补全                                                                           | P1 |
| BE-MDL-009 | 管理员                    | GET /api/vendors/                                                      | 返回供应商列表（含合成默认品牌负 ID）                                                              | P0 |
| BE-MDL-010 | 管理员                    | 编辑供应商元数据                                                               | 仅改元数据，不连带改渠道                                                                      | P0 |
| BE-MDL-011 | 管理员                    | 删除合成默认品牌（负 ID）                                                         | 拒绝（ErrVendorDefaultBrandNotDeletable）                                             | P0 |
| BE-MDL-012 | 管理员                    | POST /api/vendors/operations/preview → /operations 合并供应商               | 预览与结果一致；合并时迁移其名下模型                                                                | P0 |
| BE-MDL-014 | 存在同名已删除供应商             | 提升/创建同名供应商                                                             | 按规则处理，不产生重名脏数据                                                                    | P1 |
| BE-MDL-015 | 管理员                    | GET /api/vendors/merge-rules、DELETE /api/vendors/merge-rules/:id       | 列表与删除正常                                                                           | P1 |
| BE-MDL-016 | 数据一致性                  | 对比定价页供应商模型数与管理页「关联模型数」                                                 | 两者同口径（统一走 GetEffectiveVendorModelCounts）                                          | P0 |
| BE-MDL-017 | 图标                     | 遍历模型/供应商图标                                                             | 均为单色变体（NormalizeIconKey 剥离 .Color），非彩色                                            | P1 |
| BE-MDL-018 | 官方元数据同步后               | 检查图标                                                                   | 同步不会把彩色图标带回                                                                       | P1 |
| BE-MDL-019 | 管理员                    | GET /api/models/search、GET /api/vendors/search                         | 搜索命中                                                                              | P2 |
| BE-MDL-020 | 唯一性                    | 合成默认品牌重复读取                                                             | 只读不落库，不写入 vendors 表                                                               | P0 |
| BE-MDL-021 | 上游目录**未提供中文条目**的模型     | 同步上游后触发自动补译                                                            | 简体中文有描述，定价页卡片不回落英文（上游目录不覆盖全部模型，zh 须在兜底列表内）                                        | P1 |
| BE-MDL-022 | 上游**已有** zh / ja 描述的模型 | 再次触发补译                                                                 | 既有译文**不被覆盖**（`loadMissingTranslations` 只补空白）                                      | P0 |
| BE-MDL-023 | 后台「模型描述本地化」            | 查看默认语种与输入框 placeholder                                                 | 默认 6 语 `zh, zh-TW, fr, ja, ru, vi`（除英语外全量兜底），与后端 `descriptionTranslateLocales` 一致 | P2 |
| BE-MDL-024 | 定价页访客                  | 7 种语言逐个浏览模型卡片描述                                                        | 均非英文回落（缺语种时才回落英文，属预期）                                                             | P1 |

### 2.17 模型部署（BE-DPL）

| ID         | 前置   | 步骤                                                                           | 预期          | P  |
| ---------- | ---- | ---------------------------------------------------------------------------- | ----------- | -- |
| BE-DPL-001 | 管理员  | GET /api/deployments/settings、POST /api/deployments/settings/test-connection | 配置读取与连通测试正常 | P1 |
| BE-DPL-002 | 管理员  | POST /api/deployments/price-estimation                                       | 返回价格估算      | P1 |
| BE-DPL-003 | 管理员  | GET /api/deployments/check-name?name=...                                     | 名称占用检测正确    | P2 |
| BE-DPL-004 | 管理员  | POST /api/deployments/ 创建                                                    | 创建成功        | P0 |
| BE-DPL-005 | 管理员  | PUT /api/deployments/:id、PUT /:id/name                                       | 改名/改配置成功    | P1 |
| BE-DPL-006 | 管理员  | POST /api/deployments/:id/extend                                             | 续期成功        | P1 |
| BE-DPL-007 | 管理员  | DELETE /api/deployments/:id                                                  | 删除成功        | P0 |
| BE-DPL-009 | 管理员  | GET /api/deployments/hardware-types、/locations、/available-replicas           | 选项列表正确      | P2 |
| BE-DPL-010 | 普通用户 | 访问 /api/deployments/*                                                        | 403         | P0 |


### 2.18 定价与倍率（BE-PRC）

| ID         | 前置         | 步骤                                                          | 预期                              | P  |
| ---------- | ---------- | ----------------------------------------------------------- | ------------------------------- | -- |
| BE-PRC-001 | 超管         | GET /api/option/model_pricing                               | 返回定价配置                          | P0 |
| BE-PRC-002 | 超管         | PATCH /api/option/model_pricing                             | 保存成功并立即生效                       | P0 |
| BE-PRC-003 | 超管         | POST /api/option/model_pricing/preview                      | 预览与实际扣费一致                       | P0 |
| BE-PRC-004 | 超管         | POST /api/option/model_pricing/convert                      | 单位换算正确（含显式 0 价、缓存价）             | P1 |
| BE-PRC-005 | 超管         | 保存含显式零价的配置                                                  | 零价被保留，不被当作「未设置」覆盖为默认价           | P0 |
| BE-PRC-006 | 缓存写入价      | 计费                                                          | 缓存写入按独立单价计，不与输入价混用              | P0 |
| BE-PRC-007 | 三种计费模式     | none / standard / claude_ttl                                | 各自按规则计费                         | P1 |
| BE-PRC-008 | token 单位切换 | 切换 1K/1M                                                    | request 价不受 token 单位影响，混合计费单位分离 | P1 |
| BE-PRC-009 | 任务类模型      | 任务价格矩阵                                                      | 扁平/枚举分层/累加三种规范 round-trip 一致    | P1 |
| BE-PRC-010 | 超管         | GET /api/ratio_sync/channels、POST /fetch、GET /preset_prices | 上游倍率同步正常                        | P1 |
| BE-PRC-011 | 超管         | POST /api/option/rest_model_ratio 重置倍率                      | 重置为默认，需二次确认                     | P1 |
| BE-PRC-012 | 分组倍率       | 不同分组发起同模型请求                                                 | 按分组倍率计费                         | P0 |
| BE-PRC-013 | 渠道倍率       | /option/rest_model_ratio 重置倍率                               | 重置为默认，需二次确认                     | P1 |
| BE-PRC-014 | 计费模拟器      | 系统设置内「请求计费模拟」                                               | 模拟结果与实际扣费一致                     | P1 |

### 2.19 计费与扣费（BE-BIL）

| ID         | 前置                            | 步骤                                       | 预期                                                                                    | P  |
| ---------- | ----------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- | -- |
| BE-BIL-001 | 有余额用户 + 有效渠道                  | 发起 1 次非流式 chat 请求                        | 扣费额 == 日志 Quota；余额差值相等                                                                | P0 |
| BE-BIL-002 | 同上                            | 发起 1 次流式请求                               | 同上（流式按实际 usage 计费）                                                                    | P0 |
| BE-BIL-003 | 同上                            | 发起 1 次多轮工具调用（多扣费点）                       | 所有扣费点记入同一 BillingSession，总额 == 日志 Quota                                               | P0 |
| BE-BIL-004 | 同上                            | 并发 20 次请求                                | 总额 == 各日志 Quota 之和，无重复扣、无漏扣                                                           | P0 |
| BE-BIL-005 | 余额刚好等于本次费用                    | 发起请求                                     | 通过，余额归 0                                                                              | P0 |
| BE-BIL-006 | 余额不足（**须带 `max_tokens` 以触发预扣**）   | 发起请求                                     | 拒绝，提示余额不足，不产生日志、不扣费。**实测口径**：预扣不足时 503 `insufficient_user_quota`；**若未触发预扣（无 `max_tokens`、余额>0 但远小于实扣）则放行，但结算时被会话级计费上限截断在「可用额度 + 债务下限」**（DEF-6 已修复） | P0 |
| BE-BIL-007 | 上游失败                          | 发起请求                                     | 按配置决定是否退费；不退费时日志与扣费一致                                                                 | P0 |
| BE-BIL-008 | 上游返回缺 usage                   | 发起请求                                     | 按模型默认/估算计费，不出现 NaN 或 0 费                                                              | P0 |
| BE-BIL-009 | 无限额度令牌（`unlimited_quota=1`）  | 发起请求                                     | **仍按实扣额扣减用户钱包余额，日志正常**。V1.4.0 原断言「不扣用户余额」**错误**：无限额度只表示令牌侧不限，钱包照扣（实测 delta=10000） | P0 |
| BE-BIL-010 | 组织成员                          | 发起请求                                     | 同时扣个人与组织账本，两处数值一致                                                                     | P0 |
| BE-BIL-011 | 组织预算耗尽                        | 发起请求                                     | 拦截；组织账本如实记账（不截断），剩余额度钳 0                                                              | P0 |
| BE-BIL-012 | 计费展示                          | 前端/接口返回金额                                | 用 formatBillingCurrencyFromUSD，不出 token 数；额度展示不出 formatQuota() 裸值                     | P1 |
| BE-BIL-013 | 额度单位                          | 1 美元 == 500,000 Token（QuotaPerUnit）      | 换算一致                                                                                  | P0 |
| BE-BIL-014 | 图片/音频/任务                      | 各自计费                                     | 图片按张、音频按时长/字符、任务按矩阵，与定价页一致                                                            | P0 |
| BE-BIL-015 | 重试/回退                         | 主渠道失败重试到备用渠道                             | 只按最终成功渠道计费一次，不重复扣                                                                     | P0 |
| BE-BIL-016 | WALLET_DEBT_FLOOR_QUOTA=0（默认） | 余额耗尽后发起请求直至余额为负                          | 余额可变为负但不低于 env 指定下限；日志与余额差值恒等                                                         | P0 |
| BE-BIL-017 | 配置阶梯计费表达式（billingexpr）        | 对同一模型分别用三种规范配置（扁平 / 枚举分层 / 累加）结算同一 usage | 三种规范 round-trip 结果一致；BillingSnapshot 中 QuotaPerUnit / GroupRatio / ExprVersion 正确参与计算 | P0 |
| BE-BIL-018 | 渠道可触发违规费（Grok CSAM 类）         | mock 上游返回该违规错误                           | NormalizeViolationFeeError 归一化后按违规费计费，日志标记与错误提示正确                                     | P1 |
| BE-BIL-019 | 开启工具调用计费                      | 发起带 tools 的请求并产生 tool_calls              | 按 ToolSurchargeItem 附加计费，计费额与定价页一致                                                    | P0 |
| BE-BIL-020 | BATCH_UPDATE_ENABLED=true     | 高频并发请求后等待批量落库，再查余额与日志                    | 落库后不变量仍成立：初始余额 − 最终余额 == logs.Quota 求和                                                | P0 |
| BE-BIL-021 | 日志库设为独立库                      | 注入日志写入失败（logWriteAttempts=3 全失败）         | 资金类日志（仅 LogTypeConsume / Refund / Topup）写入失败按 error 级别上报并可告警；不静默丢账                    | P0 |
| BE-BIL-022 | 制造扣费落库失败（DB 写入异常 / 日志库不可写）    | 发起请求                                     | 用量日志 `quota` 记为 0 并打 `settle_error` 标记；**绝不把「全额已扣」写入日志**造成账单虚假已扣；余额不被多扣、与日志口径一致       | P0 |
| BE-BIL-023 | 超管设置 `quota_setting.pre_consume_multiplier`（默认 1） | 分别设 1 / 1.5 / 0 / 负数后发起同一请求             | 倍率只影响**预留**不影响最终结算；0 与负数被拒绝（`InputPreConsumeMultiplier` 运行时校验）；结算不变量「初始余额−最终余额==logs.Quota」在各倍率下均成立 | P1 |
| BE-BIL-024 | 超管设置 `quota_setting.trust_quota_usd`（默认 10） | 分别构造：令牌额度与钱包余额均高于门槛 / 仅一方高于 / 均低于；再设 0（禁用）；并分别用组织成员、订阅出资、异步任务（ForcePreConsume）各发一次 | 仅当**令牌额度与钱包余额同时高于门槛**且出资为钱包时才免预扣直扣；组织成员、订阅、异步任务**一律不旁路**（旁路会把 effectiveQuota 归零从而跳过 EnforceOrgQuota，组织预算与子额度同时失守）；门槛 0/NaN/Inf 按禁用处理，坏配置不得放宽预扣 | P0 |
| BE-BIL-025 | 上游返回 `prompt_tokens_details.cached_tokens=5000` | 发起 1 次 chat | 用量日志 `other.cache_tokens == 5000`；`quota_data.cache_read_tokens` 累计 +5000；`cache_ratio` 参与计价 | P0 |
| BE-BIL-026 | 同上，Anthropic 语义 | 上游返回 `cache_read_input_tokens` / `cache_creation_input_tokens` | `other.cache_tokens` / `cache_write_tokens` 分别落值；`cache_creation` **只记归一化后总额**，不得再叠加 5m/1h 明细（否则重复计费） | P0 |
| BE-BIL-027 | 缓存命中与未命中两笔同 usage | 对比两笔扣费 | 仅 cache 部分按 `cache_ratio` 折算，其余按 `model_ratio`；两笔差额 == `cached_tokens × (1 − cache_ratio) × ratio` | P0 |
| BE-BIL-028 | 数据看板 | `GET /api/data/self?start_timestamp=&end_timestamp=` | 返回含 `cache_read_tokens` / `cache_creation_tokens` 字段；普通用户访问 `/api/data/`（全站）为 403 | P1 |
| BE-BIL-029 | 同一 (user, model, hour, group, token, channel, node) 多笔请求 | 等待 quota_data 刷盘后查表 | 冲突键 upsert：`count/quota/token_used/cache_read_tokens/cache_creation_tokens` **全部累加**，无覆盖丢量 | P0 |
| BE-BIL-030 | 任务渠道重试（`relay_task.go`） | 首次失败后重试到备用渠道 | 重试时 `TieredBillingSnapshot=nil` 重新定价，并**补足预扣**（`PreConsumeBilling`）；不得沿用失败渠道的旧价或旧预扣 | P0 |
| BE-BIL-031 | 余额 100，单笔实扣 10000（无 `max_tokens`，信任旁路生效） | 发起请求 | **✅ 已修复（V1.5.1）**：余额变 0（截断到准入余额），`logs.Quota` 记截断后生效额，「初始余额 − 最终余额 == logs.Quota」依然成立（DEF-6 回归） | P0 |
| BE-BIL-032 | `WALLET_DEBT_FLOOR_QUOTA` 设为非 0 | 连续请求至负值 | 余额不低于下限；到达下限后拒绝并提示；日志与余额差值仍恒等 | P0 |

### 2.20 钱包、充值与支付（BE-PAY）

| ID         | 前置                    | 步骤                                            | 预期                                                | P  |
| ---------- | --------------------- | --------------------------------------------- | ------------------------------------------------- | -- |
| BE-PAY-001 | 已登录                   | GET /api/user/topup/info                      | 返回支付方式、最小/最大金额、汇率                                 | P0 |
| BE-PAY-002 | 已登录                   | POST /api/user/topup 用余额/兑换码充值                | 成功，余额增加                                           | P0 |
| BE-PAY-003 | 已开通支付                 | 创建订单 → 跳转支付页                                  | 订单创建成功，金额与汇率一致                                    | P0 |
| BE-PAY-004 | 支付回调                  | 用正确签名回调                                       | 到账成功，订单置为已支付                                      | P0 |
| BE-PAY-005 | 支付回调                  | 用错误签名 / 篡改金额回调                                | 拒绝，不重复到账                                          | P0 |
| BE-PAY-006 | 同一订单                  | 回调两次                                          | 只到账一次（幂等）                                         | P0 |
| BE-PAY-007 | 已登录                   | GET /api/user/topup/self、POST /topup/complete | 查询与完成流程正常                                         | P1 |
| BE-PAY-008 | 已登录                   | 充值金额小于最小 / 大于最大                               | 拒绝并提示                                             | P1 |
| BE-PAY-009 | 已登录                   | 用兑换码 + 余额组合充值                                 | 组合金额正确入账                                          | P2 |
| BE-PAY-010 | 已登录                   | 充值后查余额与日志                                     | 余额增量 == 充值额；有 topup 日志                            | P0 |
| BE-PAY-011 | 超额                    | 充值使余额超过 sub_quota_limit                       | 按 sub_quota_limit 拦截，提示明确                         | P1 |
| BE-PAY-012 | 汇率                    | 美元/人民币展示                                      | 按 usdExchangeRate 换算；quotaDisplayType=USD 时汇率视为 1 | P1 |
| BE-PAY-013 | Waffo / Waffo Pancake | 各走独立金额计算器                                     | 金额与各自流程一致，不串用                                     | P1 |
| BE-PAY-014 | 超管                    | POST /api/option/payment_compliance 合规确认      | 生效                                                | P2 |
| BE-PAY-015 | 已登录，钱包页           | mock `requestPaymentAmount` 失败后打开充值/订阅确认框 | 金额为 null 时不渲染确认入口（`isPayableAmount` 门禁）；展示失败与重试，**不把失败当成「无需付款」放行**（`742410cb2` 修复此前返回 0 的混淆） | P0 |
| BE-PAY-016 | 已开通 Stripe/Creem/Waffo/WaffoPancake | 对四个入口分别构造 http://、javascript:、非白名单主机、正常 https 跳转目标 | 仅放行 http(s)（HTTPS 优先）；Stripe/Creem 主机白名单外拒绝；外链一律 `noopener/noreferrer`；弹窗被拦截时给出可感知提示（统一走 `lib/payment-redirect.ts`，submitPaymentForm 的 action 同样校验） | P0 |
| BE-PAY-017 | Stripe 订阅             | 用 JPY / BHD 等零小数币种下单                | 按币种指数感知最小单位，可正常下单（`e11551977` 修复：此前按两位小数折算导致金额错误）        | P1 |
| BE-PAY-018 | Waffo Pancake          | 构造 PriceAmount<=0 的回调/下单                | 被拦截，不入账、不创建订单（`e11551977` 补拦截）                          | P1 |

### 2.21 订阅（BE-SUB）

| ID         | 前置   | 步骤                                                                                                                                              | 预期            | P  |
| ---------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | -- |
| BE-SUB-001 | 已登录  | GET /api/subscription/plans                                                                                                                     | 返回在售套餐        | P0 |
| BE-SUB-002 | 管理员  | POST /api/subscription/admin/plans 创建套餐                                                                                                         | 创建成功          | P0 |
| BE-SUB-003 | 管理员  | PUT /PATCH /api/subscription/admin/plans/:id                                                                                                    | 更新/启停成功       | P0 |
| BE-SUB-004 | 已登录  | 用余额购买：POST /api/subscription/balance/pay                                                                                                        | 购买成功，额度到账     | P0 |
| BE-SUB-005 | 已登录  | 用第三方购买（epay/stripe/creem/waffo-pancake）                                                                                                         | 下单成功，回调后生效    | P1 |
| BE-SUB-006 | 已登录  | GET /api/subscription/self                                                                                                                      | 返回我的订阅与剩余额度   | P0 |
| BE-SUB-007 | 已登录  | PUT /api/subscription/self/preference                                                                                                           | 偏好保存成功        | P2 |
| BE-SUB-008 | 管理员  | POST /api/subscription/admin/bind 给用户绑定套餐                                                                                                       | 绑定成功          | P1 |
| BE-SUB-009 | 管理员  | GET /POST /api/subscription/admin/users/:id/subscriptions、POST .../reset、POST /user_subscriptions/:id/invalidate、DELETE /user_subscriptions/:id | 各操作正常         | P1 |
| BE-SUB-010 | 管理员  | POST /api/subscription/admin/plans/:id/subscriptions/reset                                                                                      | 批量重置生效        | P1 |
| BE-SUB-011 | 订阅过期 | 用订阅额度请求                                                                                                                                         | 拒绝/回落到余额（按配置） | P0 |
| BE-SUB-012 | 重复回调 | 订阅支付回调两次                                                                                                                                        | 只生效一次         | P0 |
| BE-SUB-013 | 普通用户 | 访问 /api/subscription/admin/*                                                                                                                    | 403           | P0 |

### 2.22 兑换码（BE-RDM）

| ID         | 前置   | 步骤                             | 预期                                | P  |
| ---------- | ---- | ------------------------------ | --------------------------------- | -- |
| BE-RDM-001 | 管理员  | POST /api/redemption/ 单个/批量创建  | 创建成功，码值唯一                         | P0 |
| BE-RDM-002 | 管理员  | 创建后导出                          | 导出内容与实际码一致（TXT/Markdown，可选含名称/额度） | P1 |
| BE-RDM-003 | 已登录  | 用未使用码充值                        | 充值成功，码置为已用                        | P0 |
| BE-RDM-004 | 已登录  | 重复使用同一码                        | 拒绝                                | P0 |
| BE-RDM-005 | 已登录  | 使用已禁用/已过期码                     | 拒绝，提示明确                           | P0 |
| BE-RDM-006 | 管理员  | PUT /api/redemption/ 改额度/状态    | 更新成功                              | P1 |
| BE-RDM-007 | 管理员  | DELETE /api/redemption/invalid | 删除已使用/禁用/过期码，返回删除条数               | P1 |
| BE-RDM-008 | 管理员  | POST /api/redemption/batch 批量删 | 生效                                | P1 |
| BE-RDM-009 | 列表   | GET /api/redemption/           | 码值脱敏展示                            | P1 |
| BE-RDM-010 | 普通用户 | 访问 /api/redemption/*           | 403                               | P0 |
| BE-RDM-011 | 边界   | 创建额度为 0 / 负数 / 超大值的码           | 按校验拒绝或接受 0；不产生脏数据                 | P1 |

### 2.23 签到、推广与转出（BE-GRW）

| ID         | 前置           | 步骤                             | 预期                                     | P  |
| ---------- | ------------ | ------------------------------ | -------------------------------------- | -- |
| BE-GRW-001 | 开启签到         | GET /api/user/checkin          | 返回今日是否已签到与连续天数                         | P1 |
| BE-GRW-002 | 未签到          | POST /api/user/checkin         | 签到成功，额度入账                              | P1 |
| BE-GRW-003 | 已签到          | 再次签到                           | 拒绝，提示今日已签到                             | P1 |
| BE-GRW-004 | 开启 Turnstile | 未通过人机校验签到                      | 拒绝                                     | P2 |
| BE-GRW-005 | 有 aff 配额     | GET /api/user/aff              | 返回邀请码与累计返利                             | P1 |
| BE-GRW-006 | 有 aff 配额     | POST /api/user/aff_transfer 转出 | 转出成功，额度从 aff 转到余额                      | P0 |
| BE-GRW-007 | 转出超额         | 转出大于可用                         | 拒绝                                     | P1 |
| BE-GRW-008 | 连续转出         | 1 分钟内 20 次                     | 触发 UserCriticalRateLimit(aff-transfer) | P1 |

### 2.24 日志与统计（BE-LOG）

| ID         | 前置                                | 步骤                                                                                             | 预期                                                                                                                              | P  |
| ---------- | --------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -- |
| BE-LOG-001 | 有日志                               | GET /api/log/self                                                                              | 返回本人日志                                                                                                                          | P0 |
| BE-LOG-002 | 管理员                               | GET /api/log/                                                                                  | 返回全部日志                                                                                                                          | P0 |
| BE-LOG-003 | 普通用户                              | GET /api/log/                                                                                  | 403                                                                                                                             | P0 |
| BE-LOG-004 | 有日志                               | 按 model / token / channel / group / username / userId / requestId / upstreamRequestId / 时间范围筛选 | 各条件命中准确                                                                                                                         | P0 |
| BE-LOG-005 | 有日志                               | GET /api/log/self/search                                                                       | 搜索命中；触发 SearchRateLimit                                                                                                         | P1 |
| BE-LOG-006 | 管理员                               | GET /api/log/stat、GET /api/log/self/stat                                                       | 统计值与明细一致                                                                                                                        | P1 |
| BE-LOG-007 | 有敏感字段                             | 普通视图查看日志                                                                                       | 敏感字段按权限隐藏；提权视图才可见                                                                                                               | P0 |
| BE-LOG-008 | 失败日志                              | 查看详情                                                                                           | 展示失败原因；管理员可见嵌套 reject reason                                                                                                    | P1 |
| BE-LOG-009 | 管理员                               | GET /api/data/、/users、/flow                                                                    | 按日/按人/流量聚合正确                                                                                                                    | P1 |
| BE-LOG-010 | 已登录                               | GET /api/data/self、/flow/self                                                                  | 仅本人数据                                                                                                                           | P0 |
| BE-LOG-011 | 绘图/任务日志                           | GET /api/mj/self、GET /api/task/self                                                            | 各自返回                                                                                                                            | P1 |
| BE-LOG-012 | 管理员                               | GET /api/log/channel_affinity_usage_cache                                                      | 返回亲和缓存统计                                                                                                                        | P2 |
| BE-LOG-013 | 时间边界                              | 起止时间相等 / 跨月 / 未来时间                                                                             | 不报错，结果合理                                                                                                                        | P2 |
| BE-LOG-014 | 大量日志                              | 翻页到最后一页                                                                                        | 无重复无遗漏                                                                                                                          | P1 |
| BE-LOG-015 | 超长 prompt（超上游缓存最小长度，如 40k+ token） | 发起请求后查该条日志                                                                                     | 日志 `cache_write_tokens` > 0，且与响应 usage 的 `cached_creation_tokens` 一致                                                            | P0 |
| BE-LOG-016 | 承接 BE-LOG-015，同一前缀二次请求            | 再发一次并查日志                                                                                       | `cache_read_tokens` > 0（命中缓存）                                                                                                   | P1 |
| BE-LOG-017 | 有缓存日志                             | GET /api/log/stat、/api/log/self/stat、组织统计接口                                                    | 均返回 `cache_read_tokens` / `cache_write_tokens`；聚合值与对应区间明细 SUM 一致                                                                | P0 |
| BE-LOG-018 | 升级到含缓存列的版本（历史行）                   | 查升级前就存在的日志                                                                                     | `cache_read_tokens` / `cache_write_tokens` 已被回填，与 `other` JSON 内口径一致；`options` 表有标记 `log_cache_tokens_backfilled`，**且重启后不重复回填** | P1 |
| BE-LOG-019 | 含缓存写入的请求                          | 核对 quota                                                                                       | 缓存写入按 `cache_creation_ratio` 计价（Claude 默认 1.25）；读按 `cache_ratio`                                                                | P1 |
| BE-LOG-020 | 流式与非流式同内容                         | 分别请求后对比两笔日志的缓存列                                                                                | 两条路径的 `cache_write_tokens` 均被正确记录（历史上流式/非流式曾不对称）                                                                                | P1 |

### 2.25 审计日志（BE-AUD）

| ID         | 前置               | 步骤                               | 预期                    | P  |
| ---------- | ---------------- | -------------------------------- | --------------------- | -- |
| BE-AUD-001 | 管理员（有 AuditRead） | GET /api/audit                   | 返回审计记录                | P0 |
| BE-AUD-002 | 已登录              | GET /api/audit/self              | 仅本人记录                 | P0 |
| BE-AUD-003 | 无 AuditRead 的管理员 | GET /api/audit                   | 403                   | P0 |
| BE-AUD-004 | 覆盖度              | 登录/登出/改密/建令牌/删令牌/取密钥/改渠道/改选项/改权限 | 每一类都有审计记录             | P0 |
| BE-AUD-005 | 内容安全             | 检查审计正文                           | 不含密码、验证码、私钥、完整令牌/会话令牌 | P0 |
| BE-AUD-006 | 时间               | 审计时间戳                            | 与操作时间一致，时区正确          | P2 |
| BE-AUD-007 | 组织               | 组织内操作                            | 审计按组织隔离可见             | P1 |

### 2.26 中转 · OpenAI 兼容（BE-RLY）

| ID         | 前置                                      | 步骤                                                                       | 预期                                                                                                   | P  |
| ---------- | --------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | -- |
| BE-RLY-001 | 有效令牌                                    | POST /v1/chat/completions 非流式                                            | 200，OpenAI 兼容结构；usage 正确                                                                             | P0 |
| BE-RLY-002 | 有效令牌                                    | 同上，stream: true                                                          | SSE 流式返回，以 data: [DONE] 收尾                                                                           | P0 |
| BE-RLY-003 | 有效令牌                                    | POST /v1/completions（补全）                                                 | 正常                                                                                                   | P1 |
| BE-RLY-004 | 无令牌                                     | 同上                                                                       | 401，错误体 OpenAI 兼容                                                                                    | P0 |
| BE-RLY-005 | 错误令牌                                    | 同上                                                                       | 401，不泄露校验细节                                                                                          | P0 |
| BE-RLY-006 | 有效令牌                                    | 请求不存在的模型                                                                 | 明确错误（模型不存在/无可用渠道），不 5xx                                                                              | P0 |
| BE-RLY-007 | 有效令牌                                    | GET /v1/models                                                           | 返回该令牌可见模型                                                                                            | P0 |
| BE-RLY-008 | 有效令牌                                    | GET /v1/models/:model                                                    | 返回单模型信息                                                                                              | P2 |
| BE-RLY-009 | 上游超时                                    | 请求                                                                       | 按超时配置返回，不挂死；有错误日志                                                                                    | P0 |
| BE-RLY-010 | 上游 429/5xx                              | 请求                                                                       | 按重试/回退策略换渠道；最终失败时给出可读上游错误分类                                                                          | P0 |
| BE-RLY-011 | 上游全部不可用                                 | 请求                                                                       | 返回 5xx 语义错误，不返回 200 空内容                                                                              | P0 |
| BE-RLY-012 | 有效令牌                                    | POST /v1/embeddings                                                      | 返回向量，按 token 计费                                                                                      | P1 |
| BE-RLY-013 | 有效令牌                                    | POST /v1/chat/completions 带 `max_tokens` 边界值                             | 正常；超限按上游错误映射为可读错误，不 5xx                                                                              | P1 |
| BE-RLY-014 | 有效令牌                                    | POST /v1/moderations                                                     | 正常                                                                                                   | P2 |
| BE-RLY-015 | 未实现端点                                   | POST /v1/images/variations、/v1/files、/v1/fine-tunes、DELETE /v1/models/:m | 返回「未实现」语义，不 panic                                                                                    | P1 |
| BE-RLY-016 | 有效令牌                                    | POST /v1/responses/compact                                               | 压实接口正常                                                                                               | P1 |
| BE-RLY-017 | 有效令牌                                    | POST /v1/alpha/search（Codex 独立搜索）                                        | 正常                                                                                                   | P2 |
| BE-RLY-018 | 请求体超大                                   | 发送超限 body                                                                | 拒绝（匿名 body 限制），不 OOM                                                                                 | P0 |
| BE-RLY-019 | gzip 请求                                 | 带 Content-Encoding: gzip                                                 | 正确解压处理（有 DecompressRequestMiddleware）                                                                | P1 |
| BE-RLY-020 | CORS                                    | 浏览器预检 OPTIONS                                                            | 返回正确 CORS 头                                                                                          | P1 |
| BE-RLY-021 | —                                       | 表驱动遍历 Path2RelayMode：对 35 个 RelayMode（0–34，`RelayModeAlphaSearch` 为最大值）各构造其对应路径，断言返回的模式编号正确               | 全表通过。判定为严格前缀 / 后缀匹配且有顺序依赖，任一分支顺序调整都会错判                                                               | P0 |
| BE-RLY-022 | —                                       | POST /mj/submit/simple-change                                            | 正确提交。实测该路径映射到 RelayModeMidjourneyChange(11)，RelayModeMidjourneySimpleChange(12) 为死常量；断言行为正确（不为死常量本身） | P1 |
| BE-RLY-023 | —                                       | 对全部 63 个渠道类型（0–63 有效值 + 600/601/602），stream=true 请求 /v1/chat/completions                           | 仅 streamSupportedChannels 白名单内 27 个 type 走流式；白名单外即使请求 stream 也走非流式且不报错（品牌三型 600/601/602 与 vLLM/SGLang 均在白名单内）                               | P0 |
| BE-RLY-024 | —                                       | 对全部渠道类型 POST /v1/responses/compact                                       | 仅 apiType 属于 OpenAI / Codex / AdvancedCustom / Sub2API / NewAPI（即 Uter，60）五类的渠道支持（`common.SupportsResponsesCompact`）；其余返回明确拒绝，不 5xx                 | P0 |
| BE-RLY-025 | —                                       | 对全部渠道类型 POST /v1/alpha/search                                            | 白名单由端点类型驱动（`GetEndpointTypesByChannelType`）：Codex(57)/Sub2API(59)/NewAPI(60) 固定放行；AdvancedCustom(58) 与品牌渠道(600/601/602) 在 advanced_routes 配了 /v1/alpha/search 时放行；vLLM(62)/SGLang(63) 默认预设不含该路径。白名单外返回 invalid_request 且不 skip retry（允许换渠道重试）        | P1 |
| BE-RLY-033 | —                                       | 渠道编号迁移回归：遍历 constant/channel.go 全部 63 个类型，逐一核对 ChannelTypeNames / ChannelBaseURLs / ChannelType2APIType / GetAdaptor 与前端 web/src/features/channels/constants.ts 的 CHANNEL_TYPES 映射               | 前后端编号-名称-默认 URL 完全一致；Uter(60)==NewAPI(60)、TaskPlugin(61)、vLLM(62)、SGLang(63)、品牌(600/601/602) 无冲突；`b1655a5d2` 迁移无遗漏（编号落库，漂移即脏数据）                 | P0 |
| BE-RLY-026 | 开启 chat_completions_to_responses_policy | 以 Chat Completions 格式请求，路由到仅支持 Responses 的上游                             | 双向桥接成功：请求转 Responses、响应转回 Chat Completions 结构，usage 正确                                               | P1 |
| BE-RLY-027 | —                                       | 分别 POST /v1/responses/compact 与 /v1/responses                            | 两条路径判定互不干扰。compact 必须先于 responses 判定，否则会被误判为普通 responses                                             | P1 |


### 2.27 中转 · Claude / Gemini / 其他协议（BE-RLY2）

| ID | 前置 | 步骤 | 预期 | P |
| --- | --- | --- | --- | --- |
| BE-RLY2-001 | 有效令牌 | POST /v1/messages（Claude 原生） | 正常，返回 Anthropic 兼容体 | P0 |
| BE-RLY2-002 | 有效令牌 | Claude 流式 | SSE 事件序列正确（含 message_start/content_block_delta/message_stop） | P0 |
| BE-RLY2-003 | 带 anthropic-version + x-api-key | GET /v1/models | 按 Anthropic 协议返回模型列表 | P1 |
| BE-RLY2-004 | 带 x-goog-api-key 或 ?key= | GET /v1/models | 按 Gemini 协议返回 | P1 |
| BE-RLY2-005 | 有效令牌 | POST /v1beta/models/*path（Gemini 原生） | 正常 | P0 |
| BE-RLY2-006 | 有效令牌 | POST /v1beta/openai/models | 按 OpenAI 兼容返回 | P1 |
| BE-RLY2-007 | 有效令牌 | POST /v1/messages 带 `thinking` 参数 | 正常返回；thinking token 单独计价 | P1 |
| BE-RLY2-008 | 有效令牌 | POST /v1beta/models/*path 走 Gemini 流式 | SSE 事件序列正确 | P1 |
| BE-RLY2-009 | 有效令牌 | GET /v1/realtime（WebSocket） | 建立连接并双向转发 | P1 |
| BE-RLY2-010 | 已登录（会话） | POST /pg/chat/completions（Playground） | 用会话鉴权成功，按用户额度计费 | P0 |
| BE-RLY2-011 | 协议不匹配 | 用 OpenAI 体打 Claude 端点 | 明确报错，不 500 | P1 |
| BE-RLY2-012 | Claude TTL | 触发 claude_ttl 计费模式 | 按 TTL 规则计费 | P1 |
| BE-RLY2-013 | 已登录（会话） | POST /pg/chat/completions，分别用无令牌、带无效令牌、带有效令牌 | 按用户额度计费；鉴权失败为 401 而非 200 | P1 |

### 2.28 中转 · 多模态与特殊内容（BE-RLY3）

| ID | 前置 | 步骤 | 预期 | P |
| --- | --- | --- | --- | --- |
| BE-RLY3-001 | 图片理解模型 | 带 image_url 的 chat 请求 | 正常；图片按张计费 | P0 |
| BE-RLY3-002 | 图像生成 | POST /v1/images/generations | 返回图片；按张计费；日志可预览 | P0 |
| BE-RLY3-003 | 图像编辑 | POST /v1/images/edits、POST /v1/edits | 正常 | P1 |
| BE-RLY3-004 | 音频 | POST /v1/audio/transcriptions、/translations、/speech | 各自正常；按定价计费 | P1 |
| BE-RLY3-005 | 音频时长缺失 | 发起 TTS | 按默认/估算计费，不 0 费 | P1 |
| BE-RLY3-006 | 工具调用 | 带 tools 的请求 | 正常；结构化工具附加费正确标记 | P0 |
| BE-RLY3-007 | 推理模型 | 带 reasoning 参数 | 推理 token 单独计价 | P1 |
| BE-RLY3-008 | 敏感词开启 | 请求含敏感词 | 被拦截，提示明确 | P1 |
| BE-RLY3-009 | 最大 token | 超出模型上限 | 上游错误被正确映射为可读错误 | P1 |

### 2.29 Midjourney、视频与任务（BE-TASK）

| ID | 前置 | 步骤 | 预期 | P |
| --- | --- | --- | --- | --- |
| BE-TASK-001 | 有效令牌 | POST /mj/submit/imagine | 提交成功，返回任务 ID | P0 |
| BE-TASK-002 | 有任务 | GET /mj/task/:id/fetch | 返回任务详情与进度 | P0 |
| BE-TASK-003 | 有任务 | GET /mj/task/:id/image/:index | 返回图片，content-type 正确 | P1 |
| BE-TASK-004 | 有任务 | POST /mj/task/list-by-condition、GET /mj/task/:id/image-seed | 正常 | P2 |
| BE-TASK-005 | MJ 变体 | POST /mj/submit/{action,shorten,modal,change,simple-change,describe,blend,edits,video}、POST /mj/insight-face/swap、POST /mj/submit/upload-discord-images | 各自提交成功 | P1 |
| BE-TASK-006 | 模式前缀 | POST /:mode/mj/submit/imagine | 正常（与 /mj 等价） | P2 |
| BE-TASK-007 | 视频生成 | POST /v1/video/generations | 提交成功 | P1 |
| BE-TASK-008 | 有视频任务 | GET /v1/video/generations/:task_id | 返回状态与结果 | P1 |
| BE-TASK-009 | 有视频 | POST /v1/videos/:video_id/remix | 正常 | P2 |
| BE-TASK-010 | 通用任务 | POST /v1/tasks/:key 提交 | 提交成功返回任务 ID | P0 |
| BE-TASK-011 | 有任务 | GET /v1/tasks/:key、GET /v1/tasks/:key/artifacts | 返回状态与产物列表 | P0 |
| BE-TASK-012 | 有产物 | GET / HEAD /v1/tasks/:key/artifacts/:artifact_key/content | 可下载；HEAD 只返头不返体 | P0 |
| BE-TASK-013 | 越权 | 用 A 的令牌取 B 的任务产物 | 拒绝（除非走 artifact access 授权） | P0 |
| BE-TASK-014 | 前端 | GET /api/task/:task_id/artifacts | 控制台可查产物 | P1 |
| BE-TASK-015 | 失败任务 | 查看任务详情 | 失败原因可读；产物区空态正常 | P1 |
| BE-TASK-016 | — | 上传一个含死循环 / 超时代码的插件路由并调用 | Sobek Interrupt 在超时内打断，返回可读错误，进程存活；hook / export / compile 三处均生效 | P0 |
| BE-TASK-017 | 插件声明 usageSchema 但 usageExamples 缺失或与 schema 不匹配 | 上传安装 | 被拒绝或给出明确告警，不安装出一个计费表达式无法求值的插件 | P1 |
| BE-TASK-018 | TASK_ARTIFACT_STORE_MODE=s3 | 提交任务并取产物 | 产物落 S3；预签名 URL 有效期 900s（TASK_ARTIFACT_S3_PRESIGN_TTL）；超期后 403 | P1 |
| BE-TASK-019 | — | 分别用令牌 A、令牌 B、artifact access key 访问任务 A 的产物 | TokenOrTaskArtifactAccessAuth 允许令牌本人或被授权的 access key；令牌 B 被拒，且访问能力绑定单个任务不可横向复用 | P0 |

### 2.30 任务插件（BE-PLG）

| ID | 前置 | 步骤 | 预期 | P |
| --- | --- | --- | --- | --- |
| BE-PLG-001 | 超管 | GET /api/plugin/task | 返回已安装插件（版本/状态/来源） | P0 |
| BE-PLG-002 | 超管 | POST/PUT /api/plugin/task 上传插件包 | 上传成功；重复 key 走版本管理 | P0 |
| BE-PLG-004 | 有插件 | POST /api/plugin/task/:id/enable、/disable | 启停生效；禁用后路由不再命中 | P0 |
| BE-PLG-005 | 有插件 | DELETE /api/plugin/task/:id | 卸载成功；路由与计费项一并清理 | P0 |
| BE-PLG-006 | 有插件 | GET /api/plugin/task/:id/versions | 返回版本列表 | P1 |
| BE-PLG-007 | 多版本 | POST /api/plugin/task/:id/versions/:v/activate | 切换生效；在途请求不被打断 | P1 |
| BE-PLG-008 | 有插件 | GET /api/plugin/task/:id/config、PUT 保存配置 | 读写正常；密钥类脱敏 | P1 |
| BE-PLG-009 | 有插件 | 上传同名不同版本 | 走版本管理，不覆盖线上版本 | P0 |
| BE-PLG-010 | 有插件 | 上传非法包 / 缺 manifest | 拒绝并给出可读原因，不留下半成品 | P0 |
| BE-PLG-011 | 有插件 | 插件内调用宿主能力（HTTP/缓存/日志） | 按授权边界执行；越界调用被拒 | P1 |
| BE-PLG-012 | 有插件 | 插件抛异常 / 返回非法 usage | 被捕获，返回可读错误，不影响主进程 | P0 |
| BE-PLG-013 | 插件渠道 | 新建 type 61 渠道绑定插件 | 绑定成功；无绑定权限时前端隐藏该类型 | P1 |
| BE-PLG-014 | 插件计费 | 通过插件路由发起请求 | 按插件 usage schema 计费，与定价一致 | P0 |
| BE-PLG-015 | 完整性 | 插件完整性校验 | 校验失败时提示且不加载 | P1 |
| BE-PLG-016 | — | 上传一个声明 openai_image 协议（/v1/images/generations）的插件 | 该端点已被 relay-router 占用，插件注册被跳过且不影响现有路由；不产生路由冲突错误 | P1 |
| BE-PLG-017 | — | 对同一插件并发打 100 次请求，断言每次拿到的 RoutingGeneration 一致 | generation 为不可变快照，按请求 pin 生效；热切换版本时在途请求不被打断 | P1 |

### 2.31 系统设置与选项（BE-OPT）

| ID | 前置 | 步骤 | 预期 | P |
| --- | --- | --- | --- | --- |
| BE-OPT-001 | 超管 | GET /api/option/ | 返回全部配置项；密钥类脱敏 | P0 |
| BE-OPT-002 | 超管 | PUT /api/option/ 改站点名/Logo/Footer/About/首页内容/服务地址 | 保存并立即生效（含前端） | P0 |
| BE-OPT-003 | 管理员（非超管） | GET/PUT /api/option/ | 403 | P0 |
| BE-OPT-004 | 超管 | 改法务文档链接 | 前端法务页与页脚跳转随之变化 | P1 |
| BE-OPT-005 | 超管 | 改邮件/SMTP 配置并发送测试邮件 | 标题「<目的>-Uter.ai 优特智能」，正文含 logo，链接无下划线 | P1 |
| BE-OPT-006 | 超管 | 改限流配置 | 生效（见 2.32） | P1 |
| BE-OPT-007 | 超管 | 改币种/汇率/展示类型 | 前端金额展示随之变化，无浮点噪声 | P0 |
| BE-OPT-008 | 超管 | PUT /api/option/passkey/domains | 生效 | P1 |
| BE-OPT-009 | 超管 | GET/DELETE /api/option/channel_affinity_cache | 统计与清理正常 | P2 |
| BE-OPT-010 | 超管 | Waffo Pancake 配置（catalog/pair/save/subscription-product） | 各接口正常 | P2 |
| BE-OPT-011 | 超管 | 自定义 OAuth provider 配置 | 见 2.9 | P1 |
| BE-OPT-012 | 数据一致性 | 改完 option 后重启服务 | 值保持（不被内存旧值覆盖） | P0 |
| BE-OPT-013 | 并发 | 直接改 DB 中的 options 同时服务在运行 | ⚠️ 会被 SyncOptions 覆盖——测试时先停服务 | P1 |
| BE-OPT-014 | 超管 | GET /api/performance/stats、DELETE /disk_cache、POST /reset_stats、POST /gc、GET /logs、DELETE /logs | 各运维操作正常 | P2 |
| BE-OPT-015 | 已配置微信支付（站点与品牌 → 集成 → 微信支付） | GET /api/option/ | `WechatPayApiV3Key` / `WechatPayPrivateKey` / `WechatPayPlatformCert` 均脱敏，**不明文下发** | P0 |
| BE-OPT-016 | 已填 `costopt_setting.batch_embed_api_key` | GET /api/option/ | 该键脱敏（与同组 `batch_api_key`、`semantic_cache_embed_api_key` 一致） | P1 |
| BE-OPT-017 | 新增敏感配置项时（开发期） | 检查 `common/secret_option_keys.go` | 已登记进 `secretOptionKeys` 或 `costOptSecretOptionKeys`，否则该项会明文泄露 | P0 |
| BE-OPT-018 | 超管 | GET/PUT `quota_setting.pre_consume_multiplier` 与 `quota_setting.trust_quota_usd` | 默认值分别为 1 与 10；保存生效；0 倍率/负数倍率/非有限数被拒且不落库（`7384e088e` 新增的两个控件与后端同口径） | P1 |

### 2.32 限流与防刷（BE-RL）

| ID | 前置 | 步骤 | 预期 | P |
| --- | --- | --- | --- | --- |
| BE-RL-001 | 匿名 | 短时间大量请求 /api/* | 触发 GlobalAPIRateLimit；返回 429 语义，不 5xx | P0 |
| BE-RL-002 | 匿名浏览器 | 连续冷启动刷新页面 3 次 | 静态资源不计入限流，index.html 不会被 429（否则白屏） | P0 |
| BE-RL-003 | 匿名 | 大量请求未知路径（回落 SPA 壳） | 触发 GlobalWebRateLimit（默认 120 次/180s） | P1 |
| BE-RL-004 | 已登录 | 高频调用关键接口（登录/重置/支付） | 触发 CriticalRateLimit | P0 |
| BE-RL-005 | 已登录 | 高频调用搜索 | 触发 SearchRateLimit | P1 |
| BE-RL-006 | 已登录 | 高频调用安全验证/2FA/令牌 | 触发 UserCriticalRateLimit(scope)，各 scope 独立计数 | P0 |
| BE-RL-007 | 已登录 | 高频 refresh/logout | 触发 SessionRateLimit；限流键用 RefreshTokenSID(raw) 而非整条令牌 | P0 |
| BE-RL-008 | 有效令牌 | 高频模型请求 | 触发 ModelRequestRateLimit | P1 |
| BE-RL-009 | 限流命中 | 观察响应头/体 | 有明确提示与可感知的重试时间 | P2 |
| BE-RL-010 | 多实例 | Redis 开启时限流 | 跨实例共享计数 | P1 |
| BE-RL-011 | 已配置分组限流 | 同一用户下两个分组分别打满各自限额 | 两分组**独立计数**，互不挤占；未配置分组限流时回落用户级计数（`189540cbd` 修复：此前与用户级混用可旁路分组配额） | P0 |

### 2.33 安全加固（BE-SEC）

| ID | 前置 | 步骤 | 预期 | P |
| --- | --- | --- | --- | --- |
| BE-SEC-001 | SSRF 防护开启 | 渠道 Base URL 填 http://127.0.0.1、内网段、metadata 地址（169.254.169.254） | 拒绝 | P0 |
| BE-SEC-002 | SSRF 防护开启 | 填允许的公网地址 | 放行 | P0 |
| BE-SEC-003 | 出站代理 | 渠道 setting.proxy 为空但进程有 HTTP_PROXY | 回落到进程代理（预期行为，需确认符合部署意图） | P1 |
| BE-SEC-004 | 敏感词 | 全新安装/未设置该 option 时请求含敏感词 | **默认不过滤**（`862cd120f` 对齐上游：CheckSensitiveEnabled/CheckSensitiveOnPromptEnabled 默认 false、默认词表清空）；显式开启后才拦截。已在库设置过该 option 的实例以库值为准 | P1 |
| BE-SEC-005 | 任意接口 | 抓包检查响应 | 无密码哈希、无完整令牌、无渠道密钥、无上游 URL query 凭据 | P0 |
| BE-SEC-006 | 错误提示 | 触发各类上游错误 | 提示已脱敏（剥 query/userinfo），不得回显完整上游域名+路径 | P0 |
| BE-SEC-007 | 越权矩阵 | 遍历 | 403 | P0 |
| BE-SEC-008 | 越权矩阵 | 用户 A 访问用户 B 的令牌/日志 | 403，且不得返回 200 + 空数组 | P0 |
| BE-SEC-009 | 越权矩阵 | 用户 A 访问用户 B 的令牌/日志 | 403 | P0 |
| BE-SEC-010 | XSS | 站点名/公告/模型名填入 | 渲染时被转义；富文本内容按白名单渲染 | P0 |
| BE-SEC-011 | 上传 | 上传非图片/超大文件 | 拒绝 | P1 |
| BE-SEC-012 | 依赖 | govulncheck / bun audit | 无高危 | P1 |
| BE-SEC-013 | 头部 | 检查响应安全头 | 关键页面无 X-Powered-By 泄露；Cookie 带 HttpOnly/Secure（生产） | P1 |
| BE-SEC-014 | 会话固定 | 登录前后比对会话标识 | 登录后轮换 | P0 |
| BE-SEC-015 | 并发注销 | 并发提交删账号请求 | 只有一个赢家（已有 e2e 覆盖） | P1 |
| BE-SEC-016 | 开启敏感词检查 | 构造 content 数组中 type=image_url 的多模态请求 | 当前实现跳过 image_url 不检查（service/sensitive.go 标注 TODO）。断言当前实际行为并登记为已知缺口，见 §8.5 GAP-02 | P0 |
| BE-SEC-017 | — | 请求图片代理端点（controller/image.go 的 GetImage） | 当前该 handler 为空函数体，应返回明确的未实现语义而非 200 空响应。登记为已知缺口，见 §8.5 GAP-01 | P1 |

### 2.34 文档站与静态资源（BE-DOC）

| ID | 前置 | 步骤 | 预期 | P |
| --- | --- | --- | --- | --- |
| BE-DOC-001 | — | GET /docs-content/docs/zh/index.html | 200，真实文档 HTML（lang="zh-CN"） | P0 |
| BE-DOC-002 | — | GET /docs-content/docs//<任意页>/ | 200（带尾斜杠）；不带尾斜杠 301 到带尾 | P1 |
| BE-DOC-003 | — | GET /docs-content/about/zh/... | 200 | P0 |
| BE-DOC-004 | — | GET /docs-content/\_next/static/chunks/*.css | 200，content-type: text/css（Turbopack 下 CSS 在 chunks/ 不在 static/css/） | P1 |
| BE-DOC-005 | — | 遍历文档内图片 URL | content-type 为 image/*；若为 text/html 说明拿到 SPA 壳＝坏图 | P0 |
| BE-DOC-006 | — | 7 种语言各取首页 | 全部 200 且语言正确 | P1 |
| BE-DOC-008 | — | GET /（SPA 首页）、/dashboard、/keys | 返回 SPA 壳 index.html | P0 |
| BE-DOC-009 | — | GET /v1/xxx、/api/xxx 不存在的路径 | 走 RelayNotFound，返回 JSON 404 而非 HTML | P0 |
| BE-DOC-010 | — | GET /uter-bimi.svg | 200 且带 Access-Control-Allow-Origin: * | P2 |
| BE-DOC-011 | gzip | 检查 SPA 响应 | 只压缩一次（重复压缩会导致页面乱码） | P0 |
| BE-DOC-012 | 文档站已构建 | 检查 docs-web search-index.json 的语言覆盖与链接前缀 | 7 语言全覆盖；索引内 url 与 withDocsBasePath 一致，不出现双前缀 | P1 |

### 2.35 数据库、多节点与迁移（BE-INF）

| ID | 前置 | 步骤 | 预期 | P |
| --- | --- | --- | --- | --- |
| BE-INF-001 | SQLite | 完整跑一遍核心用例 | 全通过 | P0 |
| BE-INF-002 | MySQL | 同上（SQL_DSN） | 全通过 | P0 |
| BE-INF-003 | PostgreSQL | 同上 | 全通过 | P0 |
| BE-INF-004 | 独立日志库 | 配置 LOG_SQL_DSN | 日志写入独立库，主库查询正常 | P1 |
| BE-INF-005 | ClickHouse 日志库 | 配置后跑日志用例 | 正常 | P2 |
| BE-INF-006 | 升级 | 从上一版本二进制启动旧库 | 自动迁移成功，数据不丢 | P0 |
| BE-INF-007 | Redis 开启 | 完整用例 | 与内存缓存行为一致；组织字段在缓存中持久化 | P1 |
| BE-INF-008 | 多节点 | NODE_TYPE=slave 起从节点 | 同步正常；GET /api/system-info/instances 可见 | P1 |
| BE-INF-009 | 陈旧实例 | DELETE /api/system-info/stale-instances、DELETE /instances/:node_name | 清理成功 | P2 |
| BE-INF-010 | 迁移幂等 | 重复启动 | 不重复建表/建索引 | P1 |
| BE-INF-011 | — | 把某用户 quota / used_quota / aff_quota / aff_history 置为极大值后启动 | 启动即通过 64 位校验（model/main.go 的 quota 四列强校验），不溢出、不截断 | P0 |
| BE-INF-012 | SQLite 库 | 从旧版本库升级到当前版本（含 subscription_plans 新增列） | subscription_plans 走手工建表 + 逐列 ALTER，迁移幂等且不丢数据；重复启动不重复建列 | P0 |


### 2.36 运维与任务（BE-OPS）

| ID | 前置 | 步骤 | 预期 | P |
| --- | --- | --- | --- | --- |
| BE-OPS-001 | 超管 | POST /api/system-task/log-cleanup | 创建清理任务 | P1 |
| BE-OPS-003 | 超管 | POST /api/system-task/{log-cleanup,quota-data,channel-test} | 各自任务创建成功 | P1 |
| BE-OPS-004 | 有任务 | GET /api/system-task/、GET /api/system-task/:id | 列表与详情正常 | P1 |
| BE-OPS-005 | 任务执行中 | POST /api/system-task/:id/cancel | 取消成功；已产生副作用不回滚 | P2 |
| BE-OPS-006 | 定时任务 | 等待触发点到达 | 按时触发；重复启动不并发执行 | P1 |
| BE-OPS-007 | 任务失败 | 查看任务详情 | 失败原因可读，可重试 | P1 |
| BE-OPS-008 | 超管 | GET /api/system-info/、/instances | 实例信息与系统信息正常返回 | P2 |
| BE-OPS-009 | NODE_TYPE=master，两实例 NODE_NAME 不同 | 两个实例同时领取同一 task_type 的系统任务 | 仅一个获得 system_task_locks 租约；锁过期后可被另一实例重新领取 | P0 |
| BE-OPS-010 | 任务执行中 | 强制使锁过期（lockUntil 已过）后让任务尝试写回 | 返回 ErrSystemTaskLockLost 并放弃写入，不产生重复副作用 | P1 |
| BE-OPS-011 | DataExportInterval=1 | 等待看板落库后查 quota_data 与日志 | 按日聚合值与 logs 口径一致，不出现 NaN 或负值 | P1 |

### 2.37 渠道类型与能力映射（BE-MAP）

| ID | 前置 | 步骤 | 预期 | P |
| --- | --- | --- | --- | --- |
| BE-MAP-001 | — | 表驱动遍历 constant/channel.go 全部 ChannelType（0–63 有效值 + 600/601/602，共 63 个），对每个类型断言 ChannelType2APIType 返回的 apiType 非 -1，且 GetAdaptor(该 apiType) 返回非 nil | 全表通过。历史缺陷（type 21 AIProxyLibrary 的 GetAdaptor 曾返回 nil）已修复并复用 openai.Adaptor，本条作为防回归固化 | P0 |
| BE-MAP-002 | — | 断言 ChannelType2APIType(constant.ChannelTypeTaskPlugin) 返回 ok=false 且 apiType=-1 | 成立。防止任务插件渠道回落到 OpenAI adaptor 而绕过插件计费 | P0 |
| BE-MAP-003 | — | 对未在 ChannelType2APIType 显式 case 的类型（3 Azure、8 Custom、19 360、31 灵易万悟，以及品牌渠道 600/601/602）调用 ChannelType2APIType | 返回 (APITypeOpenAI, false)；并断言调用方对 ok=false 的处理分支正确，不把 ok=false 当致命错误。⚠️ 品牌三型同样回落 OpenAI——是否为设计意图见 §8.5 GAP-15 | P0 |
| BE-MAP-004 | — | 遍历全部 63 个渠道类型，断言 IsAdvancedCustomChannelType(type) 为 true 的集合恰为 {58, 62, 63, 600, 601, 602} 六者 | 集合精确相等。62/63（vLLM/SGLang）与 600/601/602（品牌三型）是 AdvancedCustom 的一等变体，必须处处等同 58，否则精确路径白名单失效（`b1655a5d2` 迁移后集合由 4 个变为 6 个） | P0 |
| BE-MAP-005 | — | 对 type 62 / 63 / 600 / 601 / 602 各建一条渠道，断言展示名、logo、路由、计费、流式能力与 type 58 行为一致 | 五者与 58 无差异（62/63 由 GetAdvancedCustomPreset 种子路由，600/601/602 由前端种子 display_name/logo）。注意 601 的「聚合」语义仍无任何实现（见 §8.5 GAP-04）；600/601/602 的 adaptor 解析疑点见 §8.5 GAP-15 | P0 |
| BE-MAP-006 | 新建 type 600 渠道并配 advanced_routes | 用其发起一次 /v1/chat/completions 中继，核对该渠道实际使用的 adaptor 与路由匹配 | 实测记录当前行为：ChannelType2APIType(600/601/602) 无显式 case → 回落 (APITypeOpenAI, false) → GetAdaptor 返回 OpenAI adaptor（**非** AdvancedCustom adaptor），advanced_routes 不参与匹配。若产品预期为 AdvancedCustom 行为则记缺陷并修 api_type.go，否则修订 constant/channel.go 注释与前端宣称（GAP-15） | P0 |

### 2.38 渠道路由、选择与重试（BE-SEL）

| ID | 前置 | 步骤 | 预期 | P |
| --- | --- | --- | --- | --- |
| BE-SEL-001 | 同分组同模型 3 条渠道，权重 1 / 2 / 3 | 发起 300 次请求，统计各渠道命中数 | 命中分布与权重成正比（偏差在统计容忍范围内），无随机偏斜 | P0 |
| BE-SEL-002 | 两条渠道，高优先级健康、低优先级亦健康 | 发起 100 次请求 | 100% 命中高优先级渠道；低优先级仅在高优先级不可用时被选中。**V1.5.0 口径更新**：优先级由渠道优先级子系统（`PRIO-*`）维护，测试前须先 `POST /api/channel/priority/reorder` 明确顺序；直接改 `channels.priority` 数值不再保证生效（`abilities` 双写 + revision 校验） | P0 |
| BE-SEL-003 | 开启渠道亲和性，渠道 A 亲和失败 | 同一会话连续请求 | 亲和失败后不重试（ShouldSkipRetryAfterChannelAffinityFailure 生效），按亲和失败语义返回，不静默切到亲和渠道 | P1 |
| BE-SEL-004 | mock 上游，RetryTimes=2 | 让首条渠道连续失败，观察重试链路 | 最多重试 2 次；不重试 4xx 类不可重试错误；最终只按成功请求计费一次 | P0 |
| BE-SEL-005 | 多 Key 渠道 | 连续请求，其中一个 Key 失效 | 自动剔除失效 Key 并轮询其余；不整条渠道失效 | P1 |
| BE-SEL-006 | 高级自定义渠道 58/62/63/600/601/602 | 请求 `settings.advanced_custom.advanced_routes` 白名单外的路径 | 被 FilterRequestPath 精确字符串匹配拒绝，不回落 | P0 |

### 2.39 断号补齐用例（V1.1.0 丢失正文，本次重写）

> 本节原恢复的用例（共 54 条：BE-RLY-013/014、BE-RLY2-007/008、BE-SES-003、BE-2FA-005、BE-PK-006、BE-OAU-004~013、BE-USR-009、BE-TOK-003、BE-ORG-013/014、BE-PAY-003~011、BE-TASK-002/003、BE-PLG-004~013、BE-SEC-008、BE-DOC-008、BE-MDL-014、BE-SEL-004~006、BE-OPS-003~008）经逐项核查，与各自主章节（第 2 章对应小节）的定义与内容完全一致，已并入主章节。此处不再重复列示，以消除编号冲突。
## 3. 前端测试用例（FE-\*）

> **本章为 V1.2.0 新增**。V1.1.0 仅在第 0 章写了「第 3 章是前端」，但正文一条 FE 用例都没有。
> 本章依据 `web/src/features/` 下 30 个功能模块与项目硬约定编写。
> 通用约定：所有 FE 用例默认在**深色主题**（`theme-provider.tsx` 的 `DEFAULT_THEME='dark'`）下验证，
> 除非用例显式要求切换主题。

### 3.1 主题与品牌视觉（FE-THM）

| ID          | 前置    | 步骤                                | 预期                                                       | P  |
| ----------- | ----- | --------------------------------- | -------------------------------------------------------- | -- |
| FE-THM-001  | 首次访问  | 清 localStorage 后打开首页               | 默认深色主题，无白屏闪烁（FOUC）                                        | P0 |
| FE-THM-002  | 已登录   | 在设置中切换深/浅色                         | 立即生效并持久化；刷新后保持                                            | P0 |
| FE-THM-003  | 已登录   | 切换「跟随系统」后改系统主题                     | 跟随变化                                                      | P2 |
| FE-THM-004  | 任意页   | 检查全站字体                             | 统一走 `--font-ui`（唯一真源），无硬编码字体族                            | P1 |
| FE-THM-005  | 任意页   | 检查所有链接                             | 全站无下划线（含页脚法务链接、邮件正文同款规则）                                  | P1 |
| FE-THM-006  | 含品牌图标 | 遍历模型/供应商图标                         | 均为非彩色单色变体（`@lobehub/icons` 不带 `.Color`）                  | P1 |
| FE-THM-007  | 登录/邮件 | 检查发件人名与品牌串                         | `Uter.ai` / `Uter.ai 优特智能`，不出现 camelCase 品牌              | P1 |
| FE-THM-008  | 首页    | 检查 logo 旁版本号                       | 与 `VERSION` 文件一致                                          | P2 |

### 3.2 路由与导航（FE-NAV）

| ID         | 前置    | 步骤                     | 预期                                    | P  |
| ---------- | ----- | ---------------------- | ------------------------------------- | -- |
| FE-NAV-001 | 未登录   | 访问 /dashboard          | 重定向登录页并带回跳参数                          | P0 |
| FE-NAV-002 | 未初始化  | 访问 /                   | 自动跳转 /setup 展示安装向导                    | P0 |
| FE-NAV-003 | 已初始化  | 访问 /setup              | 重定向 /                                 | P0 |
| FE-NAV-004 | 任意    | 访问不存在的路径（如 /no-such-page） | 回落 SPA 壳；`/api/*`、`/v1/*` 走 JSON 404 而非 HTML | P0 |
| FE-NAV-005 | 旧路径   | 访问 legacy 路由           | 经 `legacy-route.ts` 正确重定向，不 404       | P1 |
| FE-NAV-006 | 已登录   | 软导航切换页面                | 不整页刷新；顶部进度条行为符合当前设定（已隐藏未移除）           | P2 |
| FE-NAV-007 | 文档站   | 点击站内文档链接               | 站内 URL 过 `withDocsBasePath()`，不出现双前缀   | P0 |
| FE-NAV-008 | 文档站   | 侧栏/搜索跳转                | `<Link>` 与侧栏不加 basePath，跳转正确          | P1 |
| FE-NAV-009 | 控制台   | 浏览器前进/后退               | 状态与筛选条件不丢失                            | P2 |

### 3.3 表单与校验（FE-FRM）

| ID         | 前置   | 步骤                          | 预期                                     | P  |
| ---------- | ---- | --------------------------- | -------------------------------------- | -- |
| FE-FRM-001 | 注册页  | 输入 7 / 8 / 18 / 19 码点密码     | 7、19 拒绝；8、18 通过（与后端四处策略同源）            | P0 |
| FE-FRM-002 | 注册页  | 单一字符类型密码                    | 拒绝并提示至少两类                              | P0 |
| FE-FRM-003 | 注册页  | 密码含用户名或邮箱本地部分               | 拒绝                                     | P0 |
| FE-FRM-004 | 注册页  | `P@ssw0rd123`               | 拒绝（leet 归一化命中）                         | P0 |
| FE-FRM-005 | 注册页  | 两次密码不一致                     | 前端即拦截，不发请求                             | P0 |
| FE-FRM-006 | 任意表单 | 必填项留空提交                     | 逐项标红并聚焦首个错误项                           | P0 |
| FE-FRM-007 | 渠道表单 | 切换供应商                       | URL 占位提示随之变化；不覆盖已手填地址                  | P1 |
| FE-FRM-008 | 渠道表单 | 保存失败后再次打开                    | 草稿保留，不丢用户输入                            | P1 |
| FE-FRM-009 | 敏感操作 | 未通过二次验证点保存                   | 引导安全验证，不提交                             | P0 |
| FE-FRM-010 | 任意表单 | 提交进行中重复点击                    | 按钮禁用，不产生重复请求                           | P0 |
| FE-FRM-011 | 组织创建/编辑表单 | 预算或成员上限填负数 / 非有限数字 / 触发 validity.badInput | 阻止提交并给出可读错误；**不静默折算**（后端 quota=0 即不限额，`742410cb2` 修复；与 BE-ORG-024 同口径） | P0 |
| FE-FRM-012 | 重置密码页 | 从邮件链接进入（URL 带 email/token） | 取到参数后立即 `replaceState` 清除查询串，凭证移入 ref 继续提交；浏览器历史/地址栏不残留令牌（`742410cb2`） | P0 |

### 3.4 列表、表格与筛选（FE-LST）

| ID         | 前置    | 步骤                | 预期                          | P  |
| ---------- | ----- | ----------------- | --------------------------- | -- |
| FE-LST-001 | 大数据量  | 翻页到最后一页           | 无重复、无遗漏                     | P1 |
| FE-LST-002 | 列表页   | 改每页条数             | 分页重算并回到第 1 页                | P2 |
| FE-LST-003 | 日志页   | 组合多个筛选条件          | 条件叠加生效；重置按钮一次清空             | P1 |
| FE-LST-004 | 日志页   | 设置起止时间相等/跨月/未来时间  | 不报错，结果合理                    | P2 |
| FE-LST-005 | 列表页   | 排序切换              | 排序正确且有视觉指示                  | P2 |
| FE-LST-006 | 列表页   | 空数据               | 展示空态而非报错或空白表格               | P1 |
| FE-LST-007 | 列表页   | 请求失败              | 展示可重试错误态，数据区不残留旧数据混淆        | P1 |
| FE-LST-008 | 搜索框   | 高频输入触发搜索          | 有防抖；命中 SearchRateLimit 时给出提示 | P1 |
| FE-LST-009 | API Keys 页 | 点击查看/复制某令牌明文 | 弹出二次验证（Passkey / 2FA / 密码）弹窗；验证通过后展示/复制 `sk-` 明文；取消验证则不展示、不泄露 | P0 |
| FE-LST-010 | 用量日志页 | 查看顶部汇总条 | 含「缓存写入 / 缓存读取」两项，且**恒显示（含 0）**——否则「统计不到」与「确实没命中缓存」无法区分 | P1 |
| FE-LST-011 | 用量日志页 | 核对汇总条缓存值与区间明细 | 与明细 SUM 一致（后端返回 `cache_read_tokens` / `cache_write_tokens`） | P0 |
| FE-LST-012 | 日志列表 token 列 | 查看 Input / Output / Cache Read / Cache Write | 四项各占一行、等宽数字对齐；缓存项 **>0 才显示**（与汇总条「恒显示」的语义分工不同，单条明细无歧义） | P2 |
| FE-LST-013 | 钱包页 / 组织页 | mock fetchUser 或组织 loadAll 失败 | 展示 Alert + Retry 错误态，**不静默渲染空数据**；组织页用 Promise.allSettled 区分 initError/dataError；写操作失败保留用户已填输入（`742410cb2`） | P1 |

### 3.5 国际化（FE-I18N）

| ID          | 前置    | 步骤                        | 预期                                          | P  |
| ----------- | ----- | ------------------------- | ------------------------------------------- | -- |
| FE-I18N-001 | 任意页   | 切换 7 种语言逐个浏览              | 无 key 回落裸露（缺键会直接显示英文 key）                   | P0 |
| FE-I18N-002 | 任意页   | 检查含占位符文案                  | `{{name}}` 在各语言均正确替换，不被翻译破坏                 | P0 |
| FE-I18N-003 | 构建前   | `node scripts/check-i18n-keys.mjs` | 7166 静态键 + 692 登记键 × 7 语言全通过（V1.4.0 复核值，随功能增减）       | P0 |
| FE-I18N-004 | 运行时   | 语言包热更新开启时切语言              | 拉取 `GET /api/i18n/:file` 并合并；失败时回落到内置包      | P1 |
| FE-I18N-005 | 首屏    | 断网/接口 404 时加载              | 仍能用内置包渲染（不得删除 `i18n/config.ts` 静态 import）   | P0 |
| FE-I18N-006 | 控制台   | 检查 localStorage 键         | 用户私有数据一律 `scopedKey()` 带 `:{user.id}`，切换账号不串数据 | P0 |
| FE-I18N-007 | 数字/日期 | 切换 zh / en / ru           | 千分位与日期格式随语言正确                                | P2 |
| FE-I18N-008 | 文档站   | 切换文档语言                     | 7 语言均可达，无 404                                | P1 |
| FE-I18N-009 | 已登录，当前界面为英文 | 在头部语言切换器点一次「简体中文」 | **首点即生效**：locale chunk 先 `await ensureLocale(next)` 合并、再 `changeLanguage`，界面不先用英文渲染一帧（`b7a4e58a8` 修复需点两次的问题） | P0 |
| FE-I18N-010 | 已登录 | 切换语言后等待令牌轮换 / 静默刷新（applyAuthBundle） | 界面语言**不回退**：切换器已用 `auth.setUser` 同步 `setting.language`；`applySavedLanguage` 读到新值，不再把界面改回账号旧存值 | P0 |
| FE-I18N-011 | 从未保存过语言的账号 | 切换失败触发回滚 | 回滚到**切换前的实际界面语言**（`previousLanguage = i18n.language`），不得因 `setting.language` 为空被 normalize 成 'en' 而错误回退到英语 | P0 |
| FE-I18N-012 | 运行时多语言热更新 | 切到非英语并触发语言包重新合并 | 合并后界面**重渲染**出新文案（`react.bindI18n='languageChanged loaded'`，`272a07e47`）；页脚标语 `whitespace-nowrap` 单行不折行（英/法/俄长句） | P1 |

### 3.6 权限可见性（FE-PRM）

| ID         | 前置            | 步骤              | 预期                       | P  |
| ---------- | ------------- | --------------- | ------------------------ | -- |
| FE-PRM-001 | 普通用户          | 打开渠道/用户/系统设置页   | 入口不可见；直接输 URL 也被后端 403   | P0 |
| FE-PRM-002 | U-PERM（被降权）   | 打开渠道页           | 新建/删除/复制按钮禁用，接口 403     | P0 |
| FE-PRM-003 | 组织成员          | 打开组织页           | 只看到自己的额度；预算字段不可见        | P0 |
| FE-PRM-004 | U-NOORG       | 打开组织页           | 空态引导，不报错                 | P1 |
| FE-PRM-005 | 超管            | 修改管理员权限后前端刷新    | 无需重启立即生效（与 Redis 缓存同步）   | P0 |
| FE-PRM-006 | 演示站模式         | 打开任意写操作         | 按只读提示，不静默失败              | P1 |
| FE-PRM-007 | 普通用户          | 打开 /api/status 驱动的功能开关 | 与后台 HeaderNavModules 一致 | P1 |
| FE-PRM-008 | 普通用户 / 管理员 / 侧边设置隐藏了某页的用户 | 打开控制台搜索/命令菜单 | 结果按「角色 + 侧边设置」过滤，**不列出**用户无权限或侧边设置隐藏的页面（`3be9d065d` 对齐上游 908f94d6，CommandMenu 移入 authenticated-layout 消除循环依赖） | P1 |
| FE-PRM-009 | 管理员 | 在用户抽屉创建/更新管理员 | 先走身份确认流程（Verify to create administrator / Confirm your identity…）后才提交；展示用户编号（`db98e57cd` 对齐上游） | P1 |

### 3.7 计费与金额展示（FE-BIL）

| ID         | 前置   | 步骤               | 预期                                        | P  |
| ---------- | ---- | ---------------- | ----------------------------------------- | -- |
| FE-BIL-001 | 消费页  | 查看消费金额           | 用 `formatBillingCurrencyFromUSD`，不出 token 数 | P0 |
| FE-BIL-002 | 钱包页  | 查看额度             | 不出 `formatQuota()` 裸值                      | P0 |
| FE-BIL-003 | 定价页  | 切换币种/汇率          | 换算正确，无浮点噪声（如 0.30000000000000004）         | P1 |
| FE-BIL-004 | 定价页  | 保存含显式零价的配置       | 零价被保留，不被当成「未设置」                           | P0 |
| FE-BIL-005 | 定价页  | 切换 token 单位 1K/1M | request 价不受影响                             | P1 |
| FE-BIL-006 | 渠道计费 | 查看逐维度定价          | 只读 `Official:` 对照行与可编辑字段区分明确              | P1 |
| FE-BIL-007 | 日志页  | 查看单条消费           | 与后端 `logs.quota` 口径一致                     | P0 |
| FE-BIL-008 | 组织页  | 查看剩余额度           | 超支时钳 0 展示，不显示负值                           | P1 |
| FE-BIL-009 | 定价页  | 切换排序（输入/输出/按次价格 × 升/降序，共 6 项） | 排序正确；任务模型与无价模型**置底**（`3be9d065d` 对齐上游 c9f7b620，原仅 2 项价格升降） | P2 |

### 3.8 渠道配置（FE-CHN）

| ID         | 前置   | 步骤               | 预期                              | P  |
| ---------- | ---- | ---------------- | ------------------------------- | -- |
| FE-CHN-001 | 渠道列表 | 打开列表             | 分页正确；密钥列脱敏                      | P0 |
| FE-CHN-002 | 渠道页  | 查看渠道密钥           | 触发安全验证；通过后展示，审计有记录              | P0 |
| FE-CHN-003 | 渠道页  | 测试单条渠道           | 展示连通性与延迟；失败原因可读                 | P0 |
| FE-CHN-004 | 渠道页  | 新建各类型渠道          | 表单字段随类型切换；type 61 需绑定权限才显示     | P0 |
| FE-CHN-005 | 渠道页  | 批量启停/打标/删除       | 逐条反馈结果                          | P1 |
| FE-CHN-006 | 渠道页  | 多 Key 管理          | 增删改生效                           | P1 |
| FE-CHN-007 | 渠道页  | 拉取上游模型并应用变更      | 预览 diff，冲突时提示而非静默覆盖            | P1 |
| FE-CHN-008 | 渠道页  | 高级自定义渠道（58/62/63/600/601/602）配置路由白名单 | 保存后与实际放行路径一致       | P0 |


### 3.9 组织与额度（FE-ORG）

| ID         | 前置     | 步骤            | 预期                      | P  |
| ---------- | ------ | ------------- | ----------------------- | -- |
| FE-ORG-001 | 组织 owner | 打开组织概览      | 预算/已用/剩余/成员数正确          | P0 |
| FE-ORG-002 | 组织 owner | 批量添加成员      | 逐行返回成功/失败原因             | P0 |
| FE-ORG-003 | 部门管理员  | 调整本部门成员子额度    | 成功；跨部门不可见               | P0 |
| FE-ORG-004 | 组织管理员  | 查看组织日志/统计     | 仅本组织数据                  | P0 |
| FE-ORG-005 | 组织管理员  | 按日/按人聚合查看     | 与日志口径一致                 | P1 |
| FE-ORG-006 | 组织成员   | 个人账户页          | 不展示组织预算                 | P0 |
| FE-ORG-007 | 组织 owner | 改组织预算       | 非超管时入口不可见且接口拒绝          | P0 |

### 3.10 Playground 与 Chat（FE-PG）

| ID        | 前置   | 步骤                  | 预期                            | P  |
| --------- | ---- | ------------------- | ----------------------------- | -- |
| FE-PG-001 | 已登录  | 打开 Playground 发起会话  | 走会话鉴权（/pg/*），按用户额度计费          | P0 |
| FE-PG-002 | 已登录  | 流式输出                | 逐字渲染，可中断                      | P0 |
| FE-PG-003 | 已登录  | 切换模型                | 只列出该用户可用模型                    | P0 |
| FE-PG-004 | 已登录  | 额度不足时发起             | 明确提示，不静默失败                    | P0 |
| FE-PG-005 | 已登录  | 会话历史持久化             | 按用户 id 分键存储，换账号不串             | P0 |
| FE-PG-006 | 已登录  | 多模态/工具调用展示          | 结构化渲染正确                       | P1 |
| FE-PG-007 | 已登录  | 上游响应含 reasoning 字段       | 思考内容透传展示，不丢失、不错位（`3be9d065d` 对齐上游 c9179d38）            | P2 |
| FE-PG-008 | 已登录  | 打开需明文密钥的聊天预设（iframe 嵌入） | 同源嵌入时 iframe **收回** `allow-same-origin`（否则被嵌入页可访问父窗口 DOM 并移除 sandbox）；`referrerPolicy=no-referrer`；非 http(s) 地址拒绝渲染；需明文密钥的预设先向用户披露接收方主机名（`742410cb2` resolveChatEmbedPolicy） | P0 |

### 3.11 站点页与法务（FE-SITE）

| ID          | 前置   | 步骤                 | 预期                        | P  |
| ----------- | ---- | ------------------ | ------------------------- | -- |
| FE-SITE-001 | 匿名   | 打开首页               | 200 且渲染完整，导航模块按后台开关显示     | P0 |
| FE-SITE-002 | 匿名   | 打开定价页（requireAuth） | 未登录时按配置跳转登录               | P1 |
| FE-SITE-003 | 匿名   | 打开关于页              | 200；内容来自文档站 about          | P0 |
| FE-SITE-004 | 匿名   | 打开排行榜              | 周期切换（today/week/month/year）正确 | P1 |
| FE-SITE-005 | 任意   | 打开法务页与页脚链接         | 链接取自后台 option 配置           | P1 |
| FE-SITE-006 | 任意   | 检查 `uter-bimi.svg` | 可访问且带 CORS 头               | P2 |
| FE-SITE-007 | 任意   | 检查 favicon         | `/favicon.ico` 302 → `/logo.png` | P2 |
| FE-SITE-008 | 匿名，首页 | 查看页脚备案三件套（ICP 备案号/企业信用号/公网安备） | 与「智能大模型服务平台」标语**同列横排**、项间 30px；图标与「域名备案号：」等前缀为纯文本，**仅冒号后的备案号**是可点击外链，指向对应政府站点（`c42a0275c`） | P1 |
| FE-SITE-009 | 任意 | 7 种语言逐个查看页脚备案三键 | 三键均有译文（`b84f5f7d7`）；备案号/信用代码等标识符在各语种**原样保留**不被翻译 | P2 |
| FE-SITE-010 | 任意 | 英文/法文/俄文下查看页脚标语 | 单行不折行（`whitespace-nowrap`，`272a07e47` 移除 `max-w-[200px]`） | P2 |

### 3.12 智能客服挂件（FE-CS）

| ID        | 前置              | 步骤           | 预期                             | P  |
| --------- | --------------- | ------------ | ------------------------------ | -- |
| FE-CS-001 | 已配置客服地址         | 打开页面          | 挂件渲染；品牌紫 `#6467f0`            | P1 |
| FE-CS-002 | 客服地址为空          | 打开页面          | 挂件不渲染，不报错                      | P0 |
| FE-CS-003 | 挂件已渲染           | 发起问答          | 跨域直连客服后端（Uter 不反代 `/api/cs/*`） | P0 |
| FE-CS-004 | 页面开关 `none`     | 打开所有页面        | 全部不渲染挂件                        | P1 |
| FE-CS-005 | 页面开关为列表         | 打开指定/非指定页     | 仅指定页渲染                         | P1 |
| FE-CS-006 | 切换语言            | 发起问答          | 语种经 `i18nextLng` 透传，命中对应知识库    | P2 |
| FE-CS-007 | 一键转知识库          | 从访客问答转入       | 闭环成功                           | P2 |

### 3.13 响应式与可访问性（FE-A11Y）

| ID          | 前置   | 步骤                  | 预期                  | P  |
| ----------- | ---- | ------------------- | ------------------- | -- |
| FE-A11Y-001 | 任意页  | 窗口 1920/1280/768/375 | 布局不错位、不横向滚动         | P1 |
| FE-A11Y-002 | 任意页  | 键盘 Tab 遍历           | 焦点顺序合理且可见           | P2 |
| FE-A11Y-003 | 弹窗   | 打开/关闭               | 焦点陷入弹窗，Esc 可关        | P2 |
| FE-A11Y-004 | 表格   | 屏幕阅读器读取             | 表头与单元格关联正确           | P2 |
| FE-A11Y-005 | 表单   | 错误提示                | 与输入项 aria 关联          | P2 |
| FE-A11Y-006 | 任意页  | 检查深色主题对比度            | 文本对比度达标              | P2 |

### 3.14 桌面端 Electron（FE-ELC）

| ID         | 前置    | 步骤          | 预期              | P  |
| ---------- | ----- | ----------- | --------------- | -- |
| FE-ELC-001 | 桌面端启动 | 启动应用        | 加载内嵌服务，窗口正常     | P2 |
| FE-ELC-002 | 桌面端   | 关闭窗口        | 后台进程正确退出，不残留端口  | P2 |
| FE-ELC-003 | 桌面端   | 系统托盘/菜单     | 功能正常            | P2 |
| FE-ELC-004 | 桌面端   | 数据与网页版隔离    | 不串用浏览器 localStorage | P1 |

---

## 4. 新增后端模块用例（V1.2.0）

> 以下 4 个模块的路由/代码在 V1.1.0 已存在，但**零用例覆盖**。本节补齐。

### 4.1 降本优化（BE-CST）

| ID         | 前置                       | 步骤                                              | 预期                                                | P  |
| ---------- | ------------------------ | ----------------------------------------------- | ------------------------------------------------- | -- |
| BE-CST-001 | 默认配置                     | 直接发起请求                                          | 全部特性默认 OFF，行为等同未开启（不引入额外延迟/改写）                    | P0 |
| BE-CST-002 | 超管                       | GET /api/costopt/metrics（未开启 MetricsEnabled）     | 拒绝/不暴露（守卫生效）                                      | P0 |
| BE-CST-003 | 超管                       | 开启 MetricsEnabled 后 GET /api/costopt/metrics     | 返回指标；普通用户 403                                     | P1 |
| BE-CST-004 | 后台「模型与路由 → 模型部署 → 降本优化」 | 不填上游参数直接开启某项                                    | 该项为 no-op，不报错（排查「降本没效果」先看这里）                      | P0 |
| BE-CST-005 | 同上                       | 填全上游参数后开启                                       | 生效；请求结果符合该项预期                                     | P1 |
| BE-CST-006 | 启动                       | 观察 WarmupCache()                                | 启动即预热；无上游参数时不阻塞启动                                 | P1 |
| BE-CST-007 | ~~语义缓存开启~~                 | ~~重复相同请求~~                                        | ⛔ **已随功能下线移除**（2026-10-10，语义缓存属有损/需外部基建手段，代码已删）   | —  |
| BE-CST-008 | CDN 重写                   | 检查静态资源                                          | ⚠️ 逻辑就绪但无调用入口（见 §8.5 GAP-06）                       | P2 |
| BE-CST-009 | i18n                     | 切到中文查看降本面板                                      | key `Cost Optimization` 有对应译文，不回落英文                | P1 |
| BE-CST-010 | 任意配置                     | 开启降本后发请求，检查响应 model 与请求体                        | 🔴 模型名**恒等于客户所选模型**；prompt 内容、tools schema 均**未被改写或裁剪** | P0 |
| BE-CST-011 | 代码层                      | 检索 `relay/costopt/` 与 `compatible_handler.go`     | 🔴 无 `ApplyPromptCompression` / `ApplyContextWindow` / `ApplyImageResize` / `ApplyToolDefTrim` / `ApplyStructuredOutput` / `MatchShortCircuit` 调用点，相关文件已不存在 | P0 |
| BE-CST-012 | 普通问答（非 JSON 意图）         | 发起「1+1 等于几」类请求                                  | 200 且正常应答；不得被注入 `response_format=json_object`（历史上曾致全量 400） | P0 |
| BE-CST-013 | 后台降本面板                   | 查看各特性分组                                          | 有损项（压缩/上下文窗口/工具精简/图像下采样/结构化输出/短路/语义缓存）**不再出现**；护栏（max_tokens_cap/agent_step_budget）保留且默认关 | P1 |

### 4.2 运行时多语言（BE-I18N）

| ID          | 前置                 | 步骤                                    | 预期                                     | P  |
| ----------- | ------------------ | ------------------------------------- | -------------------------------------- | -- |
| BE-I18N-001 | 未设 UTER_I18N_DIR   | GET /api/i18n/:file                    | 404；前端保留内置包                            | P0 |
| BE-I18N-002 | 已设 UTER_I18N_DIR   | GET /api/i18n/en.json                  | 返回磁盘版语言包                               | P0 |
| BE-I18N-003 | 已设                 | GET /api/i18n/../../etc/passwd（路径穿越）    | 拒绝（文件名白名单在 controller/i18n.go）         | P0 |
| BE-I18N-004 | 已设                 | GET /api/i18n/evil.json（非白名单）          | 拒绝                                     | P0 |
| BE-I18N-005 | 更新磁盘语言包            | 重新请求                                   | 拿到新内容（热更新生效，不需重编二进制）                   | P0 |
| BE-I18N-006 | 前端                 | 启动 + 切语言                              | fetch 后 `addResourceBundle(deep, overwrite)` 合并 | P1 |
| BE-I18N-007 | 前端                 | 删除 i18n/config.ts 静态 import（反向用例）      | ⚠️ 首屏无文案 → **不允许**，该 import 必须保留       | P0 |

### 4.3 文档站与语言包热更新（BE-HOT）

| ID         | 前置                     | 步骤                             | 预期                                       | P  |
| ---------- | ---------------------- | ------------------------------ | ---------------------------------------- | -- |
| BE-HOT-001 | 设 UTER_DOCS_DIR 指向真实目录 | GET /docs-content/docs/zh/index.html | 由磁盘提供（DiskFolder），非嵌入副本                | P0 |
| BE-HOT-002 | 未设 UTER_DOCS_DIR       | 同上                              | 回退嵌入副本                                   | P0 |
| BE-HOT-003 | 热更新开启                  | rsync 新产物进目录后请求                 | 立即生效，**不重编不重启**                          | P0 |
| BE-HOT-004 | 热更新开启                  | 检查响应头 ETag                     | 有内容 ETag（FNV-1a）；`DiskETag` 必须注册在 `static.Serve` **之前** | P1 |
| BE-HOT-005 | 目录布局                   | 检查目录结构                          | 与 `web/dist/docs-content` 布局等同，否则缺页      | P0 |
| BE-HOT-006 | 静态资源                   | 遍历文档内图片                         | content-type 为 `image/*`；若为 text/html 说明拿到 SPA 壳 | P0 |

### 4.4 智能客服集成（BE-CS）

| ID        | 前置          | 步骤                                        | 预期                                       | P  |
| --------- | ----------- | ----------------------------------------- | ---------------------------------------- | -- |
| BE-CS-001 | 已配置         | GET /api/status，读 `data.customer_service_url` | 返回客服地址（响应为 `{success,message,data}` 三层包裹，读一律 `r.data ?? r`） | P0 |
| BE-CS-002 | 未配置         | 同上                                         | 为空；前端挂件不渲染                               | P0 |
| BE-CS-003 | 前端          | 挂件发起请求                                     | 浏览器跨域直连客服后端；Uter 侧 `/api/cs/*` 应 404（不反代） | P0 |
| BE-CS-004 | 超管          | 设置 CustomerServicePages = `none`          | 全站不渲染挂件（哨兵 `CustomerServicePagesAllOff`）  | P1 |
| BE-CS-005 | 超管          | 设置为页面列表                                    | 仅指定页渲染                                   | P1 |
| BE-CS-006 | 超管          | 设置留空                                       | 全开                                       | P2 |
| BE-CS-007 | 客服后端        | 切换语言后问答                                    | 语种透传 `public-chat.lang`，命中对应语种知识库        | P2 |

---

## 5. 非功能测试（NF-\*）

### 5.1 性能与并发

| ID        | 前置       | 步骤                              | 预期                                     | P  |
| --------- | -------- | ------------------------------- | -------------------------------------- | -- |
| NF-PERF-001 | 预发环境    | 单渠道稳态压测 `/v1/chat/completions`   | 建立吞吐与 P95 基线并记录；不得出现内存持续增长            | P1 |
| NF-PERF-002 | 预发环境    | 并发 200 请求                        | 无死锁、无连接耗尽；失败率在可接受范围                    | P0 |
| NF-PERF-003 | 大量日志    | 打开日志页并翻页                         | 首屏 < 3s；分页查询不退化                        | P1 |
| NF-PERF-004 | 开启批量落库  | `BATCH_UPDATE_ENABLED=true` 高频请求 | 落库后不变量仍成立（见 BE-BIL-020）                | P0 |
| NF-PERF-005 | 长时间运行   | 观察 24h                           | 无 goroutine / fd 泄漏                    | P1 |

### 5.2 兼容性与多数据库

| ID          | 前置    | 步骤                    | 预期                  | P  |
| ----------- | ----- | --------------------- | ------------------- | -- |
| NF-COMP-001 | SQLite | 跑核心用例矩阵               | 全通过（见 BE-INF-001）   | P0 |
| NF-COMP-002 | MySQL | 同上                    | 全通过                | P0 |
| NF-COMP-003 | PostgreSQL | 同上                | 全通过                | P0 |
| NF-COMP-004 | Redis 开启 | 完整用例               | 与内存缓存行为一致；组织字段缓存持久化 | P1 |
| NF-COMP-005 | 浏览器    | Chrome/Firefox/Safari 最新版 | 关键页面渲染与交互一致    | P1 |
| NF-COMP-006 | 多节点    | `NODE_TYPE=slave` 起从节点 | 同步正常（见 BE-INF-008） | P1 |

### 5.3 安全

| ID         | 前置   | 步骤                       | 预期                              | P  |
| ---------- | ---- | ------------------------ | ------------------------------- | -- |
| NF-SEC-001 | 任意   | 静态扫描硬编码凭据                | 0 处                             | P0 |
| NF-SEC-002 | 仓库   | 检查 `.env` / `.db` / `.pem` 入库 | 0 个                        | P0 |
| NF-SEC-003 | 代码   | SQL 拼接注入、命令注入扫描           | 0 处                             | P0 |
| NF-SEC-004 | 登录   | 错误密码 vs 不存在用户             | 错误文案完全一致（防用户枚举）                | P0 |
| NF-SEC-005 | 任意响应 | 抓包检查                     | 无密码哈希、完整令牌、渠道密钥、上游 URL query 凭据 | P0 |
| NF-SEC-006 | 生产配置 | 检查 Session Cookie          | `SESSION_COOKIE_SECURE=true` + `TRUSTED_URL` | P0 |
| NF-SEC-007 | 依赖   | `govulncheck` / `npm audit` | 无高危                         | P1 |
| NF-SEC-008 | CSRF | Origin 缺失/畸形请求            | fail-closed 拒绝（见 §8.4 勿回退项）     | P0 |

### 5.4 数据一致性

| ID         | 前置    | 步骤                       | 预期                              | P  |
| ---------- | ----- | ------------------------ | ------------------------------- | -- |
| NF-DATA-001 | 任意请求 | 比对 `初始余额 − 最终余额` 与 `logs.Quota` | 恒等                        | P0 |
| NF-DATA-002 | 组织   | 比对个人账本与组织账本              | 两处数值一致                          | P0 |
| NF-DATA-003 | 组织超支 | 检查组织账本                    | 如实记账不截断；剩余额度钳 0                | P0 |
| NF-DATA-004 | 看板   | 对比 `quota_data` 与 `logs` 聚合 | 口径一致，无 NaN 或负值               | P1 |
| NF-DATA-005 | 迁移   | 从上一版本升级                   | 自动迁移成功，数据不丢                    | P0 |

---

## 6. 上线冒烟清单（SMOKE-\*，生产仅执行本章）

| ID          | 步骤                                  | 预期                        | P  |
| ----------- | ----------------------------------- | ------------------------- | -- |
| SMOKE-001   | GET /api/status                      | 200 + `success: true`     | P0 |
| SMOKE-002   | 打开 /                                | SPA 首页渲染，版本号正确            | P0 |
| SMOKE-003   | 打开 /docs-content/docs/zh/index.html | 真实文档 HTML（非 SPA 壳）        | P0 |
| SMOKE-004   | 打开 /about                           | 200                       | P0 |
| SMOKE-005   | 管理员登录 → 打开渠道页                       | 列表可读                      | P0 |
| SMOKE-006   | 渠道测试                                | 至少 1 条渠道可用                | P0 |
| SMOKE-007   | 用有效令牌 POST /v1/chat/completions    | 200，usage 正确              | P0 |
| SMOKE-008   | 查日志与余额                              | 扣费额 == 日志 Quota           | P0 |
| SMOKE-009   | GET /api/audit                       | 有审计记录                     | P0 |
| SMOKE-010   | 检查响应安全头与 Cookie                     | HttpOnly/Secure 生效        | P0 |

---

## 7. 自动化回归映射

### 7.1 用例 → 自动化资产

| 用例范围                       | 自动化资产                                                        |
| -------------------------- | ------------------------------------------------------------ |
| BE-SET / SES / PWD / EML / 2FA / PK / SV / OAU | `controller/`（含 `security_account_test.go`、`access_token_audit_test.go`）、`service/passkey/` |
| BE-ATK                     | `controller/access_token_audit_test.go`、`router/access_token_scope_test.go`、`middleware/access_token_routes.go` |
| BE-RLY / RLY2 / RLY3 / MAP / SEL | `relay/`、`relay/channel/*`、`relay/relay_adaptor.go` 表驱动测试 |
| BE-BIL / PRC               | `pkg/billingexpr/`、`setting/billing_setting/`、`e2e/`        |
| BE-ORG                     | `e2e/org_billing_e2e_test.go`（含 overshoot 两例）、`e2e/org_permissions_e2e_test.go`、`e2e/org_platform_harness_test.go`、`e2e/org_self_profile_test.go` |
| BE-TOK / USR / RBAC        | `controller/`、`service/authz/`、`model/`                      |
| BE-CHN                     | `router/channel_router_test.go`（权限矩阵）、`controller/`         |
| BE-CST                     | `relay/costopt/`、`router/costopt_metrics_auth_test.go`       |
| BE-RQP / BE-AFF            | `controller/channel_pin_retry_test.go`、`service/request_policy*` |
| FE-\*（组件级）                  | `web/src/**/__tests__/*.test.tsx`（226 文件，V1.4.0 核）           |
| FE-I18N（语言切换）             | `web/src/i18n/__tests__/language-switch.test.tsx`、`web/src/lib/auth-saved-language.test.ts` |

### 7.2 后端运行姿势

```bash
# 全量（DB 型用例先停本机服务）
GOWORK=off go test -p 1 -count=1 ./...

# 竞争检测（CI race job 同口径，V1.4.0 新增；覆盖 4 处已修复的竞争）
GOWORK=off go test -race -count=1 ./service/... ./relay/... ./middleware/...

# ⚠️ relaykit 是独立模块，必须在子目录内跑；在主模块写 ./relaykit/... 会 [setup failed]
cd relaykit && GOWORK=off go test -count=1 ./...
```

> **V1.5.0 实测基线**：`./model/ ./common/... ./middleware/... ./service/... ./relay/... ./router/...` 全绿；
> `relaykit` 子模块 `./...` 全绿。若在主模块看到 `FAIL ./relaykit/... [setup failed]`，
> 那是模块边界问题（GAP-18），**不是**回归失败。

- ⚠️ `go test ./...` 会包含 `main` 包，其 `//go:embed all:web/dist` 要求
  **`web/dist/index.html` 存在**；干净工作区未构建前端时会 `[setup failed]`（见 §8.5 GAP-07）。
  CI 的缓解是「Create frontend embed placeholder」步骤（造一个占位 index.html）。
- **V1.4.0 已修复的 4 处数据竞争**（`d4c540ebc`，`-race` 实证）：
  ① `logger/logger.go` 的 `logCount`/`setupLogWorking` 改 `atomic` + CAS，保证只有一个
  goroutine 触发 `SetupLogger()`；② `gin.SetMode` 是无锁包级变量，并行测试并发调用即竞争——
  `relay/channel/{,gemini/,minimax/,aws/}` 各新增 `testmain_test.go` 用 `TestMain` 统一设置；
  ③ `service/task_polling_test.go` 先快照 `GetUpstreamTaskID()` 再起 goroutine；
  ④ 组织预算预扣路径（见 BE-ORG-025 的已量化 TOCTOU，属设计约束非竞争）。
- 已知 flaky：`controller/security_account_test.go#TestSecurityAccountDeletionConcurrentRequestsHaveOneWinner`
  （SQLite 并发删除约 20% 失败）。判 flaky 必须 `-count=N -v`；
  基线对照用 `git worktree add /tmp/x HEAD`（拷入文件要 sed 回旧 module 名）。
- `./model/`、`./controller/` 建议串行；e2e 需服务端，不进常规回归。
- CI 另有 `coverage` job（xargs 分包 + `go tool cover`，产物留存 14 天）与
  `vulnscan` job（`govulncheck`）；`govulncheck` / `npm audit` 无高危对应 BE-SEC-012。

### 7.3 前端运行姿势（重要，勿回退）

1. **必须先去掉 `NODE_OPTIONS`**。沙箱会注入
   `NODE_OPTIONS=--require=.../node-language-shim.cjs`，它把 fs 操作代理到 broker IPC；
   vitest 重负载下 broker 超时，症状是**跑满超时后 "Tests no tests"**或**大批 jsdom 用例假红**。
   正确姿势：`cd web && env -u NODE_OPTIONS npx vitest run`。
2. **同一时刻只跑一个 vitest**，并发会互相打爆 worker。
3. `--testNamePattern="..."` 必须放在被测文件参数**之前**才生效；`-t` 会被当成文件路径。
4. **判红必须逐文件单跑核实**；全量并发会让部分 jsdom 用例假红（`findBy*` 5s 超时等）。
5. `--pool=vmThreads` 对 jsdom 报 `TransformStream is not defined`，用默认 forks 池。
6. ⚠️ 不要跑 `npm run format:check`（会剥 AGPL 头）。
7. ⚠️ **必须在 `web/` 目录下执行**（`cd web && env -u NODE_OPTIONS npx vitest run <file>`）。
   在仓库根直接跑会因缺 `@` 别名报 `Cannot find package '@/...'`，表现为
   「Test Files 1 failed / Tests no tests」——与用例本身无关，别误判为功能坏。

---

## 8. 缺陷与已知缺口登记

### 8.1 本次执行发现的缺陷

V1.2.x 的 DEF-1～DEF-3 见配套《Uter测试报告》第 3 章。V1.5.0（基线 `eedf3e2ce`）新增：

| 编号    | 等级 | 标题                          | 现象（实测）                                                                 | 位置                                       | 关联用例                     | 状态（V1.5.1 修复）                                                                 |
| ----- | -- | --------------------------- | ---------------------------------------------------------------------- | ---------------------------------------- | ------------------------ | ---------------------------------------------------------------------------- |
| DEF-4 | P0 | 密码强度校验整体失效                  | 仅校验长度 8–128；`password`、`abcdefgh` 均可注册成功；`ValidatePasswordStrength` **无任何调用点** | `controller/user.go`、`common/`（策略函数未被接回） | BE-PWD-002~008、SET-006  | ✅ 已修复：`ValidateNewAccountPasswordStrength` 接入注册/建号/改号/自助改密/初始化全部入口，模型层 `prepareForInsert`/`UpdateWithTx`/`EditWithTx`/`ChangeUserPassword` 兜底；强度检查排在二次验证之后（未授权不得探测策略）；重置密码生成器改 `GenerateAccountPassword`；上限与前端统一为 128；新增 `common/password_policy_enforcement_test.go`、`controller/register_password_policy_test.go` |
| DEF-5 | P0 | 令牌明文接口缺二次验证                 | 普通用户 `POST /api/token/:id/key` 直接 200 返回明文；`batch/keys` 同样返回全部明文 | `router/api-router.go:362-367`（缺 `SecureVerificationRequired`） | BE-TOK-020/021/022       | ✅ 已修复：新增 `VerificationScopeTokenKeyRead`（空 context、PAT 不可用），两条路由挂 `TokenKeySecureVerificationRequired`；`middleware/secure_verification_test.go`、`service/security_verification_token_key_test.go` 锁定 |
| DEF-6 | P0 | 计费不变量可被击穿（透支远超预扣）           | 余额 100、单笔实扣 10000 → 余额 -9900，而 `PreConsumedQuota` 仅 500；信任旁路下无硬闸门 | `service/billing_session.go`（`shouldTrust`）、`service/quota.go` | BE-BIL-006、BE-BIL-031   | ✅ 已修复：准入余额（减债务下限）延续为会话级 `billingCeiling`，`Settle` 对钱包会话硬截断，用量日志记截断后生效额（`SettleBillingForLog` + `SettledQuota`），「初始余额 − 最终余额 == logs.Quota」在截断后依然成立；`service/wallet_billing_ceiling_test.go` 覆盖信任旁路/普通/债务下限三场景 |
| DEF-7 | P1 | webhook secret 被静默清空         | 已存 secret 后再次保存设置且未回传 secret → `webhook_secret` 变空串，HMAC 签名静默失效 | `controller/user.go:1512-1519`            | BE-NOT-008               | ✅ 已修复：`WebhookSecret` 改指针，缺失即保留原值、显式空串才清空；`controller/user_setting_webhook_test.go` 锁定两种语义 |
| DEF-8 | P2 | webhook URL 未限定 http(s)      | `file:///etc/passwd` 保存成功（Bark/Gotify 有前缀校验，webhook 没有）              | `controller/user.go:1425-1435`            | BE-NOT-006、BE-SEC-016    | ✅ 已修复：webhook 增加 http(s) 前缀校验（大小写不敏感），与 Bark/Gotify 同口径；无 scheme 值被 `ParseRequestURI` 先行拒绝 |

> **待裁决项裁定（V1.5.1）**
> - **PRIO-006/007（已修复）**：`ReorderChannelPriority` 现对三种失败各回稳定 `code`（`CHANNEL_PRIORITY_CONFLICT` / `CHANNEL_PRIORITY_INVALID` / `CHANNEL_PRIORITY_RANGE`），文案照旧下发；前端可按语义分支而无需字符串匹配。HTTP 状态保持 200（控制台约定 success:false + message/code）。见 `controller/channel_priority_error_code_test.go`。
> - **BE-CHN-003（裁定：不构成缺陷，维持空串）**：渠道详情 `key` 返回空串是**有意设计**——前端表单显式声明「Never populate key from backend for security」（`web/src/features/channels/lib/channel-form.ts`），密钥经按需 2FA 揭示端点（`POST /api/channel/:id/key`）获取；若改为掩码下发，还需在渠道更新侧补「掩码串不等于新密钥」的防覆盖逻辑，否则客户端回传掩码会污染已存密钥。当前形态无明文泄露且与前端约定一致，用例预期改为「空串即脱敏形态」。
> - **`GET /api/setup` 的 `database_type`（已修复）**：`constant.Setup == true` 的语义是「初始化已完成」，该分支此前提前返回导致库型为零值。现统一填充 `status` / `root_init` / `database_type` 三个字段，两个状态下都不再出现空值。见 `controller/setup_status_test.go`。

### 8.2 判定口径

- **缺陷**：实际行为与用例预期不符，且预期有产品依据。
- **待裁决**：实现与断言不一致，但正确口径需产品确认（不得由测试单方改断言收敛）。
- **已知缺口**：记录在案、当前版本明确不实现或不完整的行为。

### 8.3 勿回退项（历史上修过、易被改回去的硬约束）

| 项                                   | 位置                                     |
| ----------------------------------- | -------------------------------------- |
| CSRF 畸形 Origin 必须 fail-closed       | `middleware/auth_origin.go`             |
| 成员子额度结算点不得截断（只钳下限）                  | `service/funding_source.go`、`model/organization.go` |
| 组织字段缓存须持久化                          | Redis 缓存路径                              |
| `/auth/refresh` 限流键用 `RefreshTokenSID(raw)` | `web-router.go`                   |
| `static.Serve` 必须在 `GlobalWebRateLimit()` 之前 | `web-router.go` NoRoute          |
| `DiskETag` 必须在 `static.Serve` 之前     | 热更新路径                                   |
| 前端 localStorage 用户私有数据按用户 id 分键     | `scopedKey()`                           |
| CHANGE（模型描述多语化）map 字段的 serializer 约定 | GORM 自定义字段类型                       |
| 🔴 降本**绝不替换客户选择的模型**，且不改写/裁剪客户传入内容 | `relay/costopt/`、`compatible_handler.go`（有损手段已整体下线，勿重新接回） |
| 缓存用量必须走独立列 `cache_read_tokens` / `cache_write_tokens`，不得退回只存 `other` JSON（SQL 无法跨库聚合） | `model/log.go`、三个统计接口 |
| 日志表「加列 + 回填」逻辑必须挂在 `InitLogDB` 两条分支的 LOG_DB 就绪之后；回填判据用 options 标记而非 `HasColumn` | `model/main.go`（挂 `migrateLOGDB()` 在默认 SQLite 部署下永不执行） |
| 新增敏感配置项须登记进 `common/secret_option_keys.go` | `secretOptionKeys` / `costOptSecretOptionKeys` |
| 用量日志汇总条缓存项**恒显示含 0**；单条明细 >0 才显示 | `common-logs-stats.tsx`、`common-logs-columns.tsx` |
| 🔴 渠道类型编号对齐 new-api：`Uter=NewAPI=60`/`TaskPlugin=61`/`vLLM=62`/`SGLang=63`，品牌渠道 `600/601/602`，`ChannelTypeDummy=602` | `constant/channel.go` + `web/src/features/channels/constants.ts`（编号落库，漂移即脏数据） |
| 敏感词过滤默认关闭（`CheckSensitiveEnabled`/`CheckSensitiveOnPromptEnabled` 默认 false、词表清空）；若产品要求默认开启须单独回退该文件并评估合规 | `service/sensitive.go`（`862cd120f`） |
| 分组限流在配置了分组限流时按分组独立计数，不与用户级混用 | `middleware/`（`189540cbd`，防分组配额被旁路） |
| 组织预算表单负数/非有限数显式拒绝，不静默折算（后端 0=不限额） | 组织创建/编辑表单 `parseSubQuotaAmount`（`742410cb2`） |
| 支付跳转统一走 `lib/payment-redirect.ts`：http(s) 校验、HTTPS 优先、Stripe/Creem 主机白名单、`noopener/noreferrer`、弹窗拦截检测 | Stripe/Creem/Waffo/WaffoPancake 四入口 + `submitPaymentForm`（`742410cb2`） |
| 聊天 iframe 同源嵌入收回 `allow-same-origin` + `referrerPolicy=no-referrer` | `resolveChatEmbedPolicy`（`742410cb2`） |
| OAuth 登录 `oauth_login_nonce` Cookie 常数时间比对；新建账号对未验证邮箱 fail-closed | `controller/oauth.go`（`e11551977`） |
| 密码重置页取到 email/token 后立即 `replaceState` 清查询串 | 重置密码路由（`742410cb2`） |
| 语言切换先 `await ensureLocale(next)` 再 `changeLanguage`，并用 `auth.setUser` 同步 `setting.language` | `language-switcher.tsx`、`language-preferences-card.tsx`（`b7a4e58a8`） |
| 令牌明文接口必须同时挂 `SecureVerificationRequired`（与 `POST /api/channel/:id/key` 对齐），仅靠 `CriticalRateLimit` 不构成二次验证 | `router/api-router.go`（DEF-5） |
| 渠道优先级以 revision 乐观锁 + preview 不落库 + restore 撤销三件套维护，`channels` 与 `abilities` 必须双写；不得退回「直接改 priority 数值」 | `model/channel_priority.go`（PRIO-*） |
| `/v1/tools/search` / `/v1/tools/fetch` 必须由服务端强制 `RoutingModel`，**不得信任请求体 `model`**（否则可按低价模型计价、按高价模型调用） | `middleware/distributor.go`（BE-DST-003） |
| 过载哨兵必须「连续 3 次采样」才熔断，且采样超过 30s 视为过期（fail-open）；判定时按**当前阈值**复核，不得用采样时的旧阈值 | `common/system_monitor.go`（BE-SEC-020~023） |
| `fetch_setting` 只能按点号键 `fetch_setting.<json_tag>` 热更新；`LoadFromDB` 无生产调用点，整块 JSON 写入不会生效 | `setting/config/config.go`（BE-SEC-014、GAP-19） |
| SSRF 只挂「用户可控 URL」抓取路径（webhook/视频代理/MJ/jsplugin/OAuth/下载）；渠道 BaseURL 属运维托管，**刻意不挂**，勿「顺手补上」导致自建/私网上游不可用 | `service/http_client.go:146-152`（BE-SEC-018） |
| 缓存用量必须写 `cache_read_tokens` / `cache_creation_tokens` 独立列，`quota_data` 冲突键 upsert 时**五个数值列全累加**；cache_creation 只记归一化总额，不得叠加 5m/1h 明细 | `model/usedata.go`、`model/log.go`（BE-BIL-025~029） |
| 保存用户通知设置时从**已存设置**出发，只清空「非所选通知方式」的配置；webhook secret 不应因未回传而被清空 | `controller/user.go:1492-1533`（DEF-7） |

### 8.4 优先级与上线门禁

- P0 用例 100% Pass 才允许上线；任何 P0 Fail / Block 需书面豁免。
- **整包回归不可得**（如测试死锁导致包级超时）等同 P0 缺陷处理——无法证明通过即视为不通过。
- **V1.5.0 门禁结论**：存在 3 个 P0 FAIL（DEF-4 密码策略、DEF-5 令牌明文无二次验证、DEF-6 计费不变量可击穿），
  按本节口径**当前版本不具备无条件上线资格**，需修复或书面豁免后方可发布。

### 8.5 已知缺口（GAP）

| 编号     | 缺口                                                                    | 位置                                    | 状态（2026-10-17 复核）             | P  |
| ------ | --------------------------------------------------------------------- | ------------------------------------- | ----------------------------- | -- |
| GAP-01 | `GetImage` 为空函数体，返回 200 空响应，应为明确的未实现语义                                | `controller/image.go:7`               | **仍存在**                       | P1 |
| GAP-02 | 敏感词检查跳过 `image_url`（标注 TODO），多模态图片内容不被检查                              | `service/sensitive.go:20`             | **仍存在**；且敏感词过滤整体默认已关（见 BE-SEC-004），开启后仍跳过图片   | P0 |
| GAP-03 | ChannelType 21（AIProxyLibrary）的 `GetAdaptor` 返回 nil                   | `relay/relay_adaptor.go`              | ✅ **已修复**（现复用 `openai.Adaptor`） | —  |
| GAP-04 | type 601（BrandedAggregate）「聚合」语义无任何实现                                  | `constant/channel.go`                 | **仍存在**（与 58 行为无差异；编号 63→601 随迁移更新）            | P1 |
| GAP-05 | ~~语义缓存为内存 O(n) 线性扫描，未接真实向量库~~                                            | ~~`relay/costopt/`~~                  | ⛔ **随功能下线关闭**（2026-10-10 语义缓存整体移除，缺口不再成立） | —  |
| GAP-06 | CDN 重写逻辑就绪但静态资源服务点未挂调用入口                                              | `relay/costopt/cdn.go`                | **仍存在**（`CDNAssetURL` 无包外调用方）       | P2 |
| GAP-07 | `web/dist/index.html` 缺失时 `go build` / `go test ./...`（main 包）必然 `[setup failed]` | `main.go:51` `//go:embed`     | **仍存在**；CI 已用 placeholder 步骤缓解，本地仍需先建前端产物         | P1 |
| GAP-08 | 本地 dev 基础数据不满足 §1.4 清单（仅 1 渠道/1 组织/4 令牌），依赖真实上游的用例只能判 Block | 本地环境                                  | **仍存在**（§1.4 清单已按新渠道编号扩充）                      | P1 |
| GAP-09 | ~~前端审计渲染函数签名漂移：`buildAuditDetails`/`useCommonLogsColumns` 需扩展参数~~ | ~~`audit-log-details-dialog.tsx`~~ | ✅ **已修复**（`4edfd912f`：接入 `scopeResources` 三参与 `showBillingSource`） | — |
| GAP-10 | ~~渠道亲和「会话规则」页 prop 契约冲突~~ | ~~`routing-section.tsx`~~ | ✅ **已修复**（`4edfd912f`：`ChannelAffinitySection` 支持表单驱动入参，防崩溃回退保留） | — |
| GAP-11 | ~~`UpstreamUpdateDialog` props 与上游 store 形态不匹配~~ | ~~`channels-dialogs.tsx`~~ | ✅ **已修复**（`4edfd912f`：扁平 props） | — |
| GAP-12 | ~~`ChannelConfiguration` 缺少必填 `quickOptions` 传递~~ | ~~`channel-mutate-drawer.tsx`~~ | ✅ **已修复**（`4edfd912f`：接入 quickOptions 槽 + 透传确认流） | — |
| GAP-13 | ~~`section-registry` 的 `defaultValues`/`trust_quota_usd` 形态与配置组不匹配~~ | ~~`section-registry.tsx`~~ | ✅ **已修复**（`4edfd912f`：quotaSchema 补 `trust_quota_usd`/`pre_consume_multiplier`） | — |
| GAP-14 | ~~上游测试引用 uter 不存在的常量/类型~~ | ~~7 个测试文件~~ | ✅ **已关闭**（`3b896af44`/`4edfd912f` 本地化；5 文件逐单跑全绿，`group-settings.test.tsx` 9/9 转绿） | — |
| GAP-15 | 品牌渠道 600/601/602 在 `ChannelType2APIType` 无显式 case，回落 `(APITypeOpenAI, false)` → 中继走 OpenAI adaptor 而非 AdvancedCustom adaptor，`advanced_routes` 不参与匹配；与 `IsAdvancedCustomChannelType`「必须处处等同处理」注释及前端「后端行为与 Advanced Custom 完全一致」宣称相悖。预存问题（旧编号 62/63/64 时同样如此），零测试覆盖 | `common/api_type.go`、`relay/common/relay_info.go:327` | **新增登记**（`b1655a5d2` 复核发现；验证用例 BE-MAP-006，修不修需产品/技术确认）        | P1 |
| GAP-16 | 组织预算并发超支放大（TOCTOU）：预扣为 0 时唯一闸门是只读 `EnforceOrgQuota`，并发突发放行笔数可达并发度量级（实测预算 40000/并发 20 → 账本 570000，≈17.7 倍）。顺序执行时超支被单次调用成本界定；并发上界已被 e2e 固化为「并发度 × 单笔实耗」 | `service/funding_source.go`、`service/billing_session.go` | **新增登记**（已量化 + 不变量已固化，是否加硬闸门需产品决策；BE-ORG-016/025）        | P1 |
| GAP-17 | ~~SSRF 未覆盖渠道 BaseURL~~ | `service/http_client.go:146-152` | ✅ **经复核为设计如此，非缺口**：`GetHttpClient` 注释明确「provider base URL 是运维托管目标，可合法指向私网/私有链路」；且渠道组整体 `AdminAuth()`、建渠道需 `ChannelSensitiveWrite`，普通用户无法自建（BE-SEC-017/018）。**真正的 SSRF 面（webhook / 视频代理 / MJ 图片 / jsplugin / OAuth / 下载）均已接入** | — |
| GAP-18 | `relaykit` 是独立 Go 模块（自带 `go.mod`），在主模块执行 `go test ./relaykit/...` 必报 `[setup failed]`，易被误判为「测试挂了」 | `relaykit/go.mod` | **新增登记**（§7.2 已补正确姿势：`cd relaykit && go test ./...`）；非代码缺陷 | P2 |
| GAP-19 | `fetch_setting` 整块 JSON 写入 `/api/option/` 不生效：`config.LoadFromDB` 在生产代码中**无调用点**，只有点号键 `fetch_setting.<tag>` 才走 `handleConfigUpdate` 热更新。若前端某处按整块 JSON 保存，配置会「看似成功但从不生效」 | `setting/config/config.go`、`model/option.go:718` | **新增登记**（BE-SEC-014 已固化正确下发姿势；需确认前端保存路径是否全部用点号键） | P1 |

---

## 9. V1.3.0 新增功能用例（new-api rc.38–rc.44 对齐）

> 本章为 V1.3.0 增量的正文。前置/数据准备沿用 §1.3～§1.4；通用断言见 §0.4，不再逐条重复。
> 「范围化权限」相关用例依赖 §1.3 的 U-USER 已持有有效浏览器会话。

### 9.1 访问令牌 Access Tokens（BE-ATK）

> 代码位：`model/user_access_token.go`、`controller/access_token.go`、`service/access_token_scope.go`、
> `middleware/access_token_routes.go`、`middleware/auth.go`。这是**面板 PAT**，与 §2.14 的 API Key（中继令牌）
> 是两套凭证：PAT 用于调用面板管理接口，API Key 用于调用中继 `/v1`。

| ID         | 前置                        | 步骤                                                           | 预期                                                             | P  |
| ---------- | ------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- | -- |
| BE-ATK-001 | U-USER 已登录                | GET /api/user/access_tokens                                   | 200，`success:true`，返回列表；**不得**返回 token 明文或 hash              | P0 |
| BE-ATK-002 | 已登录                      | POST /api/user/access_tokens（`{name,scopes:["profile:read"],expires_at:0}`） | 创建成功，返回体**仅此次**含明文 token；落库为 hash，`token_hash` 唯一        | P0 |
| BE-ATK-003 | 已登录                      | 不带二次验证证明直接 POST /api/user/access_tokens                        | 403 `SECURITY_PROOF_REQUIRED`（敏感操作仅限交互式会话+有效证明）              | P0 |
| BE-ATK-004 | 已登录                      | 用已创建 PAT 调用 GET /api/user/access_tokens                              | 403 `AUTH_SESSION_REQUIRED`——管理路由为 session-only，PAT 不能管 PAT        | P0 |
| BE-ATK-005 | 已登录                      | POST 时 `scopes` 传未知值 / 重复值 / 空数组                                    | 拒绝，提示可读；去重后落库；空 scope 拒绝                          | P1 |
| BE-ATK-006 | 已有 N=上限 个令牌              | 再 POST 一个                                                       | 拒绝 `ACCESS_TOKEN_LIMIT`，文案含上限数量，不创建                        | P0 |
| BE-ATK-007 | 已登录                      | POST 时 `expires_at` 设为小于 `accessTokenMinLifetimeSecs` 的距今时间          | 拒绝（最短有效期），提示可读                                       | P1 |
| BE-ATK-008 | 已创建令牌 A                  | PATCH /api/user/access_tokens/:id 改 name/scopes（带证明）                | 成功；审计落 `access_token.rename` 与 `access_token.update` 两条        | P1 |
| BE-ATK-009 | 用户 A 有令牌，用户 B 已登录       | B 用 A 的 token id 调 PATCH/DELETE                                    | 404 `ACCESS_TOKEN_NOT_FOUND`（不暴露他人资源存在性）                   | P0 |
| BE-ATK-010 | 已创建令牌                    | DELETE /api/user/access_tokens/:id（带证明）                            | 成功；该 token 立即失效，再用于调用受保护接口 401 `AUTH_UNAUTHORIZED`        | P0 |
| BE-ATK-011 | 旧版用户有 `users.access_token` | 用该旧明文调用任何接口                                                    | 401 `ACCESS_TOKEN_LEGACY_RETIRED`，引导去安全设置新建                    | P1 |
| BE-ATK-012 | 旧版用户有 `users.access_token` | DELETE /api/user/access_tokens/legacy（带证明）                      | 成功清空 `users.access_token` 列；审计 `access_token.revoke` 带 `legacy:true` | P1 |
| BE-ATK-013 | 已登录                      | GET /api/user/access_tokens/scopes、/catalog                        | 返回全部合法 scope 与可创建项；前端下拉据此渲染                           | P2 |
| BE-ATK-014 | 已创建带 `option:read` 的 PAT  | 用该 PAT 调 GET /api/option/request_policy                         | 200（scope 命中放行）；换仅 `profile:read` 的 PAT 调同一接口                | P1 |

### 9.2 请求策略 Request Policies（BE-RQP）

> 代码位：`model/request_policy.go`、`controller/request_policy.go`、`service/request_policy.go`。
> 路由：`GET/PATCH /api/option/request_policy`。

| ID         | 前置                    | 步骤                                             | 预期                                                | P  |
| ---------- | --------------------- | ---------------------------------------------- | ------------------------------------------------- | -- |
| BE-RQP-001 | 已登录                  | GET /api/option/request_policy                 | 200，返回校验后的快照（重试次数、渠道亲和设置等）；不得含密钥              | P0 |
| BE-RQP-002 | 管理员已登录               | PATCH 合法项（如 `RetryTimes=2`）                  | 成功，落库，再次 GET 反映新值                             | P1 |
| BE-RQP-003 | 管理员已登录               | PATCH `channel_affinity_setting.session_mode=strict` | 成功，亲和规则字段不被全局模式改写                            | P1 |
| BE-RQP-004 | 管理员已登录               | PATCH `request_policy_setting.mode=off`（已下线的开关） | 拒绝：该键不是合法 policy 选项，不落库                        | P0 |
| BE-RQP-005 | 管理员已登录               | PATCH `channel_affinity_setting.rules` 传非法 JSON `[`  | 拒绝，整批不落库（原子性）                               | P1 |
| BE-RQP-006 | 管理员已登录               | PATCH 未知键 / 负的亲和 TTL / 非法缓存上限                 | 逐项拒绝并给出可读原因；合法项与非法项混提时**整批拒绝**               | P0 |
| BE-RQP-007 | 已登录                  | 重载后读取 CurrentRequestPolicy()                    | 旧版规则 JSON 的扩展字段在重载后不丢失                          | P2 |
| BE-RQP-008 | 普通用户已登录             | PATCH /api/option/request_policy                 | 403（需 option:write）；未登录 401                       | P0 |

### 9.3 渠道亲和 Channel Affinity（BE-AFF）

> 代码位：`setting/operation_setting`（`GetChannelAffinitySetting`）、`controller/channel_pin_retry_test.go` 锁定语义、
> 路由 `GET/DELETE /api/option/channel_affinity_cache`、`GET /api/log/channel_affinity_usage_cache`。

| ID         | 前置                          | 步骤                                          | 预期                                             | P  |
| ---------- | --------------------------- | ------------------------------------------- | ---------------------------------------------- | -- |
| BE-AFF-001 | 亲和开启，规则按 `X-Session` 请求头   | 同会话连续请求                                    | 命中同一渠道（pin）；换会话值则重新选路                 | P0 |
| BE-AFF-002 | 规则 `session_mode=strict`   | 该会话首选渠道被禁用                                | 按 `keep_on_channel_disabled` 语义：保留则仍路由、否则重选 | P1 |
| BE-AFF-003 | 管理员已登录                    | GET /api/option/channel_affinity_cache        | 返回缓存统计（条目数/TTL 等）                        | P1 |
| BE-AFF-004 | 管理员已登录                    | DELETE /api/option/channel_affinity_cache     | 清空成功；审计 `option.clear_affinity_cache`      | P1 |
| BE-AFF-005 | 某渠道被删除                    | 触发该渠道的价格重试/轮询                             | 已删渠道的轮询锁被回收，不悬挂、不 panic                 | P0 |
| BE-AFF-006 | 组织管理员已登录                 | GET /api/log/channel_affinity_usage_cache     | 仅见本组织亲和用量（越权组织 403）                    | P1 |
| BE-AFF-007 | 规则正则 `.*`                 | 请求命中规则但缺请求头来源                            | 不 pin，回落默认选择，不报错                         | P2 |
| BE-AFF-008 | 并发多会话                     | 压测下亲和缓存                                     | 无数据竞争（`-race` 通过），缓存不超限                 | P1 |

### 9.4 日志导出（BE-LOG 续号）

> 代码位：`service/log_export.go`、`controller/log.go`、路由 `GET /api/log/export`、`log_export_enabled`/`UserExportEnabled`。

| ID         | 前置                 | 步骤                              | 预期                                          | P  |
| ---------- | ------------------ | ------------------------------- | ------------------------------------------- | -- |
| BE-LOG-021 | `log_export_enabled` 关 | GET /api/log/export             | 拒绝或空，提示导出未开启                            | P1 |
| BE-LOG-022 | 导出已在进行中          | 并发再发一次 GET /api/log/export        | 第二次被拒：`Another log export is running. Try again after it finishes.` | P1 |
| BE-LOG-023 | 组织管理员 U-ORG-ADMIN | 导出                                 | 仅含本组织日志；换他组织 id 探测 403               | P0 |
| BE-LOG-024 | 普通用户已登录         | 导出自己的用量日志                       | 文件内容**不含**任何渠道密钥 / 令牌明文 / 上游 URL query 凭据 | P0 |

### 9.5 托管联网搜索 Web Search（BE-WSR）

> 代码位：`relay/channel/{ali,openai,xai,zhipu_4v}/web_search.go`、`relay/alpha_search_handler.go`、
> `relaykit/relayconvert/convmeta/websearch.go`。依赖真实上游，本地多判 Block。

| ID         | 前置                        | 步骤                                    | 预期                                             | P  |
| ---------- | ------------------------- | ------------------------------------- | ---------------------------------------------- | -- |
| BE-WSR-001 | DashScope 渠道              | 请求带 `tools:[{type:"web_search_20250305"}]` | 映射为 `enable_search=true` + `search_options`；system 注入搜索标记 | P1 |
| BE-WSR-002 | DashScope 渠道              | 工具带 `blocked_domains`                | 该能力不被支持，**语义损失诊断**上报 `unsupported_domain_filter`，不静默丢弃 | P0 |
| BE-WSR-003 | DashScope 渠道              | 工具带 `max_uses` / `user_location`     | 分别上报 `unsupported_search_limit` / `unsupported_search_tuning` | P1 |
| BE-WSR-004 | XAI / 智谱 4V 渠道          | 带 web_search 工具                      | 按各自协议映射；不支持项有诊断                      | P1 |
| BE-WSR-005 | DashScope Responses 渠道   | 上游返回 `usage.x_tools.web_search.count` | 按该 count 计价（而非按 `web_search_call` 条目重复计）  | P0 |
| BE-WSR-006 | Codex 独立搜索路由           | 命中 alpha search 路由                   | 无 usage 时按 1 次 `web_search_preview` 计        | P2 |
| BE-WSR-007 | 任意渠道                    | 普通问答不带搜索工具                        | 不注入搜索参数，行为与对齐前一致                     | P1 |
| BE-WSR-008 | 转换层单测                  | `convmeta/websearch` 各 case            | 语义损失/PresentationLoss 分类与文案稳定            | P2 |

### 9.6 Responses over WebSocket（BE-RLY 续号）

> 代码位：`relay/responses_websocket.go`、`controller/responses_websocket.go`、前端 `responses-websocket-setting.tsx`。

| ID         | 前置                 | 步骤                          | 预期                                  | P  |
| ---------- | ------------------ | --------------------------- | ----------------------------------- | -- |
| BE-RLY-030 | 渠道开启 Responses WS | 建立 WS 并发送 Responses 请求    | 握手工序正确，帧格式符合协议                 | P1 |
| BE-RLY-031 | 上述请求成功结算        | 检查日志 request_policy 决策事件   | 结算把该请求标记为成功，决策事件可解释          | P1 |
| BE-RLY-032 | 请求进行中            | 客户端断连                     | 不重复扣费，资源释放，无 goroutine 泄漏      | P0 |

### 9.7 AdvancedCustom 预设 / Rerank / 推理状态（BE-CHN 续号）

> 代码位：`common/advanced_custom_presets.go`、`relay/channel/advancedcustom/{presets,rerank}.go`、
> `controller/channel_inference.go`、前端 `inference-status-dialog.tsx`/`model-redirect-panel.tsx`/`model-mapping-batch-dialog.tsx`。

| ID         | 前置                        | 步骤                          | 预期                                        | P  |
| ---------- | ------------------------- | --------------------------- | ----------------------------------------- | -- |
| BE-CHN-034 | SGLang 渠道（type 63），BaseURL 带前缀    | 用预设发起请求                  | 请求 URL = BaseURL 前缀 + path，不重复/不缺段（SGLang 编号 63 为上游对齐后编号，品牌渠道在 600/601/602）        | P1 |
| BE-CHN-035 | rerank 模型已上架            | 调用 rerank 接口               | 走 advancedcustom rerank 通道，返回排序结果        | P1 |
| BE-CHN-036 | 管理员已登录                 | 查看渠道推理状态                 | 状态准确；失败渠道按 `request_policy.automatic_disable` 自动禁用并记 source | P1 |
| BE-CHN-037 | 管理员已登录                 | 配置模型重定向 / 批量映射 / 头部透传   | 保存生效；透传头不含敏感头；映射规则校验              | P2 |

### 9.8 性能指标与结果归因（BE-PERF）

> 代码位：`pkg/perf_metrics/outcome.go`。

| ID         | 前置              | 步骤                    | 预期                              | P  |
| ---------- | --------------- | --------------------- | ------------------------------- | -- |
| BE-PERF-001 | 一次成功中继        | 触发 outcome 记录        | 归类为成功，指标计数 +1                | P2 |
| BE-PERF-002 | 一次失败中继        | 触发 outcome 记录        | 按失败原因归类，不误计入成功             | P2 |
| BE-PERF-003 | 并发中继          | 并发写 outcome          | 计数准确（`-race` 通过），无丢失        | P2 |
| BE-PERF-004 | —               | 单测覆盖 outcome 各分支    | 分支全覆盖，文案稳定                  | P2 |

### 9.9 运维维护（BE-OPS 续号）

> 代码位：前端 `features/system-settings/maintenance/{history-log-cleanup,server-log-files}.tsx`、
> `features/system-info/system-tasks-table.tsx`、`model/usedata_migration.go`。

| ID         | 前置           | 步骤                    | 预期                          | P  |
| ---------- | ------------ | --------------------- | --------------------------- | -- |
| BE-OPS-014 | 超管已登录      | 配置历史日志清理策略          | 保存生效；清理不误删保留期内数据          | P1 |
| BE-OPS-015 | 超管已登录      | 查看服务端日志文件列表/内容      | 可读；**不**返回敏感行（密钥/令牌）      | P1 |
| BE-OPS-016 | 升级场景        | 触发 usedata 迁移         | 迁移幂等；重复执行不重复回填/不报错       | P1 |

### 9.10 加固修复回归（BE-FIX）

> 回归 V1.3.0 对齐后的一串定向修复；每条均有对应单测，本地可执行。

| ID         | 前置              | 步骤                          | 预期                                        | P  |
| ---------- | --------------- | --------------------------- | ----------------------------------------- | -- |
| BE-FIX-001 | Redis 限流开启     | 并发打满限流键                  | 计数不丢（修正 ctx 生命周期），无 goroutine 悬挂；单测通过   | P0 |
| BE-FIX-002 | 计费热路径         | 带组织的中继扣费                 | 复用 `RelayInfo.OrganizationId`，不变量「初始−最终==logs.Quota」仍成立 | P0 |
| BE-FIX-003 | 易支付/Creem 回调   | 构造少付/正常/多付三类回调          | 少付被拦、正常入账、多付放行；验签+幂等不变               | P0 |
| BE-FIX-004 | 配置了可信代理       | 带伪造 `X-Forwarded-For` 等头访问   | 仅回环代理被信任；孤儿 token 401，不伪造客户端身份         | P0 |
| BE-FIX-005 | jsplugin 插件      | 堆内存超限 / 非法负时长            | 超限被杀；正常插件不被无符号下溢误杀；单测通过             | P1 |
| BE-FIX-006 | 渠道价格重试        | 重试路径 + 客户端中途断连           | 响应体被释放、连接回收；断连及时中止，不泄漏               | P1 |

---

## 10. V1.4.0 / V1.5.0 新增功能用例（`d4c540ebc` → `eedf3e2ce`）

> 覆盖 10-18 ~ 10-22 的 32 个提交。每条断言均在本地隔离实例（`PORT=3100`、`SQLITE_PATH=/tmp/uter-qa/qa.db`、mock 上游 `127.0.0.1:3199`）实跑过，证据字段保留实测值。
> 记号：**PASS** 已实测通过；**FAIL** 实测与预期不符（对应 §8.1 缺陷）；**待裁决** 实现与断言冲突但口径需产品确认。

### 10.1 渠道优先级子系统（PRIO）

> 新子系统：`model/channel_priority.go` + `controller/channel_priority.go`，以 revision 做乐观锁，preview 只算不落库，restore 用于撤销。

| ID       | 前置                | 步骤                                            | 预期                                                              | P  |
| -------- | ----------------- | --------------------------------------------- | --------------------------------------------------------------- | -- |
| PRIO-001 | 超管 + 至少 3 条渠道     | `GET /api/channel/priority/order`             | 200，返回有序渠道列表 + 当前 `revision`；顺序与 `channels.priority` 一致        | P0 |
| PRIO-002 | 同上                | `POST /api/channel/priority/reorder` 提交新顺序   | 200，revision +1；`channels.priority` 与 `abilities` 双写一致（PASS）       | P0 |
| PRIO-003 | 同上                | reorder 后立刻发起中继请求                             | 立即按新顺序命中，无需重启（PASS：拖拽后高优先渠道 100% 命中）                            | P0 |
| PRIO-004 | 同上                | preview 提交（不落库）                              | 返回 `changes` 预览，但数据库 priority 不变（PASS）                           | P0 |
| PRIO-005 | 同上                | 用过期 revision 提交                              | 409 `ErrChannelPriorityConflict`，提示刷新重试（PASS）                    | P0 |
| PRIO-006 | 同上                | `id == target_id`                             | 拒绝（`ErrChannelPriorityInvalid`）；**实测返回 409 冲突文案，语义可接受但错误码不精确**（观察项） | P1 |
| PRIO-007 | 同上                | 非法 position（负数 / 超界）                          | 拒绝（`ErrChannelPriorityRange`）；**实测同 PRIO-006 返回冲突文案**（观察项）      | P1 |
| PRIO-008 | 同上                | restore 撤销上一次 reorder                         | priority 回滚到上一 revision 的值（PASS）                                | P0 |
| PRIO-009 | 普通用户              | 调用 order / reorder                           | 403 `AUTH_INSUFFICIENT_PRIVILEGE`（读需 `ChannelRead`、写需 `ChannelWrite`） | P0 |
| PRIO-010 | 渠道被删除后            | 提交包含该渠道的 order                              | 拒绝，不得写入幽灵渠道                                                      | P1 |
| PRIO-011 | 多渠道同 priority   | reorder 后查询                                    | 顺序稳定（不出现随机抖动），重复调用结果一致                                          | P1 |
| PRIO-012 | 并发两次 reorder（同 revision） | 同时提交                                     | 恰好一个成功、一个 409；`channels` 与 `abilities` 不得半写                        | P0 |
| PRIO-013 | 中继压测              | 调整顺序后连续 50 次请求                                | 命中分布与 priority 序列一致，无回退到旧顺序                                    | P1 |
| PRIO-014 | 超管                | reorder 后查 `GET /api/channel/`                | 列表 `priority` 字段与新顺序一致，前端拖拽态与后端一致                              | P1 |
| PRIO-015 | 渠道禁用              | 把某渠道置为 disabled 后再 reorder                  | 禁用渠道不参与路由，但仍保留其 priority 位置                                   | P1 |
| PRIO-016 | revision 溢出边界     | 连续 reorder 多次                                     | revision 单调递增，不重置、不复用                                        | P2 |
| PRIO-017 | 审计                | reorder / restore                             | 审计日志有 `channel_priority` 类事件，含操作者与变更前后顺序                          | P0 |

### 10.2 DeepSeek 托管工具（BE-DST）

> 新接口 `/v1/tools/search`、`/v1/tools/fetch`；`middleware/distributor.go` 强制 `RoutingModel`（`deepseek-search` / `deepseek-fetch`），按次计价 `tier("request", fixed(0.00075))` → 375 quota。

| ID        | 前置                    | 步骤                                          | 预期                                                             | P  |
| --------- | --------------------- | ------------------------------------------- | -------------------------------------------------------------- | -- |
| BE-DST-001 | 渠道含 `deepseek-search` | `POST /v1/tools/search`                     | 200；上游收到 `/v1/tools/search`；扣 375 quota（PASS）                    | P0 |
| BE-DST-002 | 渠道含 `deepseek-fetch`  | `POST /v1/tools/fetch`                      | 200；扣 375 quota（PASS）                                            | P0 |
| BE-DST-003 | 同上                   | 请求体 `model` 填任意值（如 `gpt-4o`）              | **被忽略**，仍按 RoutingModel 路由并计 375（PASS：模型不可被客户端改写）              | P0 |
| BE-DST-004 | 同上                   | 请求体缺 `model`                              | 仍成功（服务端注入 RoutingModel）                                        | P0 |
| BE-DST-005 | 令牌限模型 `gpt-3.5-turbo` | 调用 `/v1/tools/search`                     | 拒绝（模型限制生效，不得绕过）                                                | P0 |
| BE-DST-006 | 无 `deepseek-search` 渠道 | 调用                                        | 503 `model_not_found`，不产生消费日志                                   | P0 |
| BE-DST-007 | 上游 4xx/5xx           | 调用                                        | 失败不计费（`failed call is free`）；日志无 quota 或 quota=0                    | P0 |
| BE-DST-008 | Responses `web_search` 工具 | 上游返回 `web_search_call` 项（`action.type=open_page`） | 按 `open_page` 计 Fetch、其余计 Search；失败调用不计；流式以终态帧计数覆盖运行中计数 | P1 |
| BE-DST-009 | 计费不变量              | 连发 3 次 search                              | 余额差值 == 3 × 375 == 日志 Quota 之和                               | P0 |

### 10.3 通知体系（BE-NOT）

> `controller/user.go:UpdateUserSetting` 从**已存设置**出发，只清空非所选通知方式的配置；`quota_warning_threshold=0` 表示站点默认（`QuotaRemindThreshold`，默认 1000）。

| ID        | 前置                        | 步骤                                        | 预期                                                                | P  |
| --------- | ------------------------- | ----------------------------------------- | ----------------------------------------------------------------- | -- |
| BE-NOT-001 | 已登录                       | 保存 `notify_type=webhook` + `webhook_url`  | 200，设置落库（PASS）                                                    | P0 |
| BE-NOT-002 | 站点 `QuotaRemindEnabled=true` | 余额从 10500 扣到 500（跨 1000 阈值）             | 触发一次额度预警通知（PASS）                                                 | P0 |
| BE-NOT-003 | 同上                       | `notify_type=sms`                         | 拒绝 `Invalid warning type`（PASS）                                   | P0 |
| BE-NOT-004 | 同上                       | `quota_warning_threshold=-5`              | 拒绝 `Reminder threshold cannot be negative`（PASS）                 | P0 |
| BE-NOT-005 | 同上                       | webhook 类型但 `webhook_url=""`              | 拒绝 `Webhook URL cannot be empty`（PASS）                            | P1 |
| BE-NOT-006 | 同上                       | `webhook_url=file:///etc/passwd`          | **应拒绝非 http(s)**；**✅ 已修复（V1.5.1）：保存阶段即拒绝**（DEF-8 回归）。发送阶段另有 SSRF 拦截作纵深防御 | P1 |
| BE-NOT-007 | 同上                       | `notification_email=not-an-email`         | 拒绝 `Invalid email address`（PASS）                                  | P1 |
| BE-NOT-008 | 已存 `webhook_secret`        | 再次保存 webhook 设置且**不回传 secret**             | 应保留原 secret；**✅ 已修复（V1.5.1）：secret 保留**（DEF-7 回归）              | P1 |
| BE-NOT-009 | 同上                       | `quota_warning_enabled=false`             | 保存为 false（PASS）                                                  | P0 |
| BE-NOT-010 | 同上                       | 关闭预警后跨阈值                                  | 不发通知（PASS）                                                       | P0 |
| BE-NOT-011 | 同上                       | 余额持续低于阈值再扣费                              | **不再重复提醒**（每次跌破只提醒一次，充值回升后才重置）                                  | P1 |
| BE-NOT-012 | 通知限额 `NOTIFY_LIMIT_COUNT=2` / 10min | 10 分钟内触发 3 次                           | 第 3 次被拒 `notification limit exceeded`（PASS，实测日志可见）                 | P1 |
| BE-NOT-013 | 超管                       | 设置 `channel_notify_enabled`               | 仅超管可改（`RoleAdminUser` 以上）；普通用户提交该字段被忽略                            | P1 |
| BE-NOT-014 | 超管                       | 设置 `upstream_model_update_notify_enabled`  | 同上，普通用户不可改                                                        | P1 |

### 10.4 Resend 邮件（BE-EML 续号）

| ID        | 前置                     | 步骤                          | 预期                                                        | P  |
| --------- | ---------------------- | --------------------------- | --------------------------------------------------------- | -- |
| BE-EML-020 | 已配置 Resend Key         | `GET /api/option/`          | 仅返回 `ResendKeyConfigured=true`，**不下发明文 key**（PASS）         | P0 |
| BE-EML-021 | 未配置                   | 同上                          | `ResendKeyConfigured=false`                                | P1 |
| BE-EML-022 | 已配置                   | 触发验证码 / 重置密码邮件              | 走 Resend 通道发送成功；失败时回落到 SMTP 或明确报错，不静默吞异常                | P0 |
| BE-EML-023 | 非法 Key（空 / 超长 / 含空格）   | 保存配置                        | 拒绝并提示，不得写入 options                                       | P1 |
| BE-EML-024 | 发送失败（上游 4xx）           | 触发邮件                        | 错误上报到日志，接口返回明确失败；不把失败当成功                                  | P1 |

### 10.5 过载哨兵（BE-SEC 续号）

> `common/system_monitor.go`：5s 采样、按 cgroup 配额计算 CPU/内存、**连续 3 次**超阈值才熔断、采样超过 30s 视为过期、判定时按**当前阈值**复核。

| ID        | 前置                          | 步骤                        | 预期                                                                    | P  |
| --------- | --------------------------- | ------------------------- | --------------------------------------------------------------------- | -- |
| BE-SEC-020 | `performance_setting.monitor_cpu_threshold=1` | 等待 ≥15s 后发中继请求           | 503，`code=system_cpu_overloaded`，message 含当前值与阈值（PASS：`current: 18.5%, threshold: 1%`） | P0 |
| BE-SEC-021 | 同上，阈值改回 90                  | 等待采样刷新后再请求                | 恢复 200（PASS）                                                          | P0 |
| BE-SEC-022 | 仅 1~2 次采样超阈值               | 立即请求                      | **不熔断**（连续 3 次才触发），避免毛刺误杀                                             | P0 |
| BE-SEC-023 | 采样超过 30s 未更新                | 请求                        | 视为无数据，**不熔断**（fail-open，避免监控挂掉导致全站 503）                                | P0 |
| BE-SEC-024 | `monitor_enabled=false`     | 任意负载请求                    | 不熔断                                                                   | P1 |
| BE-SEC-025 | 内存 / 磁盘超阈值                 | 分别构造                      | `system_memory_overloaded` / `system_disk_overloaded`，各自带当前值            | P1 |
| BE-SEC-026 | 熔断期间                       | 访问 `/api/*` 管理接口          | **不受影响**（哨兵只挂在 `/v1/*` 中继链路），后台可自救                                    | P0 |

### 10.6 SSRF 防护矩阵（BE-SEC 续号）

> 结论：SSRF **只作用于用户可控 URL 的抓取路径**（webhook、视频代理、MJ 图片、jsplugin、OAuth、下载）。渠道 BaseURL **刻意不做 SSRF 校验**（见 §10.7）。

| ID        | 前置                                                     | 步骤                                        | 预期                                                             | P  |
| --------- | ------------------------------------------------------ | ----------------------------------------- | -------------------------------------------------------------- | -- |
| BE-SEC-010 | `enable_ssrf_protection=true`、`allow_private_ip=false`、端口放行 | 用户 webhook 指向 `http://127.0.0.1:3199/…` 并触发通知 | 拒绝，日志 `request reject: private IP address not allowed: 127.0.0.1`（PASS，隔离 IP 维度） | P0 |
| BE-SEC-011 | 关闭 SSRF                                               | 同上                                        | 正常投递（PASS，正向对照）                                                  | P0 |
| BE-SEC-012 | 开启 + `allow_private_ip=true` + 端口放行                    | 同上                                        | 正常投递（PASS）                                                      | P0 |
| BE-SEC-013 | 开启 + 允许私网 + 端口白名单不含目标端口                                | 同上                                        | 拒绝，日志 `port 3199 is not allowed`（PASS，隔离端口维度）                  | P0 |
| BE-SEC-014 | 配置项下发方式                                               | 必须用点号键 `fetch_setting.<json_tag>` 逐项更新   | 整块 JSON 写入 `fetch_setting` **不生效**（`LoadFromDB` 无生产调用点，仅点号键走 `handleConfigUpdate` 热更新） | P0 |
| BE-SEC-015 | 域名/IP 黑白名单                                             | 配置 `domain_list` / `ip_list`              | 按模式（白/黑）生效；`apply_ip_filter_for_domain` 控制域名解析后是否再过 IP 过滤         | P1 |
| BE-SEC-016 | 非 http(s) 协议                                           | webhook 存 `file://` / `gopher://`         | 发送阶段拒绝 `unsupported protocol scheme`（PASS）                       | P0 |

### 10.7 渠道 BaseURL 与 SSRF 的边界（设计确认，非缺陷）

| ID        | 前置              | 步骤                                  | 预期                                                                 | P  |
| --------- | --------------- | ----------------------------------- | ------------------------------------------------------------------ | -- |
| BE-SEC-017 | 普通用户            | `POST /api/channel/` 自建渠道指向内网        | 403 `AUTH_INSUFFICIENT_PRIVILEGE`（PASS）：渠道组整体 `AdminAuth()`，建渠道需 `ChannelSensitiveWrite` | P0 |
| BE-SEC-018 | 超管              | 渠道 BaseURL 指向内网 + SSRF 开启           | **仍可中继**：`service/http_client.go` 注释明确「provider base URL 是运维托管目标，可能合法指向私网/私有链路」，故不接 SSRF 拨号器 | P0 |
| BE-SEC-019 | 代码审阅            | 新增「用户可控 URL 抓取」路径                   | **必须**用 `GetSSRFProtectedHTTPClient()` / `ValidateSSRFProtectedFetchURL()`，不得用 `GetHttpClient()` | P0 |

### 10.8 任务与插件（BE-TASK / BE-PLG 续号）

| ID         | 前置                     | 步骤                                  | 预期                                                              | P  |
| ---------- | ---------------------- | ----------------------------------- | --------------------------------------------------------------- | -- |
| BE-TASK-030 | 任务渠道首次失败               | 重试到备用渠道                             | 重试时清空 `TieredBillingSnapshot` 重新定价，并补足预扣（PASS 由单测覆盖）              | P0 |
| BE-TASK-031 | 任务重试成功                 | 查日志                                 | 只按最终成功渠道计费一次，不重复扣                                               | P0 |
| BE-TASK-032 | 任务轮询失败达 `TaskPollMaxFailures` | 继续轮询                              | 停止轮询并置失败态，不无限重试                                                 | P1 |
| BE-TASK-033 | 任务插件超时                 | 插件无响应                               | 按 `TaskPluginProtocolTimeoutSeconds` 超时，任务失败并回收资源                 | P1 |
| BE-PLG-001 | 超管                     | `GET /api/plugin/task`              | 返回插件列表，`meta.key/version/upstreams/routes` 完整（PASS）                | P0 |
| BE-PLG-002 | 同上                     | 查 kling 插件                          | `meta.version == 1.1.1`（PASS）                                     | P0 |
| BE-PLG-003 | 同上                     | kling 单 Key 直传                       | 不含 `|` 的 key 直接使用；`sk-` 前缀走网关直传；`access|secret` 两段仍兼容（PASS）  | P0 |
| BE-PLG-004 | 同上                     | 上传同名插件新版本                            | 版本号递增并替换，旧版本不再被选中                                                | P1 |
| BE-PLG-005 | 同上                     | 插件声明 `allowedHosts`                | 只允许访问声明的主机，越界请求被拒                                                | P1 |

### 10.9 多模态 embedding（BE-RLY 续号）

| ID         | 前置                          | 步骤                                              | 预期                                                                  | P  |
| ---------- | --------------------------- | ----------------------------------------------- | ------------------------------------------------------------------- | -- |
| BE-RLY-040 | 阿里渠道（type 17）含 `qwen3-vl-embedding` | `POST /v1/embeddings`，`input=["a cat"]`        | 上游命中 `/api/v1/services/embeddings/multimodal-embedding/multimodal-embedding`（PASS） | P0 |
| BE-RLY-041 | 同上                          | `qwen2.5-vl-embedding` / `tongyi-embedding-vision-*` / `multimodal-embedding-v1` | 同族（含日期快照）一律走原生端点（PASS）                                              | P0 |
| BE-RLY-042 | 同上                          | `input` 含 `{"type":"image_url","image_url":{"url":…}}` | 转成 `input.contents[].image`；`video_url` 转 `.video`；纯字符串转 `.text`       | P0 |
| BE-RLY-043 | 同上                          | 缺 `type` 的混合输入项                                  | 400/500 `multimodal input item missing required 'type' field`（PASS，明确报错不静默） | P1 |
| BE-RLY-044 | 普通（非多模态）embedding 模型         | 同上                                              | 走 `/compatible-mode/v1/embeddings`，不得误路由到原生端点                          | P0 |

### 10.10 审计、基础设施与运维（BE-AUD / BE-INF 续号）

| ID         | 前置                    | 步骤                                        | 预期                                                              | P  |
| ---------- | --------------------- | ----------------------------------------- | --------------------------------------------------------------- | -- |
| BE-AUD-010 | 已初始化                  | 查 `audit_logs` 索引                          | 存在 `idx_audit_time_event`（PASS）                                   | P0 |
| BE-AUD-011 | 同上                    | `PRAGMA index_info(idx_audit_time_event)` | 覆盖 `created_at` + `event_id` 两列（PASS，顺序为 created_at 优先）           | P0 |
| BE-AUD-012 | 大数据量                  | 按时间区间 + event_id 查询                       | 走索引，不出现全表扫描（`EXPLAIN QUERY PLAN` 无 `SCAN audit_logs`）             | P1 |
| BE-INF-020 | Redis 开启 + 脚本被清空（NOSCRIPT） | 触发限流 Lua 脚本                          | 自动回退 `EVAL` 重试成功，不返回 500（PASS 由单测覆盖）                            | P0 |
| BE-INF-021 | 同上                    | 回退后连续请求                               | 计数正确、无重复放行/误杀                                                   | P1 |
| BE-INF-022 | Redis 不可用              | 触发限流                                  | 降级到内存限流或 fail-open，明确记录，不阻断全站                                    | P1 |
| BE-OPS-030 | 超管                    | 修改 `performance_setting.*`               | 热更新立即生效（`UpdateAndSync`），无需重启（PASS：阈值改回后哨兵解除）                     | P0 |

### 10.11 支付与计费专项复核（补充 P0 断言）

| ID         | 前置                     | 步骤                                             | 预期                                                                 | P  |
| ---------- | ---------------------- | ---------------------------------------------- | ------------------------------------------------------------------ | -- |
| BE-PAY-030 | 易支付已配置                 | 下单 → 错签回调 → 少付回调 → 正常回调 → 重复回调                | 错签拒绝；少付拦截；正常按实付入账（实测 5,000,000 quota）；重复回调幂等不重复入账（PASS） | P0 |
| BE-PAY-031 | 同上                     | 回调 `trade_no` 不存在 / 支付方式与订单不匹配                 | 拒绝，不产生 topup 日志（PASS）                                              | P0 |
| BE-PAY-032 | 同上                     | 回调后查 `top_ups` 与日志                             | 金额一致（两位小数）、状态与到账额度一致、日志类型为 topup（PASS）                           | P0 |
| BE-PAY-033 | 金额边界                   | 0 / 负数 / 超上限 / 非数字                            | 全部拒绝，不创建订单                                                         | P0 |
| BE-BIL-033 | 计费公式复核                 | `prompt=20000, completion=10000, model_ratio=0.25, completion_ratio=2` | `(20000 + 10000×2) × 0.25 = 10000`；**注意补全倍率参与**，勿漏乘 completion_ratio | P0 |
| BE-BIL-034 | 并发 5 次                  | 同令牌并发请求                                        | 余额差值 == 50000 == 日志 Quota 之和（PASS，无重复扣/漏扣）                       | P0 |
| BE-BIL-035 | 流式与非流式同 usage          | 各发 1 次                                        | 扣费相同（PASS：均为 10000）                                               | P0 |
