# DESIGN-SYSTEM-ACCEPTANCE-STANDARD — 设计系统验收规范

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S25` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01` |
| 生效日期 | `2026-11-14` |
| 适用范围 | UTER Design System 5.0 全部规范、Token、组件、页面、工程、平台的验收活动与最终结论判定；PC Web / H5 / Android / iOS / HarmonyOS |
| 验证状态 | `NOT_VERIFIED`（本轮仅撰写规范，未执行任何验收活动） |

---

## 1. 八状态定义与状态机

### 1.1 八状态定义（全局唯一口径）

| 状态 | 含义 | 进入条件 | 退出条件 / 下一态 | 允许对外宣布 |
|---|---|---|---|---|
| `NOT_STARTED` | 尚未开始，无任何交付物 | 初始态 | 交付物开始产出 → `IN_PROGRESS` | 无 |
| `IN_PROGRESS` | 正在实现 / 撰写 / 改造中 | 有进行中的工作 | 交付物完成 → `IMPLEMENTED`；失败 → `FAILED` | 进度 |
| `IMPLEMENTED` | 交付物已产出（代码 / 文档 / 配置），但未执行验证 | 实现完成 | 执行验证 → `IMPLEMENTED_NOT_VERIFIED` 或 `PARTIALLY_VERIFIED` 或 `VERIFIED` | 仅「已实现」 |
| `IMPLEMENTED_NOT_VERIFIED` | 已实现，但**未运行**任何验证命令（区别于「跑了没过」） | 实现完成且验证未执行 | 运行验证 → `PARTIALLY_VERIFIED` / `VERIFIED` / `FAILED` | 仅「已实现，未验证」 |
| `PARTIALLY_VERIFIED` | 部分验证通过，仍有未通过 / 未执行项 | 部分证据齐备 | 剩余项完成 → `VERIFIED`；发现缺陷 → `FAILED` | 「部分验证」，不得宣称全通过 |
| `VERIFIED` | 单项 / 单组验收的**全部**证据齐备且通过 | 该项验收方法与证据要求全部满足 | 汇总所有项 → `FULLY_VERIFIED` | 该项「已验证」 |
| `FAILED` | 验证未通过或发现阻断缺陷 | 出现 FAIL / EXIT≠0 / 红线越界 | 修复后重跑 → 回到 `PARTIALLY_VERIFIED` / `VERIFIED` | 仅「失败」，须列未通过项 |
| `FULLY_VERIFIED` | 全部验收项均 `VERIFIED`，且 §2 的 12 个必要条件全部满足 | 12 条件全满足且无 `NOT_VERIFIED` / `FAILED` 残留 | 终态 | 方可宣布 `FULLY_IMPLEMENTED_AND_VERIFIED` |

### 1.2 状态与结论标签的关系

| 项 | 说明 |
|---|---|
| `FULLY_VERIFIED` | 八状态机的最高态，是**状态** |
| `FULLY_IMPLEMENTED_AND_VERIFIED` | PART 13 用语，是对外宣布的**结论标签**；仅当状态为 `FULLY_VERIFIED`（即 12 个必要条件全部满足、无任何 `NOT_VERIFIED` / `NOT_EXECUTED` / `FAILED` 残留）时才可使用 |
| 禁止 | 任一验收项为 `NOT_VERIFIED` / `PARTIALLY_VERIFIED` / `FAILED` / `NOT_EXECUTED` 时，一律**不得**宣布 `FULLY_IMPLEMENTED_AND_VERIFIED`（PART 13「只要有一项未通过就不能宣布」） |
| 3.0 继承 | 3.0 §22 的 **73 个 `- [ ]`、0 个 `- [x]`** 不得被继承为「已完成」；5.0 必须重新逐项给证据 |

### 1.3 状态流转约束

```
NOT_STARTED → IN_PROGRESS → IMPLEMENTED → IMPLEMENTED_NOT_VERIFIED
                                    ↓ (运行验证)
                    PARTIALLY_VERIFIED ⇄ FAILED → (修复) → VERIFIED → FULLY_VERIFIED
```

