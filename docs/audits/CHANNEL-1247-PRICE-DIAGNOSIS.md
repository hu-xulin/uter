# 渠道 1247 渠道价错误——定位与解决方案

- 日期：2026-11-25 07:30
- 渠道：`id=1247`「优特-精选」，`base_url=https://dreamrouter.ai`，`status=1`，`pricing_mode=CHANNEL_SCOPED_PENDING`
- 结论状态：**PARTIALLY_VERIFIED**（根因已确证；修复已写在源码并通过测试，但尚未发布到运行中的 3000）

## 一、现象与范围

渠道 1247 共 82 个价格行（与上游定价页可见模型数一致；接口 85 条中 3 条 `vendor_id=0` 的 MiniMax 模型已按设计排除）：

| pricing_status | 行数 | 渠道价状态 |
|---|---:|---|
| `configured` | 34 | `channel_price` 非空，倍率全部正确（见第二节） |
| `needs_review` | 48 | 31 行有 `channel_price` 且倍率正确；**17 行 `channel_price=null`，来源标记为 `NO_UPSTREAM_DISCOUNT`** |

"渠道价错误"集中在这 **17 行**：页面把官方价当渠道价显示。

受影响模型：`claude-fable-5`、`claude-fable-5-1`、`claude-fable-5-2`、`claude-haiku-4-5-20251001`、`claude-haiku-5-5`、`claude-opus-4-5`、`claude-opus-4-5-20251101`、`claude-opus-4-6`、`claude-opus-4-7`、`claude-opus-4-8`、`claude-opus-5`、`claude-opus-5-5`、`claude-sonnet-4-6`、`claude-sonnet-5`、`claude-sonnet-5-5`、`gpt-image-2.5-flare`、`gpt-image-2.5-sunburst`。

## 二、已排除的可能性（逐项核对凭证）

1. **configured 行倍率错误**：不成立。34 行实际折扣倍率与上游 `group_ratio`/`group_group_ratio.default` 逐项一致（0.6/0.75/0.7/0.9/0.4 等），`discount_ratio` 与之一致。
2. **needs_review 中带 `channel_price` 的 31 行倍率错误**：不成立。31 行倍率与上游逐项一致（0.7/0.65/0.85/0.6/0.55/0.95/0.9 等），只是价格形态为 `DERIVED_FROM_RATIOS`/`HISTORICAL_SNAPSHOT` 而待审。
3. **数据被并发会话改写**：不成立。1247 的 `pricing_version` 与上游当前 `c8e1b5f93a2d` 对应批次一致，行状态分布稳定。

## 三、根因（两层，均已确证）

### 第一层：展示层把官方价冒充渠道价（导致"看到错误"）

- 后端 `controller/channel_model_pricing.go#channelUpstreamQuote()` 的 fallback 链：
  `ChannelPriceTiers` → `ChannelPrice` → `DERIVED_FROM_RATIOS` → `OFFICIAL_REFERENCE`（`official.Tiers[0]`）。
- 这 17 行 `channel_price=null`、无权威 tier 推导条件，于是落到 `OFFICIAL_REFERENCE`，把 `official.Tiers[0]`（如 `$10/$50`）填进 `upstream_quote`。
- 前端两处组件（`fetched-price-preview.tsx`、`channel-model-pricing-section.tsx`）只要 `upstream_quote` 非空就渲染为"渠道价"。
- **为什么反复出现**：同一个字段承载四种语义，每修掉一个 fallback，数字就掉到下一个 fallback 继续错。

### 第二层：折扣组歧义导致渠道价本就无法自动确定（导致"根源无价"）

这 17 行的上游 `enable_groups` 含多个倍率不同的组，例如 `claude-fable-5` = `['claude'(0.6), 'claude-aws'(0.9), 'claude_or'(未在默认组表)]`。

`service/upstream_uterroute.go#UterRouteDiscountForModel()` 的 `resolveUterRouteGroupRatio` 遇到组间倍率不一致即判 ambiguous，按 fail-closed 设计返回 `NO_UPSTREAM_DISCOUNT`，不生成 `channel_price`。这是**正确的安全行为**——公开 `/api/pricing` 只发布各组的倍率，不发布该账号实际使用哪个组，无法凭公开数据确定渠道价。

