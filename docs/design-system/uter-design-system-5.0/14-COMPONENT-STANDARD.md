# 14 — 组件标准（COMPONENT STANDARD）

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S14` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01` |
| 生效日期 | `2026-11-14` |
| 适用范围 | `web/src/components/ui/`（65 个基础组件实现根）、`web/src/components/`（业务封装）、`web/src/design-system/components/`（设计系统自持组件）、`web/src/design-system/component-registry.json`（注册表真源） |
| 验证状态 | `NOT_VERIFIED` |

> 本规范为 **规范层文档**，只定义「组件必须是什么、如何判定、如何验收」，不代表代码已按此实现或已通过验证。所有实现与验证状态的真实基线见 §2；本轮不修改任何业务代码、不引入依赖、不执行 git 操作。

---

## 1. 目的与效力

1. 为 UTER Design System 5.0 建立**唯一的组件开发标准**：任何进入 `ui/` 实现根的组件、任何新增的业务封装、任何补齐提案，都必须先满足 §3 的 22 项定义，再进入 §4 的清单审计与 §8 的测试要求。
2. 明确「规范 ↔ 代码 ↔ 注册 ID」三者的一致性口径：注册表真源是 `web/src/design-system/component-registry.json`（65 条，条目字段仅 `id / name / file / category / status / contract`），组件 ID 沿用真实 `UTER-CMP-*` 命名。
3. 继承 3.0 未闭合项，不虚报完成：3.0 §22 的 73 项验收清单全部为 `- [ ]`、0 项 `- [x]`；组件证据 `VERIFIED=0`，因此本规范不得被引用为「组件已验收」的依据。
4. 与 `web/AGENTS.md` 3.3「先检索，再复用，最后才新增」一致：本规范的清单审计结论优先服务于「复用与合并」，新增组件只在能力缺口被明确记录后成立。

---

## 2. 事实基线（引自 `BASELINE-AUDIT.md`，不得假设）

| 项 | 真实值 | 来源 |
|---|---|---|
| `ui/` 下 `.tsx` 文件 | 66（= 65 个实现 + 1 个 `dropdown-menu.test.tsx` 平铺测试） | §5 |
| `component-registry.json` | 65 条，`registryVersion 1.0.0`，`designSystem "UTER Design System 3.0"` | §5、注册表前 60 行 |
| 双向一致性 | `registered=65 / discovered=65 / errors=0`，结构自洽 | §5 |
| 证据状态 | **`VERIFIED 0` / `PARTIAL 9` / `NOT_VERIFIED 56` / `EXCEPTION 0`**；`warnings=65` | §5 |
| 门禁结果 | `components:registry:strict` **EXIT=1**（阻断） | §5、§3.1 |
| 原生分类（11 类） | `input 17 / overlay 9 / navigation 8 / layout 7 / data-display 7 / feedback 6 / form 5 / disclosure 2 / action 2 / utility 1 / content 1` | §5 |
| 注册表字段 | 顶层仅 `id,name,file,category,status,contract`；`contract` 内 `states,accessibility,responsive,tokens,evidence` | §5、schema |
| 缺失字段（相对 5.0） | `layer / source / implementation_path / specification_path / test_path / story_path / variants / states(顶层) / deprecated / replacement` 全部缺失 | §5 |
| 业务封装 | 7 目录 + 7 顶层 `.tsx`；`data-table/` 24 条公开导出 | §5 |
| README | 全仓仅 `web/src/components/data-table/README.md` 1 份 | §5 |
| 组件展示 | `docs/design-system/showcase.html`（2,188 行 / 24 区），真实 DOM 但**非 React 实例**；无 Props、无 `UTER-CMP` 注册 ID | §5.1 |
| Storybook | **不存在**：0 依赖、0 配置、0 `*.stories.*`、全仓字面命中 0 | §2 |
| 设计系统守卫测试 | 10 个（`web/src/design-system/__tests__/`） | §12 |
| 3.0 未闭合项 | §22 73 项全未勾选；PageHeader 尚无独立组件（`:3339`）；E24 对比度缺陷待修 | §3.1 |

**效力声明**：上表为只读审计结论。本规范所有「决定」均以此基线为出发点；任何把 `VERIFIED=0` 描述为已验证、把 `EXIT=1` 描述为通过、把 Storybook 描述为存在的表述均属违规。

---

## 3. 统一组件开发标准：22 项必定义项与判定规则

每个组件（含基础组件、业务封装、未来补齐组件）必须在规范或注册契约中定义以下 22 项。**「判定规则」列即验收口径**：不能满足即判定为 `PARTIAL` 或 `NOT_VERIFIED`，不得标 `VERIFIED`。

