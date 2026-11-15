/**
 * UAP Phase 2 · 真实自主代码修复端到端编排（修复侧）
 * ============================================================================
 * 目标：建立「真实自主定位缺陷 + 修改真实源代码 + 原始失败测试红转绿 +
 *       独立回归验证」的可验证闭环，且不从任务文件读取补丁答案。
 *
 * 与既有 real-code-repair.mjs 的本质区别：
 *   - 旧引擎：before.replace(task.patch.old, task.patch.new)，补丁/根因/复现/
 *     测试命令全部预写在任务 JSON；目标是仓库内已提交的 canary 夹具，测完
 *     用 git checkout 复原；ledger 不存修复前后代码文本。
 *   - 本引擎：TASK.json 只写「需求描述 / 验收条件 / 允许目录 / 测试文件哈希」，
 *     **绝不写补丁答案**；修复内容由「真实失败测试输出诊断 + 目标源码扫描 +
 *     候选算子变换 + 逐个写回源码并试跑原始失败测试直到红转绿」推导得出。
 *     全部文件写在 os.tmpdir() 专用隔离沙箱，不碰仓库内任何已跟踪文件。
 *
 * 自主定位流程（真实，不读答案）：
 *   1. 真实 spawn 运行缺陷态的 tests/original.test.mjs，捕获 exit≠0 与
 *      AssertionError 输出（如 `6 !== 5`、`actual: 6`、`expected: 5`）。
 *   2. parseFailure 从输出解析 expected/actual；从测试源码解析调用入参 add(2,3)。
 *   3. scanSource 定位 add() 函数内 `return <lhs> <op> <rhs>` 表达式（缺陷表达式）。
 *   4. 由诊断出的入参 + 源码检测到的算子，枚举算术算子候选并做符号预测，
 *      按「是否命中 expected」与「与 expected 距离」排序。
 *   5. 逐个候选写回真实源码 calc.mjs，重跑【原始】失败测试，取第一个红转绿者。
 *      —— 候选内容完全由源码 + 诊断推导，TASK.json 无任何补丁字段。
 *   6. 红转绿后跑新增回归、相关模块、完整必要测试；失败则回滚。
 *
 * 职责隔离：本模块只产出纯数据结果对象（不写 reports/state/evidence 到仓库，
 * 不自签 PASS）。PASS/FAIL 结论完全由 independent-regression-e2e.mjs 独立给出。
 *
 * 有界性：候选试跑次数 <= min(候选数, max_attempts)，全部失败即回滚并 FAILED，
 * 绝不无限循环。
 *
 * 支持真实故障注入选项（供自动化测试触发）：
 *   interruptAfterBefore  修复 Agent 在写补丁前中断（不写补丁 / 无 after 证据）
 *   resume                从保存的中间状态（BEFORE_CAPTURED）恢复继续修复
 *   timeoutMs/commandEnv  极短超时 + 慢命令，触发真实 ETIMEDOUT
 *   unfixable             写入超出候选能力、无法修复的缺陷，触发重试耗尽
 *   sandboxDir            复用同一沙箱（并发冲突 / 重复任务幂等场景）
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(__dirname, '../tests/fixtures/repair-e2e');

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const readText = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);
const writeJson = (p, value) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const safeJson = (p) => { try { return readJson(p); } catch { return null; } };

const FILES = {
  source: 'src/calc.mjs',
  tests: {
    original: 'tests/original.test.mjs',
    regression: 'tests/regression.test.mjs',
    module: 'tests/module.test.mjs',
    full: 'tests/full.test.mjs',
  },
};
const TEST_REL = Object.values(FILES.tests);

// 候选算术算子 + 纯符号预测（用于按诊断结果排序候选，不含任何"答案"字符串）。
const OPS = ['+', '-', '*', '/', '%', '**'];
const EVAL = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => a / b,
  '%': (a, b) => a % b,
  '**': (a, b) => a ** b,
};

// 精确定位 add() 函数体内的 return 二元表达式（不会误伤同文件的 mul()）。
const ADD_FN_RETURN =
  /(export\s+function\s+add\s*\([^)]*\)\s*\{[\s\S]*?return\s+)(\w+)(\s*)([+\-*/%]+)(\s*)(\w+)/;

