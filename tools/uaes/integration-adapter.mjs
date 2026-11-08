#!/usr/bin/env node
/** Uter ↔ UAES Integration Adapter.
 *
 *  Implements UAES-GOV-004 §8. The adapter:
 *    1. discovers the authorised UAES registry,
 *    2. identifies the current ACTIVE specification version,
 *    3. verifies its integrity and authenticity itself,
 *    4. loads P00–P12 and the UTER P13 extension,
 *    5. generates a complete requirement mapping,
 *    6. reports missing implementations, conflicting legacy rules, duplicates
 *       and obsolete instructions,
 *    7. records the exact UAES version and integrity digest.
 *
 *  HARD RULE (§8 closing sentence): copying UAES files into the project does
 *  NOT constitute integration. Integration is only claimed when every
 *  requirement resolves to a real enforcement point *and* the pin matches the
 *  ACTIVE specification digest.
 *
 *  Usage:
 *    node tools/uaes/integration-adapter.mjs status
 *    node tools/uaes/integration-adapter.mjs map [--write]
 *    node tools/uaes/integration-adapter.mjs discover
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SELF = dirname(new URL(import.meta.url).pathname)
const UTER_ROOT = resolve(SELF, '..', '..')
const UAES_ROOT = resolve(process.env.UAES_REPO_ROOT || '/Users/lincolnhu/uaes')

const UAES_SPEC_REGISTRY = join(UAES_ROOT, '.uaes/spec-registry/SPECIFICATION-REGISTRY.yaml')
const UAES_REQ_REGISTRY = join(UAES_ROOT, '.uaes/registry/requirements.yaml')
const UAES_ALLOWED_SIGNERS = join(UAES_ROOT, '.uaes/trust/allowed_signers')
const UTER_PIN = join(UTER_ROOT, '.uaes/uaes-pin.json')

/**
 * YAML loading with an explicit, ordered fallback chain.
 *
 * `js-yaml` is NOT a declared dependency of `web/package.json` — it is hoisted
 * in as a transitive dep of `cosmiconfig`. Relying on it silently would make
 * this adapter break the day that hoisting changes, and it is absent entirely
 * on a CI runner that has not installed the frontend workspace. So:
 *
 *   1. try the hoisted `js-yaml` (fast, no network);
 *   2. fall back to `python3 -c "import yaml"`, the same mechanism the UAES
 *      governance workflows already use.
 *
 * If neither is available the adapter THROWS. A silently empty requirement list
 * would make every downstream count read as zero and look like a clean result.
 */
const requireFromWeb = createRequire(join(UTER_ROOT, 'web/package.json'))
const jsYaml = (() => {
  try { const m = requireFromWeb('js-yaml'); return m && m.load ? m : (m.default || null) } catch { return null }
})()

let pythonYamlProbed = null
function pythonYamlAvailable() {
  if (pythonYamlProbed !== null) return pythonYamlProbed
  try {
    execFileSync('python3', ['-c', 'import yaml'], { stdio: 'ignore' })
    pythonYamlProbed = true
  } catch { pythonYamlProbed = false }
  return pythonYamlProbed
}

