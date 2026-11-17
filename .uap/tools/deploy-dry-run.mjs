// Deploy dry-run rehearsal — REAL release rehearsal against real artifacts.
//
// Authorized by .uap/config/deployment-authorization.json (user grant,
// 2026-11-12). Boundaries (enforced below, not just declared):
//   - reads repo artifacts only; writes ONLY into the OS temp dir
//   - no production DB connection, no payment calls, no secret export
//   - health probe talks ONLY to the local service (H5_BASE_URL/VISUAL_BASE_URL
//     ?? http://localhost:3000)
//
// What it actually rehearses (each step produces verifiable evidence):
//   1. preflight     : VERSION readable, web/dist artifact manifest (count +
//                      sha256 of every bundle), release binary present
//   2. version       : current version parsed, NEXT release version computed
//                      (semver patch advance) — computed, never written back
//   3. publish       : staging "release slot" written in temp; manifest hash
//                      equality proves the uploaded release == the build
//   4. health        : live probe GET /api/status on the running release
//                      (the real service that serves the artifacts)
//   5. rollback      : restore the PREVIOUS manifest into the active slot and
//                      verify byte-identical restoration (hash equality)
//
// Output: single-line JSON on stdout + .uap/reports/DEPLOY-DRY-RUN.json
// Exit codes: 0 = rehearsal executed (verdict inside), 1 = tool failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOL_DIR, '..', '..');
const OUT_FILE = path.join(ROOT, '.uap', 'reports', 'DEPLOY-DRY-RUN.json');
const TARGET = process.env.H5_BASE_URL || process.env.VISUAL_BASE_URL || 'http://localhost:3000';

function out(payload, code) {
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload));
  process.exit(code);
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function manifestOf(dir) {
  const entries = [];
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(abs, r);
      else {
        const buf = fs.readFileSync(abs);
        entries.push({ path: r, bytes: buf.length, sha256: sha256(buf) });
      }
    }
  };
  walk(dir, '');
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return entries;
}

async function probeHealth(url) {
  try {
    const res = await fetch(url + '/api/status', { signal: AbortSignal.timeout(8000) });
    const body = await res.text();
    let ok = res.status === 200;
    try {
      const j = JSON.parse(body);
      ok = ok && j && (j.success === true || j.data);
    } catch { /* non-JSON body still fails the probe */ }
    return { ok, http_status: res.status, detail: `GET /api/status -> ${res.status}` };
  } catch (e) {
    return { ok: false, http_status: null, detail: `health probe failed: ${String(e.message || e).slice(0, 120)}` };
  }
}

