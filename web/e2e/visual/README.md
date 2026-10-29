# 视觉回归（第二轨 · Playwright）

> 本轨覆盖**真实业务路由**，与第一轨零依赖脚本互补。两者并存、互不替代。

## 1. 双轨分工

| | 第一轨（零依赖） | 第二轨（本目录） |
|---|---|---|
| 命令 | `bun run test:visual` | `bun run test:visual:e2e` |
| 实现 | `scripts/visual-regression.mjs` + 本机 Chrome CLI | `@playwright/test` + Playwright Chromium |
| 覆盖面 | 仅 `docs/design-system/showcase.html` 静态核查页 | 真实路由，含需登录页 |
| 前置 | 有 Chrome 即可 | 需完整栈（Go 后端 + 前端 dev server） |
| 耗时 | 秒级 | 分钟级 |
| 可否挂 pre-commit | 可以 | **不可以**（太慢） |

第一轨回答「设计系统的 token 本身有没有走样」，第二轨回答「真实页面组装起来后有没有走样」。

## 2. 决策记录（2026-10-30）

| 编号 | 决策 | 理由 |
|---|---|---|
| A | 鉴权页用**专用只读测试账号**，不复用 Root 超管 | Root 凭据明文只在 gitignore 的 `.workbuddy/` 下，项目红线禁止其流入代码/文档/自动化 |
| B | **双轨并存**，第一轨不废弃 | 第一轨秒级可高频执行，第二轨慢但覆盖真实页面 |
| C | **不接 CI**，仅开发机手动执行 | 像素基线依赖本机字体渲染与 GPU 合成，跨 OS 随机红灯；门禁假红比没有门禁更糟 |
| D | 安装 `@playwright/test` + 下载 Chromium 二进制 | 固定浏览器版本，避免系统 Chrome 自动更新导致基线漂移 |

CI 上的设计令牌门禁维持 `--strict`（`bun run lint:design:strict`），与视觉回归无关、不受本轨影响。

## 3. 前置条件

```bash
# 方式 A（默认，最稳）：Go 后端，内嵌 web/dist 构建产物（title=Uter）
cd ~/uter && ./uter-bin          # 进程 CWD 必须是 ~/uter（SESSION_SECRET 从那里读）

# 方式 B：前端 dev server（调试热更新时用）
cd ~/uter/web && bun run dev     # 端口以启动输出为准
VISUAL_BASE_URL=http://localhost:<端口> bun run test:visual:e2e
```

默认目标 `http://localhost:3000`（Go 内嵌产物）。基线反映的是**最近一次构建**的外观。

> ⚠ **端口陷阱**：本机 `:3200` 可能是 **uter-cs 智能客服**的 dev server——它也有登录页
> （标题「智能客服中枢」、端点 `/api/auth/login`、独立的用户库），与 uter 毫无关系。
> 认准方法：uter 登录页调用 `/api/user/login`。若 `VISUAL_BASE_URL` 指错，登录会
> 一直报「用户名或密码错误」且后端日志里**看不到任何请求**。

服务不可达 → 整轮判定 BLOCKED 并失败，不会报成「全都跳过/通过」。这是刻意的：
门禁结果要汇报给人看，假通过比没有门禁更危险。

## 4. 凭据配置（鉴权页必需）

`.auth/readonly.json` 不存在时，鉴权场景是 **skipped 而非 passed**，且 globalSetup 会打印警告。

```bash
# web/.env.local（已被 .gitignore 的 `*.local` 规则覆盖，不会入库）
VISUAL_TEST_EMAIL='visual-test'
VISUAL_TEST_PASSWORD='<专用密码>'

# 登录链路冒烟（验证凭据有效，1 次登录配额）
bun run test:visual:e2e:auth
```

### 账号要求

- **专用**，不得是 Root 超管，也不得是有生产数据的真实用户账号。
- **只读**：只截图浏览，不产生写操作。
- 若站点开启了 **Turnstile**，生成快照前需临时关闭，完成后**立即恢复**（已有同类先例）。
  否则登录会卡在人机验证上。

