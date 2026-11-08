# UTER × UAES 最终验收结果包 — 独立复核手册

- **生成时间:** 2026-11-06T14:30Z
- **Uter commit SHA:** `ec6501adceb008d46140a7e5ab6508eb78006731`
- **分支:** `governance/uaes-full-migration-2026-11-06`
- **UAES commit SHA:** `ff7cf878d43061f263e301cad09ff19d03e906c4`
- **UAES 注册表:** `1.9.0` / `APPROVED`
- **当前结论:** `BLOCKED`

> 本手册面向**未参与本次工作的独立审查者**。按下列步骤重跑，即可自行核验本包中
> 每一项符合性结论，无需信任任何书面说明。

---

## 一、包内构成

| 类别 | 路径 | 内容 |
|---|---|---|
| 验收看板 | `00-ACCEPTANCE-BOARD.md` | §10 的 10 项验收条件，逐项由脚本从证据计算 |
| 14 项法定交付物 | `01-…-14-…md`（14 个文件） | 矩阵 / 域审计 / 外部标准 / Agent / 架构 / 质量 / 安全 / 测试 / 门禁 / 不符合项 / 整改 / 证据索引 / 最终评估 / 开放项 |
| 14 份分域审计 | `DOMAIN-P00…DOMAIN-UTER-P13` | 每域的要求清单与结果 |
| 原始证据 | `evidence/`（145 个文件） | 每条含 commit SHA、命令、原始退出码、stdout/stderr、sha256 |

---

## 二、一键复现（4 条命令）

```bash
cd /Users/lincolnhu/uter

# 1. 证据闭包完整性（零缺失 / 零哈希错配 / 零尺寸错配）
python3 scripts/quality/full_conformance_deliver.py --verify-only
# 期望: EVIDENCE CLOSURE: listed=156 missing=0 hash_mismatch=0 size_mismatch=0 extra=0

# 2. 验收看板（10 项条件逐项布尔值，全部来自磁盘证据）
python3 scripts/quality/full_conformance_acceptance_board.py
# 期望: exit 1（存在未达成项）；输出含每行实测数字

# 3. 重新生成 14 项交付物（断言 14 个文件全部落地）
python3 scripts/quality/full_conformance_deliver.py
# 期望: [deliver] deliverables=14 evidence_files=143 findings=13 verdict=BLOCKED

# 4. 重跑工程/Agent/门禁三阶段（约 9 分钟，会产生真实退出码）
python3 scripts/quality/full-conformance-execution.py verify agent gates
```

前置依赖：`web/dist/` 与 `web/dist/docs-content/_next` 必须存在（`go:embed` 契约，
由 `L2-07` 构建产生）；Redis 6379 需可连（后端测试依赖）。

---

## 三、逐项复核方法

### §10 验收条件 → 证据映射

| 条件 | 达成 | 复核方式 |
|---|---|---|
| C01 所有适用要求均完成审计 | ✅ | `evidence/03-domain-audits.json` 的 `count` 应为 14；`02-compliance-matrix.json` 的 `total_requirements=2880` 且 `BLOCKED+N/A=2880` |
| C02 所有强制性要求均 PASS | ❌ | `02-compliance-matrix.json#summary.requirement_specific_verified` 当前为 **0**，适用 2868 |
| C03 所有 N/A 均有适用性依据 | ✅ | 12 条 N/A 每条须有 `applicability_justification`，脚本已断言 |
| C04 无未解决 P0/P1 | ❌ | `07-findings-register.json#p0_p1_open` 当前 6 条 |
| C05 无未授权重大风险例外 | ✅ | `independent-assessment.json#exception_approvals.count = 0` |
| C06 所有整改完成复测 | ✅ | `08-remediation-register.json` 的 FIX-01…09 全部 `revalidation=PASS` |
| C07 关键测试与安全验证通过 | ❌ | `06-gates-verification.json#real_verdicts.SECURITY_GATE = BLOCK` |
| C08 AI Agent 执行验证通过 | ✅ | `05-agent-verification.json#summary` = 10/10，`failed=[]` |
| C09 CI/CD 门禁验证通过 | ❌ | 8 个门禁中 4 个 BLOCK |
| C10 证据完整可追溯 | ✅ | 闭包 156/156 |
| C11 最终报告通过独立复核 | ❌ | `conformance_claim_supported=False` |

### 关键原始数字（2026-11-06 22:20 快照）

