# DESIGN-SYSTEM-AUTOMATION-STANDARD — 设计系统自动化规范

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S24` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01` |
| 生效日期 | `2026-11-14` |
| 适用范围 | UTER Design System 5.0 的 Token / 组件 / 页面 / 规范一致性 / 自动化执行五组检查，CI 门禁与本地只读门禁脚本；PC Web / H5 |
| 验证状态 | `NOT_VERIFIED`（本轮仅撰写规范，未新增 / 未运行任何 Validator） |

---

## 1. 门禁铁律（最高优先级，任何检查不得违反）

| # | 铁律 | 具体约束 | 依据 |
|---|---|---|---|
| G1 | **不得通过忽略规则制造 PASS** | 不得新增 `@ts-ignore` / `eslint-disable` / 检查脚本的 `--skip` / 注释禁用规则来让检查通过 | `UDS5-AUDIT-01` §13 第 4 条、§11.1 第 5 条 |
| G2 | **不得通过降低阈值制造 PASS** | 不得调低对比度阈值、放宽正则、扩大白名单、放宽 `--strict` 判定条件 | 同上 |
| G3 | **不得通过删除测试制造 PASS** | 不得删除 / 跳过 / 注释掉既有守卫测试、单测、E2E spec 来让门禁转绿 | `UDS5-AUDIT-01` §13 第 4 条 |
| G4 | **`ALLOWLIST` 保持空** | `ALLOWLIST=[]`，不得因新违规追加条目；既有例外（如 E28）走独立登记，不进 ALLOWLIST | §11.1 第 5 条、§3.1 E28 |
| G5 | **baseline 0 条，只减不增** | `web/design-tokens.baseline.json` 当前 **0 条**；CI 用 `--strict`；任何 `--write-baseline` 扩基线均禁止 | §4.4、§19.5「基线只减不增」 |
| G6 | **`--strict` 为 CI 唯一阻断模式** | 门禁结论以 `--strict` EXIT 码为准；非 strict 模式结果不得当作验收 PASS | §11.1 第 5 条 |
| G7 | **失败必须如实输出，不得伪装** | 未执行项标 `NOT_EXECUTED` / `NOT_VERIFIED`，不得写成 PASS | §1 / §14 |

> 违反 G1–G3 中任一条获得的 PASS 一律无效，须回退并按根因修复；本规范所有「5.0 补充」只增检查、不放宽判定。

---

## 2. 统一失败输出格式

所有 Validator 的失败输出必须包含可定位字段，禁止只打印「FAIL」而无上下文。统一模板：

```
[UDS5-<组号>-<规则号>][<LEVEL>] <file>:<line>:<col> — <检查项中文名>
  actual   : <实际值 / 违规片段>
  expected : <规范期望值 / 规则>
  rule     : <UDS5-S24 条款号>
  fix      : <修复建议一句话>
```

| 字段 | 说明 |
|---|---|
| `组号` | `T`=Token、`C`=组件、`P`=页面、`S`=规范一致性、`V`=自动化执行 |
| `规则号` | 各检查项稳定编号（见 §3–§6 每行 `检查项` 后的方括号编号） |
| `LEVEL` | `BLOCK`（阻断合并）/ `WARN`（记录但不阻断，须有人工复核）/ `INFO` |
| `file:line:col` | 违规位置，必须可点击定位；无行号时写文件路径 + 原因 |
| `actual` / `expected` | 实际与期望，便于自动比对 |
| `fix` | 指向本规范对应「修复建议」列 |

> 各检查项 `失败输出格式` 列给出该行的 `[组号-规则号]` 与关键 `actual` / `expected` 字段；完整模板以上述为准。

---

## 3. 第一组：Token 检查（8 项）

