# 优特-精选渠道大模型价格获取逻辑全方位审计

> 审计时间：2026-11-28 12:15 GMT+8
> 渠道：优特-精选（id=1262, type=65, provider=uterroute）
> 性质：只读审计，未修改任何产品代码、未提交、未 rebuild。
> 证据：真实 `/api/pricing` 接口数据、`one-api.db`（只读）channel_model_pricing 表、源码静态审查。

---

## 一、价格获取全链路

```
上游 UterRoute/DreamRouter  /api/pricing (FetchUterRouteUpstream)
  → 解析每条模型官方价 (uterRouteOfficialLine):
       billing_expr 系数(DERIVED_FROM_EXPR) > model_price(OFFICIAL_API)
       > model_ratio*2(DERIVED_FROM_RATIOS) > 历史快照(HISTORICAL_SNAPSHOT)
  → 快照 UterRouteUpstreamSnapshot (options 表)
  → 生成渠道记录 (UterRouteChannelPricingRecordsWithMapping):
       支持 model_mapping 重定向，按请求别名落库
       official_pricing / normalized_pricing / internal_pricing 三份 JSON
  → 分组折扣倍率 (UterRouteDiscountForModel, auto_groups ∩ enable_groups)
  → 交叉校验 (applyOfficialCrossCheck) → UpsertChannelOfficialPricing 落库
  → 后端定价视图 (controller/pricing.go GetPricing):
       resolveOfficialPrices → overlayChannelOfficialPrices → channel_price_display_view
  → 前端 (index.tsx → applyChannelView → ModelCard):
       applyChannelPrice 覆盖字段，getDiscountInfo 算角标
```

关键文件：
- `service/upstream_uterroute.go`：抓取(845)、官方价解析(254)、渠道记录(1271)、分组折扣(1506)、review 门禁(1669)
- `service/uterroute_pricing_expr.go`：表达式系数解析（token/duration/image）
- `model/channel_official_crosscheck.go`：交叉校验(189,330)
- `model/channel_model_pricing.go`：落库(1125)与 owner 规则(1062)
- `controller/pricing.go`：GetPricing(40)、official_prices 来源(167)、overlay(221)
- `model/pricing.go`：channelPriceDisplayView(560) 唯一显示契约
- `web/src/features/pricing/lib/channel-view.ts`：applyChannelView(28)
- `web/src/features/pricing/lib/price.ts`：getDiscountInfo(651)、getTaskPerSecondUSD(541)

---

## 二、核心数据健康度（真实数据）

渠道 1262 共 85 个模型定价行，全部 `pricing_status=configured` / `ACTIVE` / `source=uterroute-official` / `owner=BATCH`。

| 指标 | 数值 |
|---|---|
| 官方表达式可执行 | 45 |
| needs_review | **43（50.6%）** |
| review 原因：official input price disagrees | 35 |
| review 原因：DERIVED_FROM_RATIOS | 32 |
| 输出/缓存/cache-write/per-call 不一致 | 4/2/1/1 |
| needs_review 但仍保留 internal_pricing | **43（100%）** |

---

## 三、审计发现（按严重度）

### P0-1 交叉校验把两种价格口径当成错误，43/85 模型被误标 needs_review

- 文件：`model/channel_official_crosscheck.go:189-266`（crossCheckOfficialPrice）、`:330-358`（applyOfficialCrossCheck）
- 现象：`deepseek-v4-flash-0731` 官方价 0.445 USD/1M，与上游 `model_ratio*2=0.445` 完全一致，却因 baseline（Uter 同步定价 `ModelRatio`）为 0.44 被标 "official input price disagrees"。`deepseek-v4-pro` 1.333 vs 0.28、`doubao-seedance-2-0-260128` 7.29 vs 6.561 同理。
- 根因：baseline 取自 `GetModelPricingSnapshot`（Uter 同步售卖价 options.ModelRatio），而 UterRoute 官方价是上游原价/表达式系数，二者是**不同度量**。代码对百炼 `OFFICIAL_LIST` 已在 `authoritativeOfficialList()`(:158) 做了豁免，但 UterRoute 的 `RATIO_ONLY`/`BILLING_EXPRESSION`/`HISTORICAL_SNAPSHOT` 未豁免，全部走严格数值相等。
- 影响：过半模型进入 review 状态；一旦门禁生效，其自动计费价会被清空（`applyOfficialCrossCheck:356`），存在大面积计费中断风险。
- 建议：对 UterRoute 的官方价行比照 `authoritativeOfficialList` 增加"不同度量豁免"，或按 price_kind 分流 baseline；仅在同源口径内做数值相等校验。

### P0-2 needs_review 的内部计费价（BATCH owner）未被清除，与硬门禁语义冲突

- 文件：`model/channel_model_pricing.go:1256-1266`、`pricingReplaceableByOwner:1062`
- 现象：43 个 needs_review 记录 100% 携带 `internal_pricing`（source=batch, owner=BATCH）。代码虽在 `applyOfficialCrossCheck:356` 清空 record.InternalPricing，但 Upsert 更新既有行时 line1259 仅在 `pricingReplaceableByOwner` 为真才清；BATCH owner 返回 false，故旧价被保留。
- 根因：owner 规则把 BATCH 视为"显式决策"予以保护，但本渠道 85 行的 internal_pricing 全部是 `source=batch` 的批量同步产物，并非人工定价。owner 分类与 needs_review 门禁语义冲突。
- 影响：官方源已判定价格不可信（needs_review），系统却仍用旧的批量价计费，违背了 fail-closed 设计意图。
- 建议：区分"人工批量导入 BATCH"与"同步批量写入 BATCH"；对 needs_review 行，无论 owner 都不得作为自动计费价（保留展示但置 `PricingStatus=needs_review` 且计费路径拒绝）。

### P1-1 交叉校验 baseline 归一化后存在 296 组价格冲突，取值依赖排序

