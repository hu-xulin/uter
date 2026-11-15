/**
 * UAP Phase 2 · 独立回归验证器（职责隔离）
 * ============================================================================
 * 硬约束：
 *   - **不 import 修复侧任何模块**（只用 node 内置模块）。
 *   - **不读修复侧给出的 PASS 结论**：不读 repair-status.json、不读任何
 *     verdict/status:PASS 字段；只接收「沙箱目录 + 原始 TASK.json 路径」。
 *   - 只把 TASK.json 当作「原始需求/验收条件」，把 evidence/** 当作「原始
 *     证据数据」；所有结论由本验证器自己重算、自己 spawn、自己动态 import 得出。
 *
 * 独立验证内容：
 *   1. 从 TASK.json 独立读取验收条件（源码/4 类测试/测试文件锁定哈希/行为断言）。
 *   2. 独立读磁盘上的最终源码。
 *   3. 独立重建「修复前源码」到自己私有目录，真实重跑原始失败测试，
 *      证明「修复前失败」确为真实过程（exit≠0）。
 *   4. 独立 spawn 重跑：原始失败测试、新增回归、相关模块、完整必要测试，
 *      自己判 exit_code 与 stdout（E2E_OK 标记）。
 *   5. 独立检查：修复前失败证据真实存在且 exit≠0；修复后原始测试 exit=0；
 *      uni-diff 非空且确实改了 return 表达式；所有证据哈希重算一致；
 *      测试预期文件 sha256 与 TASK 锁定值一致（未篡改/未放宽断言）；
 *      命令退出码与证据记录一致（只比对原始数据，不采信任何 PASS 结论）。
 *   6. 独立动态 import 最终源码，直接调用 add(2,3) 断言 ===5，
 *      从行为层面证明程序真的被修好，而不是只信测试文本。
 *
 * verdict = PASS 当且仅当所有 checks 通过（fail-closed，任一项失败即 FAIL）。
 * CLI：node independent-regression-e2e.mjs <sandboxDir> [timeoutMs]
 *      退出码 0=PASS，1=FAIL，2=用法错误。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const exists = (p) => fs.existsSync(p);
const safeRead = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const safeJson = (p) => { const s = safeRead(p); if (s === null) return null; try { return JSON.parse(s); } catch { return null; } };

function spawnNode(absTest, cwd, timeoutMs, commandEnv) {
  const r = spawnSync('node', [absTest], {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    env: { ...process.env, ...commandEnv },
    maxBuffer: 8 * 1024 * 1024,
    shell: false,
  });
  const timedOut = r.error?.code === 'ETIMEDOUT' || (r.status === null && r.signal === 'SIGTERM');
  return {
    command: 'node',
    args: [absTest],
    exit_code: timedOut ? null : r.status,
    timed_out: timedOut,
    stdout: (r.stdout || '').slice(0, 20000),
    stderr: (r.stderr || '').slice(0, 20000),
  };
}

/**
 * @param {{sandboxDir:string, taskFile?:string, timeoutMs?:number, commandEnv?:object}} opts
 * @returns {Promise<object>} 独立 verdict（含逐项 checks）
 */
