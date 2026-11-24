# 用户指南内容源

用户指南每一章一个 MDX 文件，由 SPA 原生渲染（不再是 docs-web 静态站的一页）。

## 放文件

```
web/src/docs-content/user-guide/
  zh/
    auth.mdx                   # 章节：登录
    dashboard.mdx              # 章节：概览与数据看板
    ...
  en/
    auth.mdx                   # 英文版
```

截图放在 `web/public/user-guide/<locale>/<slug>/`（zh 与 zh-TW 共用 zh 的截图，
其余语言共用 en 的）：

```
web/public/user-guide/zh/auth/
  light/01-login.webp
  dark/01-login.webp
  ...
```

## 章节 slug

文件名必须是下面这些之一（URL 是 `/docs/<lang>/user-guide/<slug>`）：

| slug | 中文标题 | 英文标题 |
|---|---|---|
| `auth` | 登录 | Login |
| `playground` | 游乐场 | Playground |
| `overview` | 概览 | Overview |
| `dashboard` | 数据看板 | Dashboard |
| `api-keys` | API 密钥 | API Keys |
| `usage-logs` | 使用日志 | Usage Logs |
| `audit-logs` | 审计日志 | Audit Logs |
| `task-logs` | 任务日志 | Task Logs |
| `wallet` | 钱包 | Wallet |
| `redeem` | 兑换码 | Redeem Code |
| `referral` | 推荐计划 | Referral Program |
| `checkin` | 每日签到 | Daily Check-in |
| `profile` | 设置 | Settings |
| `security` | 安全与访问 | Security & Access |
| `pricing` | 定价 | Pricing |
| `ranking` | 排行 | Leaderboard |


> 自 2026-11-23 起，七种语言统一为 16 章：登录、游乐场、概览、数据看板、API 密钥、使用日志、审计日志、任务日志、钱包、兑换码、推荐计划、每日签到、设置、安全与访问、定价、排行。文件名依次是 `auth.mdx`、`playground.mdx`、`overview.mdx`、`dashboard.mdx`、`api-keys.mdx`、`usage-logs.mdx`、`audit-logs.mdx`、`task-logs.mdx`、`wallet.mdx`、`redeem.mdx`、`referral.mdx`、`checkin.mdx`、`profile.mdx`、`security.mdx`、`pricing.mdx`、`ranking.mdx`。

> `model-testing`（模型测试）曾是这个列表的第 10 章，现为与「用户指南」平级的
> 顶层板块，地址 `/docs/<lang>/model-testing`，正文文件仍在本目录
> （`model-testing.mdx`），由 `web/src/features/docs/native/docs-content.ts`
> 的 `docRefForPagePath` 映射进 user-guide 集。

章节标题取自 `web/src/features/docs/native/user-guide-identity.ts` 的章节表，
**不是** MDX 里的 `# 一级标题`——这样侧栏在两种语言下都能显示，且某一语言的
文件还没写时不至于没有名字。

## 写正文

- `#` 一级标题：忽略（文档标题而已，页面标题用上面的章节表）
- `##` → `h2`，进右侧目录的二级
- `###` 及更深 → `h3`，进右侧目录的三级
- 段落、列表、行内代码、加粗、链接、围栏代码块、表格、`<Callout>` 均支持

## 图片

正文里的截图必须是 `web/public` 下的**绝对路径**，并按亮/暗双图成对出现：

```mdx
<img className="block w-full rounded-lg border border-border dark:hidden" alt="登录页" src="/user-guide/zh/auth/light/01-login.webp" />
<img className="block w-full rounded-lg border border-border hidden dark:block" alt="登录页" src="/user-guide/zh/auth/dark/01-login.webp" />
```

裸文件名写法（`src="01-login.webp"`）不被原生渲染器解析，会破图。
`web/scripts/resolve-docs-screenshots.mjs` 会把同步脚本产出的裸文件名批量改写
成上面的双图形式，并可用 `--check` 做门禁。

## 从上游文档同步（`scripts/docs-sync/sync-newapi-user-guide.py`）

这九章的内容与截图来自上游开源文档仓库（上游 `RAW` 见
`scripts/docs-sync/sync-upstream-docs.py` 顶部）。同步脚本把这条链路固定下来：

```bash
python3 scripts/docs-sync/sync-newapi-user-guide.py   # 需要 Pillow 与 curl
cd web && node scripts/resolve-docs-screenshots.mjs   # 裸文件名 → 亮/暗双图
```

它对每个章节做四件事：

1. 从 `docs2.uter.pro/<locale>/llms.mdx/guide/feature-guide/user/<源页>` 取 MDX 正文
   （该站是 fumadocs，这个端点直接返回未渲染的 MDX 源）。
2. 从 `docs.uter.pro/<locale>/docs/...` 取渲染后的 HTML，在 `<article>` 里按 **alt 文本**
   把每张截图与 MDX 的 `__imgN` 对上——这是两边唯一共有的标识。
3. 下载原图（`/_next/static/media/*.png`，URL 藏在 `next/image` 的 `?url=` 参数里），
   缩到 1600px 宽、转 WebP，落到 `web/public/user-guide/<locale>/<slug>/NN-<名字>.webp`。
4. 清洗正文写成 `web/src/docs-content/user-guide/<locale>/<slug>.mdx`：删掉
   `import` 语句、换行里的 `<br />` 变空格、`<img>` 补上本地文件名、内链改写（见下）、
   把嵌在列表项里的截图提到顶层（否则它会被折成列表行里的 alt 文字）。

刻意改动的几处内容（不是原样搬运）：

- **正文里不出现上游域名**：本站文档一律不指向 `docs.uter.pro`。
  - 站点内链 `/zh/docs/guide/feature-guide/user/token` → 站内相对链接 `../api-keys/`；
  - 指向上游「管理端设置」的 `[查看设置文档 →](...)` 属**纯跳转指针**，整条删掉——
    句子本身已经把事实说完，指向不存在页面的链接比没有链接更糟；
  - 指向上游「AI 应用」属**行内引用**，去掉链接保留文字；`app-integration` 第 3 条
    除该页之外无处可指，改写成「主流 AI 应用大多可通过上述自定义 API 的方式接入，
    具体以各应用官方的配置说明为准。」——两条都写在脚本的 `DEVIATIONS` 里。
- 原文认证示例里的令牌字面量换成占位符 `YOUR_API_KEY`。

缓存落在 `/tmp/uter-cache`（可用 `UTER_CACHE` 覆盖），重跑不会重新下载。

## 改完要重新构建

文档正文由 `web/` 的 rsbuild 直接编译（`@source '../docs-content'` 保证 Tailwind
扫到 MDX 里的类名），改完只需重建前端并重编 Go：

```bash
cd web && bun run build
cd .. && go build -o uter-bin .
```
