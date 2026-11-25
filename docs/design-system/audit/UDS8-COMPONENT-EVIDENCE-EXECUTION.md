# UDS8 组件证据执行与状态收口报告

- schema: `UDS8-COMPONENT-EVIDENCE-EXECUTION/1.0`
- 目标 HEAD：`fa5e1d5269f90490c17b500aa0c29bb19c022027`
- 执行日期：2026-11-25
- 执行路径：用户裁决「组件决策板：全部按照 UDS8 执行」→「补测试后标 VERIFIED」
- 总体结论：**COMPONENT_EVIDENCE=VERIFIED；OVERALL=PARTIALLY_VERIFIED**

## 1. 本次执行范围

本次只处理组件证据，不处理签名凭证与旧边界退役决策，也未获得字号修改授权。

已完成：

1. 为原 registry 中 40 个 `PARTIAL` 组件补真实 Vitest 契约测试。
2. 全部测试通过后，把这 40 项 `contract.evidence.status` 从 `PARTIAL` 改为 `VERIFIED`。
3. 每项挂接真实存在的测试文件路径；`manualReview` 清空，未用人工说明替代测试。
4. 未修改任何组件实现源码，未调整任何字号、字重、行高或设计 Token。
5. 未删除断言、未降低阈值、未扩大例外、未把 `accepted` 改成 `true`。

## 2. 测试文件与覆盖映射

| 测试文件 | 用例数 | 覆盖组件 |
| --- | ---: | --- |
| `web/src/components/ui/__tests__/component-contracts-display.test.tsx` | 15 | AspectRatio、DiscountBadge、IconBadge、Kbd/KbdGroup、Separator、Skeleton、Spinner |
| `web/src/components/ui/__tests__/component-contracts-interactive.test.tsx` | 11 | Checkbox、Switch、RadioGroup、Toggle、Slider、ButtonGroup、Progress、Collapsible |
| `web/src/components/ui/__tests__/component-contracts-overlay.test.tsx` | 7 | Accordion、AlertDialog、Popover、DropdownMenu、HoverCard |
| `web/src/components/ui/__tests__/component-contracts-structure.test.tsx` | 13 | Breadcrumb、Command、ContextMenu、InputOtp、Item、Menubar、NavigationMenu、Resizable、ScrollArea、SecretInput、SecretTextarea、Table |
| `web/src/components/ui/__tests__/component-contracts-advanced.test.tsx` | 6 | Carousel、Chart、Sonner、Direction |
| `web/src/components/ui/__tests__/component-contracts-remaining.test.tsx` | 10 | Calendar、ComboboxInput、Empty、TitledCard |

合计：6 个测试文件、62 个用例，全部通过。

`Empty` 同时挂接既有 `web/src/components/ui/__tests__/empty-typography.test.tsx`，作为字号层级守卫的补充证据；本次没有新增或改动字号规则。

## 3. Registry 状态

更新前：

- `VERIFIED`: 25
- `PARTIAL`: 40
- 总数：65

更新后：

- `VERIFIED`: 65
- `PARTIAL`: 0
- `NOT_VERIFIED`: 0
- 总数：65

`components:registry:check --strict` 输出：

```text
registered: 65
discovered: 65
evidenceVerified: 65
evidencePartial: 0
evidenceNotVerified: 0
errors: 0
warnings: 0
```

## 4. 验证命令与退出码

全部命令在 `web/` 目录执行。

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `vitest run <上述 6 个测试文件>` | 0 | `Test Files 6 passed`，`Tests 62 passed` |
| `bun run typecheck` | 0 | `tsgo -b` 通过 |
| `node scripts/check-component-registry.mjs --strict` | 0 | 65/65 VERIFIED，0 errors，0 warnings |
| `node scripts/check-design-system-8.0.0.mjs` | 0 | `VERDICT PASS · 22/22 checks · 0 errors` |
| `node scripts/check-design-tokens.mjs --strict` | 0 | 扫描 1339 个文件，字号/行高/圆角/投影/颜色均符合规范 |
| `node scripts/verify-contrast.mjs` | 0 | `Automated contrast/gradient audit: PASS; checks=37; failed=0` |
| `oxlint`（临时去掉 `src/components/ui` ignorePatterns，仅检查 6 个新增测试文件） | 0 | 0 warnings，0 errors |