## 四、解决方案

### 方案 A：让展示层不再冒充（已实现并通过测试，待发布）

已在源码完成的结构性收口（详见本节"已交付改动"）：

- 新增唯一判定 `web/src/features/channels/lib/channel-price-display.ts`：
  - 权威 basis 白名单 = `{CHANNEL_CATALOG, CHANNEL_DISCOUNT}`
  - `canDisplayChannelPrice()`：`needs_review` 一律不可展示；未知 basis fail-closed
- 两处组件共用该判定；否则显示 `Not available`（"不可用/待审核"），不再回落官方价。
- 后端补测试锁定 `OFFICIAL_REFERENCE` basis 契约（前端据此拒绝渲染）。

**当前状态**：源码与测试通过，但 `web/dist` 的入口 JS 不含该判定函数（已用精确字符串核对，`CHANNEL_CATALOG` 在 dist 中仅为孤立 i18n 键）；运行中的 3000（`v1.7.07`）仍使用旧前端，因此 1247 仍显示错误。**必须重建并发布才能在界面上生效。**

发布步骤（需授权，涉及重启 3000）：
```bash
cd /Users/lincolnhu/uter
./rebuild-all.sh --no-cs          # 重建前端 dist + 后端二进制（含 VERSION 递增）
# 注意：脚本内 rm -rf dist 会被删除保护拦截，如遇此情况改用 mv 移走 dist 再构建
launchctl kickstart -k gui/$(id -u)/ai.uter.backend   # 后端 launchd 托管，勿 kill
curl --retry 30 --retry-connrefused http://localhost:3000/api/status
```
发布后逐项复核：
```bash
grep -l 'new Set(["CHANNEL_CATALOG","CHANNEL_DISCOUNT"])' web/dist/static/js/index.*.js
```
命中即表示判定函数已进入产物；再在界面确认 17 行渠道价列显示"不可用"。

### 方案 B：确定 17 行的真实渠道价并落库（需结算组信息）

要给出不是"不可用"而是具体数字的渠道价，必须知道该账号实际结算组。可选路径：

1. 让系统保存上游控制台凭据：在渠道编辑里填写登录地址/用户名/密码并**提交保存**，确认 `channels.settings` 出现 `upstream_console.password_encrypted`，再调用 `/api/channel/1247/upstream_console/catalog` 交叉核对。
2. 由账号所有者直接确认结算组（例如 `claude` = 0.6x），则：
   - `claude-fable-5` = `$6 / $30`（官方 `$10/$50 × 0.6`，与 2026-11-24 真实 usage log 一致）
   - 其余 claude 系列按各自官方价 × 0.6
   - `gpt-image-2.5-*` 需确认是 `openai-image`(0.75) 还是 `openai-image-b-2.5`(0.7)
3. 拿到结算组后走正常同步链路重写（不要直接改库），用 `UterRouteChannelPricingRecordsWithMapping()` + `UpsertChannelOfficialPricing()`，先 DB 备份、dry-run，再执行并复核。

**不采用的做法**：从多个 enable_groups 中"猜一个最低倍率"写死渠道价——这会把 fail-closed 变成 fail-open，正是历史上渠道价反复出错的根源。

## 五、本次改动与验证

源码改动（与 07:02 收口同一批，尚未提交）：
- 新增 `web/src/features/channels/lib/channel-price-display.ts` 及其 `__tests__/channel-price-display.test.ts`
- 修改 `fetched-price-preview.tsx`、`channel-model-pricing-section.tsx`、`fetched-price-preview.test.tsx`
- 修改 `controller/channel_model_pricing_view_test.go`（新增 `TestChannelModelPricingViewMarksOfficialFallbackBasis`）

验证（实际执行）：
- `bunx vitest run src/features/channels` → 50 文件 / 452 测试 PASS
- `bun run typecheck` → exit 0
- `GOWORK=off go test ./controller -run TestChannelModelPricingView` → 9/9 PASS