> 不得跳级：未执行验证不得从 `IMPLEMENTED` 直接标 `VERIFIED`；也不得用「忽略规则 / 降低阈值 / 删除测试」制造 PASS（见 `UDS5-S24` §1 G1–G3）。

---

## 2. `FULLY_IMPLEMENTED_AND_VERIFIED` 的 12 个必要条件

| # | 必要条件 | 验收依据 | 当前可达性 |
|---|---|---|---|
| N1 | `UDS5-S01`..`UDS5-S28` 共 28 份规范文档全部存在、非空、≥100 行、必备章节齐全、文档 ID 唯一且与文件名一一对应 | 第四组 S01 / S05 | **不可达（进行中）**：本轮仅撰写 `UDS5-S21`..`UDS5-S28`，其余分册由并行会话产出，未全量校验 |
| N2 | Token 两层体系完整：无重复 / 缺失 / 未登记 / 硬编码，Light/Dark 成对；E24 对比度缺陷（3.76:1 / 3.30:1）修复，E28 例外登记边界清晰 | 第一组 T01–T08、第二组 E24 | **不可达**：E24 仍为 P1 待修，3 个纯别名构建压缩缺陷未根治 |
| N3 | 65 个 `ui/` 组件全部登记、结构自洽、`--strict` **EXIT=0**、`VERIFIED` 数 = 65 | 第二组 C01 / C05、`components:registry:strict` | **不可达**：当前 `VERIFIED 0` / `PARTIAL 9` / `NOT_VERIFIED 56`，`--strict` EXIT=1 |
| N4 | 组件注册补齐 8 类字段（`layer / source / implementation_path / specification_path / test_path / story_path / variants / states / accessibility / deprecated / replacement`），`UTER-CMP-*` ID 唯一，3 处同名 `EmptyState` 已合并 | 第二组 C02 / C03、第四组 S02 / S03 | **不可达**：8 类字段全缺，`UTER-CMP` 0 处，3 处同名仍在 |
| N5 | 组件展示中心 12 项能力齐备、双向关联 A1–A5 五场景可定位、锚点覆盖 23 / 24 区、Props / 注册 ID / a11y / 示例 / 八态 / 双主题齐备 | `UDS5-S23`、第四组 S04 | **不可达**：现状 Props 0 / 注册 ID 0 / a11y 0 / 示例 0 / 22 锚点漏 2 区 |
| N6 | 73 个路由源码、30 个 feature、17 个业务模块全部完成 5.0 视觉 / 组件 / 交互适配；退款 / 订单保持「无独立页面」事实，无虚构 | `UDS5-S22`、第三组 P01–P02 | **不可达**：页面改造 `NOT_STARTED` |
| N7 | 页面检查 P01–P07 全过：无未登记组件 / 无绕过基础组件 / 无硬编码设计值、五档响应式、加载 / 错误 / 空三态齐备 | 第三组 P01–P07 | **不可达**：Validator V3 未建立 |
| N8 | `system-settings/*` 18 路由、`*/$section` 动态段、`usage-logs/audit`、`oauth/$provider`、`setup`、`chat/$chatId` 补齐 E2E / 视觉基线 | 第五组 / `UDS5-AUDIT-01` §6 | **不可达**：当前仅 22 页有视觉基线，18 路由无 E2E 覆盖 |
| N9 | CI `frontend` job 全部检查以 `--strict` 为唯一阻断口径且 PASS；`ALLOWLIST=[]`、baseline 0 条只减不增 | `UDS5-S24` §1 / §9 | **不可达**：`components:registry:strict` 未接且 EXIT=1 |
| N10 | `test:axe` / `test:business:e2e` / `test:visual:e2e` / `components:registry:strict` / `format:check` 完成并通过（或按事实接入 CI） | `UDS5-S24` §9 | **不可达**：五条轨刻意未接；`format:check` 有 248 文件不合规 |
| N11 | PC Web 与 H5 两平台完成视觉 / a11y / 业务回归并有可执行证据 | 第六组平台验收 | **不可达**：未针对 5.0 重跑，相关轨道未接 CI |
| N12 | **Android / iOS / HarmonyOS 三平台完成原生平台验收** | PART 12.6 / PART 13 | **逻辑不可达（决策 D4）**：三平台无任何实现（全仓 `*.kt / *.swift / *.java / *.m / *.mm` 计数 0），且 PART 12.6 要求标 `NOT_VERIFIED`、PART 13 要求全平台通过方可宣布，二者互斥 |