| 检查项 | 现有实现 | 5.0 补充 | 失败输出格式 | 修复建议 |
|---|---|---|---|---|
| `[T01]` 重复定义 | `check-design-tokens.mjs --strict`：design-system 14 个 CSS 跨文件重复定义 **0**；同文件内多次定义 60 个均为分档覆盖（spacing 3 档、typography `simple-large`、brand Light/Dark、elevation Light/Dark），属设计意图 | 增加「非分档场景的重复」区分，避免把合法分档误报 | `[UDS5-T01][BLOCK] file:line — Token 重复定义`；`actual=同名变量第 2 处`，`expected=跨文件唯一；分档覆盖须落在允许清单` | 合并到唯一声明处；`theme.css` / `theme-presets.css` 52 个同名键按「单一 `:root` 基础层 + 预设只列差异键」重构 |
| `[T02]` 缺失（引用未定义） | `check-design-tokens.mjs --strict` 违规 0；`var(--x, fallback)` 兜底掩盖了 3 个纯别名在构建产物中消失的问题 | 增加「`var()` 引用必须有对应 `@theme` / `:root` 声明」校验，根治 3 个纯别名（`--ds-color-text-primary` / `--ds-color-text-secondary` / `--ds-color-success-soft`） | `[UDS5-T02][BLOCK] file:line — 引用未定义 Token`；`actual=var(--ds-color-xxx, fallback)`，`expected=存在声明` | 定位压缩器根因，移除临时兜底双轨；不得永久保留别名 + fallback 双轨 |
| `[T03]` 未使用（零静态引用） | 严格口径下约 **93 个变量零静态引用**（`primitives.css:33-68` 的 25 个最明确，另含约 33 个 `--ds-color-*`、9 个 `--ds-radius-*`）；该数字是**候选清理上限，非死代码结论** | 增加「未使用候选」扫描，但输出 `INFO` 而非 `BLOCK`；删除前须按 §11 流程逐项验证构建产物 | `[UDS5-T03][INFO] file:line — Token 零静态引用候选`；`actual=0 命中`，`expected=候选，需人工验证` | 不直接删除；`@theme` 变量由 `text-sm` 等工具类间接消费、语义色由 `bg-success-soft` 等 Tailwind 类消费，均不出现 `var()`，逐项核实后再处置 |
| `[T04]` 未登记（不在 Manifest） | §28 TOKEN-MANIFEST（`version 3.0.1`）+ `sync-design-showcase.mjs --check` 17 PASS / 0 FAIL；`generate-design-tokens.mjs --check` EXIT=0 | 5.0 补「Token 元数据注册表 + 校验器」（决策 D6：不新建第二套 TS 值 Token） | `[UDS5-T04][BLOCK] file:line — Token 未登记到 Manifest`；`actual=定义存在但 Manifest 无条目`，`expected=Manifest 有条目且哈希自洽` | 把定义登记进 5.0 Manifest 并同步内联快照与 17 条校验契约 |
| `[T05]` 硬编码颜色 | `check-design-tokens.mjs --strict` 扫描 1,275 文件，违规 **0**；T8 唯一裸色值所有者 `brand-colors.ts`；T13–T15 禁止用透明度凑层级 | 页面级硬编码颜色扫描（配合第三组 P03），保持阈值不降低 | `[UDS5-T05][BLOCK] file:line — 硬编码颜色`；`actual=#RRGGBB / rgb() / text-[#xxx]`，`expected=使用 --ds-color-* Token` | 替换为语义色 Token；确需新增裸色值只能落在 `brand-colors.ts` 单一出口 |
| `[T06]` 硬编码间距 | `check-design-tokens.mjs --strict` 违规 0；4pt 间距、3 档密度覆盖 | 页面级任意间距值扫描；保留 `@theme --text-*` 机制（决策 D1，不删除） | `[UDS5-T06][BLOCK] file:line — 硬编码间距`；`actual=p-[13px] / gap-[7px]`，`expected=4pt 刻度 Token` | 替换为间距 Token 或合法 Tailwind 刻度类；禁止任意 `text-[15px]` |
| `[T07]` 硬编码圆角 | `check-design-tokens.mjs --strict` 违规 0；圆角八档 | 页面级任意圆角值扫描 | `[UDS5-T07][BLOCK] file:line — 硬编码圆角`；`actual=rounded-[10px]`，`expected=圆角八档 Token（xs→4xl，6/8/10/12/14/16/18/20px）` | 替换为八档圆角 Token |
| `[T08]` 主题 Token 缺失（Light/Dark 不成对） | `generated/brand.css` Light 8 + Dark 8、`elevation.css` 2 档 Dark 覆盖；`verify-contrast.mjs` 31 PASS / 0 FAIL（含 E28 渐变锚定与负例拒绝） | 5.0 补「Light/Dark 变量成对校验器」（关联 `UDS5-S21` §4.4、`UDS5-S23` §3.6） | `[UDS5-T08][BLOCK] file:line — 主题 Token 不成对`；`actual=Light 有 / Dark 无`，`expected=成对；品牌渐变深浅同值为登记例外` | 补齐成对声明；E28 例外维持登记，不进 ALLOWLIST |

---

## 4. 第二组：组件检查（8 项）