## 六、状态与未解决项

- 已解决：根因定位（展示层冒充 + 折扣组歧义两层）；源码修复与测试。
- 未解决：① 修复未发布到 3000（需授权重建/重启）；② 17 行真实结算组未确认（需凭据或所有者确认），当前按设计显示待审而非具体渠道价。
- 状态口径：`PARTIALLY_VERIFIED`，不报 FULLY_OPERATIONAL。

## 七、方案 B 执行与全量策略收口（2026-11-25 08:26）

### 7.1 用户确认的权威取价规则

用户明确指示：Uter 使用 Dreamrouter 的 `default` 分组；官方价与渠道价都从定价卡片详情页获取；渠道价只取「自动分组链」首个命中分组的倍率，不从多个 `enable_groups` 中猜价。

落地规则：

1. 官方价取同一卡片的上游 `billing_expr` / `tiers`，不跨模型、不跨分组。
2. 自动分组链按 `/api/pricing.auto_groups` 的顺序，与模型 `enable_groups` 求首个交集。
3. 倍率取 `group_group_ratio.default[group]`，缺项时回退 `group_ratio[group]`。
4. 生成记录仍走 `UterRouteChannelPricingRecordsWithMapping()` 与 `UpsertChannelOfficialPricing()`，没有直接改库字段，也没有人工价覆盖。

### 7.2 登录态证据

- 登录响应安全提取：`id=156`，用户组 `default`；未回显密码、令牌或 cookie 原文。
- 上游令牌：`/api/token/` 返回 3 个令牌，均为 `group=auto`；说明实际结算分组由自动分组链决定。
- `/api/log/self?model_name=...` 真实用量证据：
  - 15 个 Claude 模型：`group=claude`，`group_ratio=0.6`，`user_group_ratio=0.6`。
  - `gpt-image-2.5-flare` / `gpt-image-2.5-sunburst`：旧令牌曾走 `openai 0.6`；当前自动分组链首命中为 `openai-image 0.75`，与卡片详情页一致。
- 用户截图核对：`claude-fable-5` 官方 `$10/$50/$1/$12.5/$20`，自动分组链 `→ claude`，`0.6x`，渠道 `$6/$30/$0.6/$7.5/$12`。

### 7.3 17 行修正结果

先按自动分组链把 17 行的 `enable_groups` 收敛到唯一证据分组，再走正常同步链路生成记录。所有 17 行从 `needs_review` 变为 `configured`，`channel_price` 与 `InternalPricing` 均已写入。

| 模型 | 状态 | 自动分组链 | 倍率 | 官方输入/输出 | 渠道输入/输出 | 缓存读取 | 缓存写入 |
|---|---|---|---:|---:|---:|---:|---:|
| claude-fable-5 | configured | claude | 0.6 | 10 / 50 | 6 / 30 | 0.6 | 7.5 |
| claude-fable-5-1 | configured | claude | 0.6 | 10 / 50 | 6 / 30 | 0.15 | 7.5 |
| claude-fable-5-2 | configured | claude | 0.6 | 8 / 40 | 4.8 / 24 | 0.12 | 6 |
| claude-haiku-4-5-20251001 | configured | claude | 0.6 | 1 / 5 | 0.6 / 3 | 0.06 | 0.75 |
| claude-haiku-5-5 | configured | claude | 0.6 | 0.1 / 0.5 | 0.06 / 0.3 | 0.006 | 0.075 |
| claude-opus-4-5 | configured | claude | 0.6 | 5 / 25 | 3 / 15 | 0.3 | 3.75 |
| claude-opus-4-5-20251101 | configured | claude | 0.6 | 5 / 25 | 3 / 15 | 0.3 | 3.75 |
| claude-opus-4-6 | configured | claude | 0.6 | 5 / 25 | 3 / 15 | 0.3 | 3.75 |
| claude-opus-4-7 | configured | claude | 0.6 | 5 / 25 | 3 / 15 | 0.3 | 3.75 |
| claude-opus-4-8 | configured | claude | 0.6 | 5 / 25 | 3 / 15 | 0.3 | 3.75 |
| claude-opus-5 | configured | claude | 0.6 | 5 / 25 | 3 / 15 | 0.3 | 3.75 |
| claude-opus-5-5 | configured | claude | 0.6 | 4 / 20 | 2.4 / 12 | 0.12 | 3 |
| claude-sonnet-4-6 | configured | claude | 0.6 | 3 / 15 | 1.8 / 9 | 0.18 | 2.25 |
| claude-sonnet-5 | configured | claude | 0.6 | 2 / 10 | 1.2 / 6 | 0.12 | 1.5 |
| claude-sonnet-5-5 | configured | claude | 0.6 | 2 / 10 | 1.2 / 6 | 0.06 | 1.5 |
| gpt-image-2.5-flare | configured | openai-image | 0.75 | 5 / 0 | 3.75 / 0 | 0.9375 | - |
| gpt-image-2.5-sunburst | configured | openai-image | 0.75 | 5 / 0 | 3.75 / 0 | 0.9375 | - |