### 2.1 不可达项结论

| 类别 | 不可达条件 | 原因 |
|---|---|---|
| **逻辑不可达** | N12 | Android / iOS / HarmonyOS 无实现（决策 D4），与 `FULLY_IMPLEMENTED_AND_VERIFIED` 互斥，无法通过任何工程手段在本轮消除 |
| 证据不可达 | N2 / N3 / N4 / N5 / N9 / N10 | 3.0 未闭合项：E24 待修、65 组件 0 VERIFIED、8 类字段缺失、`--strict` EXIT=1、五条轨未接 CI |
| 实施不可达 | N1 / N6 / N7 / N8 / N11 | 5.0 文档与页面改造进行中，Validator V3 / V4 未建立，18 路由无基线 |

> **本轮最终状态必须低于 `FULLY_IMPLEMENTED_AND_VERIFIED`**（`UDS5-AUDIT-01` §14 结论 C）。任何验收报告须逐条列出上述未通过 / 未验证项，不得伪装 PASS。

---

## 3. 六组验收清单（可勾选表格）

> 勾选列一律 `- [ ]`（未勾选）；`当前状态` 使用 §1 八状态之一或 `NOT_VERIFIED` / `NOT_EXECUTED`。`证据要求` 必须是可复核的真实产物，不得是「应该没问题」类描述。

### 3.1 第一组：文档验收

| 勾选 | 验收项 | 验收方法 | 证据要求 | 当前状态 |
|---|---|---|---|---|
| `- [ ]` | 28 份分册全部存在 | 列目录 + 文件存在性扫描 | `docs/design-system/uter-design-system-5.0/*.md` 与 `UDS5-S01`..`UDS5-S28` 一一对应 | `IMPLEMENTED_NOT_VERIFIED`（本轮 8 份，其余并行产出） |
| `- [ ]` | 每份非空且 ≥100 行 | `wc -l` 逐文件核对 | 每份行数 ≥100、禁止空文件 | `NOT_VERIFIED` |
| `- [ ]` | 元数据表字段齐全 | 逐份检查开头元数据表 | `文档 ID` / `版本 5.0.0` / `状态 ACTIVE` / `上级规范 UDS5-S01` / `生效日期 2026-11-14` / `适用范围` / `验证状态` | `NOT_VERIFIED` |
| `- [ ]` | 必备章节齐全 | 逐份检查 4 个章节 | `## 与其他规范的关系` / `## 代码实施位置` / `## 自动化验证` / `## 验证状态` | `NOT_VERIFIED` |
| `- [ ]` | 文档 ID 唯一 | `UDS5-S24` S01 校验 | 无重复、格式 `UDS5-Sxx`、与文件名对应 | `NOT_VERIFIED` |
| `- [ ]` | 无虚构路径 / 脚本 / 测试结果 | 引用路径有效性扫描（S04 / S08） | 所有路径 / 脚本名 / 测试结论可在仓库核实 | `NOT_VERIFIED` |
| `- [ ]` | 未宣称 `FULLY_IMPLEMENTED_AND_VERIFIED` | 全文检索结论标签 | 无违规声明；逐份列未验证项 | `NOT_VERIFIED` |
| `- [ ]` | 3.0 全文作为历史版本完整保留 | 文件存在性 + 大小核对 | `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` 4,111 行 / 197,053 B 未被删除或改写 | `NOT_VERIFIED` |

### 3.2 第二组：Token 验收