| # | 必定义项 | 判定规则（可验收） | 证据落点 |
|---|---|---|---|
| 1 | Component ID | 必须为 `UTER-CMP-*`；已在册组件沿用真实 ID，不得重命名；新建提案用 `UTER-CMP-5-XX`（见 §6.3 约束） | `component-registry.json:id` |
| 2 | Name | PascalCase、唯一；与文件名（kebab-case）建立可推导映射；不得与已册组件同名 | `name` / `file` |
| 3 | Category | 必须落入注册表 schema 的 11 类枚举（`action/input/form/navigation/overlay/disclosure/feedback/layout/data-display/content/utility`）之一 | `category` |
| 4 | Purpose | 一句话说明「解决什么用户问题」，不得用「一个 X 组件」同义反复；须写明不适用的场景 | 规范条目 |
| 5 | Anatomy | 列出组成槽位（root / trigger / content / item / icon / label 等）与 `data-slot` 命名，槽位顺序固定 | 组件实现 `data-slot` |
| 6 | Variants | 枚举全部 `cva()` variant 取值与默认值；新增 variant 只能走 `cva()` 扩展（见 `UDS5-S15`） | `cva()` / `defaultVariants` |
| 7 | Sizes | 枚举全部尺寸档与对应 CSS 变量（如 `--ds-button-height-md`），禁止任意 `text-[15px]` | `cva()` size |
| 8 | Props | 逐项列出名称 / 类型 / 默认值 / 是否必填 / 是否透传原生属性；遵循 `web/AGENTS.md`「props 非必要不解构」 | TS 类型导出 |
| 9 | Default | 定义常态（无交互、无数据、无错误）外观，且必须仅用语义 Token（`--ds-*` / `bg-*`） | `contract.states` |
| 10 | Hover | 必须走专用 `*-hover` Token；**T14 禁止 `hover:bg-X/NN` 透明度凑态**；不得仅靠颜色变化表达链接类反馈 | `cva()` variant |
| 11 | Focus | 2px 焦点环（`ring-2`，已裁决；`focus-visible:ring-2`）；键盘可达；`aria-*` 与视觉一致 | `accessibility.focusVisible` |
| 12 | Pressed | `active:` 态必须显式定义（如 `active:bg-primary-active`），不得由 opacity 推断 | `cva()` variant |
| 13 | Disabled | 不得仅用 `opacity`；须有底色 + 文字双重信号区分（3.0 §10.5），且 `pointer-events-none` / 原生 `disabled` 生效 | `cva()` variant |
| 14 | Loading | 加载态不得改变组件尺寸、不得丢失可访问名称；`aria-busy` 表达状态，spinner `aria-hidden`（参见 `ui/button.tsx:130-161`） | 实现 + `aria-busy` |
| 15 | Error | `aria-invalid` + 错误边框/环 + 就近错误文案；错误色走语义 Token | `aria-invalid` |
| 16 | Success | 成功态须有独立视觉信号（图标/文案/状态色），不得与 Default 无差别 | 实现 |
| 17 | Responsive | 必须支持窄视口；定义 `overflow` 策略与命中区（WCAG 2.2 AA 2.5.8，24×24 下限；H5 推荐 44px） | `contract.responsive` |
| 18 | Accessibility | `accessibleName / keyboard / focusVisible / stateExposure / focusManagement` 五子项按 schema 枚举填写，不得留空 | `contract.accessibility` |
| 19 | Theme | 定义 Light/Dark 成对表现；品牌渐变深浅同值为刻意例外（E28 登记）；不得用 `.dark` 覆盖品牌渐变 | `contract.tokens` |
| 20 | Usage Guidelines | 至少 1 个正例 + 触发条件；写明与业务封装的优先复用顺序（`web/AGENTS.md` 3.3） | 规范条目 |
| 21 | Anti-patterns | 至少 1 个反例（如手写同等控件、绕过 `appearance` 式覆写、`hover:bg-X/NN`、`zhCN` 直入 Intl） | 规范条目 |
| 22 | Test Requirements | 列出必须覆盖的行为测试（成功 / 边界 / 失败 / 禁用 / 加载 / 空 / 错误 / 响应式 / a11y），见 §8 | `evidence.tests[]` |

### 3.1 22 项与注册表 schema 的对齐

- 第 1–3、9、17–19 项可直接映射到 `component-registry.schema.json` 现有字段；第 6–8、10–16 项当前**只能落到 `cva()` 实现与 `contract.states[]` 字符串**，注册表无 `variants` / 顶层 `states` 字段（§2 缺失字段）。
- 因此「22 项齐备」在本轮是**规范要求**，不是注册表现状；补齐字段属 `UDS5-S14` 待办，须与 `check-component-registry.mjs` 校验同步（审计 §11.3 第 4 条），否则门禁失败。
- 第 22 项要求 `evidence.tests[]` 非空；当前 65 条中 `tests=[]` 占多数，`VERIFIED=0` 的直接原因即在此。

---

## 4. A–N 共 14 类组件清单审计报告

**口径说明**：「清单名称数」为按 5.0 PART 3.3 的 A–N 用户清单归类所得的**口径值**（合计约 150 个名称），用于覆盖审计，非代码实测计数；审计基线未逐类给出精确数量，故不宣称为统计结果。「Uter 真实实现文件」列只列已核实存在的路径，未列举部分以 §2 的 11 类计数引用为准，不虚构文件名。