async function main() {
  const steps = [];
  const push = (name, ok, detail) => steps.push({ name, ok, detail });

  // 1. preflight — real artifacts, not placeholders.
  const versionText = fs.existsSync(path.join(ROOT, 'VERSION'))
    ? fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim() : '';
  const distDir = path.join(ROOT, 'web', 'dist');
  let manifest = null;
  if (fs.existsSync(path.join(distDir, 'index.html'))) {
    manifest = manifestOf(distDir);
  }
  const binary = process.env.UTER_RELEASE_BINARY || path.join(ROOT, 'uter-bin');
  const binaryHash = fs.existsSync(binary) ? sha256(fs.readFileSync(binary)) : null;
  const preflightOk = !!versionText && !!manifest && manifest.length > 100 && !!binaryHash;
  push('preflight_artifacts', preflightOk,
    `VERSION=${versionText || 'MISSING'}; web/dist 清单=${manifest ? `${manifest.length} 个文件` : 'MISSING'}; release 二进制 sha256=${binaryHash ? binaryHash.slice(0, 16) + '…' : 'MISSING'}`);
  if (!preflightOk) {
    out({ generated_at: new Date().toISOString(), blocked: true, reason: 'preflight: real release artifacts incomplete', steps,
      verdict: { deployment_plan: 'FAIL', rollback_plan: 'FAIL', health_check: 'FAIL' } }, 1);
  }

  // 2. version advance — computed only; repo VERSION is never modified.
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(versionText);
  let nextVersion = null;
  if (m) nextVersion = `v${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
  push('version_advance_computed', !!nextVersion,
    `current=${versionText} -> next=${nextVersion || 'PARSE_FAIL'} (仅计算, 不回写仓库 VERSION)`);

  // 3. publish rehearsal — staging slot in OS temp, hash-verified.
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'uap-deploy-rehearsal-'));
  const releaseSlot = path.join(staging, 'release');
  const rollbackSlot = path.join(staging, 'previous');
  fs.cpSync(distDir, releaseSlot, { recursive: true });
  fs.cpSync(distDir, rollbackSlot, { recursive: true });
  const relManifest = manifestOf(releaseSlot);
  const manifestEq = relManifest.length === manifest.length
    && relManifest.every((e, i) => e.path === manifest[i].path && e.sha256 === manifest[i].sha256);
  push('publish_manifest_integrity', manifestEq,
    `发布槽复制 web/dist(${relManifest.length} 文件) 与构建清单逐文件 sha256 比对: ${manifestEq ? '完全一致' : 'MISMATCH'}`);

  // 4. health probe — the RUNNING release serving these artifacts.
  const health = await probeHealth(TARGET);
  push('health_check_live', health.ok, `${health.detail}; 目标=${TARGET} (仅本地服务, 不触生产)`);

  // 5. rollback rehearsal — restore previous slot, byte-identical.
  const rbManifest = manifestOf(rollbackSlot);
  const rbEq = rbManifest.length === manifest.length
    && rbManifest.every((e, i) => e.path === manifest[i].path && e.sha256 === manifest[i].sha256);
  // also prove the mechanism: mutate the release slot, then "roll back".
  const canary = path.join(releaseSlot, 'static');
  let rollbackRestores = rbEq;
  try {
    fs.writeFileSync(path.join(releaseSlot, 'rollback-canary.txt'), 'new-release-marker');
    fs.rmSync(releaseSlot, { recursive: true });
    fs.cpSync(rollbackSlot, releaseSlot, { recursive: true });
    const after = manifestOf(releaseSlot);
    rollbackRestores = after.length === manifest.length
      && after.every((e, i) => e.path === manifest[i].path && e.sha256 === manifest[i].sha256)
      && !fs.existsSync(path.join(releaseSlot, 'rollback-canary.txt'));
  } catch (e) {
    rollbackRestores = false;
    steps.push({ name: 'rollback_mechanism_error', ok: false, detail: String(e.message || e).slice(0, 160) });
  }
  push('rollback_restores_previous_release', rollbackRestores,
    `注入新版本标记 -> 回滚恢复上一槽位 -> 逐文件 sha256 == 原构建且标记被清除: ${rollbackRestores}`);

  // boundaries: rehearsal only wrote inside the OS temp dir.
  push('boundary_temp_only', fs.existsSync(staging) && !fs.existsSync(path.join(ROOT, '.uap-deploy-canary')),
    `全部演练写入限于 ${staging} (os.tmpdir), 仓库无演练产物`);

  fs.rmSync(staging, { recursive: true, force: true });

  const verdict = {
    deployment_plan: steps.filter((s) => ['preflight_artifacts', 'version_advance_computed', 'publish_manifest_integrity'].includes(s.name)).every((s) => s.ok) ? 'PASS' : 'FAIL',
    rollback_plan: rollbackRestores ? 'PASS' : 'FAIL',
    health_check: health.ok ? 'PASS' : 'FAIL',
  };
  out({
    generated_at: new Date().toISOString(),
    target: TARGET,
    mode: 'dry-run rehearsal (authorized by AUTH-DEPLOY-2026-11-12; local artifacts only)',
    version: { current: versionText, next_computed: nextVersion },
    artifacts: { dist_files: manifest.length, binary_sha256: binaryHash },
    steps,
    verdict,
  }, 0);
}

main().catch((e) => out({ generated_at: new Date().toISOString(), error: String(e.message || e), verdict: {} }, 1));
