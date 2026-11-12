/**
 * financial-simulation.mjs — 资金完整性静态源码审计 + 进程内内存模拟
 *
 * 绝对红线：纯静态源码分析 + 进程内内存模拟。绝不连接真实支付网关、
 * 绝不写数据库、绝不发起任何网络请求、绝不调用真实退款/支付。
 * 仅 import 两个只读共享库（paths / util），不引入命令执行器。
 * simulated_only 恒为 true；「模拟通过」绝不等价于「真实资金验证通过」。
 */
import { rootPath, uapPath } from '../runtime/_lib/paths.mjs';
import { nowISO, readText, exists } from '../runtime/_lib/util.mjs';

export const component = 'financial-simulation';

const SIMULATED_ONLY = true;

/** 16 个源码场景：每个都必须在 Uter 真实源码里匹配到防护锚点才可能 PASS。 */
const SOURCE_SCENARIOS = [
  {
    id: 'payment_success_order_state',
    scenario: '支付成功后订单状态落库路径',
    files: ['model/topup.go'],
    anchors: ['TopUpStatusSuccess', 'alreadyDone', 'claimPendingTopUp', 'CompleteTime', 'creditTopUpQuota'],
  },
  {
    id: 'signature_verification',
    scenario: '支付宝/微信回调验签',
    files: ['service/cn_pay_sign.go', 'service/alipay_query.go'],
    anchors: ['func AlipayVerifySign', 'alipayNotifyVerifyContent', 'AlipayVerifyResponse', 'signature invalid', 'RSA2'],
  },
  {
    id: 'duplicate_notification',
    scenario: '重复通知幂等',
    files: ['model/topup.go', 'controller/topup_alipay.go'],
    anchors: ['alreadyDone', '绝不二次入账', 'idempotent repeat', 'AlipayReconcileSuccess'],
  },
  {
    id: 'local_order_save_failure_recovery',
    scenario: '本地订单保存失败恢复',
    files: ['controller/payment_recovery_fault_injection_test.go', 'controller/topup_alipay.go'],
    anchors: ['credit_failed', 'AlipayReconcileCreditFailed', '恰好入账一次', '恢复', '保持 pending 待重试'],
  },
  {
    id: 'refund_linked_to_original_order',
    scenario: '退款关联原订单',
    files: ['service/billing_session.go', 'model/refund_intent.go'],
    anchors: ['requestId', 'relay-refund:', 'originating request id', 'IdempotencyKey'],
  },
  {
    id: 'duplicate_refund',
    scenario: '重复退款防护',
    files: ['model/refund_intent.go', 'service/billing_session.go'],
    anchors: ['errRefundIntentAlreadyDone', 'already done', 's.refunded', 'refunded ||'],
  },
  {
    id: 'concurrent_billing',
    scenario: '并发扣费 / quota 原子 CAS',
    files: ['model/token.go', 'service/quota.go'],
    anchors: ['remain_quota >= ?', 'RowsAffected == 0', '原子预扣', '超扣'],
  },
  {
    id: 'balance_ledger_consistency',
    scenario: '余额流水一致',
    files: ['model/billing_integrity_test.go', 'model/task_billing_state.go'],
    anchors: ['PreConsumed', 'settlement delta', 'balance', 'IdempotencyKey'],
  },
  {
    id: 'exception_recovery',
    scenario: '异常恢复',
    files: ['model/refund_intent.go', 'service/billing_session.go', 'controller/payment_recovery_fault_injection_test.go'],
    anchors: ['SweepPendingRefundIntents', 'stays pending for sweep', 'fail-closed', '故障注入'],
  },
  {
    id: 'price_change',
    scenario: '价格变化时的金额快照',
    files: ['controller/topup_cn_amount_snapshot_test.go', 'controller/topup_wechat.go', 'controller/topup_stripe.go'],
    anchors: ['ProviderAmount', 'ProviderCurrency', '快照', 'providerExpectedMinorUnits'],
  },
  {
    id: 'upstream_failure',
    scenario: '上游失败处理',
    files: ['controller/payment_recovery_fault_injection_test.go', 'service/alipay_query.go'],
    anchors: ['网关故障', '自动重试', '保持 pending', 'http status', 'signature invalid'],
  },
  {
    id: 'idempotency',
    scenario: '幂等键 / 状态检查',
    files: ['model/refund_intent.go', 'model/topup.go', 'model/task_billing_state.go'],
    anchors: ['IdempotencyKey', 'uniqueIndex', 'status = ?', 'alreadyDone', 'billing_idempotency_key'],
  },
  {
    id: 'historical_fund_data_protection',
    scenario: '历史资金数据迁移保护',
    files: ['service/task_billing.go', 'model/token_migration.go'],
    anchors: ['TaskRefundLegacyCutoff', 'historical terminal task', 'automatic refund is disabled', 'fail-closed'],
  },
  // 以下 3 个为补充场景，覆盖已确认的真实线索（同样必须真实匹配源码）
  {
    id: 'alipay_query_four_state',
    scenario: '查单四分状态与未支付/终态区分',
    files: ['controller/topup_alipay.go', 'service/alipay_query.go', 'controller/topup_alipay_query_test.go'],
    anchors: ['ACQ.TRADE_NOT_EXIST', 'TRADE_CLOSED', 'AlipayReconcileUnpaid', '"unpaid"', '"pending"', '"closed"', '"success"'],
  },
  {
    id: 'wechat_scene_info',
    scenario: '微信 v2/v3 scene_info 差异',
    files: ['controller/topup_wechat_h5_scene_test.go', 'controller/topup_wechat.go'],
    anchors: ['scene_info', 'h5_info', 'APIv3', 'buildWechatH5SceneInfo'],
  },
  {
    id: 'frontend_amount_rounding',
    scenario: '前端金额取整（toPayAmount 替代 Math.floor）',
    files: ['web/src/features/wallet/lib/payment.ts'],
    anchors: ['toPayAmount', 'Math.round', 'Math.floor(0.01)', '0.01'],
  },
];

