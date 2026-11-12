/**
 * UAP engine: delivery
 * Executors: delivery.ci_cd / delivery.deployment / delivery.observability
 * Parses real workflow job names and run: commands, checks deployment files,
 * and records CI->local equivalent commands plus deployment/rollback sources.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPORTS, rootPath, relToRoot } from '../../runtime/_lib/paths.mjs';
import { readText, exists, listFiles, readJSON, writeJSON, nowISO } from '../../runtime/_lib/util.mjs';

export const component = 'engines.delivery';
export const version = '1.0.0';
export const executors = ['delivery.ci_cd', 'delivery.deployment', 'delivery.observability'];

const REPORT_FILE = path.join(REPORTS, 'DELIVERY.json');

function scanWorkflows() {
  const wf = listFiles(rootPath('.github/workflows'), {
    recursive: false, filter: (a) => /\.ya?ml$/.test(a),
  });
  const workflows = [];
  const ciCommands = [];
  for (const f of wf) {
    const text = readText(f);
    const lines = text.split('\n');
    const jobsStart = lines.findIndex((l) => /^jobs:\s*$/.test(l));
    const jobs = [];
    if (jobsStart >= 0) {
      for (let i = jobsStart + 1; i < lines.length; i += 1) {
        const m = lines[i].match(/^  ([\w-]+):\s*$/);
        if (m) jobs.push({ name: m[1], line: i + 1 });
        else if (/^\S/.test(lines[i]) && jobs.length) break;
      }
    }
    let runCount = 0;
    lines.forEach((line, i) => {
      const m = line.match(/^\s*run:\s*(.+)$/);
      if (!m) return;
      runCount += 1;
      const command = m[1].trim().slice(0, 200);
      let job = null;
      for (const j of jobs) if (j.line < i) job = j.name;
      ciCommands.push({ file: relToRoot(f), job, line: i + 1, command });
    });
    workflows.push({
      file: relToRoot(f),
      job_count: jobs.length,
      jobs: jobs.map((j) => j.name),
      run_command_count: runCount,
      uses_step_count: (text.match(/\buses:\s*/g) || []).length,
    });
  }
  return { workflows, ci_commands: ciCommands };
}

function localGateCommands() {
  const agents = exists(rootPath('AGENTS.md')) ? readText(rootPath('AGENTS.md')) : '';
  const re = /(?:gofmt -l \.|go vet \.\/\.\.\.|make test|bun run [A-Za-z0-9_:.-]+|\.\/scripts\/verify-all\.sh(?: --quick)?|tsgo -b --force|bunx vitest run [^\s]+|playwright test[A-Za-z0-9_.:-]*|bash scripts\/quality\/uter-quality\.sh review|bun install --frozen-lockfile)/g;
  return [...new Set(agents.match(re) || [])];
}

function localEquivalentCommands(ciCommands) {
  const local = localGateCommands();
  return ciCommands.map((c) => {
    const norm = c.command.replace(/\s+/g, ' ').trim();
    const eq = local.find((l) => norm.includes(l) || l.includes(norm.slice(0, 20)));
    return {
      ci_command: c.command, file: c.file, job: c.job,
      local_equivalent: eq || null,
      source: eq ? 'AGENTS.md' : null,
    };
  });
}

function checkDeploymentFiles() {
  const candidates = [
    'scripts/verify-all.sh', 'Dockerfile', 'build-prod.sh', 'Makefile',
    'docker-compose.yml', 'docker-compose.yaml',
    '.github/workflows/release.yml', '.github/workflows/docker-build.yml',
  ];
  const out = [];
  for (const c of candidates) {
    const a = rootPath(c);
    out.push({ path: c, exists: exists(a), size: exists(a) ? fs.statSync(a).size : 0 });
  }
  const compose = listFiles(rootPath('.'), {
    recursive: false, filter: (a) => /^docker-compose.*\.ya?ml$/.test(path.basename(a)),
  });
  for (const d of compose) {
    const rel = relToRoot(d);
    if (!out.find((o) => o.path === rel)) out.push({ path: rel, exists: true, size: fs.statSync(d).size });
  }
  return out;
}

function deploymentSources() {
  const sources = [];
  const docker = rootPath('Dockerfile');
  if (exists(docker)) {
    const t = readText(docker);
    sources.push({
      file: 'Dockerfile',
      from: (t.match(/^FROM\s+(.+)$/m) || [])[1] || null,
      expose: (t.match(/^EXPOSE\s+(.+)$/m) || [])[1] || null,
      cmd_or_entrypoint: (t.match(/^(?:CMD|ENTRYPOINT)\s+(.+)$/m) || [])[1] || null,
    });
  }
  const compose = listFiles(rootPath('.'), {
    recursive: false, filter: (a) => /^docker-compose.*\.ya?ml$/.test(path.basename(a)),
  });
  for (const c of compose) {
    const t = readText(c);
    sources.push({
      file: relToRoot(c),
      services: (t.match(/^  ([\w-]+):\s*$/gm) || []).length,
      restart_policy_present: /restart:\s*/.test(t),
      image_refs: (t.match(/image:\s*(.+)/g) || []).length,
    });
  }
  const build = rootPath('build-prod.sh');
  if (exists(build)) {
    sources.push({
      file: 'build-prod.sh',
      first_commands: readText(build).split('\n')
        .filter((l) => l.trim() && !l.trim().startsWith('#'))
        .slice(0, 8).map((l) => l.trim().slice(0, 120)),
    });
  }
  return sources;
}

