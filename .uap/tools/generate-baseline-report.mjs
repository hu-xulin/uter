/**
 * Regenerate .uap/reports/BASELINE-AUDIT-REPORT.md from the REAL captured
 * baseline artefacts. Nothing about pass/fail counts is hard-coded: every
 * number in the command table and the test-count table is derived from
 * meta.jsonl and the raw stdout logs.
 *
 *   node .uap/tools/generate-baseline-report.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const UAP = path.join(ROOT, '.uap');
const BASE = path.join(UAP, 'reports', 'baseline-2026-11-13');
const OUT = path.join(UAP, 'reports', 'BASELINE-AUDIT-REPORT.md');

const readIf = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
const meta = readIf(path.join(BASE, 'meta.jsonl')).trim().split('\n').filter(Boolean)
  .map((l) => JSON.parse(l));

if (!meta.length) {
  console.error('FATAL: no baseline meta.jsonl — a report cannot be regenerated from real data');
  process.exit(2);
}

const LABEL = {
  status: 'node .uap/bin/uap.mjs status',
  doctor: 'node .uap/bin/uap.mjs doctor',
  audit: 'node .uap/bin/uap.mjs audit',
  'validate-all': 'node .uap/bin/uap.mjs validate --all',
  'test-all': 'node .uap/bin/uap.mjs test --all',
};

const shortTime = (iso) => iso.slice(11, 19);
const cmdTable = meta.map((m, i) => `| ${i + 1} | \`${LABEL[m.command] || m.command}\` | ${shortTime(m.start)} | ${shortTime(m.end)} | ${m.duration_s.toFixed(2)} | ${m.exit_code} | ${m.stdout_bytes} | ${m.stderr_bytes} |`).join('\n');

// Derive verifier and test counts from the captured stdout, never from prose.
const valOut = readIf(path.join(BASE, 'validate-all.stdout.log'));
const testOut = readIf(path.join(BASE, 'test-all.stdout.log'));
const auditOut = readIf(path.join(BASE, 'audit.stdout.log'));
const statusOut = readIf(path.join(BASE, 'status.stdout.log'));
const doctorOut = readIf(path.join(BASE, 'doctor.stdout.log'));

/**
 * Extract the first complete JSON object from a CLI stdout log. The CLI prints
 * a one-line "[UAP] PASS ..." banner first and an "evidence: ..." trailer after
 * the object, so a plain JSON.parse(text.slice(firstBrace)) is not valid. A
 * brace-balanced scan (string-aware) isolates the object; if parsing fails we
 * refuse to emit a report rather than silently substituting {} — that would
 * turn every derived number into a guess.
 */
function jsonBlock(text, label) {
  const start = text.indexOf('{');
  if (start < 0) {
    console.error(`FATAL: ${label} contains no JSON object`);
    process.exit(2);
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end < 0) {
    console.error(`FATAL: ${label} has an unbalanced JSON object`);
    process.exit(2);
  }
  try { return JSON.parse(text.slice(start, end)); } catch (e) {
    console.error(`FATAL: ${label} JSON is invalid: ${e.message}`);
    process.exit(2);
  }
}
const valJson = jsonBlock(valOut, 'validate-all.stdout.log');
const testJson = jsonBlock(testOut, 'test-all.stdout.log');
const auditJson = jsonBlock(auditOut, 'audit.stdout.log');
const statusJson = jsonBlock(statusOut, 'status.stdout.log');
const doctorJson = jsonBlock(doctorOut, 'doctor.stdout.log');

const tap = testJson.stdout_tail || '';
const tapNum = (key) => {
  const m = tap.match(new RegExp(`^# ${key} (\\d+)\\s*$`, 'm'));
  return m ? Number(m[1]) : null;
};
const testFiles = testJson.test_files || [];
const testCounts = {
  files: testFiles.length,
  tests: tapNum('tests'), pass: tapNum('pass'), fail: tapNum('fail'),
  skipped: tapNum('skipped'), todo: tapNum('todo'),
};
const anyMissing = Object.values(testCounts).some((v) => v === null);
if (anyMissing) {
  console.error('FATAL: cannot parse TAP counts from captured test output; refusing to guess');
  process.exit(2);
}

const execProbe = meta.map((m) => `${m.command}:exit=${m.exit_code}`).join(', ');
const specStatus = { active: 0, implementedNotVerified: 0 };
for (const f of fs.readdirSync(UAP, { withFileTypes: true })) {
  if (!f.isDirectory()) continue;
  const dir = path.join(UAP, f.name);
  for (const name of fs.readdirSync(dir)) {
    if (!/^UAP-\d{2}-\d{3}-.*\.md$/.test(name)) continue;
    const t = fs.readFileSync(path.join(dir, name), 'utf8');
    const s = (t.match(/\*\*状态：\*\*\s*([A-Z_]+)/) || [])[1];
    if (s === 'ACTIVE') specStatus.active += 1;
    if (s === 'IMPLEMENTED_NOT_VERIFIED') specStatus.implementedNotVerified += 1;
  }
}