// 故障注入用：缺陷含额外偏移项 +1，任何单算子变换都无法满足 add(2,3)===5。
const UNFIXABLE_SOURCE = `/**
 * 故障注入：缺陷含额外偏移项，超出候选算子变换能力（本引擎无法修复）。
 */
export function add(a, b) {
  return a * b + 1;
}

export function mul(a, b) {
  return a * b;
}
`;

/**
 * 创建专用隔离临时沙箱，真实写出：缺陷源码、原始失败测试、回归/模块/全量测试、
 * 以及只含需求与验收条件的 TASK.json（无任何补丁答案）。
 * @returns {{sandboxDir:string, taskFile:string, task:object}}
 */
export function createSandbox(opts = {}) {
  const sandboxDir = opts.sandboxDir
    ? path.resolve(opts.sandboxDir)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'uap-rrepair-'));
  for (const dir of [
    path.join(sandboxDir, 'src'),
    path.join(sandboxDir, 'tests'),
    path.join(sandboxDir, 'evidence', 'before'),
    path.join(sandboxDir, 'evidence', 'after'),
  ]) fs.mkdirSync(dir, { recursive: true });

  const fixtureMap = [
    ['calc.buggy.mjs', FILES.source],
    ['original.test.mjs', FILES.tests.original],
    ['regression.test.mjs', FILES.tests.regression],
    ['module.test.mjs', FILES.tests.module],
    ['full.test.mjs', FILES.tests.full],
  ];
  for (const [name, rel] of fixtureMap) {
    fs.copyFileSync(path.join(FIXTURE_DIR, name), path.join(sandboxDir, rel));
  }
  if (opts.unfixable) {
    fs.writeFileSync(path.join(sandboxDir, FILES.source), UNFIXABLE_SOURCE, 'utf8');
  }

  const testFileSha256 = {};
  for (const rel of TEST_REL) testFileSha256[rel] = sha256(readText(path.join(sandboxDir, rel)));

  const task = {
    task_id: opts.taskId || `UAP-E2E-REPAIR-${crypto.randomBytes(4).toString('hex')}`,
    title: '真实自主代码修复 + 独立回归验证闭环（端到端沙箱）',
    description:
      '修复 src/calc.mjs 的 add() 函数，使其按契约返回两数之和。' +
      '原始失败测试 tests/original.test.mjs 断言 add(2,3)===5，当前在缺陷态下失败。',
    acceptance: {
      source_file: FILES.source,
      original_failing_test: FILES.tests.original,
      regression_test: FILES.tests.regression,
      module_test: FILES.tests.module,
      full_test: FILES.tests.full,
      test_files: TEST_REL,
      test_file_sha256: testFileSha256,
      behavioral_checks: [{ export: 'add', args: [2, 3], expected: 5 }],
      allowed_write_paths: [FILES.source],
      rules: [
        '不得修改任何测试文件（其 sha256 由本需求文件锁定）',
        '不得放宽断言、不得跳过失败测试',
        '修复不得改变 mul() 的既有正确行为',
        '修复 Agent 不得自签 PASS，结论由独立验证器给出',
      ],
    },
    limits: {
      max_attempts: Number(opts.maxAttempts) || 3,
      timeout_ms: Number(opts.timeoutMs) || 60000,
    },
    created_at: new Date().toISOString(),
  };

  // 硬约束：TASK.json 不得含任何补丁答案（fail-fast 自检）。
  const serialized = JSON.stringify(task);
  if (/\bpatch\b|"old"|"new"|a\s*\+\s*b|return\s+a\s*\+\s*b/.test(serialized)) {
    throw new Error('TASK.json 不得包含补丁答案（检测到 patch/old/new/a+b 等字面量）');
  }
  writeJson(path.join(sandboxDir, 'TASK.json'), task);
  return { sandboxDir, taskFile: path.join(sandboxDir, 'TASK.json'), task };
}

/** 真实 spawnSync，如实记录 exit_code / timed_out / stdout / stderr / 耗时。 */
function exec(command, args, cfg) {
  const t0 = Date.now();
  const r = spawnSync(command, args, {
    cwd: cfg.sandboxDir,
    encoding: 'utf8',
    timeout: cfg.timeoutMs,
    env: { ...process.env, ...(cfg.commandEnv || {}) },
    maxBuffer: 8 * 1024 * 1024,
    shell: false,
  });
  const timedOut = r.error?.code === 'ETIMEDOUT' || (r.status === null && r.signal === 'SIGTERM');
  return {
    command,
    args,
    cwd: cfg.sandboxDir,
    exit_code: timedOut ? null : r.status,
    timed_out: timedOut,
    signal: r.signal || null,
    duration_ms: Date.now() - t0,
    stdout: (r.stdout || '').slice(0, 20000),
    stderr: (r.stderr || '').slice(0, 20000),
  };
}
const runTest = (cfg, rel) => exec('node', [path.join(cfg.sandboxDir, rel)], cfg);