| 检查项 | 现有实现 | 5.0 补充 | 失败输出格式 | 修复建议 |
|---|---|---|---|---|
| `[C01]` 未登记组件 | `check-component-registry.mjs`（`components:registry:check`）：`registered=65 / discovered=65 / errors=0`；`ui/*.tsx` 66 个（65 实现 + 1 测试） | 页面级「使用组件必须已登记」扫描（配合 P01） | `[UDS5-C01][BLOCK] file:line — 组件未登记`；`actual=发现实现但 registry 无条目`，`expected=registered=discovered` | 登记到 `component-registry.json`；`dropdown-menu.test.tsx` 平铺差异是 schema 显式排除（`:40`），**不是漏注册，禁止补注册** |
| `[C02]` 重复实现 | 审计记录 `EmptyState` 恰好同名 **3 处**：`components/empty-state.tsx:42`（正式）、`notification-popover.tsx:156`（局部）、`features/pricing/components/empty-state.tsx:29`（feature 内）；另有 4 个近似命名 | 增加同名 / 近似命名扫描（`WARN`→人工确认后 `BLOCK`） | `[UDS5-C02][WARN] file:line — 组件重复实现`；`actual=3 处同名 EmptyState`，`expected=单一实现根` | 合并到 `components/empty-state.tsx`，记录 feature 侧能力缺口；不删除业务代码前先写回归测试 |
| `[C03]` API 不一致 | registry `contract` 含 `states / accessibility / responsive / tokens / evidence`，但顶层 `states / variants / accessibility` 等 8 类字段缺失；`--strict` EXIT=1 | 增「Props / variant 与 `cva()` 及真实导出一致」校验；补顶层字段 | `[UDS5-C03][BLOCK] file:line — 组件 API 与实现不一致`；`actual=registry.variants 缺失 / cva 变体数不符`，`expected=一致` | 由组件 API 规范（`UDS5-S15`）生成 Props / variant 真值，禁止在 registry 手写第二份 |
| `[C04]` 缺状态 | 65 组件 contract 内有 `states`，但缺顶层 `states`；`ui/button.tsx` 内置 `loading`；八态未登记证据 | 强制 default / hover / focus / pressed / disabled / loading / error / success 八态登记 | `[UDS5-C04][BLOCK] file:line — 组件状态不齐`；`actual=缺 error/success 等 N 态`，`expected=8 态齐备且有证据` | 补齐组件八态并登记证据到展示中心（关联 `UDS5-S23` §3.3） |
| `[C05]` 缺测试 | 65 组件 `VERIFIED 0` / `PARTIAL 9` / `NOT_VERIFIED 56`；`--strict` **EXIT=1**；288 个 `*.test.ts(x)` / 75 个 `__tests__` | 组件级「测试路径存在且结果可追溯」校验 | `[UDS5-C05][BLOCK] file:line — 组件缺测试证据`；`actual=evidence.tests[] 为空 / NOT_VERIFIED`，`expected=存在且 VERIFIED` | 按「每处改动先写回归测试」补测试；不得删除测试制造 PASS（G3） |
| `[C06]` 缺文档 | 全仓组件 README 仅 `web/src/components/data-table/README.md` **1 份**；registry 缺 `specification_path / story_path` | 组件级「规范文档 + 展示单元 + 使用示例」存在性校验 | `[UDS5-C06][BLOCK] file:line — 组件缺文档`；`actual=无 specification_path / 无展示单元`，`expected=分册 + 展示锚点 + 示例齐备` | 按 `UDS5-S23` 补齐左效果右规范、Props、示例；文档必须存在且非空（配合 S05） |
| `[C07]` 缺 a11y | 组件级无障碍要求 **0 处**（展示中心）；`foundations/accessibility.css`、10 个守卫测试、`verify-contrast.mjs` 31 条、`test:axe` 2 spec 存在但未落到组件级 | 组件级 a11y 字段（键盘 / 焦点 / ARIA / Reduce Motion / 对比度）登记与校验 | `[UDS5-C07][BLOCK] file:line — 组件缺 a11y 要求`；`actual=accessibility 顶层字段缺失`，`expected=齐备且有对比度证据` | 登记 E24 待修（3.76:1 / 3.30:1）与 E28 例外；`aria-expanded` / `aria-selected` 与视觉状态一致 |
| `[C08]` 废弃组件仍被使用 | registry 无 `deprecated / replacement` 字段；`UDS5-AUDIT-01` §11.4 列出待废弃项（不删除） | 增「删组件检查引用」与「废弃仍用」校验（关联 `UDS5-S28`、`UDS5-S23` §4 A4） | `[UDS5-C08][BLOCK] file:line — 废弃组件仍被引用`；`actual=引用数 N`，`expected=0 且有 replacement 映射` | 先补 `replacement` 迁移映射并确认无依赖再废弃；删除前置条件见 `UDS5-S27` |

---

## 5. 第三组：页面检查（7 项）