export async function verifyIndependentRegression(opts = {}) {
  const sandboxDir = path.resolve(opts.sandboxDir || '');
  const taskFile = opts.taskFile ? path.resolve(opts.taskFile) : path.join(sandboxDir, 'TASK.json');
  const timeoutMs = Number(opts.timeoutMs) || 60000;
  const commandEnv = opts.commandEnv || {};

  const checks = [];
  const failures = [];
  const add = (name, pass, detail) => {
    checks.push({ name, pass: Boolean(pass), detail: String(detail) });
    if (!pass) failures.push(`${name}: ${detail}`);
  };

  // ── 1. 从原始需求（TASK.json）独立读取验收条件 ────────────────────────────
  const task = safeJson(taskFile);
  add('task_present_and_parsed', Boolean(task),
    task ? `parsed ${path.basename(taskFile)}` : `missing/invalid ${taskFile}`);
  const acc = task?.acceptance || null;
  const testFiles = Array.isArray(acc?.test_files) ? acc.test_files : [];
  const behavioralChecks = Array.isArray(acc?.behavioral_checks) ? acc.behavioral_checks : [];
  const sourceRel = acc?.source_file || null;
  add('acceptance_conditions_present',
    Boolean(acc && sourceRel && testFiles.length >= 4 && behavioralChecks.length > 0 && acc.test_file_sha256),
    acc ? `source=${sourceRel} tests=${testFiles.length} behavioral=${behavioralChecks.length}` : 'no acceptance object');

  const srcAbs = sourceRel ? path.join(sandboxDir, sourceRel) : null;
  add('sandbox_files_present',
    Boolean(srcAbs && exists(srcAbs) && testFiles.every((f) => exists(path.join(sandboxDir, f)))),
    srcAbs
      ? `source_present=${exists(srcAbs)} tests_present=${testFiles.filter((f) => exists(path.join(sandboxDir, f))).length}/${testFiles.length}`
      : 'no source_file declared');

  // ── 2. 修复前失败证据：真实存在、exit≠0、有断言输出、未被超时污染 ──────────
  const beforeDir = path.join(sandboxDir, 'evidence', 'before');
  const failing = safeJson(path.join(beforeDir, 'failing-test.json'));
  const beforeSourceText = safeRead(path.join(beforeDir, 'source.txt'));
  const beforeTestsSha = safeJson(path.join(beforeDir, 'tests-sha256.json'));
  const beforeOutput = failing ? `${failing.stdout || ''}\n${failing.stderr || ''}` : '';
  const hasAssertOutput = /AssertionError|!==|Expected values/.test(beforeOutput);
  const genuineFailure = Boolean(
    failing && typeof failing.exit_code === 'number' && failing.exit_code !== 0
      && failing.timed_out !== true && hasAssertOutput,
  );
  add('before_evidence_present', genuineFailure,
    failing
      ? `exit=${failing.exit_code} timed_out=${failing.timed_out} has_assert_output=${hasAssertOutput}`
      : 'missing evidence/before/failing-test.json');

  // 证据哈希重算一致（自己重算，不采信结论）
  add('before_source_hash_consistent',
    Boolean(beforeSourceText !== null && failing && sha256(beforeSourceText) === failing.source_sha256),
    beforeSourceText !== null && failing
      ? `recomputed=${sha256(beforeSourceText)} recorded=${failing.source_sha256}`
      : 'missing before source/evidence');
  add('before_test_hashes_match_task',
    Boolean(beforeTestsSha && acc?.test_file_sha256
      && JSON.stringify(beforeTestsSha) === JSON.stringify(acc.test_file_sha256)),
    beforeTestsSha
      ? `match=${JSON.stringify(beforeTestsSha) === JSON.stringify(acc?.test_file_sha256)}`
      : 'missing evidence/before/tests-sha256.json');

  // ── 3. 独立重建修复前源码，真实重跑原始失败测试，证明「修复前失败」─────────
  const verifyDir = path.join(sandboxDir, '.independent-verify');
  let beforeReproduced = false;
  let beforeReproExit = 'not-run';
  if (beforeSourceText !== null && sourceRel && acc?.original_failing_test
    && testFiles.includes(acc.original_failing_test)) {
    try {
      fs.rmSync(verifyDir, { recursive: true, force: true });
      fs.mkdirSync(path.join(verifyDir, path.dirname(sourceRel)), { recursive: true });
      fs.mkdirSync(path.join(verifyDir, path.dirname(acc.original_failing_test)), { recursive: true });
      // 写独立的「修复前」源码（来自证据全文）与原始测试副本；测试相对导入会命中该源码。
      fs.writeFileSync(path.join(verifyDir, sourceRel), beforeSourceText, 'utf8');
      const origTestText = safeRead(path.join(sandboxDir, acc.original_failing_test));
      fs.writeFileSync(path.join(verifyDir, acc.original_failing_test), origTestText || '', 'utf8');
      const r = spawnNode(path.join(verifyDir, acc.original_failing_test), verifyDir, timeoutMs, commandEnv);
      beforeReproExit = r.exit_code;
      beforeReproduced = !r.timed_out && r.exit_code !== null && r.exit_code !== 0;
    } catch (error) {
      beforeReproduced = false;
      beforeReproExit = `error:${error.message}`;
    }
  }
  add('before_failure_reproduced', beforeReproduced,
    `independent rerun of before-source → exit=${beforeReproExit} (期望非 0，证明修复前缺陷真实存在)`);

  // ── 4. 独立读最终源码 + 源码差异 + 证据哈希重算 ───────────────────────────
  const finalText = srcAbs ? safeRead(srcAbs) : null;
  const afterDir = path.join(sandboxDir, 'evidence', 'after');
  const afterHashes = safeJson(path.join(afterDir, 'hashes.json'));
  const diffText = safeRead(path.join(afterDir, 'diff.txt'));
  const afterSourceText = safeRead(path.join(afterDir, 'source.txt'));
  const afterCommands = safeJson(path.join(afterDir, 'commands.json'));
  const afterEvidencePresent = Boolean(
    afterHashes && diffText !== null && afterSourceText !== null && Array.isArray(afterCommands),
  );
  add('after_evidence_present', afterEvidencePresent,
    afterEvidencePresent ? 'hashes/diff/source/commands 齐全' : '缺失 after 证据文件（可能修复未完成/中断）');

  add('after_source_hash_consistent',
    Boolean(finalText !== null && afterSourceText !== null && afterHashes
      && sha256(finalText) === afterHashes.after_source
      && sha256(afterSourceText) === afterHashes.after_source),
    finalText !== null && afterHashes
      ? `disk=${sha256(finalText)} recorded=${afterHashes.after_source} evidence_text=${afterSourceText !== null ? sha256(afterSourceText) : 'missing'}`
      : 'missing final source/evidence');

  const diffChangesBehavior = Boolean(
    diffText && diffText.length > 0 && /^[-+].*return/m.test(diffText)
      && afterHashes && afterHashes.before_source !== afterHashes.after_source,
  );
  add('source_diff_nonempty_and_changes_behavior', diffChangesBehavior,
    `diff_len=${diffText ? diffText.length : 0} has_return_change=${diffText ? /^[-+].*return/m.test(diffText) : false} before=${afterHashes?.before_source} after=${afterHashes?.after_source}`);

  add('diff_hash_consistent',
    Boolean(diffText !== null && afterHashes && sha256(diffText) === afterHashes.source_diff_sha256),
    diffText !== null && afterHashes
      ? `recomputed=${sha256(diffText)} recorded=${afterHashes.source_diff_sha256}`
      : 'missing diff/hashes');

  // ── 5. 测试预期文件未被篡改（独立重算 sha256 对比 TASK 锁定值）────────────
  const recomputedTestSha = {};
  const tampered = [];
  for (const rel of testFiles) {
    const txt = safeRead(path.join(sandboxDir, rel));
    const h = txt === null ? null : sha256(txt);
    recomputedTestSha[rel] = h;
    const expected = acc?.test_file_sha256?.[rel];
    if (!expected || h !== expected) tampered.push(rel);
  }
  add('test_files_untampered', tampered.length === 0,
    tampered.length === 0
      ? `all ${testFiles.length} test files match TASK-locked sha256（未改测试预期/未放宽断言）`
      : `tampered=[${tampered.join(',')}]`);
  add('after_test_hashes_consistent',
    Boolean(afterHashes?.test_files
      && testFiles.every((rel) => afterHashes.test_files[rel] === recomputedTestSha[rel])),
    afterHashes?.test_files
      ? `cross-check=${testFiles.every((rel) => afterHashes.test_files[rel] === recomputedTestSha[rel])}`
      : 'missing after/hashes.json test_files');

  // ── 6. 独立动态 import 最终源码，直接从行为证明 add(2,3)===5 ──────────────
  const behavioralResults = [];
  let behavioralAllPass = behavioralChecks.length > 0;
  for (const c of behavioralChecks) {
    let observed = 'not-run';
    let pass = false;
    if (srcAbs && finalText !== null) {
      try {
        const url = `${pathToFileURL(srcAbs).href}?uap_independent=${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        const mod = await import(url);
        const fn = mod[c.export];
        observed = typeof fn === 'function' ? fn(...c.args) : 'not_a_function';
        pass = observed === c.expected;
      } catch (error) {
        observed = `import_error:${error.message}`;
        pass = false;
      }
    }
    behavioralResults.push({ export: c.export, args: c.args, expected: c.expected, observed, pass });
    if (!pass) behavioralAllPass = false;
  }
  add('behavioral_check_add', behavioralAllPass,
    behavioralResults.map((r) => `${r.export}(${(r.args || []).join(',')})=${r.observed} expected=${r.expected} pass=${r.pass}`).join('; ') || 'no behavioral checks');

  // ── 7. 独立 spawn 重跑 4 类测试（自己判 exit_code 与 stdout）──────────────
  const phaseMap = {
    original_test_independent_rerun: 'after_original',
    regression_test_independent_rerun: 'after_regression',
    module_test_independent_rerun: 'after_module',
    full_test_independent_rerun: 'after_full',
  };
  const rerunSpecs = [
    { name: 'original_test_independent_rerun', rel: acc?.original_failing_test },
    { name: 'regression_test_independent_rerun', rel: acc?.regression_test },
    { name: 'module_test_independent_rerun', rel: acc?.module_test },
    { name: 'full_test_independent_rerun', rel: acc?.full_test },
  ];
  const independentCommands = [];
  const observedByPhase = {};
  for (const s of rerunSpecs) {
    let pass = false;
    let detail = 'missing test file';
    let r = null;
    if (s.rel) {
      const abs = path.join(sandboxDir, s.rel);
      if (exists(abs)) {
        r = spawnNode(abs, sandboxDir, timeoutMs, commandEnv);
        const okMarker = /E2E_OK/.test(r.stdout || '');
        pass = !r.timed_out && r.exit_code === 0 && okMarker;
        detail = `exit=${r.exit_code} timed_out=${r.timed_out} E2E_OK=${okMarker} cmd=node ${path.relative(sandboxDir, abs)}`;
      }
    }
    independentCommands.push({ name: s.name, ...(r || {}) });
    add(s.name, pass, detail);
    observedByPhase[phaseMap[s.name]] = r ? r.exit_code : null;
  }

  // ── 8. 命令退出码重算一致（只比对原始数据，不引用任何 PASS 结论）───────────
  const recordedByPhase = {};
  if (Array.isArray(afterCommands)) {
    for (const c of afterCommands) if (c.phase) recordedByPhase[c.phase] = c.exit_code;
  }
  const phaseKeys = Object.values(phaseMap);
  const exitCodesConsistent = phaseKeys.every(
    (k) => recordedByPhase[k] !== undefined && observedByPhase[k] !== undefined
      && recordedByPhase[k] === observedByPhase[k],
  );
  add('command_exit_codes_consistent', exitCodesConsistent,
    phaseKeys.map((k) => `${k}:recorded=${recordedByPhase[k]} observed=${observedByPhase[k]}`).join('; '));

  return {
    component: 'independent-regression-e2e',
    verdict: failures.length === 0 ? 'PASS' : 'FAIL',
    sandbox_dir: sandboxDir,
    task_file: taskFile,
    checks,
    failures,
    checks_total: checks.length,
    checks_passed: checks.filter((c) => c.pass).length,
    independent_commands: independentCommands,
    behavioral_checks: behavioralResults,
    at: new Date().toISOString(),
  };
}

function isMainModule(metaUrl) {
  const arg = process.argv[1];
  if (!arg) return false;
  try { return path.resolve(arg) === fileURLToPath(metaUrl); } catch { return false; }
}

// CLI：独立跑一次验证器，自己给出 PASS/FAIL 与退出码。
if (isMainModule(import.meta.url)) {
  const sandboxDir = process.argv[2];
  if (!sandboxDir) {
    process.stderr.write('usage: node independent-regression-e2e.mjs <sandboxDir> [timeoutMs]\n');
    process.exitCode = 2;
  } else {
    const verdict = await verifyIndependentRegression({
      sandboxDir,
      timeoutMs: Number(process.argv[3]) || 60000,
    });
    process.stdout.write(`${JSON.stringify(verdict, null, 2)}\n`);
    process.exitCode = verdict.verdict === 'PASS' ? 0 : 1;
  }
}