function rollbackSources() {
  const files = [
    ...listFiles(rootPath('.github/workflows'), { recursive: false, filter: (a) => /\.ya?ml$/.test(a) }),
    ...listFiles(rootPath('scripts'), { recursive: true, filter: (a) => /\.(sh|rb|py|mjs)$/.test(a) }),
  ];
  const re = /(rollback|revert|previous[_-]?version|downgrade|roll\s*back|回滚|回退)/i;
  const anchors = [];
  for (const f of files) {
    readText(f).split('\n').forEach((l, i) => {
      if (anchors.length < 20 && re.test(l)) {
        anchors.push({ file: relToRoot(f), line: i + 1, snippet: l.trim().slice(0, 140) });
      }
    });
  }
  return {
    found: anchors.length > 0,
    anchors,
    gap: anchors.length === 0 ? 'no explicit rollback procedure found in workflows/scripts' : null,
  };
}

function observabilityAnchors() {
  const anchors = [];
  const goMod = exists(rootPath('go.mod')) ? readText(rootPath('go.mod')) : '';
  for (const p of ['prometheus', 'pyroscope', 'opentelemetry', 'otel', 'grafana', 'sentry', 'zap', 'logrus']) {
    if (new RegExp(p, 'i').test(goMod)) anchors.push({ type: 'go_dependency', name: p, source: 'go.mod' });
  }
  const ctrl = listFiles(rootPath('controller'), {
    recursive: false, filter: (a) => a.endsWith('.go') && /(uptime|metric|health|monitor)/i.test(path.basename(a)),
  });
  for (const c of ctrl.slice(0, 10)) {
    anchors.push({ type: 'controller', name: path.basename(c), source: relToRoot(c) });
  }
  return anchors;
}

function artifactOk(file) {
  if (!exists(file)) return true;
  let j;
  try { j = readJSON(file); } catch { return false; }
  if (!j || !Array.isArray(j.workflows) || !Array.isArray(j.ci_commands) || !Array.isArray(j.deployment_files)) return false;
  return Boolean(j.local_equivalent_commands && j.rollback_sources && j.deployment_sources);
}

export function health() {
  const checks = {};
  checks.ci_yml_exists = exists(rootPath('.github/workflows/ci.yml'));
  checks.verify_all_exists = exists(rootPath('scripts/verify-all.sh'));
  checks.dockerfile_exists = exists(rootPath('Dockerfile'));
  let sw = null;
  try { sw = scanWorkflows(); } catch { sw = null; }
  const jobCount = sw ? sw.workflows.reduce((n, w) => n + w.job_count, 0) : 0;
  checks.jobs_parsed = jobCount >= 1;
  checks.ci_commands_hit = Boolean(sw && sw.ci_commands.length >= 1);
  checks.report_schema = artifactOk(REPORT_FILE);
  const ok = Object.values(checks).every(Boolean);
  return {
    component, ok, checks,
    summary: `workflows=${sw ? sw.workflows.length : 0} jobs=${jobCount} `
      + `ci_commands=${sw ? sw.ci_commands.length : 0} report_schema=${checks.report_schema}`,
    checked_at: nowISO(),
  };
}

export async function execute(task = {}, ctx = {}) {
  const started = nowISO();
  const sw = scanWorkflows();
  const equivalents = localEquivalentCommands(sw.ci_commands);
  const deploymentFiles = checkDeploymentFiles();
  const deployment = deploymentSources();
  const rollback = rollbackSources();
  const observability = observabilityAnchors();

  const gaps = [];
  if (!rollback.found) gaps.push({ type: 'no_explicit_rollback_procedure', detail: rollback.gap });
  for (const f of deploymentFiles) {
    if (!f.exists && ['scripts/verify-all.sh', 'Dockerfile', 'build-prod.sh'].includes(f.path)) {
      gaps.push({ type: 'missing_deployment_file', path: f.path });
    }
  }

  writeJSON(REPORT_FILE, {
    schema_version: '1.0', generated_at: started,
    executor_ids: executors,
    workflows: sw.workflows,
    job_count: sw.workflows.reduce((n, w) => n + w.job_count, 0),
    ci_command_count: sw.ci_commands.length,
    ci_commands: sw.ci_commands,
    local_equivalent_commands: equivalents,
    local_gate_command_count: localGateCommands().length,
    deployment_files: deploymentFiles,
    deployment_sources: deployment,
    rollback_sources: rollback,
    observability_anchors: observability,
    gaps,
  });

  return {
    status: 'SUCCEEDED',
    summary: `parsed ${sw.workflows.length} real workflows with ${sw.workflows.reduce((n, w) => n + w.job_count, 0)} jobs and `
      + `${sw.ci_commands.length} run: commands; ${equivalents.filter((e) => e.local_equivalent).length} have local equivalents; `
      + `deployment files present ${deploymentFiles.filter((f) => f.exists).length}/${deploymentFiles.length}; `
      + `rollback anchors=${rollback.anchors.length}, observability anchors=${observability.length}, gaps=${gaps.length}`,
    changed_files: [relToRoot(REPORT_FILE)],
    commands: [],
    evidence_refs: [],
    outputs: {
      workflow_count: sw.workflows.length,
      job_count: sw.workflows.reduce((n, w) => n + w.job_count, 0),
      ci_command_count: sw.ci_commands.length,
      local_equivalent_count: equivalents.filter((e) => e.local_equivalent).length,
      local_gate_command_count: localGateCommands().length,
      deployment_files_present: deploymentFiles.filter((f) => f.exists).length,
      deployment_files_total: deploymentFiles.length,
      deployment_sources: deployment.length,
      rollback_found: rollback.found,
      rollback_anchor_count: rollback.anchors.length,
      observability_anchor_count: observability.length,
      gap_count: gaps.length,
    },
  };
}