| 勾选 | 验收项 | 验收方法 | 证据要求 | 当前状态 |
|---|---|---|---|---|
| `- [ ]` | Primitive → Semantic 两层分离保持 | `check-design-tokens.mjs --strict` | 违规 0 / EXIT=0；14 个 CSS / 1,518 行 / 245 个唯一变量名 | `PARTIALLY_VERIFIED`（审计只读实测通过，未复核） |
| `- [ ]` | 无跨文件重复定义（T01） | T01 校验 | 跨文件重复 0；分档覆盖 60 处为合法 | `PARTIALLY_VERIFIED` |
| `- [ ]` | 无引用未定义 Token（T02） | T02 校验 | 3 个纯别名构建压缩缺陷已根治、兜底双轨移除 | `FAILED`（缺陷仍在） |
| `- [ ]` | 零静态引用候选已逐项核实（T03） | T03 + 构建产物验证 | 约 93 个候选不得直接删除，逐项验证 `@theme` / Tailwind 间接消费 | `NOT_VERIFIED` |
| `- [ ]` | 全部 Token 登记到 Manifest（T04） | `sync-design-showcase.mjs --check` / `generate-design-tokens.mjs --check` | 17 PASS / 0 FAIL / 0 SKIP，哈希自洽，EXIT=0 | `PARTIALLY_VERIFIED` |
| `- [ ]` | 无硬编码颜色 / 间距 / 圆角（T05–T07） | T05–T07 + 页面级扫描 | 违规 0；`brand-colors.ts` 为唯一裸色值出口 | `PARTIALLY_VERIFIED` |
| `- [ ]` | Light/Dark 变量成对（T08） | 新增成对校验器 + `verify-contrast.mjs` | 31 PASS / 0 FAIL；品牌渐变深浅同值例外登记 | `NOT_VERIFIED` |
| `- [ ]` | E24 对比度缺陷修复 | `verify-contrast.mjs` + 视觉复核 | 浅色溢价 / 深色折扣均 ≥4.5:1 | `FAILED`（3.76:1 / 3.30:1） |
| `- [ ]` | E28 例外边界登记 | 例外台账核对 | 首屏品牌渐变 2.54 / 2.72 / 3.96:1 为 B 类验收口径，不进 ALLOWLIST | `NOT_VERIFIED` |
| `- [ ]` | `@theme --text-*` 机制保留（决策 D1） | `tokens.test.ts` + 17 条校验 | 18 档字号阶梯未静默回退，另立 `--ds-font-*` 语义别名 | `NOT_VERIFIED` |

### 3.3 第三组：组件验收

| 勾选 | 验收项 | 验收方法 | 证据要求 | 当前状态 |
|---|---|---|---|---|
| `- [ ]` | 65 组件全部登记（C01） | `components:registry:check` | `registered=65 / discovered=65 / errors=0` | `PARTIALLY_VERIFIED` |
| `- [ ]` | `--strict` EXIT=0（C05） | `components:registry:strict` | `VERIFIED=65` / 无 `NOT_VERIFIED` 残留 | `FAILED`（当前 EXIT=1，0 VERIFIED） |
| `- [ ]` | 3 处同名 `EmptyState` 已合并（C02） | 重复实现扫描 | 仅 `components/empty-state.tsx` 一处，feature 侧能力缺口已记录 | `NOT_VERIFIED` |
| `- [ ]` | 八态齐备并登记证据（C04） | C04 校验 + 展示中心 | 每组件 default/hover/focus/pressed/disabled/loading/error/success 有证据 | `NOT_VERIFIED` |
| `- [ ]` | registry 8 类字段补齐（C03 / S03） | 注册格式校验 | `layer / source / *path / variants / states / accessibility / deprecated / replacement` 齐备 | `NOT_VERIFIED` |
| `- [ ]` | 组件级文档齐备（C06） | S05 / S06 校验 | 每组件有规范分册条目 + 展示单元 + 使用示例 | `NOT_VERIFIED` |
| `- [ ]` | 组件级 a11y 齐备（C07） | C07 + `test:axe` | ARIA / 键盘 / 焦点 / Reduce Motion / 对比度登记 | `NOT_VERIFIED` |
| `- [ ]` | 废弃组件无残留引用（C08） | 删组件引用检查 | `deprecated / replacement` 映射有效、引用数 0 | `NOT_VERIFIED` |
| `- [ ]` | `UTER-CMP-*` ID 唯一（S02） | 组件 ID 校验 | 全局唯一，作为双向关联主键 | `NOT_VERIFIED` |
| `- [ ]` | 展示中心 12 项能力齐备 | `UDS5-S23` 逐项核对 | 状态 / variant / 尺寸切换、Props、示例、a11y、测试状态、注册 ID、双向关联齐备 | `NOT_VERIFIED` |