- 文件：`model/channel_official_crosscheck.go:119-142`（synchronizedOfficialBaseline）、`model/model_name_match.go:15`（normalizeModelMatchName）
- 现象：`ModelRatio` 中 `DeepSeek-V4-1-Flash-fast`(0.125) 与 `DeepSeek-V4-1-Flash-Fast`(0.3)、`anthropic-claude-opus-4.5`(2.14645) 与 `anthropic-claude-opus-4-5`(2.5) 等归一化后同名但值不同，共 296 组。baseline 用 `if exists continue` 取排序后第一个。
- 影响：baseline 可能取到旧别名/错误值，直接造成 P0-1 的误报；结果对名称排序敏感，不可审计。
- 建议：冲突时按权威源优先级选取并落日志；或放弃跨分隔符模糊匹配，改用精确模型 ID + 白名单别名。

### P1-2 参考价计费门禁默认放开（fail-open）

- 文件：`service/upstream_uterroute.go:132-140`（uterRouteReferencePriceBillingAuthorized）
- 现象：2026-11-25 运营决策改为"默认授权"，仅 option 显式设为 `false`/`0` 才恢复 fail-closed。当前 8 个 `RATIO_ONLY` 模型（gemini-3.5-flash 等）已自动启用计费。
- 风险：DERIVED_FROM_RATIOS / HISTORICAL_SNAPSHOT 是重建的参考价而非核验过的采购成本，默认计费与项目记忆"参考价受 REFERENCE_PRICE_BILLING_NOT_AUTHORIZED 门禁，未明确授权不得自动启用"的约定存在张力。
- 建议：确认当前授权是否为有效书面决策；若为临时，恢复默认 fail-closed；至少在详情页明确标注参考价来源。

### P2-1 顶层"所有渠道"视图与渠道视图可能不同源

- 文件：`model/pricing.go:543-550`、`controller/pricing.go:221`
- 现象：顶层取跨渠道 best，表达式行永输 absolute 行；`channelPriceDisplayView` 虽是唯一契约，但顶层输入与 channel_prices 输入不同。
- 风险：项目记忆要求"顶层与 channel_prices 字段级一致"，此处仅函数同源、输入不同源，边界情况下可能不一致。
- 建议：补一条"顶层 = 所有渠道视图中的最优行"的一致性断言测试。

### P2-2 分组倍率口径需持续校验

- 文件：`service/upstream_uterroute.go:1506`、`model/pricing.go` channelPriceDisplayView
- 现象：折扣从 `auto_groups ∩ enable_groups` 首个交集分组取 `group_group_ratio.default`，缺项回退 `group_ratio`。项目记忆强调禁止从多分组猜最低价。
- 建议：为"交集为空/多交集/缺 group_group_ratio"三种边界补测试；当前有 45 个可执行表达式模型，需确认倍率来源均可追溯。

---

## 四、正面结论（无问题）

- 抓取层：URL 白名单校验、8MB 响应上限、`vendor_id<=0` 隐藏模型过滤、mapping-aware 重命名、循环 mapping 检测均完备。
- 表达式解析：token/duration/按次/按张多形态齐备；duration 正则已与后端同口径（裸 `duration * x` 与 `(…duration…) * x` 均支持）。
- 前端角标：全量 419 模型 × 11 渠道扫描，"价格行有折扣但无角标"=0，角标%与价格行%分叉=0（上一轮审计已验证）。
- 落库身份：`ChannelPricingIdentity` 含 provider/region/deployment，模糊匹配歧义时 fail-closed 拒绝合并（:1178-1189）。

---

## 五、建议优先级

1. 立即：P0-1（误标 43 个模型）、P0-2（review 仍计费）—— 影响计费正确性。
2. 短期：P1-1（baseline 冲突）、P1-2（门禁默认策略确认）。
3. 中期：P2-1/P2-2（一致性断言与边界测试）。

> 本次审计为只读；任何修复需单独授权后执行，并补齐失败用例先行。

---

## 六、修复与修复后审计（2026-11-28 12:55 GMT+8）

### 6.1 已修复项

| 编号 | 状态 | 修复内容 | 主要文件 |
|---|---|---|---|
| P0-1 | 已修复 | 对 UterRoute 来源（`uterroute-*`）的官方价行增加“不同度量豁免”，不再拿上游原价/表达式系数/比值重建价与 Uter 同步售卖价做数值相等校验；其他渠道仍严格比对 | `model/channel_official_crosscheck.go` |
| P0-2 | 已修复 | 定价视图把 `needs_review` 行视为无可用内部价，即使数据库仍保留旧批量价也不会下发可计费价格；计费侧原有 `ChannelPricingBillableReason` 门禁保持不变 | `model/pricing.go` |
| P1-1 | 已修复 | baseline 构造抽成纯函数；归一化后同名但价格冲突的条目整体丢弃并记录日志，不再依赖排序取第一行；完全相同的重复别名仍保留 | `model/channel_official_crosscheck.go` |
| P1-2 | 部分修复 | 参考价授权配置改为显式布尔解析：空值沿用 2026-11-25 运营决策的默认授权；`true/1/yes/on` 授权；`false/0/no/off` 与任何无法识别的值均 fail-closed | `service/upstream_uterroute.go` |
| P2-1 | 已补齐 | 新增顶层价格必须等于“所有渠道视图中的最优已配置价格”的断言，并覆盖表达式/绝对价、多渠道择优 | `model/pricing_channel_view_test.go` |
| P2-2 | 已补齐 | 新增“首个 auto_groups ∩ enable_groups 命中缺 group_group_ratio 时只回退 group_ratio，不继续找更便宜分组”的边界测试；原有空交集、多交集歧义、顺序无关用例保持不变 | `service/upstream_uterroute_test.go` |

先行失败用例均在修复前复现，再转绿：

