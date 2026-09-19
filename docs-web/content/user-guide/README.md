# 用户指南内容源

用户指南每一章一个页面，正文来自这里的 Markdown 文件。九章已全部迁移到 Markdown。

## 放文件

```
content/user-guide/
  zh/
    auth.md                    # 章节：注册与登录
    dashboard.md               # 章节：概览与数据看板
    ...
  en/
    auth.md                    # 英文版；缺了就用这份老的结构化文案
```

图片放在 `public/user-guide/<locale>/<slug>/`：

```
public/user-guide/zh/auth/
  01-login.webp
  02-login.webp
  03-register.webp
  ...
```

## 章节 slug

文件名必须是下面这些之一（URL 是 `/docs/<lang>/guide/wiki/user-guide/<slug>/`）：

| slug | 中文标题 | 英文标题 |
|---|---|---|
| `auth` | 注册与登录 | Registration & Login |
| `dashboard` | 概览与数据看板 | Overview & Dashboard |
| `profile-and-security` | 个人资料与安全 | Profile & Security |
| `api-keys` | API 密钥 | API Keys |
| `api-and-playground` | 使用 API 与游乐场 | Using the API & Playground |
| `app-integration` | 聊天应用集成 | App Integration |
| `logs-and-tasks` | 日志与异步任务 | Logs & Async Tasks |
| `wallet-and-subscription` | 钱包与订阅 | Wallet & Subscription |
| `pricing-and-ranking` | 定价和排行 | Model Hub & Leaderboard |

标题取自 `src/lib/content/user-guide.ts` 里的章节表，**不是** Markdown 里的 `# 一级标题`——
这样侧栏在两种语言下都能显示，且某一语言的文件还没写时不至于没有名字。

## 写正文

- `#` 一级标题：忽略（文档标题而已，页面标题用上面的章节表）
- `##` → 页面上的 `h2`，进右侧目录的二级
- `###` 及更深 → 页面上的 `h3`，进右侧目录的三级
- 段落、有序/无序列表、行内 `` `代码` ``、`**加粗**`、链接、围栏代码块、表格都支持
- 文档开头的 `import ... from '...'` 会被自动忽略（那是 MDX 的写法）

## 图片

正文里写**明确文件名**，按章节目录解析：

```mdx
<img alt="登录页" src="01-login.webp" />
```

目录里的文件也仍然兼容按**文件名排序**对应 `__img0`、`__img1`…… 的旧写法
（导出工具常把图片提到变量里，写成 `src={__img0}`），但新内容一律用文件名——
排序写法在有人往目录里加一张图之后就会整体错位。

图片还没放进去时，页面会画一个带说明文字的虚线占位框，不会出现破图——
正文可以先上，截图后面补。

## 从上游文档同步（`scripts/sync-newapi-user-guide.py`）

这九章的内容与截图来自上游开源文档仓库（见 `scripts/sync-upstream-docs.py` 顶部
的 `RAW`）。同步脚本把这条链路固定下来：

```bash
cd docs-web
python3 scripts/sync-newapi-user-guide.py      # 需要 Pillow 与 curl
```

它对每个章节做四件事：

1. 从 `docs2.newapi.pro/<locale>/llms.mdx/guide/feature-guide/user/<源页>` 取 MDX 正文
   （该站是 fumadocs，这个端点直接返回未渲染的 MDX 源）。
2. 从 `docs.newapi.pro/<locale>/docs/...` 取渲染后的 HTML，在 `<article>` 里按 **alt 文本**
   把每张截图与 MDX 的 `__imgN` 对上——这是两边唯一共有的标识。
3. 下载原图（`/_next/static/media/*.png`，URL 藏在 `next/image` 的 `?url=` 参数里），
   缩到 1600px 宽、转 WebP，落到 `public/user-guide/<locale>/<slug>/NN-<名字>.webp`。
4. 清洗正文写成 `content/user-guide/<locale>/<slug>.md`：删掉 `import` 语句、换行里的
   `<br />` 变空格、`<img>` 补上本地文件名、内链改写（见下）、把嵌在列表项里的截图
   提到顶层（否则它会被折成列表行里的 alt 文字）。

刻意改动的几处内容（不是原样搬运）：

- **正文里不出现上游域名**：本站文档一律不指向 `docs.newapi.pro`。
  - 站点内链 `/zh/docs/guide/feature-guide/user/token` → 站内相对链接 `../api-keys/`；
  - 指向上游「管理端设置」的 `[查看设置文档 →](...)` 属**纯跳转指针**，整条删掉——
    句子本身已经把事实说完，指向不存在页面的链接比没有链接更糟；
  - 指向上游「AI 应用」属**行内引用**，去掉链接保留文字；`app-integration` 第 3 条
    除该页之外无处可指，改写成「主流 AI 应用大多可通过上述自定义 API 的方式接入，
    具体以各应用官方的配置说明为准。」——两条都写在脚本的 `DEVIATIONS` 里。
- 原文认证示例里的令牌字面量换成占位符 `YOUR_API_KEY`。

缓存落在 `/tmp/newapi-cache`（可用 `NEWAPI_CACHE` 覆盖），重跑不会重新下载。

## 改完要重新构建

改动只在这份目录和 `public/user-guide/` 里，`docs-web` 重新构建即可：

```bash
cd docs-web && npm run build      # postbuild 会把产物同步进 web/dist/docs
cd .. && go build -o u-routers-bin .
```

（顺序不能反：`web/` 的 rsbuild 构建会清空整个 `web/dist`。）
