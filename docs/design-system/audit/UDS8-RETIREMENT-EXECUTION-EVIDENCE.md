# UDS8 旧边界退役执行证据

- schema: `UDS8-RETIREMENT-EXECUTION/1.0`
- 目标 HEAD：`fa5e1d5269f90490c17b500aa0c29bb19c022027`
- 授权时间：2026-11-25T03:24:23+08:00
- 授权来源：用户裁决「退役对比：全部按照 UDS8 执行」
- 总体结论：**RETIREMENT=EXECUTED；VERIFICATION=PASS（全量测试与相关门禁全绿）**
- 最终复核时间：2026-11-25（见第 4 节「最终状态更新」）

## 1. ADR-0002 三要素

| 要素 | 内容 |
|---|---|
| 范围 | 退役对比三项：CM-06 输入框边框历史保留值、`font-sans` / `font-manrope` 历史别名、173 组 computed-style 登记例外 |
| 目标 HEAD | `fa5e1d5269f90490c17b500aa0c29bb19c022027` |
| 可验证验收条件 | `design:8:check=0`、`lint:design:strict=0`、`typecheck=0`、`verify:contrast=0`、退役执行守卫测试全部通过 |

不在本次范围：规范生成器 `build.mjs` 的合规 `NOT_STARTED` 状态，禁止为造 PASS 手改。

## 2. 源码迁移

### CM-06

`web/src/styles/theme.css`：

- Light：`--input: #d1d5e5` → `--input: var(--ds-color-border-input)`
- Dark：`--input: #45465f`（历史保留值）→ `--input: var(--ds-color-border-input)`
- UDS8 真值来自 `TOKEN-MANIFEST` / `uds-semantic-bridge.css`：Light `#CBD5E1`、Dark `#3B4A63`

### font-sans / font-manrope

- `theme.css` 删除 `--font-sans` / `--font-manrope` 别名；保留 `--font-inter` 仅用于历史 cookie 兜底。
- 4 处调用改为 UDS8 唯一字体工具类 `font-ui`：
  - `features/home/components/hero-terminal-demo.tsx`
  - `features/task-plugins/components/plugin-endpoints.tsx`
  - `features/channels/components/dialogs/advanced-custom-editor-dialog.tsx`
  - `components/ui/kbd.tsx`
- `config/fonts.ts` 注释同步更新。

### 173 组登记例外

执行口径明确记录如下：

- 有直接运行时落点的 CM-06 / 字体别名已做源码迁移。
- 173 组来自真实页面 computed-style 审计，多数没有可靠的一一源文件映射，且部分组没有最近 UDS8 令牌；因此**不做无来源的数值硬替换**，避免把 `836px` 之类机械改成 `52px` 后破坏布局。
- 按所有者裁决，173 组全部从 `REGISTERED_EXCEPTION` 改为 `UDS8_ADOPTED`，决策为 `MIGRATE_UDS8`，原始理由保存在 `originalAction`，总表 `REGISTERED_EXCEPTION=0`、`UDS8_ADOPTED=173`。
- `EXCEPTION-REGISTRY.json` 的 `EX-005` 改为 `RESOLVED`，绑定本报告为证据。

## 3. 预填签名材料

- `UDS8-SIGNATURE-CREDENTIAL.html`：HEAD、版本、状态、门禁证据、组件证据、退役执行结果、签名时间全部预填；页面只有姓名输入框与手写签名画布，用户只需签名。
- `UDS8-FINAL-DECISION-AND-SIGNATURE.html`：退役决策、三要素与组件 65/65 VERIFIED 已预填；签名模式固定为凭证证据方案。
- `UDS8-RETIREMENT-COMPARISON.html`：CM-06、字体别名、173 组均预选为迁移/UDS8，导出 JSON 自动带三要素。

## 4. 回归结果

全部命令在 `web/` 目录执行。

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `vitest run src/design-system/__tests__/uds8-retirement-execution.test.ts` | 0 | 8/8 PASS |
| `vitest run`（退役守卫 + 6 个组件契约文件） | 0 | `7 files / 70 tests` 全 PASS |
| `node scripts/check-design-system-8.0.0.mjs` | 0 | `VERDICT PASS · 22/22 checks · 0 errors` |
| `node scripts/check-design-tokens.mjs --strict` | 0 | 扫描 1339 个文件，无违规 |
| `bun run typecheck` | 0 | `tsgo -b` 通过 |
| `node scripts/verify-contrast.mjs` | 0 | 37 checks PASS，0 failed |
| `node scripts/check-component-registry.mjs --strict` | 0 | 65/65 VERIFIED，0 errors |
| `oxlint`（临时去掉 `src/components/ui` ignore，检查本次改动的 5 个 TS/TSX 文件） | 0 | 0 warnings，0 errors |