- `TestCrossCheckOfficialPriceUterRoutePriceIsDifferentMeasure`：修复前 4 个子用例全部误判 `needs_review`，修复后通过。
- `TestPricingChannelViewsShareOnePriceContract`：修复前旧批量价下发 `QuotaType=0`、`ModelRatio=0.5`，修复后为 `-1 / 0`。
- `TestSynchronizedBaselineDropsAmbiguousNormalizedNames`：修复前缺少纯构造函数，修复后通过并断言冲突只记录一次。
- `TestUterRouteReferencePriceAuthorizationRejectsInvalidValue`：修复前拼错配置值仍自动授权，修复后 fail-closed。

### 6.2 修复后数据复核

只读查询 `one-api.db` 的渠道 1262：

- 85 行价格，来源分布：`uterroute-expression` 45、`uterroute-ratio-reference` 32、`uterroute-official-api` 8，全部命中新的 UterRoute 豁免条件。
- 修复前 43 行 `needs_review`，其中 **43/43** 都带 `official ... price disagrees with Uter synchronized pricing`，属于本次豁免消除的误标。
- 数据库未被修改；本地 3000 服务未重启、未 rebuild，因此浏览器当前看到的旧数据不会立即变化。

### 6.3 验证结果

| 命令 | 结果 |
|---|---|
| `go test ./model/ ./controller/ ./service/ -count=1` | `model` ok；`service` ok；`controller` FAIL：4 个 UterAPI 渠道发现用例报 `Uter.api upstream billing group is not configured` |
| `bun run --cwd web test -- src/features/pricing` | 26 files / 359 tests 全通过 |
| `bun run --cwd web typecheck` | 通过 |
| `bun run --cwd web lint` | 0 errors；10 warnings 均来自既有并发改动文件，不在本次修复范围 |
| `bun run --cwd web format:check` | 通过 |
| `git diff --check` | 通过 |

`controller` 的 4 个失败用例为：

- `TestFetchUterAPIModelsIgnoresStaleFormBaseURL`
- `TestFetchModelsUterAPIUsesConfiguredUpstreamWhenFormBaseURLIsEmpty`
- `TestCreateUterAPIChannelsReportsPerSlotFailure`
- `TestCreateUterAPIChannelsSupportsMultipleKeysInSlot`

失败原因是工作区并发改动的 UterAPI 上游计费组配置缺失，与本次定价交叉校验/展示门禁修改无关；未放宽或删除任何断言。

### 6.4 残留风险与未解决项

1. **历史数据未清理**：43 行仍保留 `needs_review` 标记与 `internal_pricing`。当前代码已保证它们不可计费、不在定价页显示售卖价，但数据库字段尚未订正。清理需单独授权并按备份 → 小批量 → 校验流程执行。
2. **默认授权未反转**：`P1-2` 的 fail-open 默认值来自 2026-11-25 明确运营决策；本次只修复“非法配置值误授权”。若要把缺省改为 fail-closed，会影响 32 个 `RATIO_ONLY` 模型的自动计费，需要单独授权与业务确认。
3. **UterRoute 数值二道防线减少**：豁免后，上游若发布明显错误的单价，不再由同步定价做数值交叉校验。建议改为“同源漂移阈值告警 + 人工确认”，而不是硬失败。
4. **baseline 覆盖率下降**：296 组归一化冲突条目被整体丢弃，相关模型暂时没有交叉校验基线。建议增加精确模型 ID + 显式别名白名单，逐步替代模糊分隔符归一化。
5. **生效条件**：修复只在源码中生效；需要在授权后 rebuild/重启本地 3000 服务，并在下一次上游同步后观察 43 个误标是否消失。

### 6.5 后续改进方案

1. 为 UterRoute 建立独立基线：按 `price_kind` 使用上游原价快照而非 Uter 售卖价；出售价与官方价之间只允许受控加价区间。
2. 在管理端渠道价格表增加“参考价来源 / 授权状态 / 上次授权人”三列，把 `DERIVED_FROM_RATIOS`、`HISTORICAL_SNAPSHOT` 与已核验采购价明确区分。
3. 对 `normalizeModelMatchName` 冲突生成可导出的别名冲突清单，按“精确 ID > 白名单别名 > 跳过”分级处理，避免静默丢基线。
4. 为 `needs_review` 历史行提供只读预览 + 显式确认的修复工具，沿用现有 `RejudgeBailianOfficialListCrossCheck` 的审计字段约束，但不得自动改库。
5. 将 UterAPI 渠道发现的计费组配置修复单独立项，先让 controller 测试集恢复全绿，再做本轮定价修复的浏览器端最终验收。

---

## 七、待执行事项落地记录（2026-11-28 13:50 GMT+8）

本节替代 6.4 中已完成的第 1、5 项和已执行的第 5 条“生效条件”。

### 7.1 已完成

| 事项 | 结果 | 证据 |
|---|---|---|
| controller 4 个 UterAPI 测试失败 | 已恢复全绿。单独运行、四例组合运行、全量 `go test ./controller/ -count=1 -v` 均通过（150.706s，退出码 0） | 失败在工作区并发改动期间出现，重跑后消失；未放宽或删除断言 |
| 历史 `needs_review` 数据清理 | 备份 `one-api.db.pre-uterroute-review-fix-20261128-133814`（`integrity_check=ok`）后，按 10 行/批清理 43 行：移除 crosscheck 原因，保留 `DERIVED_FROM_RATIOS` 作为审计来源。最终 `needs_review=0`、crosscheck 原因=0 | 逐批校验；`internal_pricing / pricing_status / pricing_owner / pricing_source / purchase_pricing` 与备份逐行一致；`pricing_version` 已重算；`integrity_check=ok` |
| 前端与后端重建 | `bun run --cwd web build` 成功；`go build -o /tmp/uter-verify-bin .` 成功 | 前端构建退出码 0；后端二进制 206MB |
| 隔离实例验证 | 在 `127.0.0.1:3001` 启动新二进制，未 kill/restart 3000；`/` 与 `/api/status` 返回 200，`/api/pricing` 按预期返回 401；数据库 85 行误标为 0 | 启动日志无异常；验证后已停止 3001；3000 原 PID 18605 仍在监听 |
| 提交 | commit `72707ed86`，仅含本次 9 个明确文件 | `git show --stat` 已核对；工作区其他并发改动未纳入 |