统一列定义：`清单名称数` / `Uter 真实实现文件` / `由 variant 或 composition 覆盖的名称` / `缺失且需补齐` / `缺失但无需独立实现` / `决定`。

### A. Typography

| 清单名称数 | Uter 真实实现文件 | 由 variant 或 composition 覆盖的名称 | 缺失且需补齐 | 缺失但无需独立实现 | 决定 |
|---|---|---|---|---|---|
| 约 12 | `web/src/design-system/components/typography/`（**不在 `ui/` 下**）；`ui/` 下该类为 **0** | `Heading` / `Text` 由层级 props 组合；`Label` 由 `ui/` 表单标签承担；`Code` / `Blockquote` / `Link` 由语义标签 + 工具类覆盖 | 无 | `Heading1–6` / `Paragraph` / `Caption` / `Code` / `Blockquote` / `Link` / `Label`（均属同一排版体系的分档，不另立组件） | **保留现有单一实现根**，不迁入 `ui/`；在注册表中以 `source=design-system` 标注（该字段当前缺失，列为待办） |

**决定说明**：Typography 的真实位置是 `web/src/design-system/components/typography/`，这是与 `ui/` 并列的独立实现根，审计 §5.2 明确 `ui/` 下 A 类 = 0。禁止为「凑齐 A 类」在 `ui/` 下新建重复实现。

### B. Button

| 清单名称数 | Uter 真实实现文件 | 由 variant 或 composition 覆盖的名称 | 缺失且需补齐 | 缺失但无需独立实现 | 决定 |
|---|---|---|---|---|---|
| 约 14 | `web/src/components/ui/button.tsx`（单一 `cva()`：6 variant × 9 size + 内置 `loading`） | **≥10 个名称**：`PrimaryButton` / `SecondaryButton` / `OutlineButton` / `GhostButton` / `DestructiveButton` / `LinkButton` / `IconButton` / `LoadingButton` / `TextButton` / `SmallButton` / `LargeButton` | 无 | `ButtonGroup` / `SplitButton` / `FloatingActionButton` / `ToggleButton`（由组合或 `size` / `variant` 表达，不单独注册） | **单一组件覆盖，禁止拆分** |

**决定说明**：`ui/button.tsx:26-108` 的一个 `cva()` 定义 6 个 variant（`default / outline / secondary / ghost / destructive / link`）× 9 个 size（`default / sm / lg / icon / icon-xs / icon-sm / icon-lg / inline / wrap`）+ `loading`（`:118-165` 自动 `disabled + aria-busy`、spinner `aria-hidden`、文字宽度不塌缩）。因此用户清单中的 `PrimaryButton`、`LoadingButton` 等**不是缺失**，而是同一组件的 variant/prop 组合。禁止为这些名称新增独立文件。

### C. Input

| 清单名称数 | Uter 真实实现文件 | 由 variant 或 composition 覆盖的名称 | 缺失且需补齐 | 缺失但无需独立实现 | 决定 |
|---|---|---|---|---|---|
| 约 12 | `ui/input.tsx` / `secret-input.tsx` / `input-otp.tsx` / `input-group.tsx`（§2：input 类共 17 个） | `PasswordInput` / `SearchInput` / `NumberInput` / `Textarea` / `OTPInput` / `SecretInput` / `InputGroup` | 无 | `ColorInput`（并入 E 类 `ColorPicker`）、`FileInput`（并入业务上传封装） | **保留**；H5 输入 ≥16px 防 iOS 缩放、2px 焦点环（`ring-2`，已裁决）为现行红线 |

### D. Form

| 清单名称数 | Uter 真实实现文件 | 由 variant 或 composition 覆盖的名称 | 缺失且需补齐 | 缺失但无需独立实现 | 决定 |
|---|---|---|---|---|---|
| 约 10 | `ui/form.tsx` / `field.tsx` / `form-label-tier.tsx`（§2：form 类共 5 个） | `FormItem` / `FormLabel` / `FormControl` / `FormDescription` / `FormMessage` / `Fieldset` / `FormSection` | 无 | `FormLabelTier`（已由 `form-label-tier.tsx` 落地） | **保留**；错误位置/优先级/服务端错误见 `UDS5-S18` |

### E. Selection

| 清单名称数 | Uter 真实实现文件 | 由 variant 或 composition 覆盖的名称 | 缺失且需补齐 | 缺失但无需独立实现 | 决定 |
|---|---|---|---|---|---|
| 约 12 | `ui/checkbox.tsx`（推断族）/ `select.tsx` / `combobox.tsx` / `dropdown-menu.tsx` / `menubar.tsx`；业务封装 `components/multi-select/`、`model-group-selector/` | `Checkbox` / `Radio` / `RadioGroup` / `Switch` / `Select` / `Combobox` / `MultiSelect` / `SegmentedControl` / `Slider` / `Toggle` | **`Transfer`、`ColorPicker`、`Rate`** | `ToggleGroup` / `Listbox`（由 `select` / `combobox` 组合） | **补齐 3 项**（见 §6.3 的 `UTER-CMP-5-01/02/08`）；其余保留 |