| 检查项 | 现有实现 | 5.0 补充 | 失败输出格式 | 修复建议 |
|---|---|---|---|---|
| `[P01]` 使用未登记组件 | 无页面级扫描；`components:registry:check` 只校验注册表自洽 | 页面级「使用组件必须已登记 + 有 `UTER-CMP-*` ID」扫描（73 个路由源码 / 30 个 feature） | `[UDS5-P01][BLOCK] file:line — 页面使用未登记组件`；`actual=import 未在 registry`，`expected=已登记` | 复用已登记基础组件；`ui/button.tsx` 已覆盖 ≥10 个按钮名称，不按名称新建 |
| `[P02]` 绕过基础组件自绘 | 无 | 自绘 UI 检测（重复实现卡片 / 表格 / 弹层等） | `[UDS5-P02][BLOCK] file:line — 绕过基础组件自绘`；`actual=自绘等价 UI`，`expected=使用 ui/*.tsx 或 data-table/` | 替换为 `ui/*.tsx` 65 实现、`data-table/` 唯一表格封装；合并 3 处同名 `EmptyState` |
| `[P03]` 硬编码设计值 | `check-design-tokens.mjs --strict`（违规 0）为全局扫描 | 页面级颜色 / 间距 / 圆角 / 字号硬编码扫描（与 T05–T07 联动，不降低阈值） | `[UDS5-P03][BLOCK] file:line — 页面硬编码设计值`；`actual=字面值`，`expected=Token` | 走 5.0 Token；分区标题 22/600/30、卡片标题 18/600/26 等口径统一 |
| `[P04]` 缺响应式 | 3.0 §16 五档断点（640/768/1024/1280/1536）；H5 为同代码响应式分支；mobile 390×844 22 张基线 | 页面级五档断点与 H5 命中区（24px 最小 / 44px 推荐）覆盖检查；动态段 `*/$section` 纳入 | `[UDS5-P04][BLOCK] file:line — 页面缺响应式`；`actual=无断点处理 / 命中区不足`，`expected=五档 + 命中区达标` | 补断点样式；H5 输入 ≥16px；`system-settings/*` 18 路由与动态段优先补齐 |
| `[P05]` 缺加载态 | 组件有 `spinner.tsx` / `skeleton.tsx` / `progress.tsx` / `loading-state.tsx`；无页面级三态检查 | 页面加载态存在性检查（含 Skeleton 动效与 Reduce Motion） | `[UDS5-P05][BLOCK] file:line — 页面缺加载态`；`actual=无 loading 分支`，`expected=加载态齐备` | 复用 `loading-state.tsx` / `skeleton.tsx`；不得用空白代替 |
| `[P06]` 缺错误态 | `ui/alert.tsx` / `error-state.tsx` / `sonner` / `handleServerError` 存在；无页面级检查 | 页面错误态（可恢复 / 不可恢复）存在性与就近展示检查 | `[UDS5-P06][BLOCK] file:line — 页面缺错误态`；`actual=无 error 分支`，`expected=错误态齐备且反馈分类正确` | 复用 `error-state.tsx` 与五类通知；错误来自后端 API 契约，不改契约 |
| `[P07]` 缺空态 | 3 处同名 `EmptyState` 重复实现；无页面级检查 | 页面空态存在性 + 唯一封装检查 | `[UDS5-P07][BLOCK] file:line — 页面缺空态 / 使用重复实现`；`actual=无空态 / 引用局部 EmptyState`，`expected=使用 components/empty-state.tsx` | 合并 3 处同名实现到唯一正式封装；记录 feature 侧能力缺口 |

---

## 6. 第四组：规范一致性（8 项）