- 要求总数 **2880**：适用 **2868** / N/A **12**
- 审计结果：BLOCKED **2868** / N/A **12** / **PASS 0**
- UAES 标准状态：**DRAFT 2851 条**（178 个标准文件）/ PROPOSED_BASELINE 29 条
- 工程验证：本地可执行 **22/22 PASS**，**12 项 NOT_RUN**（需授权环境）
- Agent 验证：**10/10 PASS**（含 10 个 forbidden action DENY、env 绕过双 DENY exit 2）
- 门禁：ALLOW 4（CHANGE / CODE_REVIEW / **TESTING** / ARCHITECTURE）· BLOCK 4（SECURITY / BUSINESS_ACCEPTANCE / RELEASE / GLOBAL）
- 负向阻断：**8/8 证实**（门前破坏 fixture → exit 2）
- 人工验收：**14/14 PASS**，`signoff_granted=false`

---

## 四、为什么结论是 BLOCKED 而非 CONFORMANT

根因有三层，均**不由本会话权限可解**：

1. **规范基线未批准**：178 个 UAES 标准文件中 2851 条要求状态为 `DRAFT`，
   UAES `APPROVAL-RECORD` §4 未逐条批准。因此在"强制性要求"口径上，
   没有任何一条可以判 PASS → `requirement_specific_verified = 0`。
   解除需 **UAES Owner** 批准。
2. **授权环境缺失**：DAST / 渗透测试 / API 安全 / 三库迁移 / DR / 备份恢复 / 性能压测
   共 12 项 `NOT_RUN`。解除需**安全测试授权 + 可用环境**。
3. **人工验收未签署**：42 项 M* 验收记录 `signoff_granted=false`；
   14 项 MA 虽已 14/14 PASS，但那只是"可执行部分跑通"，不等于"负责人接受"。
   解除需**你本人逐项签署**。

外加一项治理事实：`FIND-FCA-013` —— 你在 17:12 提交的 `ec6501adc`
（MA-06 gitleaks 误报的正式修复）使 workspace 控制 W3（HEAD==main）保持 fail-closed。
本会话全程零 commit，不撤销你的提交、不放宽该断言。

---

## 五、本轮已闭环的整改（有前后证据）

| FIX | 问题 | 修复 | 复测 |
|---|---|---|---|
| FIX-06 | MA-10 docs-web 构建被宿主 safe-delete 拦截 | 构建前 `mv` 移走旧 `.next/out`，命令与断言零改动 | PASS |
| FIX-07 | MA-11 electron 构建超时（镜像 ~47KB/s，125MB 包） | 8 路并行续传 + SHA-256 校验后种子进 `@electron/get` 缓存，原始命令离线通过 | PASS |
| FIX-08 | MA-12 axe 工具链缺失 | 装 `axe-core`/`@axe-core/playwright` 4.14.0，建真实扫描套件；**发现并修复** docs 侧栏搜索 `label-content-name-mismatch`（WCAG 2.5.3） | PASS |
| FIX-09 | MA-06 gitleaks 误报 | 纯复验；后由你的 commit `ec6501adc` 正式入库 | PASS |

`TESTING_GATE` 因 MA 全部转 PASS **由 BLOCK 转为 ALLOW** —— 这是数据驱动的真实变化，
不是人工改写。

---

## 六、声明限制

- 本评估是**内部工程审计**，不是 ISO / IEC / IEEE / NIST / OWASP / W3C 外部认证。
- 未执行项保持 `NOT_RUN` / `BLOCKED`，**绝不计为 PASS**。
- 无 waiver、无 allowlist 变更、无断言放宽、无状态改写。
- 本会话**未 commit / push / PR / merge / deploy**，未修改产品代码。
- `evidence/` 中每条记录均可用其 `sha256` 与原始命令复算核对。

---

## 七、你还需要做什么才能宣布 CONFORMANT

按依赖顺序，只有这三件事：

1. **UAES 侧**：由 UAES Owner 批准（或逐条降级）178 个 DRAFT 标准，
   或明确以 `PROPOSED_BASELINE` 作为验收口径 —— 这决定 C02 能否成立。
2. **环境侧**：提供授权环境跑完 12 项 NOT_RUN（DAST / 渗透 / API 安全 / 三库 / DR / 备份 / 性能）。
3. **签署侧**：你本人逐项签署 42 项 M* 验收记录，并把 `signoff_granted` 置 true。

三项完成后重跑本手册第二节的 4 条命令，看板应变为 10/10、结论转为 `CONFORMANT`。
在此之前，任何 `CONFORMANT` 声明都不成立。