> 说明：上表 `ui/checkbox.tsx` 等文件名若未在基线审计逐条列出，则以 §2 的 `input 17 / navigation 8` 分类计数为准，落地前须按 `web/AGENTS.md` 3.3 先检索确认，不得据本表新建文件。

### F. Navigation

| 清单名称数 | Uter 真实实现文件 | 由 variant 或 composition 覆盖的名称 | 缺失且需补齐 | 缺失但无需独立实现 | 决定 |
|---|---|---|---|---|---|
| 约 12 | `ui/` navigation 类共 8 个（§2）；`components/layout/` 下的 Sidebar / Navbar；`ui/tabs.tsx` 族 | `Tabs` / `Breadcrumb` / `Pagination` / `Menu` / `Menubar` / `Sidebar` / `Navbar` / `Link` / `Anchor` / `Stepper` | **`Tree`、`Timeline`** | `BottomNav`（H5 由响应式分支表达，非独立工程） | **补齐 2 项**（`UTER-CMP-5-03/04`）；权限由后端 Casbin + 路由 `beforeLoad` 决定，不引入 Clerk `<Show />` |

### G. Overlay

| 清单名称数 | Uter 真实实现文件 | 由 variant 或 composition 覆盖的名称 | 缺失且需补齐 | 缺失但无需独立实现 | 决定 |
|---|---|---|---|---|---|
| 约 12 | `ui/dialog.tsx` / `alert-dialog.tsx` / `popover.tsx` / `hover-card.tsx`；`components/dialog/` / `confirm-dialog/`；§2 overlay 类共 9 个 | `Dialog` / `AlertDialog` / `Drawer`(vaul) / `Sheet` / `Popover` / `HoverCard` / `Tooltip` / `DropdownMenu` / `ContextMenu` / `CommandMenu`(cmdk) / `Modal` | **`Lightbox`** | `Toast 容器`（由 `sonner` 承担，见 `UDS5-S20`） | **补齐 1 项**（`UTER-CMP-5-07`）；嵌套浮层外观作用域见 `UDS5-S17` |

### H. Feedback

| 清单名称数 | Uter 真实实现文件 | 由 variant 或 composition 覆盖的名称 | 缺失且需补齐 | 缺失但无需独立实现 | 决定 |
|---|---|---|---|---|---|
| 约 10 | `ui/alert.tsx` / `spinner.tsx` / `skeleton.tsx` / `progress.tsx`；`components/empty-state.tsx` / `loading-state.tsx` / `error-state.tsx`；§2 feedback 类共 6 个 | `Alert` / `Progress` / `Spinner` / `Skeleton` / `EmptyState` / `LoadingState` / `ErrorState` / `Banner` / `Notification` | 无 | `Toast`（`sonner`，见 `UDS5-S20`） | **先合并重复实现**（§5），再登记；Clerk 官方无通用反馈规范（`UDS5-S20`） |

### I. Data Display

| 清单名称数 | Uter 真实实现文件 | 由 variant 或 composition 覆盖的名称 | 缺失且需补齐 | 缺失但无需独立实现 | 决定 |
|---|---|---|---|---|---|
| 约 12 | `ui/card.tsx` / `titled-card.tsx` / `badge.tsx` 族 / `avatar.tsx` 族 / `empty.tsx`；§2 data-display 类共 7 个 | `Card` / `TitledCard` / `Badge` 族 / `Avatar` / `Tag` / `Chip` / `Divider` / `StatCard` / `DescriptionList` | **`Image`** | `Timeline` / `Tree`（归 F 类，避免重复登记） | **补齐 1 项**（`UTER-CMP-5-06`）；`ui/empty.tsx` 与业务 `EmptyState` 的重复见 §5 |

### J. Data Table

| 清单名称数 | Uter 真实实现文件 | 由 variant 或 composition 覆盖的名称 | 缺失且需补齐 | 缺失但无需独立实现 | 决定 |
|---|---|---|---|---|---|
| 约 8 | `web/src/components/data-table/`（**24 条公开导出**；`README.md` 分 `core/ layout/ toolbar/ static/ hooks/` 五子目录）；`ui/` 下该类为 1 | `DataTable` / `Toolbar` / `Pagination` / `ColumnHeader` / `RowSelection` / `BulkActions` / `ColumnVisibility` / `StaticTable` | **`VirtualTable`** | `SimpleTable`（由 `static/` 承担） | **补齐 1 项**（`UTER-CMP-5-05`）；11 项能力清单见 `UDS5-S19`；Clerk 官方无表格能力 |

### K. Date & Time

