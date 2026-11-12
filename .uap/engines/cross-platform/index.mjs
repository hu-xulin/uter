/**
 * UAP engine: cross-platform
 * Executors: cross_platform.web / cross_platform.h5 / cross_platform.consistency
 * Scans the real viewport meta, design tokens and shared business modules.
 * A missing dedicated H5 directory is recorded as a DIFFERENCE, never a pass.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPORTS, rootPath, relToRoot } from '../../runtime/_lib/paths.mjs';
import { readText, exists, listFiles, readJSON, writeJSON, nowISO } from '../../runtime/_lib/util.mjs';

export const component = 'engines.cross-platform';
export const version = '1.0.0';
export const executors = ['cross_platform.web', 'cross_platform.h5', 'cross_platform.consistency'];

const REPORT_FILE = path.join(REPORTS, 'CROSS-PLATFORM.json');
const BUSINESS_RE = /(pay|payment|order|wallet|subscription|topup|billing|checkout|redemption|pricing|quota)/i;
const H5_CANDIDATES = [
  'web/src/h5', 'web/h5', 'web/src/mobile', 'web/mobile',
  'web/src/features/h5', 'web/src/pages/h5', 'h5', 'mobile',
];

function scanViewport() {
  const f = rootPath('web/index.html');
  if (!exists(f)) return { found: false, file: 'web/index.html' };
  const lines = readText(f).split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/<meta\s+name=["']viewport["']\s+content=["']([^"']+)["']/i);
    if (m) return { found: true, file: 'web/index.html', line: i + 1, content: m[1] };
  }
  return { found: false, file: 'web/index.html', line: null, content: null };
}

function scanDesignTokens() {
  const brand = rootPath('web/src/design-system/tokens/brand-colors.ts');
  const brandExists = exists(brand);
  let brandConstantCount = 0;
  let brandColorLiteralCount = 0;
  if (brandExists) {
    const t = readText(brand);
    brandConstantCount = (t.match(/export const \w+/g) || []).length;
    brandColorLiteralCount = (t.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
  }
  const tokenFiles = listFiles(rootPath('web/src/design-system/tokens'), {
    recursive: true, filter: () => true,
  }).map((f) => relToRoot(f));

  let varTokenUsage = 0;
  let filesUsingTokens = 0;
  let tokenImports = 0;
  const files = listFiles(rootPath('web/src'), {
    recursive: true, filter: (a) => /\.(ts|tsx|css)$/.test(a),
  });
  for (const f of files) {
    const t = readText(f);
    const n = (t.match(/var\(--[A-Za-z0-9-]+/g) || []).length;
    if (n > 0) filesUsingTokens += 1;
    varTokenUsage += n;
    tokenImports += (t.match(/design-system\/tokens|from ['"][^'"]*tokens/g) || []).length;
  }
  return {
    brand_colors_exists: brandExists,
    brand_constant_count: brandConstantCount,
    brand_color_literal_count: brandColorLiteralCount,
    token_file_count: tokenFiles.length,
    token_files: tokenFiles.slice(0, 20),
    var_token_usage_count: varTokenUsage,
    files_using_tokens: filesUsingTokens,
    token_import_count: tokenImports,
  };
}

function featureDirs() {
  const abs = rootPath('web/src/features');
  if (!exists(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name).sort();
}

function scanSharedBusiness() {
  const dirs = featureDirs();
  const matched = dirs.filter((d) => BUSINESS_RE.test(d));
  const sharedLib = listFiles(rootPath('web/src/lib'), {
    recursive: true, filter: (a) => /\.(ts|tsx)$/.test(a) && BUSINESS_RE.test(path.basename(a)),
  }).slice(0, 20).map((f) => relToRoot(f));
  const sharedComponents = listFiles(rootPath('web/src/components'), {
    recursive: true, filter: (a) => /\.(ts|tsx)$/.test(a) && BUSINESS_RE.test(path.basename(a)),
  }).slice(0, 20).map((f) => relToRoot(f));
  return {
    feature_count: dirs.length,
    business_feature_dirs: matched,
    shared_lib_files: sharedLib,
    shared_component_files: sharedComponents,
  };
}

function scanH5() {
  const found = [];
  for (const c of H5_CANDIDATES) {
    const abs = rootPath(c);
    try { if (exists(abs) && fs.statSync(abs).isDirectory()) found.push(c); } catch { /* not a dir */ }
  }
  return {
    candidates_checked: H5_CANDIDATES,
    found,
    dedicated_h5_directory: found.length > 0,
    status: found.length > 0 ? 'FOUND' : 'DIFFERENCE',
    note: found.length > 0 ? null : 'No dedicated H5/mobile directory exists; recorded as a difference, NOT a pass.',
  };
}

