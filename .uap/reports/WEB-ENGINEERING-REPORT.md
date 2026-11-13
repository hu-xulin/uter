# Web Engineering Report

> 由 `./uap report` 依据真实运行产物生成 · 2026-11-13T03:32:03.890Z · UAP 1.0.0
> 数据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与实时文件系统探测。

## 技术栈探测

web/package.json 存在；脚本 39 个：dev, build, build:check, docs:search-index, docs:sitemap, docs:assets:check, prepare, typecheck, lint, lint:design, lint:design:strict, lint:design:baseline, lint:design:baseline:update, lint:fix, lint:plugins, format:plugins, format:plugins:check, preview, test, test:visual, test:visual:update, test:visual:e2e, test:visual:e2e:update, test:visual:e2e:auth, test:axe, test:watch, format:check, format, copyright:check, copyright, i18n:sync, settings:hints, i18n:check, knip, design:tokens:generate, design:tokens:check, verify:contrast, components:registry:check, components:registry:strict。

## 真实命令结果

| 命令 | 退出码 | 耗时 |
| --- | --- | --- |
| bun run build:check | 0 | 30925ms |
| go build ./... | 0 | 44111ms |
| bun run typecheck | 0 | 8982ms |


## 前端文件统计

web/src 下 TS/TSX 文件 1522 个；设计系统目录 存在。