### 3.4 第四组：页面验收

| 勾选 | 验收项 | 验收方法 | 证据要求 | 当前状态 |
|---|---|---|---|---|
| `- [ ]` | 17 个业务模块逐行适配达标 | `UDS5-S22` §3 表逐行复核 | 每模块 `现有页面 / 使用组件 / 设计问题 / 改造要求 / 改造文件 / 测试结果` 齐备 | `NOT_STARTED` |
| `- [ ]` | 退款 / 订单无虚构独立页面 | 路由 + 文件存在性扫描 | 无独立 refund / 订单路由；账单历史为 `billing-history-dialog.tsx` 弹窗 | `NOT_VERIFIED` |
| `- [ ]` | 无未登记组件 / 无绕过基础组件（P01 / P02） | V3 页面扫描 | 73 路由源码 / 30 feature 全部复用已登记组件 | `NOT_VERIFIED` |
| `- [ ]` | 无硬编码设计值（P03） | T05–T07 + 页面级扫描 | 违规 0 | `NOT_VERIFIED` |
| `- [ ]` | 五档响应式 + H5 命中区（P04） | V3 + mobile 390×844 基线 | 640/768/1024/1280/1536；命中区 ≥24px（推荐 44px）；输入 ≥16px | `NOT_VERIFIED` |
| `- [ ]` | 加载 / 错误 / 空三态齐备（P05–P07） | V3 三态扫描 | 每页面三态存在且复用 `loading/error/empty-state` | `NOT_VERIFIED` |
| `- [ ]` | `system-settings/*` 18 路由 + 动态段 E2E 覆盖 | 视觉 / 业务 E2E spec 计数 | 18 路由与 `*/$section` 等基线补齐（当前仅 22 页有基线） | `NOT_VERIFIED` |
| `- [ ]` | 业务红线零改动（R1–R5） | diff 审计 + 拦截器 | 支付 / 余额 / 订单 / 退款 / 认证 / 授权代码与契约零改动 | `NOT_VERIFIED` |

### 3.5 第五组：工程验收