function safeRead(rel) {
  try {
    return readText(rootPath(rel));
  } catch {
    return null;
  }
}

/** 真实读取候选源码，逐个锚点做字符串匹配；返回 PASS/FAIL/BLOCKED。 */
function evaluateSource(sc) {
  const existing = sc.files.filter((f) => exists(rootPath(f)));
  const texts = existing.map((f) => ({ file: f, text: safeRead(f) })).filter((t) => t.text !== null);
  const matched = [];
  const unmatched = [];
  for (const anchor of sc.anchors) {
    const hit = texts.find((t) => t.text.includes(anchor));
    if (hit) matched.push({ anchor, file: hit.file });
    else unmatched.push(anchor);
  }
  const matchedNames = matched.map((m) => m.anchor);
  const primaryFile = matched.length > 0 ? matched[0].file : (existing[0] || sc.files[0]);
  const baseEvidence = {
    file: primaryFile,
    matched: matchedNames,
    detail: `已读取 ${texts.length}/${sc.files.length} 个候选源码文件；` +
      `锚点匹配 ${matched.length}/${sc.anchors.length}；` +
      `命中文件=[${[...new Set(matched.map((m) => m.file))].join(', ') || '无'}]；` +
      `未命中锚点=[${unmatched.join(', ') || '无'}]。`,
  };

  if (texts.length === 0) {
    return {
      id: sc.id, scenario: sc.scenario, status: 'BLOCKED',
      evidence: { ...baseEvidence, detail: baseEvidence.detail + ' 候选源码文件均不存在或不可读，无法从源码证明。' },
      blockers: ['候选源码文件均不存在或不可读，无法从源码证明'],
    };
  }
  // Every declared anchor is a required protection. A partial match (or no
  // match at all) cannot be reported as PASS: that would let a single comment
  // stand in for the whole safety invariant.
  if (unmatched.length > 0) {
    return {
      id: sc.id, scenario: sc.scenario, status: 'FAIL',
      evidence: { ...baseEvidence, detail: baseEvidence.detail + ` 有 ${unmatched.length}/${sc.anchors.length} 个必需防护锚点未在源码中找到，不得判定通过。` },
      blockers: [`未命中必需防护锚点: ${unmatched.join(', ')}`],
    };
  }
  return {
    id: sc.id, scenario: sc.scenario, status: 'PASS',
    evidence: baseEvidence,
    blockers: [],
  };
}

