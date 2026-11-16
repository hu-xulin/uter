# UAP 最终全量审计报告

> 仓库 https://github.com/hu-xulin/uter · 分支 `main` · HEAD `cfb471c6cd043d81228e9703ff95d6d61c61da62` · 执行 `UAP-EXEC-20261116115030-6a0ef6da` · 生成于 2026-11-16 20:12:05
> 证据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与真实命令退出码。任何 PASS 均绑定本次执行。

## 1. 扫描范围与规模

| 项 | 实际值 |
|---|---|
| 已跟踪文件 | 14654 |
| UAP audit 扫描文件 | 4338 |
| 前端路由（UDS 注册表） | 72 |
| UI 组件（UDS 注册表） | 65 |
| 正式规范 | 32（`uap validate --all` 32/32 PASS） |
| Agent 注册 | 11 |
| 执行器注册 / 唯一实现 | 32 / 16 |
| 验证器 | 32（32/32 PASS） |
| Runtime 组件 | 10（doctor 全健康） |
| 工作流 | 7（6 SUCCEEDED / 1 BLOCKED） |
| 缺陷登记 | 6（OPEN=0） |

## 2. 治理体系完整性

- `specification-registry.yaml`：32 份规范，ID 唯一、文件非空、依赖无环（37/37 registry checks）。
- 6 份机器配置全部加载并通过 registryIntegrity。
- 权限策略默认 deny；高危权限、未注册 Agent、curl 等 12 组 mustDeny 全部 DENY（UAP 测试类别 5）。
- Schema：`uap schemas` exit 0。

## 3. 本次审计发现与处置

- 修复 E2E Playwright fixture 非法签名（runner 0 场景即中止）。
- 修复 R18 静态守卫因多行格式化而误截断 biz_23 用例块。
- 修复 capability-gap 断言只覆盖 2 项能力的问题（现要求每项未证明能力均有 OPEN 阻断项）。
- 修复工作流测试步骤缺少 `--test-concurrency=1` 及 180s 超时不足。
- 修复行为套件中 secret-shaped 假密钥字面量（改为运行时构造，断言不变）。
- 统一 UDS 8.0 圆角刻度与按钮默认令牌；Hero 统一 4xl（见修复报告）。
- 格式化 23 个迁移文件；生成物（Showcase/桥接/图表镜像）从格式门禁排除，同时由 C14/C16 锁定一致性。
- 新增代码评审真实接入：quality-gate 步骤现调用已注册 `development.code_review` 引擎（本次 0 BLOCKER）。

## 4. 结论

治理资产完整、验证器全绿、Runtime 健康；但需求证据覆盖与视觉基线未闭合，故整体验收未通过（见最终验收报告）。
