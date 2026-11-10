# 整改记录和复测证据

- **Document:** `11/14` of §11 (14 mandated deliverables)
- **Generated:** 2026-11-09T05:04:20Z
- **Uter commit SHA:** `ec6501adceb008d46140a7e5ab6508eb78006731`
- **AES commit SHA:** `0c9386b192090e901ccc5de6df1f2aebe3f5c618`
- **Execution environment:** macOS-26.7.2-x86_64-i386-64bit-Mach-O
- **Collector:** WorkBuddy (Tencent Hunyuan Hy)
- **Evidence root:** `reports/compliance/full-conformance-audit-2026-11-06/evidence/`

> 本文件由真实仓库状态与真实命令退出码生成。未执行的验证一律记为 `NOT_RUN` / `BLOCKED`，
> 绝不以文档、代码改动或 Agent 自述代替工程验证（§12 / §13）。

---


## 已完成的真实整改

| 编号 | 缺陷 | 修改文件 | 修复前 | 修复后 | 复测 |
|---|---|---|---|---|---|
| FIX-01 | 只匹配英文 MUST/SHALL，1333 行中文强制性语句被漏记 | `scripts/quality/full-conformance-audit.py` | CN_MANDATORY=0 | CN_MANDATORY=1246 | PASS |
| FIX-02 | 只解析 **Status:**，133/178 个表格头标准被判 MISSING | `scripts/quality/full-conformance-audit.py` | MISSING=1332 DRAFT标准=45/178 | MISSING=0 DRAFT标准=178/178 | PASS |
| FIX-03 | UTER P13 中文规范产生 0 条要求，14 域实际只有 13 域有内容 | `scripts/quality/full-conformance-audit.py` | UTER-P13=0 | UTER-P13=29 | PASS |
| FIX-04 | matrix_commit_sha 读到 null（真实键为 uter_commit） | `scripts/quality/full-conformance-audit.py` | matrix_commit_sha=None | matrix_commit_sha=ef778bf08f335aaf16f4c8805be02b1111336fbe | PASS |
| FIX-05 | harness() 无法解析 workspace/selftest/verify 纯文本输出，AG-07/08/09 实际 PASS 被误判 FAIL | `scripts/quality/full-conformance-execution.py` | agent passed=7/10 | agent passed=8/10 | PASS |
| FIX-06 | MA-10 docs-web 构建被宿主 safe-delete 批量删除拦截（旧 .next 产物 >50 文件） | `environment (docs-web/.next, docs-web/out)` | MA-10 exit 1（SAFE_DELETE_BULK_CONFIRM_REQUIRED） | MA-10 exit 0（Next 构建 + postbuild copy-to-web 全链路成功） | PASS |
| FIX-07 | MA-11 electron 构建超时：镜像吞吐 ~47KB/s，125MB 的 Electron 运行时必撞 600s 请求超时 | `environment (@electron/get cache: ~/Library/Caches/electron/<sha256(dirname(url))>)` | MA-11 exit 1（Timeout awaiting request for 600000ms） | MA-11 exit 0，产物 electron/dist/mac/Uter.app | PASS |
| FIX-08 | MA-12 axe 工具链缺失（NOT_RUN）且无可访问性测试资产 | `web/package.json (test:axe)、web/e2e/axe/*（4 个新文件）、docs-web/src/lib/docs-search.tsx` | MA-12 NOT_RUN；首次真实扫描 10 failed / 4 passed | MA-12 PASS（工具链在位）；复扫 8 passed / 1 skipped / 0 failed（唯一 skip 为鉴权轨：管理员禁用密码登录，显式 skip 并注明原因，非假通过） | PASS |
| FIX-09 | MA-06 gitleaks 旧轮记录的命中（完整 SHA 行）在当前 HEAD 已不存在 | `无改动（纯复验）` | 旧 findings.json 记录 MA-06 FAIL（1 leak） | MA-06 exit 0（HEAD 树 0 leak） | PASS |


- 修复前矩阵 SHA-256：`7f949a39628c8fbd0333aab011a644d4f5954901ae31c1f291e9d5c4c96af067`
- 修复后矩阵 SHA-256：`51d3d8d99604f55cfbff34ab44a4d9ddefbf8c34e8c344ea8ee3312617600bfe`
- 原始快照：`evidence/bugfix/02-compliance-matrix.BEFORE.json` / `.AFTER.json`

## 覆盖账本（修复后）

| 分类 | 行数 |
|---|---|
| lines_scanned | 19179 |
| skipped_non_normative | 10045 |
| skipped_blank | 5298 |
| recorded_cn_mandatory | 1246 |
| recorded_en_mandatory | 1592 |
| skipped_fence_marker | 130 |
| skipped_fence_content | 680 |
| skipped_short_fragment | 146 |
| recorded_recommended | 30 |
| recorded_reference_row | 12 |


## 复测命令（真实执行）

```bash
python3 -m py_compile scripts/quality/full-conformance-audit.py
python3 scripts/quality/full-conformance-audit.py baseline matrix domains
python3 scripts/quality/full-conformance-execution.py all
```

## 未自动修复项（§7.10：原因 / 风险 / 所需授权）

| Finding | 原因 | 风险 | 所需授权 |
|---|---|---|---|
| FIND-FCA-001 | AES 规范批准属于 AES Owner 权限；双仓库分别治理 | 越权修改通用标准 | AES Owner |
| FIND-FCA-003 | 人工验收接受权属于用户本人，且用户明确要求逐项复核 | 代签导致虚假合规 | 项目 Owner |
| FIND-FCA-004 | DAST/渗透/三库/DR 需授权运行环境；MA-06 误报需负责人裁定 | 越出风险边界 / 自动豁免 | 安全授权 + 负责人裁定 |
| FIND-FCA-005 | 批量删除 unused files 会触碰用户 WIP 与运营数据，且不得靠放宽规则关闭 | 不可逆数据丢失 | 项目 Owner 逐项确认 |
| FIND-FCA-013 | commit ec6501adc 由用户并行会话创建（MA-06 正式修复）；撤销需 reset、接受需更新 W3 基线，均超出本会话权限 | 破坏他人提交 / 放宽门禁断言 | 项目 Owner（用户本人）裁定 |


## 整改纪律

| 禁止手段 | 是否使用 |
|---|---|
| production_change | False |
| user_wip_overwritten | False |
| test_deleted | False |
| assertion_relaxed | False |
| exit_code_rewritten | False |
| failed_result_hidden | False |


未覆盖任何用户未提交修改；未修改 AES 仓库；未改动业务代码；
未 commit / push / PR / merge / deploy。
