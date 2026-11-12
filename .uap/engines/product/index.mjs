/**
 * UAP engine: product
 * Executors: product.requirements / product.prototype_sync / product.business_rules
 *
 * Everything below reads REAL repository files. No requirement is invented:
 * when a feature has no PRD document we record `prd_ref: null` and emit a gap.
 */
import fs from 'node:fs';
import path from 'node:path';
import { STATE, rootPath, relToRoot } from '../../runtime/_lib/paths.mjs';
import { readText, exists, listFiles, readJSON, writeJSON, nowISO, hash } from '../../runtime/_lib/util.mjs';

export const component = 'engines.product';
export const version = '1.0.0';
export const executors = ['product.requirements', 'product.prototype_sync', 'product.business_rules'];

const FEATURE_REGISTRY = path.join(STATE, 'feature-registry.json');
const BUSINESS_RULES = path.join(STATE, 'business-rules.json');
const PRD_MAPPING = path.join(STATE, 'prd-prototype-mapping.json');

const ROUTER_FILE = 'router/api-router.go';
const FEATURE_DIR = 'web/src/features';
const CONTROLLER_DIR = 'controller';
const REGISTRY_FILE = 'docs/product/registry/feature-registry.yaml';
const MODEL_FILE = 'docs/product/registry/product-model.json';

const HTTP_METHODS = 'GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD|Any|Handle';

function normalise(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function tokens(value) {
  return String(value || '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
}

function featureId(slug) {
  return `FEAT-${String(slug).toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`;
}

function ruleId(category, file, symbol, line) {
  return `BR-${category}-${hash(`${file}:${symbol}:${line}`).slice(0, 10)}`;
}

/** Extract real HTTP route registrations from router/api-router.go. */
function scanRouterRoutes() {
  const abs = rootPath(ROUTER_FILE);
  if (!exists(abs)) return [];
  const text = readText(abs);
  const out = [];
  const re = new RegExp(`\\.(${HTTP_METHODS})\\(\\s*"([^"]+)"`, 'g');
  text.split('\n').forEach((line, i) => {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(line)) !== null) {
      const handlerMatch = line.match(/controller\.(\w+)/);
      out.push({
        method: m[1],
        path: m[2],
        handler: handlerMatch ? handlerMatch[1] : null,
        line: i + 1,
      });
    }
  });
  return out;
}

/** Real non-test controller source files (basenames without extension). */
function scanControllerFiles() {
  return listFiles(rootPath(CONTROLLER_DIR), {
    recursive: false,
    filter: (abs) => abs.endsWith('.go') && !abs.endsWith('_test.go'),
  }).map((abs) => path.basename(abs, '.go'));
}

