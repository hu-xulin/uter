/**
 * SPECIFICATION-INDEX.md generator.
 *
 * The per-specification status column and the global status block are derived
 * from the SAME `computeFinalStatus()` verdict used by FINAL-STATUS.json and
 * `uap status`. A specification is never marked VERIFIED because its Markdown
 * header says ACTIVE — only when every one of its requirements is verified
 * with evidence bound to the current execution.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, UAP } from '../runtime/_lib/paths.mjs';
import { loadAllConfigs, registryIntegrity, REQUIRED_SPEC_SECTIONS } from '../runtime/_lib/config.mjs';
import { nowISO } from '../runtime/_lib/util.mjs';
import { statusVerdict, renderStatusBlock } from '../runtime/status-engine/snapshot.mjs';

const FINAL_STATES = Object.freeze([
  'NOT_BUILT', 'PARTIALLY_BUILT', 'IMPLEMENTED_NOT_VERIFIED',
  'PARTIALLY_VERIFIED', 'FULLY_VERIFIED', 'FULLY_OPERATIONAL', 'BLOCKED', 'FAILED',
]);

/**
 * @param {{verdict: object, specVer: object}|null} engine  A verdict produced
 *   by statusVerdict(). Pass it in when generating the index together with the
 *   final report so both artifacts carry byte-identical status claims.
 */
export function generateIndex(engine = null) {
  const { verdict, specVer } = engine || statusVerdict();
  const configs = loadAllConfigs();
  const specs = configs['specification-registry'].specifications || [];
  const integrity = registryIntegrity(configs);
  const domains = [...new Set(specs.map((s) => s.domain))];

  const lines = [
    '# UAP 1.0 — 规范索引',
    '',
    renderStatusBlock(verdict, specVer),
    '',
    `- 生成时间：${nowISO()}（由 \`node .uap/tools/generate-index.mjs\` 依据真实注册表生成）`,
    `- 规范总数：**${specs.length}**`,
    `- 注册表完整性：**${integrity.ok ? 'PASS' : 'FAIL'}**（${integrity.checks.filter((c) => c.status === 'PASS').length}/${integrity.checks.length} 项检查，${integrity.findings.length} 条阻断发现）`,
    '',
    '## 统一最终状态（与 FINAL-STATUS.json、uap status 同源）',
    '',
    '| 字段 | 值 |',
    '| --- | --- |',
    `| 计算函数 | \`${verdict.computed_by}\` |`,
    `| execution_id | \`${verdict.execution_id}\` |`,
    `| git_head | \`${verdict.git_head}\` |`,
    `| **overall_status** | **${verdict.overall_status}** |`,
    `| claim_allowed | ${verdict.claim_allowed} |`,
    `| 适用要求 / 已验证 | ${verdict.counts.applicable} / ${verdict.counts.verified} |`,
    `| 规范已验证 / 总数 | ${specVer.verified_specs} / ${specVer.total_specs} |`,
    `| 能力缺口 | ${verdict.capability_gaps.join(', ') || '无'} |`,
    '',
    `> 状态口径由状态机给出：\`${FINAL_STATES.join('` / `')}\`。`,
    '> 规范文件头的 `ACTIVE` 只表示「规范已建成」，不表示「已验证」；`IMPLEMENTED_NOT_VERIFIED` 不得自动改成 PASS。',
    '> 判定原因：' + (verdict.reasons.length ? verdict.reasons.map((r) => `\`${r}\``).join('；') : '无'),
    '',
    '## 统一章节要求',
    '',
    `每份规范必须包含：${REQUIRED_SPEC_SECTIONS.map((s) => `\`${s}\``).join('、')}，另含「Uter 落地细则」。`,
    '',
    '## 按域索引',
    '',
  ];

  for (const domain of domains) {
    lines.push(`### ${domain}`, '', '| 编号 | 名称 | 文件 | 关键级别 | 验证状态 | 头部声明 | 执行器 | 验证器 | 依赖 |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const spec of specs.filter((s) => s.domain === domain)) {
      const file = path.join(ROOT, spec.file);
      const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      const nameMatch = text.match(/\*\*名称：\*\*\s*(.+)/);
      const statusMatch = text.match(/\*\*状态：\*\*\s*([A-Z_]+)/);
      const name = nameMatch ? nameMatch[1].trim() : spec.id;
      const declared = statusMatch ? statusMatch[1] : 'MISSING';
      const bytes = Buffer.byteLength(text);
      const row = specVer.per_spec[spec.id] || { total: 0, verified: 0, status: 'MISSING' };
      const verification = row.total === 0
        ? 'MISSING' : `${row.status} (${row.verified}/${row.total})`;
      lines.push(`| ${spec.id} | ${name} | [\`${spec.file}\`](../${spec.file}) (${bytes}B) | ${spec.criticality} | ${verification} | ${declared} | \`${spec.executor}\` | \`${spec.validator}\` | ${(spec.dependencies || []).join(', ') || '—'} |`);
    }
    lines.push('');
  }

  lines.push(
    '## 机器配置', '',
    '| 文件 | 用途 |', '| --- | --- |',
    '| `.uap/config/specification-registry.yaml` | 32 条规范的 ID / 路径 / 执行器 / 验证器 / 依赖 |',
    '| `.uap/config/execution-mapping.yaml` | 执行器 ID → 真实 ESM 模块路径 + 执行契约 |',
    '| `.uap/config/agent-registry.yaml` | 11 个 Agent 的身份、权限、工具、实现路径 |',
    '| `.uap/config/permission-policy.yaml` | fail-closed 权限组与审计开关 |',
    '| `.uap/config/workflow-registry.yaml` | 7 个工作流、步骤与验收条件 |',
    '| `.uap/config/validator-registry.yaml` | 32 个验证器、实现路径与检查项 |',
    '',
    '## 注册表完整性检查明细', '',
    '| 检查 ID | 结果 | 说明 |', '| --- | --- | --- |',
  );
  for (const check of integrity.checks) lines.push(`| \`${check.id}\` | ${check.status} | ${check.detail.replace(/\|/g, '\\|')} |`);
  lines.push(
    '',
    '> 本索引由机器遍历真实文件生成，状态列来自 `runtime.status-engine`，与 `FINAL-STATUS.json` / `uap status` 共用同一计算函数。',
    '> 文件存在只证明「规范已建成」，不证明「UAP 已运行」或「Uter 已合规」；三者的独立证据见 `.uap/reports/`。',
    '',
  );

  const target = path.join(UAP, 'SPECIFICATION-INDEX.md');
  fs.writeFileSync(target, lines.join('\n'), 'utf8');
  return { file: target, specs: specs.length, domains: domains.length, registry_ok: integrity.ok, verdict, specVer };
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const r = generateIndex();
  console.log(`SPECIFICATION-INDEX.md generated: ${r.specs} specs, ${r.domains} domains, registry=${r.registry_ok ? 'PASS' : 'FAIL'}, overall=${r.verdict.overall_status}, verified_specs=${r.specVer.verified_specs}/${r.specVer.total_specs}`);
}
