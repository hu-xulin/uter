# UAP 1.0 — 规范追踪矩阵

> 由 `node .uap/tools/requirement-matrix.mjs` 从 32 份规范原文真实提取生成。
> 生成时间：2026-11-13T01:35:31.367Z。ID 策略：stable: <spec-id>-REQ|ACC-<ordinal-in-section>; text hash stored separately, never used to mint IDs。

## 汇总

| 项 | 数量 |
| --- | ---: |
| 规范 | 32 |
| 要求总数 | 538 |
| 强制性要求 | 402 |
| 验收条件 | 136 |
| 已发现测试用例 | 49 |

## 实现状态分布

| 状态 | 数量 |
| --- | ---: |
| IMPLEMENTED | 366 |
| IMPLEMENTED_NOT_VERIFIED | 172 |

## 验证状态分布

| 状态 | 数量 |
| --- | ---: |
| NOT_VERIFIED | 538 |

> `VERIFIED` 只在该要求同时具备「当前执行 ID 的证据」与「真实链接的测试用例」时出现；
> 规范头部自述的 `ACTIVE` 不会被当作验证证据。

## 按规范索引

| 规范 | 自述状态 | 要求数 | 要求 ID 范围 |
| --- | --- | ---: | --- |
| UAP-00-001 | null | 18 | UAP-00-001-REQ-001 … UAP-00-001-ACC-006 |
| UAP-00-002 | null | 20 | UAP-00-002-REQ-001 … UAP-00-002-ACC-005 |
| UAP-00-003 | null | 19 | UAP-00-003-REQ-001 … UAP-00-003-ACC-005 |
| UAP-00-004 | null | 19 | UAP-00-004-REQ-001 … UAP-00-004-ACC-005 |
| UAP-01-001 | null | 15 | UAP-01-001-REQ-001 … UAP-01-001-ACC-003 |
| UAP-01-002 | null | 17 | UAP-01-002-REQ-001 … UAP-01-002-ACC-005 |
| UAP-01-003 | null | 16 | UAP-01-003-REQ-001 … UAP-01-003-ACC-004 |
| UAP-02-001 | null | 16 | UAP-02-001-REQ-001 … UAP-02-001-ACC-004 |
| UAP-02-002 | null | 18 | UAP-02-002-REQ-001 … UAP-02-002-ACC-004 |
| UAP-02-003 | null | 13 | UAP-02-003-REQ-001 … UAP-02-003-ACC-003 |
| UAP-03-001 | null | 14 | UAP-03-001-REQ-001 … UAP-03-001-ACC-004 |
| UAP-03-002 | null | 16 | UAP-03-002-REQ-001 … UAP-03-002-ACC-004 |
| UAP-03-003 | null | 16 | UAP-03-003-REQ-001 … UAP-03-003-ACC-004 |
| UAP-03-004 | null | 16 | UAP-03-004-REQ-001 … UAP-03-004-ACC-004 |
| UAP-04-001 | null | 17 | UAP-04-001-REQ-001 … UAP-04-001-ACC-005 |
| UAP-04-002 | null | 16 | UAP-04-002-REQ-001 … UAP-04-002-ACC-004 |
| UAP-04-003 | null | 16 | UAP-04-003-REQ-001 … UAP-04-003-ACC-004 |
| UAP-05-001 | null | 16 | UAP-05-001-REQ-001 … UAP-05-001-ACC-004 |
| UAP-05-002 | null | 18 | UAP-05-002-REQ-001 … UAP-05-002-ACC-004 |
| UAP-05-003 | null | 18 | UAP-05-003-REQ-001 … UAP-05-003-ACC-004 |
| UAP-05-004 | null | 16 | UAP-05-004-REQ-001 … UAP-05-004-ACC-004 |
| UAP-06-001 | null | 17 | UAP-06-001-REQ-001 … UAP-06-001-ACC-004 |
| UAP-06-002 | null | 25 | UAP-06-002-REQ-001 … UAP-06-002-ACC-007 |
| UAP-06-003 | null | 16 | UAP-06-003-REQ-001 … UAP-06-003-ACC-004 |
| UAP-07-001 | null | 16 | UAP-07-001-REQ-001 … UAP-07-001-ACC-004 |
| UAP-07-002 | null | 16 | UAP-07-002-REQ-001 … UAP-07-002-ACC-004 |
| UAP-07-003 | null | 16 | UAP-07-003-REQ-001 … UAP-07-003-ACC-004 |
| UAP-08-001 | null | 16 | UAP-08-001-REQ-001 … UAP-08-001-ACC-004 |
| UAP-08-002 | null | 16 | UAP-08-002-REQ-001 … UAP-08-002-ACC-004 |
| UAP-08-003 | null | 16 | UAP-08-003-REQ-001 … UAP-08-003-ACC-004 |
| UAP-09-001 | null | 16 | UAP-09-001-REQ-001 … UAP-09-001-ACC-004 |
| UAP-09-002 | null | 18 | UAP-09-002-REQ-001 … UAP-09-002-ACC-004 |

## 要求明细