function buildFeatureMapping(h5) {
  return featureDirs().map((d) => {
    const files = listFiles(rootPath('web/src/features', d), {
      recursive: true, filter: (a) => /\.(ts|tsx|css)$/.test(a),
    });
    let tokenUse = 0;
    for (const f of files) tokenUse += (readText(f).match(/var\(--/g) || []).length;
    return {
      feature_id: `XP-${d.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`,
      slug: d,
      web: { path: `web/src/features/${d}`, file_count: files.length, present: files.length > 0 },
      h5: {
        present: h5.dedicated_h5_directory,
        path: null,
        note: h5.dedicated_h5_directory ? null : 'no dedicated H5 mapping available',
      },
      shared_business: BUSINESS_RE.test(d),
      design_token_usage: tokenUse,
    };
  });
}

function consistencyChecks() {
  const agents = exists(rootPath('AGENTS.md')) ? readText(rootPath('AGENTS.md')) : '';
  const documented = /input text is 14px on every platform/i.test(agents) || /no H5 16px exception/i.test(agents);
  const files = listFiles(rootPath('web/src'), {
    recursive: true, filter: (a) => /\.(css|tsx|ts)$/.test(a),
  });
  let occurrences = 0;
  const sample = [];
  for (const f of files) {
    readText(f).split('\n').forEach((l, i) => {
      if (occurrences < 20 && /16px/.test(l) && /input|font-size/i.test(l)) {
        occurrences += 1;
        sample.push({ file: relToRoot(f), line: i + 1, snippet: l.trim().slice(0, 120) });
      }
    });
  }
  return [
    {
      rule: 'shared_type_scale_no_h5_16px_exception',
      documented_in: 'AGENTS.md', documented,
      heuristic: true,
    },
    {
      rule: 'no_h5_16px_input_exception_in_code',
      occurrences, sample, heuristic: true,
      note: 'text heuristic only; not a quality gate',
    },
  ];
}

function artifactOk(file) {
  if (!exists(file)) return true;
  let j;
  try { j = readJSON(file); } catch { return false; }
  if (!j || !Array.isArray(j.feature_mapping) || !j.viewport || !j.platforms) return false;
  if (!j.policy || j.policy.h5_absence_is_gap_not_pass !== true) return false;
  return true;
}

export function health() {
  const checks = {};
  let vp = null;
  try { vp = scanViewport(); } catch { vp = null; }
  checks.index_html_exists = exists(rootPath('web/index.html'));
  checks.viewport_meta_hit = Boolean(vp && vp.found);
  checks.brand_tokens_exists = exists(rootPath('web/src/design-system/tokens/brand-colors.ts'));
  checks.features_dir_exists = exists(rootPath('web/src/features'));
  checks.tokens_dir_exists = exists(rootPath('web/src/design-system/tokens'));
  let tok = null;
  try { tok = scanDesignTokens(); } catch { tok = null; }
  checks.design_token_hit = Boolean(tok && (tok.var_token_usage_count >= 1 || tok.brand_constant_count >= 1));
  checks.report_schema = artifactOk(REPORT_FILE);
  const ok = Object.values(checks).every(Boolean);
  return {
    component, ok, checks,
    summary: `viewport=${checks.viewport_meta_hit} brand_tokens=${checks.brand_tokens_exists} `
      + `token_usage=${tok ? tok.var_token_usage_count : 0} features=${featureDirs().length} report_schema=${checks.report_schema}`,
    checked_at: nowISO(),
  };
}

export async function execute(task = {}, ctx = {}) {
  const started = nowISO();
  const viewport = scanViewport();
  const tokens = scanDesignTokens();
  const shared = scanSharedBusiness();
  const h5 = scanH5();
  const mapping = buildFeatureMapping(h5);
  const checks = consistencyChecks();

  const gaps = [];
  if (!h5.dedicated_h5_directory) {
    gaps.push({
      type: 'missing_h5_directory', severity: 'DIFFERENCE',
      detail: `no dedicated H5/mobile directory found among: ${H5_CANDIDATES.join(', ')}`,
      recorded_as: 'difference_not_pass',
    });
  }
  for (const m of mapping) {
    if (!m.h5.present) {
      gaps.push({ type: 'feature_not_mapped_to_h5', feature_id: m.feature_id, recorded_as: 'difference_not_pass' });
    }
  }
  if (!viewport.found) {
    gaps.push({ type: 'viewport_meta_missing', severity: 'DIFFERENCE', recorded_as: 'difference_not_pass' });
  }

  writeJSON(REPORT_FILE, {
    schema_version: '1.0', generated_at: started,
    executor_ids: executors,
    viewport,
    design_tokens: tokens,
    shared_business_modules: shared,
    platforms: {
      web: { present: true, source: 'web/', viewport, feature_count: mapping.length },
      h5,
    },
    feature_mapping: mapping,
    gaps,
    consistency_checks: checks,
    policy: {
      h5_absence_is_gap_not_pass: true,
      no_platform_marked_pass_without_evidence: true,
    },
  });

  return {
    status: 'SUCCEEDED',
    summary: `viewport_meta=${viewport.found}; design tokens usage=${tokens.var_token_usage_count} across ${tokens.files_using_tokens} files; `
      + `${shared.business_feature_dirs.length} shared business features; dedicated H5 dir=${h5.dedicated_h5_directory} `
      + `(recorded as DIFFERENCE, not pass); ${gaps.length} gaps`,
    changed_files: [relToRoot(REPORT_FILE)],
    commands: [],
    evidence_refs: [],
    outputs: {
      viewport_found: viewport.found,
      viewport_content: viewport.content || null,
      design_token_usage: tokens.var_token_usage_count,
      files_using_tokens: tokens.files_using_tokens,
      brand_constant_count: tokens.brand_constant_count,
      feature_count: mapping.length,
      shared_business_feature_count: shared.business_feature_dirs.length,
      dedicated_h5_directory_found: h5.dedicated_h5_directory,
      h5_status: h5.status,
      gap_count: gaps.length,
      consistency_check_count: checks.length,
      h5_16px_heuristic_occurrences: checks[1].occurrences,
    },
  };
}
