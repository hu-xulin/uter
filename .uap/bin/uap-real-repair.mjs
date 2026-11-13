#!/usr/bin/env node
/**
 * 真实业务代码修复命令行入口（独立于 .uap/bin/uap.mjs）。
 *
 * 不修改 .uap/bin/uap.mjs 的原因：该文件在执行时属于用户未提交的并发 WIP，
 * UAP 1.0 §2.1 / §14 明确禁止覆盖用户已有修改。待该 WIP 落库后，可把本入口
 * 作为 `uap repair --real --task <file>` 的一个分支合入主 CLI。
 *
 * 用法：
 *   node .uap/bin/uap-real-repair.mjs --task .uap/state/repair-tasks/<id>.json [--dry-run]
 * 退出码：0=SUCCEEDED/DRY_RUN，1=FAILED/BLOCKED（可被 CI 捕获）。
 */
import { runRealRepair } from '../engines/auto-repair/real-code-repair.mjs';

function parseArgs(argv) {
  const options = { taskFile: null, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--task' && argv[i + 1]) { options.taskFile = argv[i + 1]; i += 1; }
    else if (argv[i] === '--dry-run') { options.dryRun = true; }
    else if (argv[i] === '--help' || argv[i] === '-h') { options.help = true; }
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
if (options.help || !options.taskFile) {
  process.stdout.write('usage: node .uap/bin/uap-real-repair.mjs --task <task.json> [--dry-run]\n');
  process.exitCode = options.help ? 0 : 3;
} else {
  const run = await runRealRepair({ taskFile: options.taskFile, dryRun: options.dryRun });
  process.stdout.write(`${JSON.stringify({
    execution_id: run.execution_id,
    task_id: run.task_id,
    status: run.status,
    attempts: run.attempts,
    max_attempts: run.max_attempts,
    target_file: run.target_file,
    classification: run.classification,
    reproduction_before_exit: run.reproduction_before?.exit_code ?? null,
    independent_review_exit: run.independent_review.exit_code,
    evidence_ids: run.evidence_ids,
    ledger: run.ledger_path,
    report_file: run.report_file,
    result_file: run.result_file,
    blockers: run.blockers,
    stages: run.stages.map((s) => `${s.stage}:${s.status}`),
  }, null, 2)}\n`);
  process.exitCode = (run.status === 'SUCCEEDED' || run.status === 'DRY_RUN') ? 0 : 1;
}