| Requirement ID | 状态 | 验证 | 实现文件 | 测试 | 阻断 | 要求 |
| --- | --- | --- | --- | ---: | --- | --- |
| `UAP-00-001-REQ-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | UAP 是 Uter 内部唯一的 AI 自主工程治理和执行平台。 |
| `UAP-00-001-REQ-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | UAP 由规范层、配置层、运行时层、执行引擎层、验证层、证据层组成。 |
| `UAP-00-001-REQ-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 规范层定义工程规则；配置层将规则映射到机器执行对象；运行时层负责调度；执行引擎负责实际操作；验证层负责判定；证据层负责记录。 |
| `UAP-00-001-REQ-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 任何规范不得只有文字要求而没有执行映射。 |
| `UAP-00-001-REQ-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 任何强制性规范必须对应至少一个执行器和一个验证器。 |
| `UAP-00-001-REQ-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 任何执行器必须声明输入、输出、权限、失败状态和可恢复策略。 |
| `UAP-00-001-REQ-007` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 任何验证器必须返回机器可读结果。 |
| `UAP-00-001-REQ-008` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 系统模块之间通过稳定接口通信，禁止通过隐式全局状态传递任务。 |
| `UAP-00-001-REQ-009` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 所有任务必须有唯一 ID、执行状态、执行时间、责任 Agent 和证据引用。 |
| `UAP-00-001-REQ-010` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 配置、规范、代码和验证结果必须可追溯。 |
| `UAP-00-001-REQ-011` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | UAP 必须支持独立运行，不得要求外部治理平台提供必要能力。 |
| `UAP-00-001-REQ-012` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | UAP 内部组件应遵循单一职责、可替换、可测试和可恢复原则。 |
| `UAP-00-001-ACC-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 核心组件真实存在。 |
| `UAP-00-001-ACC-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 模块依赖关系可解析。 |
| `UAP-00-001-ACC-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 规范、执行器、验证器能够映射。 |
| `UAP-00-001-ACC-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | Runtime 能启动并返回健康状态。 |
| `UAP-00-001-ACC-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 不存在无法解释的循环依赖。 |
| `UAP-00-001-ACC-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 所有关键接口均有自动化测试。 |
| `UAP-00-002-REQ-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 1 | 用户任务必须转换为结构化任务。 |
| `UAP-00-002-REQ-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 1 | 任务必须拆分为可执行子任务。 |
| `UAP-00-002-REQ-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 1 | 每个子任务必须包含目标、输入、输出、依赖、权限、验收标准。 |
| `UAP-00-002-REQ-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 1 | 系统必须自动计算可执行顺序。 |
| `UAP-00-002-REQ-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 1 | 无依赖任务允许并行执行；有依赖任务必须等待前置任务完成。 |
| `UAP-00-002-REQ-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 1 | 并行执行必须受资源限制和文件冲突检测约束。 |
| `UAP-00-002-REQ-007` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 1 | 执行前必须进行权限检查。 |
| `UAP-00-002-REQ-008` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 1 | 执行过程中必须持续记录状态和证据。 |
| `UAP-00-002-REQ-009` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 1 | 任务失败必须分类为可重试、需修复、权限阻断或外部依赖阻断。 |
| `UAP-00-002-REQ-010` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 1 | 可重试任务必须有最大重试次数和退避策略。 |
| `UAP-00-002-REQ-011` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 1 | 同一任务恢复执行时不得重复产生非幂等副作用。 |
| `UAP-00-002-REQ-012` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 1 | 任务完成后必须执行验收。 |
| `UAP-00-002-REQ-013` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 1 | 未达到验收标准不得标记为完成。 |
| `UAP-00-002-REQ-014` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 1 | 自动执行不得突破权限策略。 |
| `UAP-00-002-REQ-015` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 1 | 用户明确要求的任务不得以生成计划或报告替代实际执行。 |
| `UAP-00-002-ACC-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 1 | 能够从自然语言生成任务。 |
| `UAP-00-002-ACC-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 1 | 能够执行任务依赖图。 |
| `UAP-00-002-ACC-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 1 | 能够中断并恢复。 |
| `UAP-00-002-ACC-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 1 | 能够识别权限阻断。 |
| `UAP-00-002-ACC-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 1 | 能够生成任务完成证据。 |
| `UAP-00-003-REQ-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 所有 Agent 必须使用明确身份和权限。 |
| `UAP-00-003-REQ-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 默认采用最小权限原则。 |
| `UAP-00-003-REQ-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 读取、写入、执行命令、网络访问、数据库访问和发布权限必须分开定义。 |
| `UAP-00-003-REQ-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 高风险操作必须在执行前进行策略判断。 |
| `UAP-00-003-REQ-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 生产资金、生产数据库、生产密钥和不可逆生产发布默认禁止自动执行。 |
| `UAP-00-003-REQ-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 模拟环境与生产环境必须明确隔离。 |
| `UAP-00-003-REQ-007` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 禁止将密钥、Token、密码写入日志、报告或提交记录。 |
| `UAP-00-003-REQ-008` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 外部输入、网页内容、仓库内容和 Agent 输出均视为不可信数据。 |
| `UAP-00-003-REQ-009` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 不可信数据不得覆盖系统权限规则。 |
| `UAP-00-003-REQ-010` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 所有敏感操作必须记录审计事件。 |
| `UAP-00-003-REQ-011` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 权限不足时必须停止相关动作，而不是绕过检查。 |
| `UAP-00-003-REQ-012` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 安全策略不得由普通任务自行修改。 |
| `UAP-00-003-REQ-013` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 安全失败必须阻断相关任务。 |
| `UAP-00-003-REQ-014` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须支持密钥脱敏和日志清理。 |
| `UAP-00-003-ACC-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 权限策略能够被 Runtime 加载。 |
| `UAP-00-003-ACC-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 越权操作测试被拒绝。 |
| `UAP-00-003-ACC-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 密钥扫描能够发现测试用秘密。 |
| `UAP-00-003-ACC-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 敏感信息不会出现在普通日志。 |
| `UAP-00-003-ACC-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 模拟与生产配置隔离。 |
| `UAP-00-004-REQ-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 每次任务执行必须产生唯一执行记录。 |
| `UAP-00-004-REQ-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 每条规范、每个执行器和每个验证器必须有状态。 |
| `UAP-00-004-REQ-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 状态必须区分 NOT_BUILT / PARTIALLY_BUILT / IMPLEMENTED_NOT_VERIFIED / PARTIALLY_VERIFIED / FULLY |
| `UAP-00-004-REQ-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | FULLY_VERIFIED 必须有完整的验证证据。 |
| `UAP-00-004-REQ-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | FULLY_OPERATIONAL 必须有实际启动、端到端任务、恢复和运行证据。 |
| `UAP-00-004-REQ-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 文件存在不能证明功能实现。 |
| `UAP-00-004-REQ-007` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 命令存在不能证明命令可运行。 |
| `UAP-00-004-REQ-008` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 测试文件存在不能证明测试通过。 |
| `UAP-00-004-REQ-009` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 验证结果必须记录命令、退出码、时间、环境、输入、输出和日志引用。 |
| `UAP-00-004-REQ-010` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 报告必须能追溯到原始证据。 |
| `UAP-00-004-REQ-011` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 证据必须有稳定 ID。 |
| `UAP-00-004-REQ-012` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 执行状态必须可恢复，不能只存在于内存。 |
| `UAP-00-004-REQ-013` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 历史证据不得被新结果静默覆盖。 |
| `UAP-00-004-REQ-014` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 失败证据不得删除以制造通过结果。 |
| `UAP-00-004-ACC-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 状态持久化真实可用。 |
| `UAP-00-004-ACC-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 任务中断后能够恢复。 |
| `UAP-00-004-ACC-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 证据引用有效。 |
| `UAP-00-004-ACC-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 报告能够定位原始验证记录。 |
| `UAP-00-004-ACC-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 状态转换受到规则约束。 |
| `UAP-01-001-REQ-001` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 每个产品功能必须有唯一 Feature ID。 |
| `UAP-01-001-REQ-002` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 每个功能必须包含目标用户、使用场景、业务价值和验收标准。 |
| `UAP-01-001-REQ-003` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 功能需求必须区分用户需求、系统需求和技术约束。 |
| `UAP-01-001-REQ-004` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 必须识别功能前置条件、异常流程和边界条件。 |
| `UAP-01-001-REQ-005` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 必须维护 Feature Registry。 |
| `UAP-01-001-REQ-006` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 每个 Feature 必须关联 PRD、原型、代码模块、测试和发布记录。 |
| `UAP-01-001-REQ-007` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 不允许出现没有需求来源的重大业务功能。 |
| `UAP-01-001-REQ-008` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 需求变更必须触发影响分析。 |
| `UAP-01-001-REQ-009` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 影响分析必须覆盖 API、数据库、前端、后端、测试和文档。 |
| `UAP-01-001-REQ-010` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 需求状态必须包括 Draft、Approved、In Progress、Verified、Released、Deprecated。 |
| `UAP-01-001-REQ-011` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 不得将未经确认的业务假设标记为已批准需求。 |
| `UAP-01-001-REQ-012` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 需求验收必须有测试或其他可验证证据。 |
| `UAP-01-001-ACC-001` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 已有功能可以追溯到需求。 |
| `UAP-01-001-ACC-002` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 关键功能不存在无来源、无验收标准的孤立实现。 |
| `UAP-01-001-ACC-003` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 需求变更能够产生影响分析记录。 |
| `UAP-01-002-REQ-001` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 每个功能必须有唯一 Feature ID。 |
| `UAP-01-002-REQ-002` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | PRD 与原型必须使用相同 Feature ID 和页面/组件标识。 |
| `UAP-01-002-REQ-003` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 产品展示界面采用左侧原型、右侧 PRD 的对应关系。 |
| `UAP-01-002-REQ-004` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | PRD 修改后必须生成原型影响清单。 |
| `UAP-01-002-REQ-005` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 原型修改后必须生成 PRD 影响清单。 |
| `UAP-01-002-REQ-006` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 双向同步必须保留变更历史。 |
| `UAP-01-002-REQ-007` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 必须支持页面、组件、交互、状态、字段、校验和异常流程的对应。 |
| `UAP-01-002-REQ-008` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 同步不能仅依赖文件名或页面标题，必须使用稳定 ID。 |
| `UAP-01-002-REQ-009` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 不一致时必须产生差异记录。 |
| `UAP-01-002-REQ-010` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 未解决的差异不得标记为同步完成。 |
| `UAP-01-002-REQ-011` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 自动同步不得擅自改变已批准的业务规则。 |
| `UAP-01-002-REQ-012` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 必须支持人工确认有歧义的需求，但不应要求人工重复确认确定性机械变更。 |
| `UAP-01-002-ACC-001` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 每个页面能够定位对应 PRD。 |
| `UAP-01-002-ACC-002` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | PRD 和原型能够双向发现变化。 |
| `UAP-01-002-ACC-003` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 差异有记录。 |
| `UAP-01-002-ACC-004` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 自动同步有测试。 |
| `UAP-01-002-ACC-005` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 变更历史可追溯。 |
| `UAP-01-003-REQ-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 业务规则必须集中登记。 |
| `UAP-01-003-REQ-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 每条规则必须有唯一 Rule ID。 |
| `UAP-01-003-REQ-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 规则必须包含条件、行为、结果、异常、优先级和适用范围。 |
| `UAP-01-003-REQ-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 业务规则必须与代码实现、API、数据库和测试关联。 |
| `UAP-01-003-REQ-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 相互冲突的规则必须被检测。 |
| `UAP-01-003-REQ-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 规则修改必须执行影响分析。 |
| `UAP-01-003-REQ-007` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 关键资金规则必须采用精确金额类型和明确舍入策略。 |
| `UAP-01-003-REQ-008` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 权限、额度、计费、退款和订单状态必须具有明确状态转换。 |
| `UAP-01-003-REQ-009` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 状态转换必须禁止非法回退和非法跳转。 |
| `UAP-01-003-REQ-010` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 业务规则不得只存在于前端。 |
| `UAP-01-003-REQ-011` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 后端必须执行关键业务约束。 |
| `UAP-01-003-REQ-012` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 关键规则必须有正向、反向、边界和并发测试。 |
| `UAP-01-003-ACC-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 核心业务规则有唯一 ID。 |
| `UAP-01-003-ACC-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 代码与规则可追溯。 |
| `UAP-01-003-ACC-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 关键规则具有自动化验证。 |
| `UAP-01-003-ACC-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 冲突规则可以被发现。 |
| `UAP-02-001-REQ-001` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 必须识别系统边界、模块边界和外部依赖。 |
| `UAP-02-001-REQ-002` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 必须维护系统架构图和模块依赖图。 |
| `UAP-02-001-REQ-003` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 模块必须遵循明确的职责划分。 |
| `UAP-02-001-REQ-004` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 禁止未经论证的跨模块直接耦合。 |
| `UAP-02-001-REQ-005` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 模块间通信必须使用明确接口。 |
| `UAP-02-001-REQ-006` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 架构变更必须记录 ADR。 |
| `UAP-02-001-REQ-007` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 架构分析必须包含可扩展性、可靠性、安全性和维护成本。 |
| `UAP-02-001-REQ-008` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 关键业务链路必须有端到端架构说明。 |
| `UAP-02-001-REQ-009` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 必须识别单点故障和关键依赖。 |
| `UAP-02-001-REQ-010` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 不得为了形式化而无理由引入微服务或复杂基础设施。 |
| `UAP-02-001-REQ-011` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 架构图必须与实际代码保持一致。 |
| `UAP-02-001-REQ-012` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 架构变更必须执行依赖影响验证。 |
| `UAP-02-001-ACC-001` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 架构图与代码结构一致。 |
| `UAP-02-001-ACC-002` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 模块依赖可分析。 |
| `UAP-02-001-ACC-003` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 关键业务链路可追溯。 |
| `UAP-02-001-ACC-004` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 架构变更有 ADR。 |
| `UAP-02-002-REQ-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | API 必须定义路径、方法、参数、响应、错误码和权限。 |
| `UAP-02-002-REQ-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | API 必须进行输入验证和输出约束。 |
| `UAP-02-002-REQ-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | API 必须考虑兼容性、幂等性和限流。 |
| `UAP-02-002-REQ-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 数据库表必须定义字段类型、约束、索引和关联关系。 |
| `UAP-02-002-REQ-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 金额字段必须采用适合精确计算的类型。 |
| `UAP-02-002-REQ-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 数据库迁移必须可追踪、可验证。 |
| `UAP-02-002-REQ-007` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 迁移不得静默删除生产数据。 |
| `UAP-02-002-REQ-008` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 破坏性迁移必须有备份和回滚方案。 |
| `UAP-02-002-REQ-009` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 数据库访问必须遵循事务边界。 |
| `UAP-02-002-REQ-010` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 关键业务操作必须检查并发竞争。 |
| `UAP-02-002-REQ-011` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | API 变更必须执行兼容性检查。 |
| `UAP-02-002-REQ-012` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 数据库模型变更必须同步更新相关测试和文档。 |
| `UAP-02-002-REQ-013` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 数据库迁移必须在隔离测试数据库中验证。 |
| `UAP-02-002-REQ-014` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 禁止在本次 UAP 建设中擅自连接生产数据库执行写入。 |
| `UAP-02-002-ACC-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | API 定义与实现一致。 |
| `UAP-02-002-ACC-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 数据模型与迁移一致。 |
| `UAP-02-002-ACC-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 迁移测试通过。 |
| `UAP-02-002-ACC-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 幂等和并发测试覆盖关键接口。 |
| `UAP-02-003-REQ-001` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 重要技术决策必须记录 ADR。 |
| `UAP-02-003-REQ-002` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | ADR 包含背景、问题、备选方案、决策、理由、影响和状态。 |
| `UAP-02-003-REQ-003` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 决策必须说明成本和风险。 |
| `UAP-02-003-REQ-004` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 已废弃决策必须记录替代方案。 |
| `UAP-02-003-REQ-005` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 不得仅因为某项技术流行就引入。 |
| `UAP-02-003-REQ-006` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 不得在没有必要时替换现有成熟技术栈。 |
| `UAP-02-003-REQ-007` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 技术决策必须考虑 Uter 现有架构和部署环境。 |
| `UAP-02-003-REQ-008` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 重大依赖变更必须进行兼容性和安全性评估。 |
| `UAP-02-003-REQ-009` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 决策实施后必须验证其实际效果。 |
| `UAP-02-003-REQ-010` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 发现原决策不再成立时，必须提出 ADR 修订。 |
| `UAP-02-003-ACC-001` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 重大技术选择可追溯。 |
| `UAP-02-003-ACC-002` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 不存在无理由的大规模技术栈替换。 |
| `UAP-02-003-ACC-003` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 决策与实际代码一致。 |
| `UAP-03-001-REQ-001` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 每个 Agent 必须有唯一 ID、名称、职责和版本。 |
| `UAP-03-001-REQ-002` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 每个 Agent 必须声明输入、输出、工具、权限和依赖。 |
| `UAP-03-001-REQ-003` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | Agent 必须有明确的任务范围。 |
| `UAP-03-001-REQ-004` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | Agent 不得自行扩大权限。 |
| `UAP-03-001-REQ-005` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | Agent 必须支持结构化输入和输出。 |
| `UAP-03-001-REQ-006` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | Agent 必须具有超时和失败处理机制。 |
| `UAP-03-001-REQ-007` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | Agent 必须支持可观测性。 |
| `UAP-03-001-REQ-008` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | Agent 不得将未经验证的推断作为事实输出。 |
| `UAP-03-001-REQ-009` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | Agent 之间通过明确消息协议协作。 |
| `UAP-03-001-REQ-010` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | Agent 版本变更必须执行兼容性验证。 |
| `UAP-03-001-ACC-001` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 所有 Agent 已登记 |
| `UAP-03-001-ACC-002` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 所有 Agent 权限可解析 |
| `UAP-03-001-ACC-003` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | Agent 能通过 Runtime 被调用 |
| `UAP-03-001-ACC-004` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | Agent 接口有测试。 |
| `UAP-03-002-REQ-001` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | Agent 只能执行分配给自己的任务。 |
| `UAP-03-002-REQ-002` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 任务必须包含目标、上下文、约束和验收标准。 |
| `UAP-03-002-REQ-003` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | Agent 执行前必须进行权限校验。 |
| `UAP-03-002-REQ-004` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | Agent 执行结果必须结构化。 |
| `UAP-03-002-REQ-005` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 执行结果必须包含状态、摘要、修改文件、测试和证据。 |
| `UAP-03-002-REQ-006` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | Agent 不得伪造工具运行结果。 |
| `UAP-03-002-REQ-007` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | Agent 不得将模型推理结果冒充真实测试。 |
| `UAP-03-002-REQ-008` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 工具调用必须记录参数摘要和结果。 |
| `UAP-03-002-REQ-009` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 失败必须返回标准错误分类。 |
| `UAP-03-002-REQ-010` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | Agent 必须遵守任务超时、Token 和资源限制。 |
| `UAP-03-002-REQ-011` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 关键修改必须由独立验证器复验。 |
| `UAP-03-002-REQ-012` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | Agent 输出必须经过结果校验后才能进入下一阶段。 |
| `UAP-03-002-ACC-001` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | Agent 执行有权限边界 |
| `UAP-03-002-ACC-002` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 输出可解析 |
| `UAP-03-002-ACC-003` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 失败可识别 |
| `UAP-03-002-ACC-004` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 结果有独立验证。 |
| `UAP-03-003-REQ-001` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 任务由 Orchestrator 统一分配。 |
| `UAP-03-003-REQ-002` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 多 Agent 必须通过任务 ID 和消息 ID 关联。 |
| `UAP-03-003-REQ-003` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 必须明确任务负责人。 |
| `UAP-03-003-REQ-004` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 并行任务必须检查文件修改冲突。 |
| `UAP-03-003-REQ-005` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 共享资源必须有锁或等效并发控制。 |
| `UAP-03-003-REQ-006` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | Agent 之间不得通过非结构化文本暗中传递关键状态。 |
| `UAP-03-003-REQ-007` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 冲突必须交由协调器处理。 |
| `UAP-03-003-REQ-008` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 依赖任务必须按 DAG 顺序执行。 |
| `UAP-03-003-REQ-009` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 重复任务必须识别并去重。 |
| `UAP-03-003-REQ-010` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 多 Agent 结果必须进行汇总和一致性检查。 |
| `UAP-03-003-REQ-011` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 关键业务决策必须记录来源。 |
| `UAP-03-003-REQ-012` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 协作失败必须支持重新分配或恢复。 |
| `UAP-03-003-ACC-001` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 任务 DAG 可执行 |
| `UAP-03-003-ACC-002` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 冲突能够检测 |
| `UAP-03-003-ACC-003` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 重复任务能够识别 |
| `UAP-03-003-ACC-004` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 协作结果可追溯。 |
| `UAP-03-004-REQ-001` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 1 | Agent 任务必须持久化状态。 |
| `UAP-03-004-REQ-002` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 1 | Runtime 中断后必须能够恢复任务。 |
| `UAP-03-004-REQ-003` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 1 | 恢复时必须检查任务是否已经产生副作用。 |
| `UAP-03-004-REQ-004` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 1 | 非幂等操作不得直接重复执行。 |
| `UAP-03-004-REQ-005` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 1 | 任务恢复必须校验上下文版本。 |
| `UAP-03-004-REQ-006` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 1 | 失败任务必须记录失败原因。 |
| `UAP-03-004-REQ-007` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 1 | 超时任务必须进入明确的恢复状态。 |
| `UAP-03-004-REQ-008` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 1 | 不可恢复任务必须标记 BLOCKED 或 FAILED。 |
| `UAP-03-004-REQ-009` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 1 | 必须支持任务取消。 |
| `UAP-03-004-REQ-010` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 1 | 必须支持任务暂停和续跑。 |
| `UAP-03-004-REQ-011` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 1 | 恢复后必须进行必要的状态一致性检查。 |
| `UAP-03-004-REQ-012` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 1 | 不得通过重置状态隐藏失败历史。 |
| `UAP-03-004-ACC-001` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 1 | 能够模拟进程中断 |
| `UAP-03-004-ACC-002` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 1 | 能够恢复任务 |
| `UAP-03-004-ACC-003` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 1 | 重复副作用得到防护 |
| `UAP-03-004-ACC-004` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 1 | 恢复证据完整。 |
| `UAP-04-001-REQ-001` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 遵循项目现有语言和框架约定。 |
| `UAP-04-001-REQ-002` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 优先复用现有模块和基础设施。 |
| `UAP-04-001-REQ-003` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 避免无必要重复实现。 |
| `UAP-04-001-REQ-004` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 类型、命名、异常和日志必须保持一致。 |
| `UAP-04-001-REQ-005` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 禁止提交无效代码、死代码和无用依赖。 |
| `UAP-04-001-REQ-006` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 不得通过忽略类型错误或关闭 Lint 规则规避问题。 |
| `UAP-04-001-REQ-007` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 关键逻辑必须有测试。 |
| `UAP-04-001-REQ-008` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 敏感数据不得写入普通日志。 |
| `UAP-04-001-REQ-009` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | API、数据库和业务规则变更必须同步更新文档。 |
| `UAP-04-001-REQ-010` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 复杂逻辑必须有必要的注释和说明。 |
| `UAP-04-001-REQ-011` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 代码修改必须遵守现有架构边界。 |
| `UAP-04-001-REQ-012` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 格式化和静态检查必须纳入自动执行。 |
| `UAP-04-001-ACC-001` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 格式化通过 |
| `UAP-04-001-ACC-002` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | Lint 通过 |
| `UAP-04-001-ACC-003` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 类型检查通过 |
| `UAP-04-001-ACC-004` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 关键逻辑测试通过 |
| `UAP-04-001-ACC-005` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 无新增无效代码。 |
| `UAP-04-002-REQ-001` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 每次代码变更必须自动审查。 |
| `UAP-04-002-REQ-002` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 审查范围包含正确性、安全性、性能、可维护性、兼容性和业务逻辑。 |
| `UAP-04-002-REQ-003` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 审查必须结合实际上下文，不得只做文本匹配。 |
| `UAP-04-002-REQ-004` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 必须识别空指针、异常吞噬、权限绕过、注入、竞态和资源泄漏。 |
| `UAP-04-002-REQ-005` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 必须识别金额计算、重复扣费、重复退款和状态不一致风险。 |
| `UAP-04-002-REQ-006` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 必须检查 API 兼容性和数据库迁移风险。 |
| `UAP-04-002-REQ-007` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 必须检查测试是否覆盖修改行为。 |
| `UAP-04-002-REQ-008` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 每个发现必须包含严重程度、文件位置、问题描述、根因和建议。 |
| `UAP-04-002-REQ-009` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 严重问题必须阻断质量门禁。 |
| `UAP-04-002-REQ-010` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 不得把风格偏好伪装为严重缺陷。 |
| `UAP-04-002-REQ-011` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 修复后必须重新审查。 |
| `UAP-04-002-REQ-012` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 审查结果必须保存证据。 |
| `UAP-04-002-ACC-001` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 自动审查引擎可执行 |
| `UAP-04-002-ACC-002` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 审查结果结构化 |
| `UAP-04-002-ACC-003` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 关键风险规则有测试 |
| `UAP-04-002-ACC-004` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 阻断问题能够阻止任务通过。 |
| `UAP-04-003-REQ-001` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 依赖必须有明确用途。 |
| `UAP-04-003-REQ-002` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 依赖版本必须受锁文件管理。 |
| `UAP-04-003-REQ-003` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 必须识别未使用、重复和过时依赖。 |
| `UAP-04-003-REQ-004` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 必须扫描已知安全漏洞。 |
| `UAP-04-003-REQ-005` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 依赖升级必须评估兼容性。 |
| `UAP-04-003-REQ-006` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 禁止未经评估自动升级全部依赖。 |
| `UAP-04-003-REQ-007` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 依赖许可证必须满足项目使用要求。 |
| `UAP-04-003-REQ-008` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 不得引入来源不明的二进制和脚本。 |
| `UAP-04-003-REQ-009` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 依赖变更必须执行构建和测试。 |
| `UAP-04-003-REQ-010` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 关键依赖必须记录替代方案。 |
| `UAP-04-003-REQ-011` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 禁止通过删除安全检查来消除扫描结果。 |
| `UAP-04-003-REQ-012` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 必须保存依赖审计报告。 |
| `UAP-04-003-ACC-001` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 锁文件有效 |
| `UAP-04-003-ACC-002` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 依赖清单可生成 |
| `UAP-04-003-ACC-003` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 漏洞扫描可执行 |
| `UAP-04-003-ACC-004` | IMPLEMENTED_NOT_VERIFIED | NOT_VERIFIED | 2 | 0 | 2 | 依赖变更经过测试。 |
| `UAP-05-001-REQ-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 质量工程由代码审查、自动化测试、自动修复和质量门禁组成。 |
| `UAP-05-001-REQ-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 四项能力必须协同工作。 |
| `UAP-05-001-REQ-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 质量检查必须覆盖代码、业务、架构、安全、数据和用户体验。 |
| `UAP-05-001-REQ-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 每次变更必须确定影响范围。 |
| `UAP-05-001-REQ-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 质量结果必须基于真实工具执行。 |
| `UAP-05-001-REQ-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须区分单元、集成、端到端和回归测试。 |
| `UAP-05-001-REQ-007` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 测试范围必须与修改风险匹配。 |
| `UAP-05-001-REQ-008` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 关键业务路径必须有端到端测试。 |
| `UAP-05-001-REQ-009` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 失败必须分类并关联缺陷。 |
| `UAP-05-001-REQ-010` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 不得通过降低门禁制造通过结果。 |
| `UAP-05-001-REQ-011` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 质量状态必须有证据。 |
| `UAP-05-001-REQ-012` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 质量系统自身也必须经过测试。 |
| `UAP-05-001-ACC-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 四项能力均真实运行 |
| `UAP-05-001-ACC-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 能够执行完整质量工作流 |
| `UAP-05-001-ACC-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 质量结果可以追溯 |
| `UAP-05-001-ACC-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 关键业务路径有自动化验证。 |
| `UAP-05-002-REQ-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 测试必须与实际功能对应。 |
| `UAP-05-002-REQ-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 单元测试验证独立逻辑。 |
| `UAP-05-002-REQ-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 集成测试验证模块和外部接口边界。 |
| `UAP-05-002-REQ-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 端到端测试验证完整用户流程。 |
| `UAP-05-002-REQ-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 回归测试验证既有功能不被破坏。 |
| `UAP-05-002-REQ-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须覆盖正常、异常、边界和权限场景。 |
| `UAP-05-002-REQ-007` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须覆盖关键并发和幂等场景。 |
| `UAP-05-002-REQ-008` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 测试必须可重复执行。 |
| `UAP-05-002-REQ-009` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 测试数据必须隔离。 |
| `UAP-05-002-REQ-010` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 测试不得依赖真实资金交易。 |
| `UAP-05-002-REQ-011` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 测试失败不得被静默忽略。 |
| `UAP-05-002-REQ-012` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 测试结果必须记录命令、退出码和证据。 |
| `UAP-05-002-REQ-013` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 覆盖率必须按实际结果报告，不得伪造。 |
| `UAP-05-002-REQ-014` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 不能只用覆盖率数字代替测试有效性。 |
| `UAP-05-002-ACC-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 测试套件可执行 |
| `UAP-05-002-ACC-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 关键业务测试通过 |
| `UAP-05-002-ACC-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 测试失败能正确阻断 |
| `UAP-05-002-ACC-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 测试结果有证据。 |
| `UAP-05-003-REQ-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 自动修复必须从已确认缺陷开始。 |
| `UAP-05-003-REQ-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须分析根因和影响范围。 |
| `UAP-05-003-REQ-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须生成修复计划。 |
| `UAP-05-003-REQ-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须优先修复根因，不得只掩盖症状。 |
| `UAP-05-003-REQ-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 修复必须符合代码规范和安全边界。 |
| `UAP-05-003-REQ-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 每个根因最多尝试 3 种实质不同的修复方案。 |
| `UAP-05-003-REQ-007` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 修复失败必须保留证据。 |
| `UAP-05-003-REQ-008` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 修复后必须执行相关测试。 |
| `UAP-05-003-REQ-009` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 关键修改必须重新审查。 |
| `UAP-05-003-REQ-010` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 失败后不得无限循环。 |
| `UAP-05-003-REQ-011` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 自动修复不得删除失败测试或降低质量门禁。 |
| `UAP-05-003-REQ-012` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 修复必须生成前后差异和验证报告。 |
| `UAP-05-003-REQ-013` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 修复涉及用户未提交内容时必须保护原始内容。 |
| `UAP-05-003-REQ-014` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 无法安全自动修复时必须标记 BLOCKED。 |
| `UAP-05-003-ACC-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 能够自动识别、修复和复验缺陷 |
| `UAP-05-003-ACC-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 能够停止无效重试 |
| `UAP-05-003-ACC-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 修复前后差异可追溯 |
| `UAP-05-003-ACC-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 不会通过破坏测试制造成功。 |
| `UAP-05-004-REQ-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 所有质量门禁必须机器可执行。 |
| `UAP-05-004-REQ-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 门禁必须定义输入、执行器、阈值、失败条件和证据。 |
| `UAP-05-004-REQ-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 阻断级问题必须失败。 |
| `UAP-05-004-REQ-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 高风险业务变更必须执行额外测试。 |
| `UAP-05-004-REQ-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 构建、类型检查、Lint、测试和安全检查必须纳入门禁。 |
| `UAP-05-004-REQ-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 门禁配置必须版本控制。 |
| `UAP-05-004-REQ-007` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 禁止未经审计临时关闭门禁。 |
| `UAP-05-004-REQ-008` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 门禁失败必须产生明确原因。 |
| `UAP-05-004-REQ-009` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 豁免必须有范围、理由、期限和证据。 |
| `UAP-05-004-REQ-010` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 豁免不能由被审查任务自行创建。 |
| `UAP-05-004-REQ-011` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 所有门禁必须支持单项和全量执行。 |
| `UAP-05-004-REQ-012` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 最终发布检查必须汇总全部门禁结果。 |
| `UAP-05-004-ACC-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 门禁能够真实阻断失败任务 |
| `UAP-05-004-ACC-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 门禁结果可追溯 |
| `UAP-05-004-ACC-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 全量门禁可执行 |
| `UAP-05-004-ACC-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 不存在未登记的隐式跳过。 |
| `UAP-06-001-REQ-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 所有输入必须进行服务端验证。 |
| `UAP-06-001-REQ-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 所有权限必须进行服务端鉴权。 |
| `UAP-06-001-REQ-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须防护 SQL 注入、XSS、CSRF、SSRF、命令注入和路径穿越。 |
| `UAP-06-001-REQ-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须防止越权访问和水平/垂直权限提升。 |
| `UAP-06-001-REQ-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 密钥必须使用安全配置管理。 |
| `UAP-06-001-REQ-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须对认证、会话和 Token 生命周期进行检查。 |
| `UAP-06-001-REQ-007` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须实施合理限流和防滥用机制。 |
| `UAP-06-001-REQ-008` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 文件上传必须验证类型、大小和存储位置。 |
| `UAP-06-001-REQ-009` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 依赖和构建产物必须进行安全扫描。 |
| `UAP-06-001-REQ-010` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 错误信息不得泄露敏感内部信息。 |
| `UAP-06-001-REQ-011` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 高危漏洞必须阻断质量门禁。 |
| `UAP-06-001-REQ-012` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 安全修复必须执行回归测试。 |
| `UAP-06-001-REQ-013` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 外部模型、渠道和工具返回的数据必须视为不可信输入。 |
| `UAP-06-001-ACC-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 安全扫描能够执行 |
| `UAP-06-001-ACC-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 关键安全规则有自动测试 |
| `UAP-06-001-ACC-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 高危问题能够阻断 |
| `UAP-06-001-ACC-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 无敏感数据泄露。 |
| `UAP-06-002-REQ-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 金额必须采用精确计算类型，不得使用不可靠的浮点计算处理资金。 |
| `UAP-06-002-REQ-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 充值、支付、退款、扣费、余额和订单必须具有明确状态机。 |
| `UAP-06-002-REQ-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 关键资金操作必须保证幂等。 |
| `UAP-06-002-REQ-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须防止重复回调导致重复入账。 |
| `UAP-06-002-REQ-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须防止并发请求造成余额超扣或重复扣费。 |
| `UAP-06-002-REQ-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须验证订单金额、用户、订单状态和支付渠道的一致性。 |
| `UAP-06-002-REQ-007` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 支付成功通知必须进行签名验证。 |
| `UAP-06-002-REQ-008` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 退款必须关联原订单和原支付记录。 |
| `UAP-06-002-REQ-009` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须记录资金流水，不得只依赖余额字段。 |
| `UAP-06-002-REQ-010` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 余额变更必须具备可追溯的业务来源。 |
| `UAP-06-002-REQ-011` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 关键操作必须考虑事务边界和失败补偿。 |
| `UAP-06-002-REQ-012` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须设计异常恢复、对账和重复通知处理。 |
| `UAP-06-002-REQ-013` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 支付成功但本地订单未保存、通知延迟、通知重复和退款失败必须有处理策略。 |
| `UAP-06-002-REQ-014` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | Outbox、任务恢复和补偿机制应根据现有架构实现。 |
| `UAP-06-002-REQ-015` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 数据迁移不得破坏历史订单和资金流水。 |
| `UAP-06-002-REQ-016` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 测试必须使用模拟支付渠道、模拟回调和隔离数据库。 |
| `UAP-06-002-REQ-017` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 不得使用真实支付、真实退款或真实资金账户进行测试。 |
| `UAP-06-002-REQ-018` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 任何资金差异都必须阻断相关验收。 |
| `UAP-06-002-ACC-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 充值和退款状态机可验证。 |
| `UAP-06-002-ACC-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 幂等测试通过。 |
| `UAP-06-002-ACC-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 并发测试通过。 |
| `UAP-06-002-ACC-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 重复回调测试通过。 |
| `UAP-06-002-ACC-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 异常恢复测试通过。 |
| `UAP-06-002-ACC-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 流水与余额一致性验证通过。 |
| `UAP-06-002-ACC-007` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 所有测试均不触碰真实资金。 |
| `UAP-06-003-REQ-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 关键服务必须有健康检查。 |
| `UAP-06-003-REQ-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须定义超时、重试、退避和熔断策略。 |
| `UAP-06-003-REQ-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须识别关键依赖故障。 |
| `UAP-06-003-REQ-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 关键任务必须能够恢复。 |
| `UAP-06-003-REQ-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须防止重复执行造成数据损坏。 |
| `UAP-06-003-REQ-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须记录错误、异常和恢复事件。 |
| `UAP-06-003-REQ-007` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 数据库迁移必须有恢复方案。 |
| `UAP-06-003-REQ-008` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 后台任务必须有失败队列或等效机制。 |
| `UAP-06-003-REQ-009` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须验证进程重启后的任务状态。 |
| `UAP-06-003-REQ-010` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须验证外部服务不可用时的降级行为。 |
| `UAP-06-003-REQ-011` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须记录备份和恢复能力的验证状态。 |
| `UAP-06-003-REQ-012` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 不得声称已经验证生产恢复，除非实际完成了授权的生产恢复演练。 |
| `UAP-06-003-ACC-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 关键任务能够恢复。 |
| `UAP-06-003-ACC-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 服务异常能够被检测。 |
| `UAP-06-003-ACC-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 重试策略有上限。 |
| `UAP-06-003-ACC-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 失败恢复有测试证据。 |
| `UAP-07-001-REQ-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | Web 功能必须与产品需求对应。 |
| `UAP-07-001-REQ-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 页面必须覆盖加载、成功、空状态、失败和权限不足状态。 |
| `UAP-07-001-REQ-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 表单必须有字段校验和错误提示。 |
| `UAP-07-001-REQ-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 交互必须具有明确反馈。 |
| `UAP-07-001-REQ-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 页面必须满足可访问性基本要求。 |
| `UAP-07-001-REQ-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须检查路由、状态管理和接口错误处理。 |
| `UAP-07-001-REQ-007` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须检查性能和资源加载。 |
| `UAP-07-001-REQ-008` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 关键业务流程必须有自动化测试。 |
| `UAP-07-001-REQ-009` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | Web 修改必须执行类型检查、Lint、测试和构建。 |
| `UAP-07-001-REQ-010` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | UI 必须遵循 Uter 当前有效设计系统；当前设计基线为 UTER Design System 3.0，除非仓库中存在更高版本且已明确生效的正式基线。 |
| `UAP-07-001-REQ-011` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 不得以视觉样式修改破坏业务交互。 |
| `UAP-07-001-REQ-012` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须检查不同屏幕尺寸。 |
| `UAP-07-001-ACC-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | Web 构建通过。 |
| `UAP-07-001-ACC-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 关键路由和流程测试通过。 |
| `UAP-07-001-ACC-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 页面状态完整。 |
| `UAP-07-001-ACC-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 设计规范一致性有验证结果。 |
| `UAP-07-002-REQ-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | H5 必须适配移动端视口。 |
| `UAP-07-002-REQ-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须检查触摸交互和点击区域。 |
| `UAP-07-002-REQ-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须处理软键盘、滚动和安全区域。 |
| `UAP-07-002-REQ-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须检查弱网和加载失败状态。 |
| `UAP-07-002-REQ-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须检查移动端浏览器兼容性。 |
| `UAP-07-002-REQ-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 关键业务操作必须避免重复提交。 |
| `UAP-07-002-REQ-007` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 支付相关 H5 必须验证跳转和返回状态，但只能使用模拟交易。 |
| `UAP-07-002-REQ-008` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 页面必须处理网络中断和接口异常。 |
| `UAP-07-002-REQ-009` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须检查不同设备尺寸。 |
| `UAP-07-002-REQ-010` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | H5 必须与 Web 共享业务规则。 |
| `UAP-07-002-REQ-011` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | H5 必须执行构建、测试和必要的端到端验证。 |
| `UAP-07-002-REQ-012` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 不得只根据桌面浏览器截图判断 H5 合格。 |
| `UAP-07-002-ACC-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | H5 构建通过。 |
| `UAP-07-002-ACC-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 移动端关键流程通过。 |
| `UAP-07-002-ACC-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 弱网和异常状态得到验证。 |
| `UAP-07-002-ACC-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 触摸和布局行为正确。 |
| `UAP-07-003-REQ-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | Web 与 H5 必须共享一致的业务定义。 |
| `UAP-07-003-REQ-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 相同功能必须有相同的权限规则。 |
| `UAP-07-003-REQ-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 相同金额、计费和订单逻辑必须保持一致。 |
| `UAP-07-003-REQ-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 平台差异必须有明确记录。 |
| `UAP-07-003-REQ-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | API 结构和错误码必须统一。 |
| `UAP-07-003-REQ-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须检查页面、交互、字段、校验和状态差异。 |
| `UAP-07-003-REQ-007` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须建立跨平台功能映射。 |
| `UAP-07-003-REQ-008` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 新增功能必须检查所有目标平台。 |
| `UAP-07-003-REQ-009` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 不得将某个平台的功能缺失误判为平台设计差异。 |
| `UAP-07-003-REQ-010` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须有跨平台回归测试。 |
| `UAP-07-003-REQ-011` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 差异必须区分合理差异和不合规差异。 |
| `UAP-07-003-REQ-012` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 重大不一致必须阻断验收。 |
| `UAP-07-003-ACC-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 跨平台功能映射完整。 |
| `UAP-07-003-ACC-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 核心业务行为一致。 |
| `UAP-07-003-ACC-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 不合理差异能够被检测。 |
| `UAP-07-003-ACC-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 回归测试通过。 |
| `UAP-08-001-REQ-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | CI 必须执行代码检查、类型检查、测试、构建和安全扫描。 |
| `UAP-08-001-REQ-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 检查必须使用真实命令和真实退出码。 |
| `UAP-08-001-REQ-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | CI 失败必须能够阻断后续发布步骤。 |
| `UAP-08-001-REQ-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | CI 配置必须纳入版本管理。 |
| `UAP-08-001-REQ-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须区分本地验证、CI 验证和部署验证。 |
| `UAP-08-001-REQ-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 依赖缓存不得导致错误地复用过期产物。 |
| `UAP-08-001-REQ-007` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 构建产物必须可追溯。 |
| `UAP-08-001-REQ-008` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 不得通过跳过工作流步骤伪造通过。 |
| `UAP-08-001-REQ-009` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须检查必要的环境变量是否存在，但不得输出密钥。 |
| `UAP-08-001-REQ-010` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 本次 UAP 建设不得擅自触发生产发布。 |
| `UAP-08-001-REQ-011` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须支持本地全量验证。 |
| `UAP-08-001-REQ-012` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须生成 CI 验证报告。 |
| `UAP-08-001-ACC-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | CI 工作流可解析。 |
| `UAP-08-001-ACC-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 本地等效验证可执行。 |
| `UAP-08-001-ACC-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 失败能够阻断。 |
| `UAP-08-001-ACC-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 构建和测试证据完整。 |
| `UAP-08-002-REQ-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 部署必须定义环境、版本和依赖。 |
| `UAP-08-002-REQ-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 部署前必须执行质量门禁。 |
| `UAP-08-002-REQ-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须检查配置和环境变量。 |
| `UAP-08-002-REQ-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须验证数据库迁移兼容性。 |
| `UAP-08-002-REQ-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须有回滚方案。 |
| `UAP-08-002-REQ-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须明确回滚对数据库和数据的影响。 |
| `UAP-08-002-REQ-007` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须区分代码回滚与数据回滚。 |
| `UAP-08-002-REQ-008` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 部署后必须执行健康检查。 |
| `UAP-08-002-REQ-009` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须记录部署版本和执行证据。 |
| `UAP-08-002-REQ-010` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 生产部署必须经过明确授权。 |
| `UAP-08-002-REQ-011` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 本次建设只能在本地或隔离测试环境验证部署流程。 |
| `UAP-08-002-REQ-012` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 不得将部署脚本存在标记为部署已验证。 |
| `UAP-08-002-ACC-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 部署流程可执行。 |
| `UAP-08-002-ACC-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 测试环境部署可验证。 |
| `UAP-08-002-ACC-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 回滚方案有测试证据。 |
| `UAP-08-002-ACC-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 生产操作权限得到限制。 |
| `UAP-08-003-REQ-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 关键服务必须提供健康状态。 |
| `UAP-08-003-REQ-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 日志必须结构化。 |
| `UAP-08-003-REQ-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 关键任务必须有 Trace ID 或等效关联 ID。 |
| `UAP-08-003-REQ-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 错误必须有分类和严重程度。 |
| `UAP-08-003-REQ-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 关键业务事件必须可查询。 |
| `UAP-08-003-REQ-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须监控任务失败、超时和重试。 |
| `UAP-08-003-REQ-007` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须监控关键业务链路异常。 |
| `UAP-08-003-REQ-008` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 日志不得包含明文密钥和敏感信息。 |
| `UAP-08-003-REQ-009` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须区分业务错误、系统错误和外部依赖错误。 |
| `UAP-08-003-REQ-010` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须支持按任务 ID 查询执行记录。 |
| `UAP-08-003-REQ-011` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须保存关键运行证据。 |
| `UAP-08-003-REQ-012` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 不得将日志系统存在误判为完整可观测性。 |
| `UAP-08-003-ACC-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 关键事件可追踪。 |
| `UAP-08-003-ACC-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 任务日志可关联。 |
| `UAP-08-003-ACC-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 敏感信息脱敏。 |
| `UAP-08-003-ACC-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 故障可定位。 |
| `UAP-09-001-REQ-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 项目知识必须有明确来源。 |
| `UAP-09-001-REQ-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 知识必须包含适用范围和更新时间。 |
| `UAP-09-001-REQ-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 代码、架构、需求和业务规则必须可关联。 |
| `UAP-09-001-REQ-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须识别过时、冲突和重复知识。 |
| `UAP-09-001-REQ-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 知识更新必须有变更记录。 |
| `UAP-09-001-REQ-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | Agent 使用知识时必须能够追溯来源。 |
| `UAP-09-001-REQ-007` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 不得将推测作为已确认事实存储。 |
| `UAP-09-001-REQ-008` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 重要决策必须有证据。 |
| `UAP-09-001-REQ-009` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须支持知识检索。 |
| `UAP-09-001-REQ-010` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须避免将敏感信息写入知识库。 |
| `UAP-09-001-REQ-011` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 知识与实际代码不一致时必须产生差异记录。 |
| `UAP-09-001-REQ-012` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 过时知识必须标记或归档，不能静默继续使用。 |
| `UAP-09-001-ACC-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 关键项目知识可检索。 |
| `UAP-09-001-ACC-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 知识来源可追溯。 |
| `UAP-09-001-ACC-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 过时知识可识别。 |
| `UAP-09-001-ACC-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 知识与实现差异可发现。 |
| `UAP-09-002-REQ-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | UAP 必须定期检查规范、配置、执行器和验证器的一致性。 |
| `UAP-09-002-REQ-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须收集真实运行失败和质量数据。 |
| `UAP-09-002-REQ-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须识别重复缺陷和系统性根因。 |
| `UAP-09-002-REQ-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须提出可验证的改进方案。 |
| `UAP-09-002-REQ-005` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 改进必须经过影响分析。 |
| `UAP-09-002-REQ-006` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 不得自行降低安全和质量标准。 |
| `UAP-09-002-REQ-007` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 不得以自动进化为理由绕过权限策略。 |
| `UAP-09-002-REQ-008` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 规范升级必须维护版本和兼容性。 |
| `UAP-09-002-REQ-009` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 旧规范废弃必须记录替代关系。 |
| `UAP-09-002-REQ-010` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 每次进化必须运行相关回归测试。 |
| `UAP-09-002-REQ-011` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 进化失败必须能够恢复原配置。 |
| `UAP-09-002-REQ-012` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须记录进化前后指标和证据。 |
| `UAP-09-002-REQ-013` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 必须防止自动修改规范导致循环放宽标准。 |
| `UAP-09-002-REQ-014` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | UAP 不得自行授予自己更高权限。 |
| `UAP-09-002-ACC-001` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 能够发现规范与执行偏差。 |
| `UAP-09-002-ACC-002` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 能够提出改进方案。 |
| `UAP-09-002-ACC-003` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 改进过程有验证和回滚。 |
| `UAP-09-002-ACC-004` | IMPLEMENTED | NOT_VERIFIED | 2 | 0 | 2 | 安全和质量门禁不可被自动弱化。 |

> 完整字段（含 statement_sha256 / evidence / executor_ids / validator_ids / owner）见
> `.uap/reports/REQUIREMENT-TRACEABILITY-MATRIX.json`。