/** Real frontend feature module directories. */
function scanFeatureDirs() {
  const abs = rootPath(FEATURE_DIR);
  if (!exists(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

/**
 * Parse the real generated feature registry. It is a plain YAML subset with
 * one `  -` entry per feature, so line parsing is deterministic and avoids
 * depending on deeper structure.
 */
function parseFeatureRegistry() {
  const abs = rootPath(REGISTRY_FILE);
  if (!exists(abs)) return [];
  const entries = [];
  let cur = null;
  for (const line of readText(abs).split('\n')) {
    if (/^ {2}-\s*$/.test(line)) {
      cur = {};
      entries.push(cur);
      continue;
    }
    if (!cur) continue;
    const m = line.match(/^\s+([\w_]+):\s*(.*)$/);
    if (m) cur[m[1]] = m[2].trim();
  }
  return entries;
}

function acceptanceIds(raw) {
  if (!raw) return [];
  return (raw.match(/AC-[A-Z0-9-]+/g) || []);
}

/** Associate a feature slug with registry entries by overlapping tokens. */
function matchRegistry(slug, entries) {
  const t = tokens(slug);
  const n = normalise(slug);
  const matched = entries.filter((e) => {
    const mod = normalise(e.module);
    if (!mod) return false;
    if (mod === n || mod.includes(n) || n.includes(mod)) return true;
    return t.some((tok) => mod.includes(tok) || tok.includes(mod));
  });
  return matched;
}

/** Build the real Feature list from three code sources. */
function buildFeatures() {
  const routes = scanRouterRoutes();
  const controllers = scanControllerFiles();
  const dirs = scanFeatureDirs();
  const registry = parseFeatureRegistry();
  const gaps = [];

  const features = dirs.map((slug) => {
    const t = tokens(slug);
    const n = normalise(slug);
    const relatedRoutes = routes.filter((r) => {
      const p = normalise(r.path);
      return t.some((tok) => p.includes(tok));
    }).map((r) => `${r.method} ${r.path}`);
    const relatedControllers = controllers.filter((c) => {
      const cn = normalise(c);
      return t.some((tok) => cn.includes(tok)) || (n.length >= 4 && cn.includes(n));
    });

    const regMatches = matchRegistry(slug, registry);
    const acIds = [...new Set(regMatches.flatMap((e) => acceptanceIds(e.acceptance_ids)))];
    const prdPaths = [...new Set(regMatches.map((e) => e.prd_path).filter(Boolean))];
    const existingPrd = prdPaths.find((p) => exists(rootPath(p))) || null;

    const acceptanceLocatable = acIds.length > 0;
    const prdRef = existingPrd;
    if (!prdRef) {
      gaps.push({
        type: 'missing_prd_ref',
        feature_id: featureId(slug),
        slug,
        detail: 'no feature-registry entry with an existing prd_path maps to this code feature',
      });
    }

    return {
      id: featureId(slug),
      slug,
      source_files: [
        `${FEATURE_DIR}/${slug}`,
        ...(relatedControllers.length ? [CONTROLLER_DIR] : []),
        ROUTER_FILE,
      ],
      frontend_path: `${FEATURE_DIR}/${slug}`,
      related_routes: relatedRoutes.slice(0, 25),
      related_route_count: relatedRoutes.length,
      related_controllers: relatedControllers.slice(0, 25),
      acceptance_locatable: acceptanceLocatable,
      acceptance_refs: acIds.slice(0, 25),
      registry_feature_ids: [...new Set(regMatches.map((e) => e.feature_id).filter(Boolean))].slice(0, 25),
      prd_ref: prdRef,
      code_evidence_count: relatedRoutes.length + relatedControllers.length + 1,
    };
  });

  return { features, gaps, routes_scanned: routes.length, controllers_scanned: controllers.length };
}

/** Extract business rules from real billing / payment / model source files. */
function scanBusinessRules() {
  const rules = [];
  const push = (category, rel, symbol, line, simulated) => {
    rules.push({
      id: ruleId(category, rel, symbol, line),
      source: rel,
      symbol,
      line,
      category,
      simulated_only: simulated,
    });
  };

  // 1. Centralised quota conversion helpers (authoritative billing invariants).
  const quotaAbs = rootPath('common/quota_math.go');
  if (exists(quotaAbs)) {
    const rel = 'common/quota_math.go';
    readText(quotaAbs).split('\n').forEach((line, i) => {
      const m = line.match(/^func\s+((?:Quota|Wallet)\w+)\s*\(/);
      if (m) push('QUOTA', rel, m[1], i + 1, true);
    });
  }

  // 2. Model-layer state / amount / status rules.
  const modelFiles = listFiles(rootPath('model'), {
    recursive: false,
    filter: (abs) => abs.endsWith('.go') && !abs.endsWith('_test.go')
      && /(topup|quota|billing|wallet|order|payment|subscription)/i.test(path.basename(abs)),
  });
  for (const abs of modelFiles) {
    const rel = relToRoot(abs);
    const lines = readText(abs).split('\n');
    let hits = 0;
    lines.forEach((line, i) => {
      if (hits >= 6) return;
      const m = line.match(/^func\s+(\w+)\s*\(|^\s*([A-Z][A-Z0-9_]{3,})\s*(?:=|:=)/);
      if (m && /(topup|quota|amount|status|state|order|payment|trade)/i.test(line)) {
        push('MODEL', rel, (m[1] || m[2]).trim(), i + 1, true);
        hits += 1;
      }
    });
  }

  // 3. Payment-related controllers and their money/verification anchors.
  const payFiles = listFiles(rootPath(CONTROLLER_DIR), {
    recursive: false,
    filter: (abs) => abs.endsWith('.go') && !abs.endsWith('_test.go')
      && /(topup|payment|billing|recharge|wallet|subscription_payment|pay_)/i.test(path.basename(abs)),
  });
  for (const abs of payFiles) {
    const rel = relToRoot(abs);
    const lines = readText(abs).split('\n');
    let hits = 0;
    lines.forEach((line, i) => {
      if (hits >= 6) return;
      const funcMatch = line.match(/^func\s+(?:\([^)]*\)\s*)?(\w+)\s*\(/);
      const anchor = /(TRADE_NOT_EXIST|alipay|Verify|Notify|Amount|Quota|Round|refund)/i.test(line);
      if (funcMatch && anchor) {
        push('PAYMENT', rel, funcMatch[1], i + 1, true);
        hits += 1;
      } else if (anchor && /(TRADE_NOT_EXIST|toPayAmount|WalletQuotaFromDecimalStrict)/.test(line)) {
        push('PAYMENT', rel, (line.trim().match(/(TRADE_NOT_EXIST|toPayAmount|WalletQuotaFromDecimalStrict)/) || [])[1] || 'anchor', i + 1, true);
        hits += 1;
      }
    });
  }

  return rules;
}

/** Build the PRD <-> prototype mapping keyed by stable IDs, not filenames. */
function scanPrdPrototype() {
  const collect = (dir, ext) => listFiles(rootPath(dir), {
    recursive: true,
    filter: (abs) => abs.endsWith(ext),
  });

  const prdFiles = collect('docs/product/prd', '.md');
  const protoMd = collect('docs/product/prototypes', '.md');
  const protoHtml = collect('docs/product/prototypes', '.html');

  const keyOf = (abs) => path.basename(abs)
    .replace(/^UTER-/, '')
    .replace(/\.(md|html)$/i, '');

  const prdByKey = new Map();
  for (const abs of prdFiles) prdByKey.set(keyOf(abs), abs);
  const protoMdByKey = new Map();
  for (const abs of protoMd) protoMdByKey.set(keyOf(abs), abs);
  const protoHtmlByKey = new Map();
  for (const abs of protoHtml) protoHtmlByKey.set(keyOf(abs), abs);

  const keys = [...new Set([...prdByKey.keys(), ...protoMdByKey.keys(), ...protoHtmlByKey.keys()])].sort();
  const mappings = [];
  const gaps = [];

  for (const key of keys) {
    const prdAbs = prdByKey.get(key) || null;
    const protoAbs = protoMdByKey.get(key) || null;
    const htmlAbs = protoHtmlByKey.get(key) || null;
    let syncStatus = 'UNKNOWN';
    let declaredProtoId = null;
    let declaredFeatureId = null;
    if (prdAbs) {
      const text = readText(prdAbs);
      const sync = text.match(/同步状态\s*\|\s*`?([A-Z_]+)`?/);
      const proto = text.match(/原型 ID\s*\|\s*`?(PROTO-[A-Z0-9-]+)`?/);
      const fid = text.match(/Feature ID\s*\|\s*`?(UTER-[A-Z0-9-]+)`?/);
      if (sync) syncStatus = sync[1];
      if (proto) declaredProtoId = proto[1];
      if (fid) declaredFeatureId = fid[1];
    }
    const prdRef = prdAbs ? relToRoot(prdAbs) : null;
    if (!prdRef) {
      gaps.push({ type: 'prototype_without_prd', pair_id: `MAP-${key}`, detail: `no PRD document for stable id UTER-${key}` });
    }
    if (prdAbs && !protoAbs) {
      gaps.push({ type: 'prd_without_prototype_md', pair_id: `MAP-${key}`, detail: `PRD ${key} has no prototype markdown projection` });
    }

    mappings.push({
      pair_id: `MAP-${key}`,
      feature_id: declaredFeatureId || `UTER-${key}`,
      prd: {
        id: `PRD-${key}`,
        path: prdRef,
        exists: Boolean(prdAbs),
      },
      prototype: {
        id: declaredProtoId || `PROTO-${key}`,
        md_path: protoAbs ? relToRoot(protoAbs) : null,
        html_path: htmlAbs ? relToRoot(htmlAbs) : null,
        md_exists: Boolean(protoAbs),
        html_exists: Boolean(htmlAbs),
      },
      prd_ref: prdRef,
      sync_status: syncStatus,
      sources: [prdRef, protoAbs ? relToRoot(protoAbs) : null, htmlAbs ? relToRoot(htmlAbs) : null].filter(Boolean),
    });
  }

  return { mappings, gaps, prd_count: prdFiles.length, prototype_md_count: protoMd.length, prototype_html_count: protoHtml.length };
}

function artifactsSchemaOk() {
  const targets = [
    [FEATURE_REGISTRY, 'features'],
    [BUSINESS_RULES, 'rules'],
    [PRD_MAPPING, 'mappings'],
  ];
  for (const [file, key] of targets) {
    if (!exists(file)) continue; // not produced yet is not a failure
    let parsed;
    try { parsed = readJSON(file); } catch { return false; }
    if (!parsed || !Array.isArray(parsed[key]) || parsed[key].length < 1) return false;
  }
  return true;
}

export function health() {
  const checks = {};
  checks.router_exists = exists(rootPath(ROUTER_FILE));
  checks.controller_dir = listFiles(rootPath(CONTROLLER_DIR), {
    recursive: false, filter: (a) => a.endsWith('.go') && !a.endsWith('_test.go'),
  }).length > 0;
  let featureCount = 0;
  try { featureCount = scanFeatureDirs().length; } catch { featureCount = 0; }
  checks.features_dir = featureCount > 0;
  checks.registry_exists = exists(rootPath(REGISTRY_FILE));
  checks.product_model_exists = exists(rootPath(MODEL_FILE));
  let ruleCount = 0;
  try { ruleCount = scanBusinessRules().length; } catch { ruleCount = 0; }
  checks.business_rules_hit = ruleCount >= 1;
  checks.artifacts_schema = artifactsSchemaOk();
  const ok = Object.values(checks).every(Boolean);
  return {
    component,
    ok,
    checks,
    summary: `router=${checks.router_exists} controllers=${checks.controller_dir} features=${featureCount} `
      + `business_rules_hit=${ruleCount} artifacts_schema=${checks.artifacts_schema}`,
    checked_at: nowISO(),
  };
}

export async function execute(task = {}, ctx = {}) {
  const started = nowISO();
  const changedFiles = [];

  const features = buildFeatures();
  writeJSON(FEATURE_REGISTRY, {
    schema_version: '1.0',
    generated_at: started,
    executor_ids: ['product.requirements'],
    source_of_truth: 'code',
    sources: [ROUTER_FILE, CONTROLLER_DIR, FEATURE_DIR, REGISTRY_FILE],
    routes_scanned: features.routes_scanned,
    controllers_scanned: features.controllers_scanned,
    feature_count: features.features.length,
    features: features.features,
    gaps: features.gaps,
  });
  changedFiles.push(relToRoot(FEATURE_REGISTRY));

  const rules = scanBusinessRules();
  writeJSON(BUSINESS_RULES, {
    schema_version: '1.0',
    generated_at: started,
    executor_ids: ['product.business_rules'],
    note: 'All billing/payment rules are code anchors; funds were NOT moved (simulated_only).',
    simulated_only: true,
    rule_count: rules.length,
    rules,
  });
  changedFiles.push(relToRoot(BUSINESS_RULES));

  const mapping = scanPrdPrototype();
  writeJSON(PRD_MAPPING, {
    schema_version: '1.0',
    generated_at: started,
    executor_ids: ['product.prototype_sync'],
    key_strategy: 'stable UTER-/PRD-/PROTO- ids, never filenames as primary keys',
    prd_count: mapping.prd_count,
    prototype_md_count: mapping.prototype_md_count,
    prototype_html_count: mapping.prototype_html_count,
    mapping_count: mapping.mappings.length,
    mappings: mapping.mappings,
    gaps: mapping.gaps,
  });
  changedFiles.push(relToRoot(PRD_MAPPING));

  const gaps = [...features.gaps, ...mapping.gaps];
  return {
    status: features.features.length > 0 && rules.length > 0 ? 'SUCCEEDED' : 'BLOCKED',
    summary: `scanned real code: ${features.routes_scanned} routes, ${features.controllers_scanned} controllers, `
      + `${features.features.length} features, ${rules.length} business rules, ${mapping.mappings.length} PRD/prototype pairs; `
      + `${gaps.length} gaps (missing prd_ref recorded as null, not invented)`,
    changed_files: changedFiles,
    commands: [],
    evidence_refs: [],
    outputs: {
      feature_count: features.features.length,
      acceptance_locatable_count: features.features.filter((f) => f.acceptance_locatable).length,
      business_rule_count: rules.length,
      prd_prototype_mapping_count: mapping.mappings.length,
      prd_ref_null_count: features.features.filter((f) => f.prd_ref === null).length,
      gap_count: gaps.length,
      gaps_sample: gaps.slice(0, 10),
    },
  };
}