/** Read and parse a YAML file. Throws when no parser is usable. */
function readYamlFile(abs) {
  const text = readFileSync(abs, 'utf8')
  if (jsYaml) return jsYaml.load(text)
  if (pythonYamlAvailable()) {
    const out = execFileSync('python3', ['-c',
      'import sys,yaml,json;print(json.dumps(yaml.safe_load(sys.stdin.read()),ensure_ascii=False))'],
      { input: text, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    return JSON.parse(out)
  }
  throw new Error(
    `no YAML parser available for ${abs}: neither the hoisted js-yaml nor python3+PyYAML is present.`
    + ' Refusing to continue — an empty parse would report every count as zero.',
  )
}

function sha256File(abs) {
  try { return createHash('sha256').update(readFileSync(abs)).digest('hex') } catch { return null }
}

function gitHead(cwd) {
  try {
    return execFileSync('git', ['-C', cwd, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch { return null }
}

/** Step 2/3: identify and authenticate the ACTIVE specification. */
export function discoverAuthoritativeSpecification() {
  if (!existsSync(UAES_SPEC_REGISTRY)) {
    return { ok: false, detail: `UAES specification registry not found at ${UAES_SPEC_REGISTRY}` }
  }
  const reg = readYamlFile(UAES_SPEC_REGISTRY)
  const active = (reg.specifications || []).filter((s) => s.normative_status === 'ACTIVE')
  if (active.length === 0) {
    return { ok: false, detail: 'no ACTIVE specification published in the UAES registry' }
  }
  if (active.length > 1) {
    return { ok: false, detail: `${active.length} ACTIVE specifications published; exactly one is required` }
  }
  const spec = active[0]

  // Authenticity: verify the release signature in the release namespace.
  const payload = join(UAES_ROOT, `.uaes/spec-registry/${spec.specification_id}-${spec.specification_version}.release.json`)
  let signature = { ok: false, detail: 'release payload absent' }
  if (existsSync(payload) && existsSync(`${payload}.sig`) && existsSync(UAES_ALLOWED_SIGNERS)) {
    try {
      const out = execFileSync('ssh-keygen',
        ['-Y', 'verify', '-f', UAES_ALLOWED_SIGNERS, '-I', 'uaes-authority@uaes.local',
          '-n', 'uaes-spec-release', '-s', `${payload}.sig`],
        { input: readFileSync(payload), encoding: 'utf8' })
      signature = { ok: true, detail: out.trim() }
    } catch (e) {
      signature = { ok: false, detail: String(e.stderr || e.message || e).trim() }
    }
  }

  // The signed payload declares the digest; the registry must agree with it.
  let payloadDigest = null
  if (existsSync(payload)) {
    try { payloadDigest = JSON.parse(readFileSync(payload, 'utf8')).integrity_digest } catch { /* reported below */ }
  }
  const digestAgrees = payloadDigest && payloadDigest === spec.integrity_digest?.digest

  return {
    ok: signature.ok && digestAgrees,
    specification_id: spec.specification_id,
    version: spec.specification_version,
    status: spec.normative_status,
    integrity_digest: spec.integrity_digest?.digest,
    signature,
    digest_agrees_with_signed_payload: Boolean(digestAgrees),
    resolver_path: UAES_SPEC_REGISTRY,
    uaes_commit: gitHead(UAES_ROOT),
  }
}

/** Step 4: load P00–P12 plus the project-owned P13 extension. */
export function loadPhaseCorpus() {
  const phases = {}
  const stdDir = join(UAES_ROOT, 'standards')
  if (existsSync(stdDir)) {
    for (const d of readdirSync(stdDir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue
      const m = d.name.match(/^(\d{2})-/)
      if (!m) continue
      const files = readdirSync(join(stdDir, d.name)).filter((f) => f.endsWith('.md'))
      phases[`P${m[1]}`] = { directory: `standards/${d.name}`, standards: files.length }
    }
  }
  const p13 = join(UTER_ROOT, '.uaes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md')
  return {
    uaes_phases: phases,
    uaes_phase_count: Object.keys(phases).length,
    p13_extension: {
      present: existsSync(p13),
      path: '.uaes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md',
      owner: 'UTER (project-owned, MUST NOT be registered in UAES)',
      digest: existsSync(p13) ? sha256File(p13) : null,
    },
  }
}

/**
 * Step 5–6: build the complete requirement mapping and report gaps.
 * Every requirement must resolve to an enforcement point, otherwise it is
 * reported as MISSING — never assumed satisfied.
 */
export function buildRequirementMap() {
  if (!existsSync(UAES_REQ_REGISTRY)) {
    return { ok: false, detail: 'UAES requirement registry missing; run extract-requirements.mjs in the UAES repo' }
  }
  const reqDoc = readYamlFile(UAES_REQ_REGISTRY)
  const requirements = reqDoc.requirements || []

  // Enforcement index: which UAES domain is enforced by which Uter gate script.
  const enforcement = mapEnforcementPoints()
  const govRegistryPath = join(UTER_ROOT, '.uaes/uter-governance-registry.yaml')
  const govRegistry = existsSync(govRegistryPath) ? readYamlFile(govRegistryPath) : null
  // The registry declares inherited *phases* (P00..P12); map them to the
  // domains that actually carry rule-level IDs so coverage is comparable.
  const inheritedPhases = new Set(govRegistry?.uaes_inheritance?.inherited_domains || [])
  const domainToPhase = new Map()
  for (const r of requirements) if (r.phase) domainToPhase.set(r.domain, r.phase)

  // Every domain present in the standards corpus, derived from the directory
  // names (`00-foundation` -> UAES-00). This is the denominator for coverage.
  const corpusDomains = []
  const stdDir = join(UAES_ROOT, 'standards')
  if (existsSync(stdDir)) {
    for (const d of readdirSync(stdDir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue
      const m = d.name.match(/^(\d{2})-/)
      if (m) corpusDomains.push(`UAES-${m[1]}`)
    }
  }
  const domainsWithReqs = new Set(requirements.map((r) => r.domain))
  const uncoveredDomains = corpusDomains.filter((d) => !domainsWithReqs.has(d))

  const rows = []
  const stats = { total: requirements.length, enforced: 0, missing: 0, unenforced_domains: new Set() }
  for (const r of requirements) {
    const points = enforcement.get(r.domain) || []
    const enforced = points.length > 0
    if (enforced) stats.enforced += 1
    else { stats.missing += 1; stats.unenforced_domains.add(r.domain) }
    const phase = r.phase || domainToPhase.get(r.domain) || null
    rows.push({
      requirement_id: r.requirement_id,
      domain: r.domain,
      phase,
      strength: r.strength,
      enforcement_points: points,
      status: enforced ? 'MAPPED' : 'MISSING',
      phase_inherited: phase ? inheritedPhases.has(phase) : false,
    })
  }

  return {
    ok: true,
    counts: {
      total: stats.total,
      mapped: stats.enforced,
      missing: stats.missing,
      unenforced_domains: [...stats.unenforced_domains].sort(),
      // Coverage is measured against the corpus, not against the registry.
      // Iterating only over registered requirements can never report a domain
      // that carries no machine-readable requirement at all, so an 8-of-13
      // gap would read as `unenforced_domains: []` — a clean result produced
      // by the shape of the loop rather than by the state of the corpus.
      domains_with_requirements: [...domainsWithReqs].sort(),
      domains_without_requirements: uncoveredDomains.sort(),
      coverage: {
        domains_in_corpus: corpusDomains.length,
        domains_with_requirements: domainsWithReqs.size,
        domains_covered: corpusDomains.length - uncoveredDomains.length,
        fully_covered: uncoveredDomains.length === 0,
      },
      inherited_phases: [...inheritedPhases].length,
      requirements_in_inherited_phases: rows.filter((r) => r.phase_inherited).length,
    },
    rows,
    note: 'MISSING means the requirement has no executable enforcement point in Uter. It is NOT a pass. '
      + 'domains_without_requirements lists corpus domains that carry no machine-readable requirement — '
      + 'those obligations cannot be mapped, verified or failed, so they are excluded from no count as if covered.',
  }
}

/** Map UAES domains to the real Uter scripts that enforce them. */
function mapEnforcementPoints() {
  const map = new Map()
  const add = (domain, point) => {
    if (!map.has(domain)) map.set(domain, [])
    map.get(domain).push(point)
  }
  const has = (rel) => existsSync(join(UTER_ROOT, rel))

  // Read the project governance registry for declared enforcement wiring.
  const p = join(UTER_ROOT, '.uaes/uter-governance-registry.yaml')
  if (existsSync(p)) {
    try {
      const reg = readYamlFile(p)
      const groups = reg?.uaes_inheritance?.domain_enforcement
        || reg?.uaes_inheritance?.domains
        || []
      for (const d of groups) {
        const id = typeof d === 'string' ? d : d.domain || d.id
        const scripts = (typeof d === 'object' && (d.enforcement || d.enforced_by)) || []
        for (const s of Array.isArray(scripts) ? scripts : [scripts]) {
          if (typeof s === 'string' && has(s)) add(id, s)
        }
      }
    } catch { /* fall through to the convention map below */ }
  }

  // Conventional gates that exist in the repository today. Each entry names a
// script that actually evaluates the domain — not a documentation claim.
  // uaes-governance-gates.rb evaluates all 13 UAES phases plus UTER P13, so it
  // is the enforcement point for every domain that carries rule-level IDs.
  const governanceGates = 'scripts/quality/uaes-governance-gates.rb'
  if (has(governanceGates)) {
    for (const d of ['UAES-00', 'UAES-01', 'UAES-02', 'UAES-03', 'UAES-04', 'UAES-05',
      'UAES-06', 'UAES-07', 'UAES-08', 'UAES-09', 'UAES-10', 'UAES-11', 'UAES-12']) {
      add(d, governanceGates)
    }
  }
  const conventions = {
    'UAES-01': ['scripts/quality/uaes-agent-runtime-check.rb'],
    'UAES-02': ['scripts/quality/ai-specs-check.sh'],
    'UAES-05': ['scripts/quality/uter-quality.sh'],
    'UAES-06': ['scripts/quality/uter-quality.sh'],
    'UAES-07': ['scripts/quality/uter-quality.sh'],
    'UAES-08': ['scripts/quality/uaes-agent-runtime-check.rb'],
    'UAES-09': ['scripts/quality/uter-quality.sh'],
    'UAES-10': ['scripts/verify-all.sh'],
    'UAES-11': ['scripts/quality/uaes-integration-check.sh', 'scripts/quality/uaes-pin-check.sh'],
  }
  for (const [domain, scripts] of Object.entries(conventions)) {
    for (const s of scripts) if (has(s)) add(domain, s)
  }
  return map
}

/** Step 8/9/10: detect conflicting, duplicate and obsolete instructions. */
export function detectInstructionConflicts() {
  const findings = []
  const agentsPath = join(UTER_ROOT, 'AGENTS.md')
  const agents = existsSync(agentsPath) ? readFileSync(agentsPath, 'utf8') : ''

  // Obsolete: instructions that describe a superseded governance mechanism.
  const obsoleteMarkers = [
    { pattern: /P00[–-]P12 only/i, detail: 'AGENTS.md mentions only P00-P12 while the project also owns P13' },
    { pattern: /UAES[^.\n]{0,40}1\.8\.0/, detail: 'stale UAES version referenced in instruction text' },
  ]
  for (const m of obsoleteMarkers) {
    if (m.pattern.test(agents)) findings.push({ kind: 'OBSOLETE', location: 'AGENTS.md', detail: m.detail })
  }

  // Conflict: the project must not restate UAES normative text as local law.
  const specDir = join(UTER_ROOT, 'docs/ai-specs')
  if (existsSync(specDir)) {
    for (const f of readdirSync(specDir)) {
      if (!f.endsWith('.md')) continue
      const text = readFileSync(join(specDir, f), 'utf8')
      const copiesRule = /UAES-\d{2}-\d{3}-\d{3}/.test(text) && /\bMUST\b/.test(text)
      if (copiesRule && /STANDARD\.md$/.test(f) === false && /uaes/i.test(f) === false) {
        findings.push({
          kind: 'POSSIBLE_CONFLICT',
          location: `docs/ai-specs/${f}`,
          detail: 'project spec embeds UAES rule IDs and MUST text; risk of competing authority',
        })
      }
    }
  }

  // Duplicate: identical enforcement declared by two different scripts.
  const pinScripts = ['scripts/quality/uaes-pin-check.sh', 'scripts/quality/uaes-integration-check.sh']
    .filter((s) => existsSync(join(UTER_ROOT, s)))
  if (pinScripts.length > 1) {
    const contents = pinScripts.map((s) => readFileSync(join(UTER_ROOT, s), 'utf8'))
    const sigLines = contents.map((c) => c.split('\n').filter((l) => /registry_version|source_commit/.test(l)).length)
    if (sigLines.every((n) => n > 0)) {
      findings.push({
        kind: 'OVERLAP',
        location: pinScripts.join(', '),
        detail: 'both scripts assert the UAES pin; consolidation candidate, not an error',
      })
    }
  }
  return { findings, count: findings.length }
}

/** Step 12: record the pin with the ACTIVE version and digest. */
export function currentPin() {
  if (!existsSync(UTER_PIN)) return null
  return JSON.parse(readFileSync(UTER_PIN, 'utf8'))
}

/**
 * Write the pin, refusing to record one that the UAES commit does not back.
 *
 * The read side (verifyPinnedCommit) can detect a lying pin, but detection is
 * not prevention: any script could still write the file. This is the write-side
 * gate, so a pin can only ever come into existence naming a commit that really
 * carries the artefacts.
 *
 * Returns { ok, detail }. Never throws on a rejected pin — the caller decides.
 */
export function writePin(pin) {
  const check = verifyPinnedCommit(pin)
  if (!check.ok) {
    return {
      ok: false,
      written: false,
      detail: `refusing to record the pin: ${check.detail}`,
      missing: check.missing || [],
    }
  }
  mkdirSync(dirname(UTER_PIN), { recursive: true })
  writeFileSync(UTER_PIN, `${JSON.stringify(pin, null, 2)}\n`)
  return { ok: true, written: true, detail: `pin recorded for ${check.commit.slice(0, 12)}` }
}

/**
 * Verify the pin actually points at a commit that CONTAINS the artefacts it
 * claims to pin.
 *
 * This is the difference between a pin and a wish. A pin file can name any
 * commit, version and digest it likes; if that commit does not carry the
 * specification registry, trust roster and requirement registry, then CI — which
 * checks out UAES at `source_commit` — will validate nothing at all, and the
 * project will look integrated while actually being pinned to an empty tree.
 *
 * Every artefact the pin asserts is checked with `git cat-file -e <sha>:<path>`.
 * An artefact that exists only in a dirty working tree is reported as
 * NOT_IN_COMMIT, never as present.
 */
export function verifyPinnedCommit(pin = currentPin()) {
  if (!pin) return { ok: false, detail: 'no pin recorded' }
  const sha = pin.source_commit
  if (!sha) return { ok: false, detail: 'pin declares no source_commit' }

  const claimed = []
  const push = (rel, why) => { if (rel) claimed.push({ path: rel, why }) }
  push(pin.specification_registry_path, 'specification registry')
  push(pin.requirement_registry_path, 'requirement registry')
  push('.uaes/policies/release-policy.yaml', 'release policy')
  push('.uaes/trust/allowed_signers', 'trusted signer roster')
  push('.uaes/trust/TRUST-BOUNDARIES.yaml', 'trust boundaries')
  push('.uaes/spec-registry/release-history.json', 'release history')

  const results = claimed.map(({ path, why }) => {
    let inCommit = false
    try {
      execFileSync('git', ['-C', UAES_ROOT, 'cat-file', '-e', `${sha}:${path}`],
        { stdio: ['ignore', 'ignore', 'ignore'] })
      inCommit = true
    } catch { inCommit = false }
    return { path, why, in_commit: inCommit }
  })

  const missing = results.filter((r) => !r.in_commit)
  return {
    ok: missing.length === 0,
    commit: sha,
    checked: results.length,
    missing: missing.map((m) => `${m.path} (${m.why})`),
    detail: missing.length === 0
      ? `all ${results.length} declared artefacts are present in ${sha.slice(0, 12)}`
      : `${missing.length}/${results.length} declared artefacts are absent from ${sha.slice(0, 12)}: `
        + missing.map((m) => m.path).join(', '),
  }
}

/**
 * Evidence for the governance decision that technical wiring cannot supply.
 *
 * A verified signature, a complete requirement map and a correct pin prove
 * WIRING, not acceptance. UAES-01-003 and the registry's
 * prohibit_implicit_approval rule require an explicit human declaration plus
 * independently recorded domain acceptance before any integration claim. A pin
 * refresh used to flip integration_status to INTEGRATED on the four technical
 * conditions alone; that is an implicit approval and is a governance defect.
 * This function reads the real acceptance artefacts and fails closed when they
 * are absent, stale or not PASS.
 */
export function governanceAcceptanceEvidence() {
  const gatesDir = 'reports/compliance/uaes-full-migration-2026-11-06/evidence/gates'
  const l3Path = `${gatesDir}/l3-domain-gates.json`
  const l4Path = `${gatesDir}/l4-global-gate.json`
  const loadJson = (p) => {
    try { return JSON.parse(readFileSync(join(UTER_ROOT, p), 'utf8')) } catch { return null }
  }
  const l3 = loadJson(l3Path)
  const l4 = loadJson(l4Path)

  let verificationStatus = null
  try {
    const text = readFileSync(join(UAES_ROOT, '.uaes/spec-registry/SPECIFICATION-REGISTRY.yaml'), 'utf8')
    verificationStatus = (text.match(/^\s*verification_status:\s*(\S+)/m) || [])[1] ?? null
  } catch { /* an absent upstream checkout fails closed below */ }

  const domainAcceptance = l3 ? {
    status: l3.status ?? null,
    pass_count: l3.pass_count ?? null,
    domain_count: l3.domain_count ?? null,
    acceptance_decision: l3.manual_acceptance_evidence?.acceptance_decision ?? null,
    verified_item_count: l3.manual_acceptance_evidence?.verified_item_count ?? null,
  } : null
  const globalGate = l4 ? {
    status: l4.status ?? null,
    met: l4.met ?? null,
    not_met: l4.not_met ?? null,
    mandatory_conditions: l4.mandatory_conditions ?? null,
  } : null

  const blocking = new Set(['PENDING_ITEM_BY_ITEM_REVIEW', 'DEFERRED', 'REJECTED', null, undefined])
  const checks = {
    upstream_spec_verified: verificationStatus === 'VERIFIED',
    domain_gates_pass: Boolean(domainAcceptance && domainAcceptance.status === 'PASS'
      && domainAcceptance.pass_count === domainAcceptance.domain_count
      && domainAcceptance.domain_count > 0),
    manual_acceptance_signed: Boolean(domainAcceptance
      && domainAcceptance.verified_item_count > 0
      && !blocking.has(domainAcceptance.acceptance_decision)),
    global_gate_pass: Boolean(globalGate && globalGate.status === 'PASS'),
  }
  const ok = Object.values(checks).every(Boolean)
  const detail = ok
    ? 'all governance acceptance evidence is present and PASS'
    : Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(', ')

  return {
    ok,
    checks,
    detail,
    upstream_spec_verification_status: verificationStatus,
    domain_acceptance_gate: domainAcceptance,
    global_conformance_gate: globalGate,
    sources: [l3Path, l4Path, '.uaes/spec-registry/SPECIFICATION-REGISTRY.yaml (UAES repo)'],
    note: 'Execution evidence is NOT human acceptance. A pin refresh or a passing signature check must never promote integration status by itself.',
  }
}

/** Full status report used by CI and by the approval engine. */
export function integrationStatus() {
  const spec = discoverAuthoritativeSpecification()
  const corpus = loadPhaseCorpus()
  const map = buildRequirementMap()
  const conflicts = detectInstructionConflicts()
  const pin = currentPin()
  const pinCommit = verifyPinnedCommit(pin)

  // The pin must match the ACTIVE *specification*, not merely the artefact
// registry version — those are different concepts and conflating them lets a
// stale pin look current.
  const pinSpecVersion = pin?.specification_version ?? pin?.registry_version ?? null
  const pinSpecDigest = pin?.specification_integrity_digest ?? null
  const pinMatchesActive = Boolean(
    spec.ok && pin
    && pinSpecVersion === spec.version
    && (pin.specification_status ?? pin.registry_status) === 'ACTIVE'
    && pinSpecDigest === spec.integrity_digest,
  )

  // Integration is a GOVERNANCE DECISION, not a technical inference. The four
  // technical preconditions below are necessary but NOT sufficient: an explicit
  // declaration in the pin and independently recorded acceptance evidence are
  // also required (prohibit_implicit_approval). Without these two guards a mere
  // pin refresh silently promoted MIGRATION_PENDING to INTEGRATED.
  const technicalPreconditions = spec.ok && map.ok && pinMatchesActive
    && pinCommit.ok && map.counts?.missing === 0
  const pinDeclaresIntegration = pin?.integration_status === 'INTEGRATED'
  const acceptance = governanceAcceptanceEvidence()
  const integrated = technicalPreconditions && pinDeclaresIntegration && acceptance.ok

  return {
    generated_at: new Date().toISOString(),
    technical_preconditions_met: technicalPreconditions,
    pin_declares_integration: pinDeclaresIntegration,
    governance_acceptance: acceptance,
    uaes: spec,
    corpus,
    pin,
    pin_matches_active_specification: pinMatchesActive,
    pin_commit_verified: pinCommit,
    requirement_map: map.ok ? {
      counts: map.counts,
      note: map.note,
    } : { error: map.detail },
    instruction_findings: conflicts,
    uaes_lifecycle_pin: {
      registry_version: pin?.registry_version ?? null,
      registry_status: pin?.registry_status ?? null,
      registry_blob_sha: pin?.registry_blob_sha ?? null,
      source_commit: pin?.source_commit ?? null,
      pinned_specification_version: pinSpecVersion,
      pinned_specification_digest: pinSpecDigest,
      active_specification_version: spec.version ?? null,
      active_specification_digest: spec.integrity_digest ?? null,
      version_matches: pinSpecVersion === spec.version,
      digest_matches: pinSpecDigest === spec.integrity_digest,
    },
    integration_status: integrated ? 'INTEGRATED' : 'MIGRATION_PENDING',
    rationale: integrated
      ? 'ACTIVE specification discovered and authenticated, every requirement mapped to an executable enforcement point, the pin matches, and the pinned commit carries every declared artefact.'
      : 'Not integrated: ' + [
        !spec.ok ? `specification not authentic (${spec.detail || 'signature/digest mismatch'})` : null,
        !map.ok ? 'requirement registry unavailable' : null,
        map.ok && map.counts.missing > 0 ? `${map.counts.missing} requirements without enforcement point` : null,
        !pinMatchesActive ? 'pin does not match the ACTIVE specification' : null,
        !pinCommit.ok ? `pinned commit does not carry the declared artefacts — ${pinCommit.detail}` : null,
        !pinDeclaresIntegration ? 'no explicit INTEGRATED governance declaration is recorded in the pin (prohibit_implicit_approval)' : null,
        !acceptance.ok ? `governance acceptance evidence is not PASS — ${acceptance.detail}` : null,
      ].filter(Boolean).join('; '),
  }
}

function main() {
  const cmd = process.argv[2] || 'status'
  if (cmd === 'status') {
    const r = integrationStatus()
    console.log(JSON.stringify(r, null, 2))
    mkdirSync(join(UTER_ROOT, '.uaes/reports'), { recursive: true })
    writeFileSync(join(UTER_ROOT, '.uaes/reports/uaes-integration-status.json'), `${JSON.stringify(r, null, 2)}\n`)
    process.exitCode = r.integration_status === 'INTEGRATED' ? 0 : 1
    return
  }
  if (cmd === 'discover') {
    console.log(JSON.stringify(discoverAuthoritativeSpecification(), null, 2))
    return
  }
  if (cmd === 'verify-pin') {
    const r = verifyPinnedCommit()
    console.log(JSON.stringify(r, null, 2))
    process.exitCode = r.ok ? 0 : 1
    return
  }
  if (cmd === 'map') {
    const r = buildRequirementMap()
    if (process.argv.includes('--write')) {
      mkdirSync(join(UTER_ROOT, '.uaes/reports'), { recursive: true })
      writeFileSync(join(UTER_ROOT, '.uaes/reports/uaes-requirement-map.json'), `${JSON.stringify(r, null, 2)}\n`)
      console.log(`written: .uaes/reports/uaes-requirement-map.json`)
    }
    console.log(JSON.stringify({ counts: r.counts, note: r.note }, null, 2))
    process.exitCode = r.ok && r.counts.missing === 0 ? 0 : 1
    return
  }
  console.error('Usage: integration-adapter.mjs <status|discover|map> [--write]')
  process.exitCode = 2
}

/**
 * True when this module is the process entry point.
 *
 * Compares REAL paths. `import.meta.url` is symlink-resolved by Node but
 * `process.argv[1]` is the literal caller string, and on macOS every temp path
 * lives under /var -> /private/var. A naive string compare returns false, so
 * `main()` never runs and the process exits 0 having verified nothing — a
 * silent no-op that is indistinguishable from a pass.
 */
function isEntryPoint() {
  if (!process.argv[1]) return false
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
  } catch { return false }
}

if (isEntryPoint()) main()