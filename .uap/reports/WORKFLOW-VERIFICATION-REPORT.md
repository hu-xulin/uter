# Workflow Verification Report

> 由 `./uap report` 依据真实运行产物生成 · 2026-11-16T12:10:57.625Z · UAP 1.0.0
> 数据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与实时文件系统探测。

## 7 个注册工作流

| ID | 名称 | 步骤数 | 验收条件 |
| --- | --- | --- | --- |
| uap-bootstrap | UAP Bootstrap | 6 | runtime_health_check |
| uap-full-audit | Full Governance Audit | 11 | audit_evidence_complete |
| uap-implementation | Governance Implementation | 6 | implementation_verified |
| uap-defect-repair | Bounded Defect Repair | 8 | defect_verified_or_blocked |
| uap-quality-gate | Quality Gate | 9 | all_required_gates_pass |
| uap-financial-verification | Financial Integrity Verification | 8 | financial_integrity_verified |
| uap-final-verification | Final Verification | 9 | full_operational_acceptance |


## 端到端运行记录

| 工作流 | 状态 | 步骤 | 成功 | 未完成 | 证据数 | run_id |
| --- | --- | --- | --- | --- | --- | --- |
| uap-bootstrap | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261112143631-4196c0cf |
| uap-full-audit | SUCCEEDED | 11 | 11 | 0 | 12 | UAP-RUN-UAP-TASK-20261112143634-a399726a |
| uap-implementation | BLOCKED | 6 | 5 | 1 | 7 | UAP-RUN-UAP-TASK-20261112143634-31f21b4e |
| uap-defect-repair | BLOCKED | 8 | 5 | 3 | 7 | UAP-RUN-UAP-TASK-20261112143635-bbbe5f03 |
| uap-quality-gate | BLOCKED | 9 | 2 | 7 | 4 | UAP-RUN-UAP-TASK-20261112143636-65a4b482 |
| uap-financial-verification | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261112143641-9c96d80b |
| uap-final-verification | BLOCKED | 9 | 5 | 4 | 7 | UAP-RUN-UAP-TASK-20261112143642-1cd047e6 |
| uap-quality-gate | BLOCKED | 9 | 2 | 7 | 4 | UAP-RUN-UAP-TASK-20261112143754-15f94101 |
| uap-bootstrap | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261112150835-24b97f9e |
| uap-full-audit | SUCCEEDED | 11 | 11 | 0 | 12 | UAP-RUN-UAP-TASK-20261112150837-c6171bf0 |
| uap-implementation | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261112150837-a0e504e8 |
| uap-defect-repair | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261112150838-90f31104 |
| uap-quality-gate | BLOCKED | 9 | 5 | 4 | 7 | UAP-RUN-UAP-TASK-20261112150838-609e5147 |
| uap-financial-verification | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261112150843-f5c0468f |
| uap-final-verification | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261112150844-1c18b28e |
| uap-implementation | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261112151158-bddd9382 |
| uap-bootstrap | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261112151501-65f1905a |
| uap-full-audit | SUCCEEDED | 11 | 11 | 0 | 12 | UAP-RUN-UAP-TASK-20261112151504-e08d314a |
| uap-implementation | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261112151504-7f56aae3 |
| uap-defect-repair | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261112151505-80d6e859 |
| uap-quality-gate | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261112151505-5fda0eab |
| uap-financial-verification | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261112151516-b136c077 |
| uap-final-verification | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261112151516-3922d161 |
| uap-bootstrap | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261112152052-7430c80b |
| uap-full-audit | SUCCEEDED | 11 | 11 | 0 | 12 | UAP-RUN-UAP-TASK-20261112152055-1eca1df6 |
| uap-implementation | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261112152056-bebdfcbb |
| uap-defect-repair | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261112152057-0f723d17 |
| uap-quality-gate | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261112152057-0316a361 |
| uap-financial-verification | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261112152108-13b9aef4 |
| uap-final-verification | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261112152108-eac30954 |
| uap-bootstrap | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261112152414-470bed81 |
| uap-full-audit | SUCCEEDED | 11 | 11 | 0 | 12 | UAP-RUN-UAP-TASK-20261112152417-22491855 |
| uap-implementation | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261112152417-e45dc2e5 |
| uap-defect-repair | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261112152418-ba1878fb |
| uap-quality-gate | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261112152419-1313c9ed |
| uap-financial-verification | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261112152429-18858a85 |
| uap-final-verification | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261112152430-130b6d45 |
| uap-bootstrap | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261112164002-cd43eca9 |
| uap-full-audit | SUCCEEDED | 11 | 11 | 0 | 12 | UAP-RUN-UAP-TASK-20261112164005-66d1f4c3 |
| uap-implementation | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261112164006-84d4f144 |
| uap-defect-repair | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261112164007-659ba4cb |
| uap-quality-gate | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261112164007-c2fd4842 |
| uap-financial-verification | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261112164018-f0fc75bf |
| uap-final-verification | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261112164019-ca41237c |
| uap-bootstrap | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261113014639-096a688f |
| uap-bootstrap | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261113014700-e663b0d7 |
| uap-bootstrap | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261113014718-26adf2c8 |
| uap-bootstrap | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261113030912-c6f58b54 |
| uap-full-audit | SUCCEEDED | 11 | 11 | 0 | 12 | UAP-RUN-UAP-TASK-20261113030923-9bb3bff5 |
| uap-implementation | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261113030924-cd793a91 |
| uap-defect-repair | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261113030926-89b73439 |
| uap-quality-gate | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261113030927-9eb3a4ea |
| uap-financial-verification | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261113030938-de5d2667 |
| uap-final-verification | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261113030939-727d8b32 |
| uap-bootstrap | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261113111445-0ec2bee3 |
| uap-full-audit | SUCCEEDED | 11 | 11 | 0 | 12 | UAP-RUN-UAP-TASK-20261113111508-dc87359f |
| uap-implementation | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261113111510-176df4e7 |
| uap-defect-repair | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261113111513-98cfd4f7 |
| uap-quality-gate | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261113111514-3a06f53e |
| uap-financial-verification | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261113111531-4286d335 |
| uap-final-verification | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261113111532-283162f8 |
| uap-bootstrap | BLOCKED | 6 | 5 | 1 | 7 | UAP-RUN-UAP-TASK-20261113151538-4955dc11 |
| uap-full-audit | SUCCEEDED | 11 | 11 | 0 | 12 | UAP-RUN-UAP-TASK-20261113151614-9d8cf59d |
| uap-implementation | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261113151617-8741d2fd |
| uap-defect-repair | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261113151620-a3e0dea6 |
| uap-quality-gate | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261113151622-2f85e354 |
| uap-financial-verification | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261113151641-a104f800 |
| uap-final-verification | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261113151643-9fb33032 |
| uap-bootstrap | BLOCKED | 6 | 5 | 1 | 7 | UAP-RUN-UAP-TASK-20261113152327-feb0fc34 |
| uap-full-audit | SUCCEEDED | 11 | 11 | 0 | 12 | UAP-RUN-UAP-TASK-20261113152400-7acd912c |
| uap-implementation | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261113152402-cf7ba4c8 |
| uap-defect-repair | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261113152405-4e4dca13 |
| uap-quality-gate | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261113152407-6d210002 |
| uap-financial-verification | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261113152426-96573fcc |
| uap-final-verification | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261113152428-75d1c464 |
| uap-bootstrap | BLOCKED | 6 | 5 | 1 | 7 | UAP-RUN-UAP-TASK-20261116091154-fd9b600c |
| uap-full-audit | SUCCEEDED | 11 | 11 | 0 | 12 | UAP-RUN-UAP-TASK-20261116091256-10b2a1fa |
| uap-implementation | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261116091305-3cd04bd4 |
| uap-defect-repair | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261116091316-f684d6c7 |
| uap-quality-gate | BLOCKED | 9 | 5 | 4 | 7 | UAP-RUN-UAP-TASK-20261116091322-58bc6ffe |
| uap-financial-verification | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261116091342-cfaa3c66 |
| uap-final-verification | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261116091348-6094e32d |
| uap-bootstrap | BLOCKED | 6 | 5 | 1 | 7 | UAP-RUN-UAP-TASK-20261116101329-70c4589d |
| uap-full-audit | SUCCEEDED | 11 | 11 | 0 | 12 | UAP-RUN-UAP-TASK-20261116101450-eefd865f |
| uap-implementation | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261116101500-9491e9f7 |
| uap-defect-repair | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261116101512-57a6bb91 |
| uap-quality-gate | BLOCKED | 9 | 5 | 4 | 7 | UAP-RUN-UAP-TASK-20261116101520-48c38fe5 |
| uap-financial-verification | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261116101546-b8971bc4 |
| uap-final-verification | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261116101554-3d7f4bb0 |
| uap-bootstrap | BLOCKED | 6 | 5 | 1 | 7 | UAP-RUN-UAP-TASK-20261116103147-e7c3e515 |
| uap-full-audit | SUCCEEDED | 11 | 11 | 0 | 12 | UAP-RUN-UAP-TASK-20261116103307-77262651 |
| uap-implementation | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261116103318-bcb6712d |
| uap-defect-repair | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261116103330-e3c083d9 |
| uap-quality-gate | BLOCKED | 9 | 5 | 4 | 7 | UAP-RUN-UAP-TASK-20261116103338-6e3745c6 |
| uap-financial-verification | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261116103402-d1dbc16d |
| uap-final-verification | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261116103410-2e551e1a |
| uap-bootstrap | BLOCKED | 6 | 5 | 1 | 7 | UAP-RUN-UAP-TASK-20261116103505-0763b234 |
| uap-full-audit | SUCCEEDED | 11 | 11 | 0 | 12 | UAP-RUN-UAP-TASK-20261116103755-08fc591d |
| uap-implementation | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261116103806-e7cc351f |
| uap-defect-repair | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261116103820-1a307292 |
| uap-quality-gate | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261116103828-c4ff3db0 |
| uap-financial-verification | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261116103912-b29b5fc1 |
| uap-final-verification | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261116103920-5e3bd35d |
| uap-bootstrap | BLOCKED | 6 | 5 | 1 | 7 | UAP-RUN-UAP-TASK-20261116104714-9748f06e |
| uap-bootstrap | BLOCKED | 6 | 5 | 1 | 7 | UAP-RUN-UAP-TASK-20261116105241-3d2b0cdb |
| uap-full-audit | SUCCEEDED | 11 | 11 | 0 | 12 | UAP-RUN-UAP-TASK-20261116105555-e5659817 |
| uap-implementation | SUCCEEDED | 6 | 6 | 0 | 7 | UAP-RUN-UAP-TASK-20261116105608-6d769ea7 |
| uap-defect-repair | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261116105622-9928e615 |
| uap-quality-gate | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261116105632-3bc281b3 |
| uap-financial-verification | SUCCEEDED | 8 | 8 | 0 | 9 | UAP-RUN-UAP-TASK-20261116105720-c87eefa9 |
| uap-final-verification | SUCCEEDED | 9 | 9 | 0 | 10 | UAP-RUN-UAP-TASK-20261116105729-4df34a4e |
| uap-bootstrap | BLOCKED | 6 | 5 | 1 | 7 | UAP-RUN-UAP-TASK-20261116113332-14514bc1 |
| uap-bootstrap | BLOCKED | 6 | 5 | 1 | 7 | UAP-RUN-UAP-TASK-20261116113708-0ecde8f8 |


## 汇总

注册 7；已运行 113；成功 94。