| 清单名称数 | Uter 真实实现文件 | 由 variant 或 composition 覆盖的名称 | 缺失且需补齐 | 缺失但无需独立实现 | 决定 |
|---|---|---|---|---|---|
| 约 8 | `ui/calendar.tsx` + `datetime-picker.tsx`（同类聚合，§5.2 K 类 = 1 组）；`Day.js` | `Calendar` / `DatePicker` / `DateRangePicker` / `TimePicker` / `DateTimePicker` / `DateDisplay` | 无 | `TimeRangePicker` / `DateRangeCalendar`（由同一聚合组件 props 组合） | **保留聚合实现**；格式规范见 `UDS5-S19`；Clerk 官方未提供 DatePicker/Calendar |

### L. Media

| 清单名称数 | Uter 真实实现文件 | 由 variant 或 composition 覆盖的名称 | 缺失且需补齐 | 缺失但无需独立实现 | 决定 |
|---|---|---|---|---|---|
| 约 8 | `ui/` 下 L 类 = 2（§5.2），且**无 Image / Video / Audio 组件** | `Avatar` / `Icon` / `QRCode`（`qrcode.react`） | **`Image`（I 类已列，Media 侧不重复登记）** | `Video` / `Audio` / `Carousel` / `Gallery` / `FilePreview`（当前业务无对应场景，列为观察项，不新建） | **不新建**；`Lightbox` 归 G 类补齐；Clerk 官方未提供 Image/Lightbox |

### M. Charts

| 清单名称数 | Uter 真实实现文件 | 由 variant 或 composition 覆盖的名称 | 缺失且需补齐 | 缺失但无需独立实现 | 决定 |
|---|---|---|---|---|---|
| 约 10 | `ui/chart.tsx` + `recharts 3.9.1` / `@visactor/vchart ^2.1.2`（§2、§5.2 M 类 = 1） | `LineChart` / `BarChart` / `PieChart` / `AreaChart` / `DonutChart` / `ScatterChart` / `Sparkline` / `Heatmap` / `GaugeChart` / `ChartTooltip` | 无 | 各图形为同一图表库的配置分支，不单独注册 | **保留单一图表封装**；P2「图表 text/axis/label/grid 独立 Token 未定义」保持 Pending（§3.1）；Clerk 官方未提供 Charts |

### N. Utilities

| 清单名称数 | Uter 真实实现文件 | 由 variant 或 composition 覆盖的名称 | 缺失且需补齐 | 缺失但无需独立实现 | 决定 |
|---|---|---|---|---|---|
| 约 10 | `ui/separator.tsx` / `scroll-area.tsx` / `collapsible.tsx` 等；`components/copy-button.tsx` / `@/hooks/use-copy-to-clipboard`；§2 utility 类 = 1（纯注册表分类） | `Separator` / `ScrollArea` / `Resizable` / `Collapsible` / `AspectRatio` / `Kbd` / `VisuallyHidden` / `Portal` / `CopyButton` / `Spinner` | 无 | `Portal` / `VisuallyHidden`（Base UI 原语直接提供，不另立组件） | **保留**；禁止把基础元素手写为同等控件（`web/AGENTS.md` 3.3） |

### 4.1 汇总决定

| 决定 | 类别 | 数量 |
|---|---|---|
| 保留单一实现 / 聚合，不新增 | A / B / C / D / H(合并后) / K / M / N | 8 类 |
| 补齐新组件 | E / F / G / I / J / L(观察) | 见 §5.2 的 8 项 |
| 由 variant 或 composition 覆盖、无需独立实现 | 全部 14 类中的多数名称 | ≈ 140 个名称 |

---

## 5. 关键结论与重复实现

### 5.1 覆盖口径三条硬结论

1. **Button**：一个 `cva()`（6 variant × 9 size + `loading`）覆盖清单中 ≥10 个名称，属「聚合覆盖」，不是缺失。
2. **Typography**：真实位置 `web/src/design-system/components/typography/`，**不在 `ui/` 下**；`ui/` 下 A 类为 0。
3. **Storybook 不存在**（0 依赖 / 0 配置 / 0 stories），组件展示依赖 `showcase.html`（非 React 实例、无 Props、无注册 ID）；5.0 按 `D3=Adapt` 扩展既有 showcase，不引入 Storybook。

### 5.2 真正建议补齐的约 8 项

| 序 | 名称 | 归属类 | 5.0 提案 ID | 能力缺口（须在变更说明中记录） |
|---|---|---|---|---|
| 1 | `Transfer` | E | `UTER-CMP-5-01` | 双栏穿梭选择，现有 `select` / `combobox` 组合无法表达 |
| 2 | `ColorPicker` | E | `UTER-CMP-5-02` | 颜色取色 + 十六进制输入，无对应 `ui/` 实现 |
| 3 | `Timeline` | F | `UTER-CMP-5-03` | 时间轴节点序列，`ui/` navigation 类未覆盖 |
| 4 | `Tree` | F | `UTER-CMP-5-04` | 层级树展开/选中，无对应实现 |
| 5 | `VirtualTable` | J | `UTER-CMP-5-05` | 大列表虚拟滚动表格，`data-table/` 现有导出未覆盖 |
| 6 | `Image` | I / L | `UTER-CMP-5-06` | `ui/` 下无 Image/Video/Audio 组件（§5.2） |
| 7 | `Lightbox` | G | `UTER-CMP-5-07` | 媒体灯箱浮层，Clerk 官方未提供该能力 |
| 8 | `Rate` | E | `UTER-CMP-5-08` | 评分交互，无对应实现 |

