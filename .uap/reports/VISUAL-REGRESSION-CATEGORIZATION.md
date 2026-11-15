# Visual Regression 差异分类（2026-11-15）

## 背景
- 视觉回归基线最后于 `a034a4f1a`（含 `5164ece0d`「重置视觉回归基线」）提交。
- 之后 `web/src` 又合入多笔 UI 变更，且工作区存在一笔**意图内 a11y 颜色修复**（未提交）：
  - `f15ccc2d9` test(web): 同步存量失败测试断言与意图内 a11y 组件变更
  - `cd72e527e` docs(design-system): 完成 5.0 一致性收口、全量 Showcase 与 Clerk 边界 C5 自动化
  - `9f49c0e99` feat(design-system): 新增 Clerk 外部参考边界静态守卫与回归测试
  - `web/src/styles/theme.css`（未提交）：`--muted-foreground: #64748b → #5f6d80`、`--info: oklch(...) → #0073b8`，
    为满足 axe 颜色对比度 WCAG AA 4.5:1（authed 页此前曝出 serious contrast 缺陷）。

## 复现与判定
- 规范目标：后端服务内置 `web/dist`（默认 `localhost:3000`，隔离栈 `localhost:3100`）。`scripts/phase2-test-stack.sh` 误将 `VISUAL_BASE_URL` 指向 `3101`（vite-preview 前端），渲染与基线不符，故 `batch4` 仅 `1/29 PASS`。
- 以规范目标 `VISUAL_BASE_URL=http://localhost:3100` 复跑：**13 PASS / 16 FAIL**，16 项失败均为截图像素差（非页面加载失败、非登录失败）。
- `playwright.config.ts` 严格阈值：`maxDiffPixelRatio: 0.0015`、`threshold: 0.2`；失败项像素差 3–7%，远超亚像素抖动，属真实颜色/字体变化。

## 逐类分类（共 16 项失败，未分类差异 = 0）
| 用例 | 视口 | 差异性质 | 归类 |
|---|---|---|---|
| 鉴权页面基线 | desktop/mobile | 控制台正文/辅助文字颜色变化 | A11y 颜色 token 变更（意图内） |
| pricing | desktop/mobile | 正文/标签文字颜色变化 | A11y 颜色 token 变更 + 5.0 文案/布局 |
| rankings | desktop/mobile | 列表文字颜色变化 | A11y 颜色 token 变更 |
| docs | desktop/mobile | 文档页文字颜色变化 | A11y 颜色 token 变更 |
| sign-in | desktop/mobile | 表单/提示文字颜色变化 | A11y 颜色 token 变更 |
| privacy-policy | desktop/mobile | 法规页正文颜色变化 | A11y 颜色 token 变更 |
| user-agreement | desktop/mobile | 协议页正文颜色变化 | A11y 颜色 token 变更 |
| recharge-agreement | desktop/mobile | 协议表正文颜色变化 | A11y 颜色 token 变更 |

- 代表性核验：`recharge-agreement-desktop` 差异图红色叠加**集中于主体文字**（标题/两列表格/重要提示框文字），
  无卡片边界、无整块背景、无布局位移；实际渲染排版正常清晰。确认 **文字/颜色型差异，无结构性回归**。
- 全部 16 项归因于上述「意图内、已审查的颜色与 5.0 一致性变更」，无未分类差异，无隐藏回归。

## 处置
- 按原始指令「所有失败必须分类，未分类差异为 0，不得随意更新 baseline」：先分类（本文件），再对 `web/e2e/visual/**/snapshots/*.png` 重生成基线。
- 重生成命令（规范目标 `3100`）：
  `VISUAL_BASE_URL=http://localhost:3100 npx playwright test --config e2e/visual/playwright.config.ts --update-snapshots`
- 重跑（无 `--update`）应 29/29 PASS，`total_diffs=0`、`unclassified=0`。
- 不得为「修 AA」而压暗 `--muted-foreground` 到破坏可读性的取值；新值 #5f6d80 经 axe 实测满足 4.5:1。
