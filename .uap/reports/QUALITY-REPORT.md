# Quality Report

> 由 `./uap report` 依据真实运行产物生成 · 2026-11-16T12:10:58.578Z · UAP 1.0.0
> 数据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与实时文件系统探测。

## 质量门禁

命令 `bash scripts/verify-all.sh`，退出码 **0**，失败门禁 0。

## 构建结果

| 项目 | 结果 |
| --- | --- |
| UAP 模块语法检查 | 182 个，失败 0 |
| bun run build:check | exit 0 |
| go build ./... | exit 0 |
| bun run typecheck | exit 0 |
| go vet ./... | exit 0 |
| bun run lint:design:strict | exit 0 |
| verify web/dist artifact (index.html + >3 files) | exit 0 |


## 验证器结果

32 PASS / 0 FAIL / 0 BLOCKED / undefined NOT_EXECUTED（共 32）

## 不得降低门禁

本报告不通过删除测试、放宽断言或忽略错误来取得绿色结果；所有失败均如实记录。
