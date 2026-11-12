/**
 * UAP engine: architecture
 * Executors: architecture.analyzer / architecture.api_database / architecture.adr
 * Builds a real module dependency graph from Go import blocks, extracts the
 * real API inventory, and indexes ADR / decision documents under docs/ and .uap/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { STATE, rootPath, uapPath, relToRoot } from '../../runtime/_lib/paths.mjs';
import { readText, exists, listFiles, readJSON, writeJSON, nowISO, hash } from '../../runtime/_lib/util.mjs';

export const component = 'engines.architecture';
export const version = '1.0.0';
export const executors = ['architecture.analyzer', 'architecture.api_database', 'architecture.adr'];

const GRAPH_FILE = path.join(STATE, 'architecture-graph.json');
const ADR_FILE = path.join(STATE, 'adr-inventory.json');

const MODULE_PREFIX = 'github.com/uter-ai/uter/';
const HTTP_METHODS = 'GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD|Any|Handle';
const SCAN_DIRS = ['', 'router', 'middleware', 'controller', 'service', 'model', 'relay', 'common'];
const MAX_PER_DIR = 8;
const LAYERS = {
  common: 0, constant: 0, i18n: 0, logger: 0,
  setting: 1, model: 1, oauth: 1, pkg: 1, relaykit: 1,
  middleware: 2, relay: 2, service: 2,
  controller: 3, web: 3,
  router: 4,
  root: 5,
};

function moduleOf(rel) {
  const parts = rel.split('/');
  return parts.length > 1 ? parts[0] : 'root';
}

/** Extract quoted import paths from Go import blocks and single-line imports. */
function extractImports(text) {
  const imports = [];
  const blockRe = /import\s*\(([\s\S]*?)\)/g;
  let m;
  while ((m = blockRe.exec(text)) !== null) {
    for (const line of m[1].split('\n')) {
      const s = line.match(/"([^"]+)"/);
      if (s) imports.push(s[1]);
    }
  }
  const singleRe = /^\s*import\s+"([^"]+)"/gm;
  while ((m = singleRe.exec(text)) !== null) imports.push(m[1]);
  return imports;
}

function collectGoFiles() {
  const out = [];
  for (const dir of SCAN_DIRS) {
    const absDir = dir ? rootPath(dir) : rootPath('.');
    const picked = listFiles(absDir, {
      recursive: false,
      filter: (a) => a.endsWith('.go') && !a.endsWith('_test.go'),
    }).slice(0, MAX_PER_DIR);
    out.push(...picked);
  }
  return [...new Set(out)];
}

function scanRouterApis() {
  const abs = rootPath('router/api-router.go');
  if (!exists(abs)) return [];
  const out = [];
  const re = new RegExp(`\\.(${HTTP_METHODS})\\(\\s*"([^"]+)"`, 'g');
  readText(abs).split('\n').forEach((line, i) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
      const h = line.match(/controller\.(\w+)/);
      out.push({ method: m[1], path: m[2], handler: h ? h[1] : null, line: i + 1 });
    }
  });
  return out;
}

function detectCycles(adj) {
  const state = new Map();
  const stack = [];
  const cycles = [];
  const visit = (node) => {
    if (state.get(node) === 'done') return;
    if (state.get(node) === 'visiting') {
      const at = stack.indexOf(node);
      cycles.push([...stack.slice(at), node].join(' -> '));
      return;
    }
    state.set(node, 'visiting');
    stack.push(node);
    for (const nxt of adj.get(node) || []) visit(nxt);
    stack.pop();
    state.set(node, 'done');
  };
  for (const node of adj.keys()) visit(node);
  return cycles;
}