> **约束**：以上 8 项为**提案**，本轮不落地、不改注册表。ID 格式 `UTER-CMP-5-XX` 含连字符，与 `component-registry.schema.json:69` 的 `^UTER-CMP-[A-Z0-9_]+$` 及 `check-component-registry.mjs:45` 的硬编码校验**不兼容**；若未来落地，必须在同一变更内同步扩展正则与校验脚本（审计 §11.3 第 4 条），否则门禁失败。

### 5.3 重复实现清单与合并决定

| # | 同名 / 近似实现 | 位置 | 类型 | 合并决定 |
|---|---|---|---|---|
| 1 | `EmptyState` | `web/src/components/empty-state.tsx:42` | 正式封装 | **保留为唯一正式实现**（`web/AGENTS.md` 3.3 首选入口） |
| 2 | `EmptyState` | `web/src/components/notification-popover.tsx:156` | 局部同名 | 改为复用 `components/empty-state.tsx`；记录 feature 侧能力缺口 |
| 3 | `EmptyState` | `web/src/features/pricing/components/empty-state.tsx:29` | feature 内同名 | 改为复用；文案/图标/尺寸差异由 props 与主题表达，不构成重复实现理由 |
| 4 | `PlaygroundEmptyState` | feature 内 | 近似命名 | 归并到 `EmptyState`，保留业务数据由 props 传入 |
| 5 | `ConversationEmptyState` | feature 内 | 近似命名 | 同上 |
| 6 | `ChannelEditorLoadingState` | feature 内 | 近似命名（Loading） | 归并到 `components/loading-state.tsx` |
| 7 | `CodeBlockCopyButton` | feature 内 | 近似命名（Copy） | 归并到 `components/copy-button.tsx` + `use-copy-to-clipboard` |
| 8 | `ui/empty.tsx` | `web/src/components/ui/empty.tsx` | 基础元素 | 与业务 `EmptyState` 并存属分层设计，保留；但 `:95` 使用不存在的 `text-sm.5` 类为已知缺陷（§5），须修 |

**合并原则**（对齐审计 §11.2 第 1 条与 `web/AGENTS.md` 3.3）：
- 3 处同名 `EmptyState` 统一到 `components/empty-state.tsx`；4 个近似命名实现按职责归并到既有业务封装。
- 合并前不得删除任何文件；须按「每处改动先写回归测试」的项目约定分期推进（审计 §9 D7）。
- 文案、图标、尺寸、颜色或所在页面不同，**不构成**重复实现的理由（`web/AGENTS.md` 3.3 第 4 条）。

---

## 6. 组件状态矩阵

以下矩阵是 §3 第 9–16 项「八态」的展开，适用于所有可交互组件；`○` 表示必须定义，`—` 表示可声明 `NOT_APPLICABLE` 但须在契约中写明理由。

| 组件类 | Default | Hover | Focus | Pressed | Disabled | Loading | Error | Success |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Button（B） | ○ | ○ `*-hover` | ○ 2px 环（已裁决） | ○ | ○ 双重信号 | ○ `aria-busy` | ○ `aria-invalid` | — |
| Input（C） | ○ | ○ | ○ 2px 环（已裁决） | — | ○ | — | ○ 就近文案 | ○ |
| Selection（E） | ○ | ○ | ○ | ○ | ○ | — | ○ | — |
| Navigation（F） | ○ 含选中态 | ○ `*-hover` | ○ | ○ | ○ | — | — | — |
| Overlay（G） | ○ 含 closed/open | ○ | ○ 焦点陷阱 | ○ | — | ○ | ○ | — |
| Feedback（H） | ○ | — | ○ | — | — | ○ shimmer | ○ | ○ |
| Data Table（J） | ○ | ○ 行 hover | ○ | ○ 行选 | — | ○ 骨架 | ○ 错误态 | — |
| Form（D） | ○ | ○ | ○ | — | ○ 整表禁用 | ○ 提交中 | ○ 字段/服务端 | ○ 提交成功 |

**状态实现红线**：
1. Hover 一律走专用 `*-hover` Token（`bg-primary-hover` / `bg-secondary-hover` / `bg-destructive-subtle-hover` 等，`ui/button.tsx:44-55` 已示范），**T14 禁止 `hover:bg-X/NN`**（审计、Clerk 分析 2.12）。
2. Disabled 禁止仅依赖 `opacity`（3.0 §10.5，`ui/button.tsx:34-37` 注释明确）。
3. Loading 不得改变尺寸、不得丢失可访问名称（`ui/button.tsx:130-135`）。
4. Focus 为 2px 焦点环（`ring-2`，已裁决），`aria-expanded` / `aria-selected` / `aria-invalid` / `aria-busy` 必须与视觉状态一致（Clerk 分析 2.12、2.14）。

