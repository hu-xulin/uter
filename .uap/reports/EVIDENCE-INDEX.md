# Evidence Index

> 由 `./uap report` 依据真实运行产物生成 · 2026-11-12T17:04:41.386Z · UAP 1.0.0
> 数据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与实时文件系统探测。

## 汇总

证据总数 **1958**；SHA-256 校验通过 **1958**；失败 **0**。证据为 append-only，同 ID 覆盖写入会被拒绝。

## 逐条索引

| 证据 ID | 类型 | 命令 | 退出码 | 时间 | 完整性 |
| --- | --- | --- | --- | --- | --- |
| UAP-EV-20261112104051-2475b437 | task_result | uap task run UAP-TASK-HEALTH-20261112104051-18ebd06c | 0 | 2026-11-12T10:40:51.588Z | HASH_OK |
| UAP-EV-20261112104051-4688c9b8 | health_probe | evidence-engine.health() | 0 | 2026-11-12T10:40:51.559Z | HASH_OK |
| UAP-EV-20261112104051-6794a1df | recovery | uap task resume UAP-TASK-INTERRUPT-20261112104051-cb0c5e52 | 0 | 2026-11-12T10:40:51.896Z | HASH_OK |
| UAP-EV-20261112104051-6da70a1f | task_step | step:probe.step1 | 0 | 2026-11-12T10:40:51.887Z | HASH_OK |
| UAP-EV-20261112104051-a4a3ddfd | task_step | step:probe.step1 | 0 | 2026-11-12T10:40:51.719Z | HASH_OK |
| UAP-EV-20261112104051-c7e9a95a | task_step | step:__health_step__ | 0 | 2026-11-12T10:40:51.909Z | HASH_OK |
| UAP-EV-20261112104051-cedcf0a3 | health_probe | evidence-engine.health() | 0 | 2026-11-12T10:40:51.730Z | HASH_OK |
| UAP-EV-20261112104051-da885048 | task_step | step:__health_step__ | 0 | 2026-11-12T10:40:51.585Z | HASH_OK |
| UAP-EV-20261112104051-f0697d4e | recovery | uap task resume UAP-TASK-INTERRUPT-20261112104051-3e8e74a0 | 0 | 2026-11-12T10:40:51.727Z | HASH_OK |
| UAP-EV-20261112104051-f33487b8 | task_result | uap task run UAP-TASK-HEALTH-20261112104051-0c350b69 | 0 | 2026-11-12T10:40:51.911Z | HASH_OK |
| UAP-EV-20261112104602-141b654f | cli_command | uap help | 0 | 2026-11-12T10:46:02.422Z | HASH_OK |
| UAP-EV-20261112104615-3e657111 | cli_command | uap status --json | 1 | 2026-11-12T10:46:15.624Z | HASH_OK |
| UAP-EV-20261112104644-fe8f1c39 | cli_command | uap status --json | 0 | 2026-11-12T10:46:44.997Z | HASH_OK |
| UAP-EV-20261112104657-202c6fc7 | task_result | uap task run UAP-TASK-HEALTH-20261112104657-991a6aef | 0 | 2026-11-12T10:46:57.859Z | HASH_OK |
| UAP-EV-20261112104657-238f0f5a | task_step | step:__health_step__ | 0 | 2026-11-12T10:46:57.853Z | HASH_OK |
| UAP-EV-20261112104657-4c00c6e8 | task_step | step:probe.step1 | 0 | 2026-11-12T10:46:57.997Z | HASH_OK |
| UAP-EV-20261112104658-00b93568 | task_step | step:probe.step1 | 0 | 2026-11-12T10:46:58.160Z | HASH_OK |
| UAP-EV-20261112104658-090c2497 | runtime_start | uap doctor | 1 | 2026-11-12T10:46:58.032Z | HASH_OK |
| UAP-EV-20261112104658-1162cfa9 | cli_command | uap doctor --json | 1 | 2026-11-12T10:46:58.174Z | HASH_OK |
| UAP-EV-20261112104658-171213e9 | health_probe | evidence-engine.health() | 0 | 2026-11-12T10:46:58.011Z | HASH_OK |
| UAP-EV-20261112104658-8b98cf4a | recovery | uap task resume UAP-TASK-INTERRUPT-20261112104658-b56a386d | 0 | 2026-11-12T10:46:58.173Z | HASH_OK |
| UAP-EV-20261112104658-b8bbf06f | recovery | uap task resume UAP-TASK-INTERRUPT-20261112104657-de39cd7c | 0 | 2026-11-12T10:46:58.008Z | HASH_OK |
| UAP-EV-20261112104817-1d4bc854 | task_result | uap task run UAP-TASK-INTERRUPT-20261112104817-9db1041a | 0 | 2026-11-12T10:48:17.638Z | HASH_OK |
| UAP-EV-20261112104817-32db3372 | task_step | step:probe.step1 | 0 | 2026-11-12T10:48:17.615Z | HASH_OK |
| UAP-EV-20261112104817-5c85ae76 | task_step | step:probe.step3 | 0 | 2026-11-12T10:48:17.634Z | HASH_OK |
| UAP-EV-20261112104817-60b98087 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112104817-9db1041a | 0 | 2026-11-12T10:48:17.641Z | HASH_OK |
| UAP-EV-20261112104817-61549361 | task_step | step:probe.step2 | 0 | 2026-11-12T10:48:17.632Z | HASH_OK |
| UAP-EV-20261112104817-fc80ae38 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112104817-9db1041a | 0 | 2026-11-12T10:48:17.626Z | HASH_OK |
| UAP-EV-20261112105056-a9e34f46 | cli_command | uap report --json | 0 | 2026-11-12T10:50:56.645Z | HASH_OK |
| UAP-EV-20261112105439-54228dfa | cli_command | uap audit --json | 1 | 2026-11-12T10:54:39.896Z | HASH_OK |
| UAP-EV-20261112105521-f33f7fc6 | cli_command | uap audit --json | 1 | 2026-11-12T10:55:21.427Z | HASH_OK |
| UAP-EV-20261112105532-7b2097b7 | auto_repair_attempt | uap repair UAP-DEFECT-0002 | 0 | 2026-11-12T10:55:32.973Z | HASH_OK |
| UAP-EV-20261112105532-b8cc24bb | cli_command | uap repair --json | 0 | 2026-11-12T10:55:32.987Z | HASH_OK |
| UAP-EV-20261112105532-c730e696 | auto_repair_attempt | uap repair UAP-DEFECT-0001 | 0 | 2026-11-12T10:55:32.962Z | HASH_OK |
| UAP-EV-20261112105533-046304bb | health_probe | evidence-engine.health() | 0 | 2026-11-12T10:55:33.999Z | HASH_OK |
| UAP-EV-20261112105533-24a6355b | task_step | step:probe.step1 | 0 | 2026-11-12T10:55:33.976Z | HASH_OK |
| UAP-EV-20261112105533-45c04d33 | task_result | uap task run UAP-TASK-INTERRUPT-20261112105533-34d4fa28 | 0 | 2026-11-12T10:55:33.993Z | HASH_OK |
| UAP-EV-20261112105533-86149ba9 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112105533-34d4fa28 | 0 | 2026-11-12T10:55:33.984Z | HASH_OK |
| UAP-EV-20261112105533-88f2eaee | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112105533-34d4fa28 | 0 | 2026-11-12T10:55:33.995Z | HASH_OK |
| UAP-EV-20261112105533-9c27c244 | task_step | step:probe.step3 | 0 | 2026-11-12T10:55:33.990Z | HASH_OK |
| UAP-EV-20261112105533-d4271575 | task_step | step:__health_step__ | 0 | 2026-11-12T10:55:33.832Z | HASH_OK |
| UAP-EV-20261112105533-dc52f374 | task_step | step:probe.step2 | 0 | 2026-11-12T10:55:33.988Z | HASH_OK |
| UAP-EV-20261112105533-ee47a5ee | task_result | uap task run UAP-TASK-HEALTH-20261112105533-13ca7d85 | 0 | 2026-11-12T10:55:33.837Z | HASH_OK |
| UAP-EV-20261112105534-39f76bc8 | workflow_step | workflow:validate_environment | 0 | 2026-11-12T10:55:34.111Z | HASH_OK |
| UAP-EV-20261112105625-ef2eb644 | cli_command | uap audit --json | 0 | 2026-11-12T10:56:25.693Z | HASH_OK |
| UAP-EV-20261112105626-05a09a92 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112105626-d662517f | 0 | 2026-11-12T10:56:26.464Z | HASH_OK |
| UAP-EV-20261112105626-1eeb3245 | task_result | uap task run UAP-TASK-INTERRUPT-20261112105626-d662517f | 0 | 2026-11-12T10:56:26.477Z | HASH_OK |
| UAP-EV-20261112105626-29873404 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112105626-d662517f | 0 | 2026-11-12T10:56:26.480Z | HASH_OK |
| UAP-EV-20261112105626-3957a808 | health_probe | evidence-engine.health() | 0 | 2026-11-12T10:56:26.484Z | HASH_OK |
| UAP-EV-20261112105626-3d274f5f | recovery | uap task resume UAP-TASK-INTERRUPT-20261112105626-4a1e208a | 0 | 2026-11-12T10:56:26.652Z | HASH_OK |
| UAP-EV-20261112105626-3f02a24a | task_step | step:probe.step1 | 0 | 2026-11-12T10:56:26.454Z | HASH_OK |
| UAP-EV-20261112105626-43f0428d | task_step | step:probe.step3 | 0 | 2026-11-12T10:56:26.471Z | HASH_OK |
| UAP-EV-20261112105626-5884a0a6 | runtime_start | uap doctor | 0 | 2026-11-12T10:56:26.504Z | HASH_OK |
| UAP-EV-20261112105626-68106dc1 | cli_command | uap doctor --json | 0 | 2026-11-12T10:56:26.664Z | HASH_OK |
| UAP-EV-20261112105626-8d588be6 | task_step | step:probe.step2 | 0 | 2026-11-12T10:56:26.655Z | HASH_OK |
| UAP-EV-20261112105626-9141a0f3 | task_result | uap task run UAP-TASK-INTERRUPT-20261112105626-4a1e208a | 0 | 2026-11-12T10:56:26.660Z | HASH_OK |
| UAP-EV-20261112105626-9267273b | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112105626-4a1e208a | 0 | 2026-11-12T10:56:26.663Z | HASH_OK |
| UAP-EV-20261112105626-b4ca0055 | task_step | step:__health_step__ | 0 | 2026-11-12T10:56:26.296Z | HASH_OK |
| UAP-EV-20261112105626-bcdb0e7a | task_step | step:probe.step2 | 0 | 2026-11-12T10:56:26.468Z | HASH_OK |
| UAP-EV-20261112105626-c1ab5b51 | task_step | step:probe.step3 | 0 | 2026-11-12T10:56:26.656Z | HASH_OK |
| UAP-EV-20261112105626-c591e6b6 | task_step | step:probe.step1 | 0 | 2026-11-12T10:56:26.643Z | HASH_OK |
| UAP-EV-20261112105626-dbefac13 | task_result | uap task run UAP-TASK-HEALTH-20261112105626-dcde0de6 | 0 | 2026-11-12T10:56:26.303Z | HASH_OK |
| UAP-EV-20261112105627-453efab4 | cli_command | uap repair --json | 0 | 2026-11-12T10:56:27.179Z | HASH_OK |
| UAP-EV-20261112105636-15b14c8a | validator_result | uap validate product.requirement_traceability | 0 | 2026-11-12T10:56:36.930Z | HASH_OK |
| UAP-EV-20261112105636-431e3e94 | validator_result | uap validate core.evidence_integrity | 0 | 2026-11-12T10:56:36.893Z | HASH_OK |
| UAP-EV-20261112105636-4c8fae84 | validator_result | uap validate product.prototype_consistency | 0 | 2026-11-12T10:56:36.962Z | HASH_OK |
| UAP-EV-20261112105636-aa2fee23 | validator_result | uap validate product.business_rule_integrity | 0 | 2026-11-12T10:56:36.987Z | HASH_OK |
| UAP-EV-20261112105636-bd09b9c3 | validator_result | uap validate core.execution_integrity | 0 | 2026-11-12T10:56:36.832Z | HASH_OK |
| UAP-EV-20261112105636-cfb3819f | validator_result | uap validate core.architecture_integrity | 0 | 2026-11-12T10:56:36.697Z | HASH_OK |
| UAP-EV-20261112105636-d094ef50 | validator_result | uap validate security.permission_boundary | 0 | 2026-11-12T10:56:36.865Z | HASH_OK |
| UAP-EV-20261112105637-139afc0b | validator_result | uap validate agents.recovery_integrity | 0 | 2026-11-12T10:56:37.389Z | HASH_OK |
| UAP-EV-20261112105637-53c81b0b | validator_result | uap validate architecture.consistency | 0 | 2026-11-12T10:56:37.003Z | HASH_OK |
| UAP-EV-20261112105637-665a6a13 | validator_result | uap validate architecture.adr_integrity | 0 | 2026-11-12T10:56:37.028Z | HASH_OK |
| UAP-EV-20261112105637-67c17ec0 | validator_result | uap validate agents.registry_integrity | 0 | 2026-11-12T10:56:37.040Z | HASH_OK |
| UAP-EV-20261112105637-9727164f | validator_result | uap validate agents.collaboration_integrity | 0 | 2026-11-12T10:56:37.275Z | HASH_OK |
| UAP-EV-20261112105637-c118c52d | validator_result | uap validate agents.execution_integrity | 0 | 2026-11-12T10:56:37.264Z | HASH_OK |
| UAP-EV-20261112105637-eba66ac2 | validator_result | uap validate architecture.api_database_integrity | 0 | 2026-11-12T10:56:37.017Z | HASH_OK |
| UAP-EV-20261112105638-0064826c | validator_result | uap validate quality.test_integrity | 1 | 2026-11-12T10:56:38.859Z | HASH_OK |
| UAP-EV-20261112105638-15ec046d | validator_result | uap validate development.coding_compliance | 0 | 2026-11-12T10:56:38.579Z | HASH_OK |
| UAP-EV-20261112105638-7cfb4d9a | validator_result | uap validate development.review_integrity | 0 | 2026-11-12T10:56:38.711Z | HASH_OK |
| UAP-EV-20261112105638-a173bc77 | validator_result | uap validate development.dependency_integrity | 0 | 2026-11-12T10:56:38.722Z | HASH_OK |
| UAP-EV-20261112105638-ab579e78 | validator_result | uap validate quality.repair_integrity | 0 | 2026-11-12T10:56:38.982Z | HASH_OK |
| UAP-EV-20261112105638-e944e76c | validator_result | uap validate quality.engineering_integrity | 1 | 2026-11-12T10:56:38.846Z | HASH_OK |
| UAP-EV-20261112105639-06dea295 | validator_result | uap validate security.financial_integrity_validator | 0 | 2026-11-12T10:56:39.364Z | HASH_OK |
| UAP-EV-20261112105639-0e4b9f2a | validator_result | uap validate cross_platform.consistency_integrity | 1 | 2026-11-12T10:56:39.969Z | HASH_OK |
| UAP-EV-20261112105639-1a11101c | validator_result | uap validate cross_platform.web_integrity | 0 | 2026-11-12T10:56:39.706Z | HASH_OK |
| UAP-EV-20261112105639-2a6c802b | validator_result | uap validate security.application_integrity | 1 | 2026-11-12T10:56:39.354Z | HASH_OK |
| UAP-EV-20261112105639-2d55a600 | validator_result | uap validate security.reliability_integrity | 0 | 2026-11-12T10:56:39.491Z | HASH_OK |
| UAP-EV-20261112105639-43422a94 | validator_result | uap validate delivery.ci_integrity | 1 | 2026-11-12T10:56:39.982Z | HASH_OK |
| UAP-EV-20261112105639-997fb1f8 | validator_result | uap validate delivery.deployment_integrity | 1 | 2026-11-12T10:56:39.995Z | HASH_OK |
| UAP-EV-20261112105639-9e04b528 | validator_result | uap validate quality.gate_integrity | 1 | 2026-11-12T10:56:39.116Z | HASH_OK |
| UAP-EV-20261112105639-f2fbb653 | validator_result | uap validate cross_platform.h5_integrity | 1 | 2026-11-12T10:56:39.919Z | HASH_OK |
| UAP-EV-20261112105640-2187eae5 | cli_command | uap validate --all --json | 1 | 2026-11-12T10:56:40.367Z | HASH_OK |
| UAP-EV-20261112105640-7bc93c7b | validator_result | uap validate delivery.observability_integrity | 0 | 2026-11-12T10:56:40.223Z | HASH_OK |
| UAP-EV-20261112105640-7dab0f1d | validator_result | uap validate evolution.evolution_integrity | 0 | 2026-11-12T10:56:40.364Z | HASH_OK |
| UAP-EV-20261112105640-a24a5775 | validator_result | uap validate evolution.knowledge_integrity | 0 | 2026-11-12T10:56:40.251Z | HASH_OK |
| UAP-EV-20261112105731-0113550e | workflow_step | workflow:test_duplicate_notifications | 0 | 2026-11-12T10:57:31.851Z | HASH_OK |
| UAP-EV-20261112105731-0e51b9aa | workflow_step | workflow:inspect_payment_state_machine | 0 | 2026-11-12T10:57:31.828Z | HASH_OK |
| UAP-EV-20261112105731-1f9f6ac9 | task_step | step:inspect_payment_state_machine | 0 | 2026-11-12T10:57:31.828Z | HASH_OK |
| UAP-EV-20261112105731-3b82fc2e | task_step | step:test_concurrency | 0 | 2026-11-12T10:57:31.847Z | HASH_OK |
| UAP-EV-20261112105731-43f4099f | task_step | step:probe.step2 | 0 | 2026-11-12T10:57:31.801Z | HASH_OK |
| UAP-EV-20261112105731-56cfbafb | task_step | step:__probe_retry_ok__ | 0 | 2026-11-12T10:57:31.645Z | HASH_OK |
| UAP-EV-20261112105731-597020e4 | task_step | step:test_failure_recovery | 0 | 2026-11-12T10:57:31.857Z | HASH_OK |
| UAP-EV-20261112105731-5a4ddbca | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112105731-e30d7d00 | 0 | 2026-11-12T10:57:31.811Z | HASH_OK |
| UAP-EV-20261112105731-6b153848 | task_step | step:probe.step3 | 0 | 2026-11-12T10:57:31.803Z | HASH_OK |
| UAP-EV-20261112105731-703e94be | task_step | step:test_idempotency | 0 | 2026-11-12T10:57:31.843Z | HASH_OK |
| UAP-EV-20261112105731-83740f23 | task_result | uap task run UAP-TASK-20261112105731-32f82ea4 | 0 | 2026-11-12T10:57:31.865Z | HASH_OK |
| UAP-EV-20261112105731-93147b8b | task_step | step:verify_reconciliation | 0 | 2026-11-12T10:57:31.861Z | HASH_OK |
| UAP-EV-20261112105731-9cba76a0 | workflow_step | workflow:verify_reconciliation | 0 | 2026-11-12T10:57:31.861Z | HASH_OK |
| UAP-EV-20261112105731-a3b76984 | task_step | step:__probe_retry_fail__ | 1 | 2026-11-12T10:57:31.657Z | HASH_OK |
| UAP-EV-20261112105731-a4f0a783 | workflow_step | workflow:test_concurrency | 0 | 2026-11-12T10:57:31.847Z | HASH_OK |
| UAP-EV-20261112105731-b6b1dce7 | task_result | uap task run UAP-TASK-TEST-20261112105731-36729679 | 0 | 2026-11-12T10:57:31.649Z | HASH_OK |
| UAP-EV-20261112105731-c9aa7870 | task_step | step:test_duplicate_notifications | 0 | 2026-11-12T10:57:31.852Z | HASH_OK |
| UAP-EV-20261112105731-caf04b74 | task_step | step:inspect_balance_ledger | 0 | 2026-11-12T10:57:31.838Z | HASH_OK |
| UAP-EV-20261112105731-d20b92bb | workflow_step | workflow:test_idempotency | 0 | 2026-11-12T10:57:31.842Z | HASH_OK |
| UAP-EV-20261112105731-e43b55e3 | task_result | uap task run UAP-TASK-INTERRUPT-20261112105731-e30d7d00 | 0 | 2026-11-12T10:57:31.807Z | HASH_OK |
| UAP-EV-20261112105731-e6dfad87 | workflow_step | workflow:inspect_refund_state_machine | 0 | 2026-11-12T10:57:31.833Z | HASH_OK |
| UAP-EV-20261112105731-e7b27675 | workflow_step | workflow:test_failure_recovery | 0 | 2026-11-12T10:57:31.856Z | HASH_OK |
| UAP-EV-20261112105731-eb3b9743 | task_result | uap task run UAP-TASK-TEST-20261112105731-e114c30e | 1 | 2026-11-12T10:57:31.661Z | HASH_OK |
| UAP-EV-20261112105731-f15dd0c7 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112105731-e30d7d00 | 0 | 2026-11-12T10:57:31.799Z | HASH_OK |
| UAP-EV-20261112105731-f323a17e | workflow_step | workflow:inspect_balance_ledger | 0 | 2026-11-12T10:57:31.837Z | HASH_OK |
| UAP-EV-20261112105731-f4629d41 | task_step | step:inspect_refund_state_machine | 0 | 2026-11-12T10:57:31.833Z | HASH_OK |
| UAP-EV-20261112105731-f897ebd7 | task_step | step:probe.step1 | 0 | 2026-11-12T10:57:31.789Z | HASH_OK |
| UAP-EV-20261112110156-0fcfd628 | task_step | step:__health_step__ | 0 | 2026-11-12T11:01:56.634Z | HASH_OK |
| UAP-EV-20261112110156-12f91c98 | task_step | step:probe.step3 | 0 | 2026-11-12T11:01:56.785Z | HASH_OK |
| UAP-EV-20261112110156-406223f2 | health_probe | evidence-engine.health() | 0 | 2026-11-12T11:01:56.799Z | HASH_OK |
| UAP-EV-20261112110156-61d45dca | task_result | uap task run UAP-TASK-INTERRUPT-20261112110156-f0431ce4 | 0 | 2026-11-12T11:01:56.790Z | HASH_OK |
| UAP-EV-20261112110156-64f0b607 | task_step | step:probe.step2 | 0 | 2026-11-12T11:01:56.783Z | HASH_OK |
| UAP-EV-20261112110156-64fbaccc | task_step | step:probe.step1 | 0 | 2026-11-12T11:01:56.769Z | HASH_OK |
| UAP-EV-20261112110156-9ef8e2de | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112110156-f0431ce4 | 0 | 2026-11-12T11:01:56.794Z | HASH_OK |
| UAP-EV-20261112110156-d775c7e9 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112110156-f0431ce4 | 0 | 2026-11-12T11:01:56.779Z | HASH_OK |
| UAP-EV-20261112110156-f30255a2 | task_result | uap task run UAP-TASK-HEALTH-20261112110156-84622292 | 0 | 2026-11-12T11:01:56.640Z | HASH_OK |
| UAP-EV-20261112110157-00592410 | task_result | uap task run UAP-TASK-TEST-20261112110157-52561644 | 0 | 2026-11-12T11:01:57.052Z | HASH_OK |
| UAP-EV-20261112110157-033bbc50 | task_step | step:__uap_test_retry_then_ok__ | 0 | 2026-11-12T11:01:57.048Z | HASH_OK |
| UAP-EV-20261112110157-07f4b0bf | workflow_step | workflow:inspect_refund_state_machine | 0 | 2026-11-12T11:01:57.143Z | HASH_OK |
| UAP-EV-20261112110157-0a7e7eff | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112110157-f5fc556a | 0 | 2026-11-12T11:01:57.040Z | HASH_OK |
| UAP-EV-20261112110157-18a0c00d | workflow_step | workflow:verify_reconciliation | 0 | 2026-11-12T11:01:57.172Z | HASH_OK |
| UAP-EV-20261112110157-19b05ef2 | task_step | step:probe.step1 | 0 | 2026-11-12T11:01:57.016Z | HASH_OK |
| UAP-EV-20261112110157-2320693a | recovery | uap task resume UAP-TASK-INTERRUPT-20261112110157-f5fc556a | 0 | 2026-11-12T11:01:57.026Z | HASH_OK |
| UAP-EV-20261112110157-27369cce | task_step | step:probe.step2 | 0 | 2026-11-12T11:01:57.029Z | HASH_OK |
| UAP-EV-20261112110157-5287fc4a | task_result | uap task run UAP-TASK-20261112110157-71fa6868 | 0 | 2026-11-12T11:01:57.177Z | HASH_OK |
| UAP-EV-20261112110157-5d14bc96 | workflow_step | workflow:test_duplicate_notifications | 0 | 2026-11-12T11:01:57.163Z | HASH_OK |
| UAP-EV-20261112110157-64067f5e | workflow_step | workflow:test_failure_recovery | 0 | 2026-11-12T11:01:57.167Z | HASH_OK |
| UAP-EV-20261112110157-675b3091 | workflow_step | workflow:test_concurrency | 0 | 2026-11-12T11:01:57.158Z | HASH_OK |
| UAP-EV-20261112110157-69cb42db | workflow_step | workflow:test_idempotency | 0 | 2026-11-12T11:01:57.153Z | HASH_OK |
| UAP-EV-20261112110157-72a2256f | workflow_step | workflow:inspect_payment_state_machine | 0 | 2026-11-12T11:01:57.139Z | HASH_OK |
| UAP-EV-20261112110157-73610c1b | task_step | step:probe.step3 | 0 | 2026-11-12T11:01:57.032Z | HASH_OK |
| UAP-EV-20261112110157-8110bd74 | task_step | step:test_failure_recovery | 0 | 2026-11-12T11:01:57.167Z | HASH_OK |
| UAP-EV-20261112110157-89492ac3 | task_step | step:test_duplicate_notifications | 0 | 2026-11-12T11:01:57.164Z | HASH_OK |
| UAP-EV-20261112110157-8b202d57 | task_step | step:inspect_balance_ledger | 0 | 2026-11-12T11:01:57.149Z | HASH_OK |
| UAP-EV-20261112110157-8c39e566 | task_step | step:inspect_refund_state_machine | 0 | 2026-11-12T11:01:57.143Z | HASH_OK |
| UAP-EV-20261112110157-8e552579 | task_step | step:inspect_payment_state_machine | 0 | 2026-11-12T11:01:57.139Z | HASH_OK |
| UAP-EV-20261112110157-935f0741 | task_step | step:test_concurrency | 0 | 2026-11-12T11:01:57.159Z | HASH_OK |
| UAP-EV-20261112110157-97675b0d | task_step | step:verify_reconciliation | 0 | 2026-11-12T11:01:57.172Z | HASH_OK |
| UAP-EV-20261112110157-afbab2f3 | task_result | uap task run UAP-TASK-INTERRUPT-20261112110157-f5fc556a | 0 | 2026-11-12T11:01:57.036Z | HASH_OK |
| UAP-EV-20261112110157-b36c93b9 | task_step | step:test_idempotency | 0 | 2026-11-12T11:01:57.154Z | HASH_OK |
| UAP-EV-20261112110157-cbce9ffc | task_step | step:__uap_test_always_fail__ | 1 | 2026-11-12T11:01:57.060Z | HASH_OK |
| UAP-EV-20261112110157-d3363a4c | workflow_step | workflow:validate_environment | 0 | 2026-11-12T11:01:57.125Z | HASH_OK |
| UAP-EV-20261112110157-d6c6b733 | task_result | uap task run UAP-TASK-TEST-20261112110157-7c9f99e1 | 1 | 2026-11-12T11:01:57.065Z | HASH_OK |
| UAP-EV-20261112110157-d911a798 | workflow_step | workflow:inspect_balance_ledger | 0 | 2026-11-12T11:01:57.149Z | HASH_OK |
| UAP-EV-20261112110221-052dc115 | task_result | uap task run UAP-TASK-TEST-20261112110221-1a5b7159 | 0 | 2026-11-12T11:02:21.738Z | HASH_OK |
| UAP-EV-20261112110221-09227505 | task_step | step:test_concurrency | 0 | 2026-11-12T11:02:21.859Z | HASH_OK |
| UAP-EV-20261112110221-14500703 | task_step | step:__uap_test_always_fail__ | 1 | 2026-11-12T11:02:21.749Z | HASH_OK |
| UAP-EV-20261112110221-27409e74 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112110221-8b383820 | 0 | 2026-11-12T11:02:21.490Z | HASH_OK |
| UAP-EV-20261112110221-2be30c09 | task_result | uap task run UAP-TASK-TEST-20261112110221-4d344a4e | 1 | 2026-11-12T11:02:21.755Z | HASH_OK |
| UAP-EV-20261112110221-2ddac17b | task_result | uap task run UAP-TASK-INTERRUPT-20261112110221-ceef1923 | 0 | 2026-11-12T11:02:21.718Z | HASH_OK |
| UAP-EV-20261112110221-3061c5c5 | task_step | step:inspect_payment_state_machine | 0 | 2026-11-12T11:02:21.838Z | HASH_OK |
| UAP-EV-20261112110221-3c535dbd | workflow_step | workflow:inspect_balance_ledger | 0 | 2026-11-12T11:02:21.849Z | HASH_OK |
| UAP-EV-20261112110221-41af892a | task_step | step:probe.step3 | 0 | 2026-11-12T11:02:21.712Z | HASH_OK |
| UAP-EV-20261112110221-53b86db1 | workflow_step | workflow:verify_reconciliation | 0 | 2026-11-12T11:02:21.873Z | HASH_OK |
| UAP-EV-20261112110221-570ba2c8 | task_step | step:probe.step2 | 0 | 2026-11-12T11:02:21.478Z | HASH_OK |
| UAP-EV-20261112110221-5e192a93 | task_step | step:probe.step3 | 0 | 2026-11-12T11:02:21.481Z | HASH_OK |
| UAP-EV-20261112110221-620344f9 | task_step | step:test_failure_recovery | 0 | 2026-11-12T11:02:21.869Z | HASH_OK |
| UAP-EV-20261112110221-63baa848 | task_result | uap task run UAP-TASK-20261112110221-484e968f | 0 | 2026-11-12T11:02:21.879Z | HASH_OK |
| UAP-EV-20261112110221-6d29fc0c | task_result | uap task run UAP-TASK-INTERRUPT-20261112110221-8b383820 | 0 | 2026-11-12T11:02:21.486Z | HASH_OK |
| UAP-EV-20261112110221-7f024618 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112110221-8b383820 | 0 | 2026-11-12T11:02:21.474Z | HASH_OK |
| UAP-EV-20261112110221-83ba2ca5 | task_step | step:verify_reconciliation | 0 | 2026-11-12T11:02:21.874Z | HASH_OK |
| UAP-EV-20261112110221-914fec20 | workflow_step | workflow:inspect_refund_state_machine | 0 | 2026-11-12T11:02:21.843Z | HASH_OK |
| UAP-EV-20261112110221-9349a1a5 | task_step | step:probe.step1 | 0 | 2026-11-12T11:02:21.693Z | HASH_OK |
| UAP-EV-20261112110221-93d5b56b | workflow_step | workflow:test_duplicate_notifications | 0 | 2026-11-12T11:02:21.864Z | HASH_OK |
| UAP-EV-20261112110221-9853f94e | workflow_step | workflow:test_idempotency | 0 | 2026-11-12T11:02:21.854Z | HASH_OK |
| UAP-EV-20261112110221-9f3df147 | task_step | step:test_duplicate_notifications | 0 | 2026-11-12T11:02:21.864Z | HASH_OK |
| UAP-EV-20261112110221-a3c4ee2f | workflow_step | workflow:validate_environment | 0 | 2026-11-12T11:02:21.822Z | HASH_OK |
| UAP-EV-20261112110221-a467f8c9 | workflow_step | workflow:inspect_payment_state_machine | 0 | 2026-11-12T11:02:21.837Z | HASH_OK |
| UAP-EV-20261112110221-aac9b1b8 | task_step | step:inspect_refund_state_machine | 0 | 2026-11-12T11:02:21.844Z | HASH_OK |
| UAP-EV-20261112110221-b3259e19 | task_step | step:probe.step1 | 0 | 2026-11-12T11:02:21.464Z | HASH_OK |
| UAP-EV-20261112110221-b32cb90c | task_step | step:__health_step__ | 0 | 2026-11-12T11:02:21.324Z | HASH_OK |
| UAP-EV-20261112110221-cc08024a | workflow_step | workflow:test_concurrency | 0 | 2026-11-12T11:02:21.859Z | HASH_OK |
| UAP-EV-20261112110221-d6a4f144 | task_step | step:inspect_balance_ledger | 0 | 2026-11-12T11:02:21.849Z | HASH_OK |
| UAP-EV-20261112110221-d7f240ee | health_probe | evidence-engine.health() | 0 | 2026-11-12T11:02:21.494Z | HASH_OK |
| UAP-EV-20261112110221-e9e8055e | task_result | uap task run UAP-TASK-HEALTH-20261112110221-7ce8dc85 | 0 | 2026-11-12T11:02:21.331Z | HASH_OK |
| UAP-EV-20261112110221-e9fcbab0 | workflow_step | workflow:test_failure_recovery | 0 | 2026-11-12T11:02:21.869Z | HASH_OK |
| UAP-EV-20261112110221-ef782b0d | task_step | step:__uap_test_retry_then_ok__ | 0 | 2026-11-12T11:02:21.733Z | HASH_OK |
| UAP-EV-20261112110221-f0cb197b | recovery | uap task resume UAP-TASK-INTERRUPT-20261112110221-ceef1923 | 0 | 2026-11-12T11:02:21.704Z | HASH_OK |
| UAP-EV-20261112110221-f298f339 | task_step | step:probe.step2 | 0 | 2026-11-12T11:02:21.709Z | HASH_OK |
| UAP-EV-20261112110221-f683f42d | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112110221-ceef1923 | 0 | 2026-11-12T11:02:21.723Z | HASH_OK |
| UAP-EV-20261112110221-fc20f733 | task_step | step:test_idempotency | 0 | 2026-11-12T11:02:21.854Z | HASH_OK |
| UAP-EV-20261112110235-033bd21d | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112110235-3bdeb097 | 0 | 2026-11-12T11:02:35.937Z | HASH_OK |
| UAP-EV-20261112110235-037103f2 | task_step | step:__uap_test_retry_then_ok__ | 0 | 2026-11-12T11:02:35.948Z | HASH_OK |
| UAP-EV-20261112110235-0eba596b | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112110235-309d26a6 | 0 | 2026-11-12T11:02:35.694Z | HASH_OK |
| UAP-EV-20261112110235-10e0e101 | task_result | uap task run UAP-TASK-INTERRUPT-20261112110235-309d26a6 | 0 | 2026-11-12T11:02:35.689Z | HASH_OK |
| UAP-EV-20261112110235-1fdc28a2 | task_step | step:probe.step1 | 0 | 2026-11-12T11:02:35.905Z | HASH_OK |
| UAP-EV-20261112110235-246b635f | recovery | uap task resume UAP-TASK-INTERRUPT-20261112110235-3bdeb097 | 0 | 2026-11-12T11:02:35.917Z | HASH_OK |
| UAP-EV-20261112110235-2c71a822 | task_step | step:probe.step3 | 0 | 2026-11-12T11:02:35.925Z | HASH_OK |
| UAP-EV-20261112110235-588d0141 | health_probe | evidence-engine.health() | 0 | 2026-11-12T11:02:35.699Z | HASH_OK |
| UAP-EV-20261112110235-5d1f00d0 | task_step | step:probe.step3 | 0 | 2026-11-12T11:02:35.681Z | HASH_OK |
| UAP-EV-20261112110235-64b02f78 | task_step | step:probe.step1 | 0 | 2026-11-12T11:02:35.661Z | HASH_OK |
| UAP-EV-20261112110235-7b91a27b | task_step | step:probe.step2 | 0 | 2026-11-12T11:02:35.922Z | HASH_OK |
| UAP-EV-20261112110235-7c5c3fc6 | task_step | step:probe.step2 | 0 | 2026-11-12T11:02:35.678Z | HASH_OK |
| UAP-EV-20261112110235-7f8870c5 | task_step | step:__health_step__ | 0 | 2026-11-12T11:02:35.508Z | HASH_OK |
| UAP-EV-20261112110235-8ae8f028 | task_step | step:__uap_test_always_fail__ | 1 | 2026-11-12T11:02:35.966Z | HASH_OK |
| UAP-EV-20261112110235-9d9b63da | task_result | uap task run UAP-TASK-TEST-20261112110235-8a8f2fd9 | 0 | 2026-11-12T11:02:35.954Z | HASH_OK |
| UAP-EV-20261112110235-9dc7e07e | task_result | uap task run UAP-TASK-INTERRUPT-20261112110235-3bdeb097 | 0 | 2026-11-12T11:02:35.932Z | HASH_OK |
| UAP-EV-20261112110235-e1815eda | task_result | uap task run UAP-TASK-HEALTH-20261112110235-14449475 | 0 | 2026-11-12T11:02:35.516Z | HASH_OK |
| UAP-EV-20261112110235-ec22b909 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112110235-309d26a6 | 0 | 2026-11-12T11:02:35.673Z | HASH_OK |
| UAP-EV-20261112110235-eddeac1e | task_result | uap task run UAP-TASK-TEST-20261112110235-a92a472a | 1 | 2026-11-12T11:02:35.974Z | HASH_OK |
| UAP-EV-20261112110236-1060df32 | task_step | step:test_concurrency | 0 | 2026-11-12T11:02:36.077Z | HASH_OK |
| UAP-EV-20261112110236-1c166943 | workflow_step | workflow:inspect_refund_state_machine | 0 | 2026-11-12T11:02:36.060Z | HASH_OK |
| UAP-EV-20261112110236-1e836e84 | task_step | step:test_failure_recovery | 0 | 2026-11-12T11:02:36.089Z | HASH_OK |
| UAP-EV-20261112110236-27d181ab | task_step | step:inspect_balance_ledger | 0 | 2026-11-12T11:02:36.066Z | HASH_OK |
| UAP-EV-20261112110236-4cae8fbd | workflow_step | workflow:test_failure_recovery | 0 | 2026-11-12T11:02:36.089Z | HASH_OK |
| UAP-EV-20261112110236-64a68438 | task_step | step:test_idempotency | 0 | 2026-11-12T11:02:36.072Z | HASH_OK |
| UAP-EV-20261112110236-6f3632b2 | task_result | uap task run UAP-TASK-20261112110236-19a3102a | 0 | 2026-11-12T11:02:36.102Z | HASH_OK |
| UAP-EV-20261112110236-87f48f15 | workflow_step | workflow:validate_environment | 0 | 2026-11-12T11:02:36.037Z | HASH_OK |
| UAP-EV-20261112110236-b2bfdec1 | workflow_step | workflow:test_concurrency | 0 | 2026-11-12T11:02:36.077Z | HASH_OK |
| UAP-EV-20261112110236-bd01071d | workflow_step | workflow:verify_reconciliation | 0 | 2026-11-12T11:02:36.094Z | HASH_OK |
| UAP-EV-20261112110236-ccd600b4 | task_step | step:inspect_refund_state_machine | 0 | 2026-11-12T11:02:36.060Z | HASH_OK |
| UAP-EV-20261112110236-cfa2b385 | workflow_step | workflow:test_idempotency | 0 | 2026-11-12T11:02:36.072Z | HASH_OK |
| UAP-EV-20261112110236-e170e010 | workflow_step | workflow:inspect_balance_ledger | 0 | 2026-11-12T11:02:36.066Z | HASH_OK |
| UAP-EV-20261112110236-e5099df5 | task_step | step:test_duplicate_notifications | 0 | 2026-11-12T11:02:36.084Z | HASH_OK |
| UAP-EV-20261112110236-f690722a | task_step | step:verify_reconciliation | 0 | 2026-11-12T11:02:36.095Z | HASH_OK |
| UAP-EV-20261112110236-fa709fe2 | task_step | step:inspect_payment_state_machine | 0 | 2026-11-12T11:02:36.054Z | HASH_OK |
| UAP-EV-20261112110236-fd225e22 | workflow_step | workflow:test_duplicate_notifications | 0 | 2026-11-12T11:02:36.083Z | HASH_OK |
| UAP-EV-20261112110236-ff460ad7 | workflow_step | workflow:inspect_payment_state_machine | 0 | 2026-11-12T11:02:36.054Z | HASH_OK |
| UAP-EV-20261112121709-07780097 | task_result | uap task run UAP-TASK-HEALTH-20261112121709-3867b875 | 0 | 2026-11-12T12:17:09.850Z | HASH_OK |
| UAP-EV-20261112121709-7c09fc17 | task_step | step:__health_step__ | 0 | 2026-11-12T12:17:09.840Z | HASH_OK |
| UAP-EV-20261112121709-9e61e3fb | task_step | step:probe.step1 | 0 | 2026-11-12T12:17:09.986Z | HASH_OK |
| UAP-EV-20261112121709-d5667659 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112121709-fbf7953d | 0 | 2026-11-12T12:17:09.998Z | HASH_OK |
| UAP-EV-20261112121710-004103fe | task_result | uap task run UAP-TASK-INTERRUPT-20261112121709-fbf7953d | 0 | 2026-11-12T12:17:10.015Z | HASH_OK |
| UAP-EV-20261112121710-01f709c5 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112121710-6461b7c9 | 0 | 2026-11-12T12:17:10.275Z | HASH_OK |
| UAP-EV-20261112121710-05ce49ba | task_step | step:probe.step1 | 0 | 2026-11-12T12:17:10.239Z | HASH_OK |
| UAP-EV-20261112121710-185bfda5 | task_step | step:__uap_test_always_fail__ | 1 | 2026-11-12T12:17:10.306Z | HASH_OK |
| UAP-EV-20261112121710-1ad89a50 | task_step | step:test_concurrency | 0 | 2026-11-12T12:17:10.538Z | HASH_OK |
| UAP-EV-20261112121710-1d33c39e | task_step | step:test_idempotency | 0 | 2026-11-12T12:17:10.533Z | HASH_OK |
| UAP-EV-20261112121710-2c40cbb7 | task_step | step:inspect_refund_state_machine | 0 | 2026-11-12T12:17:10.517Z | HASH_OK |
| UAP-EV-20261112121710-31bde2c2 | workflow_step | workflow:test_duplicate_notifications | 0 | 2026-11-12T12:17:10.545Z | HASH_OK |
| UAP-EV-20261112121710-3cabaeca | recovery | uap task resume UAP-TASK-INTERRUPT-20261112121710-6461b7c9 | 0 | 2026-11-12T12:17:10.251Z | HASH_OK |
| UAP-EV-20261112121710-3e0484c9 | task_step | step:test_duplicate_notifications | 0 | 2026-11-12T12:17:10.545Z | HASH_OK |
| UAP-EV-20261112121710-46463a23 | task_step | step:inspect_payment_state_machine | 0 | 2026-11-12T12:17:10.510Z | HASH_OK |
| UAP-EV-20261112121710-4bf7e20a | task_result | uap task run UAP-TASK-TEST-20261112121710-e79bf8d6 | 1 | 2026-11-12T12:17:10.314Z | HASH_OK |
| UAP-EV-20261112121710-4c0f9c45 | health_probe | evidence-engine.health() | 0 | 2026-11-12T12:17:10.027Z | HASH_OK |
| UAP-EV-20261112121710-5579abdf | task_step | step:test_failure_recovery | 0 | 2026-11-12T12:17:10.551Z | HASH_OK |
| UAP-EV-20261112121710-589d1356 | task_result | uap task run UAP-TASK-TEST-20261112121710-8da8a4ed | 0 | 2026-11-12T12:17:10.293Z | HASH_OK |
| UAP-EV-20261112121710-5b14bb91 | task_result | uap task run UAP-TASK-INTERRUPT-20261112121710-6461b7c9 | 0 | 2026-11-12T12:17:10.269Z | HASH_OK |
| UAP-EV-20261112121710-5df49282 | task_step | step:probe.step3 | 0 | 2026-11-12T12:17:10.007Z | HASH_OK |
| UAP-EV-20261112121710-762ad02a | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112121709-fbf7953d | 0 | 2026-11-12T12:17:10.022Z | HASH_OK |
| UAP-EV-20261112121710-7a42bd57 | workflow_step | workflow:test_idempotency | 0 | 2026-11-12T12:17:10.532Z | HASH_OK |
| UAP-EV-20261112121710-9613e9a2 | workflow_step | workflow:validate_environment | 0 | 2026-11-12T12:17:10.493Z | HASH_OK |
| UAP-EV-20261112121710-9685519d | task_step | step:inspect_balance_ledger | 0 | 2026-11-12T12:17:10.526Z | HASH_OK |
| UAP-EV-20261112121710-9eea7776 | task_step | step:__uap_test_retry_then_ok__ | 0 | 2026-11-12T12:17:10.285Z | HASH_OK |
| UAP-EV-20261112121710-a935e568 | task_step | step:verify_reconciliation | 0 | 2026-11-12T12:17:10.556Z | HASH_OK |
| UAP-EV-20261112121710-abc22a46 | workflow_step | workflow:test_concurrency | 0 | 2026-11-12T12:17:10.537Z | HASH_OK |
| UAP-EV-20261112121710-b03fe5ab | task_result | uap task run UAP-TASK-20261112121710-52129b55 | 0 | 2026-11-12T12:17:10.564Z | HASH_OK |
| UAP-EV-20261112121710-bc359107 | workflow_step | workflow:inspect_refund_state_machine | 0 | 2026-11-12T12:17:10.517Z | HASH_OK |
| UAP-EV-20261112121710-be9b60cb | workflow_step | workflow:inspect_balance_ledger | 0 | 2026-11-12T12:17:10.525Z | HASH_OK |
| UAP-EV-20261112121710-cc3bf412 | workflow_step | workflow:verify_reconciliation | 0 | 2026-11-12T12:17:10.555Z | HASH_OK |
| UAP-EV-20261112121710-e3fd7ab2 | workflow_step | workflow:inspect_payment_state_machine | 0 | 2026-11-12T12:17:10.510Z | HASH_OK |
| UAP-EV-20261112121710-f46e4746 | task_step | step:probe.step3 | 0 | 2026-11-12T12:17:10.261Z | HASH_OK |
| UAP-EV-20261112121710-f48f21db | runtime_test_run | node --test .uap/tests/runtime.test.mjs | 0 | 2026-11-12T12:17:10.652Z | HASH_OK |
| UAP-EV-20261112121710-f87f5aad | workflow_step | workflow:test_failure_recovery | 0 | 2026-11-12T12:17:10.550Z | HASH_OK |
| UAP-EV-20261112121710-f8ab0fcd | cli_command | uap test --all | 0 | 2026-11-12T12:17:10.655Z | HASH_OK |
| UAP-EV-20261112121710-fa0bd98a | task_step | step:probe.step2 | 0 | 2026-11-12T12:17:10.257Z | HASH_OK |
| UAP-EV-20261112121710-ffcc593e | task_step | step:probe.step2 | 0 | 2026-11-12T12:17:10.005Z | HASH_OK |
| UAP-EV-20261112121927-1d89e296 | cli_command | uap validate cross_platform.consistency_integrity | 0 | 2026-11-12T12:19:27.956Z | HASH_OK |
| UAP-EV-20261112121927-644cf224 | cli_command | uap validate quality.test_integrity | 0 | 2026-11-12T12:19:27.533Z | HASH_OK |
| UAP-EV-20261112121927-68cbc3eb | cli_command | uap validate delivery.ci_integrity | 0 | 2026-11-12T12:19:27.718Z | HASH_OK |
| UAP-EV-20261112121927-7a3ae105 | validator_result | uap validate delivery.ci_integrity | 0 | 2026-11-12T12:19:27.715Z | HASH_OK |
| UAP-EV-20261112121927-802a7a7a | validator_result | uap validate quality.engineering_integrity | 1 | 2026-11-12T12:19:27.341Z | HASH_OK |
| UAP-EV-20261112121927-9ebef138 | cli_command | uap validate quality.engineering_integrity | 1 | 2026-11-12T12:19:27.345Z | HASH_OK |
| UAP-EV-20261112121927-d49a1b2c | validator_result | uap validate cross_platform.consistency_integrity | 0 | 2026-11-12T12:19:27.955Z | HASH_OK |
| UAP-EV-20261112121927-d84c5b13 | validator_result | uap validate quality.test_integrity | 0 | 2026-11-12T12:19:27.530Z | HASH_OK |
| UAP-EV-20261112121928-716efc5e | validator_result | uap validate security.application_integrity | 0 | 2026-11-12T12:19:28.404Z | HASH_OK |
| UAP-EV-20261112121928-87a7355d | cli_command | uap validate security.application_integrity | 0 | 2026-11-12T12:19:28.406Z | HASH_OK |
| UAP-EV-20261112121944-0c5452f9 | cli_command | uap validate quality.engineering_integrity | 1 | 2026-11-12T12:19:44.663Z | HASH_OK |
| UAP-EV-20261112121944-c2753492 | validator_result | uap validate quality.engineering_integrity | 1 | 2026-11-12T12:19:44.658Z | HASH_OK |
| UAP-EV-20261112122705-d1df32dc | cli_command | uap build --full | 1 | 2026-11-12T12:27:05.209Z | HASH_OK |
| UAP-EV-20261112142228-72f55691 | cli_command | uap validate quality.engineering_integrity | 1 | 2026-11-12T14:22:28.494Z | HASH_OK |
| UAP-EV-20261112142228-96e8bef7 | validator_result | uap validate quality.engineering_integrity | 1 | 2026-11-12T14:22:28.491Z | HASH_OK |
| UAP-EV-20261112142321-002739ad | task_result | uap task run UAP-TASK-TEST-20261112142321-bd05b184 | 1 | 2026-11-12T14:23:21.730Z | HASH_OK |
| UAP-EV-20261112142321-06770333 | workflow_step | workflow:test_concurrency | 0 | 2026-11-12T14:23:21.983Z | HASH_OK |
| UAP-EV-20261112142321-0877b258 | task_step | step:test_idempotency | 0 | 2026-11-12T14:23:21.968Z | HASH_OK |
| UAP-EV-20261112142321-0ef4eedc | task_step | step:__health_step__ | 0 | 2026-11-12T14:23:21.086Z | HASH_OK |
| UAP-EV-20261112142321-240723d7 | workflow_step | workflow:test_idempotency | 0 | 2026-11-12T14:23:21.967Z | HASH_OK |
| UAP-EV-20261112142321-4c6b0832 | task_result | uap task run UAP-TASK-INTERRUPT-20261112142321-61c0fccd | 0 | 2026-11-12T14:23:21.662Z | HASH_OK |
| UAP-EV-20261112142321-57baea2a | recovery | uap task resume UAP-TASK-INTERRUPT-20261112142321-61c0fccd | 0 | 2026-11-12T14:23:21.642Z | HASH_OK |
| UAP-EV-20261112142321-5982068b | task_result | uap task run UAP-TASK-INTERRUPT-20261112142321-bef04555 | 0 | 2026-11-12T14:23:21.342Z | HASH_OK |
| UAP-EV-20261112142321-68e17c62 | health_probe | evidence-engine.health() | 0 | 2026-11-12T14:23:21.355Z | HASH_OK |
| UAP-EV-20261112142321-85cc3057 | task_step | step:probe.step3 | 0 | 2026-11-12T14:23:21.329Z | HASH_OK |
| UAP-EV-20261112142321-8fe4b97f | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112142321-61c0fccd | 0 | 2026-11-12T14:23:21.673Z | HASH_OK |
| UAP-EV-20261112142321-90989158 | task_result | uap task run UAP-TASK-TEST-20261112142321-bb1a2431 | 0 | 2026-11-12T14:23:21.698Z | HASH_OK |
| UAP-EV-20261112142321-95306f0a | task_step | step:probe.step2 | 0 | 2026-11-12T14:23:21.320Z | HASH_OK |
| UAP-EV-20261112142321-9939132d | task_step | step:test_concurrency | 0 | 2026-11-12T14:23:21.985Z | HASH_OK |
| UAP-EV-20261112142321-9d603b03 | task_result | uap task run UAP-TASK-HEALTH-20261112142321-b3afa92d | 0 | 2026-11-12T14:23:21.102Z | HASH_OK |
| UAP-EV-20261112142321-a2d9a086 | workflow_step | workflow:validate_environment | 0 | 2026-11-12T14:23:21.912Z | HASH_OK |
| UAP-EV-20261112142321-a4ec90d2 | workflow_step | workflow:test_duplicate_notifications | 0 | 2026-11-12T14:23:21.996Z | HASH_OK |
| UAP-EV-20261112142321-a7704e7f | task_step | step:inspect_balance_ledger | 0 | 2026-11-12T14:23:21.956Z | HASH_OK |
| UAP-EV-20261112142321-af241086 | task_step | step:__uap_test_always_fail__ | 1 | 2026-11-12T14:23:21.714Z | HASH_OK |
| UAP-EV-20261112142321-afceacb3 | workflow_step | workflow:inspect_refund_state_machine | 0 | 2026-11-12T14:23:21.943Z | HASH_OK |
| UAP-EV-20261112142321-b0eedffd | workflow_step | workflow:inspect_balance_ledger | 0 | 2026-11-12T14:23:21.955Z | HASH_OK |
| UAP-EV-20261112142321-b9378fab | task_step | step:probe.step2 | 0 | 2026-11-12T14:23:21.649Z | HASH_OK |
| UAP-EV-20261112142321-b9800f16 | task_step | step:inspect_payment_state_machine | 0 | 2026-11-12T14:23:21.935Z | HASH_OK |
| UAP-EV-20261112142321-c9535be6 | task_step | step:test_duplicate_notifications | 0 | 2026-11-12T14:23:21.996Z | HASH_OK |
| UAP-EV-20261112142321-cff505cc | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112142321-bef04555 | 0 | 2026-11-12T14:23:21.349Z | HASH_OK |
| UAP-EV-20261112142321-d2155f99 | workflow_step | workflow:inspect_payment_state_machine | 0 | 2026-11-12T14:23:21.935Z | HASH_OK |
| UAP-EV-20261112142321-d39876ac | task_step | step:__uap_test_retry_then_ok__ | 0 | 2026-11-12T14:23:21.687Z | HASH_OK |
| UAP-EV-20261112142321-daca003a | task_step | step:inspect_refund_state_machine | 0 | 2026-11-12T14:23:21.943Z | HASH_OK |
| UAP-EV-20261112142321-e085666b | recovery | uap task resume UAP-TASK-INTERRUPT-20261112142321-bef04555 | 0 | 2026-11-12T14:23:21.311Z | HASH_OK |
| UAP-EV-20261112142321-e80af3cf | task_step | step:probe.step3 | 0 | 2026-11-12T14:23:21.652Z | HASH_OK |
| UAP-EV-20261112142321-fb27e134 | task_step | step:probe.step1 | 0 | 2026-11-12T14:23:21.626Z | HASH_OK |
| UAP-EV-20261112142321-fb7d2ab7 | task_step | step:probe.step1 | 0 | 2026-11-12T14:23:21.295Z | HASH_OK |
| UAP-EV-20261112142322-03ec0a2f | runtime_test_run | node --test .uap/tests/runtime.test.mjs | 0 | 2026-11-12T14:23:22.149Z | HASH_OK |
| UAP-EV-20261112142322-1781b3e8 | task_step | step:test_failure_recovery | 0 | 2026-11-12T14:23:22.006Z | HASH_OK |
| UAP-EV-20261112142322-2fb69a60 | workflow_step | workflow:verify_reconciliation | 0 | 2026-11-12T14:23:22.015Z | HASH_OK |
| UAP-EV-20261112142322-495d030e | task_step | step:verify_reconciliation | 0 | 2026-11-12T14:23:22.017Z | HASH_OK |
| UAP-EV-20261112142322-aa8cff15 | workflow_step | workflow:test_failure_recovery | 0 | 2026-11-12T14:23:22.006Z | HASH_OK |
| UAP-EV-20261112142322-f67c35b6 | cli_command | uap test --all | 0 | 2026-11-12T14:23:22.152Z | HASH_OK |
| UAP-EV-20261112142322-ff9cf77d | task_result | uap task run UAP-TASK-20261112142321-a0190764 | 0 | 2026-11-12T14:23:22.034Z | HASH_OK |
| UAP-EV-20261112142332-4115d509 | cli_command | uap validate quality.gate_integrity | 0 | 2026-11-12T14:23:32.922Z | HASH_OK |
| UAP-EV-20261112142332-4685d5f4 | validator_result | uap validate quality.test_integrity | 0 | 2026-11-12T14:23:32.466Z | HASH_OK |
| UAP-EV-20261112142332-6b4110ac | cli_command | uap validate quality.test_integrity | 0 | 2026-11-12T14:23:32.470Z | HASH_OK |
| UAP-EV-20261112142332-6d7ce048 | validator_result | uap validate quality.gate_integrity | 0 | 2026-11-12T14:23:32.919Z | HASH_OK |
| UAP-EV-20261112142332-d755302f | cli_command | uap validate quality.engineering_integrity | 0 | 2026-11-12T14:23:32.223Z | HASH_OK |
| UAP-EV-20261112142332-e8d87547 | validator_result | uap validate quality.engineering_integrity | 0 | 2026-11-12T14:23:32.218Z | HASH_OK |
| UAP-EV-20261112142349-5a4ecbc2 | cli_command | uap workflow list | 0 | 2026-11-12T14:23:49.998Z | HASH_OK |
| UAP-EV-20261112143422-dc3f0dd3 | cli_command | uap build --full | 1 | 2026-11-12T14:34:22.522Z | HASH_OK |
| UAP-EV-20261112143632-15872991 | task_step | step:validate_specification_registry | 0 | 2026-11-12T14:36:32.270Z | HASH_OK |
| UAP-EV-20261112143632-1659b555 | task_step | step:probe.step1 | 0 | 2026-11-12T14:36:32.523Z | HASH_OK |
| UAP-EV-20261112143632-1b6f0cb3 | task_result | uap task run UAP-TASK-HEALTH-20261112143632-a8830b4e | 0 | 2026-11-12T14:36:32.326Z | HASH_OK |
| UAP-EV-20261112143632-21466546 | workflow_step | workflow:validate_specification_registry | 0 | 2026-11-12T14:36:32.269Z | HASH_OK |
| UAP-EV-20261112143632-3d74263c | task_result | uap task run UAP-TASK-INTERRUPT-20261112143632-1cfa9cdc | 0 | 2026-11-12T14:36:32.612Z | HASH_OK |
| UAP-EV-20261112143632-3e0111fa | task_step | step:probe.step2 | 0 | 2026-11-12T14:36:32.562Z | HASH_OK |
| UAP-EV-20261112143632-51f9680e | task_step | step:initialize_uap_structure | 0 | 2026-11-12T14:36:32.234Z | HASH_OK |
| UAP-EV-20261112143632-572e472d | workflow_step | workflow:initialize_uap_structure | 0 | 2026-11-12T14:36:32.234Z | HASH_OK |
| UAP-EV-20261112143632-5a982e36 | task_step | step:inspect_repository | 0 | 2026-11-12T14:36:32.150Z | HASH_OK |
| UAP-EV-20261112143632-7b642e3b | workflow_step | workflow:initialize_runtime | 0 | 2026-11-12T14:36:32.710Z | HASH_OK |
| UAP-EV-20261112143632-9b058a0a | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112143632-1cfa9cdc | 0 | 2026-11-12T14:36:32.644Z | HASH_OK |
| UAP-EV-20261112143632-a5a967d7 | task_step | step:initialize_runtime | 0 | 2026-11-12T14:36:32.711Z | HASH_OK |
| UAP-EV-20261112143632-a6275d57 | task_step | step:probe.step3 | 0 | 2026-11-12T14:36:32.575Z | HASH_OK |
| UAP-EV-20261112143632-a8a0398e | workflow_step | workflow:validate_environment | 0 | 2026-11-12T14:36:32.225Z | HASH_OK |
| UAP-EV-20261112143632-c7450058 | workflow_step | workflow:inspect_repository | 0 | 2026-11-12T14:36:32.149Z | HASH_OK |
| UAP-EV-20261112143632-c7693f54 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112143632-1cfa9cdc | 0 | 2026-11-12T14:36:32.545Z | HASH_OK |
| UAP-EV-20261112143632-d6c8e000 | health_probe | evidence-engine.health() | 0 | 2026-11-12T14:36:32.659Z | HASH_OK |
| UAP-EV-20261112143632-dc9176df | task_step | step:validate_environment | 0 | 2026-11-12T14:36:32.225Z | HASH_OK |
| UAP-EV-20261112143632-ec5c66a1 | task_step | step:__health_step__ | 0 | 2026-11-12T14:36:32.306Z | HASH_OK |
| UAP-EV-20261112143633-0b43ebb0 | task_result | uap task run UAP-TASK-INTERRUPT-20261112143633-0ff1aa71 | 0 | 2026-11-12T14:36:33.572Z | HASH_OK |
| UAP-EV-20261112143633-8323f946 | task_result | uap task run UAP-TASK-HEALTH-20261112143633-d87df746 | 0 | 2026-11-12T14:36:33.316Z | HASH_OK |
| UAP-EV-20261112143633-97bf857c | health_probe | evidence-engine.health() | 0 | 2026-11-12T14:36:33.592Z | HASH_OK |
| UAP-EV-20261112143633-b12696cf | task_step | step:__health_step__ | 0 | 2026-11-12T14:36:33.297Z | HASH_OK |
| UAP-EV-20261112143633-b27b80a4 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112143633-0ff1aa71 | 0 | 2026-11-12T14:36:33.584Z | HASH_OK |
| UAP-EV-20261112143633-bf75fa7c | task_step | step:probe.step2 | 0 | 2026-11-12T14:36:33.544Z | HASH_OK |
| UAP-EV-20261112143633-ccbdfb35 | task_step | step:probe.step3 | 0 | 2026-11-12T14:36:33.554Z | HASH_OK |
| UAP-EV-20261112143633-cd07a275 | task_step | step:probe.step1 | 0 | 2026-11-12T14:36:33.512Z | HASH_OK |
| UAP-EV-20261112143633-f167fe77 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112143633-0ff1aa71 | 0 | 2026-11-12T14:36:33.534Z | HASH_OK |
| UAP-EV-20261112143634-0108bda3 | workflow_step | workflow:inspect_balance_ledger | 0 | 2026-11-12T14:36:34.319Z | HASH_OK |
| UAP-EV-20261112143634-045d7c84 | workflow_step | workflow:build_defect_registry | 0 | 2026-11-12T14:36:34.928Z | HASH_OK |
| UAP-EV-20261112143634-0704f86c | workflow_step | workflow:test_duplicate_notifications | 0 | 2026-11-12T14:36:34.350Z | HASH_OK |
| UAP-EV-20261112143634-09288d7f | task_step | step:probe.step1 | 0 | 2026-11-12T14:36:34.005Z | HASH_OK |
| UAP-EV-20261112143634-0c33597c | task_step | step:scan_security | 0 | 2026-11-12T14:36:34.841Z | HASH_OK |
| UAP-EV-20261112143634-0df1439d | workflow_step | workflow:inspect_project | 0 | 2026-11-12T14:36:34.715Z | HASH_OK |
| UAP-EV-20261112143634-12727358 | task_step | step:inspect_balance_ledger | 0 | 2026-11-12T14:36:34.320Z | HASH_OK |
| UAP-EV-20261112143634-18e7d448 | task_step | step:inspect_refund_state_machine | 0 | 2026-11-12T14:36:34.307Z | HASH_OK |
| UAP-EV-20261112143634-192a27ed | task_step | step:test_failure_recovery | 0 | 2026-11-12T14:36:34.363Z | HASH_OK |
| UAP-EV-20261112143634-1d92e0bb | recovery | uap task resume UAP-TASK-INTERRUPT-20261112143633-93ea9966 | 0 | 2026-11-12T14:36:34.031Z | HASH_OK |
| UAP-EV-20261112143634-1df789d3 | task_step | step:inspect_payment_state_machine | 0 | 2026-11-12T14:36:34.296Z | HASH_OK |
| UAP-EV-20261112143634-1efbd5a3 | task_step | step:run_runtime_tests | 0 | 2026-11-12T14:36:34.516Z | HASH_OK |
| UAP-EV-20261112143634-20f9ae56 | task_step | step:__uap_test_retry_then_ok__ | 0 | 2026-11-12T14:36:34.099Z | HASH_OK |
| UAP-EV-20261112143634-26dc3f68 | task_step | step:scan_architecture | 0 | 2026-11-12T14:36:34.777Z | HASH_OK |
| UAP-EV-20261112143634-359da050 | task_step | step:scan_development | 0 | 2026-11-12T14:36:34.807Z | HASH_OK |
| UAP-EV-20261112143634-43fb2bcc | task_step | step:verify_reconciliation | 0 | 2026-11-12T14:36:34.374Z | HASH_OK |
| UAP-EV-20261112143634-446eae4e | task_result | uap task run UAP-TASK-20261112143631-4196c0cf | 0 | 2026-11-12T14:36:34.542Z | HASH_OK |
| UAP-EV-20261112143634-46e5d8c2 | task_step | step:test_idempotency | 0 | 2026-11-12T14:36:34.330Z | HASH_OK |
| UAP-EV-20261112143634-49101972 | task_step | step:scan_cross_platform | 0 | 2026-11-12T14:36:34.879Z | HASH_OK |
| UAP-EV-20261112143634-4d143aa9 | workflow_step | workflow:inspect_payment_state_machine | 0 | 2026-11-12T14:36:34.296Z | HASH_OK |
| UAP-EV-20261112143634-521a1f39 | workflow_step | workflow:inspect_refund_state_machine | 0 | 2026-11-12T14:36:34.306Z | HASH_OK |
| UAP-EV-20261112143634-52dbd8ac | workflow_step | workflow:validate_environment | 0 | 2026-11-12T14:36:34.265Z | HASH_OK |
| UAP-EV-20261112143634-58cdd585 | task_result | uap task run UAP-TASK-20261112143634-a399726a | 0 | 2026-11-12T14:36:34.968Z | HASH_OK |
| UAP-EV-20261112143634-5c170cb9 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112143633-93ea9966 | 0 | 2026-11-12T14:36:34.078Z | HASH_OK |
| UAP-EV-20261112143634-5d561867 | task_step | step:test_duplicate_notifications | 0 | 2026-11-12T14:36:34.351Z | HASH_OK |
| UAP-EV-20261112143634-64780094 | workflow_step | workflow:test_concurrency | 0 | 2026-11-12T14:36:34.338Z | HASH_OK |
| UAP-EV-20261112143634-68202c5b | workflow_step | workflow:scan_knowledge | 0 | 2026-11-12T14:36:34.913Z | HASH_OK |
| UAP-EV-20261112143634-712dd77c | task_step | step:scan_quality | 0 | 2026-11-12T14:36:34.824Z | HASH_OK |
| UAP-EV-20261112143634-7169ae72 | task_step | step:scan_delivery | 0 | 2026-11-12T14:36:34.895Z | HASH_OK |
| UAP-EV-20261112143634-76106f37 | workflow_step | workflow:scan_agents | 0 | 2026-11-12T14:36:34.791Z | HASH_OK |
| UAP-EV-20261112143634-774dc955 | task_step | step:inspect_project | 0 | 2026-11-12T14:36:34.716Z | HASH_OK |
| UAP-EV-20261112143634-82747955 | task_result | uap task run UAP-TASK-20261112143634-f344f2e6 | 0 | 2026-11-12T14:36:34.397Z | HASH_OK |
| UAP-EV-20261112143634-833affbf | task_step | step:scan_knowledge | 0 | 2026-11-12T14:36:34.914Z | HASH_OK |
| UAP-EV-20261112143634-85d082a2 | workflow_step | workflow:scan_cross_platform | 0 | 2026-11-12T14:36:34.879Z | HASH_OK |
| UAP-EV-20261112143634-8701f27a | workflow_step | workflow:scan_delivery | 0 | 2026-11-12T14:36:34.894Z | HASH_OK |
| UAP-EV-20261112143634-8a4abb4f | task_step | step:__uap_test_always_fail__ | 1 | 2026-11-12T14:36:34.148Z | HASH_OK |
| UAP-EV-20261112143634-8b40a865 | task_result | uap task run UAP-TASK-TEST-20261112143634-d056a140 | 0 | 2026-11-12T14:36:34.118Z | HASH_OK |
| UAP-EV-20261112143634-8e0bfb53 | task_step | step:build_defect_registry | 0 | 2026-11-12T14:36:34.929Z | HASH_OK |
| UAP-EV-20261112143634-93197f94 | task_step | step:scan_agents | 0 | 2026-11-12T14:36:34.792Z | HASH_OK |
| UAP-EV-20261112143634-940e246b | task_result | uap task run UAP-TASK-TEST-20261112143634-c76203fd | 1 | 2026-11-12T14:36:34.167Z | HASH_OK |
| UAP-EV-20261112143634-9aa6b854 | task_step | step:test_concurrency | 0 | 2026-11-12T14:36:34.339Z | HASH_OK |
| UAP-EV-20261112143634-9ca40016 | workflow_step | workflow:verify_reconciliation | 0 | 2026-11-12T14:36:34.373Z | HASH_OK |
| UAP-EV-20261112143634-a036151d | workflow_step | workflow:test_failure_recovery | 0 | 2026-11-12T14:36:34.362Z | HASH_OK |
| UAP-EV-20261112143634-a1f6db25 | workflow_step | workflow:run_runtime_tests | 0 | 2026-11-12T14:36:34.516Z | HASH_OK |
| UAP-EV-20261112143634-a31e6a7d | task_step | step:scan_requirements | 0 | 2026-11-12T14:36:34.755Z | HASH_OK |
| UAP-EV-20261112143634-cb224569 | task_step | step:probe.step2 | 0 | 2026-11-12T14:36:34.040Z | HASH_OK |
| UAP-EV-20261112143634-cb647e00 | workflow_step | workflow:scan_security | 0 | 2026-11-12T14:36:34.841Z | HASH_OK |
| UAP-EV-20261112143634-cbc5b241 | workflow_step | workflow:scan_development | 0 | 2026-11-12T14:36:34.806Z | HASH_OK |
| UAP-EV-20261112143634-d6fea248 | task_result | uap task run UAP-TASK-INTERRUPT-20261112143633-93ea9966 | 0 | 2026-11-12T14:36:34.066Z | HASH_OK |
| UAP-EV-20261112143634-dd18a453 | workflow_step | workflow:scan_requirements | 0 | 2026-11-12T14:36:34.754Z | HASH_OK |
| UAP-EV-20261112143634-e081517f | task_step | step:probe.step3 | 0 | 2026-11-12T14:36:34.048Z | HASH_OK |
| UAP-EV-20261112143634-e1013d7f | workflow_step | workflow:test_idempotency | 0 | 2026-11-12T14:36:34.330Z | HASH_OK |
| UAP-EV-20261112143634-fd07d90f | workflow_step | workflow:scan_architecture | 0 | 2026-11-12T14:36:34.777Z | HASH_OK |
| UAP-EV-20261112143634-ffac656f | workflow_step | workflow:scan_quality | 0 | 2026-11-12T14:36:34.822Z | HASH_OK |
| UAP-EV-20261112143635-05a3b956 | workflow_step | workflow:implement_missing_validators | 0 | 2026-11-12T14:36:35.075Z | HASH_OK |
| UAP-EV-20261112143635-0ffed4cc | workflow_step | workflow:apply_authorized_repair | 0 | 2026-11-12T14:36:35.943Z | HASH_OK |
| UAP-EV-20261112143635-1ba705bd | recovery | uap task resume UAP-TASK-INTERRUPT-20261112143635-af5d2627 | 0 | 2026-11-12T14:36:35.634Z | HASH_OK |
| UAP-EV-20261112143635-258bd88f | task_step | step:create_execution_plan | 0 | 2026-11-12T14:36:35.041Z | HASH_OK |
| UAP-EV-20261112143635-27973afe | task_step | step:probe.step2 | 0 | 2026-11-12T14:36:35.654Z | HASH_OK |
| UAP-EV-20261112143635-2c18ca1a | task_step | step:__health_step__ | 0 | 2026-11-12T14:36:35.135Z | HASH_OK |
| UAP-EV-20261112143635-2de7293c | workflow_step | workflow:implement_missing_capabilities | 0 | 2026-11-12T14:36:35.056Z | HASH_OK |
| UAP-EV-20261112143635-2f3e43c2 | workflow_step | workflow:execute_targeted_tests | 1 | 2026-11-12T14:36:35.781Z | HASH_OK |
| UAP-EV-20261112143635-411508c6 | workflow_step | workflow:resolve_dependencies | 0 | 2026-11-12T14:36:35.024Z | HASH_OK |
| UAP-EV-20261112143635-45086d6a | workflow_step | workflow:identify_root_cause | 0 | 2026-11-12T14:36:35.878Z | HASH_OK |
| UAP-EV-20261112143635-5ba9a963 | workflow_step | workflow:integrate_runtime | 0 | 2026-11-12T14:36:35.764Z | HASH_OK |
| UAP-EV-20261112143635-5bb5e7d0 | task_step | step:generate_repair_plan | 0 | 2026-11-12T14:36:35.912Z | HASH_OK |
| UAP-EV-20261112143635-602fd920 | task_step | step:integrate_runtime | 0 | 2026-11-12T14:36:35.765Z | HASH_OK |
| UAP-EV-20261112143635-62299eb2 | workflow_step | workflow:create_execution_plan | 0 | 2026-11-12T14:36:35.041Z | HASH_OK |
| UAP-EV-20261112143635-65cc4984 | task_step | step:run_regression | 1 | 2026-11-12T14:36:35.960Z | HASH_OK |
| UAP-EV-20261112143635-6dbcdd87 | task_step | step:implement_missing_validators | 0 | 2026-11-12T14:36:35.076Z | HASH_OK |
| UAP-EV-20261112143635-73483537 | task_step | step:identify_root_cause | 0 | 2026-11-12T14:36:35.879Z | HASH_OK |
| UAP-EV-20261112143635-7acd8f04 | task_step | step:resolve_dependencies | 0 | 2026-11-12T14:36:35.025Z | HASH_OK |
| UAP-EV-20261112143635-7b6e4709 | workflow_step | workflow:run_regression | 1 | 2026-11-12T14:36:35.960Z | HASH_OK |
| UAP-EV-20261112143635-8ac7db8d | task_result | uap task run UAP-TASK-20261112143634-31f21b4e | 1 | 2026-11-12T14:36:35.813Z | HASH_OK |
| UAP-EV-20261112143635-957b3bca | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112143635-af5d2627 | 0 | 2026-11-12T14:36:35.727Z | HASH_OK |
| UAP-EV-20261112143635-a603c72f | task_step | step:apply_authorized_repair | 0 | 2026-11-12T14:36:35.944Z | HASH_OK |
| UAP-EV-20261112143635-ae6e4b12 | task_step | step:execute_targeted_tests | 1 | 2026-11-12T14:36:35.782Z | HASH_OK |
| UAP-EV-20261112143635-b600f400 | task_result | uap task run UAP-TASK-INTERRUPT-20261112143635-af5d2627 | 0 | 2026-11-12T14:36:35.704Z | HASH_OK |
| UAP-EV-20261112143635-b84963fa | workflow_step | workflow:calculate_impact | 0 | 2026-11-12T14:36:35.892Z | HASH_OK |
| UAP-EV-20261112143635-c29eaf6c | task_step | step:calculate_impact | 0 | 2026-11-12T14:36:35.893Z | HASH_OK |
| UAP-EV-20261112143635-c847c982 | workflow_step | workflow:generate_repair_plan | 0 | 2026-11-12T14:36:35.911Z | HASH_OK |
| UAP-EV-20261112143635-ca998c65 | health_probe | evidence-engine.health() | 0 | 2026-11-12T14:36:35.733Z | HASH_OK |
| UAP-EV-20261112143635-cfb3e4a3 | task_step | step:classify_defect | 0 | 2026-11-12T14:36:35.863Z | HASH_OK |
| UAP-EV-20261112143635-e32ded3e | task_step | step:implement_missing_capabilities | 0 | 2026-11-12T14:36:35.057Z | HASH_OK |
| UAP-EV-20261112143635-e3b6aa20 | workflow_step | workflow:classify_defect | 0 | 2026-11-12T14:36:35.862Z | HASH_OK |
| UAP-EV-20261112143635-e8a2ad62 | task_result | uap task run UAP-TASK-HEALTH-20261112143635-b39c5d30 | 0 | 2026-11-12T14:36:35.174Z | HASH_OK |
| UAP-EV-20261112143635-f38c0c27 | task_step | step:probe.step3 | 0 | 2026-11-12T14:36:35.667Z | HASH_OK |
| UAP-EV-20261112143635-f390cbe1 | task_result | uap task run UAP-TASK-20261112143635-bbbe5f03 | 1 | 2026-11-12T14:36:35.998Z | HASH_OK |
| UAP-EV-20261112143635-fcf39b41 | task_step | step:probe.step1 | 0 | 2026-11-12T14:36:35.600Z | HASH_OK |
| UAP-EV-20261112143641-01fe8485 | workflow_step | workflow:typecheck | 0 | 2026-11-12T14:36:41.837Z | HASH_OK |
| UAP-EV-20261112143641-057689b0 | workflow_step | workflow:inspect_payment_state_machine | 0 | 2026-11-12T14:36:41.924Z | HASH_OK |
| UAP-EV-20261112143641-06357fc0 | workflow_step | workflow:unit_tests | 1 | 2026-11-12T14:36:41.852Z | HASH_OK |
| UAP-EV-20261112143641-089cbbb0 | task_step | step:test_concurrency | 0 | 2026-11-12T14:36:41.973Z | HASH_OK |
| UAP-EV-20261112143641-0e560626 | task_step | step:lint | 0 | 2026-11-12T14:36:41.825Z | HASH_OK |
| UAP-EV-20261112143641-16321e9f | workflow_step | workflow:inspect_balance_ledger | 0 | 2026-11-12T14:36:41.950Z | HASH_OK |
| UAP-EV-20261112143641-38ae017e | task_step | step:test_failure_recovery | 0 | 2026-11-12T14:36:41.995Z | HASH_OK |
| UAP-EV-20261112143641-3e96d7e7 | task_step | step:inspect_refund_state_machine | 0 | 2026-11-12T14:36:41.935Z | HASH_OK |
| UAP-EV-20261112143641-459911ea | task_step | step:unit_tests | 1 | 2026-11-12T14:36:41.852Z | HASH_OK |
| UAP-EV-20261112143641-5d17a00c | workflow_step | workflow:test_idempotency | 0 | 2026-11-12T14:36:41.961Z | HASH_OK |
| UAP-EV-20261112143641-6319c245 | task_step | step:test_duplicate_notifications | 0 | 2026-11-12T14:36:41.984Z | HASH_OK |
| UAP-EV-20261112143641-7724bb3d | task_step | step:typecheck | 0 | 2026-11-12T14:36:41.838Z | HASH_OK |
| UAP-EV-20261112143641-772bb0b9 | task_step | step:test_idempotency | 0 | 2026-11-12T14:36:41.962Z | HASH_OK |
| UAP-EV-20261112143641-92e38861 | task_step | step:inspect_balance_ledger | 0 | 2026-11-12T14:36:41.951Z | HASH_OK |
| UAP-EV-20261112143641-96a39779 | workflow_step | workflow:test_duplicate_notifications | 0 | 2026-11-12T14:36:41.983Z | HASH_OK |
| UAP-EV-20261112143641-aa9c7804 | workflow_step | workflow:inspect_refund_state_machine | 0 | 2026-11-12T14:36:41.935Z | HASH_OK |
| UAP-EV-20261112143641-ca061210 | task_step | step:inspect_payment_state_machine | 0 | 2026-11-12T14:36:41.925Z | HASH_OK |
| UAP-EV-20261112143641-e43f7e99 | task_result | uap task run UAP-TASK-20261112143636-65a4b482 | 1 | 2026-11-12T14:36:41.881Z | HASH_OK |
| UAP-EV-20261112143641-f23c90f6 | workflow_step | workflow:lint | 0 | 2026-11-12T14:36:41.824Z | HASH_OK |
| UAP-EV-20261112143641-f7d03176 | workflow_step | workflow:test_concurrency | 0 | 2026-11-12T14:36:41.972Z | HASH_OK |
| UAP-EV-20261112143641-fe8b65fd | workflow_step | workflow:test_failure_recovery | 0 | 2026-11-12T14:36:41.994Z | HASH_OK |
| UAP-EV-20261112143642-10c91282 | task_step | step:run_full_quality_gate | 1 | 2026-11-12T14:36:42.140Z | HASH_OK |
| UAP-EV-20261112143642-33561ab5 | workflow_step | workflow:run_full_quality_gate | 1 | 2026-11-12T14:36:42.140Z | HASH_OK |
| UAP-EV-20261112143642-3cc66306 | workflow_step | workflow:validate_all_validators | 0 | 2026-11-12T14:36:42.128Z | HASH_OK |
| UAP-EV-20261112143642-49410fba | workflow_step | workflow:validate_all_agents | 0 | 2026-11-12T14:36:42.103Z | HASH_OK |
| UAP-EV-20261112143642-4c6ad844 | task_step | step:validate_all_agents | 0 | 2026-11-12T14:36:42.104Z | HASH_OK |
| UAP-EV-20261112143642-520892a3 | task_step | step:validate_all_executors | 0 | 2026-11-12T14:36:42.092Z | HASH_OK |
| UAP-EV-20261112143642-6cf59665 | task_step | step:verify_reconciliation | 0 | 2026-11-12T14:36:42.007Z | HASH_OK |
| UAP-EV-20261112143642-6e764eb1 | task_step | step:validate_all_workflows | 0 | 2026-11-12T14:36:42.116Z | HASH_OK |
| UAP-EV-20261112143642-71150228 | workflow_step | workflow:validate_all_specifications | 0 | 2026-11-12T14:36:42.082Z | HASH_OK |
| UAP-EV-20261112143642-95b92bdc | task_result | uap task run UAP-TASK-20261112143641-9c96d80b | 0 | 2026-11-12T14:36:42.032Z | HASH_OK |
| UAP-EV-20261112143642-a6254e93 | workflow_step | workflow:validate_all_workflows | 0 | 2026-11-12T14:36:42.116Z | HASH_OK |
| UAP-EV-20261112143642-cb4d210e | cli_command | uap workflow run --all | 1 | 2026-11-12T14:36:42.180Z | HASH_OK |
| UAP-EV-20261112143642-cb8d2940 | workflow_step | workflow:validate_all_executors | 0 | 2026-11-12T14:36:42.092Z | HASH_OK |
| UAP-EV-20261112143642-d2816eaf | task_step | step:validate_all_validators | 0 | 2026-11-12T14:36:42.130Z | HASH_OK |
| UAP-EV-20261112143642-d3be5754 | workflow_step | workflow:verify_reconciliation | 0 | 2026-11-12T14:36:42.007Z | HASH_OK |
| UAP-EV-20261112143642-dea8834d | task_step | step:validate_all_specifications | 0 | 2026-11-12T14:36:42.083Z | HASH_OK |
| UAP-EV-20261112143642-e234912a | task_result | uap task run UAP-TASK-20261112143642-1cd047e6 | 1 | 2026-11-12T14:36:42.164Z | HASH_OK |
| UAP-EV-20261112143759-15623620 | workflow_step | workflow:unit_tests | 1 | 2026-11-12T14:37:59.238Z | HASH_OK |
| UAP-EV-20261112143759-5aba81e8 | task_result | uap task run UAP-TASK-20261112143754-15f94101 | 1 | 2026-11-12T14:37:59.275Z | HASH_OK |
| UAP-EV-20261112143759-8f671531 | task_step | step:lint | 0 | 2026-11-12T14:37:59.197Z | HASH_OK |
| UAP-EV-20261112143759-add7dd35 | task_step | step:typecheck | 0 | 2026-11-12T14:37:59.217Z | HASH_OK |
| UAP-EV-20261112143759-b03b4009 | workflow_step | workflow:typecheck | 0 | 2026-11-12T14:37:59.216Z | HASH_OK |
| UAP-EV-20261112143759-c9f85577 | workflow_step | workflow:lint | 0 | 2026-11-12T14:37:59.196Z | HASH_OK |
| UAP-EV-20261112143759-ebeaf810 | cli_command | uap workflow run uap-quality-gate | 2 | 2026-11-12T14:37:59.290Z | HASH_OK |
| UAP-EV-20261112143759-ee76013c | task_step | step:unit_tests | 1 | 2026-11-12T14:37:59.239Z | HASH_OK |
| UAP-EV-20261112144443-127d7776 | cli_command | uap build --full | 1 | 2026-11-12T14:44:43.963Z | HASH_OK |
| UAP-EV-20261112150821-40668c73 | cli_command | uap build --full | 0 | 2026-11-12T15:08:21.189Z | HASH_OK |
| UAP-EV-20261112150835-012201e0 | health_probe | evidence-engine.health() | 0 | 2026-11-12T15:08:35.857Z | HASH_OK |
| UAP-EV-20261112150835-02fa9748 | task_step | step:validate_specification_registry | 0 | 2026-11-12T15:08:35.508Z | HASH_OK |
| UAP-EV-20261112150835-124c2ee3 | workflow_step | workflow:inspect_repository | 0 | 2026-11-12T15:08:35.394Z | HASH_OK |
| UAP-EV-20261112150835-23e51c69 | task_result | uap task run UAP-TASK-INTERRUPT-20261112150835-8ac8bd86 | 0 | 2026-11-12T15:08:35.837Z | HASH_OK |
| UAP-EV-20261112150835-34262fc3 | task_step | step:probe.step1 | 0 | 2026-11-12T15:08:35.761Z | HASH_OK |
| UAP-EV-20261112150835-44b61c74 | task_step | step:validate_environment | 0 | 2026-11-12T15:08:35.460Z | HASH_OK |
| UAP-EV-20261112150835-4a637615 | workflow_step | workflow:validate_specification_registry | 0 | 2026-11-12T15:08:35.508Z | HASH_OK |
| UAP-EV-20261112150835-638213ff | workflow_step | workflow:initialize_uap_structure | 0 | 2026-11-12T15:08:35.471Z | HASH_OK |
| UAP-EV-20261112150835-6a0effb6 | workflow_step | workflow:initialize_runtime | 0 | 2026-11-12T15:08:35.879Z | HASH_OK |
| UAP-EV-20261112150835-7c1571b2 | workflow_step | workflow:validate_environment | 0 | 2026-11-12T15:08:35.459Z | HASH_OK |
| UAP-EV-20261112150835-8feee923 | task_step | step:__health_step__ | 0 | 2026-11-12T15:08:35.557Z | HASH_OK |
| UAP-EV-20261112150835-aaada221 | task_step | step:initialize_uap_structure | 0 | 2026-11-12T15:08:35.472Z | HASH_OK |
| UAP-EV-20261112150835-b23cf8ad | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112150835-8ac8bd86 | 0 | 2026-11-12T15:08:35.853Z | HASH_OK |
| UAP-EV-20261112150835-b42a8265 | task_result | uap task run UAP-TASK-HEALTH-20261112150835-eaf3b578 | 0 | 2026-11-12T15:08:35.583Z | HASH_OK |
| UAP-EV-20261112150835-c0e54fec | task_step | step:initialize_runtime | 0 | 2026-11-12T15:08:35.879Z | HASH_OK |
| UAP-EV-20261112150835-c8fc1d5b | task_step | step:probe.step3 | 0 | 2026-11-12T15:08:35.810Z | HASH_OK |
| UAP-EV-20261112150835-d69bf393 | task_step | step:probe.step2 | 0 | 2026-11-12T15:08:35.801Z | HASH_OK |
| UAP-EV-20261112150835-e4ca3fa2 | task_step | step:inspect_repository | 0 | 2026-11-12T15:08:35.395Z | HASH_OK |
| UAP-EV-20261112150835-e62c0fcf | recovery | uap task resume UAP-TASK-INTERRUPT-20261112150835-8ac8bd86 | 0 | 2026-11-12T15:08:35.784Z | HASH_OK |
| UAP-EV-20261112150836-156d1a24 | task_result | uap task run UAP-TASK-INTERRUPT-20261112150836-c0fa85ad | 0 | 2026-11-12T15:08:36.489Z | HASH_OK |
| UAP-EV-20261112150836-1788a7fc | task_result | uap task run UAP-TASK-INTERRUPT-20261112150836-91943a35 | 0 | 2026-11-12T15:08:36.851Z | HASH_OK |
| UAP-EV-20261112150836-255252b8 | task_step | step:probe.step2 | 0 | 2026-11-12T15:08:36.815Z | HASH_OK |
| UAP-EV-20261112150836-316f33fc | task_result | uap task run UAP-TASK-TEST-20261112150836-e5f5a9e7 | 0 | 2026-11-12T15:08:36.920Z | HASH_OK |
| UAP-EV-20261112150836-3b156799 | task_step | step:probe.step2 | 0 | 2026-11-12T15:08:36.452Z | HASH_OK |
| UAP-EV-20261112150836-513e8302 | task_step | step:probe.step3 | 0 | 2026-11-12T15:08:36.461Z | HASH_OK |
| UAP-EV-20261112150836-637872ef | task_result | uap task run UAP-TASK-HEALTH-20261112150836-13014936 | 0 | 2026-11-12T15:08:36.233Z | HASH_OK |
| UAP-EV-20261112150836-64adfa2f | task_step | step:__uap_test_always_fail__ | 1 | 2026-11-12T15:08:36.957Z | HASH_OK |
| UAP-EV-20261112150836-80ab9417 | task_step | step:probe.step3 | 0 | 2026-11-12T15:08:36.825Z | HASH_OK |
| UAP-EV-20261112150836-8869a781 | task_step | step:probe.step1 | 0 | 2026-11-12T15:08:36.408Z | HASH_OK |
| UAP-EV-20261112150836-8aaf1327 | health_probe | evidence-engine.health() | 0 | 2026-11-12T15:08:36.512Z | HASH_OK |
| UAP-EV-20261112150836-929d7bf4 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112150836-91943a35 | 0 | 2026-11-12T15:08:36.868Z | HASH_OK |
| UAP-EV-20261112150836-ae3296a2 | task_step | step:__health_step__ | 0 | 2026-11-12T15:08:36.205Z | HASH_OK |
| UAP-EV-20261112150836-bc8f7fe8 | task_step | step:probe.step1 | 0 | 2026-11-12T15:08:36.775Z | HASH_OK |
| UAP-EV-20261112150836-cc0a9d43 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112150836-c0fa85ad | 0 | 2026-11-12T15:08:36.506Z | HASH_OK |
| UAP-EV-20261112150836-e1101544 | task_result | uap task run UAP-TASK-TEST-20261112150836-5278be91 | 1 | 2026-11-12T15:08:36.984Z | HASH_OK |
| UAP-EV-20261112150836-e4dea2d8 | task_step | step:__uap_test_retry_then_ok__ | 0 | 2026-11-12T15:08:36.893Z | HASH_OK |
| UAP-EV-20261112150836-ed988bd7 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112150836-c0fa85ad | 0 | 2026-11-12T15:08:36.433Z | HASH_OK |
| UAP-EV-20261112150836-ee956c96 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112150836-91943a35 | 0 | 2026-11-12T15:08:36.798Z | HASH_OK |
| UAP-EV-20261112150837-01f68a06 | task_result | uap task run UAP-TASK-20261112150835-24b97f9e | 0 | 2026-11-12T15:08:37.337Z | HASH_OK |
| UAP-EV-20261112150837-051df7b8 | workflow_step | workflow:scan_quality | 0 | 2026-11-12T15:08:37.578Z | HASH_OK |
| UAP-EV-20261112150837-0eaabe42 | workflow_step | workflow:scan_security | 0 | 2026-11-12T15:08:37.591Z | HASH_OK |
| UAP-EV-20261112150837-0fabb00f | workflow_step | workflow:scan_requirements | 0 | 2026-11-12T15:08:37.516Z | HASH_OK |
| UAP-EV-20261112150837-10229ca3 | workflow_step | workflow:test_idempotency | 0 | 2026-11-12T15:08:37.136Z | HASH_OK |
| UAP-EV-20261112150837-14d06c50 | task_step | step:scan_architecture | 0 | 2026-11-12T15:08:37.536Z | HASH_OK |
| UAP-EV-20261112150837-15c97f49 | task_step | step:test_concurrency | 0 | 2026-11-12T15:08:37.148Z | HASH_OK |
| UAP-EV-20261112150837-222d13d1 | task_step | step:verify_reconciliation | 0 | 2026-11-12T15:08:37.189Z | HASH_OK |
| UAP-EV-20261112150837-251c1e56 | task_step | step:run_runtime_tests | 0 | 2026-11-12T15:08:37.303Z | HASH_OK |
| UAP-EV-20261112150837-251d42b0 | task_step | step:scan_quality | 0 | 2026-11-12T15:08:37.579Z | HASH_OK |
| UAP-EV-20261112150837-26c01e89 | task_step | step:test_failure_recovery | 0 | 2026-11-12T15:08:37.174Z | HASH_OK |
| UAP-EV-20261112150837-2ca58a63 | workflow_step | workflow:run_runtime_tests | 0 | 2026-11-12T15:08:37.303Z | HASH_OK |
| UAP-EV-20261112150837-31229508 | task_step | step:scan_cross_platform | 0 | 2026-11-12T15:08:37.622Z | HASH_OK |
| UAP-EV-20261112150837-3c5e693f | task_step | step:create_execution_plan | 0 | 2026-11-12T15:08:37.753Z | HASH_OK |
| UAP-EV-20261112150837-3d22644a | workflow_step | workflow:inspect_refund_state_machine | 0 | 2026-11-12T15:08:37.111Z | HASH_OK |
| UAP-EV-20261112150837-43bd24f3 | task_result | uap task run UAP-TASK-HEALTH-20261112150837-870001d9 | 0 | 2026-11-12T15:08:37.853Z | HASH_OK |
| UAP-EV-20261112150837-45340643 | task_step | step:implement_missing_capabilities | 0 | 2026-11-12T15:08:37.765Z | HASH_OK |
| UAP-EV-20261112150837-4e4a8e17 | task_result | uap task run UAP-TASK-20261112150837-85e21800 | 0 | 2026-11-12T15:08:37.218Z | HASH_OK |
| UAP-EV-20261112150837-513b9fc8 | workflow_step | workflow:test_duplicate_notifications | 0 | 2026-11-12T15:08:37.160Z | HASH_OK |
| UAP-EV-20261112150837-514dbddd | task_step | step:test_duplicate_notifications | 0 | 2026-11-12T15:08:37.161Z | HASH_OK |
| UAP-EV-20261112150837-52326a53 | task_step | step:inspect_refund_state_machine | 0 | 2026-11-12T15:08:37.111Z | HASH_OK |
| UAP-EV-20261112150837-54962993 | task_step | step:scan_development | 0 | 2026-11-12T15:08:37.566Z | HASH_OK |
| UAP-EV-20261112150837-67126b60 | workflow_step | workflow:build_defect_registry | 0 | 2026-11-12T15:08:37.663Z | HASH_OK |
| UAP-EV-20261112150837-68b28e96 | workflow_step | workflow:inspect_payment_state_machine | 0 | 2026-11-12T15:08:37.094Z | HASH_OK |
| UAP-EV-20261112150837-6b38ecd7 | task_step | step:build_defect_registry | 0 | 2026-11-12T15:08:37.664Z | HASH_OK |
| UAP-EV-20261112150837-6db66d6f | task_step | step:inspect_balance_ledger | 0 | 2026-11-12T15:08:37.122Z | HASH_OK |
| UAP-EV-20261112150837-730e61c9 | task_step | step:inspect_payment_state_machine | 0 | 2026-11-12T15:08:37.094Z | HASH_OK |
| UAP-EV-20261112150837-766d8aed | workflow_step | workflow:scan_architecture | 0 | 2026-11-12T15:08:37.535Z | HASH_OK |
| UAP-EV-20261112150837-78515eab | task_step | step:scan_requirements | 0 | 2026-11-12T15:08:37.517Z | HASH_OK |
| UAP-EV-20261112150837-79f2dfe2 | workflow_step | workflow:test_concurrency | 0 | 2026-11-12T15:08:37.147Z | HASH_OK |
| UAP-EV-20261112150837-8167d9f9 | task_step | step:scan_delivery | 0 | 2026-11-12T15:08:37.636Z | HASH_OK |
| UAP-EV-20261112150837-890f7674 | task_step | step:__health_step__ | 0 | 2026-11-12T15:08:37.825Z | HASH_OK |
| UAP-EV-20261112150837-89c67a1b | task_step | step:resolve_dependencies | 0 | 2026-11-12T15:08:37.740Z | HASH_OK |
| UAP-EV-20261112150837-9107ee97 | workflow_step | workflow:scan_delivery | 0 | 2026-11-12T15:08:37.636Z | HASH_OK |
| UAP-EV-20261112150837-93b199a8 | task_step | step:scan_knowledge | 0 | 2026-11-12T15:08:37.651Z | HASH_OK |
| UAP-EV-20261112150837-b4c7958b | workflow_step | workflow:verify_reconciliation | 0 | 2026-11-12T15:08:37.188Z | HASH_OK |
| UAP-EV-20261112150837-c31fbf8a | workflow_step | workflow:scan_development | 0 | 2026-11-12T15:08:37.565Z | HASH_OK |
| UAP-EV-20261112150837-c827a933 | workflow_step | workflow:implement_missing_capabilities | 0 | 2026-11-12T15:08:37.765Z | HASH_OK |
| UAP-EV-20261112150837-c935a2e3 | task_step | step:scan_agents | 0 | 2026-11-12T15:08:37.551Z | HASH_OK |
| UAP-EV-20261112150837-cd705a4a | task_step | step:inspect_project | 0 | 2026-11-12T15:08:37.486Z | HASH_OK |
| UAP-EV-20261112150837-d2478ff5 | task_result | uap task run UAP-TASK-20261112150837-c6171bf0 | 0 | 2026-11-12T15:08:37.693Z | HASH_OK |
| UAP-EV-20261112150837-d3c0a91f | task_step | step:test_idempotency | 0 | 2026-11-12T15:08:37.136Z | HASH_OK |
| UAP-EV-20261112150837-da0964e6 | workflow_step | workflow:resolve_dependencies | 0 | 2026-11-12T15:08:37.740Z | HASH_OK |
| UAP-EV-20261112150837-db12748d | workflow_step | workflow:inspect_balance_ledger | 0 | 2026-11-12T15:08:37.122Z | HASH_OK |
| UAP-EV-20261112150837-dbfa8af1 | workflow_step | workflow:scan_cross_platform | 0 | 2026-11-12T15:08:37.621Z | HASH_OK |
| UAP-EV-20261112150837-df06233d | task_step | step:scan_security | 0 | 2026-11-12T15:08:37.591Z | HASH_OK |
| UAP-EV-20261112150837-e36cf341 | workflow_step | workflow:validate_environment | 0 | 2026-11-12T15:08:37.063Z | HASH_OK |
| UAP-EV-20261112150837-e3eb9033 | task_step | step:implement_missing_validators | 0 | 2026-11-12T15:08:37.779Z | HASH_OK |
| UAP-EV-20261112150837-e4e7d8db | workflow_step | workflow:test_failure_recovery | 0 | 2026-11-12T15:08:37.174Z | HASH_OK |
| UAP-EV-20261112150837-ef49be67 | workflow_step | workflow:inspect_project | 0 | 2026-11-12T15:08:37.486Z | HASH_OK |
| UAP-EV-20261112150837-f353f583 | workflow_step | workflow:create_execution_plan | 0 | 2026-11-12T15:08:37.752Z | HASH_OK |
| UAP-EV-20261112150837-f8fc2c36 | workflow_step | workflow:scan_knowledge | 0 | 2026-11-12T15:08:37.650Z | HASH_OK |
| UAP-EV-20261112150837-fb4862d5 | workflow_step | workflow:scan_agents | 0 | 2026-11-12T15:08:37.550Z | HASH_OK |
| UAP-EV-20261112150837-ff5b9455 | workflow_step | workflow:implement_missing_validators | 0 | 2026-11-12T15:08:37.778Z | HASH_OK |
| UAP-EV-20261112150838-0851d903 | task_step | step:execute_targeted_tests | 0 | 2026-11-12T15:08:38.257Z | HASH_OK |
| UAP-EV-20261112150838-10ccf586 | workflow_step | workflow:classify_defect | 0 | 2026-11-12T15:08:38.336Z | HASH_OK |
| UAP-EV-20261112150838-15b7448f | task_step | step:identify_root_cause | 0 | 2026-11-12T15:08:38.352Z | HASH_OK |
| UAP-EV-20261112150838-17d15401 | workflow_step | workflow:generate_repair_plan | 0 | 2026-11-12T15:08:38.377Z | HASH_OK |
| UAP-EV-20261112150838-19a0056d | task_step | step:independent_review | 0 | 2026-11-12T15:08:38.423Z | HASH_OK |
| UAP-EV-20261112150838-3e88effb | task_result | uap task run UAP-TASK-INTERRUPT-20261112150838-c8f0225d | 0 | 2026-11-12T15:08:38.205Z | HASH_OK |
| UAP-EV-20261112150838-3f6c3b42 | task_step | step:generate_repair_plan | 0 | 2026-11-12T15:08:38.378Z | HASH_OK |
| UAP-EV-20261112150838-404d95c7 | task_step | step:probe.step2 | 0 | 2026-11-12T15:08:38.165Z | HASH_OK |
| UAP-EV-20261112150838-43cfe9c7 | task_step | step:probe.step3 | 0 | 2026-11-12T15:08:38.176Z | HASH_OK |
| UAP-EV-20261112150838-57747182 | task_result | uap task run UAP-TASK-20261112150837-a0e504e8 | 0 | 2026-11-12T15:08:38.286Z | HASH_OK |
| UAP-EV-20261112150838-61e27565 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112150838-c8f0225d | 0 | 2026-11-12T15:08:38.226Z | HASH_OK |
| UAP-EV-20261112150838-63d5af36 | task_step | step:persist_evidence | 0 | 2026-11-12T15:08:38.438Z | HASH_OK |
| UAP-EV-20261112150838-6453e670 | task_step | step:probe.step1 | 0 | 2026-11-12T15:08:38.117Z | HASH_OK |
| UAP-EV-20261112150838-64af921c | workflow_step | workflow:identify_root_cause | 0 | 2026-11-12T15:08:38.351Z | HASH_OK |
| UAP-EV-20261112150838-65626084 | health_probe | evidence-engine.health() | 0 | 2026-11-12T15:08:38.228Z | HASH_OK |
| UAP-EV-20261112150838-68c375b4 | workflow_step | workflow:apply_authorized_repair | 0 | 2026-11-12T15:08:38.393Z | HASH_OK |
| UAP-EV-20261112150838-6a6ee3e6 | workflow_step | workflow:integrate_runtime | 0 | 2026-11-12T15:08:38.243Z | HASH_OK |
| UAP-EV-20261112150838-6fbf0931 | task_step | step:run_regression | 0 | 2026-11-12T15:08:38.406Z | HASH_OK |
| UAP-EV-20261112150838-76621ff6 | workflow_step | workflow:independent_review | 0 | 2026-11-12T15:08:38.422Z | HASH_OK |
| UAP-EV-20261112150838-892fc882 | workflow_step | workflow:persist_evidence | 0 | 2026-11-12T15:08:38.436Z | HASH_OK |
| UAP-EV-20261112150838-8b87c373 | task_step | step:calculate_impact | 0 | 2026-11-12T15:08:38.365Z | HASH_OK |
| UAP-EV-20261112150838-91a8f269 | task_step | step:apply_authorized_repair | 0 | 2026-11-12T15:08:38.393Z | HASH_OK |
| UAP-EV-20261112150838-93ed862e | task_step | step:classify_defect | 0 | 2026-11-12T15:08:38.337Z | HASH_OK |
| UAP-EV-20261112150838-9fbb6b71 | workflow_step | workflow:run_regression | 0 | 2026-11-12T15:08:38.405Z | HASH_OK |
| UAP-EV-20261112150838-a3332a1f | task_step | step:integrate_runtime | 0 | 2026-11-12T15:08:38.243Z | HASH_OK |
| UAP-EV-20261112150838-bcc8114b | task_result | uap task run UAP-TASK-20261112150838-90f31104 | 0 | 2026-11-12T15:08:38.470Z | HASH_OK |
| UAP-EV-20261112150838-c6e3d960 | workflow_step | workflow:calculate_impact | 0 | 2026-11-12T15:08:38.365Z | HASH_OK |
| UAP-EV-20261112150838-cf2f2e4b | workflow_step | workflow:execute_targeted_tests | 0 | 2026-11-12T15:08:38.257Z | HASH_OK |
| UAP-EV-20261112150838-e93c0172 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112150838-c8f0225d | 0 | 2026-11-12T15:08:38.144Z | HASH_OK |
| UAP-EV-20261112150843-020cdfe2 | workflow_step | workflow:lint | 0 | 2026-11-12T15:08:43.574Z | HASH_OK |
| UAP-EV-20261112150843-05cbd527 | task_step | step:test_idempotency | 0 | 2026-11-12T15:08:43.915Z | HASH_OK |
| UAP-EV-20261112150843-05d45cb4 | workflow_step | workflow:inspect_payment_state_machine | 0 | 2026-11-12T15:08:43.873Z | HASH_OK |
| UAP-EV-20261112150843-089dde13 | task_step | step:unit_tests | 0 | 2026-11-12T15:08:43.608Z | HASH_OK |
| UAP-EV-20261112150843-0b1041f6 | workflow_step | workflow:end_to_end_tests | 0 | 2026-11-12T15:08:43.638Z | HASH_OK |
| UAP-EV-20261112150843-0de73072 | task_step | step:end_to_end_tests | 0 | 2026-11-12T15:08:43.638Z | HASH_OK |
| UAP-EV-20261112150843-10a402ee | task_step | step:test_concurrency | 0 | 2026-11-12T15:08:43.929Z | HASH_OK |
| UAP-EV-20261112150843-26571e74 | task_step | step:verify_reconciliation | 0 | 2026-11-12T15:08:43.971Z | HASH_OK |
| UAP-EV-20261112150843-2e31f6f1 | workflow_step | workflow:inspect_balance_ledger | 0 | 2026-11-12T15:08:43.902Z | HASH_OK |
| UAP-EV-20261112150843-43416b76 | task_step | step:security_scan | 1 | 2026-11-12T15:08:43.785Z | HASH_OK |
| UAP-EV-20261112150843-466b7362 | task_step | step:inspect_refund_state_machine | 0 | 2026-11-12T15:08:43.888Z | HASH_OK |
| UAP-EV-20261112150843-4e8a5c26 | workflow_step | workflow:verify_reconciliation | 0 | 2026-11-12T15:08:43.971Z | HASH_OK |
| UAP-EV-20261112150843-53506f19 | workflow_step | workflow:inspect_refund_state_machine | 0 | 2026-11-12T15:08:43.887Z | HASH_OK |
| UAP-EV-20261112150843-69d302e3 | workflow_step | workflow:integration_tests | 0 | 2026-11-12T15:08:43.622Z | HASH_OK |
| UAP-EV-20261112150843-737188ef | workflow_step | workflow:unit_tests | 0 | 2026-11-12T15:08:43.608Z | HASH_OK |
| UAP-EV-20261112150843-7678a14c | task_step | step:integration_tests | 0 | 2026-11-12T15:08:43.622Z | HASH_OK |
| UAP-EV-20261112150843-7dffcb29 | task_step | step:inspect_balance_ledger | 0 | 2026-11-12T15:08:43.903Z | HASH_OK |
| UAP-EV-20261112150843-90c26f86 | workflow_step | workflow:test_idempotency | 0 | 2026-11-12T15:08:43.914Z | HASH_OK |
| UAP-EV-20261112150843-9c301c52 | workflow_step | workflow:security_scan | 1 | 2026-11-12T15:08:43.784Z | HASH_OK |
| UAP-EV-20261112150843-aa63c8bf | task_result | uap task run UAP-TASK-20261112150838-609e5147 | 1 | 2026-11-12T15:08:43.821Z | HASH_OK |
| UAP-EV-20261112150843-b3b9eea9 | task_step | step:test_duplicate_notifications | 0 | 2026-11-12T15:08:43.941Z | HASH_OK |
| UAP-EV-20261112150843-b5ccff82 | workflow_step | workflow:test_duplicate_notifications | 0 | 2026-11-12T15:08:43.941Z | HASH_OK |
| UAP-EV-20261112150843-b6237a35 | task_step | step:test_failure_recovery | 0 | 2026-11-12T15:08:43.957Z | HASH_OK |
| UAP-EV-20261112150843-c79cb464 | task_step | step:inspect_payment_state_machine | 0 | 2026-11-12T15:08:43.873Z | HASH_OK |
| UAP-EV-20261112150843-d48aaa90 | workflow_step | workflow:test_concurrency | 0 | 2026-11-12T15:08:43.928Z | HASH_OK |
| UAP-EV-20261112150843-d4b3621a | workflow_step | workflow:test_failure_recovery | 0 | 2026-11-12T15:08:43.957Z | HASH_OK |
| UAP-EV-20261112150843-d6c8fae3 | task_step | step:typecheck | 0 | 2026-11-12T15:08:43.591Z | HASH_OK |
| UAP-EV-20261112150843-e7500db0 | task_step | step:lint | 0 | 2026-11-12T15:08:43.575Z | HASH_OK |
| UAP-EV-20261112150843-fcda8b6e | workflow_step | workflow:typecheck | 0 | 2026-11-12T15:08:43.591Z | HASH_OK |
| UAP-EV-20261112150844-052bacc0 | workflow_step | workflow:run_end_to_end_workflows | 0 | 2026-11-12T15:08:44.149Z | HASH_OK |
| UAP-EV-20261112150844-06099c33 | task_step | step:validate_all_executors | 0 | 2026-11-12T15:08:44.078Z | HASH_OK |
| UAP-EV-20261112150844-0be24a33 | task_step | step:validate_all_validators | 0 | 2026-11-12T15:08:44.123Z | HASH_OK |
| UAP-EV-20261112150844-12bd84ed | task_result | uap task run UAP-TASK-20261112150844-1c18b28e | 0 | 2026-11-12T15:08:44.214Z | HASH_OK |
| UAP-EV-20261112150844-2f4115a7 | task_step | step:validate_all_agents | 0 | 2026-11-12T15:08:44.092Z | HASH_OK |
| UAP-EV-20261112150844-33ff9d10 | task_result | uap task run UAP-TASK-20261112150843-f5c0468f | 0 | 2026-11-12T15:08:44.005Z | HASH_OK |
| UAP-EV-20261112150844-365528ef | task_step | step:run_end_to_end_workflows | 0 | 2026-11-12T15:08:44.150Z | HASH_OK |
| UAP-EV-20261112150844-39a932b1 | cli_command | uap workflow run --all | 1 | 2026-11-12T15:08:44.235Z | HASH_OK |
| UAP-EV-20261112150844-4e3324d5 | task_step | step:generate_final_report | 0 | 2026-11-12T15:08:44.182Z | HASH_OK |
| UAP-EV-20261112150844-598227a6 | workflow_step | workflow:validate_all_specifications | 0 | 2026-11-12T15:08:44.063Z | HASH_OK |
| UAP-EV-20261112150844-6e39b34d | workflow_step | workflow:verify_recovery | 0 | 2026-11-12T15:08:44.163Z | HASH_OK |
| UAP-EV-20261112150844-720ba78b | workflow_step | workflow:run_full_quality_gate | 0 | 2026-11-12T15:08:44.135Z | HASH_OK |
| UAP-EV-20261112150844-77958b66 | task_step | step:validate_all_specifications | 0 | 2026-11-12T15:08:44.063Z | HASH_OK |
| UAP-EV-20261112150844-a3eace81 | task_step | step:verify_recovery | 0 | 2026-11-12T15:08:44.164Z | HASH_OK |
| UAP-EV-20261112150844-b077358b | workflow_step | workflow:validate_all_workflows | 0 | 2026-11-12T15:08:44.105Z | HASH_OK |
| UAP-EV-20261112150844-b1a53939 | workflow_step | workflow:validate_all_executors | 0 | 2026-11-12T15:08:44.078Z | HASH_OK |
| UAP-EV-20261112150844-ca792ac2 | task_step | step:run_full_quality_gate | 0 | 2026-11-12T15:08:44.136Z | HASH_OK |
| UAP-EV-20261112150844-d8682e53 | workflow_step | workflow:generate_final_report | 0 | 2026-11-12T15:08:44.179Z | HASH_OK |
| UAP-EV-20261112150844-f2eaabe6 | workflow_step | workflow:validate_all_validators | 0 | 2026-11-12T15:08:44.123Z | HASH_OK |
| UAP-EV-20261112150844-f5ed4b41 | workflow_step | workflow:validate_all_agents | 0 | 2026-11-12T15:08:44.091Z | HASH_OK |
| UAP-EV-20261112150844-f6a9c2bc | task_step | step:validate_all_workflows | 0 | 2026-11-12T15:08:44.106Z | HASH_OK |
| UAP-EV-20261112151159-0f514211 | cli_command | uap workflow run uap-implementation | 0 | 2026-11-12T15:11:59.593Z | HASH_OK |
| UAP-EV-20261112151159-188844a5 | workflow_step | workflow:implement_missing_capabilities | 0 | 2026-11-12T15:11:59.065Z | HASH_OK |
| UAP-EV-20261112151159-190cd64d | task_step | step:implement_missing_capabilities | 0 | 2026-11-12T15:11:59.065Z | HASH_OK |
| UAP-EV-20261112151159-1a0d94c8 | health_probe | evidence-engine.health() | 0 | 2026-11-12T15:11:59.503Z | HASH_OK |
| UAP-EV-20261112151159-1eb8fc49 | workflow_step | workflow:integrate_runtime | 0 | 2026-11-12T15:11:59.523Z | HASH_OK |
| UAP-EV-20261112151159-1fe765fd | task_step | step:implement_missing_validators | 0 | 2026-11-12T15:11:59.081Z | HASH_OK |
| UAP-EV-20261112151159-25c426ec | task_result | uap task run UAP-TASK-INTERRUPT-20261112151159-35fb744b | 0 | 2026-11-12T15:11:59.477Z | HASH_OK |
| UAP-EV-20261112151159-3f45afd0 | workflow_step | workflow:implement_missing_validators | 0 | 2026-11-12T15:11:59.080Z | HASH_OK |
| UAP-EV-20261112151159-51e6a431 | task_step | step:__health_step__ | 0 | 2026-11-12T15:11:59.143Z | HASH_OK |
| UAP-EV-20261112151159-553a0da1 | workflow_step | workflow:execute_targeted_tests | 0 | 2026-11-12T15:11:59.540Z | HASH_OK |
| UAP-EV-20261112151159-736f079f | task_step | step:probe.step1 | 0 | 2026-11-12T15:11:59.376Z | HASH_OK |
| UAP-EV-20261112151159-76157451 | workflow_step | workflow:create_execution_plan | 0 | 2026-11-12T15:11:59.049Z | HASH_OK |
| UAP-EV-20261112151159-79f4d283 | task_step | step:create_execution_plan | 0 | 2026-11-12T15:11:59.050Z | HASH_OK |
| UAP-EV-20261112151159-90e98893 | task_step | step:integrate_runtime | 0 | 2026-11-12T15:11:59.523Z | HASH_OK |
| UAP-EV-20261112151159-98f5ffba | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112151159-35fb744b | 0 | 2026-11-12T15:11:59.500Z | HASH_OK |
| UAP-EV-20261112151159-af448e8c | task_step | step:probe.step2 | 0 | 2026-11-12T15:11:59.429Z | HASH_OK |
| UAP-EV-20261112151159-b2557a55 | task_step | step:execute_targeted_tests | 0 | 2026-11-12T15:11:59.540Z | HASH_OK |
| UAP-EV-20261112151159-be200045 | task_result | uap task run UAP-TASK-HEALTH-20261112151159-0ab1d37e | 0 | 2026-11-12T15:11:59.178Z | HASH_OK |
| UAP-EV-20261112151159-c8eee481 | workflow_step | workflow:resolve_dependencies | 0 | 2026-11-12T15:11:59.031Z | HASH_OK |
| UAP-EV-20261112151159-c933f8fa | task_result | uap task run UAP-TASK-20261112151158-bddd9382 | 0 | 2026-11-12T15:11:59.574Z | HASH_OK |
| UAP-EV-20261112151159-cb668cd9 | task_step | step:probe.step3 | 0 | 2026-11-12T15:11:59.442Z | HASH_OK |
| UAP-EV-20261112151159-cc2c1fcc | recovery | uap task resume UAP-TASK-INTERRUPT-20261112151159-35fb744b | 0 | 2026-11-12T15:11:59.408Z | HASH_OK |
| UAP-EV-20261112151159-e5b9db8e | task_step | step:resolve_dependencies | 0 | 2026-11-12T15:11:59.032Z | HASH_OK |
| UAP-EV-20261112151422-2929010b | cli_command | uap task create --objective=regenerate coding standard artifact from real source --spec=UAP-04-001 --agent=uap-development-agent | 0 | 2026-11-12T15:14:22.568Z | HASH_OK |
| UAP-EV-20261112151430-018158dc | task_step | step:uap-development-agent | 0 | 2026-11-12T15:14:30.787Z | HASH_OK |
| UAP-EV-20261112151430-81fd45cb | cli_command | uap task run UAP-TASK-20261112151422-e03bbc2d | 0 | 2026-11-12T15:14:30.844Z | HASH_OK |
| UAP-EV-20261112151430-866ced5e | task_result | uap task run UAP-TASK-20261112151422-e03bbc2d | 0 | 2026-11-12T15:14:30.826Z | HASH_OK |
| UAP-EV-20261112151430-ebf08192 | agent_invocation | agent:uap-development-agent | 0 | 2026-11-12T15:14:30.786Z | HASH_OK |
| UAP-EV-20261112151448-200512f9 | validator_result | uap validate core.evidence_integrity | 0 | 2026-11-12T15:14:48.526Z | HASH_OK |
| UAP-EV-20261112151448-231ddb90 | validator_result | uap validate product.business_rule_integrity | 0 | 2026-11-12T15:14:48.622Z | HASH_OK |
| UAP-EV-20261112151448-3ad14872 | validator_result | uap validate agents.execution_integrity | 0 | 2026-11-12T15:14:48.917Z | HASH_OK |
| UAP-EV-20261112151448-3c93b6ad | validator_result | uap validate core.execution_integrity | 0 | 2026-11-12T15:14:48.412Z | HASH_OK |
| UAP-EV-20261112151448-3f48dcdb | validator_result | uap validate security.permission_boundary | 0 | 2026-11-12T15:14:48.449Z | HASH_OK |
| UAP-EV-20261112151448-43e67b07 | validator_result | uap validate architecture.consistency | 0 | 2026-11-12T15:14:48.638Z | HASH_OK |
| UAP-EV-20261112151448-4e58fbd3 | validator_result | uap validate core.architecture_integrity | 0 | 2026-11-12T15:14:48.274Z | HASH_OK |
| UAP-EV-20261112151448-51ba5207 | validator_result | uap validate agents.registry_integrity | 0 | 2026-11-12T15:14:48.681Z | HASH_OK |
| UAP-EV-20261112151448-6ebff903 | validator_result | uap validate architecture.adr_integrity | 0 | 2026-11-12T15:14:48.668Z | HASH_OK |
| UAP-EV-20261112151448-91358742 | validator_result | uap validate architecture.api_database_integrity | 0 | 2026-11-12T15:14:48.653Z | HASH_OK |
| UAP-EV-20261112151448-92994910 | validator_result | uap validate product.prototype_consistency | 0 | 2026-11-12T15:14:48.594Z | HASH_OK |
| UAP-EV-20261112151448-ce7c101c | validator_result | uap validate product.requirement_traceability | 0 | 2026-11-12T15:14:48.561Z | HASH_OK |
| UAP-EV-20261112151448-e563143c | validator_result | uap validate agents.collaboration_integrity | 0 | 2026-11-12T15:14:48.931Z | HASH_OK |
| UAP-EV-20261112151449-37316a7d | validator_result | uap validate agents.recovery_integrity | 0 | 2026-11-12T15:14:49.058Z | HASH_OK |
| UAP-EV-20261112151450-017417da | validator_result | uap validate quality.test_integrity | 0 | 2026-11-12T15:14:50.476Z | HASH_OK |
| UAP-EV-20261112151450-21ec22e2 | validator_result | uap validate quality.gate_integrity | 0 | 2026-11-12T15:14:50.753Z | HASH_OK |
| UAP-EV-20261112151450-80a42896 | validator_result | uap validate quality.engineering_integrity | 0 | 2026-11-12T15:14:50.464Z | HASH_OK |
| UAP-EV-20261112151450-8f2b796f | validator_result | uap validate development.coding_compliance | 0 | 2026-11-12T15:14:50.190Z | HASH_OK |
| UAP-EV-20261112151450-ac4e4d35 | validator_result | uap validate development.review_integrity | 0 | 2026-11-12T15:14:50.329Z | HASH_OK |
| UAP-EV-20261112151450-bf435fa1 | validator_result | uap validate quality.repair_integrity | 0 | 2026-11-12T15:14:50.610Z | HASH_OK |
| UAP-EV-20261112151450-f266d805 | validator_result | uap validate development.dependency_integrity | 0 | 2026-11-12T15:14:50.343Z | HASH_OK |
| UAP-EV-20261112151451-04a54c97 | cli_command | uap validate --all | 2 | 2026-11-12T15:14:51.995Z | HASH_OK |
| UAP-EV-20261112151451-15fc3f30 | validator_result | uap validate delivery.ci_integrity | 0 | 2026-11-12T15:14:51.579Z | HASH_OK |
| UAP-EV-20261112151451-27a9d1d8 | validator_result | uap validate cross_platform.web_integrity | 0 | 2026-11-12T15:14:51.374Z | HASH_OK |
| UAP-EV-20261112151451-33bfbb4e | validator_result | uap validate cross_platform.consistency_integrity | 0 | 2026-11-12T15:14:51.563Z | HASH_OK |
| UAP-EV-20261112151451-6da839cc | validator_result | uap validate evolution.evolution_integrity | 0 | 2026-11-12T15:14:51.986Z | HASH_OK |
| UAP-EV-20261112151451-8f5d16ef | validator_result | uap validate security.application_integrity | 0 | 2026-11-12T15:14:51.037Z | HASH_OK |
| UAP-EV-20261112151451-9d19fd0e | validator_result | uap validate delivery.observability_integrity | 0 | 2026-11-12T15:14:51.838Z | HASH_OK |
| UAP-EV-20261112151451-a04afa68 | validator_result | uap validate evolution.knowledge_integrity | 0 | 2026-11-12T15:14:51.871Z | HASH_OK |
| UAP-EV-20261112151451-b839845c | validator_result | uap validate security.reliability_integrity | 0 | 2026-11-12T15:14:51.193Z | HASH_OK |
| UAP-EV-20261112151451-be614921 | validator_result | uap validate delivery.deployment_integrity | 1 | 2026-11-12T15:14:51.592Z | HASH_OK |
| UAP-EV-20261112151451-fae58bca | validator_result | uap validate cross_platform.h5_integrity | 1 | 2026-11-12T15:14:51.508Z | HASH_OK |
| UAP-EV-20261112151451-fc73a749 | validator_result | uap validate security.financial_integrity_validator | 0 | 2026-11-12T15:14:51.050Z | HASH_OK |
| UAP-EV-20261112151502-00fa3046 | workflow_step | workflow:validate_specification_registry | 0 | 2026-11-12T15:15:02.206Z | HASH_OK |
| UAP-EV-20261112151502-04557461 | workflow_step | workflow:initialize_uap_structure | 0 | 2026-11-12T15:15:02.182Z | HASH_OK |
| UAP-EV-20261112151502-419f0687 | workflow_step | workflow:initialize_runtime | 0 | 2026-11-12T15:15:02.651Z | HASH_OK |
| UAP-EV-20261112151502-4877bfba | workflow_step | workflow:validate_environment | 0 | 2026-11-12T15:15:02.166Z | HASH_OK |
| UAP-EV-20261112151502-4f9c5d79 | task_step | step:inspect_repository | 0 | 2026-11-12T15:15:02.100Z | HASH_OK |
| UAP-EV-20261112151502-51af6d18 | task_step | step:validate_specification_registry | 0 | 2026-11-12T15:15:02.206Z | HASH_OK |
| UAP-EV-20261112151502-5ccf32c7 | task_step | step:probe.step1 | 0 | 2026-11-12T15:15:02.495Z | HASH_OK |
| UAP-EV-20261112151502-5d7c1c6b | task_step | step:__health_step__ | 0 | 2026-11-12T15:15:02.265Z | HASH_OK |
| UAP-EV-20261112151502-80ea07c5 | task_result | uap task run UAP-TASK-INTERRUPT-20261112151502-97295e5c | 0 | 2026-11-12T15:15:02.603Z | HASH_OK |
| UAP-EV-20261112151502-976d7679 | task_step | step:__health_step__ | 0 | 2026-11-12T15:15:02.985Z | HASH_OK |
| UAP-EV-20261112151502-a160ce97 | health_probe | evidence-engine.health() | 0 | 2026-11-12T15:15:02.630Z | HASH_OK |
| UAP-EV-20261112151502-a7ac8114 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112151502-97295e5c | 0 | 2026-11-12T15:15:02.625Z | HASH_OK |
| UAP-EV-20261112151502-c3c8f9fc | recovery | uap task resume UAP-TASK-INTERRUPT-20261112151502-97295e5c | 0 | 2026-11-12T15:15:02.528Z | HASH_OK |
| UAP-EV-20261112151502-def18cc3 | task_step | step:initialize_runtime | 0 | 2026-11-12T15:15:02.651Z | HASH_OK |
| UAP-EV-20261112151502-eeea57c9 | task_step | step:probe.step3 | 0 | 2026-11-12T15:15:02.565Z | HASH_OK |
| UAP-EV-20261112151502-f27bbd67 | task_result | uap task run UAP-TASK-HEALTH-20261112151502-81126975 | 0 | 2026-11-12T15:15:02.304Z | HASH_OK |
| UAP-EV-20261112151502-f7aa5f22 | task_step | step:validate_environment | 0 | 2026-11-12T15:15:02.167Z | HASH_OK |
| UAP-EV-20261112151502-f7c82224 | task_step | step:probe.step2 | 0 | 2026-11-12T15:15:02.554Z | HASH_OK |
| UAP-EV-20261112151502-f963ebf6 | task_step | step:initialize_uap_structure | 0 | 2026-11-12T15:15:02.182Z | HASH_OK |
| UAP-EV-20261112151502-fc71910d | workflow_step | workflow:inspect_repository | 0 | 2026-11-12T15:15:02.099Z | HASH_OK |
| UAP-EV-20261112151503-0431c87c | health_probe | evidence-engine.health() | 0 | 2026-11-12T15:15:03.374Z | HASH_OK |
| UAP-EV-20261112151503-091bb860 | task_result | uap task run UAP-TASK-TEST-20261112151503-2b40684f | 1 | 2026-11-12T15:15:03.943Z | HASH_OK |
| UAP-EV-20261112151503-110d100c | recovery | uap task resume UAP-TASK-INTERRUPT-20261112151503-e94ab0dc | 0 | 2026-11-12T15:15:03.676Z | HASH_OK |
| UAP-EV-20261112151503-12f7eca6 | task_step | step:__uap_test_retry_then_ok__ | 0 | 2026-11-12T15:15:03.815Z | HASH_OK |
| UAP-EV-20261112151503-1b19d2ca | task_result | uap task run UAP-TASK-TEST-20261112151503-790cb343 | 0 | 2026-11-12T15:15:03.852Z | HASH_OK |
| UAP-EV-20261112151503-1c99deaf | task_step | step:probe.step1 | 0 | 2026-11-12T15:15:03.231Z | HASH_OK |
| UAP-EV-20261112151503-26bf183a | task_step | step:probe.step1 | 0 | 2026-11-12T15:15:03.641Z | HASH_OK |
| UAP-EV-20261112151503-31041d48 | task_result | uap task run UAP-TASK-INTERRUPT-20261112151503-e94ab0dc | 0 | 2026-11-12T15:15:03.754Z | HASH_OK |
| UAP-EV-20261112151503-4dfa71f6 | task_step | step:__uap_test_always_fail__ | 1 | 2026-11-12T15:15:03.903Z | HASH_OK |
| UAP-EV-20261112151503-582a8adf | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112151503-8774de7c | 0 | 2026-11-12T15:15:03.368Z | HASH_OK |
| UAP-EV-20261112151503-6cc0fea9 | task_step | step:probe.step2 | 0 | 2026-11-12T15:15:03.700Z | HASH_OK |
| UAP-EV-20261112151503-77b25167 | task_step | step:probe.step3 | 0 | 2026-11-12T15:15:03.716Z | HASH_OK |
| UAP-EV-20261112151503-95ca1c46 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112151503-e94ab0dc | 0 | 2026-11-12T15:15:03.779Z | HASH_OK |
| UAP-EV-20261112151503-99202f60 | task_step | step:probe.step3 | 0 | 2026-11-12T15:15:03.307Z | HASH_OK |
| UAP-EV-20261112151503-c278a35f | task_result | uap task run UAP-TASK-INTERRUPT-20261112151503-8774de7c | 0 | 2026-11-12T15:15:03.345Z | HASH_OK |
| UAP-EV-20261112151503-e1c355d9 | task_result | uap task run UAP-TASK-HEALTH-20261112151502-f3cce8db | 0 | 2026-11-12T15:15:03.027Z | HASH_OK |
| UAP-EV-20261112151503-e9ea8e72 | task_step | step:probe.step2 | 0 | 2026-11-12T15:15:03.294Z | HASH_OK |
| UAP-EV-20261112151503-ef8c8399 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112151503-8774de7c | 0 | 2026-11-12T15:15:03.265Z | HASH_OK |
| UAP-EV-20261112151504-05a0c876 | task_step | step:implement_missing_capabilities | 0 | 2026-11-12T15:15:04.996Z | HASH_OK |
| UAP-EV-20261112151504-07323ead | workflow_step | workflow:scan_quality | 0 | 2026-11-12T15:15:04.749Z | HASH_OK |
| UAP-EV-20261112151504-0a7da18a | workflow_step | workflow:scan_agents | 0 | 2026-11-12T15:15:04.711Z | HASH_OK |
| UAP-EV-20261112151504-0c427711 | workflow_step | workflow:scan_cross_platform | 0 | 2026-11-12T15:15:04.799Z | HASH_OK |
| UAP-EV-20261112151504-1581b873 | task_step | step:scan_knowledge | 0 | 2026-11-12T15:15:04.832Z | HASH_OK |
| UAP-EV-20261112151504-1ce5a04c | workflow_step | workflow:inspect_payment_state_machine | 0 | 2026-11-12T15:15:04.140Z | HASH_OK |
| UAP-EV-20261112151504-1fe97494 | workflow_step | workflow:scan_delivery | 0 | 2026-11-12T15:15:04.815Z | HASH_OK |
| UAP-EV-20261112151504-29a734f0 | task_step | step:scan_security | 0 | 2026-11-12T15:15:04.764Z | HASH_OK |
| UAP-EV-20261112151504-2af2d088 | task_result | uap task run UAP-TASK-20261112151504-e08d314a | 0 | 2026-11-12T15:15:04.891Z | HASH_OK |
| UAP-EV-20261112151504-2bbd1b45 | workflow_step | workflow:scan_knowledge | 0 | 2026-11-12T15:15:04.831Z | HASH_OK |
| UAP-EV-20261112151504-2d069540 | workflow_step | workflow:test_duplicate_notifications | 0 | 2026-11-12T15:15:04.250Z | HASH_OK |
| UAP-EV-20261112151504-41204b78 | task_step | step:test_idempotency | 0 | 2026-11-12T15:15:04.217Z | HASH_OK |
| UAP-EV-20261112151504-4674ed61 | workflow_step | workflow:scan_architecture | 0 | 2026-11-12T15:15:04.692Z | HASH_OK |
| UAP-EV-20261112151504-52185869 | workflow_step | workflow:inspect_balance_ledger | 0 | 2026-11-12T15:15:04.197Z | HASH_OK |
| UAP-EV-20261112151504-53421228 | workflow_step | workflow:implement_missing_capabilities | 0 | 2026-11-12T15:15:04.995Z | HASH_OK |
| UAP-EV-20261112151504-55949aa7 | workflow_step | workflow:resolve_dependencies | 0 | 2026-11-12T15:15:04.957Z | HASH_OK |
| UAP-EV-20261112151504-55d25660 | workflow_step | workflow:inspect_refund_state_machine | 0 | 2026-11-12T15:15:04.174Z | HASH_OK |
| UAP-EV-20261112151504-6177c08d | workflow_step | workflow:create_execution_plan | 0 | 2026-11-12T15:15:04.975Z | HASH_OK |
| UAP-EV-20261112151504-63a42609 | task_step | step:build_defect_registry | 0 | 2026-11-12T15:15:04.850Z | HASH_OK |
| UAP-EV-20261112151504-64f74ff0 | task_step | step:create_execution_plan | 0 | 2026-11-12T15:15:04.975Z | HASH_OK |
| UAP-EV-20261112151504-6afa2c1c | workflow_step | workflow:test_concurrency | 0 | 2026-11-12T15:15:04.235Z | HASH_OK |
| UAP-EV-20261112151504-6eccb764 | workflow_step | workflow:test_failure_recovery | 0 | 2026-11-12T15:15:04.268Z | HASH_OK |
| UAP-EV-20261112151504-726c0cb0 | task_step | step:scan_agents | 0 | 2026-11-12T15:15:04.711Z | HASH_OK |
| UAP-EV-20261112151504-757dfc89 | workflow_step | workflow:run_runtime_tests | 0 | 2026-11-12T15:15:04.421Z | HASH_OK |
| UAP-EV-20261112151504-7a223cc2 | task_step | step:scan_development | 0 | 2026-11-12T15:15:04.732Z | HASH_OK |
| UAP-EV-20261112151504-81012b69 | task_step | step:verify_reconciliation | 0 | 2026-11-12T15:15:04.283Z | HASH_OK |
| UAP-EV-20261112151504-84818e9c | workflow_step | workflow:scan_requirements | 0 | 2026-11-12T15:15:04.667Z | HASH_OK |
| UAP-EV-20261112151504-88f0aea9 | workflow_step | workflow:scan_development | 0 | 2026-11-12T15:15:04.731Z | HASH_OK |
| UAP-EV-20261112151504-8a269a2b | task_step | step:test_duplicate_notifications | 0 | 2026-11-12T15:15:04.251Z | HASH_OK |
| UAP-EV-20261112151504-8d90d16e | task_step | step:scan_quality | 0 | 2026-11-12T15:15:04.749Z | HASH_OK |
| UAP-EV-20261112151504-917bc73c | task_step | step:inspect_balance_ledger | 0 | 2026-11-12T15:15:04.198Z | HASH_OK |
| UAP-EV-20261112151504-91eb0be8 | workflow_step | workflow:test_idempotency | 0 | 2026-11-12T15:15:04.214Z | HASH_OK |
| UAP-EV-20261112151504-9b5dca7c | task_step | step:scan_requirements | 0 | 2026-11-12T15:15:04.668Z | HASH_OK |
| UAP-EV-20261112151504-9df9494f | task_result | uap task run UAP-TASK-20261112151501-65f1905a | 0 | 2026-11-12T15:15:04.462Z | HASH_OK |
| UAP-EV-20261112151504-ad13b10e | task_step | step:run_runtime_tests | 0 | 2026-11-12T15:15:04.421Z | HASH_OK |
| UAP-EV-20261112151504-ade118f9 | task_step | step:test_concurrency | 0 | 2026-11-12T15:15:04.235Z | HASH_OK |
| UAP-EV-20261112151504-b0b516a4 | workflow_step | workflow:inspect_project | 0 | 2026-11-12T15:15:04.631Z | HASH_OK |
| UAP-EV-20261112151504-bd6c284d | task_step | step:inspect_refund_state_machine | 0 | 2026-11-12T15:15:04.175Z | HASH_OK |
| UAP-EV-20261112151504-c0713204 | workflow_step | workflow:validate_environment | 0 | 2026-11-12T15:15:04.029Z | HASH_OK |
| UAP-EV-20261112151504-c3321acf | task_step | step:scan_architecture | 0 | 2026-11-12T15:15:04.693Z | HASH_OK |
| UAP-EV-20261112151504-cd24eea7 | task_step | step:inspect_payment_state_machine | 0 | 2026-11-12T15:15:04.141Z | HASH_OK |
| UAP-EV-20261112151504-cd2679ff | task_step | step:test_failure_recovery | 0 | 2026-11-12T15:15:04.269Z | HASH_OK |
| UAP-EV-20261112151504-d275a3ef | task_step | step:scan_delivery | 0 | 2026-11-12T15:15:04.816Z | HASH_OK |
| UAP-EV-20261112151504-d3072623 | workflow_step | workflow:scan_security | 0 | 2026-11-12T15:15:04.764Z | HASH_OK |
| UAP-EV-20261112151504-d7053d9d | task_step | step:scan_cross_platform | 0 | 2026-11-12T15:15:04.799Z | HASH_OK |
| UAP-EV-20261112151504-d94c4b69 | workflow_step | workflow:verify_reconciliation | 0 | 2026-11-12T15:15:04.283Z | HASH_OK |
| UAP-EV-20261112151504-da7cffbc | task_result | uap task run UAP-TASK-20261112151504-503ea730 | 0 | 2026-11-12T15:15:04.326Z | HASH_OK |
| UAP-EV-20261112151504-df3bfcad | workflow_step | workflow:build_defect_registry | 0 | 2026-11-12T15:15:04.849Z | HASH_OK |
| UAP-EV-20261112151504-e14dc025 | task_step | step:inspect_project | 0 | 2026-11-12T15:15:04.632Z | HASH_OK |
| UAP-EV-20261112151504-f9f0601a | task_step | step:resolve_dependencies | 0 | 2026-11-12T15:15:04.958Z | HASH_OK |
| UAP-EV-20261112151505-026046ba | workflow_step | workflow:classify_defect | 0 | 2026-11-12T15:15:05.602Z | HASH_OK |
| UAP-EV-20261112151505-07f8e2de | workflow_step | workflow:independent_review | 0 | 2026-11-12T15:15:05.705Z | HASH_OK |
| UAP-EV-20261112151505-0da67511 | task_step | step:apply_authorized_repair | 0 | 2026-11-12T15:15:05.673Z | HASH_OK |
| UAP-EV-20261112151505-0f35204d | task_step | step:execute_targeted_tests | 0 | 2026-11-12T15:15:05.497Z | HASH_OK |
| UAP-EV-20261112151505-175b1d35 | workflow_step | workflow:integrate_runtime | 0 | 2026-11-12T15:15:05.481Z | HASH_OK |
| UAP-EV-20261112151505-23254626 | workflow_step | workflow:calculate_impact | 0 | 2026-11-12T15:15:05.637Z | HASH_OK |
| UAP-EV-20261112151505-2beeec16 | task_step | step:__health_step__ | 0 | 2026-11-12T15:15:05.070Z | HASH_OK |
| UAP-EV-20261112151505-32a668d8 | task_step | step:integrate_runtime | 0 | 2026-11-12T15:15:05.481Z | HASH_OK |
| UAP-EV-20261112151505-37cd8528 | workflow_step | workflow:apply_authorized_repair | 0 | 2026-11-12T15:15:05.672Z | HASH_OK |
| UAP-EV-20261112151505-3a3804a1 | task_step | step:identify_root_cause | 0 | 2026-11-12T15:15:05.620Z | HASH_OK |
| UAP-EV-20261112151505-43fb43dc | task_step | step:probe.step1 | 0 | 2026-11-12T15:15:05.314Z | HASH_OK |
| UAP-EV-20261112151505-4fde22b8 | task_step | step:generate_repair_plan | 0 | 2026-11-12T15:15:05.653Z | HASH_OK |
| UAP-EV-20261112151505-5377c12f | task_step | step:implement_missing_validators | 0 | 2026-11-12T15:15:05.011Z | HASH_OK |
| UAP-EV-20261112151505-7605836b | task_result | uap task run UAP-TASK-INTERRUPT-20261112151505-76939110 | 0 | 2026-11-12T15:15:05.434Z | HASH_OK |
| UAP-EV-20261112151505-78e325ba | workflow_step | workflow:identify_root_cause | 0 | 2026-11-12T15:15:05.620Z | HASH_OK |
| UAP-EV-20261112151505-7c4b44ca | task_step | step:run_regression | 0 | 2026-11-12T15:15:05.691Z | HASH_OK |
| UAP-EV-20261112151505-8189dd52 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112151505-76939110 | 0 | 2026-11-12T15:15:05.458Z | HASH_OK |
| UAP-EV-20261112151505-82e4da2d | workflow_step | workflow:run_regression | 0 | 2026-11-12T15:15:05.690Z | HASH_OK |
| UAP-EV-20261112151505-861f5f99 | task_step | step:persist_evidence | 0 | 2026-11-12T15:15:05.731Z | HASH_OK |
| UAP-EV-20261112151505-99909ea1 | task_step | step:independent_review | 0 | 2026-11-12T15:15:05.706Z | HASH_OK |
| UAP-EV-20261112151505-9a1864e7 | workflow_step | workflow:implement_missing_validators | 0 | 2026-11-12T15:15:05.011Z | HASH_OK |
| UAP-EV-20261112151505-9fc689c7 | task_result | uap task run UAP-TASK-HEALTH-20261112151505-ee0fde99 | 0 | 2026-11-12T15:15:05.110Z | HASH_OK |
| UAP-EV-20261112151505-a0a28135 | task_step | step:probe.step2 | 0 | 2026-11-12T15:15:05.374Z | HASH_OK |
| UAP-EV-20261112151505-a31b7847 | workflow_step | workflow:execute_targeted_tests | 0 | 2026-11-12T15:15:05.496Z | HASH_OK |
| UAP-EV-20261112151505-ac9e9490 | task_step | step:classify_defect | 0 | 2026-11-12T15:15:05.602Z | HASH_OK |
| UAP-EV-20261112151505-c498ee86 | task_step | step:probe.step3 | 0 | 2026-11-12T15:15:05.391Z | HASH_OK |
| UAP-EV-20261112151505-ca774d0d | workflow_step | workflow:persist_evidence | 0 | 2026-11-12T15:15:05.728Z | HASH_OK |
| UAP-EV-20261112151505-ced2004d | task_step | step:calculate_impact | 0 | 2026-11-12T15:15:05.638Z | HASH_OK |
| UAP-EV-20261112151505-d326277e | workflow_step | workflow:generate_repair_plan | 0 | 2026-11-12T15:15:05.652Z | HASH_OK |
| UAP-EV-20261112151505-dfb9e52a | health_probe | evidence-engine.health() | 0 | 2026-11-12T15:15:05.461Z | HASH_OK |
| UAP-EV-20261112151505-eec575fb | task_result | uap task run UAP-TASK-20261112151505-80d6e859 | 0 | 2026-11-12T15:15:05.772Z | HASH_OK |
| UAP-EV-20261112151505-f6f9887e | recovery | uap task resume UAP-TASK-INTERRUPT-20261112151505-76939110 | 0 | 2026-11-12T15:15:05.349Z | HASH_OK |
| UAP-EV-20261112151505-fc24f344 | task_result | uap task run UAP-TASK-20261112151504-7f56aae3 | 0 | 2026-11-12T15:15:05.540Z | HASH_OK |
| UAP-EV-20261112151510-4054c347 | task_step | step:integration_tests | 0 | 2026-11-12T15:15:10.952Z | HASH_OK |
| UAP-EV-20261112151510-4ec239dd | task_step | step:unit_tests | 0 | 2026-11-12T15:15:10.933Z | HASH_OK |
| UAP-EV-20261112151510-69f12bc2 | task_step | step:end_to_end_tests | 0 | 2026-11-12T15:15:10.973Z | HASH_OK |
| UAP-EV-20261112151510-7e09b545 | workflow_step | workflow:end_to_end_tests | 0 | 2026-11-12T15:15:10.972Z | HASH_OK |
| UAP-EV-20261112151510-a057f5a8 | workflow_step | workflow:typecheck | 0 | 2026-11-12T15:15:10.909Z | HASH_OK |
| UAP-EV-20261112151510-a519fb96 | task_step | step:typecheck | 0 | 2026-11-12T15:15:10.910Z | HASH_OK |
| UAP-EV-20261112151510-be47868c | workflow_step | workflow:lint | 0 | 2026-11-12T15:15:10.891Z | HASH_OK |
| UAP-EV-20261112151510-e00da521 | workflow_step | workflow:unit_tests | 0 | 2026-11-12T15:15:10.932Z | HASH_OK |
| UAP-EV-20261112151510-e3dd34eb | task_step | step:lint | 0 | 2026-11-12T15:15:10.891Z | HASH_OK |
| UAP-EV-20261112151510-fd894420 | workflow_step | workflow:integration_tests | 0 | 2026-11-12T15:15:10.952Z | HASH_OK |
| UAP-EV-20261112151511-55c695e2 | workflow_step | workflow:security_scan | 0 | 2026-11-12T15:15:11.066Z | HASH_OK |
| UAP-EV-20261112151511-6639cb81 | workflow_step | workflow:dependency_scan | 0 | 2026-11-12T15:15:11.154Z | HASH_OK |
| UAP-EV-20261112151511-716edb8f | task_step | step:dependency_scan | 0 | 2026-11-12T15:15:11.154Z | HASH_OK |
| UAP-EV-20261112151511-d5a81a22 | task_step | step:security_scan | 0 | 2026-11-12T15:15:11.066Z | HASH_OK |
| UAP-EV-20261112151516-0363c3ec | workflow_step | workflow:verify_recovery | 0 | 2026-11-12T15:15:16.820Z | HASH_OK |
| UAP-EV-20261112151516-05f91a42 | workflow_step | workflow:run_end_to_end_workflows | 0 | 2026-11-12T15:15:16.802Z | HASH_OK |
| UAP-EV-20261112151516-0af69cb5 | workflow_step | workflow:code_review | 0 | 2026-11-12T15:15:16.319Z | HASH_OK |
| UAP-EV-20261112151516-0b509ec0 | task_step | step:validate_all_agents | 0 | 2026-11-12T15:15:16.731Z | HASH_OK |
| UAP-EV-20261112151516-1bb6245b | cli_command | uap workflow run --all | 0 | 2026-11-12T15:15:16.913Z | HASH_OK |
| UAP-EV-20261112151516-25038ec8 | task_step | step:test_idempotency | 0 | 2026-11-12T15:15:16.500Z | HASH_OK |
| UAP-EV-20261112151516-292a0d6a | task_step | step:test_duplicate_notifications | 0 | 2026-11-12T15:15:16.536Z | HASH_OK |
| UAP-EV-20261112151516-3309e529 | workflow_step | workflow:validate_all_workflows | 0 | 2026-11-12T15:15:16.747Z | HASH_OK |
| UAP-EV-20261112151516-334861ed | task_step | step:code_review | 0 | 2026-11-12T15:15:16.320Z | HASH_OK |
| UAP-EV-20261112151516-45b1d953 | task_step | step:validate_all_validators | 0 | 2026-11-12T15:15:16.767Z | HASH_OK |
| UAP-EV-20261112151516-5c1c5096 | task_step | step:inspect_refund_state_machine | 0 | 2026-11-12T15:15:16.462Z | HASH_OK |
| UAP-EV-20261112151516-6349ec03 | task_step | step:inspect_payment_state_machine | 0 | 2026-11-12T15:15:16.445Z | HASH_OK |
| UAP-EV-20261112151516-6c729003 | task_step | step:verify_recovery | 0 | 2026-11-12T15:15:16.821Z | HASH_OK |
| UAP-EV-20261112151516-6e3f0001 | workflow_step | workflow:build | 0 | 2026-11-12T15:15:16.301Z | HASH_OK |
| UAP-EV-20261112151516-7531f0fa | workflow_step | workflow:test_idempotency | 0 | 2026-11-12T15:15:16.500Z | HASH_OK |
| UAP-EV-20261112151516-7d73bcab | task_step | step:verify_reconciliation | 0 | 2026-11-12T15:15:16.571Z | HASH_OK |
| UAP-EV-20261112151516-85258c9c | task_step | step:validate_all_executors | 0 | 2026-11-12T15:15:16.711Z | HASH_OK |
| UAP-EV-20261112151516-86c7b376 | workflow_step | workflow:inspect_refund_state_machine | 0 | 2026-11-12T15:15:16.462Z | HASH_OK |
| UAP-EV-20261112151516-8b8089a5 | task_result | uap task run UAP-TASK-20261112151516-b136c077 | 0 | 2026-11-12T15:15:16.616Z | HASH_OK |
| UAP-EV-20261112151516-91bedf1c | workflow_step | workflow:generate_final_report | 0 | 2026-11-12T15:15:16.839Z | HASH_OK |
| UAP-EV-20261112151516-9518d68f | task_step | step:test_failure_recovery | 0 | 2026-11-12T15:15:16.554Z | HASH_OK |
| UAP-EV-20261112151516-9635d2bb | workflow_step | workflow:validate_all_specifications | 0 | 2026-11-12T15:15:16.692Z | HASH_OK |
| UAP-EV-20261112151516-97a4dceb | workflow_step | workflow:test_duplicate_notifications | 0 | 2026-11-12T15:15:16.536Z | HASH_OK |
| UAP-EV-20261112151516-a6bca650 | workflow_step | workflow:inspect_payment_state_machine | 0 | 2026-11-12T15:15:16.445Z | HASH_OK |
| UAP-EV-20261112151516-aaa7a8df | workflow_step | workflow:run_full_quality_gate | 0 | 2026-11-12T15:15:16.785Z | HASH_OK |
| UAP-EV-20261112151516-ab7d90fb | workflow_step | workflow:validate_all_executors | 0 | 2026-11-12T15:15:16.711Z | HASH_OK |
| UAP-EV-20261112151516-b6c9b624 | workflow_step | workflow:validate_all_agents | 0 | 2026-11-12T15:15:16.731Z | HASH_OK |
| UAP-EV-20261112151516-ba85d49e | task_step | step:test_concurrency | 0 | 2026-11-12T15:15:16.517Z | HASH_OK |
| UAP-EV-20261112151516-cdada8db | task_step | step:generate_final_report | 0 | 2026-11-12T15:15:16.842Z | HASH_OK |
| UAP-EV-20261112151516-d0353272 | task_step | step:validate_all_specifications | 0 | 2026-11-12T15:15:16.693Z | HASH_OK |
| UAP-EV-20261112151516-d2e77fff | task_result | uap task run UAP-TASK-20261112151516-3922d161 | 0 | 2026-11-12T15:15:16.886Z | HASH_OK |
| UAP-EV-20261112151516-d30479d2 | workflow_step | workflow:test_concurrency | 0 | 2026-11-12T15:15:16.516Z | HASH_OK |
| UAP-EV-20261112151516-d3d61c40 | workflow_step | workflow:verify_reconciliation | 0 | 2026-11-12T15:15:16.571Z | HASH_OK |
| UAP-EV-20261112151516-dacd36bc | task_step | step:inspect_balance_ledger | 0 | 2026-11-12T15:15:16.482Z | HASH_OK |
| UAP-EV-20261112151516-dc4f3b2b | task_step | step:validate_all_workflows | 0 | 2026-11-12T15:15:16.747Z | HASH_OK |
| UAP-EV-20261112151516-dec78a2f | workflow_step | workflow:test_failure_recovery | 0 | 2026-11-12T15:15:16.553Z | HASH_OK |
| UAP-EV-20261112151516-e30fbc6d | task_step | step:run_full_quality_gate | 0 | 2026-11-12T15:15:16.786Z | HASH_OK |
| UAP-EV-20261112151516-e782d5c0 | task_result | uap task run UAP-TASK-20261112151505-5fda0eab | 0 | 2026-11-12T15:15:16.373Z | HASH_OK |
| UAP-EV-20261112151516-eff2c77c | workflow_step | workflow:inspect_balance_ledger | 0 | 2026-11-12T15:15:16.481Z | HASH_OK |
| UAP-EV-20261112151516-f4317c7b | workflow_step | workflow:validate_all_validators | 0 | 2026-11-12T15:15:16.766Z | HASH_OK |
| UAP-EV-20261112151516-f860163d | task_step | step:build | 0 | 2026-11-12T15:15:16.301Z | HASH_OK |
| UAP-EV-20261112151516-ffce4a23 | task_step | step:run_end_to_end_workflows | 0 | 2026-11-12T15:15:16.802Z | HASH_OK |
| UAP-EV-20261112151528-0151e655 | task_result | uap task run UAP-TASK-INTERRUPT-20261112151528-b2f19352 | 0 | 2026-11-12T15:15:28.580Z | HASH_OK |
| UAP-EV-20261112151528-3a7d9279 | task_step | step:probe.step1 | 0 | 2026-11-12T15:15:28.446Z | HASH_OK |
| UAP-EV-20261112151528-5dae1f13 | task_result | uap task run UAP-TASK-HEALTH-20261112151528-7e27f882 | 0 | 2026-11-12T15:15:28.234Z | HASH_OK |
| UAP-EV-20261112151528-605baea7 | task_step | step:probe.step3 | 0 | 2026-11-12T15:15:28.533Z | HASH_OK |
| UAP-EV-20261112151528-6473019e | recovery | uap task resume UAP-TASK-INTERRUPT-20261112151528-b2f19352 | 0 | 2026-11-12T15:15:28.485Z | HASH_OK |
| UAP-EV-20261112151528-7ee25ab9 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112151528-b2f19352 | 0 | 2026-11-12T15:15:28.610Z | HASH_OK |
| UAP-EV-20261112151528-812d3cff | task_step | step:probe.step3 | 0 | 2026-11-12T15:15:28.883Z | HASH_OK |
| UAP-EV-20261112151528-83221903 | task_step | step:__health_step__ | 0 | 2026-11-12T15:15:28.185Z | HASH_OK |
| UAP-EV-20261112151528-885c18ce | task_step | step:probe.step2 | 0 | 2026-11-12T15:15:28.516Z | HASH_OK |
| UAP-EV-20261112151528-984546a7 | health_probe | evidence-engine.health() | 0 | 2026-11-12T15:15:28.613Z | HASH_OK |
| UAP-EV-20261112151528-af5d840a | recovery | uap task resume UAP-TASK-INTERRUPT-20261112151528-29bec1a6 | 0 | 2026-11-12T15:15:28.834Z | HASH_OK |
| UAP-EV-20261112151528-c2a67219 | task_step | step:probe.step1 | 0 | 2026-11-12T15:15:28.796Z | HASH_OK |
| UAP-EV-20261112151528-cb6c1c8f | runtime_start | uap doctor | 0 | 2026-11-12T15:15:28.634Z | HASH_OK |
| UAP-EV-20261112151528-ccb8c834 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112151528-29bec1a6 | 0 | 2026-11-12T15:15:28.957Z | HASH_OK |
| UAP-EV-20261112151528-d6f6be3a | task_step | step:probe.step2 | 0 | 2026-11-12T15:15:28.866Z | HASH_OK |
| UAP-EV-20261112151528-ec45fe54 | task_result | uap task run UAP-TASK-INTERRUPT-20261112151528-29bec1a6 | 0 | 2026-11-12T15:15:28.929Z | HASH_OK |
| UAP-EV-20261112151528-f46a1397 | cli_command | uap doctor | 0 | 2026-11-12T15:15:28.958Z | HASH_OK |
| UAP-EV-20261112151529-b4a7e4f0 | cli_command | uap audit | 0 | 2026-11-12T15:15:29.422Z | HASH_OK |
| UAP-EV-20261112151535-36cf8906 | cli_command | uap repair | 2 | 2026-11-12T15:15:35.832Z | HASH_OK |
| UAP-EV-20261112151535-5d9279eb | auto_repair_attempt | uap repair UAP-DEFECT-0003 | 2 | 2026-11-12T15:15:35.818Z | HASH_OK |
| UAP-EV-20261112151535-e5b509d6 | auto_repair_attempt | uap repair UAP-DEFECT-0004 | 2 | 2026-11-12T15:15:35.820Z | HASH_OK |
| UAP-EV-20261112151652-0703f5f4 | auto_repair_attempt | uap repair UAP-DEFECT-0004 | 2 | 2026-11-12T15:16:52.790Z | HASH_OK |
| UAP-EV-20261112151652-315392eb | auto_repair_attempt | uap repair UAP-DEFECT-0003 | 2 | 2026-11-12T15:16:52.788Z | HASH_OK |
| UAP-EV-20261112151652-7bf66361 | cli_command | uap repair | 2 | 2026-11-12T15:16:52.801Z | HASH_OK |
| UAP-EV-20261112151652-c7d4a4d1 | cli_command | uap audit | 0 | 2026-11-12T15:16:52.605Z | HASH_OK |
| UAP-EV-20261112151702-63a0557a | cli_command | uap repair | 0 | 2026-11-12T15:17:02.759Z | HASH_OK |
| UAP-EV-20261112151702-b67585a2 | cli_command | uap audit | 0 | 2026-11-12T15:17:02.560Z | HASH_OK |
| UAP-EV-20261112151714-3a9bd190 | cli_command | uap report --final | 0 | 2026-11-12T15:17:14.693Z | HASH_OK |
| UAP-EV-20261112151734-c7c24fec | cli_command | uap release check | 1 | 2026-11-12T15:17:34.832Z | HASH_OK |
| UAP-EV-20261112151735-1388c10f | cli_command | uap status | 0 | 2026-11-12T15:17:35.155Z | HASH_OK |
| UAP-EV-20261112151811-9b50626b | cli_command | uap status | 0 | 2026-11-12T15:18:11.448Z | HASH_OK |
| UAP-EV-20261112151821-a8acba0b | cli_command | uap status | 0 | 2026-11-12T15:18:21.121Z | HASH_OK |
| UAP-EV-20261112151830-07bad839 | task_step | step:__health_step__ | 0 | 2026-11-12T15:18:30.542Z | HASH_OK |
| UAP-EV-20261112151830-34728241 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112151830-2a1a9e56 | 0 | 2026-11-12T15:18:30.974Z | HASH_OK |
| UAP-EV-20261112151830-39cda2c1 | task_step | step:probe.step3 | 0 | 2026-11-12T15:18:30.898Z | HASH_OK |
| UAP-EV-20261112151830-48367644 | task_result | uap task run UAP-TASK-HEALTH-20261112151830-adb5120e | 0 | 2026-11-12T15:18:30.589Z | HASH_OK |
| UAP-EV-20261112151830-5b477b52 | task_step | step:probe.step1 | 0 | 2026-11-12T15:18:30.809Z | HASH_OK |
| UAP-EV-20261112151830-63694310 | health_probe | evidence-engine.health() | 0 | 2026-11-12T15:18:30.979Z | HASH_OK |
| UAP-EV-20261112151830-6738cf99 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112151830-2a1a9e56 | 0 | 2026-11-12T15:18:30.849Z | HASH_OK |
| UAP-EV-20261112151830-eeaa1385 | task_result | uap task run UAP-TASK-INTERRUPT-20261112151830-2a1a9e56 | 0 | 2026-11-12T15:18:30.945Z | HASH_OK |
| UAP-EV-20261112151830-f55e2725 | task_step | step:probe.step2 | 0 | 2026-11-12T15:18:30.883Z | HASH_OK |
| UAP-EV-20261112151831-08532262 | task_step | step:verify_reconciliation | 0 | 2026-11-12T15:18:31.920Z | HASH_OK |
| UAP-EV-20261112151831-0fdcd3f0 | task_step | step:inspect_payment_state_machine | 0 | 2026-11-12T15:18:31.777Z | HASH_OK |
| UAP-EV-20261112151831-19c35f66 | task_step | step:probe.step1 | 0 | 2026-11-12T15:18:31.267Z | HASH_OK |
| UAP-EV-20261112151831-1cfe1140 | task_step | step:inspect_refund_state_machine | 0 | 2026-11-12T15:18:31.803Z | HASH_OK |
| UAP-EV-20261112151831-2a857652 | task_step | step:test_failure_recovery | 0 | 2026-11-12T15:18:31.898Z | HASH_OK |
| UAP-EV-20261112151831-2d8a980d | task_step | step:probe.step3 | 0 | 2026-11-12T15:18:31.360Z | HASH_OK |
| UAP-EV-20261112151831-300ac1ed | task_step | step:test_concurrency | 0 | 2026-11-12T15:18:31.862Z | HASH_OK |
| UAP-EV-20261112151831-30eb159b | task_step | step:__uap_test_retry_then_ok__ | 0 | 2026-11-12T15:18:31.482Z | HASH_OK |
| UAP-EV-20261112151831-339df483 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112151831-55de1d88 | 0 | 2026-11-12T15:18:31.438Z | HASH_OK |
| UAP-EV-20261112151831-40f1d5d0 | workflow_step | workflow:validate_environment | 0 | 2026-11-12T15:18:31.727Z | HASH_OK |
| UAP-EV-20261112151831-42d7cd60 | task_result | uap task run UAP-TASK-TEST-20261112151831-bec06ee2 | 1 | 2026-11-12T15:18:31.639Z | HASH_OK |
| UAP-EV-20261112151831-4c7d5644 | workflow_step | workflow:verify_reconciliation | 0 | 2026-11-12T15:18:31.919Z | HASH_OK |
| UAP-EV-20261112151831-56637906 | task_step | step:probe.step2 | 0 | 2026-11-12T15:18:31.338Z | HASH_OK |
| UAP-EV-20261112151831-5cd65e64 | workflow_step | workflow:inspect_refund_state_machine | 0 | 2026-11-12T15:18:31.802Z | HASH_OK |
| UAP-EV-20261112151831-717ed8fe | workflow_step | workflow:test_duplicate_notifications | 0 | 2026-11-12T15:18:31.878Z | HASH_OK |
| UAP-EV-20261112151831-76979b80 | task_result | uap task run UAP-TASK-20261112151831-08adc550 | 0 | 2026-11-12T15:18:31.969Z | HASH_OK |
| UAP-EV-20261112151831-86c38950 | task_result | uap task run UAP-TASK-TEST-20261112151831-4be4d922 | 0 | 2026-11-12T15:18:31.530Z | HASH_OK |
| UAP-EV-20261112151831-9270ec41 | task_step | step:test_duplicate_notifications | 0 | 2026-11-12T15:18:31.879Z | HASH_OK |
| UAP-EV-20261112151831-a01a312b | recovery | uap task resume UAP-TASK-INTERRUPT-20261112151831-55de1d88 | 0 | 2026-11-12T15:18:31.305Z | HASH_OK |
| UAP-EV-20261112151831-b4b6d389 | workflow_step | workflow:test_idempotency | 0 | 2026-11-12T15:18:31.840Z | HASH_OK |
| UAP-EV-20261112151831-bbe20d18 | workflow_step | workflow:inspect_balance_ledger | 0 | 2026-11-12T15:18:31.821Z | HASH_OK |
| UAP-EV-20261112151831-bf57675c | workflow_step | workflow:inspect_payment_state_machine | 0 | 2026-11-12T15:18:31.777Z | HASH_OK |
| UAP-EV-20261112151831-c1435384 | task_step | step:__uap_test_always_fail__ | 1 | 2026-11-12T15:18:31.593Z | HASH_OK |
| UAP-EV-20261112151831-c180dea0 | task_step | step:inspect_balance_ledger | 0 | 2026-11-12T15:18:31.822Z | HASH_OK |
| UAP-EV-20261112151831-c978d664 | task_result | uap task run UAP-TASK-INTERRUPT-20261112151831-55de1d88 | 0 | 2026-11-12T15:18:31.408Z | HASH_OK |
| UAP-EV-20261112151831-d0b63da9 | workflow_step | workflow:test_failure_recovery | 0 | 2026-11-12T15:18:31.897Z | HASH_OK |
| UAP-EV-20261112151831-e4a5d9fd | task_step | step:test_idempotency | 0 | 2026-11-12T15:18:31.840Z | HASH_OK |
| UAP-EV-20261112151831-eb076a88 | workflow_step | workflow:test_concurrency | 0 | 2026-11-12T15:18:31.861Z | HASH_OK |
| UAP-EV-20261112151832-2735a707 | task_result | uap task run UAP-TASK-INTERRUPT-20261112151832-547cb87d | 0 | 2026-11-12T15:18:32.720Z | HASH_OK |
| UAP-EV-20261112151832-3359b625 | task_step | step:probe.step1 | 0 | 2026-11-12T15:18:32.582Z | HASH_OK |
| UAP-EV-20261112151832-44c837dc | health_probe | evidence-engine.health() | 0 | 2026-11-12T15:18:32.758Z | HASH_OK |
| UAP-EV-20261112151832-4e5169f8 | cli_command | uap test --all | 0 | 2026-11-12T15:18:32.075Z | HASH_OK |
| UAP-EV-20261112151832-56dbe3f6 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112151832-547cb87d | 0 | 2026-11-12T15:18:32.755Z | HASH_OK |
| UAP-EV-20261112151832-570d224a | task_step | step:__health_step__ | 0 | 2026-11-12T15:18:32.312Z | HASH_OK |
| UAP-EV-20261112151832-646f4420 | task_step | step:probe.step2 | 0 | 2026-11-12T15:18:32.658Z | HASH_OK |
| UAP-EV-20261112151832-76dbb503 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112151832-547cb87d | 0 | 2026-11-12T15:18:32.624Z | HASH_OK |
| UAP-EV-20261112151832-7f745087 | runtime_test_run | node --test .uap/tests/runtime.test.mjs | 0 | 2026-11-12T15:18:32.072Z | HASH_OK |
| UAP-EV-20261112151832-826e774d | task_result | uap task run UAP-TASK-HEALTH-20261112151832-4019bbe0 | 0 | 2026-11-12T15:18:32.361Z | HASH_OK |
| UAP-EV-20261112151832-8b69536f | runtime_start | uap doctor | 0 | 2026-11-12T15:18:32.779Z | HASH_OK |
| UAP-EV-20261112151832-9c18d4f1 | task_step | step:probe.step1 | 0 | 2026-11-12T15:18:32.944Z | HASH_OK |
| UAP-EV-20261112151832-e2038a6b | recovery | uap task resume UAP-TASK-INTERRUPT-20261112151832-478afed3 | 0 | 2026-11-12T15:18:32.985Z | HASH_OK |
| UAP-EV-20261112151832-f5bd4dd7 | task_step | step:probe.step3 | 0 | 2026-11-12T15:18:32.672Z | HASH_OK |
| UAP-EV-20261112151833-0c56fb89 | validator_result | uap validate product.requirement_traceability | 0 | 2026-11-12T15:18:33.809Z | HASH_OK |
| UAP-EV-20261112151833-13e0c525 | task_step | step:probe.step3 | 0 | 2026-11-12T15:18:33.043Z | HASH_OK |
| UAP-EV-20261112151833-185b0af6 | validator_result | uap validate architecture.adr_integrity | 0 | 2026-11-12T15:18:33.922Z | HASH_OK |
| UAP-EV-20261112151833-33059e5b | validator_result | uap validate product.business_rule_integrity | 0 | 2026-11-12T15:18:33.870Z | HASH_OK |
| UAP-EV-20261112151833-40ea42b7 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112151832-478afed3 | 0 | 2026-11-12T15:18:33.119Z | HASH_OK |
| UAP-EV-20261112151833-63d293fc | validator_result | uap validate architecture.api_database_integrity | 0 | 2026-11-12T15:18:33.905Z | HASH_OK |
| UAP-EV-20261112151833-6de15942 | task_step | step:probe.step2 | 0 | 2026-11-12T15:18:33.021Z | HASH_OK |
| UAP-EV-20261112151833-785402e1 | validator_result | uap validate core.execution_integrity | 0 | 2026-11-12T15:18:33.637Z | HASH_OK |
| UAP-EV-20261112151833-7c80826e | cli_command | uap doctor | 0 | 2026-11-12T15:18:33.121Z | HASH_OK |
| UAP-EV-20261112151833-865b69fa | validator_result | uap validate agents.registry_integrity | 0 | 2026-11-12T15:18:33.937Z | HASH_OK |
| UAP-EV-20261112151833-8ac25a99 | validator_result | uap validate security.permission_boundary | 0 | 2026-11-12T15:18:33.677Z | HASH_OK |
| UAP-EV-20261112151833-a5754598 | validator_result | uap validate architecture.consistency | 0 | 2026-11-12T15:18:33.889Z | HASH_OK |
| UAP-EV-20261112151833-a6ad151e | task_result | uap task run UAP-TASK-INTERRUPT-20261112151832-478afed3 | 0 | 2026-11-12T15:18:33.088Z | HASH_OK |
| UAP-EV-20261112151833-b82f01f4 | validator_result | uap validate core.architecture_integrity | 0 | 2026-11-12T15:18:33.498Z | HASH_OK |
| UAP-EV-20261112151833-e87ea9bf | validator_result | uap validate product.prototype_consistency | 0 | 2026-11-12T15:18:33.841Z | HASH_OK |
| UAP-EV-20261112151833-ea982085 | validator_result | uap validate core.evidence_integrity | 0 | 2026-11-12T15:18:33.779Z | HASH_OK |
| UAP-EV-20261112151834-15cf48fd | validator_result | uap validate agents.execution_integrity | 0 | 2026-11-12T15:18:34.174Z | HASH_OK |
| UAP-EV-20261112151834-3f7e6600 | validator_result | uap validate agents.collaboration_integrity | 0 | 2026-11-12T15:18:34.188Z | HASH_OK |
| UAP-EV-20261112151834-8c6cc702 | validator_result | uap validate agents.recovery_integrity | 0 | 2026-11-12T15:18:34.317Z | HASH_OK |
| UAP-EV-20261112151835-007fae8a | validator_result | uap validate quality.test_integrity | 0 | 2026-11-12T15:18:35.739Z | HASH_OK |
| UAP-EV-20261112151835-2e3916f2 | validator_result | uap validate development.review_integrity | 0 | 2026-11-12T15:18:35.586Z | HASH_OK |
| UAP-EV-20261112151835-8d2383fd | validator_result | uap validate development.coding_compliance | 0 | 2026-11-12T15:18:35.461Z | HASH_OK |
| UAP-EV-20261112151835-914f9722 | validator_result | uap validate quality.engineering_integrity | 1 | 2026-11-12T15:18:35.725Z | HASH_OK |
| UAP-EV-20261112151835-e304f024 | validator_result | uap validate development.dependency_integrity | 0 | 2026-11-12T15:18:35.602Z | HASH_OK |
| UAP-EV-20261112151835-f77db6df | validator_result | uap validate quality.repair_integrity | 0 | 2026-11-12T15:18:35.870Z | HASH_OK |
| UAP-EV-20261112151836-2a182373 | validator_result | uap validate security.application_integrity | 0 | 2026-11-12T15:18:36.304Z | HASH_OK |
| UAP-EV-20261112151836-4b28ebbe | validator_result | uap validate delivery.deployment_integrity | 1 | 2026-11-12T15:18:36.863Z | HASH_OK |
| UAP-EV-20261112151836-4cd3d13d | validator_result | uap validate delivery.ci_integrity | 0 | 2026-11-12T15:18:36.846Z | HASH_OK |
| UAP-EV-20261112151836-4d7fd378 | validator_result | uap validate security.financial_integrity_validator | 0 | 2026-11-12T15:18:36.317Z | HASH_OK |
| UAP-EV-20261112151836-6fe2ee9c | validator_result | uap validate security.reliability_integrity | 0 | 2026-11-12T15:18:36.459Z | HASH_OK |
| UAP-EV-20261112151836-8e7edcf5 | validator_result | uap validate cross_platform.web_integrity | 0 | 2026-11-12T15:18:36.642Z | HASH_OK |
| UAP-EV-20261112151836-9393896d | validator_result | uap validate quality.gate_integrity | 0 | 2026-11-12T15:18:36.003Z | HASH_OK |
| UAP-EV-20261112151836-96e884ac | validator_result | uap validate cross_platform.h5_integrity | 1 | 2026-11-12T15:18:36.772Z | HASH_OK |
| UAP-EV-20261112151836-aa495ddf | validator_result | uap validate cross_platform.consistency_integrity | 0 | 2026-11-12T15:18:36.829Z | HASH_OK |
| UAP-EV-20261112151837-3f0e13fa | validator_result | uap validate evolution.evolution_integrity | 0 | 2026-11-12T15:18:37.271Z | HASH_OK |
| UAP-EV-20261112151837-98b06972 | validator_result | uap validate evolution.knowledge_integrity | 0 | 2026-11-12T15:18:37.150Z | HASH_OK |
| UAP-EV-20261112151837-bf56041f | cli_command | uap validate --all | 1 | 2026-11-12T15:18:37.285Z | HASH_OK |
| UAP-EV-20261112151837-f01d1b57 | validator_result | uap validate delivery.observability_integrity | 0 | 2026-11-12T15:18:37.117Z | HASH_OK |
| UAP-EV-20261112152019-3f63ae18 | cli_command | uap task create --objective=re-run auto-repair engine sandbox exercise to regenerate its artifact --spec=UAP-05-003 --agent=uap-repair-agent | 0 | 2026-11-12T15:20:19.291Z | HASH_OK |
| UAP-EV-20261112152019-89d0dd33 | cli_command | uap task list | 0 | 2026-11-12T15:20:19.500Z | HASH_OK |
| UAP-EV-20261112152032-040b56c5 | task_step | step:uap-repair-agent | 0 | 2026-11-12T15:20:32.030Z | HASH_OK |
| UAP-EV-20261112152032-1ef6b3f7 | agent_invocation | agent:uap-repair-agent | 0 | 2026-11-12T15:20:32.029Z | HASH_OK |
| UAP-EV-20261112152032-284355a9 | task_result | uap task run UAP-TASK-20261112152019-fbd0cf50 | 0 | 2026-11-12T15:20:32.081Z | HASH_OK |
| UAP-EV-20261112152032-3be383e0 | cli_command | uap task run UAP-TASK-20261112152019-fbd0cf50 | 0 | 2026-11-12T15:20:32.108Z | HASH_OK |
| UAP-EV-20261112152048-402c71f9 | cli_command | uap repair | 0 | 2026-11-12T15:20:48.162Z | HASH_OK |
| UAP-EV-20261112152048-e6c44f30 | cli_command | uap audit | 0 | 2026-11-12T15:20:48.639Z | HASH_OK |
| UAP-EV-20261112152048-fb53e8ab | validator_result | uap validate core.architecture_integrity | 0 | 2026-11-12T15:20:48.990Z | HASH_OK |
| UAP-EV-20261112152049-012d6b5d | validator_result | uap validate product.prototype_consistency | 0 | 2026-11-12T15:20:49.351Z | HASH_OK |
| UAP-EV-20261112152049-02cead85 | validator_result | uap validate architecture.adr_integrity | 0 | 2026-11-12T15:20:49.431Z | HASH_OK |
| UAP-EV-20261112152049-1ee0c8d8 | validator_result | uap validate architecture.api_database_integrity | 0 | 2026-11-12T15:20:49.415Z | HASH_OK |
| UAP-EV-20261112152049-1f211a0e | validator_result | uap validate product.requirement_traceability | 0 | 2026-11-12T15:20:49.316Z | HASH_OK |
| UAP-EV-20261112152049-3ea174b1 | validator_result | uap validate agents.collaboration_integrity | 0 | 2026-11-12T15:20:49.693Z | HASH_OK |
| UAP-EV-20261112152049-5280b7e2 | validator_result | uap validate core.execution_integrity | 0 | 2026-11-12T15:20:49.129Z | HASH_OK |
| UAP-EV-20261112152049-5e8d3e63 | validator_result | uap validate product.business_rule_integrity | 0 | 2026-11-12T15:20:49.377Z | HASH_OK |
| UAP-EV-20261112152049-60a62f8e | validator_result | uap validate architecture.consistency | 0 | 2026-11-12T15:20:49.399Z | HASH_OK |
| UAP-EV-20261112152049-68205052 | validator_result | uap validate core.evidence_integrity | 0 | 2026-11-12T15:20:49.285Z | HASH_OK |
| UAP-EV-20261112152049-b4943da3 | validator_result | uap validate agents.execution_integrity | 0 | 2026-11-12T15:20:49.678Z | HASH_OK |
| UAP-EV-20261112152049-e678e9f2 | validator_result | uap validate agents.recovery_integrity | 0 | 2026-11-12T15:20:49.823Z | HASH_OK |
| UAP-EV-20261112152049-f6bf2135 | validator_result | uap validate agents.registry_integrity | 0 | 2026-11-12T15:20:49.447Z | HASH_OK |
| UAP-EV-20261112152049-f70c861c | validator_result | uap validate security.permission_boundary | 0 | 2026-11-12T15:20:49.169Z | HASH_OK |
| UAP-EV-20261112152050-8e895134 | validator_result | uap validate development.coding_compliance | 0 | 2026-11-12T15:20:50.965Z | HASH_OK |
| UAP-EV-20261112152051-084de46f | validator_result | uap validate quality.gate_integrity | 0 | 2026-11-12T15:20:51.510Z | HASH_OK |
| UAP-EV-20261112152051-231b5491 | validator_result | uap validate development.dependency_integrity | 0 | 2026-11-12T15:20:51.108Z | HASH_OK |
| UAP-EV-20261112152051-3aee5bd8 | validator_result | uap validate development.review_integrity | 0 | 2026-11-12T15:20:51.095Z | HASH_OK |
| UAP-EV-20261112152051-52b9abe0 | validator_result | uap validate security.application_integrity | 0 | 2026-11-12T15:20:51.803Z | HASH_OK |
| UAP-EV-20261112152051-c496b13f | validator_result | uap validate quality.engineering_integrity | 0 | 2026-11-12T15:20:51.231Z | HASH_OK |
| UAP-EV-20261112152051-d32612d8 | validator_result | uap validate security.reliability_integrity | 0 | 2026-11-12T15:20:51.962Z | HASH_OK |
| UAP-EV-20261112152051-d8091fea | validator_result | uap validate quality.test_integrity | 0 | 2026-11-12T15:20:51.244Z | HASH_OK |
| UAP-EV-20261112152051-e576f795 | validator_result | uap validate quality.repair_integrity | 0 | 2026-11-12T15:20:51.380Z | HASH_OK |
| UAP-EV-20261112152051-f160e1c4 | validator_result | uap validate security.financial_integrity_validator | 0 | 2026-11-12T15:20:51.817Z | HASH_OK |
| UAP-EV-20261112152052-1b0ade2e | cli_command | uap validate --all | 2 | 2026-11-12T15:20:52.778Z | HASH_OK |
| UAP-EV-20261112152052-2f2ad02d | validator_result | uap validate evolution.evolution_integrity | 0 | 2026-11-12T15:20:52.764Z | HASH_OK |
| UAP-EV-20261112152052-36e97939 | validator_result | uap validate cross_platform.h5_integrity | 1 | 2026-11-12T15:20:52.268Z | HASH_OK |
| UAP-EV-20261112152052-53adfd59 | validator_result | uap validate evolution.knowledge_integrity | 0 | 2026-11-12T15:20:52.642Z | HASH_OK |
| UAP-EV-20261112152052-54c8ffe5 | validator_result | uap validate delivery.ci_integrity | 0 | 2026-11-12T15:20:52.343Z | HASH_OK |
| UAP-EV-20261112152052-5f4ec620 | validator_result | uap validate delivery.observability_integrity | 0 | 2026-11-12T15:20:52.611Z | HASH_OK |
| UAP-EV-20261112152052-97bb7173 | validator_result | uap validate cross_platform.web_integrity | 0 | 2026-11-12T15:20:52.140Z | HASH_OK |
| UAP-EV-20261112152052-f3e9f70b | validator_result | uap validate cross_platform.consistency_integrity | 0 | 2026-11-12T15:20:52.325Z | HASH_OK |
| UAP-EV-20261112152052-fb0bf244 | validator_result | uap validate delivery.deployment_integrity | 1 | 2026-11-12T15:20:52.358Z | HASH_OK |
| UAP-EV-20261112152053-05470393 | task_step | step:initialize_runtime | 0 | 2026-11-12T15:20:53.798Z | HASH_OK |
| UAP-EV-20261112152053-05922ee7 | task_step | step:probe.step3 | 0 | 2026-11-12T15:20:53.695Z | HASH_OK |
| UAP-EV-20261112152053-16580051 | task_step | step:initialize_uap_structure | 0 | 2026-11-12T15:20:53.229Z | HASH_OK |
| UAP-EV-20261112152053-1bbf63ea | task_step | step:__health_step__ | 0 | 2026-11-12T15:20:53.326Z | HASH_OK |
| UAP-EV-20261112152053-2def0506 | task_result | uap task run UAP-TASK-HEALTH-20261112152053-e0f84eb3 | 0 | 2026-11-12T15:20:53.376Z | HASH_OK |
| UAP-EV-20261112152053-32b0a333 | workflow_step | workflow:initialize_runtime | 0 | 2026-11-12T15:20:53.798Z | HASH_OK |
| UAP-EV-20261112152053-38fd1727 | task_step | step:probe.step2 | 0 | 2026-11-12T15:20:53.679Z | HASH_OK |
| UAP-EV-20261112152053-3a742a28 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112152053-f43ddb8e | 0 | 2026-11-12T15:20:53.777Z | HASH_OK |
| UAP-EV-20261112152053-4a524426 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112152053-f43ddb8e | 0 | 2026-11-12T15:20:53.646Z | HASH_OK |
| UAP-EV-20261112152053-83ba7ba9 | task_result | uap task run UAP-TASK-INTERRUPT-20261112152053-f43ddb8e | 0 | 2026-11-12T15:20:53.745Z | HASH_OK |
| UAP-EV-20261112152053-89cab007 | task_step | step:probe.step1 | 0 | 2026-11-12T15:20:53.604Z | HASH_OK |
| UAP-EV-20261112152053-a126668c | task_step | step:validate_environment | 0 | 2026-11-12T15:20:53.210Z | HASH_OK |
| UAP-EV-20261112152053-aa7977a7 | workflow_step | workflow:initialize_uap_structure | 0 | 2026-11-12T15:20:53.229Z | HASH_OK |
| UAP-EV-20261112152053-c96b85be | task_step | step:inspect_repository | 0 | 2026-11-12T15:20:53.140Z | HASH_OK |
| UAP-EV-20261112152053-cc75b64f | workflow_step | workflow:validate_environment | 0 | 2026-11-12T15:20:53.209Z | HASH_OK |
| UAP-EV-20261112152053-e906d2c4 | workflow_step | workflow:validate_specification_registry | 0 | 2026-11-12T15:20:53.259Z | HASH_OK |
| UAP-EV-20261112152053-ec162e50 | health_probe | evidence-engine.health() | 0 | 2026-11-12T15:20:53.780Z | HASH_OK |
| UAP-EV-20261112152053-ef648417 | workflow_step | workflow:inspect_repository | 0 | 2026-11-12T15:20:53.139Z | HASH_OK |
| UAP-EV-20261112152053-f27d5d6f | task_step | step:validate_specification_registry | 0 | 2026-11-12T15:20:53.259Z | HASH_OK |
| UAP-EV-20261112152054-041898dd | task_step | step:probe.step2 | 0 | 2026-11-12T15:20:54.502Z | HASH_OK |
| UAP-EV-20261112152054-0de877d0 | task_step | step:probe.step1 | 0 | 2026-11-12T15:20:54.425Z | HASH_OK |
| UAP-EV-20261112152054-0f33e951 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112152054-b56be4eb | 0 | 2026-11-12T15:20:54.467Z | HASH_OK |
| UAP-EV-20261112152054-36fb3600 | health_probe | evidence-engine.health() | 0 | 2026-11-12T15:20:54.605Z | HASH_OK |
| UAP-EV-20261112152054-46069b55 | task_step | step:probe.step3 | 0 | 2026-11-12T15:20:54.520Z | HASH_OK |
| UAP-EV-20261112152054-90808471 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112152054-b56be4eb | 0 | 2026-11-12T15:20:54.600Z | HASH_OK |
| UAP-EV-20261112152054-9462e957 | task_result | uap task run UAP-TASK-HEALTH-20261112152054-a34be6bd | 0 | 2026-11-12T15:20:54.196Z | HASH_OK |
| UAP-EV-20261112152054-b439fa1b | recovery | uap task resume UAP-TASK-INTERRUPT-20261112152054-50891287 | 0 | 2026-11-12T15:20:54.934Z | HASH_OK |
| UAP-EV-20261112152054-b94bd75c | task_step | step:probe.step2 | 0 | 2026-11-12T15:20:54.968Z | HASH_OK |
| UAP-EV-20261112152054-b9dabb76 | task_step | step:probe.step1 | 0 | 2026-11-12T15:20:54.895Z | HASH_OK |
| UAP-EV-20261112152054-bbd764f7 | task_step | step:__health_step__ | 0 | 2026-11-12T15:20:54.140Z | HASH_OK |
| UAP-EV-20261112152054-c496f95b | task_result | uap task run UAP-TASK-INTERRUPT-20261112152054-b56be4eb | 0 | 2026-11-12T15:20:54.569Z | HASH_OK |
| UAP-EV-20261112152054-d45bb9f8 | task_step | step:probe.step3 | 0 | 2026-11-12T15:20:54.985Z | HASH_OK |
| UAP-EV-20261112152055-06998aac | workflow_step | workflow:test_idempotency | 0 | 2026-11-12T15:20:55.482Z | HASH_OK |
| UAP-EV-20261112152055-1fe6d885 | task_step | step:test_failure_recovery | 0 | 2026-11-12T15:20:55.540Z | HASH_OK |
| UAP-EV-20261112152055-2095d20f | workflow_step | workflow:inspect_balance_ledger | 0 | 2026-11-12T15:20:55.459Z | HASH_OK |
| UAP-EV-20261112152055-340d77ab | task_step | step:__uap_test_always_fail__ | 1 | 2026-11-12T15:20:55.230Z | HASH_OK |
| UAP-EV-20261112152055-41361734 | workflow_step | workflow:run_runtime_tests | 0 | 2026-11-12T15:20:55.715Z | HASH_OK |
| UAP-EV-20261112152055-4e02457f | task_step | step:test_idempotency | 0 | 2026-11-12T15:20:55.482Z | HASH_OK |
| UAP-EV-20261112152055-5ed0e734 | workflow_step | workflow:verify_reconciliation | 0 | 2026-11-12T15:20:55.560Z | HASH_OK |
| UAP-EV-20261112152055-62c6eac1 | task_step | step:verify_reconciliation | 0 | 2026-11-12T15:20:55.560Z | HASH_OK |
| UAP-EV-20261112152055-63a4177b | task_step | step:scan_requirements | 0 | 2026-11-12T15:20:55.998Z | HASH_OK |
| UAP-EV-20261112152055-6c595bd8 | workflow_step | workflow:validate_environment | 0 | 2026-11-12T15:20:55.367Z | HASH_OK |
| UAP-EV-20261112152055-754c3679 | workflow_step | workflow:test_concurrency | 0 | 2026-11-12T15:20:55.499Z | HASH_OK |
| UAP-EV-20261112152055-75cd4b53 | workflow_step | workflow:scan_requirements | 0 | 2026-11-12T15:20:55.997Z | HASH_OK |
| UAP-EV-20261112152055-8c7b8893 | task_step | step:inspect_refund_state_machine | 0 | 2026-11-12T15:20:55.440Z | HASH_OK |
| UAP-EV-20261112152055-8caea5f3 | task_result | uap task run UAP-TASK-TEST-20261112152055-1e31a914 | 1 | 2026-11-12T15:20:55.280Z | HASH_OK |
| UAP-EV-20261112152055-8fe5dff8 | task_result | uap task run UAP-TASK-TEST-20261112152055-4b02e5e3 | 0 | 2026-11-12T15:20:55.163Z | HASH_OK |
| UAP-EV-20261112152055-958a9052 | task_step | step:__uap_test_retry_then_ok__ | 0 | 2026-11-12T15:20:55.112Z | HASH_OK |
| UAP-EV-20261112152055-981f0d5f | task_step | step:test_concurrency | 0 | 2026-11-12T15:20:55.499Z | HASH_OK |
| UAP-EV-20261112152055-a0693f20 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112152054-50891287 | 0 | 2026-11-12T15:20:55.068Z | HASH_OK |
| UAP-EV-20261112152055-a75f9e76 | workflow_step | workflow:inspect_payment_state_machine | 0 | 2026-11-12T15:20:55.418Z | HASH_OK |
| UAP-EV-20261112152055-aca1f5a7 | task_result | uap task run UAP-TASK-20261112152052-7430c80b | 0 | 2026-11-12T15:20:55.768Z | HASH_OK |
| UAP-EV-20261112152055-af3a54f6 | task_result | uap task run UAP-TASK-20261112152055-1fada051 | 0 | 2026-11-12T15:20:55.610Z | HASH_OK |
| UAP-EV-20261112152055-b86b3c90 | task_step | step:inspect_project | 0 | 2026-11-12T15:20:55.959Z | HASH_OK |
| UAP-EV-20261112152055-bb5eac3b | workflow_step | workflow:test_failure_recovery | 0 | 2026-11-12T15:20:55.539Z | HASH_OK |
| UAP-EV-20261112152055-c3216327 | task_step | step:inspect_balance_ledger | 0 | 2026-11-12T15:20:55.459Z | HASH_OK |
| UAP-EV-20261112152055-c3725c11 | task_result | uap task run UAP-TASK-INTERRUPT-20261112152054-50891287 | 0 | 2026-11-12T15:20:55.036Z | HASH_OK |
| UAP-EV-20261112152055-d4ade795 | task_step | step:inspect_payment_state_machine | 0 | 2026-11-12T15:20:55.419Z | HASH_OK |
| UAP-EV-20261112152055-e0b134c7 | workflow_step | workflow:inspect_project | 0 | 2026-11-12T15:20:55.959Z | HASH_OK |
| UAP-EV-20261112152055-fa8366a0 | task_step | step:test_duplicate_notifications | 0 | 2026-11-12T15:20:55.519Z | HASH_OK |
| UAP-EV-20261112152055-fb355b85 | workflow_step | workflow:inspect_refund_state_machine | 0 | 2026-11-12T15:20:55.439Z | HASH_OK |
| UAP-EV-20261112152055-ff58081f | task_step | step:run_runtime_tests | 0 | 2026-11-12T15:20:55.716Z | HASH_OK |
| UAP-EV-20261112152055-fff6a262 | workflow_step | workflow:test_duplicate_notifications | 0 | 2026-11-12T15:20:55.518Z | HASH_OK |
| UAP-EV-20261112152056-1344e8ca | workflow_step | workflow:scan_agents | 0 | 2026-11-12T15:20:56.046Z | HASH_OK |
| UAP-EV-20261112152056-261e6086 | workflow_step | workflow:implement_missing_capabilities | 0 | 2026-11-12T15:20:56.376Z | HASH_OK |
| UAP-EV-20261112152056-306d22a6 | workflow_step | workflow:resolve_dependencies | 0 | 2026-11-12T15:20:56.338Z | HASH_OK |
| UAP-EV-20261112152056-34fa7d37 | workflow_step | workflow:scan_quality | 0 | 2026-11-12T15:20:56.090Z | HASH_OK |
| UAP-EV-20261112152056-39b2a583 | task_step | step:scan_agents | 0 | 2026-11-12T15:20:56.047Z | HASH_OK |
| UAP-EV-20261112152056-3a171946 | workflow_step | workflow:scan_security | 0 | 2026-11-12T15:20:56.109Z | HASH_OK |
| UAP-EV-20261112152056-407fa5a0 | task_result | uap task run UAP-TASK-INTERRUPT-20261112152056-d754b20c | 0 | 2026-11-12T15:20:56.957Z | HASH_OK |
| UAP-EV-20261112152056-47e5e3a0 | task_step | step:scan_delivery | 0 | 2026-11-12T15:20:56.166Z | HASH_OK |
| UAP-EV-20261112152056-49081b2b | task_step | step:scan_development | 0 | 2026-11-12T15:20:56.068Z | HASH_OK |
| UAP-EV-20261112152056-50692286 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112152056-d754b20c | 0 | 2026-11-12T15:20:56.988Z | HASH_OK |
| UAP-EV-20261112152056-51c17766 | task_step | step:resolve_dependencies | 0 | 2026-11-12T15:20:56.338Z | HASH_OK |
| UAP-EV-20261112152056-5412dc7d | task_step | step:probe.step1 | 0 | 2026-11-12T15:20:56.799Z | HASH_OK |
| UAP-EV-20261112152056-631211d0 | task_step | step:probe.step3 | 0 | 2026-11-12T15:20:56.903Z | HASH_OK |
| UAP-EV-20261112152056-6a9d908f | task_step | step:probe.step2 | 0 | 2026-11-12T15:20:56.886Z | HASH_OK |
| UAP-EV-20261112152056-73012eaa | task_step | step:implement_missing_validators | 0 | 2026-11-12T15:20:56.397Z | HASH_OK |
| UAP-EV-20261112152056-82a2729e | workflow_step | workflow:scan_development | 0 | 2026-11-12T15:20:56.067Z | HASH_OK |
| UAP-EV-20261112152056-90651ccd | workflow_step | workflow:build_defect_registry | 0 | 2026-11-12T15:20:56.209Z | HASH_OK |
| UAP-EV-20261112152056-973e426a | task_step | step:scan_knowledge | 0 | 2026-11-12T15:20:56.186Z | HASH_OK |
| UAP-EV-20261112152056-a2067a0c | task_step | step:build_defect_registry | 0 | 2026-11-12T15:20:56.210Z | HASH_OK |
| UAP-EV-20261112152056-ae128116 | health_probe | evidence-engine.health() | 0 | 2026-11-12T15:20:56.990Z | HASH_OK |
| UAP-EV-20261112152056-ae7d67ec | task_result | uap task run UAP-TASK-HEALTH-20261112152056-5e63b630 | 0 | 2026-11-12T15:20:56.524Z | HASH_OK |
| UAP-EV-20261112152056-b560ee81 | task_step | step:scan_security | 0 | 2026-11-12T15:20:56.110Z | HASH_OK |
| UAP-EV-20261112152056-b6f98a83 | workflow_step | workflow:scan_delivery | 0 | 2026-11-12T15:20:56.166Z | HASH_OK |
| UAP-EV-20261112152056-c3bad0c4 | workflow_step | workflow:scan_architecture | 0 | 2026-11-12T15:20:56.027Z | HASH_OK |
| UAP-EV-20261112152056-c5992f54 | task_step | step:__health_step__ | 0 | 2026-11-12T15:20:56.471Z | HASH_OK |
| UAP-EV-20261112152056-cbefc4c0 | task_step | step:implement_missing_capabilities | 0 | 2026-11-12T15:20:56.376Z | HASH_OK |
| UAP-EV-20261112152056-cc70620a | workflow_step | workflow:create_execution_plan | 0 | 2026-11-12T15:20:56.358Z | HASH_OK |
| UAP-EV-20261112152056-d0b14342 | workflow_step | workflow:implement_missing_validators | 0 | 2026-11-12T15:20:56.397Z | HASH_OK |
| UAP-EV-20261112152056-e0fbe392 | task_step | step:scan_architecture | 0 | 2026-11-12T15:20:56.028Z | HASH_OK |
| UAP-EV-20261112152056-e322cc89 | task_step | step:scan_quality | 0 | 2026-11-12T15:20:56.090Z | HASH_OK |
| UAP-EV-20261112152056-ea22cd8d | task_step | step:scan_cross_platform | 0 | 2026-11-12T15:20:56.147Z | HASH_OK |
| UAP-EV-20261112152056-f343e65d | task_result | uap task run UAP-TASK-20261112152055-1eca1df6 | 0 | 2026-11-12T15:20:56.264Z | HASH_OK |
| UAP-EV-20261112152056-f45f4fe7 | workflow_step | workflow:scan_cross_platform | 0 | 2026-11-12T15:20:56.146Z | HASH_OK |
| UAP-EV-20261112152056-f731c271 | task_step | step:create_execution_plan | 0 | 2026-11-12T15:20:56.358Z | HASH_OK |
| UAP-EV-20261112152056-f8dee215 | workflow_step | workflow:scan_knowledge | 0 | 2026-11-12T15:20:56.185Z | HASH_OK |
| UAP-EV-20261112152056-fa6ec0e4 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112152056-d754b20c | 0 | 2026-11-12T15:20:56.853Z | HASH_OK |
| UAP-EV-20261112152057-064d6044 | workflow_step | workflow:integrate_runtime | 0 | 2026-11-12T15:20:57.006Z | HASH_OK |
| UAP-EV-20261112152057-10feaa7f | workflow_step | workflow:calculate_impact | 0 | 2026-11-12T15:20:57.197Z | HASH_OK |
| UAP-EV-20261112152057-1de691f3 | workflow_step | workflow:classify_defect | 0 | 2026-11-12T15:20:57.156Z | HASH_OK |
| UAP-EV-20261112152057-288b936d | workflow_step | workflow:persist_evidence | 0 | 2026-11-12T15:20:57.301Z | HASH_OK |
| UAP-EV-20261112152057-29ed157f | task_step | step:integrate_runtime | 0 | 2026-11-12T15:20:57.006Z | HASH_OK |
| UAP-EV-20261112152057-2ed27dce | task_step | step:independent_review | 0 | 2026-11-12T15:20:57.283Z | HASH_OK |
| UAP-EV-20261112152057-2fda2113 | workflow_step | workflow:execute_targeted_tests | 0 | 2026-11-12T15:20:57.026Z | HASH_OK |
| UAP-EV-20261112152057-376d73d6 | task_step | step:classify_defect | 0 | 2026-11-12T15:20:57.156Z | HASH_OK |
| UAP-EV-20261112152057-41a8c9c7 | task_step | step:generate_repair_plan | 0 | 2026-11-12T15:20:57.217Z | HASH_OK |
| UAP-EV-20261112152057-4bbaf20d | task_result | uap task run UAP-TASK-20261112152057-0f723d17 | 0 | 2026-11-12T15:20:57.359Z | HASH_OK |
| UAP-EV-20261112152057-78c328f4 | workflow_step | workflow:run_regression | 0 | 2026-11-12T15:20:57.259Z | HASH_OK |
| UAP-EV-20261112152057-91598eb0 | task_step | step:execute_targeted_tests | 0 | 2026-11-12T15:20:57.027Z | HASH_OK |
| UAP-EV-20261112152057-997bd76e | workflow_step | workflow:independent_review | 0 | 2026-11-12T15:20:57.283Z | HASH_OK |
| UAP-EV-20261112152057-9c0628f1 | workflow_step | workflow:apply_authorized_repair | 0 | 2026-11-12T15:20:57.241Z | HASH_OK |
| UAP-EV-20261112152057-ae02a0c0 | task_step | step:calculate_impact | 0 | 2026-11-12T15:20:57.198Z | HASH_OK |
| UAP-EV-20261112152057-bb44e896 | workflow_step | workflow:identify_root_cause | 0 | 2026-11-12T15:20:57.176Z | HASH_OK |
| UAP-EV-20261112152057-bd678a51 | task_step | step:run_regression | 0 | 2026-11-12T15:20:57.260Z | HASH_OK |
| UAP-EV-20261112152057-be68e5f6 | task_step | step:persist_evidence | 0 | 2026-11-12T15:20:57.305Z | HASH_OK |
| UAP-EV-20261112152057-c38b0ac9 | task_step | step:identify_root_cause | 0 | 2026-11-12T15:20:57.177Z | HASH_OK |
| UAP-EV-20261112152057-d8c45c18 | task_step | step:apply_authorized_repair | 0 | 2026-11-12T15:20:57.241Z | HASH_OK |
| UAP-EV-20261112152057-f836ad01 | workflow_step | workflow:generate_repair_plan | 0 | 2026-11-12T15:20:57.216Z | HASH_OK |
| UAP-EV-20261112152057-fd582a99 | task_result | uap task run UAP-TASK-20261112152056-bebdfcbb | 0 | 2026-11-12T15:20:57.080Z | HASH_OK |
| UAP-EV-20261112152102-1a07fbe1 | workflow_step | workflow:security_scan | 0 | 2026-11-12T15:21:02.661Z | HASH_OK |
| UAP-EV-20261112152102-23fe057a | workflow_step | workflow:typecheck | 0 | 2026-11-12T15:21:02.465Z | HASH_OK |
| UAP-EV-20261112152102-2a69a942 | workflow_step | workflow:unit_tests | 0 | 2026-11-12T15:21:02.487Z | HASH_OK |
| UAP-EV-20261112152102-54f0fec1 | workflow_step | workflow:dependency_scan | 0 | 2026-11-12T15:21:02.773Z | HASH_OK |
| UAP-EV-20261112152102-6240a7b1 | workflow_step | workflow:end_to_end_tests | 0 | 2026-11-12T15:21:02.528Z | HASH_OK |
| UAP-EV-20261112152102-73767eba | task_step | step:security_scan | 0 | 2026-11-12T15:21:02.662Z | HASH_OK |
| UAP-EV-20261112152102-85a055d7 | task_step | step:dependency_scan | 0 | 2026-11-12T15:21:02.774Z | HASH_OK |
| UAP-EV-20261112152102-941371f1 | task_step | step:end_to_end_tests | 0 | 2026-11-12T15:21:02.529Z | HASH_OK |
| UAP-EV-20261112152102-b44a6ab1 | workflow_step | workflow:integration_tests | 0 | 2026-11-12T15:21:02.510Z | HASH_OK |
| UAP-EV-20261112152102-b8113fc9 | task_step | step:unit_tests | 0 | 2026-11-12T15:21:02.489Z | HASH_OK |
| UAP-EV-20261112152102-cfe6884b | task_step | step:typecheck | 0 | 2026-11-12T15:21:02.465Z | HASH_OK |
| UAP-EV-20261112152102-e16995eb | task_step | step:integration_tests | 0 | 2026-11-12T15:21:02.510Z | HASH_OK |
| UAP-EV-20261112152102-f771818c | task_step | step:lint | 0 | 2026-11-12T15:21:02.444Z | HASH_OK |
| UAP-EV-20261112152102-f97130d9 | workflow_step | workflow:lint | 0 | 2026-11-12T15:21:02.443Z | HASH_OK |
| UAP-EV-20261112152107-25fc856f | task_step | step:build | 0 | 2026-11-12T15:21:07.904Z | HASH_OK |
| UAP-EV-20261112152107-2fba77a7 | task_result | uap task run UAP-TASK-20261112152057-0316a361 | 0 | 2026-11-12T15:21:07.998Z | HASH_OK |
| UAP-EV-20261112152107-92530dd9 | workflow_step | workflow:build | 0 | 2026-11-12T15:21:07.903Z | HASH_OK |
| UAP-EV-20261112152107-aa638eb7 | task_step | step:code_review | 0 | 2026-11-12T15:21:07.930Z | HASH_OK |
| UAP-EV-20261112152107-febde515 | workflow_step | workflow:code_review | 0 | 2026-11-12T15:21:07.929Z | HASH_OK |
| UAP-EV-20261112152108-00a94c59 | task_step | step:inspect_refund_state_machine | 0 | 2026-11-12T15:21:08.101Z | HASH_OK |
| UAP-EV-20261112152108-0b814b96 | task_result | uap task run UAP-TASK-20261112152108-13b9aef4 | 0 | 2026-11-12T15:21:08.282Z | HASH_OK |
| UAP-EV-20261112152108-117d2d27 | task_step | step:validate_all_validators | 0 | 2026-11-12T15:21:08.450Z | HASH_OK |
| UAP-EV-20261112152108-1250416c | workflow_step | workflow:test_idempotency | 0 | 2026-11-12T15:21:08.143Z | HASH_OK |
| UAP-EV-20261112152108-147c58c9 | workflow_step | workflow:run_full_quality_gate | 0 | 2026-11-12T15:21:08.475Z | HASH_OK |
| UAP-EV-20261112152108-200fd672 | task_step | step:test_concurrency | 0 | 2026-11-12T15:21:08.165Z | HASH_OK |
| UAP-EV-20261112152108-2d7c0d63 | cli_command | uap workflow run --all | 0 | 2026-11-12T15:21:08.624Z | HASH_OK |
| UAP-EV-20261112152108-33eec30a | task_step | step:test_failure_recovery | 0 | 2026-11-12T15:21:08.209Z | HASH_OK |
| UAP-EV-20261112152108-36b8c85c | workflow_step | workflow:validate_all_specifications | 0 | 2026-11-12T15:21:08.367Z | HASH_OK |
| UAP-EV-20261112152108-4243e8b7 | workflow_step | workflow:test_failure_recovery | 0 | 2026-11-12T15:21:08.209Z | HASH_OK |
| UAP-EV-20261112152108-44bc6b13 | workflow_step | workflow:inspect_balance_ledger | 0 | 2026-11-12T15:21:08.122Z | HASH_OK |
| UAP-EV-20261112152108-44ec3e70 | workflow_step | workflow:inspect_payment_state_machine | 0 | 2026-11-12T15:21:08.083Z | HASH_OK |
| UAP-EV-20261112152108-52b992c3 | workflow_step | workflow:validate_all_agents | 0 | 2026-11-12T15:21:08.411Z | HASH_OK |
| UAP-EV-20261112152108-5a7dd747 | workflow_step | workflow:validate_all_workflows | 0 | 2026-11-12T15:21:08.431Z | HASH_OK |
| UAP-EV-20261112152108-5e960a80 | task_step | step:run_end_to_end_workflows | 0 | 2026-11-12T15:21:08.495Z | HASH_OK |
| UAP-EV-20261112152108-6e392fa4 | workflow_step | workflow:validate_all_validators | 0 | 2026-11-12T15:21:08.449Z | HASH_OK |
| UAP-EV-20261112152108-6efca17e | workflow_step | workflow:verify_recovery | 0 | 2026-11-12T15:21:08.515Z | HASH_OK |
| UAP-EV-20261112152108-75cadaf6 | task_step | step:verify_reconciliation | 0 | 2026-11-12T15:21:08.229Z | HASH_OK |
| UAP-EV-20261112152108-7e074839 | task_step | step:validate_all_specifications | 0 | 2026-11-12T15:21:08.367Z | HASH_OK |
| UAP-EV-20261112152108-88565046 | task_step | step:test_duplicate_notifications | 0 | 2026-11-12T15:21:08.188Z | HASH_OK |
| UAP-EV-20261112152108-8f22ba1a | task_result | uap task run UAP-TASK-20261112152108-eac30954 | 0 | 2026-11-12T15:21:08.594Z | HASH_OK |
| UAP-EV-20261112152108-94fd16d2 | workflow_step | workflow:test_concurrency | 0 | 2026-11-12T15:21:08.164Z | HASH_OK |
| UAP-EV-20261112152108-95d65419 | task_step | step:test_idempotency | 0 | 2026-11-12T15:21:08.143Z | HASH_OK |
| UAP-EV-20261112152108-9cf09de7 | workflow_step | workflow:test_duplicate_notifications | 0 | 2026-11-12T15:21:08.188Z | HASH_OK |
| UAP-EV-20261112152108-a47625e6 | workflow_step | workflow:verify_reconciliation | 0 | 2026-11-12T15:21:08.228Z | HASH_OK |
| UAP-EV-20261112152108-b4cacae7 | task_step | step:validate_all_agents | 0 | 2026-11-12T15:21:08.412Z | HASH_OK |
| UAP-EV-20261112152108-bbbffc4f | task_step | step:inspect_balance_ledger | 0 | 2026-11-12T15:21:08.123Z | HASH_OK |
| UAP-EV-20261112152108-ca9166e6 | workflow_step | workflow:validate_all_executors | 0 | 2026-11-12T15:21:08.388Z | HASH_OK |
| UAP-EV-20261112152108-ccb711cf | task_step | step:verify_recovery | 0 | 2026-11-12T15:21:08.515Z | HASH_OK |
| UAP-EV-20261112152108-cfa2912e | task_step | step:validate_all_executors | 0 | 2026-11-12T15:21:08.388Z | HASH_OK |
| UAP-EV-20261112152108-d07535d8 | task_step | step:generate_final_report | 0 | 2026-11-12T15:21:08.541Z | HASH_OK |
| UAP-EV-20261112152108-d0b5becb | task_step | step:validate_all_workflows | 0 | 2026-11-12T15:21:08.431Z | HASH_OK |
| UAP-EV-20261112152108-d603f595 | task_step | step:inspect_payment_state_machine | 0 | 2026-11-12T15:21:08.083Z | HASH_OK |
| UAP-EV-20261112152108-d609c46f | workflow_step | workflow:run_end_to_end_workflows | 0 | 2026-11-12T15:21:08.495Z | HASH_OK |
| UAP-EV-20261112152108-f0303726 | workflow_step | workflow:generate_final_report | 0 | 2026-11-12T15:21:08.537Z | HASH_OK |
| UAP-EV-20261112152108-f6206afd | task_step | step:run_full_quality_gate | 0 | 2026-11-12T15:21:08.476Z | HASH_OK |
| UAP-EV-20261112152108-f752a90a | workflow_step | workflow:inspect_refund_state_machine | 0 | 2026-11-12T15:21:08.101Z | HASH_OK |
| UAP-EV-20261112152109-009a37b4 | task_step | step:probe.step1 | 0 | 2026-11-12T15:21:09.907Z | HASH_OK |
| UAP-EV-20261112152109-31994f98 | task_step | step:probe.step2 | 0 | 2026-11-12T15:21:09.993Z | HASH_OK |
| UAP-EV-20261112152109-458f8112 | health_probe | evidence-engine.health() | 0 | 2026-11-12T15:21:09.619Z | HASH_OK |
| UAP-EV-20261112152109-4ce5d51a | recovery | uap task resume UAP-TASK-INTERRUPT-20261112152109-10b289aa | 0 | 2026-11-12T15:21:09.953Z | HASH_OK |
| UAP-EV-20261112152109-7b69c0d8 | task_result | uap task run UAP-TASK-HEALTH-20261112152109-a09ccc9e | 0 | 2026-11-12T15:21:09.185Z | HASH_OK |
| UAP-EV-20261112152109-8782f7b2 | task_result | uap task run UAP-TASK-INTERRUPT-20261112152109-e3fe2c73 | 0 | 2026-11-12T15:21:09.578Z | HASH_OK |
| UAP-EV-20261112152109-9118a715 | task_step | step:probe.step2 | 0 | 2026-11-12T15:21:09.502Z | HASH_OK |
| UAP-EV-20261112152109-92f1f7ae | task_step | step:probe.step3 | 0 | 2026-11-12T15:21:09.523Z | HASH_OK |
| UAP-EV-20261112152109-982374b1 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112152109-e3fe2c73 | 0 | 2026-11-12T15:21:09.614Z | HASH_OK |
| UAP-EV-20261112152109-9a2d8138 | task_step | step:__health_step__ | 0 | 2026-11-12T15:21:09.131Z | HASH_OK |
| UAP-EV-20261112152109-ce1bab5a | recovery | uap task resume UAP-TASK-INTERRUPT-20261112152109-e3fe2c73 | 0 | 2026-11-12T15:21:09.467Z | HASH_OK |
| UAP-EV-20261112152109-e1f2f88e | task_step | step:probe.step1 | 0 | 2026-11-12T15:21:09.418Z | HASH_OK |
| UAP-EV-20261112152110-0bfceaf2 | workflow_step | workflow:validate_environment | 0 | 2026-11-12T15:21:10.430Z | HASH_OK |
| UAP-EV-20261112152110-19c482c9 | workflow_step | workflow:test_concurrency | 0 | 2026-11-12T15:21:10.577Z | HASH_OK |
| UAP-EV-20261112152110-31cb1174 | task_step | step:inspect_refund_state_machine | 0 | 2026-11-12T15:21:10.513Z | HASH_OK |
| UAP-EV-20261112152110-34c6d50a | task_step | step:test_failure_recovery | 0 | 2026-11-12T15:21:10.623Z | HASH_OK |
| UAP-EV-20261112152110-3a085661 | workflow_step | workflow:inspect_payment_state_machine | 0 | 2026-11-12T15:21:10.491Z | HASH_OK |
| UAP-EV-20261112152110-3fec2fbb | task_step | step:test_idempotency | 0 | 2026-11-12T15:21:10.555Z | HASH_OK |
| UAP-EV-20261112152110-46a39246 | workflow_step | workflow:verify_reconciliation | 0 | 2026-11-12T15:21:10.646Z | HASH_OK |
| UAP-EV-20261112152110-4a6a0da4 | task_step | step:verify_reconciliation | 0 | 2026-11-12T15:21:10.647Z | HASH_OK |
| UAP-EV-20261112152110-5bdb31b2 | task_result | uap task run UAP-TASK-TEST-20261112152110-acba6896 | 0 | 2026-11-12T15:21:10.213Z | HASH_OK |
| UAP-EV-20261112152110-604d026c | task_step | step:inspect_payment_state_machine | 0 | 2026-11-12T15:21:10.491Z | HASH_OK |
| UAP-EV-20261112152110-63666fb4 | cli_command | uap test --all | 0 | 2026-11-12T15:21:10.806Z | HASH_OK |
| UAP-EV-20261112152110-74825329 | task_step | step:__uap_test_retry_then_ok__ | 0 | 2026-11-12T15:21:10.158Z | HASH_OK |
| UAP-EV-20261112152110-7b9ae1b4 | task_step | step:__uap_test_always_fail__ | 1 | 2026-11-12T15:21:10.287Z | HASH_OK |
| UAP-EV-20261112152110-90bcd1cf | workflow_step | workflow:inspect_refund_state_machine | 0 | 2026-11-12T15:21:10.513Z | HASH_OK |
| UAP-EV-20261112152110-96c03b97 | task_step | step:probe.step3 | 0 | 2026-11-12T15:21:10.013Z | HASH_OK |
| UAP-EV-20261112152110-a2e17881 | workflow_step | workflow:inspect_balance_ledger | 0 | 2026-11-12T15:21:10.536Z | HASH_OK |
| UAP-EV-20261112152110-a4c6027a | task_result | uap task run UAP-TASK-TEST-20261112152110-f015747d | 1 | 2026-11-12T15:21:10.341Z | HASH_OK |
| UAP-EV-20261112152110-a5e71753 | runtime_test_run | node --test .uap/tests/runtime.test.mjs | 0 | 2026-11-12T15:21:10.804Z | HASH_OK |
| UAP-EV-20261112152110-b158f924 | workflow_step | workflow:test_failure_recovery | 0 | 2026-11-12T15:21:10.623Z | HASH_OK |
| UAP-EV-20261112152110-c1851bf5 | task_result | uap task run UAP-TASK-INTERRUPT-20261112152109-10b289aa | 0 | 2026-11-12T15:21:10.073Z | HASH_OK |
| UAP-EV-20261112152110-c2ab3687 | task_step | step:test_concurrency | 0 | 2026-11-12T15:21:10.578Z | HASH_OK |
| UAP-EV-20261112152110-c53d5194 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112152109-10b289aa | 0 | 2026-11-12T15:21:10.109Z | HASH_OK |
| UAP-EV-20261112152110-d6327efe | workflow_step | workflow:test_duplicate_notifications | 0 | 2026-11-12T15:21:10.602Z | HASH_OK |
| UAP-EV-20261112152110-dd6c2cbd | task_step | step:test_duplicate_notifications | 0 | 2026-11-12T15:21:10.603Z | HASH_OK |
| UAP-EV-20261112152110-df2ba535 | task_step | step:inspect_balance_ledger | 0 | 2026-11-12T15:21:10.536Z | HASH_OK |
| UAP-EV-20261112152110-e195868a | task_result | uap task run UAP-TASK-20261112152110-4ca56f2d | 0 | 2026-11-12T15:21:10.699Z | HASH_OK |
| UAP-EV-20261112152110-ff8d48c3 | workflow_step | workflow:test_idempotency | 0 | 2026-11-12T15:21:10.555Z | HASH_OK |
| UAP-EV-20261112152129-1c65a963 | cli_command | uap report --final | 0 | 2026-11-12T15:21:29.878Z | HASH_OK |
| UAP-EV-20261112152130-d24fd399 | cli_command | uap release check | 1 | 2026-11-12T15:21:30.079Z | HASH_OK |
| UAP-EV-20261112152323-0c52f129 | validator_result | uap validate product.requirement_traceability | 0 | 2026-11-12T15:23:23.586Z | HASH_OK |
| UAP-EV-20261112152323-147be1f7 | validator_result | uap validate architecture.adr_integrity | 0 | 2026-11-12T15:23:23.634Z | HASH_OK |
| UAP-EV-20261112152323-181e6a7c | validator_result | uap validate agents.recovery_integrity | 0 | 2026-11-12T15:23:23.979Z | HASH_OK |
| UAP-EV-20261112152323-1953b770 | validator_result | uap validate core.execution_integrity | 0 | 2026-11-12T15:23:23.411Z | HASH_OK |
| UAP-EV-20261112152323-293b9dda | validator_result | uap validate agents.execution_integrity | 0 | 2026-11-12T15:23:23.856Z | HASH_OK |
| UAP-EV-20261112152323-2ad767e6 | validator_result | uap validate product.prototype_consistency | 0 | 2026-11-12T15:23:23.606Z | HASH_OK |
| UAP-EV-20261112152323-47f9e428 | validator_result | uap validate agents.collaboration_integrity | 0 | 2026-11-12T15:23:23.859Z | HASH_OK |
| UAP-EV-20261112152323-5ab64a46 | validator_result | uap validate architecture.consistency | 0 | 2026-11-12T15:23:23.627Z | HASH_OK |
| UAP-EV-20261112152323-6d3a80c7 | validator_result | uap validate agents.registry_integrity | 0 | 2026-11-12T15:23:23.637Z | HASH_OK |
| UAP-EV-20261112152323-7ec9ba70 | validator_result | uap validate product.business_rule_integrity | 0 | 2026-11-12T15:23:23.620Z | HASH_OK |
| UAP-EV-20261112152323-8d8789c4 | validator_result | uap validate architecture.api_database_integrity | 0 | 2026-11-12T15:23:23.631Z | HASH_OK |
| UAP-EV-20261112152323-a73f341c | validator_result | uap validate core.evidence_integrity | 0 | 2026-11-12T15:23:23.568Z | HASH_OK |
| UAP-EV-20261112152323-c69d35ae | validator_result | uap validate security.permission_boundary | 0 | 2026-11-12T15:23:23.435Z | HASH_OK |
| UAP-EV-20261112152323-fb634e7c | validator_result | uap validate core.architecture_integrity | 0 | 2026-11-12T15:23:23.287Z | HASH_OK |
| UAP-EV-20261112152325-10c4af97 | validator_result | uap validate quality.repair_integrity | 0 | 2026-11-12T15:23:25.484Z | HASH_OK |
| UAP-EV-20261112152325-181949f2 | validator_result | uap validate security.financial_integrity_validator | 0 | 2026-11-12T15:23:25.897Z | HASH_OK |
| UAP-EV-20261112152325-4d8c58f3 | validator_result | uap validate quality.engineering_integrity | 0 | 2026-11-12T15:23:25.369Z | HASH_OK |
| UAP-EV-20261112152325-552ab799 | validator_result | uap validate security.application_integrity | 0 | 2026-11-12T15:23:25.895Z | HASH_OK |
| UAP-EV-20261112152325-afb190b3 | validator_result | uap validate development.dependency_integrity | 0 | 2026-11-12T15:23:25.256Z | HASH_OK |
| UAP-EV-20261112152325-ba015358 | validator_result | uap validate development.coding_compliance | 0 | 2026-11-12T15:23:25.136Z | HASH_OK |
| UAP-EV-20261112152325-c73916e9 | validator_result | uap validate development.review_integrity | 0 | 2026-11-12T15:23:25.254Z | HASH_OK |
| UAP-EV-20261112152325-d731ad86 | validator_result | uap validate quality.test_integrity | 0 | 2026-11-12T15:23:25.371Z | HASH_OK |
| UAP-EV-20261112152325-fee15c1b | validator_result | uap validate quality.gate_integrity | 0 | 2026-11-12T15:23:25.615Z | HASH_OK |
| UAP-EV-20261112152326-00bc8a1e | validator_result | uap validate evolution.knowledge_integrity | 0 | 2026-11-12T15:23:26.678Z | HASH_OK |
| UAP-EV-20261112152326-1cbe2415 | validator_result | uap validate security.reliability_integrity | 0 | 2026-11-12T15:23:26.035Z | HASH_OK |
| UAP-EV-20261112152326-701b894f | validator_result | uap validate cross_platform.web_integrity | 0 | 2026-11-12T15:23:26.224Z | HASH_OK |
| UAP-EV-20261112152326-861eaa4b | validator_result | uap validate cross_platform.consistency_integrity | 0 | 2026-11-12T15:23:26.381Z | HASH_OK |
| UAP-EV-20261112152326-92f48a06 | validator_result | uap validate cross_platform.h5_integrity | 1 | 2026-11-12T15:23:26.337Z | HASH_OK |
| UAP-EV-20261112152326-984a1605 | cli_command | uap audit | 0 | 2026-11-12T15:23:26.821Z | HASH_OK |
| UAP-EV-20261112152326-b34cbe6a | validator_result | uap validate delivery.ci_integrity | 0 | 2026-11-12T15:23:26.385Z | HASH_OK |
| UAP-EV-20261112152326-dfa77272 | validator_result | uap validate evolution.evolution_integrity | 0 | 2026-11-12T15:23:26.782Z | HASH_OK |
| UAP-EV-20261112152326-f20fae31 | validator_result | uap validate delivery.deployment_integrity | 1 | 2026-11-12T15:23:26.387Z | HASH_OK |
| UAP-EV-20261112152326-f56a9ba6 | validator_result | uap validate delivery.observability_integrity | 0 | 2026-11-12T15:23:26.654Z | HASH_OK |
| UAP-EV-20261112152342-0a464920 | validator_result | uap validate core.architecture_integrity | 0 | 2026-11-12T15:23:42.453Z | HASH_OK |
| UAP-EV-20261112152342-376b6be3 | validator_result | uap validate product.requirement_traceability | 0 | 2026-11-12T15:23:42.741Z | HASH_OK |
| UAP-EV-20261112152342-480704bc | validator_result | uap validate security.permission_boundary | 0 | 2026-11-12T15:23:42.602Z | HASH_OK |
| UAP-EV-20261112152342-52555da7 | validator_result | uap validate architecture.consistency | 0 | 2026-11-12T15:23:42.784Z | HASH_OK |
| UAP-EV-20261112152342-574adce1 | validator_result | uap validate core.evidence_integrity | 0 | 2026-11-12T15:23:42.723Z | HASH_OK |
| UAP-EV-20261112152342-62a99a4d | validator_result | uap validate architecture.api_database_integrity | 0 | 2026-11-12T15:23:42.787Z | HASH_OK |
| UAP-EV-20261112152342-6f49d4ff | validator_result | uap validate core.execution_integrity | 0 | 2026-11-12T15:23:42.577Z | HASH_OK |
| UAP-EV-20261112152342-8253ca8f | validator_result | uap validate architecture.adr_integrity | 0 | 2026-11-12T15:23:42.790Z | HASH_OK |
| UAP-EV-20261112152342-b128da19 | validator_result | uap validate product.business_rule_integrity | 0 | 2026-11-12T15:23:42.777Z | HASH_OK |
| UAP-EV-20261112152342-b1b1302d | validator_result | uap validate product.prototype_consistency | 0 | 2026-11-12T15:23:42.761Z | HASH_OK |
| UAP-EV-20261112152342-e32688ad | validator_result | uap validate agents.registry_integrity | 0 | 2026-11-12T15:23:42.794Z | HASH_OK |
| UAP-EV-20261112152343-23a308e2 | validator_result | uap validate agents.recovery_integrity | 0 | 2026-11-12T15:23:43.138Z | HASH_OK |
| UAP-EV-20261112152343-8bcaa27b | validator_result | uap validate agents.collaboration_integrity | 0 | 2026-11-12T15:23:43.018Z | HASH_OK |
| UAP-EV-20261112152343-fa603a1f | validator_result | uap validate agents.execution_integrity | 0 | 2026-11-12T15:23:43.014Z | HASH_OK |
| UAP-EV-20261112152344-17025523 | validator_result | uap validate development.dependency_integrity | 0 | 2026-11-12T15:23:44.399Z | HASH_OK |
| UAP-EV-20261112152344-2d2ada68 | validator_result | uap validate development.coding_compliance | 0 | 2026-11-12T15:23:44.283Z | HASH_OK |
| UAP-EV-20261112152344-43c5fc19 | validator_result | uap validate quality.test_integrity | 0 | 2026-11-12T15:23:44.510Z | HASH_OK |
| UAP-EV-20261112152344-67a1e737 | validator_result | uap validate quality.engineering_integrity | 0 | 2026-11-12T15:23:44.508Z | HASH_OK |
| UAP-EV-20261112152344-cc4d9f1c | validator_result | uap validate development.review_integrity | 0 | 2026-11-12T15:23:44.397Z | HASH_OK |
| UAP-EV-20261112152344-dc38b031 | validator_result | uap validate quality.repair_integrity | 0 | 2026-11-12T15:23:44.622Z | HASH_OK |
| UAP-EV-20261112152344-fabbde7a | validator_result | uap validate quality.gate_integrity | 0 | 2026-11-12T15:23:44.743Z | HASH_OK |
| UAP-EV-20261112152345-152e77d3 | validator_result | uap validate cross_platform.web_integrity | 0 | 2026-11-12T15:23:45.337Z | HASH_OK |
| UAP-EV-20261112152345-19775d98 | validator_result | uap validate delivery.ci_integrity | 0 | 2026-11-12T15:23:45.493Z | HASH_OK |
| UAP-EV-20261112152345-20c562f2 | validator_result | uap validate security.application_integrity | 0 | 2026-11-12T15:23:45.018Z | HASH_OK |
| UAP-EV-20261112152345-26d0ef26 | validator_result | uap validate delivery.deployment_integrity | 1 | 2026-11-12T15:23:45.496Z | HASH_OK |
| UAP-EV-20261112152345-3bbd3821 | validator_result | uap validate cross_platform.h5_integrity | 1 | 2026-11-12T15:23:45.448Z | HASH_OK |
| UAP-EV-20261112152345-4afd6f43 | validator_result | uap validate evolution.knowledge_integrity | 0 | 2026-11-12T15:23:45.755Z | HASH_OK |
| UAP-EV-20261112152345-8f442a04 | validator_result | uap validate delivery.observability_integrity | 0 | 2026-11-12T15:23:45.736Z | HASH_OK |
| UAP-EV-20261112152345-b303b830 | validator_result | uap validate evolution.evolution_integrity | 0 | 2026-11-12T15:23:45.859Z | HASH_OK |
| UAP-EV-20261112152345-bc40de20 | validator_result | uap validate security.financial_integrity_validator | 0 | 2026-11-12T15:23:45.020Z | HASH_OK |
| UAP-EV-20261112152345-d10f234a | validator_result | uap validate security.reliability_integrity | 0 | 2026-11-12T15:23:45.168Z | HASH_OK |
| UAP-EV-20261112152345-f04520b5 | cli_command | uap audit | 0 | 2026-11-12T15:23:45.896Z | HASH_OK |
| UAP-EV-20261112152345-f0a0bf7f | validator_result | uap validate cross_platform.consistency_integrity | 0 | 2026-11-12T15:23:45.490Z | HASH_OK |
| UAP-EV-20261112152358-14ed9fb6 | cli_command | uap repair | 0 | 2026-11-12T15:23:58.416Z | HASH_OK |
| UAP-EV-20261112152358-930b5337 | cli_command | uap test --all | 3 | 2026-11-12T15:23:58.965Z | HASH_OK |
| UAP-EV-20261112152358-a7b6692b | cli_command | uap validate --all | 3 | 2026-11-12T15:23:58.602Z | HASH_OK |
| UAP-EV-20261112152358-cf004fdd | cli_command | uap workflow run --all | 3 | 2026-11-12T15:23:58.775Z | HASH_OK |
| UAP-EV-20261112152359-1021ebd9 | cli_command | uap status | 0 | 2026-11-12T15:23:59.697Z | HASH_OK |
| UAP-EV-20261112152359-3818ba88 | cli_command | uap report --final | 3 | 2026-11-12T15:23:59.138Z | HASH_OK |
| UAP-EV-20261112152359-6ee6a79c | cli_command | uap release check | 3 | 2026-11-12T15:23:59.312Z | HASH_OK |
| UAP-EV-20261112152409-57d64f3e | cli_command | uap repair | 0 | 2026-11-12T15:24:09.696Z | HASH_OK |
| UAP-EV-20261112152410-00bc4d49 | validator_result | uap validate agents.execution_integrity | 0 | 2026-11-12T15:24:10.823Z | HASH_OK |
| UAP-EV-20261112152410-00ec2605 | validator_result | uap validate agents.collaboration_integrity | 0 | 2026-11-12T15:24:10.838Z | HASH_OK |
| UAP-EV-20261112152410-344f6413 | validator_result | uap validate agents.registry_integrity | 0 | 2026-11-12T15:24:10.578Z | HASH_OK |
| UAP-EV-20261112152410-42070a24 | validator_result | uap validate architecture.consistency | 0 | 2026-11-12T15:24:10.528Z | HASH_OK |
| UAP-EV-20261112152410-5b145aaf | validator_result | uap validate core.architecture_integrity | 0 | 2026-11-12T15:24:10.082Z | HASH_OK |
| UAP-EV-20261112152410-74fac57c | validator_result | uap validate core.evidence_integrity | 0 | 2026-11-12T15:24:10.406Z | HASH_OK |
| UAP-EV-20261112152410-826f7ae2 | validator_result | uap validate core.execution_integrity | 0 | 2026-11-12T15:24:10.229Z | HASH_OK |
| UAP-EV-20261112152410-9d1ab0b9 | validator_result | uap validate security.permission_boundary | 0 | 2026-11-12T15:24:10.270Z | HASH_OK |
| UAP-EV-20261112152410-a0458fa2 | validator_result | uap validate product.requirement_traceability | 0 | 2026-11-12T15:24:10.438Z | HASH_OK |
| UAP-EV-20261112152410-a3c0267e | validator_result | uap validate agents.recovery_integrity | 0 | 2026-11-12T15:24:10.969Z | HASH_OK |
| UAP-EV-20261112152410-c6df3868 | validator_result | uap validate architecture.adr_integrity | 0 | 2026-11-12T15:24:10.560Z | HASH_OK |
| UAP-EV-20261112152410-c91b5689 | validator_result | uap validate product.business_rule_integrity | 0 | 2026-11-12T15:24:10.507Z | HASH_OK |
| UAP-EV-20261112152410-eef8fea1 | validator_result | uap validate architecture.api_database_integrity | 0 | 2026-11-12T15:24:10.545Z | HASH_OK |
| UAP-EV-20261112152410-f80ea586 | validator_result | uap validate product.prototype_consistency | 0 | 2026-11-12T15:24:10.475Z | HASH_OK |
| UAP-EV-20261112152412-00ef3e82 | validator_result | uap validate quality.engineering_integrity | 0 | 2026-11-12T15:24:12.391Z | HASH_OK |
| UAP-EV-20261112152412-0e935d8f | validator_result | uap validate development.coding_compliance | 0 | 2026-11-12T15:24:12.122Z | HASH_OK |
| UAP-EV-20261112152412-20d91aaa | validator_result | uap validate development.review_integrity | 0 | 2026-11-12T15:24:12.255Z | HASH_OK |
| UAP-EV-20261112152412-2310a40b | validator_result | uap validate quality.gate_integrity | 0 | 2026-11-12T15:24:12.677Z | HASH_OK |
| UAP-EV-20261112152412-74510634 | validator_result | uap validate quality.repair_integrity | 0 | 2026-11-12T15:24:12.543Z | HASH_OK |
| UAP-EV-20261112152412-7714bd44 | validator_result | uap validate development.dependency_integrity | 0 | 2026-11-12T15:24:12.273Z | HASH_OK |
| UAP-EV-20261112152412-79445704 | validator_result | uap validate quality.test_integrity | 0 | 2026-11-12T15:24:12.406Z | HASH_OK |
| UAP-EV-20261112152412-d02e7902 | validator_result | uap validate security.application_integrity | 0 | 2026-11-12T15:24:12.974Z | HASH_OK |
| UAP-EV-20261112152412-dcad079b | validator_result | uap validate security.financial_integrity_validator | 0 | 2026-11-12T15:24:12.988Z | HASH_OK |
| UAP-EV-20261112152413-2c5ad7a1 | validator_result | uap validate security.reliability_integrity | 0 | 2026-11-12T15:24:13.141Z | HASH_OK |
| UAP-EV-20261112152413-4fe73104 | cli_command | uap validate --all | 2 | 2026-11-12T15:24:13.988Z | HASH_OK |
| UAP-EV-20261112152413-7d290cca | validator_result | uap validate delivery.deployment_integrity | 1 | 2026-11-12T15:24:13.550Z | HASH_OK |
| UAP-EV-20261112152413-89295569 | validator_result | uap validate delivery.ci_integrity | 0 | 2026-11-12T15:24:13.534Z | HASH_OK |
| UAP-EV-20261112152413-937043d3 | validator_result | uap validate evolution.evolution_integrity | 0 | 2026-11-12T15:24:13.968Z | HASH_OK |
| UAP-EV-20261112152413-a852f814 | validator_result | uap validate evolution.knowledge_integrity | 0 | 2026-11-12T15:24:13.847Z | HASH_OK |
| UAP-EV-20261112152413-cccdb3ea | validator_result | uap validate delivery.observability_integrity | 0 | 2026-11-12T15:24:13.813Z | HASH_OK |
| UAP-EV-20261112152413-d451ec5c | validator_result | uap validate cross_platform.h5_integrity | 1 | 2026-11-12T15:24:13.455Z | HASH_OK |
| UAP-EV-20261112152413-e59d5771 | validator_result | uap validate cross_platform.consistency_integrity | 0 | 2026-11-12T15:24:13.516Z | HASH_OK |
| UAP-EV-20261112152413-e778d647 | validator_result | uap validate cross_platform.web_integrity | 0 | 2026-11-12T15:24:13.334Z | HASH_OK |
| UAP-EV-20261112152414-015ccffb | recovery | uap task resume UAP-TASK-INTERRUPT-20261112152414-8164601d | 0 | 2026-11-12T15:24:14.939Z | HASH_OK |
| UAP-EV-20261112152414-06893010 | task_result | uap task run UAP-TASK-HEALTH-20261112152414-a5408eec | 0 | 2026-11-12T15:24:14.645Z | HASH_OK |
| UAP-EV-20261112152414-37d4caa5 | task_step | step:probe.step2 | 0 | 2026-11-12T15:24:14.975Z | HASH_OK |
| UAP-EV-20261112152414-39bf1575 | task_step | step:__health_step__ | 0 | 2026-11-12T15:24:14.586Z | HASH_OK |
| UAP-EV-20261112152414-64abeb5a | task_step | step:probe.step3 | 0 | 2026-11-12T15:24:14.993Z | HASH_OK |
| UAP-EV-20261112152414-704da32c | workflow_step | workflow:validate_environment | 0 | 2026-11-12T15:24:14.448Z | HASH_OK |
| UAP-EV-20261112152414-94abd905 | task_step | step:validate_specification_registry | 0 | 2026-11-12T15:24:14.504Z | HASH_OK |
| UAP-EV-20261112152414-9a37588b | workflow_step | workflow:validate_specification_registry | 0 | 2026-11-12T15:24:14.503Z | HASH_OK |
| UAP-EV-20261112152414-a7a7b02d | task_step | step:validate_environment | 0 | 2026-11-12T15:24:14.448Z | HASH_OK |
| UAP-EV-20261112152414-af42d256 | task_step | step:inspect_repository | 0 | 2026-11-12T15:24:14.376Z | HASH_OK |
| UAP-EV-20261112152414-cdd32623 | workflow_step | workflow:inspect_repository | 0 | 2026-11-12T15:24:14.375Z | HASH_OK |
| UAP-EV-20261112152414-dfb196c1 | workflow_step | workflow:initialize_uap_structure | 0 | 2026-11-12T15:24:14.474Z | HASH_OK |
| UAP-EV-20261112152414-ea200ab6 | task_step | step:probe.step1 | 0 | 2026-11-12T15:24:14.889Z | HASH_OK |
| UAP-EV-20261112152414-fa901ede | task_step | step:initialize_uap_structure | 0 | 2026-11-12T15:24:14.474Z | HASH_OK |
| UAP-EV-20261112152415-03c4bf74 | health_probe | evidence-engine.health() | 0 | 2026-11-12T15:24:15.092Z | HASH_OK |
| UAP-EV-20261112152415-14431d91 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112152415-00c1da89 | 0 | 2026-11-12T15:24:15.847Z | HASH_OK |
| UAP-EV-20261112152415-212efb9c | workflow_step | workflow:initialize_runtime | 0 | 2026-11-12T15:24:15.111Z | HASH_OK |
| UAP-EV-20261112152415-37ef50df | task_step | step:probe.step1 | 0 | 2026-11-12T15:24:15.798Z | HASH_OK |
| UAP-EV-20261112152415-3b2a16a8 | task_result | uap task run UAP-TASK-HEALTH-20261112152415-4176dfde | 0 | 2026-11-12T15:24:15.542Z | HASH_OK |
| UAP-EV-20261112152415-78291d72 | task_result | uap task run UAP-TASK-INTERRUPT-20261112152415-00c1da89 | 0 | 2026-11-12T15:24:15.964Z | HASH_OK |
| UAP-EV-20261112152415-7cb67247 | task_step | step:probe.step3 | 0 | 2026-11-12T15:24:15.909Z | HASH_OK |
| UAP-EV-20261112152415-840fe296 | task_step | step:__health_step__ | 0 | 2026-11-12T15:24:15.480Z | HASH_OK |
| UAP-EV-20261112152415-a0275d6c | task_result | uap task run UAP-TASK-INTERRUPT-20261112152414-8164601d | 0 | 2026-11-12T15:24:15.048Z | HASH_OK |
| UAP-EV-20261112152415-eb850580 | task_step | step:initialize_runtime | 0 | 2026-11-12T15:24:15.111Z | HASH_OK |
| UAP-EV-20261112152415-f4dc3331 | task_step | step:probe.step2 | 0 | 2026-11-12T15:24:15.888Z | HASH_OK |
| UAP-EV-20261112152415-fc143d54 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112152414-8164601d | 0 | 2026-11-12T15:24:15.089Z | HASH_OK |
| UAP-EV-20261112152416-002adb5b | workflow_step | workflow:test_idempotency | 0 | 2026-11-12T15:24:16.974Z | HASH_OK |
| UAP-EV-20261112152416-02eae9d9 | task_step | step:__uap_test_always_fail__ | 1 | 2026-11-12T15:24:16.694Z | HASH_OK |
| UAP-EV-20261112152416-06b6757a | workflow_step | workflow:inspect_balance_ledger | 0 | 2026-11-12T15:24:16.951Z | HASH_OK |
| UAP-EV-20261112152416-0ff9b7ca | task_step | step:inspect_refund_state_machine | 0 | 2026-11-12T15:24:16.927Z | HASH_OK |
| UAP-EV-20261112152416-187f0d6c | task_result | uap task run UAP-TASK-TEST-20261112152416-27c0d960 | 1 | 2026-11-12T15:24:16.750Z | HASH_OK |
| UAP-EV-20261112152416-2058ecac | task_step | step:probe.step1 | 0 | 2026-11-12T15:24:16.309Z | HASH_OK |
| UAP-EV-20261112152416-281184c3 | task_step | step:inspect_payment_state_machine | 0 | 2026-11-12T15:24:16.905Z | HASH_OK |
| UAP-EV-20261112152416-292fd790 | task_result | uap task run UAP-TASK-INTERRUPT-20261112152416-fa468e6d | 0 | 2026-11-12T15:24:16.473Z | HASH_OK |
| UAP-EV-20261112152416-2d058a30 | task_step | step:__uap_test_retry_then_ok__ | 0 | 2026-11-12T15:24:16.559Z | HASH_OK |
| UAP-EV-20261112152416-31288b0e | task_step | step:inspect_balance_ledger | 0 | 2026-11-12T15:24:16.952Z | HASH_OK |
| UAP-EV-20261112152416-3482bbad | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112152416-fa468e6d | 0 | 2026-11-12T15:24:16.508Z | HASH_OK |
| UAP-EV-20261112152416-39ceca86 | workflow_step | workflow:test_concurrency | 0 | 2026-11-12T15:24:16.997Z | HASH_OK |
| UAP-EV-20261112152416-45041e5c | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112152415-00c1da89 | 0 | 2026-11-12T15:24:16.001Z | HASH_OK |
| UAP-EV-20261112152416-588d2cab | recovery | uap task resume UAP-TASK-INTERRUPT-20261112152416-fa468e6d | 0 | 2026-11-12T15:24:16.355Z | HASH_OK |
| UAP-EV-20261112152416-5fb71352 | task_step | step:probe.step3 | 0 | 2026-11-12T15:24:16.413Z | HASH_OK |
| UAP-EV-20261112152416-959d3b4f | task_result | uap task run UAP-TASK-TEST-20261112152416-cf564cdd | 0 | 2026-11-12T15:24:16.615Z | HASH_OK |
| UAP-EV-20261112152416-9660009d | task_step | step:test_concurrency | 0 | 2026-11-12T15:24:16.998Z | HASH_OK |
| UAP-EV-20261112152416-aa0074c9 | health_probe | evidence-engine.health() | 0 | 2026-11-12T15:24:16.007Z | HASH_OK |
| UAP-EV-20261112152416-ae4e9711 | workflow_step | workflow:inspect_payment_state_machine | 0 | 2026-11-12T15:24:16.904Z | HASH_OK |
| UAP-EV-20261112152416-b210c452 | workflow_step | workflow:validate_environment | 0 | 2026-11-12T15:24:16.845Z | HASH_OK |
| UAP-EV-20261112152416-cf726a17 | task_step | step:probe.step2 | 0 | 2026-11-12T15:24:16.395Z | HASH_OK |
| UAP-EV-20261112152416-de5d9a7d | task_step | step:test_idempotency | 0 | 2026-11-12T15:24:16.974Z | HASH_OK |
| UAP-EV-20261112152416-ea18356d | workflow_step | workflow:inspect_refund_state_machine | 0 | 2026-11-12T15:24:16.926Z | HASH_OK |
| UAP-EV-20261112152417-00508f90 | workflow_step | workflow:run_runtime_tests | 0 | 2026-11-12T15:24:17.231Z | HASH_OK |
| UAP-EV-20261112152417-0cf9032e | workflow_step | workflow:verify_reconciliation | 0 | 2026-11-12T15:24:17.068Z | HASH_OK |
| UAP-EV-20261112152417-0d2ff4ed | workflow_step | workflow:test_failure_recovery | 0 | 2026-11-12T15:24:17.040Z | HASH_OK |
| UAP-EV-20261112152417-0f5c7457 | workflow_step | workflow:implement_missing_capabilities | 0 | 2026-11-12T15:24:17.955Z | HASH_OK |
| UAP-EV-20261112152417-1433046a | task_result | uap task run UAP-TASK-20261112152414-470bed81 | 0 | 2026-11-12T15:24:17.291Z | HASH_OK |
| UAP-EV-20261112152417-17213b5e | task_step | step:build_defect_registry | 0 | 2026-11-12T15:24:17.763Z | HASH_OK |
| UAP-EV-20261112152417-2735d8a2 | task_step | step:scan_cross_platform | 0 | 2026-11-12T15:24:17.690Z | HASH_OK |
| UAP-EV-20261112152417-3167c61f | task_step | step:scan_agents | 0 | 2026-11-12T15:24:17.581Z | HASH_OK |
| UAP-EV-20261112152417-377ce211 | task_step | step:test_failure_recovery | 0 | 2026-11-12T15:24:17.041Z | HASH_OK |
| UAP-EV-20261112152417-40b7c714 | task_step | step:implement_missing_validators | 0 | 2026-11-12T15:24:17.982Z | HASH_OK |
| UAP-EV-20261112152417-42d51711 | workflow_step | workflow:build_defect_registry | 0 | 2026-11-12T15:24:17.762Z | HASH_OK |
| UAP-EV-20261112152417-46536bbd | task_step | step:resolve_dependencies | 0 | 2026-11-12T15:24:17.909Z | HASH_OK |
| UAP-EV-20261112152417-4691f932 | task_step | step:implement_missing_capabilities | 0 | 2026-11-12T15:24:17.956Z | HASH_OK |
| UAP-EV-20261112152417-4e6c5877 | task_step | step:scan_delivery | 0 | 2026-11-12T15:24:17.715Z | HASH_OK |
| UAP-EV-20261112152417-4f4d8884 | workflow_step | workflow:resolve_dependencies | 0 | 2026-11-12T15:24:17.909Z | HASH_OK |
| UAP-EV-20261112152417-5934db36 | task_step | step:scan_knowledge | 0 | 2026-11-12T15:24:17.738Z | HASH_OK |
| UAP-EV-20261112152417-5b91e494 | workflow_step | workflow:scan_architecture | 0 | 2026-11-12T15:24:17.554Z | HASH_OK |
| UAP-EV-20261112152417-62b133b4 | workflow_step | workflow:inspect_project | 0 | 2026-11-12T15:24:17.485Z | HASH_OK |
| UAP-EV-20261112152417-693ec1f6 | workflow_step | workflow:scan_quality | 0 | 2026-11-12T15:24:17.628Z | HASH_OK |
| UAP-EV-20261112152417-70d3a749 | workflow_step | workflow:create_execution_plan | 0 | 2026-11-12T15:24:17.933Z | HASH_OK |
| UAP-EV-20261112152417-732e5a65 | task_step | step:create_execution_plan | 0 | 2026-11-12T15:24:17.934Z | HASH_OK |
| UAP-EV-20261112152417-7ed47169 | task_result | uap task run UAP-TASK-20261112152416-45417e89 | 0 | 2026-11-12T15:24:17.127Z | HASH_OK |
| UAP-EV-20261112152417-7f009c9d | workflow_step | workflow:implement_missing_validators | 0 | 2026-11-12T15:24:17.981Z | HASH_OK |
| UAP-EV-20261112152417-80e8eb75 | workflow_step | workflow:test_duplicate_notifications | 0 | 2026-11-12T15:24:17.021Z | HASH_OK |
| UAP-EV-20261112152417-81a4218d | workflow_step | workflow:scan_agents | 0 | 2026-11-12T15:24:17.581Z | HASH_OK |
| UAP-EV-20261112152417-8e887d3b | task_step | step:run_runtime_tests | 0 | 2026-11-12T15:24:17.232Z | HASH_OK |
| UAP-EV-20261112152417-98cd2854 | task_step | step:scan_quality | 0 | 2026-11-12T15:24:17.628Z | HASH_OK |
| UAP-EV-20261112152417-99cd119c | task_step | step:scan_architecture | 0 | 2026-11-12T15:24:17.555Z | HASH_OK |
| UAP-EV-20261112152417-9dfc771c | workflow_step | workflow:scan_delivery | 0 | 2026-11-12T15:24:17.714Z | HASH_OK |
| UAP-EV-20261112152417-a054b71e | workflow_step | workflow:scan_development | 0 | 2026-11-12T15:24:17.603Z | HASH_OK |
| UAP-EV-20261112152417-abced5e0 | workflow_step | workflow:scan_requirements | 0 | 2026-11-12T15:24:17.528Z | HASH_OK |
| UAP-EV-20261112152417-af74afca | workflow_step | workflow:scan_security | 0 | 2026-11-12T15:24:17.649Z | HASH_OK |
| UAP-EV-20261112152417-b117487c | workflow_step | workflow:scan_knowledge | 0 | 2026-11-12T15:24:17.738Z | HASH_OK |
| UAP-EV-20261112152417-bbc8aa4d | task_step | step:scan_requirements | 0 | 2026-11-12T15:24:17.529Z | HASH_OK |
| UAP-EV-20261112152417-c49b0ea9 | task_step | step:scan_security | 0 | 2026-11-12T15:24:17.650Z | HASH_OK |
| UAP-EV-20261112152417-c5e29558 | workflow_step | workflow:scan_cross_platform | 0 | 2026-11-12T15:24:17.690Z | HASH_OK |
| UAP-EV-20261112152417-c8002b72 | task_step | step:verify_reconciliation | 0 | 2026-11-12T15:24:17.069Z | HASH_OK |
| UAP-EV-20261112152417-ea253036 | task_step | step:inspect_project | 0 | 2026-11-12T15:24:17.485Z | HASH_OK |
| UAP-EV-20261112152417-ed7eb5ab | task_step | step:test_duplicate_notifications | 0 | 2026-11-12T15:24:17.022Z | HASH_OK |
| UAP-EV-20261112152417-ef2db60b | task_result | uap task run UAP-TASK-20261112152417-22491855 | 0 | 2026-11-12T15:24:17.824Z | HASH_OK |
| UAP-EV-20261112152417-f321f700 | task_step | step:scan_development | 0 | 2026-11-12T15:24:17.604Z | HASH_OK |
| UAP-EV-20261112152418-024ace15 | task_result | uap task run UAP-TASK-INTERRUPT-20261112152418-7f63fe7a | 0 | 2026-11-12T15:24:18.533Z | HASH_OK |
| UAP-EV-20261112152418-030b1791 | workflow_step | workflow:generate_repair_plan | 0 | 2026-11-12T15:24:18.830Z | HASH_OK |
| UAP-EV-20261112152418-0fc61ba9 | task_step | step:probe.step3 | 0 | 2026-11-12T15:24:18.475Z | HASH_OK |
| UAP-EV-20261112152418-12a381c3 | task_step | step:calculate_impact | 0 | 2026-11-12T15:24:18.807Z | HASH_OK |
| UAP-EV-20261112152418-1750bd64 | task_step | step:persist_evidence | 0 | 2026-11-12T15:24:18.931Z | HASH_OK |
| UAP-EV-20261112152418-1b09be57 | workflow_step | workflow:run_regression | 0 | 2026-11-12T15:24:18.879Z | HASH_OK |
| UAP-EV-20261112152418-1ca24cf5 | task_step | step:probe.step1 | 0 | 2026-11-12T15:24:18.365Z | HASH_OK |
| UAP-EV-20261112152418-21807234 | workflow_step | workflow:classify_defect | 0 | 2026-11-12T15:24:18.760Z | HASH_OK |
| UAP-EV-20261112152418-21e4c71d | task_result | uap task run UAP-TASK-HEALTH-20261112152418-8e98636a | 0 | 2026-11-12T15:24:18.122Z | HASH_OK |
| UAP-EV-20261112152418-32c34cb1 | task_result | uap task run UAP-TASK-20261112152417-e45dc2e5 | 0 | 2026-11-12T15:24:18.675Z | HASH_OK |
| UAP-EV-20261112152418-359213c2 | workflow_step | workflow:integrate_runtime | 0 | 2026-11-12T15:24:18.591Z | HASH_OK |
| UAP-EV-20261112152418-3d00e286 | task_step | step:classify_defect | 0 | 2026-11-12T15:24:18.760Z | HASH_OK |
| UAP-EV-20261112152418-4c2f34c3 | task_step | step:identify_root_cause | 0 | 2026-11-12T15:24:18.783Z | HASH_OK |
| UAP-EV-20261112152418-55795810 | workflow_step | workflow:execute_targeted_tests | 0 | 2026-11-12T15:24:18.612Z | HASH_OK |
| UAP-EV-20261112152418-558fcb53 | task_result | uap task run UAP-TASK-20261112152418-ba1878fb | 0 | 2026-11-12T15:24:18.992Z | HASH_OK |
| UAP-EV-20261112152418-6955d00f | recovery | uap task resume UAP-TASK-INTERRUPT-20261112152418-7f63fe7a | 0 | 2026-11-12T15:24:18.414Z | HASH_OK |
| UAP-EV-20261112152418-74c50cd0 | workflow_step | workflow:calculate_impact | 0 | 2026-11-12T15:24:18.807Z | HASH_OK |
| UAP-EV-20261112152418-75616756 | task_step | step:integrate_runtime | 0 | 2026-11-12T15:24:18.591Z | HASH_OK |
| UAP-EV-20261112152418-81b01c42 | workflow_step | workflow:identify_root_cause | 0 | 2026-11-12T15:24:18.783Z | HASH_OK |
| UAP-EV-20261112152418-8b73e1cd | task_step | step:independent_review | 0 | 2026-11-12T15:24:18.901Z | HASH_OK |
| UAP-EV-20261112152418-8d9741d4 | health_probe | evidence-engine.health() | 0 | 2026-11-12T15:24:18.575Z | HASH_OK |
| UAP-EV-20261112152418-92cca58c | workflow_step | workflow:independent_review | 0 | 2026-11-12T15:24:18.901Z | HASH_OK |
| UAP-EV-20261112152418-93f5a0e2 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112152418-7f63fe7a | 0 | 2026-11-12T15:24:18.573Z | HASH_OK |
| UAP-EV-20261112152418-99b185ca | task_step | step:apply_authorized_repair | 0 | 2026-11-12T15:24:18.854Z | HASH_OK |
| UAP-EV-20261112152418-a1bcc791 | task_step | step:run_regression | 0 | 2026-11-12T15:24:18.879Z | HASH_OK |
| UAP-EV-20261112152418-b816152d | workflow_step | workflow:persist_evidence | 0 | 2026-11-12T15:24:18.926Z | HASH_OK |
| UAP-EV-20261112152418-c0921d49 | task_step | step:probe.step2 | 0 | 2026-11-12T15:24:18.450Z | HASH_OK |
| UAP-EV-20261112152418-cbe1eddd | task_step | step:generate_repair_plan | 0 | 2026-11-12T15:24:18.831Z | HASH_OK |
| UAP-EV-20261112152418-ce7c1b00 | task_step | step:execute_targeted_tests | 0 | 2026-11-12T15:24:18.612Z | HASH_OK |
| UAP-EV-20261112152418-daa97197 | task_step | step:__health_step__ | 0 | 2026-11-12T15:24:18.060Z | HASH_OK |
| UAP-EV-20261112152418-f4699670 | workflow_step | workflow:apply_authorized_repair | 0 | 2026-11-12T15:24:18.854Z | HASH_OK |
| UAP-EV-20261112152424-03dd2643 | workflow_step | workflow:security_scan | 0 | 2026-11-12T15:24:24.377Z | HASH_OK |
| UAP-EV-20261112152424-38993526 | workflow_step | workflow:dependency_scan | 0 | 2026-11-12T15:24:24.508Z | HASH_OK |
| UAP-EV-20261112152424-433ef8be | task_step | step:security_scan | 0 | 2026-11-12T15:24:24.378Z | HASH_OK |
| UAP-EV-20261112152424-522df43a | workflow_step | workflow:typecheck | 0 | 2026-11-12T15:24:24.167Z | HASH_OK |
| UAP-EV-20261112152424-7902789b | workflow_step | workflow:integration_tests | 0 | 2026-11-12T15:24:24.214Z | HASH_OK |
| UAP-EV-20261112152424-7bcfa561 | task_step | step:typecheck | 0 | 2026-11-12T15:24:24.169Z | HASH_OK |
| UAP-EV-20261112152424-7c30684e | task_step | step:unit_tests | 0 | 2026-11-12T15:24:24.193Z | HASH_OK |
| UAP-EV-20261112152424-7d1646a2 | task_step | step:end_to_end_tests | 0 | 2026-11-12T15:24:24.240Z | HASH_OK |
| UAP-EV-20261112152424-7eb62aff | workflow_step | workflow:lint | 0 | 2026-11-12T15:24:24.141Z | HASH_OK |
| UAP-EV-20261112152424-9aa325b3 | workflow_step | workflow:end_to_end_tests | 0 | 2026-11-12T15:24:24.240Z | HASH_OK |
| UAP-EV-20261112152424-ccd0d673 | workflow_step | workflow:unit_tests | 0 | 2026-11-12T15:24:24.192Z | HASH_OK |
| UAP-EV-20261112152424-d6864528 | task_step | step:integration_tests | 0 | 2026-11-12T15:24:24.214Z | HASH_OK |
| UAP-EV-20261112152424-e6278cf7 | task_step | step:dependency_scan | 0 | 2026-11-12T15:24:24.508Z | HASH_OK |
| UAP-EV-20261112152424-f46bbc36 | task_step | step:lint | 0 | 2026-11-12T15:24:24.141Z | HASH_OK |
| UAP-EV-20261112152429-0d8edd6b | workflow_step | workflow:test_idempotency | 0 | 2026-11-12T15:24:29.899Z | HASH_OK |
| UAP-EV-20261112152429-0e305165 | task_step | step:test_failure_recovery | 0 | 2026-11-12T15:24:29.972Z | HASH_OK |
| UAP-EV-20261112152429-264cb7a5 | task_step | step:inspect_payment_state_machine | 0 | 2026-11-12T15:24:29.830Z | HASH_OK |
| UAP-EV-20261112152429-344de118 | task_step | step:test_concurrency | 0 | 2026-11-12T15:24:29.925Z | HASH_OK |
| UAP-EV-20261112152429-3b14ec02 | workflow_step | workflow:inspect_payment_state_machine | 0 | 2026-11-12T15:24:29.829Z | HASH_OK |
| UAP-EV-20261112152429-455d8ac3 | task_step | step:inspect_balance_ledger | 0 | 2026-11-12T15:24:29.878Z | HASH_OK |
| UAP-EV-20261112152429-4c3b0994 | workflow_step | workflow:test_failure_recovery | 0 | 2026-11-12T15:24:29.971Z | HASH_OK |
| UAP-EV-20261112152429-69bb8810 | workflow_step | workflow:test_duplicate_notifications | 0 | 2026-11-12T15:24:29.948Z | HASH_OK |
| UAP-EV-20261112152429-74dee2bb | task_step | step:test_idempotency | 0 | 2026-11-12T15:24:29.900Z | HASH_OK |
| UAP-EV-20261112152429-7ee123d8 | task_step | step:inspect_refund_state_machine | 0 | 2026-11-12T15:24:29.854Z | HASH_OK |
| UAP-EV-20261112152429-87c1154c | workflow_step | workflow:inspect_balance_ledger | 0 | 2026-11-12T15:24:29.877Z | HASH_OK |
| UAP-EV-20261112152429-8c9ffa55 | task_step | step:test_duplicate_notifications | 0 | 2026-11-12T15:24:29.948Z | HASH_OK |
| UAP-EV-20261112152429-9df049bc | workflow_step | workflow:verify_reconciliation | 0 | 2026-11-12T15:24:29.995Z | HASH_OK |
| UAP-EV-20261112152429-9eaa5bf8 | task_result | uap task run UAP-TASK-20261112152419-1313c9ed | 0 | 2026-11-12T15:24:29.739Z | HASH_OK |
| UAP-EV-20261112152429-9fba3612 | task_step | step:code_review | 0 | 2026-11-12T15:24:29.676Z | HASH_OK |
| UAP-EV-20261112152429-adcd2d9b | workflow_step | workflow:build | 0 | 2026-11-12T15:24:29.653Z | HASH_OK |
| UAP-EV-20261112152429-c7417c6e | workflow_step | workflow:code_review | 0 | 2026-11-12T15:24:29.676Z | HASH_OK |
| UAP-EV-20261112152429-dba779a5 | workflow_step | workflow:inspect_refund_state_machine | 0 | 2026-11-12T15:24:29.853Z | HASH_OK |
| UAP-EV-20261112152429-ea1b4ed5 | task_step | step:verify_reconciliation | 0 | 2026-11-12T15:24:29.996Z | HASH_OK |
| UAP-EV-20261112152429-eb4627b3 | task_step | step:build | 0 | 2026-11-12T15:24:29.654Z | HASH_OK |
| UAP-EV-20261112152429-eea21f98 | workflow_step | workflow:test_concurrency | 0 | 2026-11-12T15:24:29.925Z | HASH_OK |
| UAP-EV-20261112152430-098f51c0 | workflow_step | workflow:validate_all_agents | 0 | 2026-11-12T15:24:30.200Z | HASH_OK |
| UAP-EV-20261112152430-11dcc545 | task_result | uap task run UAP-TASK-20261112152429-18858a85 | 0 | 2026-11-12T15:24:30.060Z | HASH_OK |
| UAP-EV-20261112152430-181df9c5 | workflow_step | workflow:validate_all_specifications | 0 | 2026-11-12T15:24:30.157Z | HASH_OK |
| UAP-EV-20261112152430-18602928 | workflow_step | workflow:generate_final_report | 0 | 2026-11-12T15:24:30.349Z | HASH_OK |
| UAP-EV-20261112152430-1b8b8d85 | task_step | step:verify_recovery | 0 | 2026-11-12T15:24:30.327Z | HASH_OK |
| UAP-EV-20261112152430-1ce50d7d | cli_command | uap workflow run --all | 0 | 2026-11-12T15:24:30.451Z | HASH_OK |
| UAP-EV-20261112152430-2995c2f6 | task_step | step:run_full_quality_gate | 0 | 2026-11-12T15:24:30.278Z | HASH_OK |
| UAP-EV-20261112152430-2b8e7b47 | task_step | step:validate_all_specifications | 0 | 2026-11-12T15:24:30.157Z | HASH_OK |
| UAP-EV-20261112152430-2bb86b3d | workflow_step | workflow:validate_all_executors | 0 | 2026-11-12T15:24:30.178Z | HASH_OK |
| UAP-EV-20261112152430-48321bff | workflow_step | workflow:run_full_quality_gate | 0 | 2026-11-12T15:24:30.278Z | HASH_OK |
| UAP-EV-20261112152430-4ed0c517 | task_step | step:validate_all_executors | 0 | 2026-11-12T15:24:30.178Z | HASH_OK |
| UAP-EV-20261112152430-6f9ce4b8 | workflow_step | workflow:verify_recovery | 0 | 2026-11-12T15:24:30.327Z | HASH_OK |
| UAP-EV-20261112152430-71fc5329 | task_step | step:__health_step__ | 0 | 2026-11-12T15:24:30.999Z | HASH_OK |
| UAP-EV-20261112152430-8510090b | workflow_step | workflow:run_end_to_end_workflows | 0 | 2026-11-12T15:24:30.301Z | HASH_OK |
| UAP-EV-20261112152430-8b3dd9dd | task_step | step:validate_all_validators | 0 | 2026-11-12T15:24:30.251Z | HASH_OK |
| UAP-EV-20261112152430-901c0710 | task_step | step:generate_final_report | 0 | 2026-11-12T15:24:30.356Z | HASH_OK |
| UAP-EV-20261112152430-cbd0debf | workflow_step | workflow:validate_all_workflows | 0 | 2026-11-12T15:24:30.227Z | HASH_OK |
| UAP-EV-20261112152430-d229bd83 | workflow_step | workflow:validate_all_validators | 0 | 2026-11-12T15:24:30.250Z | HASH_OK |
| UAP-EV-20261112152430-e0d0f6d1 | task_step | step:validate_all_agents | 0 | 2026-11-12T15:24:30.202Z | HASH_OK |
| UAP-EV-20261112152430-e18f0624 | task_step | step:validate_all_workflows | 0 | 2026-11-12T15:24:30.228Z | HASH_OK |
| UAP-EV-20261112152430-e3f35336 | task_step | step:run_end_to_end_workflows | 0 | 2026-11-12T15:24:30.302Z | HASH_OK |
| UAP-EV-20261112152430-f468b093 | task_result | uap task run UAP-TASK-20261112152430-130b6d45 | 0 | 2026-11-12T15:24:30.416Z | HASH_OK |
| UAP-EV-20261112152431-260c8761 | task_step | step:probe.step1 | 0 | 2026-11-12T15:24:31.339Z | HASH_OK |
| UAP-EV-20261112152431-5a750bc3 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112152431-7ea93ae5 | 0 | 2026-11-12T15:24:31.389Z | HASH_OK |
| UAP-EV-20261112152431-66f3543c | health_probe | evidence-engine.health() | 0 | 2026-11-12T15:24:31.560Z | HASH_OK |
| UAP-EV-20261112152431-69f2f973 | task_result | uap task run UAP-TASK-HEALTH-20261112152430-469d4765 | 0 | 2026-11-12T15:24:31.075Z | HASH_OK |
| UAP-EV-20261112152431-90729c93 | task_step | step:probe.step1 | 0 | 2026-11-12T15:24:31.879Z | HASH_OK |
| UAP-EV-20261112152431-a3bba464 | task_step | step:probe.step2 | 0 | 2026-11-12T15:24:31.431Z | HASH_OK |
| UAP-EV-20261112152431-b77afefb | recovery | uap task resume UAP-TASK-INTERRUPT-20261112152431-30afe77d | 0 | 2026-11-12T15:24:31.928Z | HASH_OK |
| UAP-EV-20261112152431-beea7e71 | task_step | step:probe.step2 | 0 | 2026-11-12T15:24:31.968Z | HASH_OK |
| UAP-EV-20261112152431-bef9ac50 | task_step | step:probe.step3 | 0 | 2026-11-12T15:24:31.452Z | HASH_OK |
| UAP-EV-20261112152431-e7d89e44 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112152431-7ea93ae5 | 0 | 2026-11-12T15:24:31.556Z | HASH_OK |
| UAP-EV-20261112152431-ecd0fd16 | task_step | step:probe.step3 | 0 | 2026-11-12T15:24:31.992Z | HASH_OK |
| UAP-EV-20261112152431-f221e6af | task_result | uap task run UAP-TASK-INTERRUPT-20261112152431-7ea93ae5 | 0 | 2026-11-12T15:24:31.513Z | HASH_OK |
| UAP-EV-20261112152432-028feba9 | task_step | step:inspect_payment_state_machine | 0 | 2026-11-12T15:24:32.512Z | HASH_OK |
| UAP-EV-20261112152432-139fc804 | task_result | uap task run UAP-TASK-20261112152432-bd81f218 | 0 | 2026-11-12T15:24:32.749Z | HASH_OK |
| UAP-EV-20261112152432-1cfeb990 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112152431-30afe77d | 0 | 2026-11-12T15:24:32.093Z | HASH_OK |
| UAP-EV-20261112152432-3730bcc0 | cli_command | uap test --all | 0 | 2026-11-12T15:24:32.863Z | HASH_OK |
| UAP-EV-20261112152432-45e3174a | task_step | step:inspect_balance_ledger | 0 | 2026-11-12T15:24:32.562Z | HASH_OK |
| UAP-EV-20261112152432-46ea515c | task_step | step:verify_reconciliation | 0 | 2026-11-12T15:24:32.687Z | HASH_OK |
| UAP-EV-20261112152432-474676ce | workflow_step | workflow:validate_environment | 0 | 2026-11-12T15:24:32.450Z | HASH_OK |
| UAP-EV-20261112152432-479fa7ea | workflow_step | workflow:test_idempotency | 0 | 2026-11-12T15:24:32.588Z | HASH_OK |
| UAP-EV-20261112152432-7462de19 | task_step | step:test_idempotency | 0 | 2026-11-12T15:24:32.589Z | HASH_OK |
| UAP-EV-20261112152432-7710d3f2 | workflow_step | workflow:inspect_payment_state_machine | 0 | 2026-11-12T15:24:32.511Z | HASH_OK |
| UAP-EV-20261112152432-7cf87b97 | workflow_step | workflow:test_concurrency | 0 | 2026-11-12T15:24:32.610Z | HASH_OK |
| UAP-EV-20261112152432-9237d362 | task_step | step:test_duplicate_notifications | 0 | 2026-11-12T15:24:32.638Z | HASH_OK |
| UAP-EV-20261112152432-9ddaed6b | runtime_test_run | node --test .uap/tests/runtime.test.mjs | 0 | 2026-11-12T15:24:32.860Z | HASH_OK |
| UAP-EV-20261112152432-a1112516 | task_step | step:test_concurrency | 0 | 2026-11-12T15:24:32.610Z | HASH_OK |
| UAP-EV-20261112152432-a5a616af | workflow_step | workflow:verify_reconciliation | 0 | 2026-11-12T15:24:32.686Z | HASH_OK |
| UAP-EV-20261112152432-a68645fd | task_result | uap task run UAP-TASK-TEST-20261112152432-228ace62 | 1 | 2026-11-12T15:24:32.354Z | HASH_OK |
| UAP-EV-20261112152432-a8cc764d | workflow_step | workflow:inspect_balance_ledger | 0 | 2026-11-12T15:24:32.561Z | HASH_OK |
| UAP-EV-20261112152432-ae02390b | workflow_step | workflow:test_duplicate_notifications | 0 | 2026-11-12T15:24:32.638Z | HASH_OK |
| UAP-EV-20261112152432-b0f62ac1 | workflow_step | workflow:test_failure_recovery | 0 | 2026-11-12T15:24:32.659Z | HASH_OK |
| UAP-EV-20261112152432-b2d6c7bb | task_result | uap task run UAP-TASK-INTERRUPT-20261112152431-30afe77d | 0 | 2026-11-12T15:24:32.053Z | HASH_OK |
| UAP-EV-20261112152432-b3062811 | task_step | step:__uap_test_retry_then_ok__ | 0 | 2026-11-12T15:24:32.145Z | HASH_OK |
| UAP-EV-20261112152432-d6004e46 | task_result | uap task run UAP-TASK-TEST-20261112152432-064b38c1 | 0 | 2026-11-12T15:24:32.209Z | HASH_OK |
| UAP-EV-20261112152432-e5b34142 | task_step | step:__uap_test_always_fail__ | 1 | 2026-11-12T15:24:32.292Z | HASH_OK |
| UAP-EV-20261112152432-ec37c743 | workflow_step | workflow:inspect_refund_state_machine | 0 | 2026-11-12T15:24:32.540Z | HASH_OK |
| UAP-EV-20261112152432-fadc6499 | task_step | step:test_failure_recovery | 0 | 2026-11-12T15:24:32.660Z | HASH_OK |
| UAP-EV-20261112152432-fbd86f3c | task_step | step:inspect_refund_state_machine | 0 | 2026-11-12T15:24:32.540Z | HASH_OK |
| UAP-EV-20261112152433-6a3eed9a | cli_command | uap release check | 1 | 2026-11-12T15:24:33.866Z | HASH_OK |
| UAP-EV-20261112152433-c26aa5e0 | cli_command | uap report --final | 0 | 2026-11-12T15:24:33.645Z | HASH_OK |
| UAP-EV-20261112152434-02c0c2e3 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112152434-2488ee64 | 0 | 2026-11-12T15:24:34.508Z | HASH_OK |
| UAP-EV-20261112152434-31be93a3 | task_step | step:probe.step1 | 0 | 2026-11-12T15:24:34.457Z | HASH_OK |
| UAP-EV-20261112152434-3f37e967 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112152434-a0dc83b3 | 0 | 2026-11-12T15:24:34.933Z | HASH_OK |
| UAP-EV-20261112152434-5082fcd1 | task_step | step:__health_step__ | 0 | 2026-11-12T15:24:34.127Z | HASH_OK |
| UAP-EV-20261112152434-6197d729 | task_step | step:probe.step2 | 0 | 2026-11-12T15:24:34.551Z | HASH_OK |
| UAP-EV-20261112152434-7175094c | task_step | step:probe.step1 | 0 | 2026-11-12T15:24:34.882Z | HASH_OK |
| UAP-EV-20261112152434-736b3ac3 | task_step | step:probe.step3 | 0 | 2026-11-12T15:24:34.571Z | HASH_OK |
| UAP-EV-20261112152434-8faba351 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112152434-2488ee64 | 0 | 2026-11-12T15:24:34.676Z | HASH_OK |
| UAP-EV-20261112152434-b98cfb8d | task_result | uap task run UAP-TASK-HEALTH-20261112152434-24e80b8e | 0 | 2026-11-12T15:24:34.201Z | HASH_OK |
| UAP-EV-20261112152434-bf1f20e7 | runtime_start | uap doctor | 0 | 2026-11-12T15:24:34.704Z | HASH_OK |
| UAP-EV-20261112152434-e3633c53 | task_result | uap task run UAP-TASK-INTERRUPT-20261112152434-2488ee64 | 0 | 2026-11-12T15:24:34.636Z | HASH_OK |
| UAP-EV-20261112152434-edb1ac1f | task_step | step:probe.step3 | 0 | 2026-11-12T15:24:34.996Z | HASH_OK |
| UAP-EV-20261112152434-fe74c55c | task_step | step:probe.step2 | 0 | 2026-11-12T15:24:34.975Z | HASH_OK |
| UAP-EV-20261112152434-ff9e1557 | health_probe | evidence-engine.health() | 0 | 2026-11-12T15:24:34.680Z | HASH_OK |
| UAP-EV-20261112152435-8585e3ce | cli_command | uap status | 0 | 2026-11-12T15:24:35.517Z | HASH_OK |
| UAP-EV-20261112152435-90f0ecab | cli_command | uap doctor | 0 | 2026-11-12T15:24:35.103Z | HASH_OK |
| UAP-EV-20261112152435-a3faa43d | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112152434-a0dc83b3 | 0 | 2026-11-12T15:24:35.101Z | HASH_OK |
| UAP-EV-20261112152435-a5bcdd3e | task_result | uap task run UAP-TASK-INTERRUPT-20261112152434-a0dc83b3 | 0 | 2026-11-12T15:24:35.060Z | HASH_OK |
| UAP-EV-20261112152448-ac4c94b0 | cli_command | uap report --final | 0 | 2026-11-12T15:24:48.278Z | HASH_OK |
| UAP-EV-20261112162859-3311005a | cli_command | uap validate --only cross_platform.h5_integrity | 3 | 2026-11-12T16:28:59.071Z | HASH_OK |
| UAP-EV-20261112163358-6fb936ae | validator_result | uap validate cross_platform.h5_integrity | 0 | 2026-11-12T16:33:58.435Z | HASH_OK |
| UAP-EV-20261112163358-f5ad014c | cli_command | uap validate cross_platform.h5_integrity | 0 | 2026-11-12T16:33:58.438Z | HASH_OK |
| UAP-EV-20261112163733-0b7e64af | validator_result | uap validate delivery.deployment_integrity | 0 | 2026-11-12T16:37:33.075Z | HASH_OK |
| UAP-EV-20261112163733-51e04389 | cli_command | uap validate delivery.deployment_integrity | 0 | 2026-11-12T16:37:33.077Z | HASH_OK |
| UAP-EV-20261112163752-48e08cf0 | cli_command | uap validate delivery.deployment_integrity | 0 | 2026-11-12T16:37:52.325Z | HASH_OK |
| UAP-EV-20261112163752-ecc56852 | validator_result | uap validate delivery.deployment_integrity | 0 | 2026-11-12T16:37:52.323Z | HASH_OK |
| UAP-EV-20261112163803-32e2ebb5 | validator_result | uap validate core.execution_integrity | 0 | 2026-11-12T16:38:03.884Z | HASH_OK |
| UAP-EV-20261112163803-567f406d | validator_result | uap validate core.architecture_integrity | 0 | 2026-11-12T16:38:03.737Z | HASH_OK |
| UAP-EV-20261112163803-5d106af0 | validator_result | uap validate security.permission_boundary | 0 | 2026-11-12T16:38:03.924Z | HASH_OK |
| UAP-EV-20261112163804-2e7fdd23 | validator_result | uap validate agents.collaboration_integrity | 0 | 2026-11-12T16:38:04.544Z | HASH_OK |
| UAP-EV-20261112163804-65adef4f | validator_result | uap validate product.prototype_consistency | 0 | 2026-11-12T16:38:04.176Z | HASH_OK |
| UAP-EV-20261112163804-84a5b6d8 | validator_result | uap validate product.requirement_traceability | 0 | 2026-11-12T16:38:04.134Z | HASH_OK |
| UAP-EV-20261112163804-84c8b43b | validator_result | uap validate architecture.api_database_integrity | 0 | 2026-11-12T16:38:04.254Z | HASH_OK |
| UAP-EV-20261112163804-8db708bd | validator_result | uap validate agents.registry_integrity | 0 | 2026-11-12T16:38:04.288Z | HASH_OK |
| UAP-EV-20261112163804-93ab5be4 | validator_result | uap validate agents.execution_integrity | 0 | 2026-11-12T16:38:04.528Z | HASH_OK |
| UAP-EV-20261112163804-c0487f20 | validator_result | uap validate architecture.consistency | 0 | 2026-11-12T16:38:04.232Z | HASH_OK |
| UAP-EV-20261112163804-e96ac096 | validator_result | uap validate product.business_rule_integrity | 0 | 2026-11-12T16:38:04.206Z | HASH_OK |
| UAP-EV-20261112163804-ec31b43e | validator_result | uap validate architecture.adr_integrity | 0 | 2026-11-12T16:38:04.271Z | HASH_OK |
| UAP-EV-20261112163804-f31332f0 | validator_result | uap validate agents.recovery_integrity | 0 | 2026-11-12T16:38:04.676Z | HASH_OK |
| UAP-EV-20261112163804-faa13e03 | validator_result | uap validate core.evidence_integrity | 0 | 2026-11-12T16:38:04.098Z | HASH_OK |
| UAP-EV-20261112163805-0a2a0a88 | validator_result | uap validate development.dependency_integrity | 0 | 2026-11-12T16:38:05.970Z | HASH_OK |
| UAP-EV-20261112163805-5f3585a1 | validator_result | uap validate development.coding_compliance | 0 | 2026-11-12T16:38:05.822Z | HASH_OK |
| UAP-EV-20261112163805-c8f49f37 | validator_result | uap validate development.review_integrity | 0 | 2026-11-12T16:38:05.951Z | HASH_OK |
| UAP-EV-20261112163806-3cf16d2c | validator_result | uap validate quality.engineering_integrity | 0 | 2026-11-12T16:38:06.133Z | HASH_OK |
| UAP-EV-20261112163806-49d216e5 | validator_result | uap validate quality.repair_integrity | 0 | 2026-11-12T16:38:06.248Z | HASH_OK |
| UAP-EV-20261112163806-515bc0b9 | validator_result | uap validate security.financial_integrity_validator | 0 | 2026-11-12T16:38:06.736Z | HASH_OK |
| UAP-EV-20261112163806-53b8498e | validator_result | uap validate security.reliability_integrity | 0 | 2026-11-12T16:38:06.868Z | HASH_OK |
| UAP-EV-20261112163806-849435bc | validator_result | uap validate quality.test_integrity | 0 | 2026-11-12T16:38:06.149Z | HASH_OK |
| UAP-EV-20261112163806-892a7e08 | validator_result | uap validate quality.gate_integrity | 0 | 2026-11-12T16:38:06.353Z | HASH_OK |
| UAP-EV-20261112163806-8d1539ab | validator_result | uap validate security.application_integrity | 0 | 2026-11-12T16:38:06.723Z | HASH_OK |
| UAP-EV-20261112163807-45bf39d0 | validator_result | uap validate cross_platform.web_integrity | 0 | 2026-11-12T16:38:07.027Z | HASH_OK |
| UAP-EV-20261112163925-a4cfc488 | validator_result | uap validate cross_platform.consistency_integrity | 0 | 2026-11-12T16:39:25.998Z | HASH_OK |
| UAP-EV-20261112163925-e0af36f0 | validator_result | uap validate cross_platform.h5_integrity | 0 | 2026-11-12T16:39:25.918Z | HASH_OK |
| UAP-EV-20261112163926-6bc778f5 | validator_result | uap validate delivery.ci_integrity | 0 | 2026-11-12T16:39:26.020Z | HASH_OK |
| UAP-EV-20261112163935-39f1cf71 | validator_result | uap validate evolution.evolution_integrity | 0 | 2026-11-12T16:39:35.920Z | HASH_OK |
| UAP-EV-20261112163935-754d2339 | validator_result | uap validate delivery.observability_integrity | 0 | 2026-11-12T16:39:35.763Z | HASH_OK |
| UAP-EV-20261112163935-8308ab56 | validator_result | uap validate evolution.knowledge_integrity | 0 | 2026-11-12T16:39:35.800Z | HASH_OK |
| UAP-EV-20261112163935-953f2d49 | validator_result | uap validate delivery.deployment_integrity | 0 | 2026-11-12T16:39:35.497Z | HASH_OK |
| UAP-EV-20261112163935-f9f17ea9 | cli_command | uap validate --all | 0 | 2026-11-12T16:39:35.946Z | HASH_OK |
| UAP-EV-20261112163951-21c84fcd | task_step | step:probe.step2 | 0 | 2026-11-12T16:39:51.987Z | HASH_OK |
| UAP-EV-20261112163951-40426208 | task_step | step:probe.step1 | 0 | 2026-11-12T16:39:51.895Z | HASH_OK |
| UAP-EV-20261112163951-4b555ad2 | task_step | step:__health_step__ | 0 | 2026-11-12T16:39:51.558Z | HASH_OK |
| UAP-EV-20261112163951-644749ec | recovery | uap task resume UAP-TASK-INTERRUPT-20261112163951-2f8098cc | 0 | 2026-11-12T16:39:51.945Z | HASH_OK |
| UAP-EV-20261112163951-ce54cf79 | task_result | uap task run UAP-TASK-HEALTH-20261112163951-6bef86e4 | 0 | 2026-11-12T16:39:51.630Z | HASH_OK |
| UAP-EV-20261112163952-0602d852 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112163952-5b38d23a | 0 | 2026-11-12T16:39:52.369Z | HASH_OK |
| UAP-EV-20261112163952-12bde1e7 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112163952-5b38d23a | 0 | 2026-11-12T16:39:52.541Z | HASH_OK |
| UAP-EV-20261112163952-24ff3e1d | cli_command | uap doctor | 0 | 2026-11-12T16:39:52.543Z | HASH_OK |
| UAP-EV-20261112163952-56a3fc3e | task_result | uap task run UAP-TASK-INTERRUPT-20261112163952-5b38d23a | 0 | 2026-11-12T16:39:52.501Z | HASH_OK |
| UAP-EV-20261112163952-6e9c974d | task_step | step:probe.step1 | 0 | 2026-11-12T16:39:52.318Z | HASH_OK |
| UAP-EV-20261112163952-920201db | task_step | step:probe.step3 | 0 | 2026-11-12T16:39:52.435Z | HASH_OK |
| UAP-EV-20261112163952-9f98fcda | task_step | step:probe.step2 | 0 | 2026-11-12T16:39:52.411Z | HASH_OK |
| UAP-EV-20261112163952-a12085b5 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112163951-2f8098cc | 0 | 2026-11-12T16:39:52.108Z | HASH_OK |
| UAP-EV-20261112163952-be33f3ba | task_step | step:probe.step3 | 0 | 2026-11-12T16:39:52.007Z | HASH_OK |
| UAP-EV-20261112163952-c2a4fbb9 | runtime_start | uap doctor | 0 | 2026-11-12T16:39:52.134Z | HASH_OK |
| UAP-EV-20261112163952-e55f5fcb | task_result | uap task run UAP-TASK-INTERRUPT-20261112163951-2f8098cc | 0 | 2026-11-12T16:39:52.068Z | HASH_OK |
| UAP-EV-20261112163952-fb376791 | health_probe | evidence-engine.health() | 0 | 2026-11-12T16:39:52.113Z | HASH_OK |
| UAP-EV-20261112163953-49552608 | task_step | step:probe.step2 | 0 | 2026-11-12T16:39:53.583Z | HASH_OK |
| UAP-EV-20261112163953-8f56778c | task_step | step:probe.step3 | 0 | 2026-11-12T16:39:53.601Z | HASH_OK |
| UAP-EV-20261112163953-95cd2948 | task_result | uap task run UAP-TASK-INTERRUPT-20261112163953-00ce4bb5 | 0 | 2026-11-12T16:39:53.668Z | HASH_OK |
| UAP-EV-20261112163953-c365c054 | task_step | step:__health_step__ | 0 | 2026-11-12T16:39:53.145Z | HASH_OK |
| UAP-EV-20261112163953-ce4247aa | recovery | uap task resume UAP-TASK-INTERRUPT-20261112163953-00ce4bb5 | 0 | 2026-11-12T16:39:53.537Z | HASH_OK |
| UAP-EV-20261112163953-e3791af9 | task_step | step:probe.step1 | 0 | 2026-11-12T16:39:53.485Z | HASH_OK |
| UAP-EV-20261112163953-e6274e19 | health_probe | evidence-engine.health() | 0 | 2026-11-12T16:39:53.714Z | HASH_OK |
| UAP-EV-20261112163953-edf6f03e | task_result | uap task run UAP-TASK-HEALTH-20261112163953-84aed764 | 0 | 2026-11-12T16:39:53.217Z | HASH_OK |
| UAP-EV-20261112163953-f53ab18b | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112163953-00ce4bb5 | 0 | 2026-11-12T16:39:53.709Z | HASH_OK |
| UAP-EV-20261112163954-0676fa6c | task_step | step:__uap_test_retry_then_ok__ | 0 | 2026-11-12T16:39:54.309Z | HASH_OK |
| UAP-EV-20261112163954-099e6809 | workflow_step | workflow:test_duplicate_notifications | 0 | 2026-11-12T16:39:54.879Z | HASH_OK |
| UAP-EV-20261112163954-0c78e8ea | workflow_step | workflow:validate_environment | 0 | 2026-11-12T16:39:54.718Z | HASH_OK |
| UAP-EV-20261112163954-1e8c15bd | task_step | step:inspect_payment_state_machine | 0 | 2026-11-12T16:39:54.773Z | HASH_OK |
| UAP-EV-20261112163954-21356f5f | task_step | step:test_duplicate_notifications | 0 | 2026-11-12T16:39:54.879Z | HASH_OK |
| UAP-EV-20261112163954-28928473 | workflow_step | workflow:verify_reconciliation | 0 | 2026-11-12T16:39:54.922Z | HASH_OK |
| UAP-EV-20261112163954-29098f58 | task_step | step:test_concurrency | 0 | 2026-11-12T16:39:54.862Z | HASH_OK |
| UAP-EV-20261112163954-3081e300 | task_step | step:inspect_balance_ledger | 0 | 2026-11-12T16:39:54.818Z | HASH_OK |
| UAP-EV-20261112163954-30d81e74 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112163953-47e08ad0 | 0 | 2026-11-12T16:39:54.075Z | HASH_OK |
| UAP-EV-20261112163954-322e14e0 | task_step | step:probe.step3 | 0 | 2026-11-12T16:39:54.144Z | HASH_OK |
| UAP-EV-20261112163954-35067db8 | task_step | step:__uap_test_always_fail__ | 1 | 2026-11-12T16:39:54.462Z | HASH_OK |
| UAP-EV-20261112163954-357fc8e7 | task_result | uap task run UAP-TASK-TEST-20261112163954-226e5b03 | 1 | 2026-11-12T16:39:54.528Z | HASH_OK |
| UAP-EV-20261112163954-4038fb35 | task_result | uap task run UAP-TASK-INTERRUPT-20261112163953-47e08ad0 | 0 | 2026-11-12T16:39:54.208Z | HASH_OK |
| UAP-EV-20261112163954-466c3874 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112163953-47e08ad0 | 0 | 2026-11-12T16:39:54.252Z | HASH_OK |
| UAP-EV-20261112163954-52ad7236 | workflow_step | workflow:test_failure_recovery | 0 | 2026-11-12T16:39:54.901Z | HASH_OK |
| UAP-EV-20261112163954-551ae272 | workflow_step | workflow:inspect_refund_state_machine | 0 | 2026-11-12T16:39:54.793Z | HASH_OK |
| UAP-EV-20261112163954-5d86caed | workflow_step | workflow:test_idempotency | 0 | 2026-11-12T16:39:54.835Z | HASH_OK |
| UAP-EV-20261112163954-6083ee30 | task_result | uap task run UAP-TASK-20261112163954-cb2f2d52 | 0 | 2026-11-12T16:39:54.978Z | HASH_OK |
| UAP-EV-20261112163954-615a0b4b | task_step | step:test_failure_recovery | 0 | 2026-11-12T16:39:54.902Z | HASH_OK |
| UAP-EV-20261112163954-7d4b90d9 | task_step | step:inspect_refund_state_machine | 0 | 2026-11-12T16:39:54.793Z | HASH_OK |
| UAP-EV-20261112163954-a3199fe1 | task_step | step:verify_reconciliation | 0 | 2026-11-12T16:39:54.923Z | HASH_OK |
| UAP-EV-20261112163954-b44b539a | task_result | uap task run UAP-TASK-TEST-20261112163954-10cfd427 | 0 | 2026-11-12T16:39:54.374Z | HASH_OK |
| UAP-EV-20261112163954-cb29490a | task_step | step:probe.step1 | 0 | 2026-11-12T16:39:54.023Z | HASH_OK |
| UAP-EV-20261112163954-cc08730d | task_step | step:probe.step2 | 0 | 2026-11-12T16:39:54.120Z | HASH_OK |
| UAP-EV-20261112163954-ddc352fb | workflow_step | workflow:inspect_balance_ledger | 0 | 2026-11-12T16:39:54.817Z | HASH_OK |
| UAP-EV-20261112163954-e97681d6 | task_step | step:test_idempotency | 0 | 2026-11-12T16:39:54.835Z | HASH_OK |
| UAP-EV-20261112163954-f0ed0adc | workflow_step | workflow:test_concurrency | 0 | 2026-11-12T16:39:54.861Z | HASH_OK |
| UAP-EV-20261112163954-f40706ee | workflow_step | workflow:inspect_payment_state_machine | 0 | 2026-11-12T16:39:54.772Z | HASH_OK |
| UAP-EV-20261112163955-25b7d154 | cli_command | uap test --all | 0 | 2026-11-12T16:39:55.088Z | HASH_OK |
| UAP-EV-20261112163955-301897bb | runtime_test_run | node --test .uap/tests/runtime.test.mjs | 0 | 2026-11-12T16:39:55.086Z | HASH_OK |
| UAP-EV-20261112164002-1347c53e | task_step | step:__health_step__ | 0 | 2026-11-12T16:40:02.450Z | HASH_OK |
| UAP-EV-20261112164002-19144670 | task_step | step:inspect_repository | 0 | 2026-11-12T16:40:02.226Z | HASH_OK |
| UAP-EV-20261112164002-24bf70fd | task_step | step:probe.step3 | 0 | 2026-11-12T16:40:02.896Z | HASH_OK |
| UAP-EV-20261112164002-265c22d0 | task_result | uap task run UAP-TASK-HEALTH-20261112164002-029f805a | 0 | 2026-11-12T16:40:02.517Z | HASH_OK |
| UAP-EV-20261112164002-32f9c47f | workflow_step | workflow:validate_specification_registry | 0 | 2026-11-12T16:40:02.362Z | HASH_OK |
| UAP-EV-20261112164002-3699769b | task_step | step:validate_specification_registry | 0 | 2026-11-12T16:40:02.363Z | HASH_OK |
| UAP-EV-20261112164002-382a7de8 | task_step | step:validate_environment | 0 | 2026-11-12T16:40:02.302Z | HASH_OK |
| UAP-EV-20261112164002-4c6846cf | workflow_step | workflow:validate_environment | 0 | 2026-11-12T16:40:02.302Z | HASH_OK |
| UAP-EV-20261112164002-55f30d69 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112164002-e849e87c | 0 | 2026-11-12T16:40:02.825Z | HASH_OK |
| UAP-EV-20261112164002-7e83943d | task_step | step:probe.step1 | 0 | 2026-11-12T16:40:02.771Z | HASH_OK |
| UAP-EV-20261112164002-8bd4d9a4 | workflow_step | workflow:initialize_uap_structure | 0 | 2026-11-12T16:40:02.326Z | HASH_OK |
| UAP-EV-20261112164002-c9f323ba | workflow_step | workflow:inspect_repository | 0 | 2026-11-12T16:40:02.226Z | HASH_OK |
| UAP-EV-20261112164002-d7b65043 | task_step | step:initialize_uap_structure | 0 | 2026-11-12T16:40:02.327Z | HASH_OK |
| UAP-EV-20261112164002-d8b1d8e8 | task_step | step:probe.step2 | 0 | 2026-11-12T16:40:02.873Z | HASH_OK |
| UAP-EV-20261112164002-ff208efa | task_result | uap task run UAP-TASK-INTERRUPT-20261112164002-e849e87c | 0 | 2026-11-12T16:40:02.964Z | HASH_OK |
| UAP-EV-20261112164003-06431c80 | task_step | step:probe.step3 | 0 | 2026-11-12T16:40:03.886Z | HASH_OK |
| UAP-EV-20261112164003-147b8675 | task_result | uap task run UAP-TASK-HEALTH-20261112164003-ad2fdf54 | 0 | 2026-11-12T16:40:03.491Z | HASH_OK |
| UAP-EV-20261112164003-85b663ac | task_step | step:probe.step2 | 0 | 2026-11-12T16:40:03.862Z | HASH_OK |
| UAP-EV-20261112164003-8b0de647 | workflow_step | workflow:initialize_runtime | 0 | 2026-11-12T16:40:03.031Z | HASH_OK |
| UAP-EV-20261112164003-8b854fd1 | task_step | step:probe.step1 | 0 | 2026-11-12T16:40:03.762Z | HASH_OK |
| UAP-EV-20261112164003-9def9435 | health_probe | evidence-engine.health() | 0 | 2026-11-12T16:40:03.010Z | HASH_OK |
| UAP-EV-20261112164003-a6ddb71b | recovery | uap task resume UAP-TASK-INTERRUPT-20261112164003-ba2c016a | 0 | 2026-11-12T16:40:03.818Z | HASH_OK |
| UAP-EV-20261112164003-af521f86 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112164002-e849e87c | 0 | 2026-11-12T16:40:03.006Z | HASH_OK |
| UAP-EV-20261112164003-c61caa40 | task_step | step:__health_step__ | 0 | 2026-11-12T16:40:03.412Z | HASH_OK |
| UAP-EV-20261112164003-d9c63ce4 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112164003-ba2c016a | 0 | 2026-11-12T16:40:03.995Z | HASH_OK |
| UAP-EV-20261112164003-e154efa1 | task_result | uap task run UAP-TASK-INTERRUPT-20261112164003-ba2c016a | 0 | 2026-11-12T16:40:03.951Z | HASH_OK |
| UAP-EV-20261112164003-e4eee629 | task_step | step:initialize_runtime | 0 | 2026-11-12T16:40:03.032Z | HASH_OK |
| UAP-EV-20261112164004-4af5d08d | task_step | step:probe.step1 | 0 | 2026-11-12T16:40:04.309Z | HASH_OK |
| UAP-EV-20261112164004-5481127f | task_result | uap task run UAP-TASK-TEST-20261112164004-5fe9f350 | 1 | 2026-11-12T16:40:04.828Z | HASH_OK |
| UAP-EV-20261112164004-6a301dfa | task_step | step:probe.step3 | 0 | 2026-11-12T16:40:04.430Z | HASH_OK |
| UAP-EV-20261112164004-70130317 | task_step | step:__uap_test_always_fail__ | 1 | 2026-11-12T16:40:04.762Z | HASH_OK |
| UAP-EV-20261112164004-78829e91 | health_probe | evidence-engine.health() | 0 | 2026-11-12T16:40:04.000Z | HASH_OK |
| UAP-EV-20261112164004-7fa472e8 | workflow_step | workflow:inspect_payment_state_machine | 0 | 2026-11-12T16:40:04.994Z | HASH_OK |
| UAP-EV-20261112164004-84b7f5b3 | task_step | step:inspect_payment_state_machine | 0 | 2026-11-12T16:40:04.995Z | HASH_OK |
| UAP-EV-20261112164004-963a3181 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112164004-45824827 | 0 | 2026-11-12T16:40:04.544Z | HASH_OK |
| UAP-EV-20261112164004-9d3099aa | task_step | step:probe.step2 | 0 | 2026-11-12T16:40:04.409Z | HASH_OK |
| UAP-EV-20261112164004-a7aa60d9 | task_result | uap task run UAP-TASK-INTERRUPT-20261112164004-45824827 | 0 | 2026-11-12T16:40:04.499Z | HASH_OK |
| UAP-EV-20261112164004-c010acd9 | task_step | step:__uap_test_retry_then_ok__ | 0 | 2026-11-12T16:40:04.606Z | HASH_OK |
| UAP-EV-20261112164004-d5769bf7 | workflow_step | workflow:validate_environment | 0 | 2026-11-12T16:40:04.927Z | HASH_OK |
| UAP-EV-20261112164004-e7e7dd58 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112164004-45824827 | 0 | 2026-11-12T16:40:04.363Z | HASH_OK |
| UAP-EV-20261112164004-f9b21352 | task_result | uap task run UAP-TASK-TEST-20261112164004-1ce73c48 | 0 | 2026-11-12T16:40:04.674Z | HASH_OK |
| UAP-EV-20261112164005-04e460b2 | task_step | step:test_failure_recovery | 0 | 2026-11-12T16:40:05.158Z | HASH_OK |
| UAP-EV-20261112164005-0777d41a | task_step | step:scan_architecture | 0 | 2026-11-12T16:40:05.719Z | HASH_OK |
| UAP-EV-20261112164005-0a9333f7 | task_step | step:scan_development | 0 | 2026-11-12T16:40:05.773Z | HASH_OK |
| UAP-EV-20261112164005-0fa71088 | workflow_step | workflow:scan_quality | 0 | 2026-11-12T16:40:05.797Z | HASH_OK |
| UAP-EV-20261112164005-1fdb94d8 | task_step | step:test_idempotency | 0 | 2026-11-12T16:40:05.076Z | HASH_OK |
| UAP-EV-20261112164005-211d8fc7 | task_step | step:scan_agents | 0 | 2026-11-12T16:40:05.745Z | HASH_OK |
| UAP-EV-20261112164005-21a951b3 | task_step | step:inspect_refund_state_machine | 0 | 2026-11-12T16:40:05.022Z | HASH_OK |
| UAP-EV-20261112164005-28abf98a | task_step | step:verify_reconciliation | 0 | 2026-11-12T16:40:05.180Z | HASH_OK |
| UAP-EV-20261112164005-2a31c754 | task_result | uap task run UAP-TASK-20261112164004-4350f8ce | 0 | 2026-11-12T16:40:05.253Z | HASH_OK |
| UAP-EV-20261112164005-30ecd4b2 | task_step | step:test_concurrency | 0 | 2026-11-12T16:40:05.105Z | HASH_OK |
| UAP-EV-20261112164005-372f77a8 | workflow_step | workflow:scan_requirements | 0 | 2026-11-12T16:40:05.684Z | HASH_OK |
| UAP-EV-20261112164005-3adac8c7 | task_step | step:run_runtime_tests | 0 | 2026-11-12T16:40:05.363Z | HASH_OK |
| UAP-EV-20261112164005-5679b769 | task_step | step:build_defect_registry | 0 | 2026-11-12T16:40:05.944Z | HASH_OK |
| UAP-EV-20261112164005-56bf8f79 | workflow_step | workflow:scan_development | 0 | 2026-11-12T16:40:05.772Z | HASH_OK |
| UAP-EV-20261112164005-70b0b3d5 | task_step | step:scan_cross_platform | 0 | 2026-11-12T16:40:05.864Z | HASH_OK |
| UAP-EV-20261112164005-799296d1 | workflow_step | workflow:build_defect_registry | 0 | 2026-11-12T16:40:05.943Z | HASH_OK |
| UAP-EV-20261112164005-7afd17b4 | task_step | step:scan_delivery | 0 | 2026-11-12T16:40:05.893Z | HASH_OK |
| UAP-EV-20261112164005-7db11bc8 | task_result | uap task run UAP-TASK-20261112164002-cd43eca9 | 0 | 2026-11-12T16:40:05.430Z | HASH_OK |
| UAP-EV-20261112164005-85a84884 | task_step | step:scan_security | 0 | 2026-11-12T16:40:05.824Z | HASH_OK |
| UAP-EV-20261112164005-8b24eb97 | task_step | step:scan_knowledge | 0 | 2026-11-12T16:40:05.916Z | HASH_OK |
| UAP-EV-20261112164005-8e094b2b | workflow_step | workflow:verify_reconciliation | 0 | 2026-11-12T16:40:05.179Z | HASH_OK |
| UAP-EV-20261112164005-929d7b95 | workflow_step | workflow:scan_architecture | 0 | 2026-11-12T16:40:05.719Z | HASH_OK |
| UAP-EV-20261112164005-95299fce | workflow_step | workflow:test_failure_recovery | 0 | 2026-11-12T16:40:05.157Z | HASH_OK |
| UAP-EV-20261112164005-96dd4f0c | workflow_step | workflow:scan_agents | 0 | 2026-11-12T16:40:05.745Z | HASH_OK |
| UAP-EV-20261112164005-a0a6ec6e | workflow_step | workflow:inspect_project | 0 | 2026-11-12T16:40:05.640Z | HASH_OK |
| UAP-EV-20261112164005-a5d37743 | task_step | step:scan_quality | 0 | 2026-11-12T16:40:05.797Z | HASH_OK |
| UAP-EV-20261112164005-b6f17fd1 | task_step | step:scan_requirements | 0 | 2026-11-12T16:40:05.685Z | HASH_OK |
| UAP-EV-20261112164005-b79c6903 | workflow_step | workflow:test_concurrency | 0 | 2026-11-12T16:40:05.104Z | HASH_OK |
| UAP-EV-20261112164005-b838fbdd | workflow_step | workflow:inspect_balance_ledger | 0 | 2026-11-12T16:40:05.048Z | HASH_OK |
| UAP-EV-20261112164005-d18e926f | workflow_step | workflow:test_idempotency | 0 | 2026-11-12T16:40:05.075Z | HASH_OK |
| UAP-EV-20261112164005-d60e24a8 | workflow_step | workflow:scan_delivery | 0 | 2026-11-12T16:40:05.892Z | HASH_OK |
| UAP-EV-20261112164005-d7c9a345 | task_step | step:inspect_balance_ledger | 0 | 2026-11-12T16:40:05.049Z | HASH_OK |
| UAP-EV-20261112164005-d89af934 | task_step | step:inspect_project | 0 | 2026-11-12T16:40:05.641Z | HASH_OK |
| UAP-EV-20261112164005-dbe67e4b | workflow_step | workflow:run_runtime_tests | 0 | 2026-11-12T16:40:05.362Z | HASH_OK |
| UAP-EV-20261112164005-ee1dd0e1 | workflow_step | workflow:inspect_refund_state_machine | 0 | 2026-11-12T16:40:05.022Z | HASH_OK |
| UAP-EV-20261112164005-ef6685c1 | task_step | step:test_duplicate_notifications | 0 | 2026-11-12T16:40:05.128Z | HASH_OK |
| UAP-EV-20261112164005-f65d300f | workflow_step | workflow:scan_knowledge | 0 | 2026-11-12T16:40:05.915Z | HASH_OK |
| UAP-EV-20261112164005-f784cc62 | workflow_step | workflow:test_duplicate_notifications | 0 | 2026-11-12T16:40:05.128Z | HASH_OK |
| UAP-EV-20261112164005-f820505a | workflow_step | workflow:scan_cross_platform | 0 | 2026-11-12T16:40:05.863Z | HASH_OK |
| UAP-EV-20261112164005-fd695adc | workflow_step | workflow:scan_security | 0 | 2026-11-12T16:40:05.823Z | HASH_OK |
| UAP-EV-20261112164006-0fa00a78 | workflow_step | workflow:resolve_dependencies | 0 | 2026-11-12T16:40:06.111Z | HASH_OK |
| UAP-EV-20261112164006-1833bab3 | task_result | uap task run UAP-TASK-HEALTH-20261112164006-b29b32a7 | 0 | 2026-11-12T16:40:06.347Z | HASH_OK |
| UAP-EV-20261112164006-207a37f3 | task_step | step:implement_missing_capabilities | 0 | 2026-11-12T16:40:06.164Z | HASH_OK |
| UAP-EV-20261112164006-265f3193 | workflow_step | workflow:create_execution_plan | 0 | 2026-11-12T16:40:06.138Z | HASH_OK |
| UAP-EV-20261112164006-2c154394 | workflow_step | workflow:implement_missing_capabilities | 0 | 2026-11-12T16:40:06.163Z | HASH_OK |
| UAP-EV-20261112164006-5428bffb | task_step | step:probe.step3 | 0 | 2026-11-12T16:40:06.740Z | HASH_OK |
| UAP-EV-20261112164006-5f7ef98c | task_step | step:create_execution_plan | 0 | 2026-11-12T16:40:06.139Z | HASH_OK |
| UAP-EV-20261112164006-69d8ea44 | task_step | step:__health_step__ | 0 | 2026-11-12T16:40:06.280Z | HASH_OK |
| UAP-EV-20261112164006-71a3bd5b | task_step | step:execute_targeted_tests | 0 | 2026-11-12T16:40:06.898Z | HASH_OK |
| UAP-EV-20261112164006-84cb4f54 | recovery | uap task resume UAP-TASK-INTERRUPT-20261112164006-696b225e | 0 | 2026-11-12T16:40:06.672Z | HASH_OK |
| UAP-EV-20261112164006-84e3e7ac | workflow_step | workflow:implement_missing_validators | 0 | 2026-11-12T16:40:06.191Z | HASH_OK |
| UAP-EV-20261112164006-882474e3 | task_step | step:implement_missing_validators | 0 | 2026-11-12T16:40:06.192Z | HASH_OK |
| UAP-EV-20261112164006-9d70f104 | task_result | uap task run UAP-TASK-INTERRUPT-20261112164006-696b225e | 0 | 2026-11-12T16:40:06.808Z | HASH_OK |
| UAP-EV-20261112164006-b74a0e38 | recovery_result | uap task resume UAP-TASK-INTERRUPT-20261112164006-696b225e | 0 | 2026-11-12T16:40:06.853Z | HASH_OK |
| UAP-EV-20261112164006-befb455c | task_result | uap task run UAP-TASK-20261112164006-84d4f144 | 0 | 2026-11-12T16:40:06.970Z | HASH_OK |
| UAP-EV-20261112164006-bf49dd28 | task_result | uap task run UAP-TASK-20261112164005-66d1f4c3 | 0 | 2026-11-12T16:40:06.012Z | HASH_OK |
| UAP-EV-20261112164006-cd3fe72c | task_step | step:resolve_dependencies | 0 | 2026-11-12T16:40:06.112Z | HASH_OK |
| UAP-EV-20261112164006-d3baceb6 | workflow_step | workflow:execute_targeted_tests | 0 | 2026-11-12T16:40:06.898Z | HASH_OK |
| UAP-EV-20261112164006-dc037036 | task_step | step:integrate_runtime | 0 | 2026-11-12T16:40:06.876Z | HASH_OK |
| UAP-EV-20261112164006-debb6f67 | health_probe | evidence-engine.health() | 0 | 2026-11-12T16:40:06.855Z | HASH_OK |
| UAP-EV-20261112164006-e28ae011 | workflow_step | workflow:integrate_runtime | 0 | 2026-11-12T16:40:06.876Z | HASH_OK |
| UAP-EV-20261112164006-f29ff1ef | task_step | step:probe.step1 | 0 | 2026-11-12T16:40:06.616Z | HASH_OK |
| UAP-EV-20261112164006-fae44347 | task_step | step:probe.step2 | 0 | 2026-11-12T16:40:06.714Z | HASH_OK |
| UAP-EV-20261112164007-070b2dcf | workflow_step | workflow:classify_defect | 0 | 2026-11-12T16:40:07.071Z | HASH_OK |
| UAP-EV-20261112164007-19f0a32c | task_step | step:calculate_impact | 0 | 2026-11-12T16:40:07.124Z | HASH_OK |
| UAP-EV-20261112164007-2c7e65aa | task_step | step:persist_evidence | 0 | 2026-11-12T16:40:07.265Z | HASH_OK |
| UAP-EV-20261112164007-40009142 | workflow_step | workflow:generate_repair_plan | 0 | 2026-11-12T16:40:07.149Z | HASH_OK |
| UAP-EV-20261112164007-4a898233 | workflow_step | workflow:independent_review | 0 | 2026-11-12T16:40:07.231Z | HASH_OK |
| UAP-EV-20261112164007-555b7ea4 | task_step | step:run_regression | 0 | 2026-11-12T16:40:07.203Z | HASH_OK |
| UAP-EV-20261112164007-55731bc9 | workflow_step | workflow:run_regression | 0 | 2026-11-12T16:40:07.202Z | HASH_OK |
| UAP-EV-20261112164007-573e50d5 | task_step | step:classify_defect | 0 | 2026-11-12T16:40:07.072Z | HASH_OK |
| UAP-EV-20261112164007-62312a68 | workflow_step | workflow:identify_root_cause | 0 | 2026-11-12T16:40:07.096Z | HASH_OK |
| UAP-EV-20261112164007-6708dfdd | task_step | step:independent_review | 0 | 2026-11-12T16:40:07.231Z | HASH_OK |
| UAP-EV-20261112164007-7fe20715 | workflow_step | workflow:persist_evidence | 0 | 2026-11-12T16:40:07.259Z | HASH_OK |
| UAP-EV-20261112164007-878da92f | task_result | uap task run UAP-TASK-20261112164007-659ba4cb | 0 | 2026-11-12T16:40:07.336Z | HASH_OK |
| UAP-EV-20261112164007-901436ec | workflow_step | workflow:apply_authorized_repair | 0 | 2026-11-12T16:40:07.177Z | HASH_OK |
| UAP-EV-20261112164007-9aaa22a2 | task_step | step:apply_authorized_repair | 0 | 2026-11-12T16:40:07.178Z | HASH_OK |
| UAP-EV-20261112164007-b0d42e1e | task_step | step:generate_repair_plan | 0 | 2026-11-12T16:40:07.150Z | HASH_OK |
| UAP-EV-20261112164007-c6713f57 | task_step | step:identify_root_cause | 0 | 2026-11-12T16:40:07.096Z | HASH_OK |
| UAP-EV-20261112164007-c67b65be | workflow_step | workflow:calculate_impact | 0 | 2026-11-12T16:40:07.124Z | HASH_OK |
| UAP-EV-20261112164012-1c0e82a2 | workflow_step | workflow:typecheck | 0 | 2026-11-12T16:40:12.982Z | HASH_OK |
| UAP-EV-20261112164012-534fbd16 | task_step | step:lint | 0 | 2026-11-12T16:40:12.954Z | HASH_OK |
| UAP-EV-20261112164012-5d6facd8 | task_step | step:typecheck | 0 | 2026-11-12T16:40:12.983Z | HASH_OK |
| UAP-EV-20261112164012-5de304ff | workflow_step | workflow:lint | 0 | 2026-11-12T16:40:12.954Z | HASH_OK |
| UAP-EV-20261112164013-3512b313 | workflow_step | workflow:unit_tests | 0 | 2026-11-12T16:40:13.008Z | HASH_OK |
| UAP-EV-20261112164013-40bb1de2 | task_step | step:dependency_scan | 0 | 2026-11-12T16:40:13.401Z | HASH_OK |
| UAP-EV-20261112164013-8bb8cbb2 | task_step | step:integration_tests | 0 | 2026-11-12T16:40:13.034Z | HASH_OK |
| UAP-EV-20261112164013-9c8d7461 | task_step | step:security_scan | 0 | 2026-11-12T16:40:13.245Z | HASH_OK |
| UAP-EV-20261112164013-b2b3bf66 | task_step | step:unit_tests | 0 | 2026-11-12T16:40:13.008Z | HASH_OK |
| UAP-EV-20261112164013-c2f083b0 | task_step | step:end_to_end_tests | 0 | 2026-11-12T16:40:13.058Z | HASH_OK |
| UAP-EV-20261112164013-cada7943 | workflow_step | workflow:dependency_scan | 0 | 2026-11-12T16:40:13.401Z | HASH_OK |
| UAP-EV-20261112164013-d5258f5e | workflow_step | workflow:integration_tests | 0 | 2026-11-12T16:40:13.033Z | HASH_OK |
| UAP-EV-20261112164013-d8c291a1 | workflow_step | workflow:end_to_end_tests | 0 | 2026-11-12T16:40:13.058Z | HASH_OK |
| UAP-EV-20261112164013-e5400aba | workflow_step | workflow:security_scan | 0 | 2026-11-12T16:40:13.244Z | HASH_OK |
| UAP-EV-20261112164018-233b570f | task_step | step:code_review | 0 | 2026-11-12T16:40:18.816Z | HASH_OK |
| UAP-EV-20261112164018-2445fbf3 | task_result | uap task run UAP-TASK-20261112164007-c2fd4842 | 0 | 2026-11-12T16:40:18.884Z | HASH_OK |
| UAP-EV-20261112164018-26dc69d5 | task_step | step:inspect_payment_state_machine | 0 | 2026-11-12T16:40:18.985Z | HASH_OK |
| UAP-EV-20261112164018-43525822 | task_step | step:build | 0 | 2026-11-12T16:40:18.793Z | HASH_OK |
| UAP-EV-20261112164018-7bca74dc | workflow_step | workflow:inspect_payment_state_machine | 0 | 2026-11-12T16:40:18.984Z | HASH_OK |
| UAP-EV-20261112164018-af5a76cb | workflow_step | workflow:build | 0 | 2026-11-12T16:40:18.792Z | HASH_OK |
| UAP-EV-20261112164018-fd6e01f3 | workflow_step | workflow:code_review | 0 | 2026-11-12T16:40:18.816Z | HASH_OK |
| UAP-EV-20261112164019-00d7c001 | workflow_step | workflow:validate_all_executors | 0 | 2026-11-12T16:40:19.378Z | HASH_OK |
| UAP-EV-20261112164019-0a1ae726 | workflow_step | workflow:validate_all_agents | 0 | 2026-11-12T16:40:19.405Z | HASH_OK |
| UAP-EV-20261112164019-1155f836 | task_step | step:test_failure_recovery | 0 | 2026-11-12T16:40:19.149Z | HASH_OK |
| UAP-EV-20261112164019-14540267 | task_step | step:run_full_quality_gate | 0 | 2026-11-12T16:40:19.490Z | HASH_OK |
| UAP-EV-20261112164019-14b1a649 | workflow_step | workflow:test_idempotency | 0 | 2026-11-12T16:40:19.068Z | HASH_OK |
| UAP-EV-20261112164019-18b865da | workflow_step | workflow:test_duplicate_notifications | 0 | 2026-11-12T16:40:19.121Z | HASH_OK |
| UAP-EV-20261112164019-313bc35a | workflow_step | workflow:run_full_quality_gate | 0 | 2026-11-12T16:40:19.489Z | HASH_OK |
| UAP-EV-20261112164019-377210d2 | task_step | step:verify_reconciliation | 0 | 2026-11-12T16:40:19.175Z | HASH_OK |
| UAP-EV-20261112164019-3b469f85 | workflow_step | workflow:verify_reconciliation | 0 | 2026-11-12T16:40:19.174Z | HASH_OK |
| UAP-EV-20261112164019-3d931a74 | task_step | step:verify_recovery | 0 | 2026-11-12T16:40:19.544Z | HASH_OK |
| UAP-EV-20261112164019-3ecaa7ca | workflow_step | workflow:generate_final_report | 0 | 2026-11-12T16:40:19.567Z | HASH_OK |
| UAP-EV-20261112164019-45dba8c7 | workflow_step | workflow:test_failure_recovery | 0 | 2026-11-12T16:40:19.148Z | HASH_OK |
| UAP-EV-20261112164019-494e9bd5 | task_step | step:validate_all_workflows | 0 | 2026-11-12T16:40:19.435Z | HASH_OK |
| UAP-EV-20261112164019-4b7f6abd | workflow_step | workflow:inspect_balance_ledger | 0 | 2026-11-12T16:40:19.042Z | HASH_OK |
| UAP-EV-20261112164019-6006ecd6 | workflow_step | workflow:inspect_refund_state_machine | 0 | 2026-11-12T16:40:19.013Z | HASH_OK |
| UAP-EV-20261112164019-63969cf9 | workflow_step | workflow:verify_recovery | 0 | 2026-11-12T16:40:19.543Z | HASH_OK |
| UAP-EV-20261112164019-6b2f0452 | workflow_step | workflow:test_concurrency | 0 | 2026-11-12T16:40:19.096Z | HASH_OK |
| UAP-EV-20261112164019-702503a2 | workflow_step | workflow:validate_all_specifications | 0 | 2026-11-12T16:40:19.352Z | HASH_OK |
| UAP-EV-20261112164019-79b7082c | task_step | step:validate_all_specifications | 0 | 2026-11-12T16:40:19.352Z | HASH_OK |
| UAP-EV-20261112164019-826f818d | task_step | step:validate_all_validators | 0 | 2026-11-12T16:40:19.460Z | HASH_OK |
| UAP-EV-20261112164019-896fd713 | task_step | step:test_idempotency | 0 | 2026-11-12T16:40:19.069Z | HASH_OK |
| UAP-EV-20261112164019-93c9d272 | workflow_step | workflow:validate_all_workflows | 0 | 2026-11-12T16:40:19.433Z | HASH_OK |
| UAP-EV-20261112164019-9d3794c3 | task_result | uap task run UAP-TASK-20261112164018-f0fc75bf | 0 | 2026-11-12T16:40:19.244Z | HASH_OK |
| UAP-EV-20261112164019-a2e482b4 | task_step | step:inspect_balance_ledger | 0 | 2026-11-12T16:40:19.043Z | HASH_OK |
| UAP-EV-20261112164019-a412d5d1 | task_step | step:validate_all_executors | 0 | 2026-11-12T16:40:19.378Z | HASH_OK |
| UAP-EV-20261112164019-bc4ba729 | task_step | step:inspect_refund_state_machine | 0 | 2026-11-12T16:40:19.013Z | HASH_OK |
| UAP-EV-20261112164019-bedfa482 | workflow_step | workflow:run_end_to_end_workflows | 0 | 2026-11-12T16:40:19.512Z | HASH_OK |
| UAP-EV-20261112164019-cce8f79c | task_step | step:test_concurrency | 0 | 2026-11-12T16:40:19.096Z | HASH_OK |
| UAP-EV-20261112164019-cec89b93 | task_step | step:generate_final_report | 0 | 2026-11-12T16:40:19.573Z | HASH_OK |
| UAP-EV-20261112164019-d3b20dbb | task_step | step:run_end_to_end_workflows | 0 | 2026-11-12T16:40:19.512Z | HASH_OK |
| UAP-EV-20261112164019-d554825e | cli_command | uap workflow run --all | 0 | 2026-11-12T16:40:19.681Z | HASH_OK |
| UAP-EV-20261112164019-d8cd8e54 | task_result | uap task run UAP-TASK-20261112164019-ca41237c | 0 | 2026-11-12T16:40:19.644Z | HASH_OK |
| UAP-EV-20261112164019-de32c04a | workflow_step | workflow:validate_all_validators | 0 | 2026-11-12T16:40:19.460Z | HASH_OK |
| UAP-EV-20261112164019-ef8dd5c2 | task_step | step:test_duplicate_notifications | 0 | 2026-11-12T16:40:19.122Z | HASH_OK |
| UAP-EV-20261112164019-f7fef8e4 | task_step | step:validate_all_agents | 0 | 2026-11-12T16:40:19.405Z | HASH_OK |
| UAP-EV-20261112164033-616d8d7f | validator_result | uap validate core.evidence_integrity | 0 | 2026-11-12T16:40:33.995Z | HASH_OK |
| UAP-EV-20261112164033-8738f6e1 | validator_result | uap validate security.permission_boundary | 0 | 2026-11-12T16:40:33.825Z | HASH_OK |
| UAP-EV-20261112164033-aaaecce0 | validator_result | uap validate core.architecture_integrity | 0 | 2026-11-12T16:40:33.668Z | HASH_OK |
| UAP-EV-20261112164033-be9ac0b9 | validator_result | uap validate core.execution_integrity | 0 | 2026-11-12T16:40:33.800Z | HASH_OK |
| UAP-EV-20261112164034-10f9e340 | validator_result | uap validate architecture.adr_integrity | 0 | 2026-11-12T16:40:34.066Z | HASH_OK |
| UAP-EV-20261112164034-3a696e69 | validator_result | uap validate agents.execution_integrity | 0 | 2026-11-12T16:40:34.288Z | HASH_OK |
| UAP-EV-20261112164034-4f0f9473 | validator_result | uap validate architecture.api_database_integrity | 0 | 2026-11-12T16:40:34.064Z | HASH_OK |
| UAP-EV-20261112164034-618351b7 | validator_result | uap validate agents.recovery_integrity | 0 | 2026-11-12T16:40:34.414Z | HASH_OK |
| UAP-EV-20261112164034-63abcc66 | validator_result | uap validate architecture.consistency | 0 | 2026-11-12T16:40:34.061Z | HASH_OK |
| UAP-EV-20261112164034-a3ac96c1 | validator_result | uap validate agents.collaboration_integrity | 0 | 2026-11-12T16:40:34.291Z | HASH_OK |
| UAP-EV-20261112164034-acf5fc47 | validator_result | uap validate agents.registry_integrity | 0 | 2026-11-12T16:40:34.068Z | HASH_OK |
| UAP-EV-20261112164034-b7dac221 | validator_result | uap validate product.business_rule_integrity | 0 | 2026-11-12T16:40:34.049Z | HASH_OK |
| UAP-EV-20261112164034-bd7a8fad | validator_result | uap validate product.prototype_consistency | 0 | 2026-11-12T16:40:34.033Z | HASH_OK |
| UAP-EV-20261112164034-f3ca1869 | validator_result | uap validate product.requirement_traceability | 0 | 2026-11-12T16:40:34.015Z | HASH_OK |
| UAP-EV-20261112164035-11fc92d9 | validator_result | uap validate quality.engineering_integrity | 0 | 2026-11-12T16:40:35.784Z | HASH_OK |
| UAP-EV-20261112164035-5daf5f56 | validator_result | uap validate quality.test_integrity | 0 | 2026-11-12T16:40:35.785Z | HASH_OK |
| UAP-EV-20261112164035-6ea83747 | validator_result | uap validate development.review_integrity | 0 | 2026-11-12T16:40:35.672Z | HASH_OK |
| UAP-EV-20261112164035-7da3b02a | validator_result | uap validate quality.repair_integrity | 0 | 2026-11-12T16:40:35.901Z | HASH_OK |
| UAP-EV-20261112164035-9ee0d6ef | validator_result | uap validate development.coding_compliance | 0 | 2026-11-12T16:40:35.549Z | HASH_OK |
| UAP-EV-20261112164035-a1fcc270 | validator_result | uap validate development.dependency_integrity | 0 | 2026-11-12T16:40:35.674Z | HASH_OK |
| UAP-EV-20261112164036-4f4d5fc7 | validator_result | uap validate security.financial_integrity_validator | 0 | 2026-11-12T16:40:36.321Z | HASH_OK |
| UAP-EV-20261112164036-cf0f3513 | validator_result | uap validate security.reliability_integrity | 0 | 2026-11-12T16:40:36.465Z | HASH_OK |
| UAP-EV-20261112164036-e064e746 | validator_result | uap validate security.application_integrity | 0 | 2026-11-12T16:40:36.318Z | HASH_OK |
| UAP-EV-20261112164036-ea72a545 | validator_result | uap validate cross_platform.web_integrity | 0 | 2026-11-12T16:40:36.643Z | HASH_OK |
| UAP-EV-20261112164036-f3e7fe02 | validator_result | uap validate quality.gate_integrity | 0 | 2026-11-12T16:40:36.019Z | HASH_OK |
| UAP-EV-20261112164155-52038b4c | validator_result | uap validate cross_platform.consistency_integrity | 0 | 2026-11-12T16:41:55.792Z | HASH_OK |
| UAP-EV-20261112164155-67df6460 | validator_result | uap validate cross_platform.h5_integrity | 0 | 2026-11-12T16:41:55.736Z | HASH_OK |
| UAP-EV-20261112164155-f8d238a9 | validator_result | uap validate delivery.ci_integrity | 0 | 2026-11-12T16:41:55.796Z | HASH_OK |
| UAP-EV-20261112164205-0b5eafe0 | cli_command | uap audit | 0 | 2026-11-12T16:42:05.817Z | HASH_OK |
| UAP-EV-20261112164205-4f208c99 | validator_result | uap validate evolution.knowledge_integrity | 0 | 2026-11-12T16:42:05.658Z | HASH_OK |
| UAP-EV-20261112164205-a725a5ee | validator_result | uap validate evolution.evolution_integrity | 0 | 2026-11-12T16:42:05.761Z | HASH_OK |
| UAP-EV-20261112164205-aba3dfcd | validator_result | uap validate delivery.deployment_integrity | 0 | 2026-11-12T16:42:05.360Z | HASH_OK |
| UAP-EV-20261112164205-ffe455df | validator_result | uap validate delivery.observability_integrity | 0 | 2026-11-12T16:42:05.634Z | HASH_OK |
| UAP-EV-20261112164218-63e0e287 | cli_command | uap repair | 0 | 2026-11-12T16:42:18.429Z | HASH_OK |
| UAP-EV-20261112165211-5b73caf7 | cli_command | uap build --full | 1 | 2026-11-12T16:52:11.978Z | HASH_OK |
| UAP-EV-20261112170412-51c24fd5 | cli_command | uap build --full | 0 | 2026-11-12T17:04:12.109Z | HASH_OK |
| UAP-EV-20261112170427-f4c3d702 | cli_command | uap release check | 1 | 2026-11-12T17:04:27.568Z | HASH_OK |
| UAP-EV-TEST-20261112110157-67704179 | uap_tester_probe | uap test | 0 | 2026-11-12T11:01:57.069Z | HASH_OK |
| UAP-EV-TEST-20261112110221-fc0cdd84 | uap_tester_probe | uap test | 0 | 2026-11-12T11:02:21.760Z | HASH_OK |
| UAP-EV-TEST-20261112110235-cd846fe0 | uap_tester_probe | uap test | 0 | 2026-11-12T11:02:35.979Z | HASH_OK |
| UAP-EV-TEST-20261112121710-dddf1c9e | uap_tester_probe | uap test | 0 | 2026-11-12T12:17:10.320Z | HASH_OK |
| UAP-EV-TEST-20261112142321-e916bfe1 | uap_tester_probe | uap test | 0 | 2026-11-12T14:23:21.737Z | HASH_OK |
| UAP-EV-TEST-20261112143634-3f6b7760 | uap_tester_probe | uap test | 0 | 2026-11-12T14:36:34.183Z | HASH_OK |
| UAP-EV-TEST-20261112150836-b57ded96 | uap_tester_probe | uap test | 0 | 2026-11-12T15:08:36.999Z | HASH_OK |
| UAP-EV-TEST-20261112151503-eeda8f92 | uap_tester_probe | uap test | 0 | 2026-11-12T15:15:03.966Z | HASH_OK |
| UAP-EV-TEST-20261112151831-c250d178 | uap_tester_probe | uap test | 0 | 2026-11-12T15:18:31.666Z | HASH_OK |
| UAP-EV-TEST-20261112152055-d6c1fe0b | uap_tester_probe | uap test | 0 | 2026-11-12T15:20:55.308Z | HASH_OK |
| UAP-EV-TEST-20261112152110-30ad288a | uap_tester_probe | uap test | 0 | 2026-11-12T15:21:10.370Z | HASH_OK |
| UAP-EV-TEST-20261112152416-d9b3adb4 | uap_tester_probe | uap test | 0 | 2026-11-12T15:24:16.783Z | HASH_OK |
| UAP-EV-TEST-20261112152432-0456a7c7 | uap_tester_probe | uap test | 0 | 2026-11-12T15:24:32.386Z | HASH_OK |
| UAP-EV-TEST-20261112163954-3c4f841b | uap_tester_probe | uap test | 0 | 2026-11-12T16:39:54.562Z | HASH_OK |
| UAP-EV-TEST-20261112164004-302681bc | uap_tester_probe | uap test | 0 | 2026-11-12T16:40:04.867Z | HASH_OK |


## 证据契约

每条证据含 `evidence_id / kind / recorded_at / environment / command / exit_code / duration_ms / inputs(stdout,stderr 已脱敏) / findings / summary / content_hash`。