### 7.2 仍未执行 / 需业务确认

1. **默认参考价授权未反转**：仍沿用 2026-11-25 运营决策；非法配置值已 fail-closed。反转会影响 32 个 `RATIO_ONLY` 模型自动计费，需明确业务确认。
2. **UterRoute 漂移阈值告警**与**别名白名单治理**属于中期改进，未在本轮实现。
3. **3000 服务仍运行旧二进制**：本轮按要求未 restart/kill launchd 托管服务；新代码已通过 3001 隔离实例验证，正式生效仍需在运维窗口重启 3000。

---

## 八、UterRoute 渠道全链路续审与修复（2026-11-28 15:35 GMT+8）

本节承接用户要求：`继续审计UterRoute渠道的所有代码，修复潜在的bug，提出优化和完善方案并执行优化方案`。

### 8.1 审计范围

- 抓取/解析：`service/upstream_uterroute.go`、`service/upstream_host.go`、`service/uterroute_pricing_expr.go`。
- 同步/重定价：`service/uterroute_upstream_task.go`、`service/generic_upstream_pricing.go`、`controller/upstream_pricing.go`。
- 落库/对账：`service/channel_pricing_autoverify.go`、`model/pricing.go` 的上游价格视图链路。
- 前端：`web/src/features/channels/api.ts`、`lib/uterroute.ts`、`components/uterroute-channel-panel.tsx`、`components/channel-pricing-panel.tsx`、`components/drawers/channel-mutate-drawer.tsx`。
- 测试：UterRoute 抓取、diff、历史幂等、任务表达式、重定价、进程锁、控制器同步流程、前端面板与识别函数。

### 8.2 已修复项（编号 / 状态 / 文件 / 根因）

| 编号 | 状态 | 文件 | 根因与修复 |
|---|---|---|---|
| R-01 | 已修复 | `service/upstream_uterroute.go` | `DiffUterRouteUpstream()` 只比模型单价字段，分组折扣变化不会进入审计历史。新增 `group_ratio`、`group_group_ratio`、`auto_groups`、`excluded_models`、`enable_groups` 的稳定文本 diff；空集合归一化，避免 `nil` 与 `[]` 假变更。 |
| R-02 | 已修复 | `service/upstream_uterroute.go`、`service/uterroute_pricing_expr.go` | 任务结算只带 usage facts，生产落库却保留 `param()`/`header()` 探测，会静默按兜底档计费。生产路径接入 `uterRouteAdaptTaskExpr()`，无法安全改写时 fail-closed，`v1:` 前缀保持不变。 |
| R-03 | 已修复 | `service/uterroute_upstream_task.go` | 改价检测只看主输入价，output/cache 变化不会触发重算。改比完整 official/channel tier fingerprint，序列化失败时回退主价比较。 |
| R-04 | 已修复 | `service/uterroute_upstream_task.go`、`controller/upstream_pricing.go` | 手动同步与定时任务只靠分布式锁，单进程内可并发读同一 previous snapshot。新增进程级 `TryLock` 并覆盖手动入口。 |
| R-05 | 已修复 | `service/upstream_uterroute.go` | 同步重试会把同一逻辑变更按新 `DetectedAt` 重复追加到历史。新增不包含时间戳的去重键，`DetectedAt` 不再参与幂等判断。 |
| R-06 | 已修复 | `service/upstream_host.go`、`controller/upstream_pricing.go` | 手动同步只校验 hostname，可指向同机任意端口。新增 `IsUterRouteEndpoint()`，要求完整 origin（scheme + host + port）匹配。 |
| R-07 | 已修复 | `service/upstream_uterroute.go`、`controller/upstream_pricing.go` | 折扣组未校验即可落库，拼错组会让整渠道失去价格且配置被记住。新增 `IsUterRouteDiscountGroup()`，在 fetch 到实时 snapshot 后校验，失败不改配置。 |
| R-08 | 已修复 | `controller/channel_upstream_update.go` | UterRoute 实时拉取失败后，专用回退结果仍会经过通用内置目录兜底，可能吞掉真实路由错误并引入跨族模型。UterRoute 分支改为直接返回专用回退结果。 |
| R-09 | 已修复 | `service/channel_pricing_autoverify.go` | catalog parity 只把 UterAPI 的别名行映射回上游名，UterRoute 重定向渠道会被误报 `MODEL_MISSING`。抽出 `normalizeParityRowsForModelMapping()`，UterRoute 与 UterAPI 共用，且不修改原始行。 |
| R-10 | 已修复 | `service/upstream_uterroute.go` | 隐藏模型裁剪直接比对 channel 模型名，批量重定向后的别名无法识别。新增 `pruneHiddenUterRouteModelNames()`，先解析 `model_mapping` 再比对；删除价格行时同时删除上游名与别名。 |
| R-11 | 已修复 | `service/uterroute_upstream_task.go` | `Failures` / `NextAttemptAt` 只定义未写回，失败渠道每分钟无限重试。新增 `advanceUterRouteChannelSyncState()`，失败线性退避（上限 60 分钟），成功后清零。 |
| R-12 | 已修复 | `service/upstream_uterroute.go` | `SetUterRouteDiscountGroup()` 对共享 JSON option 做无锁读改写，并发保存会丢失其它渠道的分组。新增进程互斥锁。 |
| R-13 | 已修复 | `web/src/features/channels/api.ts` | `getUterRouteUpstreamSnapshot()` 直接读 `res.data?.data`，`success:false` 会被当成有效快照。改用 `requireServerSuccess()`。 |
| R-14 | 已修复 | `web/src/features/channels/components/uterroute-channel-panel.tsx` | 折扣组下拉切换失败后仍显示新值；当前已选组若不在发布列表里会渲染空值。失败时回滚，并把当前组并入可选项。 |
| R-15 | 已修复 | `web/src/features/channels/components/uterroute-channel-panel.tsx` | `fetched_at` 原样展示服务端时间字符串。改为可解析时间本地化，无法解析时保留原文。 |
| R-16 | 已修复 | `web/src/features/channels/lib/uterroute.ts`、pricing/mutate 两处面板 | 前端只比 hostname，后端要求完整 origin，且配置 host 末尾点会导致漏识别。新增 `isUterRouteConfiguredBaseUrl()`；两处面板统一优先按完整 origin 判断，并保留 host 回退。 |
| R-17 | 已修复 | `web/src/features/channels/components/drawers/channel-mutate-drawer.tsx` | Review 页隐藏了 Base URL，但 UterRoute 表单仍要求输入。只对托管式 Uter.api 隐藏，UterRoute 保留展示。 |
| R-18 | 已修复 | `web/src/features/channels/components/drawers/channel-mutate-drawer.tsx` | Fetch models 文案对 UterRoute 承诺同步“模型元数据与参考价”，实际只同步目录与计费比值。UterRoute 使用专属文案。 |