---

## 7. 组件关系与分层

| 层 | 内容 | 本规范职责 |
|---|---|---|
| L1 Foundation | Token / 主题 / 动效 | 由 `UDS5-S03`–`S13` 定义；组件只消费语义 Token |
| L2 Primitives | `@base-ui/react` 原语 | 不得在业务代码直接绕过封装调用底层库 |
| L3 Components | `ui/` 65 个实现 + `design-system/components/typography/` | §3 的 22 项、§4 的清单、§6 的状态矩阵 |
| L4 Patterns | `components/` 业务封装（dialog / confirm-dialog / copy-button / empty-state / loading-state / error-state / data-table 24 导出） | §5.3 合并决定；`web/AGENTS.md` 3.3 复用优先级 |
| L5 Templates | 73 个路由页面 | 由 `UDS5-S16` 定义，不在本规范重复 |

五层架构与 Clerk「分层定制」理念同构，但 Uter 的扩展路径是 `props + cva() + 语义 Token`，**禁止 `appearance` 式全局覆写**（会绕过 T1–T17 门禁），详见 `UDS5-S15`。

---

## 8. 测试要求（对应 §3 第 22 项）

| 测试类别 | 必须覆盖的行为 | 依据 |
|---|---|---|
| 单元 / 交互 | 八态渲染、props 默认值、受控与非受控切换、callback 触发 | `web/AGENTS.md` 3.14 |
| 可访问性 | 可访问名称、键盘可达、`aria-expanded/selected/disabled/invalid/busy` 与视觉一致 | `web/AGENTS.md` 3.12 / 3.14；Clerk 分析 2.21 |
| 响应式 | 窄视口、溢出策略、命中区 ≥24×24（推荐 44px）、语言/主题切换 | `contract.responsive`；`web/AGENTS.md` 3.14 |
| 回归 | 修改布局/尺寸/滚动/焦点/键盘/选中/禁用/加载/空/错误/响应式时**必须补回归测试** | `web/AGENTS.md` 3.14 第 3 条 |
| 边界 / 失败 | 空数据、单项/多项、超长文本、无效输入、异步失败、降级 | `web/AGENTS.md` 3.14 第 8 条 |
| i18n | 通过角色 / label / 翻译键语义定位，覆盖语言切换与 fallback | `web/AGENTS.md` 3.14 第 12 条 |
| 文件组织 | 测试放模块专属 `__tests__/`，禁止与正式代码平铺 | `web/AGENTS.md` 3.14 第 5 条；现有 `dropdown-menu.test.tsx` 平铺为已知缺陷（审计 §5） |
| 门禁 | `typecheck` / `lint` / 受影响测试文件最新通过结果 | `web/AGENTS.md` 3.2 / 3.14 第 22 条 |

**证据要求**：每个组件的 `contract.evidence.tests[]` / `browserTests[]` / `manualReview[]` 须有可核验条目，方可从 `NOT_VERIFIED` 迁移到 `PARTIAL` / `VERIFIED`。当前 `VERIFIED=0`，本规范不声称任何组件已达标。

---

## 与其他规范的关系

| 规范 | 关系 | 边界 |
|---|---|---|
| `UDS5-S01`（上级） | 效力来源；本规范为其组件域下位文件 | 不重述总则 |
| `UDS5-S03`–`S13` | 提供 L1 Foundation：颜色 / 字体 / 间距 / 圆角 / 边框 / 主题 / 动效 / 响应式 / 无障碍 Token | 组件只消费 `--ds-*`，不定义 Token |
| `UDS5-S15` | 组件 API 细则（props / variant / slot / composition / deprecation） | 本规范定义「必须定义什么」，S15 定义「怎么命名与扩展」 |
| `UDS5-S16` | 12 类页面模板与 73 路由 | 模板消费组件，不重复定义组件 |
| `UDS5-S17` | 交互五态与焦点 / hover / 嵌套浮层作用域 | 本规范 §6 是状态「存在性」，S17 是交互「过程」 |
| `UDS5-S18` | 表单验证与错误优先级 | 组件 Error 态的展示规则在 S18 细化 |
| `UDS5-S19` | DataTable 11 项能力与数据格式 | 本规范只给 J 类补齐决定 |
| `UDS5-S20` | 通知组件映射与错误处理归属 | 本规范 H 类反馈组件的提示归属在 S20 细化 |
| `web/AGENTS.md` | 强制约束：先检索再复用、props 不解构、测试与文件组织、§3.9 错误处理 | 本规范不与该文档冲突，冲突时以 `web/AGENTS.md` 为准 |
| `UTER-DESIGN-SYSTEM-3.0.md` | 历史版本完整保留；§22 未闭合项、E24、PageHeader、P1–P3 由 5.0 继承 | 3.0 不改写、不删除；不继承其「已完成」假设 |