| 检查项 | 现有实现 | 5.0 补充 | 失败输出格式 | 修复建议 |
|---|---|---|---|---|
| `[S01]` 文档 ID 唯一 | 无自动校验；5.0 采用 `UDS5-S01`..`UDS5-S28` 编号体系，上级规范 `UDS5-S01` | 全量扫描分册元数据表 `文档 ID`，校验唯一性、格式、与文件名一一对应 | `[UDS5-S01][BLOCK] file:line — 文档 ID 重复 / 格式非法`；`actual=重复 ID 或非法格式`，`expected=唯一且符合 UDS5-Sxx` | 按 ID 体系重新分配；文件名与 ID 一一对应 |
| `[S02]` 组件 ID 唯一 | `UTER-CMP` 注册 ID **0 处**（`UDS5-S23` §2.2） | 校验 `UTER-CMP-*` 全局唯一、作为「规范 ↔ 代码 ↔ 展示 ↔ 测试」主键 | `[UDS5-S02][BLOCK] file:line — 组件 ID 重复`；`actual=重复 UTER-CMP-*`，`expected=全局唯一` | 按 `UDS5-S23` §3.11 编号规则分配 |
| `[S03]` 注册格式 | `component-registry.json`：`registryVersion 1.0.0`，顶层仅 `id,name,file,category,status,contract`；`designSystem "UTER Design System 3.0"` | 校验补齐后的字段集合与 `designSystem` 值；`designSystem` 升级 5.0 须与 `check-component-registry.mjs:45` 硬编码校验**同变更内**完成 | `[UDS5-S03][BLOCK] file:line — 注册格式不符`；`actual=缺字段 / designSystem 仍为 3.0`，`expected=字段齐备且版本一致` | 按 `UDS5-S27` 版本统一节同步升级两处，否则门禁失败 |
| `[S04]` 引用路径有效 | 无 | 校验所有 `specification_path / implementation_path / test_path / story_path` 指向真实路径（禁止虚构路径、脚本、测试结果） | `[UDS5-S04][BLOCK] file:line — 引用路径无效`；`actual=路径不存在`，`expected=真实存在` | 修正为真实路径；不得写入 `showcase-3.0.html` 等不存在文件 |
| `[S05]` 文档存在且非空 | 无 | 校验每份 `UDS5-Sxx` 文档存在且**至少 100 行 / 非空**，含必备章节（与其他规范的关系 / 代码实施位置 / 自动化验证 / 验证状态） | `[UDS5-S05][BLOCK] file:line — 文档缺失 / 过短 / 缺必备章节`；`actual=0 行或 <100 行`，`expected=存在且 ≥100 行` | 补齐文档；禁止空文件 |
| `[S06]` 代码存在 | `components:registry:check` 校验 `file` 字段与文件系统一致（65/65/0 errors） | 校验所有实现路径真实存在；`file` 正则不含点号、`:40` 显式排除测试文件 | `[UDS5-S06][BLOCK] file:line — 代码文件不存在`；`actual=file 指向不存在的 .tsx`，`expected=存在` | 修正路径；`dropdown-menu.test.tsx` 差异属显式排除，不补注册 |
| `[S07]` 测试存在 | `test`（`vitest run`）、`test:visual`、`test:axe` / `test:business:e2e` / `test:visual:e2e`（后三者未接 CI） | 校验 `evidence.tests[]` 指向的测试文件存在；未接 CI 轨道标 `NOT_VERIFIED` 但不得删除 | `[UDS5-S07][BLOCK] file:line — 测试文件不存在`；`actual=evidence.tests 指向缺失`，`expected=存在` | 补建测试或修正路径；不得删测试制造 PASS（G3） |
| `[S08]` 依赖有效 | `web/package.json` 声明依赖；`bun.lock` 锁定；全仓 `storybook` / Clerk 相关依赖命中 0 | 校验规范中引用的脚本 / 依赖在 `package.json` 真实存在；不引入 Clerk SDK / Storybook（决策 D3 / D8） | `[UDS5-S08][BLOCK] file:line — 引用了不存在的脚本 / 依赖`；`actual=引用虚构脚本名`，`expected=真实存在且未引入禁用依赖` | 修正为真实脚本名；禁用依赖一律 `Reject` |

---

## 7. 第五组：自动化执行（8 类 Validator）

| Validator | 职责 | 映射真实脚本 / 命令 | 触发时机 | 阻断级别 | 当前状态 |
|---|---|---|---|---|---|
| `V1 TokenValidator` | 执行 T01–T08：`check-design-tokens.mjs --strict`、`generate-design-tokens.mjs --check`、`sync-design-showcase.mjs --check` | `lint:design:strict` / `design:tokens:check` / `design:showcase:check` | 本地 + CI frontend job | `BLOCK` | 既有脚本存在；5.0 补充规则 `NOT_VERIFIED` |
| `V2 ComponentValidator` | 执行 C01–C08：`check-component-registry.mjs` 与 `--strict` | `components:registry:check`（已接 CI）/ `components:registry:strict`（**未接 CI**） | 本地 + CI（非 strict） | `BLOCK` | `--strict` EXIT=1，`NOT_VERIFIED` |
| `V3 PageValidator` | 执行 P01–P07：页面级未登记组件 / 自绘 / 硬编码 / 响应式 / 三态扫描 | 无现成脚本，为 5.0 新增 | 本地 + CI（拟） | `BLOCK` | 未建立 `NOT_VERIFIED` |
| `V4 SpecConsistencyValidator` | 执行 S01–S08：文档 ID / 组件 ID / 注册格式 / 路径 / 文档非空 / 代码 / 测试 / 依赖 | `check-design-system-5.0.mjs`（**本轮新增**，`design:5:check` 已接 CI frontend job），覆盖文档 ID / 组件 ID / 注册格式 / 路径 / 文档非空 / Token 跨文件重复 / `@theme` 字号唯一来源 / Primitive→Semantic 单向 / Light-Dark 品牌变量成对 / 显式已知缺口登记；S04 测试路径 / S05 依赖仍为规划 | 本地 + CI（design:5:check） | `BLOCK` | 部分实现；strict 模式将 gap 升级为失败 `NOT_VERIFIED` |
| `V5 ContrastA11yValidator` | 对比度、WCAG 2.2 AA、E24 / E28 登记 | `verify-contrast.mjs`（`verify:contrast`，已接 CI）、`test:axe`（**未接 CI**） | 本地 + CI（部分） | `BLOCK`/`WARN` | 31 PASS / 0 FAIL；5.0 组件级 `NOT_VERIFIED` |
| `V6 ShowcaseAnchorValidator` | 展示中心 24 区锚点、内联快照一致、Props / ID / 示例一致、禁用静态截图冒充 | `sync-design-showcase.mjs --check`、`add-showcase-anchors.mjs` | 本地 + CI（`design:showcase:check`） | `BLOCK` | 17 PASS / 0 FAIL；23/24 区锚点缺失 `NOT_VERIFIED` |
| `V7 VisualRegressionValidator` | 视觉回归、Light/Dark 双主题、22 页 × 2 视口 44 张 PNG | `visual-regression.mjs`（`test:visual`，已接 CI）、`test:visual:e2e`（**未接 CI**） | 本地 + CI（部分） | `BLOCK` | 部分覆盖，`NOT_VERIFIED` |
| `V8 GateOrchestrator` | 汇总 V1–V7 EXIT 码，强制 `--strict` 为唯一阻断口径；执行 G1–G7 铁律；输出统一失败格式（§2）；区分 `NOT_EXECUTED` / `NOT_VERIFIED` | CI `frontend` job（`:356-438`）编排 | CI | `BLOCK` | 既有编排存在；5.0 汇总口径 `NOT_VERIFIED` |

