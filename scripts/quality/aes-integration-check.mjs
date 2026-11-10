#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const args = process.argv.slice(2)
const option = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback }
const AES_ROOT = resolve(option('aes-root', process.env.AES_ROOT || join(ROOT, '../aes')))
const PIN_PATH = join(ROOT, '.aes/aes-pin.json')
const PROJECT_REGISTRY = join(ROOT, '.aes/uter-governance-registry.yaml')
const P13_PATH = join(ROOT, '.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md')
const requireFile = (p) => { if (!existsSync(p) || !readFileSync(p).length) throw new Error('missing/empty: ' + p) }
const read = (p) => readFileSync(p, 'utf8')
const pin = JSON.parse(read(PIN_PATH))
const failures = [], checks = []
const check = (id, ok, detail) => { checks.push({ id, status: ok ? 'PASS' : 'FAIL', detail }); if (!ok) failures.push(id) }
for (const p of [PIN_PATH, PROJECT_REGISTRY, P13_PATH, join(ROOT,'AGENTS.md'), join(ROOT,'CLAUDE.md')]) requireFile(p)
for (const p of ['.aes/STANDARD-REGISTRY.yaml','.aes/spec-registry/SPECIFICATION-REGISTRY.yaml','.aes/registry/requirements.yaml','quality/scripts/aes/governed-fingerprint.mjs','quality/scripts/aes/spec-integrity.mjs','governance/ai-native/engine/cli.mjs']) requireFile(join(AES_ROOT,p))
const registry = read(join(AES_ROOT,'.aes/STANDARD-REGISTRY.yaml'))
const version = (registry.match(/^\s*version:\s*"?([^"\n]+)"?/m)||[])[1] || ''
const status = (registry.match(/^\s*status:\s*"?([^"\n]+)"?/m)||[])[1] || ''
const blob = execFileSync('git',['-C',AES_ROOT,'hash-object','.aes/STANDARD-REGISTRY.yaml'],{encoding:'utf8'}).trim()
check('AES-PIN-001', pin.repository === 'https://github.com/hu-xulin/aes', 'pin identifies canonical AES repository')
check('AES-PIN-002', pin.registry_path === '.aes/STANDARD-REGISTRY.yaml' && pin.registry_version === version, 'registry path/version match live AES registry')
check('AES-PIN-003', pin.registry_status === status && status === 'ACTIVE', 'AES registry is ACTIVE and pin matches')
check('AES-PIN-004', pin.registry_blob_sha === blob, 'registry Git blob SHA matches pin')
const fp = execFileSync(process.execPath,[join(AES_ROOT,'quality/scripts/aes/governed-fingerprint.mjs'),'--json','--require-intact'],{cwd:AES_ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe']})
const live = JSON.parse(fp)
check('AES-PIN-005', live.seal_intact === true, 'ACTIVE specification seal recomputes from governed bytes')
check('AES-PIN-006', pin.governed_fingerprint !== 'PENDING_MACHINE_RECOMPUTATION' && pin.governed_fingerprint === live.fingerprint, 'governed fingerprint matches machine pin')
const canonical = (value) => JSON.stringify(value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]))
  : value)
const canonicalValue = (value) => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]))
  : Array.isArray(value) ? value.map(canonicalValue) : value
check('AES-PIN-007', canonicalValue(pin.governed_components) && canonical(pin.governed_components) === canonical(live.components), 'all fingerprint components match machine pin independent of JSON key order')
const specRegistry = read(join(AES_ROOT,'.aes/spec-registry/SPECIFICATION-REGISTRY.yaml'))
const activeSpecs = [...specRegistry.matchAll(/^\s*normative_status:\s*ACTIVE\s*$/gm)].length
check('AES-PIN-008', activeSpecs === 1 && specRegistry.includes('specification_id: AES-SPEC-CORE'), 'exactly one ACTIVE formal specification')
const requirements = read(join(AES_ROOT,'.aes/registry/requirements.yaml'))
const requirementCount = Number((requirements.match(/^\s*total:\s*(\d+)/m)||[])[1] || 0)
check('AES-PIN-009', requirementCount > 0 && requirementCount === pin.requirement_count, 'requirement registry count matches pin')
const project = read(PROJECT_REGISTRY)
const phases = Array.from({length:13},(_,i)=>'P'+String(i).padStart(2,'0'))
const phaseMissing = phases.filter(p=>!new RegExp('^\\s*- '+p+'\\s*$', 'm').test(project))
check('AES-UTER-001', phaseMissing.length === 0, phaseMissing.length ? 'missing inherited domains: '+phaseMissing.join(',') : 'Uter inherits AES P00-P12')
check('AES-UTER-002', project.includes('UTER-P13') && project.includes('.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md'), 'UTER-P13 is registered in the Uter project registry')
check('AES-UTER-003', project.includes('role: "PROVE"') && project.includes('role: "DEFINE"'), 'P09 proves quality; P10 defines security/reliability')
check('AES-UTER-004', project.includes('integration_status: "MIGRATION_PENDING"'), 'conformance is not implicitly promoted')
const agents = read(join(ROOT,'AGENTS.md')), claude = read(join(ROOT,'CLAUDE.md'))
check('AES-AGENT-001', agents.includes('AES_AUTONOMOUS_GOVERNANCE') && agents.includes('governed-fingerprint.mjs'), 'AGENTS.md bootstraps canonical AES')
check('AES-AGENT-002', claude.includes('AES_AUTONOMOUS_GOVERNANCE') && claude.includes('governed-fingerprint.mjs'), 'CLAUDE.md bootstraps canonical AES')
check('AES-AGENT-003', !agents.includes('uaes/governance') && !claude.includes('uaes/governance'), 'no stale UAES canonical-source bootstrap')
const report = { schema_version:'1.0.0', engine:'UTER-AES-INTEGRATION-CHECK', executed_at:new Date().toISOString(), aes_root:AES_ROOT, aes_commit:execFileSync('git',['-C',AES_ROOT,'rev-parse','HEAD'],{encoding:'utf8'}).trim(), pin_fingerprint:pin.governed_fingerprint, live_fingerprint:live.fingerprint, checks, verdict:failures.length?'FAIL':'PASS', failed_checks:failures }
console.log(JSON.stringify(report,null,2))
if (failures.length) process.exitCode=1