function scanGraph() {
  const files = collectGoFiles();
  const nodes = new Map();
  const edgeMap = new Map();
  const external = new Set();
  const scanned = [];

  for (const abs of files) {
    const rel = relToRoot(abs);
    scanned.push(rel);
    const from = moduleOf(rel);
    if (!nodes.has(from)) nodes.set(from, { name: from, layer: LAYERS[from] ?? null, file_count: 0, files: [] });
    const node = nodes.get(from);
    node.file_count += 1;
    node.files.push(rel);

    for (const imp of extractImports(readText(abs))) {
      if (imp.startsWith(MODULE_PREFIX)) {
        const to = imp.slice(MODULE_PREFIX.length).split('/')[0];
        if (!to || to === from) continue;
        const key = `${from}->${to}`;
        if (!edgeMap.has(key)) edgeMap.set(key, { from, to, count: 0, sample_files: [] });
        const e = edgeMap.get(key);
        e.count += 1;
        if (e.sample_files.length < 5 && !e.sample_files.includes(rel)) e.sample_files.push(rel);
      } else {
        external.add(imp);
      }
    }
  }

  const edges = [...edgeMap.values()].sort((a, b) => `${a.from}${a.to}`.localeCompare(`${b.from}${b.to}`));
  const adj = new Map();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from).push(e.to);
  }
  const cycles = detectCycles(adj);
  const layerViolations = edges.filter((e) => {
    const lf = LAYERS[e.from];
    const lt = LAYERS[e.to];
    return lf !== undefined && lt !== undefined && lf <= lt;
  }).map((e) => ({
    from: e.from, to: e.to, from_layer: LAYERS[e.from], to_layer: LAYERS[e.to],
    note: 'lower/equal layer importing upper layer (heuristic coupling smell)',
  }));

  const apis = scanRouterApis();
  const goModAbs = rootPath('go.mod');
  const goModText = exists(goModAbs) ? readText(goModAbs) : '';
  const dbDrivers = [...new Set((goModText.match(/(?:gorm\.io\/[^\s]+|glebarez\/[^\s]+|go-sql-driver\/[^\s]+|lib\/pq|ClickHouse\/[^\s]+|mattn\/[^\s]+)/g) || []))];
  const modelFiles = listFiles(rootPath('model'), {
    recursive: false, filter: (a) => a.endsWith('.go') && !a.endsWith('_test.go'),
  });

  return {
    modules: [...nodes.values()].map((n) => ({ ...n, files: n.files.slice(0, MAX_PER_DIR) })),
    edges,
    cycle_count: cycles.length,
    cycles,
    cross_module_edge_count: edges.length,
    layer_violations: layerViolations,
    external_import_count: external.size,
    external_imports_sample: [...external].slice(0, 20),
    api_inventory: apis,
    api_count: apis.length,
    database_anchors: {
      go_mod_drivers: dbDrivers,
      model_file_count: modelFiles.length,
      model_sample: modelFiles.slice(0, 10).map((a) => relToRoot(a)),
    },
    scanned_files: scanned,
    scanned_file_count: scanned.length,
  };
}