> 8 类 Validator 与 5 组检查的覆盖关系：V1→第一组，V2→第二组，V3→第三组，V4→第四组，V5/V6/V7 跨组提供证据，V8 统一编排。**本轮新增了 V4 的部分真实实现（`check-design-system-5.0.mjs` + `design:5:check` 已接 CI frontend job）**；V3 / V4 其余子项仍为规划项；全部 5.0 补充项状态 `NOT_VERIFIED`。

---

## 8. 真实脚本清单（不得虚构）

| 脚本 | npm script（`web/package.json`） | 用途 | CI 接入 |
|---|---|---|---|
| `web/scripts/check-design-tokens.mjs` | `lint:design` / `lint:design:strict` / `lint:design:baseline` / `lint:design:baseline:update` | Token T1–T17 门禁 | `lint:design:strict`（:417）已接 |
| `web/scripts/generate-design-tokens.mjs` | `design:tokens:generate` / `design:tokens:check` | DTCG 源与生成 CSS 同步 | `design:tokens:check`（:406）已接 |
| `web/scripts/sync-design-showcase.mjs` | `design:showcase:check` | 内联快照与 Manifest 逐值一致（17 条） | `design:showcase:check`（:411）已接 |
| `web/scripts/verify-contrast.mjs` | `verify:contrast` | 31 条对比度 / 渐变锚定 | `verify:contrast`（:414）已接 |
| `web/scripts/check-component-registry.mjs` | `components:registry:check` / `components:registry:strict` | 组件注册双向一致性 | `check`（:427）已接；`strict` 未接 |
| `web/scripts/visual-regression.mjs` | `test:visual` / `test:visual:update` | 视觉布局 / 键盘 / a11y 审计 | `test:visual`（:422）已接 |
| `web/scripts/add-showcase-anchors.mjs` | 无直接 npm script（被展示链调用） | 22 条区域锚点（漏 23/24 区） | 未接 |
| `web/scripts/generate-design-showcase.mjs` | 无直接 npm script | 展示生成；含 2 个不存在文件的过时注释 | 未接 |
| `web/scripts/add-copyright.mjs` | `copyright:check` / `copyright` | AGPL 版权头检查（只补不破坏格式） | `copyright:check`（:434）已接 |
| `web/scripts/format-with-protected-headers.mjs` | `format:check` / `format` | 格式检查 | `format:check` **刻意未接**（:429-433，248 文件不合规） |
| `web/scripts/check-i18n-keys.mjs` | `i18n:check`（被 `lint` 调用） | i18n 键一致性 | 经 `lint`（:393）已接 |
| `web/scripts/sync-i18n.mjs` | `i18n:sync` | i18n 同步 | 未接 |
| `web/e2e/axe/playwright.config.ts` | `test:axe` | axe a11y E2E（2 spec） | **未接** |
| `web/e2e/business/playwright.config.ts` | `test:business:e2e` | 业务 E2E（1 spec） | **未接** |
| `web/e2e/visual/playwright.config.ts` | `test:visual:e2e` 及 `update` / `auth` 变体 | 视觉 E2E（3 spec + 44 张 PNG） | **未接** |
| `knip` | `knip` | 未使用依赖 / 导出扫描 | 未接 |