| 勾选 | 验收项 | 验收方法 | 证据要求 | 当前状态 |
|---|---|---|---|---|
| `- [ ]` | CI frontend job 全部检查 PASS | 复跑 `ci.yml:356-438` | `typecheck / test / lint / design:tokens:check / design:showcase:check / verify:contrast / lint:design:strict / test:visual / components:registry:check / copyright:check / build:check` 全绿 | `NOT_VERIFIED`（本轮未复跑） |
| `- [ ]` | `--strict` 为唯一阻断口径（G6） | 门禁配置核对 | 结论以 `--strict` EXIT 码为准 | `NOT_VERIFIED` |
| `- [ ]` | `ALLOWLIST=[]` 保持空（G4） | 配置核对 | 无新增白名单条目；E28 走独立登记 | `NOT_VERIFIED` |
| `- [ ]` | baseline 0 条只减不增（G5） | `web/design-tokens.baseline.json` 核对 | 0 条，未执行 `--write-baseline` | `NOT_VERIFIED` |
| `- [ ]` | 未通过忽略规则 / 降阈值 / 删测试制造 PASS（G1–G3） | diff + 规则配置审计 | 无 `@ts-ignore` / `eslint-disable` / 阈值放宽 / 测试删除 | `NOT_VERIFIED` |
| `- [ ]` | `components:registry:strict` 接入并 PASS | 复跑 + CI 配置 | EXIT=0 | `FAILED`（当前 EXIT=1 且未接） |
| `- [ ]` | `test:axe` / `test:business:e2e` / `test:visual:e2e` 完成 | 开发机手动执行或接入 | 可执行证据齐备（当前刻意未接 CI） | `NOT_VERIFIED` |
| `- [ ]` | `format:check` 合规 | 复跑 | 248 文件不合规问题解决后才纳入 CI（当前刻意未接） | `NOT_VERIFIED` |
| `- [ ]` | 规范一致性 S01–S08 全过 | V4 校验 | 文档 ID / 组件 ID / 注册格式 / 路径 / 文档非空 / 代码 / 测试 / 依赖有效 | `NOT_VERIFIED` |
| `- [ ]` | 全量构建 `build:check` | 见 `UDS5-AUDIT-01` §1 约束 | 因 211 项并发 WIP 不执行全量构建，标 `NOT_EXECUTED` 而非 PASS | `NOT_EXECUTED` |

### 3.6 第六组：平台验收（专项）

| 勾选 | 平台 | 验收方法 | 证据要求 | 当前状态 |
|---|---|---|---|---|
| `- [ ]` | PC Web | `test:visual` + `test:visual:e2e` + `test:axe` + `test:business:e2e` | desktop 1440×900 × 22 张基线、a11y 与业务 E2E 证据 | `NOT_VERIFIED` |
| `- [ ]` | H5 | 同一套代码响应式分支 + mobile 390×844 × 22 张基线 | `detectPayClient()` UA、H5 输入 ≥16px、命中区达标证据 | `NOT_VERIFIED` |
| `- [ ]` | Android | 原生工程构建 + 真机 / 模拟器 UI 与 a11y 验收 | `android/`、`*.kt / *.java`、Capacitor / Flutter / RN 实现与测试报告 | **`NOT_VERIFIED`**（无实现） |
| `- [ ]` | iOS | 原生工程构建 + 真机 / 模拟器 UI 与 a11y 验收 | `ios/`、`*.swift / *.m / *.mm` 实现与测试报告 | **`NOT_VERIFIED`**（无实现） |
| `- [ ]` | HarmonyOS | 原生工程构建 + 真机 UI 与 a11y 验收 | `harmony/` 实现与测试报告（当前仅 `payment.ts:224` 的 UA 正则字面量） | **`NOT_VERIFIED`**（无实现） |
| `- [ ]` | Electron 桌面（补充，非上述 5 平台） | 复用同一 `web/dist` 的桌面回归 | `electron/` 加载同一产物的证据 | `NOT_VERIFIED` |
| `- [ ]` | 全平台结论 | PART 13 汇总 | 5 平台全部 `VERIFIED` 方可宣布 `FULLY_IMPLEMENTED_AND_VERIFIED` | **不可达**（见 §4） |

---

## 4. 平台验收专项声明（不得用 Web 结果代替）

| 项 | 内容 |
|---|---|
| 硬约束 | **不得用 Web 测试结果代替原生平台验收**。PC Web / H5 的视觉基线、a11y、业务 E2E 结果仅对 Web 与 H5 有效，不能推导出 Android / iOS / HarmonyOS 的验收结论 |
| 事实 | Android：无 `android/`、无 `*.kt/.java`、无 Capacitor/Flutter/RN/uni-app；iOS：无 `ios/`、无 `*.swift/.m/.mm`；HarmonyOS：无 `harmony/`，仅 `web/src/features/wallet/lib/payment.ts:224` UA 正则字面量 |
| 计数证据 | 全仓 `*.kt / *.swift / *.java / *.m / *.mm` 计数 **0** |
| 决策 | `UDS5-AUDIT-01` §8 / §9 D4：三平台必须标 `NOT_VERIFIED`；PART 12.6 要求「无真实实现或可用测试环境必须标 `NOT_VERIFIED`，不能伪造 PASS」 |
| 逻辑冲突 | PART 12.6（标 `NOT_VERIFIED`）与 PART 13（全平台通过方可 `FULLY_IMPLEMENTED_AND_VERIFIED`）**互斥** → N12 逻辑不可达 → 本轮最终状态必须低于 `FULLY_IMPLEMENTED_AND_VERIFIED`（`UDS5-AUDIT-01` §14 结论 C） |
| 结论记录 | 最终验收报告须逐条列出三平台 `NOT_VERIFIED` 及原因，不得合并为「全平台通过」 |