### 8.3 已复核但未改动

1. **空 Key 使用已存密钥被门禁拦截**：复核了 `handleFetchModels()` 与提交路径，两处原本只对新建态做必填校验；编辑态留空 Key 会复用已存凭据。曾尝试把编辑态纳入校验，导致 14 个既有渠道测试回归，已立即回退；未找到可复现的提交门禁缺陷，因此不改代码。
2. **`v1:` 表达式前缀**：`splitUterRouteExprVersion()` 与既有单测 `TestUterRouteTaskProbeRewriteKeepsVersionPrefix` 已覆盖，本轮无需重复修复。
3. **history 事务化**：已通过 R-05 幂等去重消除重试重复；快照与历史仍非同一数据库事务。若要求强一致，需要单独改动 option 持久化边界，风险高于当前收益，列为残留改进。

### 8.4 新增回归测试

- `service/upstream_uterroute_test.go`：分组配置 diff、历史幂等、任务探测改写、隐藏别名裁剪、并发分组写入、parity 别名归一化。
- `service/uterroute_reprice_test.go`：output/cache tier 变化触发重定价。
- `service/uterroute_sync_test.go`：进程锁互斥、失败退避写回。
- `controller/channel_uterroute_flow_test.go`：非配置端点拒绝、未知折扣组拒绝。
- `controller/channel_upstream_update_test.go`：UterRoute 实时错误不被通用目录吞掉。
- `web/src/features/channels/lib/__tests__/uterroute.test.ts`：末尾点、完整 origin 匹配。
- `web/src/features/channels/components/__tests__/uterroute-channel-panel.test.tsx`：`success:false`、当前组兜底、本地化时间、失败回滚。

### 8.5 验证命令与退出码

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `go test ./service/ -run '<UterRoute 定向集>' -count=1` | 0 | 全部通过 |
| `go test ./controller/ -run 'TestSyncUterRouteUpstreamRejectsUnconfiguredBaseURL\|TestSyncUterRouteUpstreamRejectsUnknownDiscountGroup' -count=1` | 0 | 2/2 通过 |
| `go test ./controller/ -count=1` | 0 | 控制器全量通过（99.336s） |
| `go test ./service/ -count=1` | 0 | 服务层全量通过（23.137s） |
| `go test ./model/ -count=1` | 0 | 模型层全量通过（15.201s） |
| `bun run --cwd web test -- src/features/channels` | 0 | 71 文件 / 638 测试全部通过 |
| `bun run --cwd web typecheck` | 0 | 通过 |
| `bun run --cwd web lint` | 0 | 0 error；10 warning 均来自并发 WIP 文件，非本次文件 |
| `git diff --check -- <本次 UterRoute 文件集>` | 0 | 无空白错误 |

一次并行执行 `go test ./service/ ./controller/ ./model/ -count=1` 时出现 3 个失败：2 个 live e2e 与 1 个编辑流程用例；三者单独运行与随后单包全量均通过，判定为工作区并发改动/全局夹具暂态，未放宽断言、未删除测试。

### 8.6 残留风险与后续方案

1. **未提交**：工作区存在大量并发会话的未提交改动；本轮只收口 UterRoute 明确文件集，未执行 commit，避免把其它 WIP 混入提交。
2. **history 非事务化**：已幂等但快照与历史仍为非原子 option 写入；建议后续把二者合并到单一版本化 option 或引入显式事务锁。
3. **前端 key 门禁**：未复现缺陷，暂不改；若后续出现具体报错，应补齐对应测试后再改。
4. **3000 服务**：仍运行旧二进制；本轮未 restart/kill launchd 托管服务，正式生效需运维窗口重启。

---

## 九、阿里百炼 / Uter.api / Uter Route 三渠道联合审计与落地修复（2026-11-28 16:00 GMT+8）

### 9.1 审计方法

三路只读并行审计，分别覆盖阿里百炼、Uter.api（优特订阅）、Uter Route 的抓取、解析、落库、计费门禁、同步调度与前端展示链路。审计以工作区当前实际文件为准（工作区同时存在其它会话的未提交改动）。每项确认缺陷均先写失败用例复现，再修改生产代码，最后跑定向与全量回归。**未删除测试、未放宽断言、未绕过门禁。**

### 9.2 已修复项