/**
 * 自主诊断：从真实失败输出解析 expected/actual，从测试源码解析调用入参，
 * 扫描目标源码定位缺陷表达式，推导出候选算子变换列表（不含预写答案）。
 */
function diagnose(beforeText, failing, originalTestSource) {
  const output = `${failing.stdout || ''}\n${failing.stderr || ''}`;
  const ne = output.match(/(-?\d+(?:\.\d+)?)\s*!==\s*(-?\d+(?:\.\d+)?)/);
  const am = output.match(/actual:\s*(-?\d+(?:\.\d+)?)/);
  const em = output.match(/expected:\s*(-?\d+(?:\.\d+)?)/);
  const actual = am ? Number(am[1]) : ne ? Number(ne[1]) : null;
  const expected = em ? Number(em[1]) : ne ? Number(ne[2]) : null;
  const call = String(originalTestSource).match(
    /\badd\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/,
  );
  const inputs = call ? [Number(call[1]), Number(call[2])] : null;

  const m = beforeText.match(ADD_FN_RETURN);
  const location = m
    ? {
        line: beforeText.slice(0, m.index + m[1].length).split('\n').length,
        lhs: m[2],
        operator: m[4],
        rhs: m[6],
        defect_expression: `${m[2]} ${m[4]} ${m[6]}`,
        matched_span: m[0].slice(-40),
      }
    : null;

  const diagnosisConsistent = location && inputs && actual !== null && EVAL[location.operator]
    ? EVAL[location.operator](...inputs) === actual
    : null;

  const candidates = [];
  if (location) {
    for (const op of OPS) {
      const predicted = inputs && EVAL[op] ? EVAL[op](...inputs) : null;
      candidates.push({
        op,
        expression: `${location.lhs} ${op} ${location.rhs}`,
        predicted,
        matches_expected: predicted !== null && expected !== null && predicted === expected,
        is_current_buggy_operator: op === location.operator,
      });
    }
    candidates.sort((a, b) => {
      if (a.matches_expected !== b.matches_expected) return a.matches_expected ? -1 : 1;
      const da = a.predicted === null || expected === null ? Infinity : Math.abs(a.predicted - expected);
      const db = b.predicted === null || expected === null ? Infinity : Math.abs(b.predicted - expected);
      return da - db;
    });
  }

  return {
    file: FILES.source,
    method:
      'parse_failure_output + parse_test_call_inputs + scan_add_function_return_expression + ' +
      'arithmetic_operator_mutation + empirical_red_to_green_retry',
    failure_output_parsed: { actual, expected, inputs, assertion_message_found: Boolean(ne) },
    location,
    buggy_operator: location ? location.operator : null,
    diagnosis_consistent: diagnosisConsistent,
    candidates,
    answer_source: 'NONE — 候选由源码与诊断推导，TASK.json 不含补丁字段',
  };
}

/** 将某个候选算子写回真实源码（只替换 add() 内的算子，保留 mul() 与其余结构）。 */
function applyCandidate(sourceText, newOp) {
  if (!ADD_FN_RETURN.test(sourceText)) return sourceText;
  return sourceText.replace(
    ADD_FN_RETURN,
    (all, p1, lhs, p3, oldOp, p5, rhs) => `${p1}${lhs}${p3}${newOp}${p5}${rhs}`,
  );
}