说明：项目 `.oxlintrc.json` 的 `ignorePatterns` 明确忽略 `src/components/ui`，默认对这 6 个文件执行 lint 会返回「No files found」。为取得有效结果，只在 `/tmp` 生成去除该忽略项的临时配置，未改仓库配置；临时配置不是交付物。

## 5. 非本次范围阻塞项

以下为真实执行结果，未通过，但不属于本次组件证据改动，未越界修复：

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `bun run test`（前端全量） | 1 | `342` 个测试文件中 `17 failed / 325 passed`；`3351` 个用例中 `90 failed / 3261 passed`。六个新契约测试文件在全量运行中均 PASS。失败集中在 `model-pricing`、`channel-configuration`、`model-mapping-batch-dialog`、`oauth-settings`、`passkey-settings`、`email-settings-section`、`request-policies`、`cc-switch-dialog`、`lobe-icon` 等既有/并发工作区范围。 |
| `bun run lint`（全库） | 1 | `227 errors / 28 warnings`，命中 `scripts/uds-comprehensive-audit.ts` 及业务 `src/features/`；本次新增测试文件经定向 lint 为 0 error。 |
| `bun run copyright:check` | 1 | `scripts/uds-comprehensive-audit.ts` 缺版权头，来自并发会话提交的工作区改动；本次新增 6 个测试文件均含 AGPL 版权头。 |

因此，组件证据本身达成 `VERIFIED`，但全仓质量门禁未全绿，整体状态只能记 `PARTIALLY_VERIFIED`。

## 6. 并发工作区隔离

本次未触碰、未暂存、未提交以下并发 WIP：

- `.uap/state/current-execution.json`
- `.uap/state/execution-closures.jsonl`
- `.uap/state/executions.jsonl`
- `VERSION`
- `docs/design-system/audit/syntax-validation.json`
- `service/upstream_uterroute.go`
- `service/upstream_uterroute_test.go`
- `web/src/features/channels/components/__tests__/upstream-model-selection.test.tsx`
- `web/src/features/channels/components/upstream-model-selection.tsx`
- `one-api.db.pre-channel-cleanup-20261125-023457*`

本次交付涉及的文件：

- 新增：`web/src/components/ui/__tests__/component-contracts-display.test.tsx`
- 新增：`web/src/components/ui/__tests__/component-contracts-interactive.test.tsx`
- 新增：`web/src/components/ui/__tests__/component-contracts-overlay.test.tsx`
- 新增：`web/src/components/ui/__tests__/component-contracts-structure.test.tsx`
- 新增：`web/src/components/ui/__tests__/component-contracts-advanced.test.tsx`
- 新增：`web/src/components/ui/__tests__/component-contracts-remaining.test.tsx`
- 修改：`web/src/design-system/component-registry.json`
- 本报告：`docs/design-system/audit/UDS8-COMPONENT-EVIDENCE-EXECUTION.md`

更早批次已存在、仍属本次治理链的未提交文件：

- `docs/design-system/UDS-8.0-FINAL-ACCEPTANCE-REPORT.md`
- `docs/design-system/audit/PHASE6-MIGRATION-EVIDENCE.md`
- `docs/design-system/audit/UDS8-FINAL-DECISION-AND-SIGNATURE.html`
- `docs/design-system/audit/UDS8-RETIREMENT-COMPARISON.html`
- `docs/design-system/audit/UDS8-SIGNATURE-CREDENTIAL.html`

## 7. 待用户继续裁决/执行的事项

1. 签名凭证 JSON：用户尚未贴回，签名流程未闭环。
2. 旧边界退役决策 JSON：用户尚未贴回，退役范围未最终闭环。
3. 全量测试、全库 lint、版权检查的非本次范围失败项：需由对应工作区所有者处理，或由用户授权后另开范围处理。
4. 未提交：HEAD 与工作区绑定如上；因并发 WIP 未获授权混提，本次不执行 git commit。
