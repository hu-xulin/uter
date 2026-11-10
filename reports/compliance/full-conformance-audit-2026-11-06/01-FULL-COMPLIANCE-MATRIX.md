# AES × Uter 全量符合性矩阵

- **Document:** `1/14` of §11 (14 mandated deliverables)
- **Generated:** 2026-11-09T05:04:20Z
- **Uter commit SHA:** `ec6501adceb008d46140a7e5ab6508eb78006731`
- **AES commit SHA:** `0c9386b192090e901ccc5de6df1f2aebe3f5c618`
- **Execution environment:** macOS-26.7.2-x86_64-i386-64bit-Mach-O
- **Collector:** WorkBuddy (Tencent Hunyuan Hy)
- **Evidence root:** `reports/compliance/full-conformance-audit-2026-11-06/evidence/`

> 本文件由真实仓库状态与真实命令退出码生成。未执行的验证一律记为 `NOT_RUN` / `BLOCKED`，
> 绝不以文档、代码改动或 Agent 自述代替工程验证（§12 / §13）。

---


## 1. 结论摘要

| 指标 | 值 |
|---|---|
| 唯一 Requirement ID 总数 | **2884** |
| 适用要求 (APPLICABLE) | 2872 |
| 不适用 (NOT_APPLICABLE，均附书面依据) | 12 |
| 逐条验证为 PASS | **0** |
| 审计结果分布 | `{"NOT_ASSESSED": 2843, "NOT_APPLICABLE": 12, "BLOCKED": 29}` |
| 源标准状态 | `{"APPROVED": 2855, "PROPOSED_BASELINE": 29}` |
| AES DRAFT 标准文件 | 0/178 |
| 域级测试矩阵（同 SHA） | 28/29 PASS，overall `FAIL` |
| 绑定的真实 Commit SHA | `ec6501adceb008d46140a7e5ab6508eb78006731` |

**结论：适用要求全部 `BLOCKED`。** 根因是 AES 规范性基线未逐条批准（FIND-FCA-001），
且仓库不存在逐条实现映射与逐条验证（FIND-FCA-002）。域级命令仅登记为 `INDIRECT`，
绝不提升任何单条要求为 PASS。

## 2. §3 十五字段

`evidence/02-compliance-matrix.json` 每条记录包含：Requirement ID、AES Domain、
Requirement Description、Source Standard、Source Version、Applicability、
Implementation Location、Verification Method、Acceptance Criteria、Evidence Location、
Audit Result、Finding ID、Corrective Action、Revalidation Result，以及补充的
source_line / source_status / normative_level / keyword_class / commit_sha /
applicability_justification / linked_real_commands / linked_manual_cases。

完整 2884 行同时导出为 `evidence/matrix-export.csv`（UTF-8），
可用任意表格工具按 `source_standard + source_line` 回查 AES 原文重新核验。

## 3. 逐域要求数

| Domain | 名称 | 要求数 | PASS | BLOCKED | NOT_APPLICABLE |
|---|---|---|---|---|---|
| P00 | Foundation | 130 | 0 | 0 | 0 |
| P01 | AI Governance | 105 | 0 | 0 | 0 |
| P02 | Product Engineering | 124 | 0 | 0 | 0 |
| P03 | Knowledge Engineering | 137 | 0 | 0 | 0 |
| P04 | System Architecture | 418 | 0 | 0 | 12 |
| P05 | Experience & Design Engineering | 244 | 0 | 0 | 0 |
| P06 | Software Engineering | 297 | 0 | 0 | 0 |
| P07 | Cross-Platform Engineering | 238 | 0 | 0 | 0 |
| P08 | AI Agent Engineering | 298 | 0 | 0 | 0 |
| P09 | Quality Engineering | 220 | 0 | 0 | 0 |
| P10 | Security & Reliability | 209 | 0 | 0 | 0 |
| P11 | DevOps & Delivery | 196 | 0 | 0 | 0 |
| P12 | Lifecycle & Evolution | 239 | 0 | 0 | 0 |
| UTER-P13 | UTER Business Domain Engineering | 29 | 0 | 29 | 0 |


## 4. 无跳过证明（覆盖账本）

| 项 | 行数 |
|---|---|
| 扫描总行数 | 19179 |
| 已登记各类型合计 | 19179 |
| 差额（必须为 0） | **0** |

| 分类 | 行数 |
|---|---|
| lines_scanned | 19179 |
| skipped_non_normative | 10041 |
| skipped_blank | 5298 |
| recorded_cn_mandatory | 1246 |
| recorded_en_mandatory | 1596 |
| skipped_fence_marker | 130 |
| skipped_fence_content | 680 |
| skipped_short_fragment | 146 |
| recorded_recommended | 30 |
| recorded_reference_row | 12 |


匹配器：EN `MUST/MUST NOT/SHALL/SHALL NOT/REQUIRED/PROHIBITED` +
中文 `不得/必须/禁止/严禁/应当/不应` + `SHOULD/SHOULD NOT` + native-ID 引用行。
代码围栏内内容、空行、非规范性描述行均按显式理由计入 `skipped_*`，不会静默丢弃。

## 5. 复现命令

```bash
python3 scripts/quality/full-conformance-audit.py baseline matrix domains
python3 -c "import json;d=json.load(open('reports/compliance/full-conformance-audit-2026-11-06/evidence/02-compliance-matrix.json'));print(d['summary'])"
```

## 6. 状态语义

`BLOCKED` / `NOT RUN` / `NOT ASSESSED` 一律不等于 PASS（§13）。本矩阵中
`implementation_location` 为 `NOT MAPPED` 是真实缺口，不是隐藏跳过。