| 编号 | 渠道 | 严重度 | 文件 | 根因与修复 | 回归测试 |
|---|---|---|---|---|---|
| U-01 | UterRoute | P1 | `service/upstream_uterroute.go` | `resolveUterRouteAutoGroupChain` 用同一个 `false` 表示「无链命中」和「首命中倍率不可用」，调用方随后继续从其它 `enable_groups` 取更便宜倍率，违反「首命中权威、禁止多分组猜价」。改为四态 `(group, ratio, hit, ok)`；`hit && !ok` 直接 fail-closed | `TestUterRouteAutoGroupChainFailsClosedWhenFirstHitHasNoRatioEntry`（修复前失败）；原有链策略全部用例保持通过 |
| U-02 | UterRoute | P1 | `controller/upstream_pricing.go`、`service/upstream_sync_lock.go`、`service/uterroute_upstream_task.go` | 手动同步只有进程锁，跨实例并发可对审计历史做读改写覆盖。新增导出 `AcquireUterRouteUpstreamSyncLock(ctx)`，定时与手动入口共用同一全局锁 | `TestSyncUterRouteUpstream*` 全通过 |
| U-03 | UterRoute | P2 | `controller/upstream_pricing.go` | `channel_id` 分支仍用 `IsUterRouteHost`（仅主机名），可指向同机任意端口。改用完整 origin 校验 `IsUterRouteEndpoint` | `TestSyncUterRouteUpstreamRejectsChannelOnWrongPort` |
| U-04 | UterRoute | P2 | `service/uterroute_upstream_task.go` | 定时任务在历史写入失败后仍保存新快照，本次变更永久无法进入审计历史。改为失败即中止并保留旧快照为下次基线 | 同步相关测试全通过 |
| B-01 | 阿里百炼 | P1 | `service/bailian_pricing_page.go`、`service/bailian_provider.go` | 页面解析器新增 `combined_input_output` / `page_unit_price` 两种 priceType，归一化 switch 无对应分支，落入 `unknownTypes` 使模型全部 needs_review；页面解析器亦不识别「每千tokens」，导致按千 token 报价少算 1000 倍。补齐两种价格类型（同价输入输出 / 按单位落库）与千 token 单位识别 | `TestBailianCombinedAndPageUnitPricesBecomeExecutable`（修复前失败）；全部百炼测试通过 |
| B-02 | 阿里百炼 | P1 | `controller/bailian_catalog.go`、`service/bailian_provider.go` | `matched_models` 有三套口径：精确名、`len(Prices)>0`、metadata map，导致状态面板与 apply 摘要对 `cmaas-` 前缀 / 作用域 / 日期别名互相矛盾。统一到 `BailianSeenChannelModels`，并为别名写入建立规范名映射 | `TestApplyBailianCatalogCountsAliasesWithStatusPanel` |
| A-01 | Uter.api | P1 | `service/uterapi_catalog.go`、`controller/channel_uterapi.go` | 分组拉取只认旧 option `UterAPIUpstreamBaseURL`，创建向导却优先系统设置的 `subscription.api_url`，只填系统设置的部署拿不到分组。新增唯一取址函数 `UterAPIEffectiveBaseURL()`，三处链路共用 | `TestUterAPIEffectiveBaseURLPrefersSystemSettings`（修复前编译失败） |
| A-02 | Uter.api | P1 | `web/src/features/channels/lib/subscription-credential-mask.ts` | 掩码读取只看顶层 `subscription.api_key`，后端实际把分组凭据放在 `slots[].api_key`，导致「留空复用已存 key」在默认分组形态下失效。扩展为逐槽位读取并去重 | `reads grouped slot masks when the top-level api_key is empty`（修复前失败） |
| A-03 | Uter.api | P1 | `service/uterapi_catalog.go` | 计费组落库失败只写日志后吞掉，渠道照常启用，后续自动补模型 / parity / 定时同步全部静默跳过。改为写入价前先持久化分组，失败即返回错误 | Uter.api 服务与控制器全通过 |
| A-04 | Uter.api | P2 | `controller/channel_uterapi.go` | 插入后写回禁用态或禁用 abilities 失败时仅记录错误并继续，留下已启用、无验证价格的渠道且响应无 `channel_id`。新增 `rollbackUterAPIChannel()`，失败即删除草稿 | `TestCreateUterAPI*` 全通过 |
| A-05 | Uter.api | P2 | `common/secret_mask.go`、`web/src/lib/secret.ts` | `IsMaskedSecret` / `isMaskedSecret` 含任意 `*` 即判掩码，合法密码 `p*ssw0rd` 保存后仍是旧值。改为只识别掩码生成器实际产出的三种形态（全星号 / 前4+尾随星号 / 前4+中缀星号+后4），前后端同规则 | 前后端 `TestIsMaskedSecret` / `isMaskedSecret` 均新增真实含星号密钥用例（修复前失败） |
| A-06 | Uter.api | P2 | `controller/channel_uterapi.go` | 槽位无可用 key 时静默 `continue`，多槽位请求少建渠道且只看到 created 计数。新增 `resolveUterAPICreateSlotsWithSkipped()`，逐槽位返回明确原因 | `TestCreateUterAPIChannelsNoKeyNoCreate` 新增原因断言（修复前失败） |
| A-07 | Uter.api | P2 | `service/generic_upstream_pricing.go`、`service/uterapi_catalog.go` | 价格来源硬编码 `newapi:/api/pricing`，Uter.api 价被误标为通用来源。按 providerID 生成来源标签，分组倍率来源沿用行内来源 | `TestUterAPIGroupPriceKeepsProviderSource` |
| A-08 | Uter.api | P2 | `service/generic_upstream_pricing.go`、`service/uterapi_observability.go` | 共享 JSON option 的读-改-写无本地互斥，并发渠道创建 / 事件追加会丢其它渠道的配置或事件。两处加包级互斥锁 | 计费组与可观测性相关测试全通过 |

### 9.3 复核后确认不是缺陷（未修改）