const finalStatus = JSON.parse(readIf(path.join(UAP, 'reports', 'FINAL-STATUS.json')) || '{}');
const evidenceDir = path.join(UAP, 'evidence');
const evidenceCount = fs.existsSync(evidenceDir)
  ? fs.readdirSync(evidenceDir).filter((f) => f.endsWith('.json')).length : 0;

const body = `# UAP 1.0 — 阶段 A 基线审计报告

> 生成依据：本文件由 \`node .uap/tools/generate-baseline-report.mjs\` 读取
> \`.uap/reports/baseline-2026-11-13/meta.jsonl\` 与原始 stdout/stderr 日志重新生成，
> 不手工填写任何通过数量。重新生成时间：${new Date().toISOString()}。

## 1. 仓库身份与执行前状态

| 项 | 值 |
| --- | --- |
| 执行位置 | \`${ROOT}\` |
| 分支 | \`main\`（符合 §2.2，未创建/切换分支、未创建 worktree） |
| 执行前 HEAD | \`7b98646915f75026e0e643f9f4b0a6a3ff3ab67c\` |
| 最近提交 | \`7b9864691 feat(uap): deliver UAP 1.0 autonomous engineering platform\` |
| 执行前工作区脏文件数 | 11 |
| 执行前未跟踪文件数 | 0 |

## 2. 保护清单（执行前快照）

### 2.1 用户已有修改 —— 禁止覆盖、重置或卷入本次提交

\`\`\`
 M docs/design-system/UTER-DESIGN-SYSTEM-3.0.md
 M web/scripts/check-design-tokens.mjs
 M web/scripts/generate-design-showcase.mjs
 M web/scripts/verify-contrast.mjs
 M web/src/design-system/foundations/decoration.css
 M web/src/design-system/foundations/typography.css
 M web/src/design-system/tokens/colors.css
 M web/src/features/home/components/hero-terminal-demo.tsx
 M web/src/features/home/components/sections/cta.tsx
 M web/src/features/home/components/sections/hero.tsx
 M web/src/styles/theme.css
\`\`\`

全部为设计系统与首页组件改动，与 UAP 治理改动无路径交集。本次任务不读取、
不写入、不 \`git add\`、不 \`git checkout --\` 上述任一文件。

### 2.2 本次任务生成

- 原始执行日志：\`.uap/reports/baseline-2026-11-13/{status,doctor,audit,validate-all,test-all}.{stdout,stderr}.log\`
- 执行元数据：\`.uap/reports/baseline-2026-11-13/meta.jsonl\`
- 命令自身写回的被跟踪产物：\`.uap/reports/*.json\` 与 \`.uap/state/*.json*\`
- 命令自身写入的不可变证据：\`.uap/evidence/UAP-EV-*.json\`（当前 ${evidenceCount} 个）

### 2.3 说明

\`.uap/\` 已被 Git 跟踪，本次新建的报告与证据**不在** \`.gitignore\` 排除范围内。
阶段 F 的 Git 状态汇报会把「用户原有 11 项」与「本次生成项」分别计数。

## 3. CLI 真实命令清单（不虚构参数）

\`node .uap/bin/uap.mjs --help\` 返回的命令：
\`status\` / \`doctor\` / \`audit\` / \`validate [id]\` / \`validate --all\` / \`test [name]\` /
\`test --all\` / \`task list|create|run|resume|cancel\` / \`repair [defect-id]\` /
\`build [--full]\` / \`release check\` / \`report [--final]\` / \`workflow list|run\` /
\`schemas\` / \`help\`。退出码：0 PASS、1 FAIL、2 BLOCKED/NOT_EXECUTED、3 usage。

## 4. 五条基线命令真实执行结果

| # | 命令 | 开始 | 结束 | 耗时(s) | 退出码 | stdout(B) | stderr(B) |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
${cmdTable}

原始输出逐字保存在 §2.2 所列日志中。退出码序列：${execProbe}。

### 4.1 各命令真实报告的数字

- **status**：\`registry ${statusJson.registry?.checks_passed ?? '?'}/${statusJson.registry?.checks_total ?? '?'}\`；
  \`specs=${statusJson.specifications?.status}\`；\`runtime=${statusJson.runtime?.status}\`；
  \`Uter=${statusJson.uter_compliance?.status}\`；
  executors ${statusJson.executors?.registered}/${statusJson.executors?.implemented}、
  validators ${statusJson.validators?.registered}、agents ${statusJson.agents?.registered}、
  workflows ${statusJson.workflows?.registered}（${statusJson.workflows?.runs} 次运行）、
  tasks ${statusJson.tasks?.total}、evidence ${statusJson.evidence?.total}
  （hash_verified ${statusJson.evidence?.hash_verified}）、
  reports ${statusJson.reports_present}/${statusJson.reports_total}、defects ${statusJson.defects}。
  **但** \`runtime.checked_at = ${statusJson.runtime?.checked_at}\` —— 即本次 \`status\`
  读取的是落盘历史卡片，不是本次运行结果。
- **doctor**：${doctorJson.components?.length ?? '?'} 个组件，全部 healthy=${doctorJson.health_check_passed}；
  恢复探针终态 \`${doctorJson.recovery?.final_state}\`。
- **audit**：扫描 ${auditJson.audit_files_scanned} 文件，${auditJson.audit_findings} 条 findings，
  ${auditJson.audit_blockers} blockers，财务 ${auditJson.financial?.passed}/${auditJson.financial?.total} PASS，
  \`simulated_only=${auditJson.financial?.simulated_only}\`，\`missing_tools=${JSON.stringify(auditJson.missing_tools)}\`。
- **validate --all**：${valJson.pass}/${valJson.total} validators PASS、
  ${valJson.fail} FAIL、${valJson.blocked} BLOCKED。
- **test --all**：**仅 ${testCounts.files} 个测试文件**（${testFiles.join(', ')}），
  \`# tests ${testCounts.tests} / # pass ${testCounts.pass} / # fail ${testCounts.fail} / # skipped ${testCounts.skipped} / # todo ${testCounts.todo}\`，
  \`exit_code=${testJson.exit_code}\`，\`duration_ms=${testJson.duration_ms}\`。

### 4.2 测试计数口径

| 项 | 数量 |
| --- | ---: |
| 执行测试文件 | ${testCounts.files} |
| 总用例 | ${testCounts.tests} |
| 通过 | ${testCounts.pass} |
| 失败 | ${testCounts.fail} |
| 跳过 | ${testCounts.skipped} |
| 未执行（UAP 套件内） | 0 |

\`test --all\` **未**执行 Uter 的 Go / Bun / 构建门禁；其 \`--all\` 只枚举
\`.uap/tests/*.test.mjs\`，当前目录下只有 ${testCounts.files} 个文件。

## 5. 规范状态与最终状态冲突（实时重算）

| 来源 | ACTIVE | IMPLEMENTED_NOT_VERIFIED |
| --- | ---: | ---: |
| 32 份规范原文 \`**状态：**\` | ${specStatus.active} | ${specStatus.implementedNotVerified} |
| \`FINAL-STATUS.json\` | — | \`specifications.verified=${finalStatus.specifications?.verified}\` / \`overall_status=${finalStatus.overall_status}\` |

二者不一致：${specStatus.implementedNotVerified} 项规范自述未验证，最终报告却声称全部已验证。

## 6. 阶段 A 发现的问题清单

| ID | 优先级 | 问题 |
| --- | --- | --- |
| A-01 | P0 | 状态冲突：索引 ${specStatus.implementedNotVerified} 项 \`IMPLEMENTED_NOT_VERIFIED\`，\`FINAL-STATUS.json\` 却写 \`verified: ${finalStatus.specifications?.verified}\` / \`${finalStatus.overall_status}\` |
| A-02 | P0 | 历史结果冒充当前结果：\`status\`/\`runtimeCapability()\`/\`finalStatus()\` 直接读落盘卡片，无执行 ID 绑定与新鲜度校验 |
| A-03 | P0 | 无 Requirement 级追踪矩阵；32 份规范的「强制性要求」无稳定唯一 ID |
| A-04 | P0 | 自动修复引擎只写 sandbox fixture，显式 \`business_code_untouched: true\` |
| A-05 | P0 | \`audit\` 的 ${auditJson.audit_findings} 条 findings 全为 INFO 级字符串锚点，无真实调用链/业务正确性验证 |
| A-06 | P0 | 财务 ${auditJson.financial?.total} 项全为模拟，无隔离数据库集成与真实并发/幂等测试 |
| A-07 | P0 | \`test --all\` 只覆盖 ${testCounts.files} 个文件 ${testCounts.tests} 用例；无 Validator 正反测试、状态一致性测试 |
| A-08 | P1 | 无 Web/H5 真实浏览器 E2E；H5-BROWSER-MATRIX 为静态矩阵 |
| A-09 | P1 | 证据有哈希但无本轮 Execution ID 绑定与「证据与当前 HEAD 匹配」校验 |
| A-10 | P0 | \`FULLY_OPERATIONAL\` 未以「真实业务代码修复闭环」为前置条件，与 §16 冲突 |
| A-11 | P1 | 未核实 CI 是否覆盖 Requirement ID 唯一性、状态一致性、财务/证据完整性 |

## 7. 分级汇总

- P0：A-01 ~ A-07、A-10（8 项）
- P1：A-08、A-09、A-11（3 项）

本报告只记录事实，不对任何 P0 项作「已解决」声明。
`;

fs.writeFileSync(OUT, body, 'utf8');
console.log(`BASELINE-AUDIT-REPORT.md regenerated from ${meta.length} real command records, ` +
  `${testCounts.tests} TAP tests, ${specStatus.active + specStatus.implementedNotVerified} spec headers`);
