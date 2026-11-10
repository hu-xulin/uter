# 新增功能强制门禁与质量规范

> UTER 产品原型与 PRD 一体化系统 · 规范编号 STD-GATE-01 · 生效版本 v1 · 2026-11-09T15:47:41.777Z
> 本规范由统一需求模型驱动；唯一事实源 `docs/product/registry/product-model.json`。设计基线：UTER Design System 3.0。

## 1. 强制门禁顺序
`Feature ID → PRD → Prototype → Mapping → Validation → Implementation → Testing → Acceptance`

| 检查项 | 要求 |
| --- | --- |
| G1_FEATURE_ID | 符合 UTER-{DOMAIN}-{NUMBER} |
| G2_UNIQUE | 全局唯一且不在 tombstone 中 |
| G3_PRD | 提供 PRD 背景 / 目标 |
| G4_PROTOTYPE | 提供至少一个原型页面 |
| G5_ACCEPTANCE | 定义 Given/When/Then 验收标准 |
| G6_MAPPING | 提供需求条目以建立映射 |
| G7_TEST | 关联可执行测试路径（.mjs / .ts） |

## 2. 适用范围
- 涉及**用户可见行为、业务规则、权限、数据处理或交互变化**的变更，必须同步更新 PRD 与 Prototype 并通过 `validate()`。
- 纯技术重构（不改变上述内容）不机械要求新增 PRD，但仍需在变更记录中说明 `NO_PRODUCT_CHANGE` 理由。
- 未通过 `gate()` 的新增功能不得进入 Implementation。

## 3. 质量门禁命令（真实执行后记录）
| 层面 | 命令 |
| --- | --- |
| Go 格式 / 静态检查 | `gofmt -l .` / `go vet ./...` |
| Go 测试 | `make test` 或 `go test ./...` |
| 前端类型 / Lint / 单测 | `bun run typecheck` / `bun run lint` / `bun run test` |
| 设计系统 / 版权 / 构建 | `bun run lint:design:strict` / `bun run copyright:check` / `bun run build:check` |
| 产品系统专项 | `node --test tools/product-workspace/tests/*.test.mjs` |
| 一致性检查 | `node tools/product-workspace/check.mjs` |

## 4. 结果口径
以**真实命令退出码与输出**判定通过与否；不得凭测试文件存在、命令被写入文档或预期结果判定通过。失败项必须如实记录并进入最终报告的剩余问题。