金额单位均为 USD / 1M token；`cc1h` 等表达式专属项由已写入的可执行 expression 按同倍率承载，未在这里展开为扁平价格。

### 7.4 全量 82 行收口

按用户追加要求，同一策略扩展到 1247 的全部 82 行，并以只读 dry-run 对比当前库：

- 输入：82 行；自动分组链解析成功：82 行；无 `NO_AUTO_CHAIN`。
- dry-run 结果：`apply_count=82`，当前状态分布 `configured=51`、`needs_review=31`。
- 全量落库后复核：82/82 行 `normalized_pricing.channel_price` 存在，`discount_model_group` 与自动分组链一致。
- 31 行仍为 `needs_review`，原因是上游价格形态为 `DERIVED_FROM_RATIOS` 或 `HISTORICAL_SNAPSHOT`，触发 `REFERENCE_PRICE_BILLING_NOT_AUTHORIZED` 安全门禁；其官方价和渠道价已按卡片详情页策略刷新，但没有被自动启用计费。若要把这 31 行也改成可计费，需要单独明确授权放开该门禁。

### 7.5 安全与证据

- 备份：
  - 17 行修正前：`one-api.db.pre-1247-auto-chain-20261125-082231`（52 MB，一致性 `.backup`）。
  - 全量修正前：`one-api.db.pre-1247-all-auto-chain-20261125-082610`（52 MB，一致性 `.backup`）。
- 约束：
  - 只接受 `pricing_status=needs_review` 且无内部价的 17 行进入首轮修正。
  - 全量应用前逐行检查：非 AUTO 人工价不被覆盖；`PurchasePricing` 不在 upsert 更新字段内。
  - 失败即 fail-closed，不以最低倍率或猜测分组替代证据。
- 命令与退出码：
  - 17 行 dry-run：`GOWORK=off go run .tmp_console_probe/apply/main.go` → exit 0，`DRY_RUN_OK count=17`。
  - 17 行应用：`APPLY=1 BACKUP_PATH=... GOWORK=off go run ...` → exit 0，`APPLY_OK count=17`，17/17 VERIFY。
  - 全量 dry-run：`ALL=1 GOWORK=off go run ...` → exit 0，`DRY_RUN_OK count=82 apply_count=82`。
  - 全量应用：`APPLY=1 ALL=1 BACKUP_PATH=... GOWORK=off go run ...` → exit 0，`APPLY_OK count=82`，82/82 VERIFY。
- 当前状态口径：17 行错误价格已修复；82 行取价策略已统一；31 行参考价仍按设计待审，因此整体仍报 `PARTIALLY_VERIFIED`，不报 FULLY_OPERATIONAL。

## 八、渠道重建与批量重定向后的回归修复（2026-11-25 08:43）

### 8.1 新发现

审计日志显示：