---

## 5. 验收结论判定规则

| 输入 | 输出结论 |
|---|---|
| 存在任一 `FAILED` 项 | `FAILED`，须列未通过项与修复建议 |
| 存在任一 `NOT_VERIFIED` / `NOT_EXECUTED` 项，无 `FAILED` | 低于 `FULLY_IMPLEMENTED_AND_VERIFIED`；按 `PARTIALLY_VERIFIED` 或 `IMPLEMENTED_NOT_VERIFIED` 报告 |
| 六组全部 `VERIFIED` 且 N1–N12 全满足 | `FULLY_VERIFIED` → 方可宣布 `FULLY_IMPLEMENTED_AND_VERIFIED` |
| N12 因无实现不可达 | 永远不得宣布 `FULLY_IMPLEMENTED_AND_VERIFIED`，除非三平台产生真实实现并通过验收 |

> 判定由 `UDS5-S24` 的 `V8 GateOrchestrator` 汇总 EXIT 码与证据链执行；本规范只定义口径，不代替执行。

---

## 6. 与其他规范的关系

| 规范 ID | 关系 | 说明 |
|---|---|---|
| `UDS5-S01` | 上级 | 服从总纲效力、ID 体系与验证状态口径 |
| `UDS5-AUDIT-01` | 事实依据 | §3.1 / §4.4 / §5 / §6 / §7 / §8 / §9 D4 / §14 提供全部基线数字、未闭合项与不可达结论 |
| `UDS5-S21` | 上游 | 14 项参考规范的 `NOT_VERIFIED` 项纳入本文验收 |
| `UDS5-S22` | 上游 | 17 个业务模块适配结果作为第四组页面验收证据来源 |
| `UDS5-S23` | 上游 | 展示中心 12 项能力与双向关联纳入第三组组件验收 |
| `UDS5-S24` | 上游 / 执行 | 五组检查与 8 类 Validator 提供验收方法；8 状态与 G1–G7 铁律一致 |
| `UDS5-S26`（变更日志） | 关联 | 验收结论的时间线记录 |
| `UDS5-S27`（迁移指南） | 关联 | `designSystem` 字段与硬编码校验同变更内升级（S03 / N4） |
| `UDS5-S28`（废弃规范） | 关联 | 失效 / 草稿规范不得作为验收依据 |

---

## 7. 代码实施位置

| 类别 | 真实路径 | 本文关联 | 本轮状态 |
|---|---|---|---|
| 规范分册 | `docs/design-system/uter-design-system-5.0/*.md`（`UDS5-S01`..`UDS5-S28`） | §3.1 / N1 | 撰写中 |
| 3.0 历史版本 | `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`（4,111 行 / 197,053 B） | §3.1 | 存在，未改动 |
| 审计事实源 | `docs/design-system/uter-design-system-5.0/audit/{BASELINE-AUDIT,CLERK-DESIGN-REFERENCE-ANALYSIS}.md` | 全文依据 | 存在，未改动 |
| Token 真源 | `web/src/design-system/tokens/*.css`（14 个 CSS） | §3.2 | 存在，未改造 |
| 组件注册 | `web/src/design-system/component-registry.json` | §3.3 / N3 / N4 | 存在，未改造 |
| 门禁脚本 | `web/scripts/check-design-tokens.mjs`、`check-component-registry.mjs`、`verify-contrast.mjs`、`sync-design-showcase.mjs`、`generate-design-tokens.mjs` | §3.2 / §3.5 | 存在，未改造 |
| CI 编排 | `.github/workflows/ci.yml:356-438`、`release-gate.yml:153-188` | §3.5 / N9 | 存在，未改造 |
| 视觉基线 | `web/e2e/visual/*`（44 张 PNG，22 页 × 2 视口） | §3.4 / §3.6 | 存在，部分覆盖 |
| E2E 配置 | `web/e2e/{axe,business,visual}/playwright.config.ts` | §3.5 / §3.6 | 存在，未接 CI |
| 原生平台 | `android/`、`ios/`、`harmony/`（均不存在） | §4 / N12 | 无实现 |