当前实例已按此要求创建专用账号 `visual-test`（role=1 普通用户、VIP0 分组、
users 表 id=52，经用户授权写入本地 SQLite）：凭据在 `web/.env.local`（gitignore），
明文密码不进任何源码、文档或提交。

> ⚠ 登录页那句「默认账号 admin / admin123（首次 seed 创建）」是 seed 逻辑的**静态
> 提示文案**——本地库中并不存在小写 `admin` 账号，勿据其猜测凭据。另外登录接口有
> CriticalRateLimit（20 次/20 分钟/IP，成败都计数），**不要反复试密码**。

### 登录架构（重要）

- **不共享 storageState**：uter 的 refresh cookie 是一次性轮换（OWASP 推荐），多个
  context 复用同一份会话快照会在几个用例后触发 `/api/user/auth/refresh` 401 并被
  全局登出（2026-10-30 实测，后端日志可证）。
- 因此鉴权页设计为**每个视口一个长用例**：`page.request` 调 `/api/user/login`
  （cookie 直接进当前 context）登录 1 次，串行走完全部鉴权页截图。整轮登录配额
  消耗：鉴权 2 次 + 冒烟 1 次 = 3 次，远低于 CriticalRateLimit 的 20 次/20 分钟。
- 公开页（home/pricing/rankings 等）**未登录**即可渲染真实内容，无需登录态。
- `channels`/`models`/`subscriptions` 是管理员页面，专用账号（role=1）基线预期为
  403「禁止访问」空态；截到真实管理页内容需管理员账号，属后续增强。

### UI 登录的已知细节（auth.setup.spec.ts 已改走 API 登录，以下供手动调试参考）

- 登录框未把 RHF 字段名透传到 DOM，用 **placeholder** 定位（locale 锁 zh-CN）。
- 提交按钮没有 `type=submit` 属性，按**角色名**（「登录」/「Sign in」）匹配。
- 法律条款勾选框 `#legal-consent` 的**指针点击会卡 actionability 检查**（实测
  120s 超时），需用 **focus + Space 键盘交互**勾选。

### 为什么凭据只走环境变量

任何写死在代码/文档里的密码都会被 git 永久记录。`.env.local` 由 `web/.gitignore`
第 13 行 `*.local` 规则忽略。`web/.auth/`（早期 storageState 方案的残留）同样被忽略。

## 5. 常用命令

```bash
bun run test:visual:e2e            # 比对（有差异即失败）
bun run test:visual:e2e:update     # 更新基线 —— 必须自行 review diff 后再提交
bun run test:visual:e2e:auth       # 登录链路冒烟（凭据失效时这里先红）
```

失败产物（diff 图、trace）在 `.visual-e2e/report/`，`bunx playwright show-report .visual-e2e/report` 可看。

## 6. 增删路由

路由清单位于 `lib/pages.ts`，它是**基线资产清单**：

- 新增条目 = 新增基线，先 `:update` 生成再提交 PNG。
- 删除条目 = 必须同步删除 `*.spec.ts-snapshots/` 下对应 PNG，否则留下孤儿文件。
- 临时下线用 `disabled: true` + `disabledReason`，不要直接删。

### 标注易变元素

页面上「每次渲染都不一样」的部分（实时时钟、动态版本号、随机文案、余额数字）在业务代码里加一个属性：

```tsx
<span data-visual-volatile>{new Date().toLocaleString()}</span>
```

`lib/harness.ts` 会把它们隐藏，不再参与像素比对。业务侧加属性即可，无需改动本目录。

## 7. 抗抖动做了什么

`lib/harness.ts` 在截图前统一：

- 关闭 CSS 动画/过渡（否则同一页面两次截图必然有差异）
- 隐藏输入光标（`caret-color: transparent`）
- 归零滚动条宽度（有无溢出时页面宽度不一致）
- 等待 `document.fonts.ready`（避免截到字体 fallback）
- 等到 `ready` 锚点可见（避免截到骨架屏）
- `animations: 'disabled'` / `scale: 'css'`（Playwright 侧）

允许的差异阈值：`maxDiffPixelRatio: 0.0015`（1440×900 约 1900 像素），只吸收亚像素与
字体微调，**不足以掩盖真实错位**。