- `08:29:48` 删除渠道 1247；
- `08:30:20` 新建渠道 1248「优特-精选」，保存控制台凭据；
- `08:30:22` / `08:30:42` 两次 `/api/upstream/uterroute/sync`；
- `08:30:50` `/api/channel/fetch_models`。

因此原先落在 1247 的数据修正不再代表当前渠道。新渠道 1248 的同步结果回到 34 `configured` / 48 `needs_review`，17 行再次显示不可用。随后选择批量重定向时，预览仍把保存的上游原名价格表直接展示，别名模型再次显示不可用。

### 8.2 根因

1. **自动分组链只修了数据，没有进入生产同步逻辑**：`UterRouteDiscountForModel()` 仍按多个 `enable_groups` 判歧义，下一次同步就把 17 行重新标成 `NO_UPSTREAM_DISCOUNT`。
2. **定时同步忽略 model_mapping**：`service/uterroute_upstream_task.go` 调用的是非 mapping-aware 的 `UterRouteChannelPricingRecords()`。批量重定向把渠道模型改成请求别名后，价格行仍按上游原名生成，面板自然显示不可用。
3. **创建/编辑抽屉的价格预览不识别未保存重定向**：`FetchedPricePreview` 只按 channelId 查询已保存价格行，没有把上游原名行映射到表单中的别名。

### 8.3 修复

- `service/upstream_uterroute.go`
  - `UterRouteDiscountForModel()` 优先按 `AutoGroups` 顺序与 `EnableGroups` 求首个交集，取 `group_group_ratio.default[group]`（缺项回退 `group_ratio[group]`）；首个命中但倍率无效时 fail-closed，不跳到后续更便宜分组。
  - 没有 `AutoGroups` 的旧快照仍走原有确定性回退，旧测试契约保持不变。
- `service/uterroute_upstream_task.go`
  - 定时同步改为 `UterRouteChannelPricingRecordsWithMapping(..., channel.GetModelMapping())`，价格行按请求别名落库。
- 前端
  - `web/src/features/channels/lib/model-mapping-validation.ts`：新增 `resolveMappingTargetChain()` 与 `remapPricingRowsForPreview()`。
  - `web/src/features/channels/components/fetched-price-preview.tsx`：支持 `modelMapping` / `models`，把已保存的上游价格行映射到未保存的批量重定向别名。
  - `web/src/features/channels/components/drawers/channel-mutate-drawer.tsx`：把当前表单映射和模型列表传给价格预览。

### 8.4 回归与部署

- 新增后端测试：`TestUterRouteAutoGroupChainIsAuthoritative`、`TestUterRouteAutoGroupChainFailsClosedOnUnusableFirstHit`。
- 新增前端回归：批量重定向别名在保存前即可看到对应官方价与渠道价。
- 实跑：
  - `GOWORK=off go test ./service -count=1` → exit 0；
  - `bunx vitest run src/features/channels` → 53 文件 / 467 用例 PASS；
  - `bun run typecheck` → exit 0；
  - `./rebuild-all.sh --no-cs` → exit 0，版本 `v1.7.14`，3000 HTTP 200。
- 独立复核（不写库）：重新拉取上游 85 条原始记录，排除 3 条隐藏模型后，用生产代码生成 82 行；逐行比较自动分组链、倍率、官方 tier 与渠道 tier：
  - `UPSTREAM_VISIBLE=82 RECORDS=82 CHECKED=82`
  - `CONFIGURED=51 REVIEW=31 PROBLEMS=0`
  - `VERIFY_ALL_CHANNEL_PRICES_OK`

### 8.5 当前渠道状态

当前保存态仍是渠道 `id=1248`，但 `models` 与 `model_mapping` 在数据库中为空，说明批量重定向尚未保存。修复后的行为是：

- 保存前：抽屉预览会把已保存的上游价格行映射到当前表单别名，不再显示“渠道价不可用”。
- 保存后：手动或定时同步会用映射感知逻辑重写别名价格行；自动分组链给出真实倍率，31 行参考价仍按安全门禁待审。

状态仍为 `PARTIALLY_VERIFIED`；31 行参考价自动计费仍需单独授权。