> 本文为验收规范，**不新增、不修改任何代码 / CI / 基线文件**；所有 `- [ ]` 为待验收项，非本轮已勾选。

---

## 8. 自动化验证

| 验收组 | 支撑 Validator（`UDS5-S24` §7） | 现有可执行证据 | 当前结果 |
|---|---|---|---|
| 文档 | V4 `SpecConsistencyValidator` | 无 | `NOT_VERIFIED` |
| Token | V1 `TokenValidator`、V5 `ContrastA11yValidator` | `check-design-tokens.mjs --strict` 违规 0、`verify-contrast.mjs` 31 PASS、`sync-design-showcase.mjs --check` 17 PASS（均为审计只读实测，本轮未复跑） | `PARTIALLY_VERIFIED` |
| 组件 | V2 `ComponentValidator`、V6 `ShowcaseAnchorValidator` | `components:registry:check` 65/65/0；`--strict` EXIT=1 | `FAILED` |
| 页面 | V3 `PageValidator`、V7 `VisualRegressionValidator` | `test:visual` 22 页 × 2 视口 | `NOT_VERIFIED` |
| 工程 | V8 `GateOrchestrator` | CI frontend job 11 项已接、5 项刻意未接 | `NOT_VERIFIED` |
| 平台 | V5 / V7 + 原生验收（无） | PC Web / H5 基线；三平台无实现 | `NOT_VERIFIED` |

> 本轮未运行任何验收命令；「现有可执行证据」仅复述 `UDS5-AUDIT-01` §4.4 / §5 / §7 / §8 只读实测结论。全量构建因 211 项并发 WIP 标 `NOT_EXECUTED`，不得伪装 PASS。

---

## 9. 验证状态

| 项 | 状态 | 说明 |
|---|---|---|
| 8 状态定义 + 12 必要条件 | `IMPLEMENTED` | §1 / §2 已定义 |
| 六组验收清单（全部 `- [ ]`） | `IMPLEMENTED_NOT_VERIFIED` | §3 已列出，未执行验收 |
| 平台「不得用 Web 代替原生」声明 | `IMPLEMENTED` | §4 已声明 |
| N12（Android / iOS / HarmonyOS 原生验收） | `NOT_VERIFIED` | 无实现，逻辑不可达（决策 D4） |
| E24 / E28 / 3 个纯别名 / `--strict` EXIT=1 | `FAILED` | 3.0 未闭合项，5.0 不勾选通过 |
| 全量构建 / 视觉双轨 / `test:axe` / `test:business:e2e` / 原生验收 | `NOT_EXECUTED` / `NOT_VERIFIED` | `UDS5-AUDIT-01` §14 |
| PC Web / H5 | `NOT_VERIFIED` | 未针对 5.0 重跑 |
| 最终结论 | **低于 `FULLY_IMPLEMENTED_AND_VERIFIED`** | §2.1 / §4 / `UDS5-AUDIT-01` §14 结论 C |

**总体验证状态：`NOT_VERIFIED`**。本文明确禁止把当前状态解读为 `FULLY_IMPLEMENTED_AND_VERIFIED`；最终验收报告须逐条列出所有 `NOT_VERIFIED` / `NOT_EXECUTED` / `FAILED` 项。