// ---- 3 个进程内纯内存模拟（不触碰任何真实系统） ---------------------------

function mkAssert(name, expected, actual) {
  return { name, expected, actual, exit_code: expected === actual ? 0 : 1 };
}

function simDuplicateNotification() {
  const input = { initial_balance: 0, order_amount: 100, notifications: 5, initial_status: 'pending' };
  let balance = input.initial_balance;
  let creditCount = 0;
  let status = input.initial_status;
  const applied = [];
  for (let i = 0; i < input.notifications; i += 1) {
    // 镜像 model/topup.go 的 claimPendingTopUp CAS：仅 pending 可入账
    if (status === 'pending') {
      status = 'success';
      balance += input.order_amount;
      creditCount += 1;
      applied.push(`notify#${i + 1}: CREDIT`);
    } else {
      applied.push(`notify#${i + 1}: SKIP(alreadyDone)`);
    }
  }
  const output = { final_balance: balance, credited_count: creditCount, final_status: status, applied };
  const assertions = [
    mkAssert('credited_exactly_once', 1, creditCount),
    mkAssert('balance_equals_amount', input.order_amount, balance),
    mkAssert('duplicate_skipped', input.notifications - 1, applied.filter((a) => a.includes('SKIP')).length),
  ];
  return { input, output, assertions };
}

function simDuplicateRefund() {
  const input = { initial_balance: 100, refund_amount: 40, attempts: 3, idempotency_key: 'relay-refund:7:req-42' };
  let balance = input.initial_balance;
  const processed = new Set();
  const applied = [];
  for (let i = 0; i < input.attempts; i += 1) {
    // 镜像 model/refund_intent.go 的 uniqueIndex + errRefundIntentAlreadyDone
    if (processed.has(input.idempotency_key)) {
      applied.push(`refund#${i + 1}: REJECT(already done)`);
      continue;
    }
    processed.add(input.idempotency_key);
    balance += input.refund_amount;
    applied.push(`refund#${i + 1}: APPLY`);
  }
  const output = { final_balance: balance, refunds_applied: processed.size, applied };
  const assertions = [
    mkAssert('refund_applied_once', 1, processed.size),
    mkAssert('balance_conserved', input.initial_balance + input.refund_amount, balance),
    mkAssert('duplicates_rejected', input.attempts - 1, applied.filter((a) => a.includes('REJECT')).length),
  ];
  return { input, output, assertions };
}

function simConcurrentBilling() {
  const input = { initial_balance: 100, charge: 15, concurrent_requests: 10 };
  let balance = input.initial_balance;
  let success = 0;
  let rejected = 0;
  const applied = [];
  for (let i = 0; i < input.concurrent_requests; i += 1) {
    // 镜像 model/token.go decreaseTokenQuota 的原子条件：remain_quota >= charge
    if (balance >= input.charge) {
      balance -= input.charge;
      success += 1;
      applied.push(`req#${i + 1}: DEBIT ok`);
    } else {
      rejected += 1;
      applied.push(`req#${i + 1}: REJECT insufficient`);
    }
  }
  const output = { final_balance: balance, debits_succeeded: success, debits_rejected: rejected, applied };
  const assertions = [
    mkAssert('balance_never_negative', true, balance >= 0),
    mkAssert('balance_conservation', input.initial_balance, balance + success * input.charge),
    mkAssert('no_overdraft', input.initial_balance - Math.floor(input.initial_balance / input.charge) * input.charge, balance),
  ];
  return { input, output, assertions };
}

const SIMULATIONS = [
  { id: 'sim_duplicate_notification_credited_once', scenario: '内存模拟：重复通知只入账一次', fn: simDuplicateNotification },
  { id: 'sim_duplicate_refund_rejected', scenario: '内存模拟：重复退款被拒', fn: simDuplicateRefund },
  { id: 'sim_concurrent_billing_balance_conserved', scenario: '内存模拟：并发扣费余额守恒', fn: simConcurrentBilling },
];