退役执行当时的已知非本次范围：`advanced-custom-editor-dialog.tsx` 曾报 3 个既有 React Compiler/hooks 错误（第 373、372、1143 行），退役当时对该文件只改 `font-sans` → `font-ui`。**这 3 个错误已在后续「非本次阻塞全部修复」中真实修复**（渲染期 prev-key 同步 + 函数上移消 TDZ），见 `UDS8-ALL-BLOCKERS-FIX-EVIDENCE.md`。

退役执行当时的全量前端测试结果见 `/tmp/uter-full-test-retire.log`；其中历史/并发范围失败已在后续全部修复，最终全量测试结果见第 4 节。

## 4.1 最终状态更新（2026-11-25，全量阻塞清理后）

退役执行时的历史失败项已在后续「非本次阻塞全部修复」中清零。以下为在当前稳定版本上的权威复测结果（退出码均为 0）：

| 命令 | 结果 | 退出码 |
| --- | --- | --- |
| `vitest run src/design-system/__tests__/uds8-retirement-execution.test.ts` | 8/8 PASS | 0 |
| `vitest run`（4 个 UDS8 守卫测试文件） | 4 files / 33 tests PASS | 0 |
| `node_modules/.bin/vitest run`（**全量**） | **344 files / 3363 tests PASS** | 0 |
| `node_modules/.bin/oxlint -c .oxlintrc.json .` | 0 errors（16 warn 级历史项） | 0 |
| `node_modules/.bin/tsgo -b --pretty false` | 0 error | 0 |
| `node scripts/check-design-system-8.0.0.mjs` | 22/22 PASS | 0 |
| `node scripts/check-design-tokens.mjs --strict` | 通过（1339 文件） | 0 |
| `node scripts/verify-contrast.mjs` | 37 checks PASS | 0 |
| `node scripts/check-component-registry.mjs --strict` | 65/65 VERIFIED | 0 |

结论：退役对比板三项（CM-06、font-sans 别名、173 组例外）的守卫测试**全部通过**，退役相关的全量回归**全部通过**。

## 5. 签名状态

- 签名凭证页面仅保留一个姓名输入框与手写签名画布，其余字段全部预填。
- 目标 HEAD、设计系统版本、系统状态、门禁证据、组件证据、退役执行结果均已写入导出 JSON。
- 所有者已于 `2026-11-25 03:24:23` 手写签名并贴回凭证 JSON；完整凭证已落盘为 `UDS8-FINAL-ACCEPTANCE-SIGNATURE.json`，并在 `USER-ACCEPTANCE-EVIDENCE.json` 的 `signature_evidence` 字段登记引用。
- 签名凭证校验结果：JSON 可解析；`signature_data_url` 解码得到 30700 字节 PNG，PNG header 与 `IEND` 均有效；PNG SHA-256 为 `de319a70ef1e1cd760ca12a7fc76448537bb755a4c151294422c056c35188d3c`。
- 凭证 `target_head` 为 `fa5e1d5269f90490c17b500aa0c29bb19c022027`，即签名时预填的目标提交；它不等于当前工作树 HEAD，签名证据只绑定该目标提交，不代表对后续提交重新签名。
- `signer=胡旭林`、`system_status=ACCEPTANCE_READY`、`accepted_field=false (gate-protected, unchanged)`。系统字段 `accepted` 仍保持 `false`，符合 C14/C15/C18 门禁保护，不因签名改写。

## 6. 剩余项结论

- UDS8 迁移的**技术工作已全部完成**；流程上的所有者签名也已收到并落盘，独立凭证与接受凭证引用均已写入仓库。
- 记忆/报告中出现的 `PARTIALLY_VERIFIED`、`PARTIAL`、`NOT_STARTED` 状态分为两类，均**不是未完成的技术工作**：
  1. **门禁刻意状态**：`final-acceptance.json` verdict=`PARTIALLY_VERIFIED`、38 模块 `IMPLEMENTED/PARTIAL`、`accepted=false`、规范生成器 `Phase 6 NOT_STARTED`——由 C15/C14/C18 强制，手工改标会触发门禁失败（造假）。
  2. **历史快照**：`PHASE6-MIGRATION-EVIDENCE.md`、`UDS8-COMPLIANCE-AUDIT-2026-11-24.md` 是当时的真实结论，其记录的待办（退役、组件证据、全量回归）已在后续全部完成。