---

## 9. CI 已接 / 未接清单（依据 `ci.yml` frontend job `:356-438`）

| 类别 | 命令 | ci.yml 行 | 说明 |
|---|---|---|---|
| 已接 | `typecheck` | :387 | `tsgo -b` |
| 已接 | `test` | :390 | `vitest run` |
| 已接 | `lint` | :393 | `check-i18n-keys.mjs` + `oxlint` |
| 已接 | `design:tokens:check` | :406 | DTCG 源与生成 CSS 同步 |
| 已接 | `design:showcase:check` | :411 | 内联快照数据链 |
| 已接 | `verify:contrast` | :414 | 对比度 31 条 |
| 已接 | `lint:design:strict` | :417 | Token 严格门禁 |
| 已接 | `test:visual` | :422 | 视觉 / 键盘 / a11y 审计 |
| 已接 | `components:registry:check` | :427 | 组件注册（非 strict） |
| 已接 | `copyright:check` | :434 | 版权头 |
| 已接 | `build:check` | :438 | 生产构建 |
| **未接** | `test:axe` | — | 刻意不设为必需（像素基线依赖本机字体 / GPU） |
| **未接** | `test:business:e2e` | — | 刻意不设为必需（需完整服务栈） |
| **未接** | `test:visual:e2e` | — | 刻意不设为必需 |
| **未接** | `components:registry:strict` | — | 刻意不设为必需；当前 `--strict` EXIT=1（65 组件 0 VERIFIED） |
| **未接** | `format:check` | :429-433 | 明文「不要设为必需」：递归 oxfmt 会格式化第三方插件与根级配置，当前 248 文件不合规 |
| 未接 | `knip` / `i18n:sync` | — | 未纳入 frontend job |

> `release-gate.yml:153-188` 仅含 `typecheck / test / lint / lint:design:strict` 子集。`web/e2e/{axe,business,visual}/playwright.config.ts` 注释均明确「刻意不接 CI」，故 `test:axe` / `test:business:e2e` / `test:visual:e2e` 三条轨只能开发机手动执行，不构成 CI 强制门禁；相关验收项状态为 `NOT_VERIFIED`，不得写成 PASS。

---

## 10. 只读门禁实测基线（复述 `UDS5-AUDIT-01`，非本轮执行结果）

| 命令 | 实测结果 |
|---|---|
| `node web/scripts/check-design-tokens.mjs --strict` | 扫描 1,275 文件，违规 **0**，EXIT=0 |
| `node web/scripts/sync-design-showcase.mjs --check` | **17 PASS / 0 FAIL / 0 SKIP**，Manifest `3.0.1` 哈希自洽，EXIT=0 |
| `node web/scripts/verify-contrast.mjs` | **31 PASS / 0 FAIL**，EXIT=0 |
| `node web/scripts/generate-design-tokens.mjs --check` | `Design token source and generated CSS are in sync.`，EXIT=0 |
| `web/design-tokens.baseline.json` | **0 条**，CI 用 `--strict`（基线只减不增） |
| `components:registry:strict` | **EXIT=1**（`VERIFIED 0` / `PARTIAL 9` / `NOT_VERIFIED 56`），未接 CI |

> 上述为 `UDS5-AUDIT-01` §4.4 / §5 的只读门禁实测结论，本轮**未重新运行**，仅作为 5.0 基线与 G5 / G6 的事实依据。存在 211 项并发 WIP，按约定不执行全量构建与 `./uap *` 写状态命令。

---

## 11. 与其他规范的关系

| 规范 ID | 关系 | 说明 |
|---|---|---|
| `UDS5-S01` | 上级 | 服从总纲效力、ID 体系与验证状态口径 |
| `UDS5-AUDIT-01` | 事实依据 | §4.4 / §5 / §7 / §11.1 / §13 / §19.5 提供门禁实测、CI 清单与铁律依据 |
| `UDS5-S21` | 被引用 | 业务红线零改动、Token 两层体系不倒退由页面检查 / Token 检查落地 |
| `UDS5-S22` | 被引用 | 17 个业务模块适配结果作为第三组页面检查的输入；退款 / 订单虚构页拦截 |
| `UDS5-S23` | 被引用 | 展示中心 Props / ID / a11y / 双向关联由 V4 / V6 校验；A1–A5 五场景由 Validator 支撑 |
| `UDS5-S25` | 下游 | 本规范所有检查结论作为验收清单的「验收方法 / 证据要求」；状态口径一致 |
| `UDS5-S27` | 关联 | `component-registry.json` 的 `designSystem` 与 `check-component-registry.mjs:45` 同变更内升级（S03） |
| `UDS5-S28` | 关联 | `deprecated / replacement` 与废弃仍用检查（C08）、注册 status 校验 |

