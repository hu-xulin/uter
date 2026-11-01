# 验收清单 · UI / 设计系统（UI_DESIGN）

> 依据：`AIES.md` §6.1、`design-system.md`、`AGENTS.md` 前端规则与 Design System Enforcement。
> 每项须有实际证据；未执行 = NOT_RUN，不得报成 PASS。

## 开工前（项目检查 + 规范检索）
- [ ] 读 `docs/design-system/design-system.md` §11 颜色 / §12 字号 / §14 组件 / §21 响应式 / §26 例外
- [ ] 检查 `web/src/components/ui/` 与相关 feature 现有组件（AGENTS.md 强制「Reuse existing UI components first」）
- [ ] 确认刻度真源 `web/src/styles/theme.css` 的 `--text-*`、密度 `theme-presets.css`、文档页 `docs-web --text-doc-*`
- [ ] 识别受影响页面、断点、交互态（加载/错误/空/禁用）
- [ ] 列出缺失或矛盾的设计规则（不擅自发明新决策）

## 实现中
- [ ] 复用现有组件与已批准变体，不重复建立同类组件体系
- [ ] 使用已批准 Token（颜色/字号/间距/圆角/投影/动效），无未批准硬编码值
- [ ] 不引入自定义 `text-*` token（twMerge 陷阱）；13px 走 `text-dense`/`text-mono`，勿 `text-[0.8125rem]`
- [ ] `text-base`(16px) 仅限四类合法用途；`<p>`/`Card`/`DialogContent`/`SheetContent` 上不写
- [ ] 保留现有设计系统 API 与命名约定
- [ ] 焦点环全站 1px（`ring-1`）、键盘交互、可访问性、`tracking-*` 不残留
- [ ] 不改无关业务逻辑；不覆盖用户并发 WIP

## 必跑门禁（记录实际命令与退出码）
- [ ] `cd web && bun run lint:design:strict`（T1–T15）
- [ ] `cd web && bunx vitest run src/design-system/__tests__`（spec-guards 等 10 套件）
- [ ] `cd web && npx tsgo -b --force`

## 视觉验收（诚实标注）
- [ ] 打开 `docs/design-system/showcase.html` 对比受影响区块
- [ ] ⚠️ Playwright 截图基线 / 视觉回归**尚未实现**——如实说明，不得声称视觉验收通过
- [ ] 例外须登记 `design-system.md` §26 + 门禁 `ALLOWLIST`

## 禁止项
- 为局部效果随意创建冲突字号/颜色值；关闭 lint、放宽守卫、绕过 CI
- 未执行即声称通过；仅凭源码完成即宣称视觉验收通过

## 交付（AIES 第九章）
状态（PASSED/PARTIAL/BLOCKED/FAILED）｜修改文件及原因｜逐项验收证据｜实际测试命令与结果｜未解决风险｜Git 状态（是否提交/推送）
