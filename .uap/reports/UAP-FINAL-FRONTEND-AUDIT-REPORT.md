# 前端审计报告

> 仓库 https://github.com/hu-xulin/uter · 分支 `main` · HEAD `cfb471c6cd043d81228e9703ff95d6d61c61da62` · 执行 `UAP-EXEC-20261116115030-6a0ef6da` · 生成于 2026-11-16 20:12:05
> 证据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与真实命令退出码。任何 PASS 均绑定本次执行。

## 门禁

tsgo 类型检查 0；oxlint 0 error；i18n 7312 静态键 + 701 登记键在 7 语言包齐全；设计令牌 strict PASS；Showcase 数据链 PASS；format PASS；copyright PASS；vitest 289 文件 / 3064 用例全部通过；生产构建通过。

## 设计系统

- UDS 8.0 圆角：sm 4 / md 6 / lg 10 / xl 12 / 2xl 16 / 3xl 20；Button/Input/Select 绑定 `--ds-radius-button`（=lg 10）。
- Hero 统一 4xl 36/44，规范、Showcase 与运行时一致。
- `check-design-system-8.0.0.mjs` 22/22 PASS；展示页与 manifest 同步（944,171 chars）。

## 视觉

- Playwright 29 规格：26 diff，全部源于本次获批的圆角/Hero 视觉变更；门禁禁止批量更新基线（需人工审核重冻结），故保持 FAIL 并如实登记。
