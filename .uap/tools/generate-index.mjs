import fs from 'node:fs';
import path from 'node:path';
import { ROOT, UAP } from '../runtime/_lib/paths.mjs';
import { loadAllConfigs, registryIntegrity, REQUIRED_SPEC_SECTIONS } from '../runtime/_lib/config.mjs';
import { nowISO } from '../runtime/_lib/util.mjs';

const configs = loadAllConfigs();
const specs = configs['specification-registry'].specifications || [];
const integrity = registryIntegrity(configs);
const domains = [...new Set(specs.map((s) => s.domain))];

const lines = [
  '# UAP 1.0 — 规范索引',
  '',
  `- 生成时间：${nowISO()}（由 \`node .uap/tools/generate-index.mjs\` 依据真实注册表生成）`,
  `- 规范总数：**${specs.length}**`,
  `- 注册表完整性：**${integrity.ok ? 'PASS' : 'FAIL'}**（${integrity.checks.filter((c) => c.status === 'PASS').length}/${integrity.checks.length} 项检查，${integrity.findings.length} 条阻断发现）`,
  `- 规范状态口径：\`ACTIVE\` / \`IMPLEMENTED_NOT_VERIFIED\`；未验证绝不写 \`FULLY_VERIFIED\``,
  '',
  '## 统一章节要求',
  '',
  `每份规范必须包含：${REQUIRED_SPEC_SECTIONS.map((s) => `\`${s}\``).join('、')}，另含「Uter 落地细则」。`,
  '',
  '## 按域索引',
  '',
];

for (const domain of domains) {
  lines.push(`### ${domain}`, '', '| 编号 | 名称 | 文件 | 关键级别 | 状态 | 执行器 | 验证器 | 依赖 |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const spec of specs.filter((s) => s.domain === domain)) {
    const file = path.join(ROOT, spec.file);
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const nameMatch = text.match(/\*\*名称：\*\*\s*(.+)/);
    const statusMatch = text.match(/\*\*状态：\*\*\s*([A-Z_]+)/);
    const name = nameMatch ? nameMatch[1].trim() : spec.id;
    const status = statusMatch ? statusMatch[1] : 'MISSING';
    const bytes = Buffer.byteLength(text);
    lines.push(`| ${spec.id} | ${name} | [\`${spec.file}\`](../${spec.file}) (${bytes}B) | ${spec.criticality} | ${status} | \`${spec.executor}\` | \`${spec.validator}\` | ${(spec.dependencies || []).join(', ') || '—'} |`);
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
lines.push('', '> 本索引由机器遍历真实文件生成。文件存在只证明「规范已建成」，不证明「UAP 已运行」或「Uter 已合规」；三者的独立证据见 `.uap/reports/`。', '');

fs.writeFileSync(path.join(UAP, 'SPECIFICATION-INDEX.md'), lines.join('\n'), 'utf8');
console.log(`SPECIFICATION-INDEX.md generated: ${specs.length} specs, ${domains.length} domains, registry=${integrity.ok ? 'PASS' : 'FAIL'}`);