---

## 代码实施位置

| 用途 | 真实路径 | 本轮动作 |
|---|---|---|
| 注册表真源（65 条） | `web/src/design-system/component-registry.json` | **只读**，不改 |
| 注册表 schema | `web/src/design-system/schemas/component-registry.schema.json` | **只读**，不改（ID 正则约束见 §5.2） |
| 基础组件实现根 | `web/src/components/ui/`（65 实现 + 1 平铺测试） | **只读**，不改 |
| 单一 Button 实现 | `web/src/components/ui/button.tsx` | **只读**（`cva()` 6×9 + `loading` 事实来源） |
| Typography 独立实现根 | `web/src/design-system/components/typography/` | **只读**，不迁入 `ui/` |
| 业务封装 | `web/src/components/`（`empty-state` / `loading-state` / `error-state` / `dialog` / `confirm-dialog` / `copy-button` / `data-table/`） | **只读**；合并决定见 §5.3，落地属后续变更 |
| DataTable 封装 | `web/src/components/data-table/`（24 导出，`core/ layout/ toolbar/ static/ hooks/`） | **只读** |
| 组件展示 | `docs/design-system/showcase.html` | **只读**；扩展属 `D3=Adapt` 后续项 |
| 设计系统守卫测试 | `web/src/design-system/__tests__/`（10 个） | **只读** |
| 规范输出 | `docs/design-system/uter-design-system-5.0/14-COMPONENT-STANDARD.md` | **本文件（新建）** |

> 未列出的脚本、路径、测试结果一律不在本规范中出现；`check-component-registry.mjs` 的引用来自审计 §5 / §11.3，仅作为「未来变更需同步」的约束提示，不宣称已执行。

---

## 自动化验证

| 验证项 | 真实命令 / 门禁 | 基线结果 | 本规范状态 |
|---|---|---|---|
| 注册表结构一致性 | `components:registry:check` | `registered=65 / discovered=65 / errors=0` | 引用审计结论，未重跑 |
| 注册表证据严格门禁 | `components:registry:strict` | **`EXIT=1`**，`VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56` | 未通过，未重跑 |
| 设计 Token 门禁 | `check-design-tokens.mjs --strict` | 违规 0 / EXIT=0 | 引用审计结论，未重跑 |
| 22 项定义齐备性 | 无现成脚本（注册表缺 `variants` / 顶层 `states` 字段） | 不可判定 | `NOT_VERIFIED` |
| 八态覆盖 | 无现成脚本（依赖 `evidence.tests[]`） | `tests=[]` 占多数 | `NOT_VERIFIED` |
| 重复实现检测 | 无现成脚本 | 3 处同名 + 4 个近似命名由审计人工核实 | `NOT_VERIFIED` |
| 全量构建 | `bun run build:check` 等 | 因并发 WIP 211 项，审计明确 `NOT_EXECUTED` | **不执行** |

**约束**：本轮不新增依赖、不新增脚本、不执行全量构建、不执行 git 操作。上表「基线结果」全部引自 `BASELINE-AUDIT.md`，本规范未运行任何验证命令（除行数核对外）。

---

## 验证状态

| 项 | 状态 | 说明 |
|---|---|---|
| 本规范文本 | `ACTIVE` | 已撰写，供评审 |
| 规范层验证（22 项 / 14 类 / 8 项补齐 / 重复合并 / 状态矩阵 / 测试要求） | `NOT_VERIFIED` | 未跑任何门禁或测试，不宣称通过 |
| 65 个组件证据 | `NOT_VERIFIED` | 真实基线 `VERIFIED 0 / PARTIAL 9 / NOT_VERIFIED 56`，`components:registry:strict EXIT=1` |
| 3.0 §22 73 项验收 | `NOT_VERIFIED` | 全部 `- [ ]`，不得继承为通过 |
| PageHeader 独立组件 | `NOT_VERIFIED` | 3.0 §3339 未闭合项，见 `UDS5-S16` |
| E24 对比度缺陷 | `NOT_VERIFIED` | 3.76:1 / 3.30:1 待修，P1 无障碍缺陷 |
| 8 项补齐提案 | `NOT_VERIFIED` | 仅提案，未落地、未改注册表 |
| 全量构建 / 视觉回归 / E2E | `NOT_EXECUTED` | 并发 WIP 约束，审计 §1 / §13 / §14 |
| Android / iOS / HarmonyOS | `NOT_VERIFIED` | 无真实实现（审计 §8、结论 C） |

> **最终状态低于 `FULLY_IMPLEMENTED_AND_VERIFIED`**：只要 `components:registry:strict` 仍 `EXIT=1`、65 组件 `VERIFIED=0`、三平台无实现，本规范及其上级 5.0 体系均不得宣布全量验收通过。
