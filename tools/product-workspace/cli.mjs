#!/usr/bin/env node
/*
 * UTER 产品规格中心 · 统一命令行入口（零外部依赖）
 *
 *   node tools/product-workspace/cli.mjs check      # CI 门禁：一致性 + 覆盖率 + 冲突
 *   node tools/product-workspace/cli.mjs validate   # 全量一致性检查（含文件存在性）
 *   node tools/product-workspace/cli.mjs coverage   # 覆盖率 / 追溯率 / 同步指标
 *   node tools/product-workspace/cli.mjs gate --file <new-feature.json>
 *   node tools/product-workspace/cli.mjs report     # 重渲染全部 PRD / 原型 / 注册表 / 报告
 *   node tools/product-workspace/cli.mjs serve [--port 7788]
 *
 * 所有退出码真实反映检查结果，未执行的检查绝不记为 PASS。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as engine from './engine.mjs';
import { renderAll, writeReportFiles } from './render-docs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const argv = process.argv.slice(2);
const cmd = argv[0] || 'help';
const flag = (name, fallback = null) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] ?? true : fallback;
};
const has = (name) => argv.includes(name);
const print = (x) => console.log(typeof x === 'string' ? x : JSON.stringify(x, null, 2));

function validate() {
  const model = engine.readModel();
  const feature = flag('--feature');
  return { model, result: engine.validate(model, feature, { checkFiles: !has('--no-files') }) };
}

function coverage() {
  const model = engine.readModel();
  return { model, result: engine.coverage(model) };
}

/** 覆盖率口径：百分比类指标必须 100；计数类负向指标必须为 0。 */
function coverageFailures(cov) {
  const bad = [];
  for (const [k, v] of Object.entries(cov.metrics)) {
    if (k === 'sync_loops' || k === 'silent_overwrites') {
      if (v !== 0) bad.push(`${k}=${v}（应为 0）`);
    } else if (v !== 100) bad.push(`${k}=${v}%（应为 100%）`);
  }
  if (cov.open_conflicts > 0) bad.push(`open_conflicts=${cov.open_conflicts}（应为 0）`);
  return bad;
}

function usage() {
  print(`UTER Product Workspace CLI
  check      CI 门禁：一致性检查 + 覆盖率 + 冲突状态，任一失败退出 1
  validate   一致性检查（--feature ID 只查单个功能；--no-files 跳过文件存在性）
  coverage   覆盖率 / 追溯率 / 同步指标（--strict 时低于 100% 退出 1）
  gate       新增功能门禁校验（--file <json>，或 --help 查看字段）
  report     由统一模型重渲染全部 PRD / 原型 / 目录 / 注册表 / 报告
  serve      启动产品规格中心（仅绑定 127.0.0.1）
  help       显示本帮助
`);
}

let exitCode = 0;
try {
  switch (cmd) {
    case 'validate': {
      const { result } = validate();
      print({ command: 'validate', passed: result.passed, total: result.total, failed: result.failed, errors: result.errors, warnings: result.warnings });
      exitCode = result.passed ? 0 : 1;
      break;
    }
    case 'coverage': {
      const { result } = coverage();
      const failures = coverageFailures(result);
      print({ command: 'coverage', metrics: result.metrics, status_counts: result.status_counts, feature_total: result.feature_total, requirement_total: result.requirement_total, mapping_total: result.mapping_total, needs_product_decision: result.needs_product_decision, needs_review: result.needs_review, open_conflicts: result.open_conflicts, failures });
      if (has('--strict') && failures.length) exitCode = 1;
      break;
    }
    case 'check': {
      const { model, result: v } = validate();
      const c = engine.coverage(model);
      const covFailures = coverageFailures(c);
      const conflictFailures = model.conflicts.filter((x) => x.status === 'OPEN').map((x) => `OPEN ${x.conflict_id}`);
      const passed = v.passed && covFailures.length === 0 && conflictFailures.length === 0;
      print({
        command: 'check', verdict: passed ? 'PASS' : 'FAIL',
        consistency: { passed: v.passed, total: v.total, failed: v.failed, errors: v.errors.length, warnings: v.warnings.length },
        coverage_failures: covFailures, conflict_failures: conflictFailures,
        sync_metrics: model.sync_metrics, model_version: model.model_version,
      });
      exitCode = passed ? 0 : 1;
      break;
    }
    case 'gate': {
      const file = flag('--file');
      if (!file) {
        print({ command: 'gate', error: '缺少 --file <new-feature.json>', required_shape: { feature_id: 'UTER-{DOMAIN}-{NUMBER}', prd: { goal: '...' }, prototype: { pages: ['...'] }, acceptance: ['Given/When/Then'], requirements: ['REQ-...'], test_path: 'tools/product-workspace/tests/xxx.test.mjs' } });
        exitCode = 2;
        break;
      }
      const payload = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
      const out = engine.gate(engine.readModel(), payload);
      print({ command: 'gate', feature_id: payload.feature_id, decision: out.decision, allowed: out.allowed, checks: out.checks, evaluated_at: out.evaluated_at });
      exitCode = out.allowed ? 0 : 1;
      break;
    }
    case 'report': {
      const model = engine.readModel();
      const files = renderAll(model, { skipReports: true });
      const v = engine.validate(model, null, { checkFiles: true });
      const c = engine.coverage(model);
      // 先写投影再做文件存在性校验，避免把「尚未生成」误报为警告。
      const extras = writeReportFiles(model, v, c);
      print({ command: 'report', projections_written: files.length, reports_written: extras.length, reports: extras, consistency: { passed: v.passed, total: v.total, failed: v.failed }, model_version: model.model_version });
      exitCode = v.passed ? 0 : 1;
      break;
    }
    case 'serve': {
      const port = Number(flag('--port', process.env.UTER_PRODUCT_WORKSPACE_PORT || 7788));
      const { createServer } = await import(pathToFileURL(path.join(HERE, 'server.mjs')).href);
      const server = createServer();
      server.listen(port, '127.0.0.1', () => {
        console.log(`[product-workspace] 产品规格中心: http://127.0.0.1:${port}/  (工作区 ${ROOT})`);
      });
      break;
    }
    case 'help':
    default:
      usage();
      if (cmd !== 'help' && cmd !== '--help' && cmd !== '-h') exitCode = 2;
  }
} catch (e) {
  print({ command: cmd, verdict: 'FAILED', error: e.message, stack: e.stack?.split('\n').slice(0, 4) });
  exitCode = 1;
}
process.exitCode = exitCode;
