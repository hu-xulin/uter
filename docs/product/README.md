# UTER 产品原型与 PRD 一体化系统

> 本地 `main` 分支建设成果 · 模型版本 v1 · 2026-11-09T15:47:41.777Z

## 入口

| 入口 | 地址 / 路径 |
| --- | --- |
| 产品规格中心（可操作 SPA） | `http://127.0.0.1:7788/`（`node tools/product-workspace/server.mjs`） |
| 左侧 Prototype / 右侧 PRD 双栏 | 规格中心 → Feature Catalog → 任一 Feature → 左右双栏详情 |
| 交互式 HTML 原型（56 份） | `docs/product/prototypes/{domain}/<Feature ID>.html` —— 浏览器直接打开，左原型 / 右 PRD 同源双栏 |
| 唯一权威数据模型 | `docs/product/registry/product-model.json` |
| 功能目录 | `docs/product/PRODUCT-FEATURE-CATALOG.md` |
| 最终报告 | `docs/product/reports/UTER-PRODUCT-PRD-PROTOTYPE-SYSTEM-FINAL-REPORT.md` |

## 目录

| 目录 | 内容 |
| --- | --- |
| prd/{domain}/ | 56 份 PRD（12 必备章节，模型投影） |
| prototypes/{domain}/ | 56 份交互式 HTML 原型（左原型 / 右 PRD 同源双栏）+ 56 份原型说明 Markdown（均为模型投影） |
| registry/ | 统一模型 + 5 类注册表 |
| mappings/ | 可读追溯矩阵 |
| standards/ 与根目录 STD 文档 | ID / PRD / 原型 / 追溯 / 同步 / 门禁规范 |
| reports/ | 覆盖率、一致性、双向同步、最终报告 |
| history/ | vN.json 版本快照（恢复用） |
| tools/product-workspace/ | 构建、引擎、服务、SPA、测试 |

## 核心原则

1. **Single Source of Truth**：PRD 与 Prototype 是同一结构化模型的两个可编辑投影，不存在两份独立事实。
2. **不靠字符串替换同步**：所有编辑经 `engine.applyChange()` 事务化写入统一模型，再双向派生另一侧并重渲染投影。
3. **真实证据**：功能状态来自真实前后端代码盘点，`UNKNOWN` 不编造，`NOT_IMPLEMENTED` 规划原型不冒充上线。
4. **MOCK 安全**：所有模拟交易标记 `DEMO / MOCK`，不触碰真实资金与生产数据。
5. **可追溯**：Feature / Requirement / Page / Interaction / Component / API / Data Model / Acceptance / Test Case / Change 全链路 ID 关联。
