/**
 * UAP engine: knowledge
 * Executors: evolution.knowledge / evolution.continuous
 * Indexes real markdown knowledge documents (sources/scope/updated_at/hash) and
 * detects RUNTIME dependencies on retired AES/UAES governance. Spec prose that
 * merely says "retired" is NOT a dependency; only command/import/path refs count.
 */
import fs from 'node:fs';
import path from 'node:path';
import { STATE, rootPath, uapPath, relToRoot } from '../../runtime/_lib/paths.mjs';
import { readText, exists, listFiles, readJSON, writeJSON, nowISO, hash } from '../../runtime/_lib/util.mjs';

export const component = 'engines.knowledge';
export const version = '1.0.0';
export const executors = ['evolution.knowledge', 'evolution.continuous'];

const INDEX_FILE = path.join(STATE, 'knowledge-index.json');
const EXTRA_DOCS = ['AGENTS.md', 'CLAUDE.md', 'docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md', 'docs/design-system/TOKEN-MANIFEST.json', 'docs/design-system/UDS-8.0.0-MIGRATION-REPORT.md', 'docs/design-system/SHOWCASE-8.0.0.html'];
const RETIRED = ['AES', 'UAES', 'docs/ai-specs', 'uaes/standards'];
const RETIRE_WORDS = /(退役|退休|已删除|不再|废除|废止|废弃|retired|deprecated|no longer|removed|pending replacement|承接|historical|历史|must not|do not|禁止|不得|说明)/i;
const RUNTIME_REF = /(?:import\s|require\(|from\s+['"]|run:\s|cd\s|cat\s|source\s|bash\s|sh\s|path\.join|os\.\w+|exec\(|spawn\(|include\s|\.mjs['"]|\.go['"]|=>\s*['"])/;

function extractSources(text) {
  const refs = text.match(/(?:docs|web|\.uap|scripts|relaykit|tokenkit)\/[A-Za-z0-9_./-]+|(?:AGENTS|CLAUDE)\.md/g) || [];
  return [...new Set(refs)].slice(0, 15);
}

function scopeOf(rel) {
  if (rel === 'AGENTS.md' || rel === 'CLAUDE.md') return 'governance';
  if (rel.startsWith('docs/design-system')) return 'design-system';
  if (rel.startsWith('.uap/config')) return 'uap-config';
  if (rel.startsWith('.uap/')) return 'uap-spec';
  return 'documentation';
}

function scanKnowledge() {
  const files = [
    ...listFiles(uapPath(), { recursive: true, filter: (a) => a.endsWith('.md') }),
    ...EXTRA_DOCS.filter((d) => exists(rootPath(d))).map((d) => rootPath(d)),
  ];
  const seen = new Set();
  const documents = [];
  for (const abs of files) {
    const rel = relToRoot(abs);
    if (seen.has(rel)) continue;
    seen.add(rel);
    const text = readText(abs);
    const title = (text.match(/^#\s+(.+)$/m) || [])[1] || null;
    let mtime = null;
    try { mtime = fs.statSync(abs).mtime.toISOString(); } catch { mtime = null; }
    documents.push({
      id: `KN-${hash(rel).slice(0, 10)}`,
      path: rel,
      scope: scopeOf(rel),
      sources: extractSources(text),
      updated_at: mtime,
      hash: hash(text),
      size: text.length,
      title: title ? title.trim().slice(0, 120) : null,
      section_hints: (text.match(/^##\s+(.+)$/gm) || []).slice(0, 8).map((s) => s.replace(/^##\s+/, '').trim()),
    });
  }
  return {
    document_count: documents.length,
    documents,
    sources_scanned: ['.uap/**/*.md', ...EXTRA_DOCS],
  };
}

function scanRetiredDependencies() {
  const files = [
    ...listFiles(uapPath(), { recursive: true, filter: () => true }),
    ...listFiles(rootPath('.'), {
      recursive: false,
      filter: (a) => /\.(mjs|js|sh|go|ts|rb|py|json|yml|yaml)$/.test(a) || /^(?:Makefile|Dockerfile)$/.test(path.basename(a)),
    }),
    ...listFiles(rootPath('scripts'), { recursive: true, filter: () => true }),
    ...listFiles(rootPath('.github/workflows'), { recursive: false, filter: () => true }),
  ];
  const seen = new Set();
  const runtimeDependencies = [];
  const ignoredNoteSamples = [];
  let retirementNotesIgnored = 0;

  for (const abs of files) {
    const rel = relToRoot(abs);
    if (seen.has(rel)) continue;
    seen.add(rel);
    let text;
    try {
      if (fs.statSync(abs).size > 2 * 1024 * 1024) continue;
      text = readText(abs);
    } catch { continue; }
    text.split('\n').forEach((line, i) => {
      const hasRetired = RETIRED.some((k) => line.includes(k)) || /\b(?:AES|UAES)\b/.test(line);
      if (!hasRetired) return;
      // 1. A line explaining the retirement is prose, not a dependency.
      if (RETIRE_WORDS.test(line)) {
        retirementNotesIgnored += 1;
        if (ignoredNoteSamples.length < 10) {
          ignoredNoteSamples.push({ file: rel, line: i + 1, snippet: line.trim().slice(0, 120) });
        }
        return;
      }
      const isMd = /\.(md|mdx)$/i.test(rel);
      const hasRuntimeRef = RUNTIME_REF.test(line);
      const hasPathRef = /(?:docs\/ai-specs|uaes\/standards)\/[A-Za-z0-9_./-]+/.test(line);
      // 2. Narrative mention in spec text, or a bare acronym, is not a dependency.
      if (!hasRuntimeRef && !hasPathRef) return;
      if (isMd && !hasRuntimeRef && !hasPathRef) return;
      runtimeDependencies.push({
        file: rel, line: i + 1,
        snippet: line.trim().slice(0, 160),
        matched: RETIRED.filter((k) => line.includes(k)),
      });
    });
  }

  return {
    scanned_file_count: seen.size,
    runtime_dependency_count: runtimeDependencies.length,
    runtime_dependencies: runtimeDependencies.slice(0, 50),
    retirement_notes_ignored: retirementNotesIgnored,
    ignored_note_samples: ignoredNoteSamples,
    policy: 'spec prose saying "retired" is not a dependency; only command/import/path references count',
  };
}

function artifactOk(file) {
  if (!exists(file)) return true;
  let j;
  try { j = readJSON(file); } catch { return false; }
  if (!j || !Array.isArray(j.documents) || j.documents.length < 1) return false;
  if (!j.retired_runtime_dependency_scan) return false;
  const d = j.documents[0];
  return Boolean(d.hash && d.sources && d.scope && d.updated_at);
}

export function health() {
  const checks = {};
  checks.agents_exists = exists(rootPath('AGENTS.md'));
  checks.claude_exists = exists(rootPath('CLAUDE.md'));
  checks.design_system_exists = exists(rootPath('docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md'))
    && exists(rootPath('docs/design-system/TOKEN-MANIFEST.json'))
    && exists(rootPath('docs/design-system/UDS-7.0-MIGRATION-REPORT.md'));
  checks.uap_md_present = listFiles(uapPath(), {
    recursive: true, filter: (a) => a.endsWith('.md'),
  }).length >= 1;
  let k = null;
  try { k = scanKnowledge(); } catch { k = null; }
  checks.knowledge_docs_indexed = Boolean(k && k.document_count >= 1);
  checks.knowledge_hash_present = Boolean(k && k.documents.some((d) => d.hash && d.hash.length > 0));
  let dep = null;
  try { dep = scanRetiredDependencies(); } catch { dep = null; }
  checks.dependency_scan_ran = Boolean(dep && dep.scanned_file_count >= 1);
  checks.index_schema = artifactOk(INDEX_FILE);
  const ok = Object.values(checks).every(Boolean);
  return {
    component, ok, checks,
    summary: `docs_indexed=${k ? k.document_count : 0} hashes_present=${checks.knowledge_hash_present} `
      + `dep_scan_files=${dep ? dep.scanned_file_count : 0} runtime_deps=${dep ? dep.runtime_dependency_count : 0}`,
    checked_at: nowISO(),
  };
}

export async function execute(task = {}, ctx = {}) {
  const started = nowISO();
  const knowledge = scanKnowledge();
  const dep = scanRetiredDependencies();

  writeJSON(INDEX_FILE, {
    schema_version: '1.0', generated_at: started,
    executor_ids: executors,
    ...knowledge,
    retired_runtime_dependency_scan: dep,
  });

  const sourceTotal = knowledge.documents.reduce((n, d) => n + d.sources.length, 0);
  return {
    status: 'SUCCEEDED',
    summary: `indexed ${knowledge.document_count} real knowledge documents (${sourceTotal} source refs, sha256+mtime per doc); `
      + `retired-governance runtime scan over ${dep.scanned_file_count} files found ${dep.runtime_dependency_count} `
      + `runtime dependencies and ignored ${dep.retirement_notes_ignored} retirement-note lines`,
    changed_files: [relToRoot(INDEX_FILE)],
    commands: [],
    evidence_refs: [],
    outputs: {
      document_count: knowledge.document_count,
      source_reference_total: sourceTotal,
      scopes: [...new Set(knowledge.documents.map((d) => d.scope))],
      retired_runtime_dependency_count: dep.runtime_dependency_count,
      retirement_notes_ignored: dep.retirement_notes_ignored,
      dependency_scan_file_count: dep.scanned_file_count,
      runtime_dependency_sample: dep.runtime_dependencies.slice(0, 5),
    },
  };
}