/** 纯 JS 最小统一 diff（LCS + 3 行上下文），自包含、确定性、无外部进程依赖。 */
function unifiedDiff(beforeText, afterText, label) {
  const a = beforeText.replace(/\n+$/, '').split('\n');
  const b = afterText.replace(/\n+$/, '').split('\n');
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const edits = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      edits.push({ t: ' ', a: i + 1, b: j + 1, text: a[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      edits.push({ t: '-', a: i + 1, b: null, text: a[i] });
      i += 1;
    } else {
      edits.push({ t: '+', a: null, b: j + 1, text: b[j] });
      j += 1;
    }
  }
  while (i < n) { edits.push({ t: '-', a: i + 1, b: null, text: a[i] }); i += 1; }
  while (j < m) { edits.push({ t: '+', a: null, b: j + 1, text: b[j] }); j += 1; }

  const ctx = 3;
  const changeIdx = edits.map((e, k) => (e.t === ' ' ? -1 : k)).filter((k) => k >= 0);
  if (changeIdx.length === 0) return '';
  const hunks = [];
  let start = Math.max(0, changeIdx[0] - ctx);
  let end = Math.min(edits.length, changeIdx[0] + ctx + 1);
  for (let c = 1; c < changeIdx.length; c += 1) {
    const s = Math.max(0, changeIdx[c] - ctx);
    if (s <= end) end = Math.min(edits.length, changeIdx[c] + ctx + 1);
    else { hunks.push([start, end]); start = s; end = Math.min(edits.length, changeIdx[c] + ctx + 1); }
  }
  hunks.push([start, end]);

  const out = [`--- a/${label}`, `+++ b/${label}`];
  for (const [s, e] of hunks) {
    const chunk = edits.slice(s, e);
    const aStart = chunk.find((x) => x.a !== null)?.a ?? 0;
    const bStart = chunk.find((x) => x.b !== null)?.b ?? 0;
    const aCount = chunk.filter((x) => x.t !== '+').length;
    const bCount = chunk.filter((x) => x.t !== '-').length;
    out.push(`@@ -${aStart},${aCount} +${bStart},${bCount} @@`);
    for (const x of chunk) out.push(`${x.t}${x.text}`);
  }
  return `${out.join('\n')}\n`;
}

/** 构造「未执行修复」的结果对象（TIMED_OUT / INTERRUPTED / 阻断）。 */
function abortedResult(cfg, beforeInfo, status, blockers, extra = {}) {
  const h = beforeInfo.beforeHash;
  return {
    status,
    idempotent: false,
    recovered: false,
    task_id: cfg.taskId,
    sandbox_dir: cfg.sandboxDir,
    task_file: cfg.taskFile,
    before_failing: {
      command: beforeInfo.failing.command,
      args: beforeInfo.failing.args,
      exit_code: beforeInfo.failing.exit_code,
      timed_out: beforeInfo.failing.timed_out,
      stdout: beforeInfo.failing.stdout,
      stderr: beforeInfo.failing.stderr,
      duration_ms: beforeInfo.failing.duration_ms,
      source_sha256: h,
      test_file_sha256: beforeInfo.testFileSha256,
    },
    diagnosis: null,
    after_passing: null,
    source_diff: '',
    hashes: {
      before_source: h,
      after_source: h,
      test_files: beforeInfo.testFileSha256,
      source_diff_sha256: sha256(''),
    },
    commands: [{ phase: 'before_failing', ...beforeInfo.failing }],
    elapsed_ms: Date.now() - cfg.startedAt,
    attempts: 0,
    bounded_by: cfg.maxAttempts,
    rollback: false,
    blockers,
    timestamps: {
      started_at: new Date(cfg.startedAt).toISOString(),
      finished_at: new Date().toISOString(),
    },
    ...extra,
  };
}

/**
 * 自主定位 + 修复 + 回归 + 落证据（全部在沙箱内，输出纯数据结果对象）。
 * beforeInfo: { sourceText, beforeHash, failing, testFileSha256, originalTestSource }
 */
function performRepair(cfg, beforeInfo, opts) {
  const { sandboxDir } = cfg;
  const sourceAbs = path.join(sandboxDir, FILES.source);
  const commands = [];
  const diagnosis = diagnose(beforeInfo.sourceText, beforeInfo.failing, beforeInfo.originalTestSource);
  const maxAttempts = cfg.maxAttempts;
  const bounds = Math.min(diagnosis.candidates.length, maxAttempts);

  let attempts = 0;
  let chosen = null;
  let rolledBack = false;
  const candidateTrials = [];

  // ── 自主修复：逐个候选写回真实源码，重跑【原始失败测试】直到红转绿 ──────
  for (let k = 0; k < bounds; k += 1) {
    const cand = diagnosis.candidates[k];
    attempts += 1;
    const candidateText = applyCandidate(beforeInfo.sourceText, cand.op);
    fs.writeFileSync(sourceAbs, candidateText, 'utf8'); // 写回真实源代码
    const rerun = runTest(cfg, FILES.tests.original);   // 重跑原始失败测试
    commands.push({ phase: `candidate_attempt_${attempts}`, ...rerun });
    const green = rerun.exit_code === 0 && !rerun.timed_out;
    candidateTrials.push({
      op: cand.op,
      expression: cand.expression,
      predicted: cand.predicted,
      matches_expected: cand.matches_expected,
      exit_code: rerun.exit_code,
      green,
    });
    if (green) { chosen = cand; break; }
  }

  let status;
  let afterPassing = null;
  const blockers = [];
  if (chosen) {
    // 红转绿后：再跑原始测试 + 新增回归 + 相关模块 + 完整必要测试
    const rOriginal = runTest(cfg, FILES.tests.original);
    const rRegression = runTest(cfg, FILES.tests.regression);
    const rModule = runTest(cfg, FILES.tests.module);
    const rFull = runTest(cfg, FILES.tests.full);
    commands.push({ phase: 'after_original', ...rOriginal });
    commands.push({ phase: 'after_regression', ...rRegression });
    commands.push({ phase: 'after_module', ...rModule });
    commands.push({ phase: 'after_full', ...rFull });
    afterPassing = {
      original_test: rOriginal,
      regression_test: rRegression,
      module_test: rModule,
      full_test: rFull,
    };
    const allGreen = [rOriginal, rRegression, rModule, rFull].every(
      (r) => r.exit_code === 0 && !r.timed_out,
    );
    if (!allGreen) {
      fs.writeFileSync(sourceAbs, beforeInfo.sourceText, 'utf8');
      rolledBack = true;
      chosen = null;
      status = 'FAILED';
      blockers.push('候选使原始测试转绿，但回归/模块/全量测试存在失败，已回滚');
    } else {
      status = 'SUCCEEDED';
    }
  } else {
    // 候选全部失败：有界停止 + 回滚（不再无限循环）
    fs.writeFileSync(sourceAbs, beforeInfo.sourceText, 'utf8');
    rolledBack = true;
    status = 'FAILED';
    blockers.push(
      `候选变换全部试跑失败，attempts=${attempts}/${maxAttempts}，已回滚到修复前源码并停止`,
    );
  }

  // ── 保存证据：前后源码全文、前后 sha256、uni-diff、命令+退出码+stdout、耗时 ──
  const finalText = readText(sourceAbs); // 磁盘真实最终态
  const afterHash = sha256(finalText);
  const diff = unifiedDiff(beforeInfo.sourceText, finalText, FILES.source);
  const testFilesAfter = {};
  for (const rel of TEST_REL) testFilesAfter[rel] = sha256(readText(path.join(sandboxDir, rel)));
  const hashes = {
    before_source: beforeInfo.beforeHash,
    after_source: afterHash,
    test_files: testFilesAfter,
    source_diff_sha256: sha256(diff),
  };
  const allCommands = [{ phase: 'before_failing', ...beforeInfo.failing }, ...commands];
  const afterDir = path.join(sandboxDir, 'evidence', 'after');
  fs.mkdirSync(afterDir, { recursive: true });
  fs.writeFileSync(path.join(afterDir, 'source.txt'), finalText, 'utf8');
  fs.writeFileSync(path.join(afterDir, 'diff.txt'), diff, 'utf8');
  writeJson(path.join(afterDir, 'hashes.json'), hashes);
  writeJson(path.join(afterDir, 'commands.json'), allCommands);
  writeJson(path.join(afterDir, 'repair-meta.json'), {
    diagnosis,
    candidates_tried: candidateTrials,
    chosen: chosen ? { op: chosen.op, expression: chosen.expression } : null,
    attempts,
    max_attempts: maxAttempts,
    bounded_by: maxAttempts,
    rollback: rolledBack,
    status,
    note: '修复内容由源码扫描 + 失败诊断 + 候选变换 + 原始测试红转绿推导；TASK.json 不含补丁答案',
  });

  return {
    status,
    ...(opts.recovered ? { recovered: true } : {}),
    idempotent: false,
    task_id: cfg.taskId,
    sandbox_dir: sandboxDir,
    task_file: cfg.taskFile,
    before_failing: {
      command: beforeInfo.failing.command,
      args: beforeInfo.failing.args,
      exit_code: beforeInfo.failing.exit_code,
      timed_out: beforeInfo.failing.timed_out,
      stdout: beforeInfo.failing.stdout,
      stderr: beforeInfo.failing.stderr,
      duration_ms: beforeInfo.failing.duration_ms,
      source_sha256: beforeInfo.beforeHash,
      test_file_sha256: beforeInfo.testFileSha256,
    },
    diagnosis,
    after_passing: afterPassing,
    source_diff: diff,
    hashes,
    commands: allCommands,
    elapsed_ms: Date.now() - cfg.startedAt,
    attempts,
    bounded_by: maxAttempts,
    rollback: rolledBack,
    blockers,
    timestamps: {
      started_at: new Date(cfg.startedAt).toISOString(),
      finished_at: new Date().toISOString(),
    },
  };
}

/**
 * 端到端编排入口。导出给自动化测试与主流程调用。
 * @param {object} opts 见文件头「故障注入选项」
 * @returns {Promise<object>} 纯数据结果对象（不自签 PASS）
 */
export async function runRealRepairE2E(opts = {}) {
  const startedAt = Date.now();

  // ── 同步段：创建/定位沙箱 + 文件锁（并发控制，原子 'wx' 创建）────────────
  let sandboxDir = opts.sandboxDir ? path.resolve(opts.sandboxDir) : null;
  if (!sandboxDir) sandboxDir = createSandbox(opts).sandboxDir;
  const lockPath = path.join(sandboxDir, '.repair.lock');
  let lockFd = null;
  try {
    lockFd = fs.openSync(lockPath, 'wx');
    fs.writeSync(lockFd, `${process.pid}\n`);
  } catch (error) {
    if (error.code === 'EEXIST') {
      return {
        status: 'LOCK_HELD',
        sandbox_dir: sandboxDir,
        attempts: 0,
        blockers: ['同一沙箱已有修复实例持有文件锁，本次不执行（并发冲突：有且只有一个成功）'],
      };
    }
    throw error;
  }

  try {
    // 真实并发窗口：让同一事件循环内另一实例有机会观察到锁（故障注入③可确定性触发）。
    await new Promise((resolve) => setImmediate(resolve));

    const taskFile = path.join(sandboxDir, 'TASK.json');
    const task = readJson(taskFile);
    const cfg = {
      sandboxDir,
      taskFile,
      taskId: task.task_id,
      timeoutMs: Number(opts.timeoutMs) || Number(task.limits?.timeout_ms) || 60000,
      maxAttempts: Math.min(Number(opts.maxAttempts) || Number(task.limits?.max_attempts) || 3, 5),
      commandEnv: opts.commandEnv || {},
      startedAt,
    };
    const statusPath = path.join(sandboxDir, 'repair-status.json');

    // ── 幂等：重复任务识别为已完成，不伪造第二次修复 ────────────────────────
    if (!opts.resume && !opts.force && exists(statusPath)) {
      const prev = safeJson(statusPath);
      if (prev?.phase === 'COMPLETED' && prev.result?.hashes?.after_source
        && sha256(readText(path.join(sandboxDir, FILES.source))) === prev.result.hashes.after_source) {
        return {
          ...prev.result,
          status: 'IDEMPOTENT',
          idempotent: true,
          attempts: 0,
          recovered: false,
          blockers: [
            ...(prev.result.blockers || []),
            '重复任务：识别为已完成，本次未执行任何修复（幂等，attempts=0）',
          ],
          timestamps: { ...prev.result.timestamps, finished_at: new Date().toISOString() },
        };
      }
    }

    // ── 恢复：从保存的中间状态（BEFORE_CAPTURED）继续 ──────────────────────
    let beforeInfo = null;
    let recovered = false;
    if (opts.resume && exists(statusPath)) {
      const prev = safeJson(statusPath);
      if (prev?.phase === 'BEFORE_CAPTURED') {
        const failing = safeJson(path.join(sandboxDir, 'evidence', 'before', 'failing-test.json'));
        const sourceText = readText(path.join(sandboxDir, 'evidence', 'before', 'source.txt'));
        const beforeHash = sha256(sourceText);
        const diskHash = sha256(readText(path.join(sandboxDir, FILES.source)));
        if (!failing || diskHash !== beforeHash) {
          throw new Error('恢复失败：磁盘源码与保存的中间状态不一致');
        }
        beforeInfo = {
          sourceText,
          beforeHash,
          failing,
          testFileSha256: safeJson(path.join(sandboxDir, 'evidence', 'before', 'tests-sha256.json')) || {},
          originalTestSource: readText(path.join(sandboxDir, FILES.tests.original)),
        };
        recovered = true;
      }
    }

    // ── 修复前：真实执行失败测试，捕获 exit≠0 / stdout / 源码与测试哈希 ──────
    if (!beforeInfo) {
      const beforeSourceText = readText(path.join(sandboxDir, FILES.source));
      const beforeHash = sha256(beforeSourceText);
      const failing = exec('node', [path.join(sandboxDir, FILES.tests.original)], cfg);
      const testFileSha256 = {};
      for (const rel of TEST_REL) testFileSha256[rel] = sha256(readText(path.join(sandboxDir, rel)));
      const beforeDir = path.join(sandboxDir, 'evidence', 'before');
      fs.mkdirSync(beforeDir, { recursive: true });
      fs.writeFileSync(path.join(beforeDir, 'source.txt'), beforeSourceText, 'utf8');
      writeJson(path.join(beforeDir, 'failing-test.json'), {
        ...failing,
        source_sha256: beforeHash,
        test_file_sha256: testFileSha256,
      });
      writeJson(path.join(beforeDir, 'tests-sha256.json'), testFileSha256);
      beforeInfo = {
        sourceText: beforeSourceText,
        beforeHash,
        failing,
        testFileSha256,
        originalTestSource: readText(path.join(sandboxDir, FILES.tests.original)),
      };

      // 保存中间状态（修复 Agent 自用；独立验证器明确不读取此文件）。
      writeJson(statusPath, {
        task_id: cfg.taskId,
        phase: 'BEFORE_CAPTURED',
        started_at: new Date(startedAt).toISOString(),
        updated_at: new Date().toISOString(),
        before_hash: beforeHash,
        attempts: 0,
        note: '修复 Agent 的中间状态，非 PASS 结论；独立验证器不读取本文件',
      });

      // fail-closed：修复前失败证据不成立（超时/已通过/exit 为 null）→ 拒绝制造假闭环。
      if (failing.timed_out || failing.exit_code === null || failing.exit_code === 0) {
        writeJson(statusPath, {
          task_id: cfg.taskId, phase: 'BLOCKED',
          before_hash: beforeHash, attempts: 0,
          note: '修复前失败证据不成立，fail-closed 终止；独立验证器不读取本文件',
        });
        return abortedResult(cfg, beforeInfo, 'TIMED_OUT', [
          `修复前失败证据不成立（timed_out=${failing.timed_out}, exit=${failing.exit_code}），fail-closed 终止`,
        ]);
      }

      // 故障注入①：修复 Agent 中途退出 / 不写补丁（保留 before 证据，无 after 证据）。
      if (opts.interruptAfterBefore) {
        return abortedResult(cfg, beforeInfo, 'INTERRUPTED', [
          '修复 Agent 在写入补丁前中断（故障注入），源码仍为缺陷态，未生成 after 证据',
        ]);
      }
    }

    // ── 自主定位 + 修复 + 回归 ──────────────────────────────────────────────
    const result = performRepair(cfg, beforeInfo, { recovered });
    writeJson(statusPath, {
      task_id: cfg.taskId,
      phase: result.status === 'SUCCEEDED' ? 'COMPLETED' : 'FAILED',
      started_at: new Date(startedAt).toISOString(),
      updated_at: new Date().toISOString(),
      before_hash: result.hashes.before_source,
      after_hash: result.hashes.after_source,
      attempts: result.attempts,
      result,
      note: '修复 Agent 的中间/最终状态，非 PASS 结论；独立验证器不读取本文件',
    });
    return result;
  } finally {
    try { if (lockFd !== null) fs.closeSync(lockFd); } catch { /* ignore */ }
    try { fs.unlinkSync(lockPath); } catch { /* ignore */ }
  }
}

function isMainModule(metaUrl) {
  const arg = process.argv[1];
  if (!arg) return false;
  try { return path.resolve(arg) === fileURLToPath(metaUrl); } catch { return false; }
}

// CLI 自跑：真实执行一次完整闭环，stdout 仅输出纯数据结果对象 JSON。
if (isMainModule(import.meta.url)) {
  const result = await runRealRepairE2E({});
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = ['SUCCEEDED', 'IDEMPOTENT'].includes(result.status) ? 0 : 1;
}
