/**
 * UAP Real-Code Repair Engine
 * ============================================================================
 * 在保留 .uap/engines/auto-repair/index.mjs（sandbox 模拟修复）安全机制的前提下，
 * 把自动修复能力扩展到**真实 Uter 业务代码**。
 *
 * 与模拟引擎的边界：
 *   - 模拟引擎：只改 .uap/state/repair-sandbox/ 下的 fixture，永不碰业务代码。
 *   - 本引擎：只在「任务显式声明的授权路径 + 策略引擎 ALLOW + 目标文件无用户
 *     未提交修改」三者同时成立时，才对真实业务文件做精确字符串补丁。
 *
 * 流程（对应 UAP 1.0 §4.2）：
 *   发现 → 定位模块 → 读取上下文 → 根因 → 缺陷复现测试 → 修复方案 →
 *   权限策略检查 → 修改真实业务代码 → 定向测试 → 关联回归 →
 *   独立代码审查 → 独立验证 → 证据 → 任务状态
 *
 * 有界性（§4.4 / §9.3）：max_attempts 默认 3、硬上限 5；每条命令有超时；
 * 失败先回滚再按有限次数重试；超出即停止并生成 FAILED 报告，绝不无限循环。
 *
 * 独立性（§1.11）：修复由 uap-repair-agent 执行，复核由不导入任何 UAP 运行时
 * 模块的 independent-review.mjs 完成，且另外挂到 .uap/tests/ 由 test --all 复跑。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, rootPath, uapPath, ensureDir } from '../../runtime/_lib/paths.mjs';
import { nowISO } from '../../runtime/_lib/util.mjs';
import { runCommand } from '../../runtime/_lib/proc.mjs';
import { check as policyCheck } from '../../runtime/policy-engine/index.mjs';
import { record as recordEvidence } from '../../runtime/evidence-engine/index.mjs';

export const component = 'real-code-repair-engine';
export const version = '1.0.0';

const MAX_ATTEMPTS_HARD_CAP = 5;
const LEDGER_DIR = uapPath('state', 'repair-ledger');
const BACKUP_ROOT = uapPath('state', 'repair-sandbox', 'backups');
// 每个任务写自己的报告，失败/被阻断的运行绝不覆盖成功运行的证据。
const reportFileFor = (taskId) => uapPath('reports', `AUTO-REPAIR-REAL-CODE-REPORT-${taskId}.md`);
const CANONICAL_REPORT = uapPath('reports', 'AUTO-REPAIR-REAL-CODE-REPORT.md');

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

/** §4.3 修复权限分级：fail-closed，任何未显式允许的类别一律阻断。 */
const PATH_CLASSIFICATION = [
  // 判定顺序即优先级：DENY 必须排在专项审查之前，否则支付文件会被降级成
  // 「做专项验证即可自动改」，与 §4.3 权限表冲突（边界测试实际发现过该漏洞）。
  { level: 'DENY', re: /(^|\/)\.env|(^|\/)(secrets?|credentials)\//i, reason: '密钥、凭据文件禁止自动修改' },
  { level: 'DENY', re: /(^|\/)(deploy|production)\//i, reason: '生产部署配置与部署动作禁止自动执行' },
  { level: 'DENY', re: /(topup|wechat_pay|wechat_query|pay_|payment|refund|paypal|stripe|epay)/i, reason: '支付、退款、支付回调及支付订单查询仅允许沙箱与测试环境验证' },
  { level: 'DATA_SAFETY_REVIEW', re: /(^|\/)(migrations?|migrate)\//i, reason: '数据库迁移必须先做数据安全检查' },
  { level: 'SECURITY_REVIEW', re: /(auth|permission|rbac|oauth|credential|access_token|security)/i, reason: '认证与权限代码必须做安全专项审查' },
  { level: 'FINANCIAL_REVIEW', re: /(billing|balance|quota|wallet|fund|financial)/i, reason: '余额与资金代码必须做财务完整性专项验证' },
];

export function classifyPath(relativePath) {
  const normalized = String(relativePath).replace(/\\/g, '/');
  for (const rule of PATH_CLASSIFICATION) {
    if (rule.re.test(normalized)) return { level: rule.level, reason: rule.reason, auto_allow: false };
  }
  return { level: 'AUTO_ALLOW', reason: '普通业务代码，在任务授权范围内自动允许', auto_allow: true };
}

function requirePolicy(agentId, permission, action, command = null) {
  const decision = policyCheck({
    agent_id: agentId,
    permission,
    action,
    ...(command ? { command } : {}),
  });
  if (!decision.allowed) {
    throw Object.assign(new Error(`policy DENY: ${agentId}/${permission} — ${decision.reason}`), {
      code: 'POLICY_DENIED', decision,
    });
  }
  return { agent_id: agentId, permission, decision: decision.decision, action };
}

async function exec(spec, defaultTimeout) {
  const result = await runCommand({
    command: spec.command,
    args: spec.args || [],
    timeoutMs: Number(spec.timeout_ms) || defaultTimeout,
    env: spec.env || {},
  });
  return {
    command: result.command,
    args: spec.args || [],
    exit_code: result.exit_code,
    timed_out: result.timed_out === true,
    duration_ms: result.duration_ms,
    stdout: (result.stdout || '').slice(0, 20000),
    stderr: (result.stderr || '').slice(0, 20000),
  };
}

function latestLedger() {
  if (!fs.existsSync(LEDGER_DIR)) return null;
  const files = fs.readdirSync(LEDGER_DIR).filter((f) => f.endsWith('.json'))
    .map((f) => path.join(LEDGER_DIR, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0] || null;
}

function writeLedger(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function renderReport(run) {
  // 被阻断的运行可能还没走到根因/权限分级/复现测试阶段，空值必须如实呈现，
  // 不允许报告生成抛异常而丢失失败记录。
  const classification = run.classification || { level: 'NOT_REACHED', auto_allow: false, reason: '未执行到权限分级' };
  const rootCause = run.root_cause || { command: 'not executed', args: [], exit_code: null };
  const reproduction = run.reproduction_before || { exit_code: null };
  const review = run.independent_review || { command: null, args: [], exit_code: null };
  const cmdRows = run.commands.map((c) =>
    `| \`${c.command} ${(c.args || []).join(' ')}\` | ${c.phase} | ${c.exit_code} | ${c.duration_ms} |`).join('\n');
  const stageRows = run.stages.map((s) => `| ${s.stage} | \`${s.agent_id}\` | ${s.status} | ${String(s.detail || '').replace(/\|/g, '\\|')} |`).join('\n');
  return `# 真实业务代码自动修复验证报告

- **Execution ID**：\`${run.execution_id}\`
- **Task ID**：\`${run.task_id}\`
- **Workflow**：\`uap-defect-repair\` / \`uap-final-verification\`（本引擎为真实代码分支）
- **Git HEAD**：\`${run.git_head}\`
- **开始 / 结束**：${run.started_at} → ${run.finished_at}
- **最终结论**：**${run.status}**（attempts=${run.attempts}/${run.max_attempts}，失败升级=${run.escalated ? 'YES' : 'NO'}）
- **修复对象**：\`${run.target_file}\`
- **修复前 SHA256**：\`${run.before_hash}\`
- **修复后 SHA256**：\`${run.after_hash}\`
- **回滚备份**：\`${run.backup_path}\`
- **独立复核**：\`${review.command} ${review.args.join(' ')}\` → exit ${review.exit_code}

> 本文件由 \`.uap/engines/auto-repair/real-code-repair.mjs\` 依据本次真实执行自动生成，
> 不是手工填写的结论。模拟修复引擎 \`.uap/engines/auto-repair/index.mjs\` 仍保留，
> 其 sandbox PASS 不等同于本报告的结论。

## 缺陷与根因

- **缺陷**：${run.defect.description}
- **影响**：${run.defect.impact}
- **根因证据**：\`${rootCause.command} ${rootCause.args.join(' ')}\` → exit ${rootCause.exit_code}
- **复现测试（修复前）**：exit ${reproduction.exit_code}（非 0 证明缺陷真实存在）

## 权限分级

| 文件 | 类别 | 自动允许 | 说明 |
|---|---|---|---|
| \`${run.target_file}\` | ${classification.level} | ${classification.auto_allow} | ${classification.reason} |

策略引擎决策：${run.policy_decisions.length} 条，全部 ALLOW（DENY 即 fail-closed 终止）。

## 执行阶段与角色分离

| 阶段 | Agent | 状态 | 说明 |
|---|---|---|---|
${stageRows}

## 真实执行命令

| 命令 | 阶段 | 退出码 | 耗时(ms) |
|---|---|---:|---:|
${cmdRows}

## 证据

${run.evidence_ids.map((id) => `- \`.uap/evidence/${id}.json\``).join('\n') || '- （证据写入失败，见 blockers）'}

## 阻断 / 未解决

${run.blockers.length ? run.blockers.map((b) => `- ${b}`).join('\n') : '- 无'}
`;
}

/**
 * 执行真实代码修复闭环。
 * @param {{taskFile: string, dryRun?: boolean}} options
 */
export async function runRealRepair({ taskFile, dryRun = false }) {
  const taskPath = path.isAbsolute(taskFile) ? taskFile : rootPath(taskFile);
  if (!fs.existsSync(taskPath)) throw new Error(`task file not found: ${taskPath}`);
  const task = JSON.parse(fs.readFileSync(taskPath, 'utf8'));

  const executionId = `UAP-RREPAIR-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const startedAt = nowISO();
  const maxAttempts = Math.min(Number(task.limits?.max_attempts) || 3, MAX_ATTEMPTS_HARD_CAP);
  const defaultTimeout = Number(task.limits?.timeout_ms) || 180000;

  const run = {
    execution_id: executionId,
    task_id: task.task_id,
    started_at: startedAt,
    finished_at: null,
    git_head: null,
    status: 'RUNNING',
    attempts: 0,
    max_attempts: maxAttempts,
    escalated: false,
    target_file: task.patch.file,
    defect: task.defect,
    stages: [],
    commands: [],
    policy_decisions: [],
    classification: null,
    reproduction_before: null,
    root_cause: null,
    independent_review: { command: null, args: [], exit_code: null },
    before_hash: null,
    after_hash: null,
    backup_path: null,
    ledger_path: null,
    evidence_ids: [],
    blockers: [],
  };

  const stage = (name, agentId, status, detail = '') => {
    run.stages.push({ stage: name, agent_id: agentId, status, detail, at: nowISO() });
  };
  const runStep = async (spec, phase) => {
    const r = await exec(spec, defaultTimeout);
    run.commands.push({ ...r, phase });
    return r;
  };

  try {
    // ── 0. 基线与用户未提交修改保护 ──────────────────────────────────────
    const headResult = await runStep({ command: 'git', args: ['rev-parse', 'HEAD'] }, 'baseline');
    run.git_head = (headResult.stdout || '').trim();
    if (!run.git_head) throw new Error('cannot resolve git HEAD');

    const dirty = await runStep({ command: 'git', args: ['status', '--short', '--', task.patch.file] }, 'baseline');
    if ((dirty.stdout || '').trim()) {
      throw Object.assign(new Error(`目标文件存在用户未提交修改，禁止覆盖：${task.patch.file}`), { code: 'USER_WIP_PROTECTED' });
    }
    stage('保护用户未提交修改', 'uap-orchestrator', 'PASS', `git status --short -- ${task.patch.file} 为空`);

    // ── 1. 发现 / 策略：发现与根因 Agent 只读 ─────────────────────────────
    run.policy_decisions.push(requirePolicy('uap-orchestrator', 'project_read', 'defect_discovery'));
    run.policy_decisions.push(requirePolicy('uap-development-agent', 'project_read', 'root_cause_analysis'));
    stage('发现问题', 'uap-orchestrator', 'PASS', task.defect.description);
    stage('定位业务模块', 'uap-development-agent', 'PASS', task.patch.file);

    // ── 2. 缺陷复现测试（修复前必须失败，否则说明缺陷不存在） ────────────────
    run.reproduction_before = await runStep(task.reproduction_test, 'reproduction_before');
    if (run.reproduction_before.exit_code === 0) {
      throw new Error('复现测试在修复前已通过，缺陷不成立或已被修复，终止以免制造假闭环');
    }
    stage('建立缺陷复现测试', 'uap-test-agent', 'PASS',
      `exit=${run.reproduction_before.exit_code}（预期非 0）`);

    // ── 3. 读取上下文 + 根因静态证据 ──────────────────────────────────────
    const absTarget = rootPath(task.patch.file);
    const before = fs.readFileSync(absTarget, 'utf8');
    run.before_hash = sha256(before);
    const occurrences = before.split(task.patch.old).length - 1;
    if (occurrences !== 1) {
      throw new Error(`补丁锚点在目标文件中出现 ${occurrences} 次（要求恰好 1 次），拒绝模糊替换`);
    }
    run.root_cause = await runStep(task.root_cause_probe, 'root_cause');
    stage('读取代码上下文与根因分析', 'uap-development-agent',
      run.root_cause.exit_code === 0 ? 'PASS' : 'BLOCKED',
      `${run.root_cause.command} exit=${run.root_cause.exit_code}`);

    // ── 4. 权限策略检查（§4.3） ───────────────────────────────────────────
    run.classification = classifyPath(task.patch.file);
    const authorized = (task.scope?.allowed_paths || []).includes(task.patch.file);
    if (!authorized) throw new Error(`目标文件不在任务授权路径内：${task.patch.file}`);
    if (!run.classification.auto_allow) {
      const grant = (task.scope?.review_authorizations || []).includes(run.classification.level);
      if (!grant) {
        throw Object.assign(new Error(
          `权限分级 ${run.classification.level}：${run.classification.reason}；任务未提供专项审查授权`),
        { code: 'PERMISSION_BLOCKED' });
      }
    }
    run.policy_decisions.push(requirePolicy('uap-repair-agent', 'project_write', 'apply_real_code_patch'));
    run.policy_decisions.push(requirePolicy('uap-repair-agent', 'local_command', 'run_tests', 'go'));
    run.policy_decisions.push(requirePolicy('uap-test-agent', 'local_command', 'targeted_and_regression_tests', 'go'));
    run.policy_decisions.push(requirePolicy('uap-review-agent', 'project_read', 'independent_code_review'));
    run.policy_decisions.push(requirePolicy('uap-security-agent', 'project_read', 'security_verification'));
    stage('权限策略检查', 'uap-security-agent', 'PASS',
      `${run.policy_decisions.length} 条策略决策全部 ALLOW；分级=${run.classification.level}`);
    stage('生成修复方案', 'uap-repair-agent', 'PASS', '单锚点精确字符串补丁，已验证唯一匹配');

    if (dryRun) {
      run.status = 'DRY_RUN';
      run.finished_at = nowISO();
      stage('dry-run', 'uap-orchestrator', 'PASS', '未写入任何文件');
      return { ...run, report_file: null };
    }

    // ── 5. 备份 → 修改真实业务代码 → 有界重试 ──────────────────────────────
    const backupDir = path.join(BACKUP_ROOT, executionId);
    ensureDir(backupDir);
    const backupPath = path.join(backupDir, path.basename(task.patch.file));
    fs.writeFileSync(backupPath, before, 'utf8');
    run.backup_path = path.relative(ROOT, backupPath);
    const after = before.replace(task.patch.old, task.patch.new);
    run.after_hash = sha256(after);

    run.ledger_path = path.relative(ROOT, path.join(LEDGER_DIR, `${executionId}.json`));
    let succeeded = false;
    let lastFailure = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      run.attempts = attempt;
      stage(`修复尝试 ${attempt}/${maxAttempts}`, 'uap-repair-agent', 'RUNNING', '应用补丁');
      fs.writeFileSync(absTarget, after, 'utf8');

      const ledger = {
        execution_id: executionId,
        task_id: task.task_id,
        git_head: run.git_head,
        target_file: task.patch.file,
        before_hash: run.before_hash,
        after_hash: run.after_hash,
        backup_path: run.backup_path,
        allowed_paths: task.scope.allowed_paths,
        modified_files: [task.patch.file],
        max_attempts: maxAttempts,
        attempts: attempt,
        commands: [],
        status: 'PATCH_APPLIED',
      };

      const targeted = [];
      for (const spec of task.targeted_tests) {
        const r = await runStep(spec, `targeted_test_attempt_${attempt}`);
        targeted.push(r);
      }
      const regression = [];
      for (const spec of task.regression_tests) {
        const r = await runStep(spec, `regression_attempt_${attempt}`);
        regression.push(r);
      }
      ledger.commands = [...targeted, ...regression];
      ledger.status = [...targeted, ...regression].every((r) => r.exit_code === 0)
        ? 'TESTS_PASSED' : 'TESTS_FAILED';
      writeLedger(rootPath(run.ledger_path), ledger);

      const failures = [...targeted, ...regression].filter((r) => r.exit_code !== 0)
        .map((r) => `${r.command} ${r.args.join(' ')} → exit ${r.exit_code}`);
      if (failures.length === 0) {
        stage(`修复尝试 ${attempt}/${maxAttempts}`, 'uap-repair-agent', 'PASS',
          '定向测试与关联回归全部通过');
        stage('定向测试', 'uap-test-agent', 'PASS', `${targeted.length} 条命令全部 exit 0`);
        stage('关联回归测试', 'uap-test-agent', 'PASS', `${regression.length} 条命令全部 exit 0`);
        succeeded = true;
        break;
      }

      lastFailure = failures.join('; ');
      stage(`修复尝试 ${attempt}/${maxAttempts}`, 'uap-repair-agent', 'FAILED', lastFailure);
      // 失败即回滚，避免把回归留在真实业务代码里。
      fs.writeFileSync(absTarget, before, 'utf8');
      if (task.limits?.retry_delay_ms) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(Number(task.limits.retry_delay_ms), 5000)));
      }
    }

    if (!succeeded) {
      fs.writeFileSync(absTarget, before, 'utf8');
      run.status = 'FAILED';
      run.escalated = true;
      run.blockers.push(`超出最大尝试次数 ${maxAttempts}：${lastFailure}；已回滚到修复前内容`);
      stage('失败升级', 'uap-orchestrator', 'BLOCKED', run.blockers[run.blockers.length - 1]);
    } else {
      // ── 6. 独立代码审查 + 独立验证（不导入 UAP 运行时） ─────────────────
      const reviewSpec = {
        ...task.independent_verification,
        env: { ...(task.independent_verification.env || {}), UAP_REPAIR_LEDGER: run.ledger_path },
      };
      const review = await runStep(reviewSpec, 'independent_review');
      run.independent_review = {
        command: reviewSpec.command,
        args: reviewSpec.args || [],
        exit_code: review.exit_code,
        stdout: review.stdout,
      };
      stage('独立代码审查', 'uap-review-agent',
        review.exit_code === 0 ? 'PASS' : 'FAILED', `exit=${review.exit_code}`);
      stage('独立验证', 'uap-security-agent',
        review.exit_code === 0 ? 'PASS' : 'FAILED', 'independent-review.mjs 复核哈希/范围/测试');

      if (review.exit_code !== 0) {
        fs.writeFileSync(absTarget, before, 'utf8');
        run.status = 'FAILED';
        run.escalated = true;
        run.blockers.push(`独立复核未通过，已回滚：${(review.stdout || '').slice(-600)}`);
      } else {
        run.status = 'SUCCEEDED';
        stage('保存证据', 'uap-orchestrator', 'PASS', 'Evidence Engine 追加写入');
        stage('更新任务状态', 'uap-orchestrator', 'PASS', 'SUCCEEDED');
      }
    }

    // ── 7. 证据：每条关键命令独立留证，不可覆盖 ─────────────────────────────
    const keyCommands = run.commands.filter((c) =>
      ['reproduction_before', 'targeted_test_attempt_1', 'regression_attempt_1', 'independent_review'].includes(c.phase));
    for (const c of keyCommands) {
      const ev = recordEvidence({
        kind: 'real_code_repair_command',
        task_id: task.task_id,
        trace_id: executionId,
        specification_ids: task.specification_ids || [],
        requirement_ids: task.requirement_ids || [],
        command: c.command,
        exit_code: c.exit_code,
        duration_ms: c.duration_ms,
        inputs: { args: c.args, phase: c.phase },
        stdout: c.stdout,
        stderr: c.stderr,
        artifacts: [run.ledger_path, run.backup_path],
        findings: [`before=${run.before_hash}`, `after=${run.after_hash}`],
        summary: `[${c.phase}] ${run.status}`,
      });
      run.evidence_ids.push(ev.evidence_id);
    }
    const finalEv = recordEvidence({
      kind: 'real_code_repair_result',
      task_id: task.task_id,
      trace_id: executionId,
      specification_ids: task.specification_ids || [],
      requirement_ids: task.requirement_ids || [],
      exit_code: run.status === 'SUCCEEDED' ? 0 : 1,
      inputs: { attempts: run.attempts, target_file: run.target_file, classification: run.classification },
      artifacts: [run.ledger_path, run.backup_path, path.relative(ROOT, reportFileFor(task.task_id))],
      summary: `真实业务代码修复闭环 ${run.status}`,
    });
    run.evidence_ids.push(finalEv.evidence_id);
  } catch (error) {
    run.status = 'BLOCKED';
    run.blockers.push(`${error.code || 'ERROR'}: ${error.message}`);
    stage('阻断', 'uap-orchestrator', 'BLOCKED', error.message);
  }

  run.finished_at = nowISO();
  ensureDir(path.dirname(rootPath(run.ledger_path || '.uap/state/repair-ledger/.keep')));
  const resultFile = uapPath('state', 'repair-tasks', `${task.task_id}.result.json`);
  ensureDir(path.dirname(resultFile));
  fs.writeFileSync(resultFile, `${JSON.stringify(run, null, 2)}\n`, 'utf8');
  const reportFile = reportFileFor(task.task_id);
  ensureDir(path.dirname(reportFile));
  fs.writeFileSync(reportFile, renderReport(run), 'utf8');
  // 仅主任务额外维护一份固定名称的汇总报告，供验收入口引用。
  if (task.task_id === 'UAP-REAL-REPAIR-001') {
    fs.writeFileSync(CANONICAL_REPORT, renderReport(run), 'utf8');
  }
  run.report_file = path.relative(ROOT, reportFile);
  run.result_file = path.relative(ROOT, resultFile);
  run.latest_ledger = latestLedger();
  return run;
}
