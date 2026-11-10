# UTER-03 规范覆盖与唯一规范来源报告（AUTONOMOUS RUN 2026-11-09 · ROUND 2）

**结论：Uter 以 AES 为唯一权威规范来源；原有本地规范已按处置登记簿清理或降级为
执行层；P00–P12 审计报告链完整。**

## 1. P00–P12 审计报告链（Uter 侧逐域）

`reports/compliance/` 下 13 份域审计报告全部在位：
P00-FOUNDATION … P12-LIFECYCLE-EVOLUTION（P00–P12 共 13 个域，P13 为业务域工程专项
`UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md`）。

## 2. 唯一规范来源

- 权威来源：AES 仓库 `.aes/STANDARD-REGISTRY.yaml`（1.12.2 / ACTIVE，179 standards）
  与 `AES-SPEC-CORE@2.0.0`，经 `requirement_count=2150` 的需求映射进入 Uter；
- Uter 本地 `uaes/standards/` 是**项目 overlay / 兼容执行层**：
  `.aes/AI-SPEC-DISPOSITION-REGISTRY.yaml` 将其标记为
  `KEEP_AND_MARK_FOR_REVIEW` / `KEEP_AS_UTER_EXECUTION_LAYER_WITH_AES_PARENTAGE`；
  AES `.aes/STANDARD-REGISTRY.yaml` 中 `grep -c UAES` = `0`，即 UAES 命名空间不再作为
  当前权威来源，仅以历史证据或父级溯源形式存在；
- 规范溯源：`.aes/TRACEABILITY.md`、`.aes/utER-GOVERNANCE-REGISTRY.yaml`（大小写以实际
  文件名为准）、`.aes/agent-governance.yaml`。

## 3. 绑定机制

- `.aes/aes-pin.json`（schema 3.0.0）：指纹绑定 `4438ad0f35fc…`，四项 signature
  dependency 均为 `NONE`；
- `.aes/INTEGRATION.md`：与 pin 同名指纹的集成契约（`aes-pin-check.sh` 断言两者一致）；
- AES 变更传播：`node quality/scripts/aes/aes.mjs propagate --execute`（本轮 NOOP，
  治理内容未变）。

## 4. 支付/订单等业务域

`P06-SOFTWARE-ENGINEERING-AUDIT.md` 与 `aes-full-migration-2026-11-06/` 系列覆盖
支付/充值/退款/订单状态机/幂等/并发/资金一致性/对账的映射与验收记录；
`UTER-AES-STANDARD-MAPPING.md` 与 `STANDARD-TO-CODE-MAPPING.md` 提供规范→代码映射。

## 5. 诚实边界

本报告陈述的是**治理来源与接线**层面的符合性。业务域逐条要求的运行时证据
（14 独立域验收、需求→证据映射、三运行时 Agent 执行）由 Uter 自身验收体系负责，
见 UTER-05 残余清单——该清单是架构分离的设计结果，不是未整改缺陷。