1. **「needs_review 行仍下发可售价」为误报**：只读查询渠道 1262 确认 85 行 `pricing_owner=BATCH` 来自运营批量定价工具（`internal_pricing.note="batch: ..."`、`source="batch"`），属于显式人工决策；`EnforcePricingReviewGate` 与 `TestReviewGateKeepsBatchPriceAndClearsAutoPrice` 明确保留此类价格。按审计建议强制置 needs_review 会覆盖用户已确认的价格，违反运营数据保护约定。
2. **「`bailian_tier_expr_test.go` 精确原因断言被弱化」在当前工作区不成立**：`no executable price can be derived` 精确断言仍在 `bailian_provider_test.go:833`，无需恢复。
3. **「编辑态 key 留空门禁」**：延续第八轮结论，未找到可复现缺陷，不改代码。

### 9.4 验证结果

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `go test ./common/ ./model/ ./service/ ./controller/ -count=1` | 0 | 四包全通过（common 6.998s / model 23.684s / service 36.265s / controller 141.646s） |
| `bun run --cwd web typecheck` | 0 | 通过 |
| `bun run --cwd web lint` | 0 | 0 error / 0 warning；8193 静态 i18n 键全部存在 |
| `git diff --check` | 0 | 无空白错误 |
| 各定向测试（新增用例先行复现） | 0 | 全部由红转绿；既有断言未放宽 |
| `bun run --cwd web format:check` | 1 | 我修改的 `secret.ts` / `secret.test.ts` 已单独格式化并通过；仅剩并发会话文件 `channel-wizard-uterapi.test.tsx` 的格式问题，未触碰 |
| `bun run --cwd web test`（全量） | 0 | 408 文件 / 3821 用例全通过（404.74s）。首轮 1 例失败源于测试夹具 `sk-Claudekiro****key` 不是掩码生成器的真实输出（星号段含字母、后 4 位含星号）；已将夹具改为 `MaskSecretValue` 的真实形态，断言强度不变，复跑全绿 |

### 9.5 本轮已落地的优化

- 三个渠道各自收敛出**唯一真源**：UterRoute 分组链解析、Uter.api 取址、百炼模型匹配。消除「同一事实多套实现」造成的口径分叉。
- **失败域收窄**：同步失败、分组落库失败、草稿禁用失败、历史写入失败均改为显式中止或回滚，避免半状态继续计费。
- **密钥可编辑性**：掩码识别从「含星号」收紧到「掩码生成器实际形态」，前后端一致，既防止掩码回写覆盖真值，也允许真实密钥包含星号。
- **审计可追溯**：Uter.api 价格来源带 provider 标签，分组倍率来源带 `#group=`，便于区分官方价、渠道价与人工价。

### 9.6 后续建议（未落地，需单独授权）

1. **漂移阈值告警**：UterRoute 已豁免与售卖价的硬数值校验，建议改为同源快照的漂移阈值（如 >50%）告警 + 人工确认，避免上游异常单价无二道防线。
2. **别名白名单治理**：baseline 构造丢弃 296 组归一化冲突项，建议输出可导出冲突清单，按「精确 ID > 白名单别名 > 跳过」分级恢复基线。
3. **历史事务化**：UterRoute 快照与审计历史仍是两个 option 写入；建议合并为单一版本化 option 或引入显式事务锁。
4. **needs_review 修复工具**：提供只读预览 + 显式确认的历史行处理工具，沿用 rejudge 审计字段约束，不自动改库。
5. **并发会话收口**：`channel-wizard-uterapi.test.tsx` 的格式问题与本地 3000 服务运行旧二进制，需在运维窗口统一处理；本轮未 kill/restart 托管服务。

---

## 十、三渠道创建 / 编辑全流程测试与修复（2026-11-28 18:30 GMT+8）

### 10.1 范围与方法

按用户要求对阿里百炼、Uter.api、Uter Route 的**创建与编辑全流程**逐步骤审核：入参校验、凭据继承、模型发现、分组授权、价格抓取、落库门禁、别名重定向、缓存失效、同步状态与失败回滚。所有新增修复均先写回归用例，再临时关闭生产分支做反向验证（用例必须失败），恢复后复跑通过。工作区同时存在其它会话 WIP，本轮只修改与本任务直接相关的文件，未提交、未推送、未重启托管服务。

### 10.2 本轮确认并修复的问题

