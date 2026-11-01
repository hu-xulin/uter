# 系统设置页字号层级 · 实施说明

对应需求：按 10 张设置页截图中的红字标注改字号，并「应用到系统设置所有页面、所有类似结构和层级中」。

## 一、截图红字要求的映射

| 截图红字                                           | 落点               | 实现                                                                  |
| -------------------------------------------------- | ------------------ | --------------------------------------------------------------------- |
| 按钮上下不居中，改成居中                           | Tabs 触发器        | `TabsList` 改 `items-stretch`，`TabsTrigger` 改 `h-full min-h-0`      |
| 设置引导 **16px，加粗**                            | `AlertTitle`       | 读标签档位上下文，设置页自动 16/600                                   |
| 启用登录前，请先在提供商应用中设置这些值。**14px** | `AlertDescription` | 保持 `text-sm`（14/20）不变                                           |
| Client Secret **16px，加粗**                       | 字段标签           | `FormLabelTierProvider tier='field'` 全页下发                         |
| **14px，密钥采用 mono 字体**                       | 密钥输入值         | `SecretInput`/`SecretTextarea` 默认 `mono`，值走 `text-mono`（14/20） |

## 二、三层契约（设置页）

```
容器标题   18/600/28   Heading variant='group-title'（带边框的 SettingsControlGroup）
字段标签   16/600/24   FormLabel / Label，由上下文下发
说明文字   14/400/20   FormDescription / <p> / AlertDescription
```

机器可读的值（URL / 域名 / 端点 / 密钥 / 邮箱 / Client ID / 路径）用等宽 14/20；
人读的名称（站点名、发送者姓名）不用等宽。

## 三、实现方式：上下文声明一次

设置页有 280 个 `FormLabel`、63 个 `Label`。逐个加类名必然漏，且新增字段会继续跑偏，
所以改成**在页面层声明一次**：

- `settings-page.tsx` 的 `SettingsPageFrame` 包 `FormLabelTierProvider tier='field'`，
  一次覆盖 auth / billing / content / models / operations / request-policies / security / site 全部子页。
- `SettingsForm` / `SettingsFormGrid` / `SettingsControlChildren` 也声明 `field`（独立使用时同样成立）。
- `Label` / `FormLabel` 接受 `tier` prop 覆盖上下文；档位类拼在基础 `text-sm font-medium`
  之后，由 `cn()`（twMerge）覆盖。

## 四、本轮修掉的两个真实缺陷（均由测试暴露，非推测）

### 1. `text-mono` 与 `text-sm` 并存

初版写成「基础类含 `text-sm`，mono 时追加 `font-mono text-mono`」。
但 `text-mono` 是自定义 token，**twMerge 不认它是字号类**，`text-sm` 不会被移除。
两者同时存在时生效哪个取决于 CSS 源顺序 —— 浏览器实测确实有一个组合落回 14px，
而且字号来源不确定。

修正：改成二选一，基础类不再写 `text-sm`。

```tsx
mono ? 'font-mono text-mono' : 'text-sm'
```

`Input` 与 `Textarea` 都已改。

### 2. `SettingsControlGroup` 把分组标题档位下发给全部后代

初版让容器下发 `group`（18/600），本意是让容器标题与卡片同档。
但容器标题实际是 `Heading variant='group-title'` 自带的 18/600，不依赖上下文；
而下发 group 会让容器内直接写的 `FormLabel`（`request-checks-section`、
`passkey-section`、`email-settings-section` 等一批分组里都有）一起变成 18px，
比同页其他字段标签大一号。

修正：容器对后代下发 `field`，容器标题继续用 `Heading` 显式档位。

## 五、显式降档的位置（`tier='default'`）

这些不是字段标题，必须显式声明，否则会静默继承 16px：

- 单选 / 复选项文字：SMTP 三档加密（无加密 / SSL/TLS / STARTTLS）、
  会话策略三选（off / prefer / strict）
- 密集定价编辑器的列标签：`tier-price-fields`、`tiered-pricing-editor`（含「Input tokens」
  「Output tokens」「Multiplier」）、`channel-pricing-section`、`channel-model-weight-section`、
  `server-log-files`、`task-usage-pricing-editor`

同时删掉 `customer-service-section.tsx` 三处 `<FormLabel className='text-sm font-normal'>` ——
它会把标签压回 14px，与下方 14px 说明同号同重。

## 六、守卫（三道，均已实跑通过）

| 测试                                                               | 守住什么                                                                                                              |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `components/ui/__tests__/form-label-tier.test.tsx`（9 条，新增）   | 上下文真的被读到、twMerge 覆盖生效、显式 tier 能压上下文、`AlertTitle` 跟随、mono 与 text-sm 互斥、分组容器下发 field |
| `design-system/__tests__/control-typography.test.ts`（3 条，扩展） | 设置页 `FormLabel`/`Label` 不得硬写字号/字重（显式 `tier=` 的调用点豁免）；原有控件 12px 下限与 `h3/h4/h5` 下限       |
| `components/ui/__tests__/component-metrics.test.tsx`（7 条，扩展） | Tabs 容器与触发器同心（`items-stretch` + `h-full min-h-0`）                                                           |

## 七、门禁结果

| 命令                                   | 结果                                                   |
| -------------------------------------- | ------------------------------------------------------ |
| `bun run typecheck`（tsgo -b）         | exit 0                                                 |
| `node scripts/check-design-tokens.mjs` | 通过，1244 文件 0 违规，300 处已登记例外（与改前同数） |
| `bunx vitest run`（全量）              | **251 文件 / 2772 用例 全 PASS**                       |
| `oxfmt --check`（改动文件）            | All matched files use the correct format               |

## 八、未执行项

**登录态视觉验收未执行。** 指定账号 `Uter.ai` 已开启 Passkey 二次验证，
按项目约定遇到二次验证必须停下询问，不得绕过。因此「打开设置页截图确认观感」
这一步没有做，需要用户配合完成二次验证后另行确认。

已做的不依赖登录的验证：用构建产出的真实 CSS 在 Chromium 中量测 token 到 px 的映射
（`--text-mono` = 14/20、`--text-base` = 16/24、`--text-lg` = 18/28 均符合预期）。