function parseFrontmatter(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^\s*([\w-]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return fm;
}

function extractDocSources(text) {
  const refs = text.match(/(?:docs|web|\.uap|scripts)\/[A-Za-z0-9_./-]+|(?:AGENTS|CLAUDE)\.md/g) || [];
  return [...new Set(refs)].slice(0, 12);
}

function scopeOf(rel) {
  if (rel.startsWith('docs/adr/')) return 'adr';
  if (rel.startsWith('.uap/config')) return 'uap-config';
  if (rel.startsWith('.uap/')) return 'uap-doc';
  if (rel.startsWith('docs/design-system')) return 'design-system';
  if (rel.startsWith('docs/')) return 'docs';
  return 'other';
}

function scanAdr() {
  const files = [
    ...listFiles(rootPath('docs'), { recursive: true, filter: (a) => a.endsWith('.md') }),
    ...listFiles(uapPath(), { recursive: true, filter: (a) => a.endsWith('.md') }),
  ];
  const documents = [];
  for (const abs of files) {
    const rel = relToRoot(abs);
    const text = readText(abs);
    const fm = parseFrontmatter(text);
    const titleMatch = text.match(/^#\s+(.+)$/m);
    const formal = Boolean((fm && /^ADR-/i.test(fm.id || '')) || rel.startsWith('docs/adr/'));
    let mtime = null;
    try { mtime = fs.statSync(abs).mtime.toISOString(); } catch { mtime = null; }
    documents.push({
      id: (fm && fm.id) || `ADR-CANDIDATE-${hash(rel).slice(0, 8)}`,
      path: rel,
      scope: scopeOf(rel),
      formal_adr: formal,
      title: (fm && fm.title) || (titleMatch ? titleMatch[1].trim() : null),
      status: (fm && fm.status) || null,
      date: (fm && fm.date) || null,
      has_frontmatter: Boolean(fm),
      sources: extractDocSources(text),
      updated_at: mtime,
      hash: hash(text),
      size: text.length,
    });
  }
  return {
    document_count: documents.length,
    formal_adr_count: documents.filter((d) => d.formal_adr).length,
    candidate_count: documents.filter((d) => !d.formal_adr).length,
    source_roots: ['docs', '.uap'],
    documents,
  };
}

function artifactOk(file, keys) {
  if (!exists(file)) return true;
  let j;
  try { j = readJSON(file); } catch { return false; }
  if (!j || typeof j !== 'object') return false;
  if (!Array.isArray(j[keys[0]]) || j[keys[0]].length < 1) return false;
  for (const k of keys.slice(1)) if (j[k] === undefined || j[k] === null) return false;
  return true;
}

export function health() {
  const checks = {};
  checks.api_router_exists = exists(rootPath('router/api-router.go'));
  let graph = null;
  try { graph = scanGraph(); } catch { graph = null; }
  checks.go_files_scanned = Boolean(graph && graph.scanned_file_count >= 1);
  checks.internal_edges_hit = Boolean(graph && graph.edges.length >= 1);
  checks.api_inventory_hit = Boolean(graph && graph.api_count >= 1);
  checks.docs_md_present = listFiles(rootPath('docs'), {
    recursive: true, filter: (a) => a.endsWith('.md'),
  }).length >= 1;
  checks.graph_schema = artifactOk(GRAPH_FILE, ['modules', 'edges', 'api_inventory']);
  checks.adr_schema = artifactOk(ADR_FILE, ['documents', 'document_count']);
  const ok = Object.values(checks).every(Boolean);
  return {
    component, ok, checks,
    summary: `go_files=${graph ? graph.scanned_file_count : 0} edges=${graph ? graph.edges.length : 0} `
      + `cycles=${graph ? graph.cycle_count : 0} apis=${graph ? graph.api_count : 0} docs_md=${checks.docs_md_present}`,
    checked_at: nowISO(),
  };
}

export async function execute(task = {}, ctx = {}) {
  const started = nowISO();
  const graph = scanGraph();
  writeJSON(GRAPH_FILE, {
    schema_version: '1.0',
    generated_at: started,
    executor_ids: ['architecture.analyzer', 'architecture.api_database'],
    graph_source: 'real Go import blocks',
    ...graph,
  });

  const adr = scanAdr();
  writeJSON(ADR_FILE, {
    schema_version: '1.0',
    generated_at: started,
    executor_ids: ['architecture.adr'],
    ...adr,
  });

  return {
    status: graph.scanned_file_count > 0 && graph.api_count > 0 ? 'SUCCEEDED' : 'BLOCKED',
    summary: `parsed ${graph.scanned_file_count} real Go files into ${graph.modules.length} modules / ${graph.edges.length} dependency edges; `
      + `detected ${graph.cycle_count} cycles and ${graph.layer_violations.length} layer-violation couplings; `
      + `extracted ${graph.api_count} APIs; indexed ${adr.document_count} ADR/decision docs (${adr.formal_adr_count} formal)`,
    changed_files: [relToRoot(GRAPH_FILE), relToRoot(ADR_FILE)],
    commands: [],
    evidence_refs: [],
    outputs: {
      module_count: graph.modules.length,
      edge_count: graph.edges.length,
      cycle_count: graph.cycle_count,
      cycles: graph.cycles,
      layer_violation_count: graph.layer_violations.length,
      external_import_count: graph.external_import_count,
      api_count: graph.api_count,
      db_driver_count: graph.database_anchors.go_mod_drivers.length,
      model_file_count: graph.database_anchors.model_file_count,
      adr_document_count: adr.document_count,
      formal_adr_count: adr.formal_adr_count,
      scanned_file_count: graph.scanned_file_count,
    },
  };
}
