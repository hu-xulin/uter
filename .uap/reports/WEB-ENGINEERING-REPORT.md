# Web Engineering Report

> 由 `./uap report` 依据真实运行产物生成 · 2026-11-24T07:46:09.902Z · UAP 1.0.0
> 数据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与实时文件系统探测。

## 技术栈探测

web/package.json 存在；脚本 42 个：dev, build, build:check, docs:search-index, docs:sitemap, docs:assets:check, prepare, typecheck, lint, lint:design, lint:design:strict, lint:design:baseline, lint:design:baseline:update, lint:fix, lint:plugins, format:plugins, format:plugins:check, preview, test, test:visual, test:visual:update, test:visual:e2e, test:visual:e2e:update, test:visual:e2e:auth, test:axe, test:watch, format:check, format, copyright:check, copyright, i18n:sync, settings:hints, i18n:check, knip, design:tokens:generate, design:tokens:check, design:showcase:check, verify:contrast, components:registry:check, components:registry:strict, test:business:e2e, design:8:check。

## 真实命令结果

| 命令 | 退出码 | 耗时 |
| --- | --- | --- |
| bun run build:check | 0 | 45093ms |
| go build ./... | 1 | 8480ms |
| bun run typecheck | 0 | 10799ms |
| go vet ./... | 0 | 39710ms |
| bun run lint:design:strict | 0 | 2608ms |
| verify web/dist artifact (index.html + >3 files) | 0 | 0ms |


## 前端文件统计

web/src 下 TS/TSX 文件 1624 个；设计系统目录 存在。