| 编号 | 渠道 | 严重度 | 文件 | 根因与修复 | 回归验证 |
|---|---|---|---|---|---|
| T-01 | UterRoute | P1 | `controller/upstream_pricing.go` | 手动同步没有调用 `pruneHiddenUterRouteModels`，上游 `vendor_id:0` 明确隐藏的模型仍在渠道模型中，并能写入渠道价格；定时任务已有裁剪而手动路径漏掉。手动同步先裁剪，再按裁剪后的模型与 `model_mapping` 生成价格 | `TestSyncUterRouteUpstreamPrunesHiddenModels`；关闭裁剪后失败 |
| T-02 | UterRoute | P1 | `controller/upstream_pricing.go` | 手动同步先提交快照/审计历史，再写渠道价格；Upsert 失败时错误版本已前移为下次 diff 基线，失败变更永久消失。改为所有渠道价格写入成功后，再以单一事务提交快照与历史 | `TestSyncUterRouteUpstreamKeepsBaselineWhenChannelWriteFails`；提前提交后失败 |
| T-03 | UterRoute | P1 | `controller/channel.go`、`controller/channel_uterroute_flow_test.go` | 编辑时改 `model_mapping` 后价格行仍按旧上游名存储，请求别名无价格。编辑落库后调用 `service.EnsureRedirectAliasPricing` 物化别名价格 | `TestUterRouteEditFlow_MappingChangeMaterializesAliasPricing`；关闭修复后失败 |
| T-04 | 通用价格来源 | P2 | `service/generic_upstream_pricing.go` | `genericChannelPricingRecords` 的记录 Source、`genericOfficialPricing` 的 normalized view、`applyGenericGroupPurchaseCost` 的来源标签仍硬编码 `newapi:/api/pricing`，Uter.api 价被误标。统一按 provider 生成来源，采购成本沿用记录行来源 | `TestGenericPricingRecordsUseProviderSourceLabels`；`TestGenericSyncFreezesGroupPurchaseCost` 增加前缀断言 |
| A-09 | Uter.api | P0 | `controller/channel.go`、`controller/channel_uterapi.go` | 通用 `POST /api/channel` type=64 直接以 GORM 默认 enabled 落库，绕过专用向导的 pending/disabled 与逐模型计费门禁。创建时强制 `ScopedPending` + `status=0` + abilities 禁用，异步同步价格并逐模型验证后才启用 | `TestAddChannelUterAPIServerFillsManagedCredentials` 增加状态/模式断言 |
| A-10 | Uter.api | P1 | `controller/channel.go`、`controller/channel_uterapi.go` | 编辑换 key、base_url、models 或 model_mapping 后，旧价格仍被当作已验证价格使用，渠道保持启用。相关字段变化时先 park 到 pending/disabled，再异步 `RefreshUterAPIChannelPricing` + `EnsureRedirectAliasPricing` + 逐模型门禁；仅在原始状态为启用且全部模型可计费时恢复启用，不重算人工售卖价 | `TestUpdateChannelUterAPIKeyChangeWaitsForRepricing`；关闭修复后失败；`TestChannelKeyCredentialChangedIgnoresMaskedResubmission` |
| A-11 | Uter.api | P2 | `web/src/features/channels/components/drawers/channel-mutate-drawer.tsx` | 专用创建向导与通用编辑保存后只失效渠道列表，不失效 `['pricing']` 与 `['channel-model-pricing']`，页面显示旧价格快照。统一在 `handleSuccess` 失效聚合价格缓存与全部渠道价格条目 | 前端全量 408 文件 / 3822 用例通过，typecheck/lint/format:check 通过 |
| A-12 | Uter.api | P2 | `controller/channel_uterapi.go`、`web/src/features/channels/api.ts`、抽屉组件 | 多 key 槽位只有部分 key 通过模型发现时，响应只报 `keys=<usable>`，不说明丢弃数量与原因。新增 `keys_total` / `keys_usable` / `key_warning`，前端在价格正常时仍弹出部分失败警告 | `TestCreateUterAPIChannelsReportsPartiallyUsableKeys` |
| B-07 | 阿里百炼 | P1 | `controller/bailian_catalog.go`、`web/src/features/channels/api.ts` | apply 步骤价格落库失败仍返回 `success:true`，前端把失败当成功。按 `pricingErr` 返回业务失败并在消息中说明价格未持久化 | 百炼全量控制器测试通过 |
| B-08 | 阿里百炼 | P1 | `controller/channel.go` | base_url 为空时 region 落为 Unspecified 且产生零价格行。`validateChannel` 增加必填校验 | 通用创建/编辑测试通过 |
| B-09 | 阿里百炼 | P2 | `controller/bailian_catalog.go` | 编辑后的 `syncBailianPricingAfterUpdate` 不更新 `bailian-sync-status`，前端失效后仍显示创建时旧结果。新增 `pricing_refresh` 步骤，并同步 matched/reference/pricing 计数；失败也记录原因 | `TestSyncBailianPricingAfterUpdateRecordsSyncStatus` |
| B-10 | 阿里百炼 | P2 | `web/src/features/channels/components/bailian-channel-panel.tsx` | workspace 输入框用 `defaultValue`，外部 `base_url` 改变后输入框不刷新，可能把旧 workspace 与新区域组合保存。用解析出的 workspace 作为 React `key` 强制同步默认值 | `外部 base_url 改变后 workspace 输入框同步刷新`；移除 key 后失败 |

### 10.3 复核后保留的既有契约

1. **Uter.api 创建必须全 key 授权**：`fetchUterAPIAuthorizedCatalog` 对授权失败采用 fail-closed，而模型发现允许 fail-soft 选取健康子集；这是「所有启用 key 都能服务模型才派生可售价」的有意门禁，不改成普通发现的 fail-soft。
2. **BATCH owner 的人工价格**：延续第九节结论，运营批量定价是一种显式人工决策，review 时不强制清空。
3. **快照/历史事务**：第九节 9.6 第 3 条之后，工作区已由并发改动落地 `CommitUterRouteSnapshotAndHistory`；本轮保留该事务，并把提交点后移到渠道价格写入成功之后。

### 10.4 验证结果

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `GOWORK=off go test ./common/ ./model/ ./service/ ./controller/ -count=1` | 0 | 四包全通过（common 2.784s / model 11.941s / service 19.258s / controller 90.258s） |
| `bun run --cwd web test` | 0 | 408 文件 / 3822 用例全通过（361.33s） |
| `bun run --cwd web typecheck` | 0 | 通过 |
| `bun run --cwd web lint` | 0 | 0 error / 0 warning；8193 静态 i18n 键全部存在 |
| `bun run --cwd web format:check` | 0 | 通过；抽屉文件单独按 protected-header 规则格式化 |
| `git diff --check` | 0 | 无空白错误 |

### 10.5 未完成项

- 本轮未主动执行 `git commit` / `git push`。期间并发会话推进了 `main` 与 `origin/main` 到 `7e93e9dc0`，其中已吸收本任务的部分后端修改；`git status` 仍显示本任务相关文件 `controller/channel.go`、`controller/channel_uterroute_flow_test.go`、`controller/channel_uterapi_flow_test.go`、`web/src/features/channels/api.ts`、`web/src/features/channels/components/drawers/channel-mutate-drawer.tsx`、`web/src/features/channels/components/bailian-channel-panel.tsx`、`web/src/features/channels/components/__tests__/bailian-channel-panel.test.tsx`、`docs/audits/UTER-SELECT-CHANNEL-PRICING-AUDIT-20261128.md` 处于工作区未提交状态。后续提交前必须逐文件核对并只暂存本任务预期文件。
- 未 rebuild / 重启本地 3000 服务；需要运维授权，本轮没有 kill/restart 任何本地服务。
- 未对生产数据库做写入验证；所有测试使用隔离内存数据库与 mock 上游。