---

## 12. 代码实施位置

| 类别 | 真实路径 | 本文关联 | 本轮状态 |
|---|---|---|---|
| Token / 组件 / 展示 / 对比度脚本 | `web/scripts/check-design-tokens.mjs`、`generate-design-tokens.mjs`、`sync-design-showcase.mjs`、`verify-contrast.mjs`、`check-component-registry.mjs` | §3 / §4 / §8 | 存在，未改造 |
| 锚点 / 展示生成脚本 | `web/scripts/add-showcase-anchors.mjs`、`generate-design-showcase.mjs` | §7 V6 / §8 | 存在，未改造 |
| 视觉 / 版权 / 格式 / i18n 脚本 | `web/scripts/visual-regression.mjs`、`add-copyright.mjs`、`format-with-protected-headers.mjs`、`check-i18n-keys.mjs`、`sync-i18n.mjs` | §8 / §9 | 存在，未改造 |
| E2E 配置 | `web/e2e/{axe,business,visual}/playwright.config.ts` | §8 / §9 | 存在，未改造 |
| 脚本声明 | `web/package.json`（`scripts` 段） | §8 | 存在，未改造 |
| CI 编排 | `.github/workflows/ci.yml:356-438`、`release-gate.yml:153-188` | §9 | 存在，未改造 |
| 基线文件 | `web/design-tokens.baseline.json`（0 条） | §1 G5 / §10 | 存在，未改造 |
| 组件注册 | `web/src/design-system/component-registry.json` | §4 / §6 | 存在，未改造 |
| 规范分册 | `docs/design-system/uter-design-system-5.0/*.md`（`UDS5-S01`..`UDS5-S28`） | §6 S01 / S05 | 撰写中，未全量校验 |

> 本文为自动化规范；**本轮已新增 `check-design-system-5.0.mjs` 并接入 CI（`design:5:check`，覆盖 V4 部分规则）**，V3 / V4 其余子项仍为规划项。属并发 WIP 禁改的文件（12 个，见 `UDS5-AUDIT-01` §1）在对应会话合入前不得触碰。

---

## 13. 自动化验证（本规范自身）

| 项 | 现有实现 | 5.0 补充 | 当前结果 |
|---|---|---|---|
| 五组检查逐条规范（32 项） | 无 | 本文 §3–§6 已列出检查项 / 现有实现 / 5.0 补充 / 失败输出格式 / 修复建议 | 规范文本已撰写，`NOT_VERIFIED` |
| 8 类 Validator | 部分真实脚本存在 | V3 / V4 等新增 Validator | 未建立 `NOT_VERIFIED` |
| 统一失败输出格式 | 无 | §2 模板落地到各脚本 | 未建立 `NOT_VERIFIED` |
| G1–G7 铁律拦截 | 无 | 「忽略规则 / 降阈值 / 删测试制造 PASS」检测 | 未建立 `NOT_VERIFIED` |
| 只读门禁复核 | §10 复述审计实测 | 本轮未重新运行 | `NOT_EXECUTED` |

---

## 14. 验证状态

| 项 | 状态 | 说明 |
|---|---|---|
| 本文五组检查 + 8 类 Validator 规范 | `IMPLEMENTED_NOT_VERIFIED` | 规范文本已撰写，未运行验证 |
| 门禁铁律 G1–G7 / 统一失败格式 | `IMPLEMENTED_NOT_VERIFIED` | 已定义，未由脚本落地 |
| 真实脚本与 CI 已接 / 未接清单 | `IMPLEMENTED` | 依据 `web/package.json` 与 `ci.yml:356-438` 如实登记 |
| `ALLOWLIST=[]` / baseline 0 条只减不增 | `IMPLEMENTED` | 依 §11.1 / §4.4 如实登记，未改动 |
| V3 / V4 等新增 Validator | `NOT_STARTED` | 规划项 |
| Token / 组件 / 页面 / 一致性补充检查 | `NOT_STARTED` | 依赖分期推进 |
| `components:registry:strict` 转 EXIT=0 | `NOT_STARTED` | 当前 EXIT=1，未接 CI |
| PC Web / H5 门禁复核 | `NOT_VERIFIED` | 本轮未重新运行只读门禁 |
| Android / iOS / HarmonyOS | `NOT_VERIFIED` | 无实现，不得用 Web 结果代替 |

**总体验证状态：`NOT_VERIFIED`**。本文不得被解读为 `FULLY_IMPLEMENTED_AND_VERIFIED`；自动化与门禁的最终状态以 `UDS5-S25`（验收规范）与最终验收报告为准。