function evaluateSimulation(sim) {
  const { input, output, assertions } = sim.fn();
  const allPass = assertions.every((a) => a.exit_code === 0);
  return {
    id: sim.id,
    scenario: sim.scenario,
    status: allPass ? 'PASS' : 'FAIL',
    evidence: {
      simulated: true,
      mode: 'in-process in-memory only (no DB / no network / no gateway / no real refund)',
      input,
      output,
      assertions, // 每条含 exit_code：0=断言通过，1=断言失败（进程退出码式）
      detail: `进程内纯内存模拟；${assertions.length} 条断言，通过 ${assertions.filter((a) => a.exit_code === 0).length} 条。` +
        `模拟通过不代表真实资金验证通过。`,
    },
    blockers: allPass ? [] : assertions.filter((a) => a.exit_code !== 0).map((a) => `断言失败: ${a.name}`),
  };
}

// ---- 主入口 ----------------------------------------------------------------

export async function financialSimulation() {
  const checks = [];
  for (const sc of SOURCE_SCENARIOS) checks.push(evaluateSource(sc));
  for (const sim of SIMULATIONS) checks.push(evaluateSimulation(sim));

  const total = checks.length;
  const passed = checks.filter((c) => c.status === 'PASS').length;
  const failed = checks.filter((c) => c.status === 'FAIL').length;
  const blocked = checks.filter((c) => c.status === 'BLOCKED').length;
  const failedIds = checks.filter((c) => c.status === 'FAIL').map((c) => c.id);
  const blockedIds = checks.filter((c) => c.status === 'BLOCKED').map((c) => c.id);

  const summary = `纯静态源码分析 + 进程内内存模拟（simulated_only=true；未连接任何支付网关/数据库/网络，` +
    `未发起真实退款）。共 ${total} 项检查（${SOURCE_SCENARIOS.length} 个源码场景 + ${SIMULATIONS.length} 个内存模拟）：` +
    `PASS=${passed}, FAIL=${failed}, BLOCKED=${blocked}。` +
    `源码场景均在 Uter 真实源码中按字符串锚点匹配，未匹配即 FAIL/BLOCKED，不允许无条件 PASS；` +
    `无法从源码证明的场景数（BLOCKED）= ${blocked}${blockedIds.length ? ' [' + blockedIds.join(', ') + ']' : ''}。` +
    (failedIds.length ? ` FAIL 场景=[${failedIds.join(', ')}]。` : ' 无 FAIL 场景。') +
    ` 注意：内存模拟 PASS 仅证明进程内逻辑自洽，绝不等于真实资金验证通过。`;

  return {
    generated_at: nowISO(),
    simulated_only: SIMULATED_ONLY,
    safety: {
      network_calls: 0,
      database_writes: 0,
      real_payments_or_refunds: 0,
      note: 'static source reading + in-memory arithmetic only',
    },
    checks,
    total,
    passed,
    failed,
    blocked,
    failed_ids: failedIds,
    blocked_ids: blockedIds,
    summary,
  };
}

/** 真实探测：共享库、关键源码、全部锚点文件、场景覆盖、只读 import、模拟标志。 */
export function health() {
  const selfPath = uapPath('tools/financial-simulation.mjs');
  const selfText = exists(selfPath) ? readText(selfPath) : '';
  const importLines = selfText.split('\n').filter((l) => /^\s*import\s/.test(l));
  const anchorFiles = [...new Set(SOURCE_SCENARIOS.flatMap((s) => s.files))];
  const critical = ['model/topup.go', 'service/billing_session.go', 'model/refund_intent.go', 'controller/topup_alipay.go'];
  const checks = {
    shared_libs_present: exists(uapPath('runtime/_lib/paths.mjs')) && exists(uapPath('runtime/_lib/util.mjs')),
    critical_source_present: critical.every((f) => exists(rootPath(f))),
    all_scenario_anchor_files_present: anchorFiles.every((f) => exists(rootPath(f))),
    readonly_imports_only: importLines.length > 0 && importLines.every((l) =>
      l.includes('_lib/paths.mjs') || l.includes('_lib/util.mjs')),
    scenario_coverage: SOURCE_SCENARIOS.length >= 13,
    simulated_only_flag: SIMULATED_ONLY === true,
  };
  const ok = Object.values(checks).every(Boolean);
  return { component, ok, checks, checked_at: nowISO() };
}
