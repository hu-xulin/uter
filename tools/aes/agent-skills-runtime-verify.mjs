#!/usr/bin/env node
/**
 * Uter agent/skill runtime loader verification.
 *
 * Simulates what an agent runtime must do to actually load a skill, for every
 * canonical project skill under .agents/skills and its runtime adapters under
 * .claude/skills:
 *   1. parse the SKILL.md YAML frontmatter (real parse, real fields);
 *   2. require name/description and name-directory agreement;
 *   3. require the adapter to delegate to the canonical skill path;
 *   4. real-load referenced repository files (every backticked repo-relative
 *      path mentioned in the adapter body must exist on disk);
 *   5. require the adapter set and canonical set to be identical.
 *
 * Fail-closed: any missing piece keeps the skill unloaded and exits non-zero.
 * Output: .aes/reports/UTER-AGENT-SKILLS-RUNTIME-VERIFICATION.json
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(process.env.P13_ROOT || process.cwd())
const OUTPUT = resolve(process.env.UTER_SKILLS_REPORT || resolve(ROOT, '.aes/reports/UTER-AGENT-SKILLS-RUNTIME-VERIFICATION.json'))
const AGENTS_DIR = resolve(process.env.UTER_AGENTS_SKILLS_DIR || resolve(ROOT, '.agents/skills'))
const CLAUDE_DIR = resolve(process.env.UTER_CLAUDE_SKILLS_DIR || resolve(ROOT, '.claude/skills'))
const sha = (v) => createHash('sha256').update(v).digest('hex')

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\s*(\r?\n|$)/)
  if (!match) return null
  const lines = match[1].split(/\r?\n/)
  const data = {}
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') { i++; continue }
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!m) return null // strict: every frontmatter line must be a key or scalar continuation
    const key = m[1]
    let value = m[2].trim()
    if (/^[>|][+-]?$/.test(value)) {
      // YAML block scalar: '>' folds newlines into spaces, '|' keeps them.
      const folded = value.startsWith('>')
      const keepEnds = value.endsWith('-')
      const parts = []
      i++
      while (i < lines.length && (lines[i].startsWith(' ') || lines[i].trim() === '')) {
        parts.push(lines[i].replace(/^ {2}/, ''))
        i++
      }
      let joined = folded ? parts.join(' ') : parts.join('\n')
      if (!keepEnds) joined = joined.replace(/\s+$/, '')
      data[key] = joined
      continue
    }
    if (value === '') return null // strict: no empty scalars in skill frontmatter
    data[key] = value
    i++
  }
  if (Object.keys(data).length === 0) return null
  return data
}

function listSkillDirs(base) {
  if (!existsSync(base) || !statSync(base).isDirectory()) return null
  return readdirSync(base).filter((name) => {
    const dir = resolve(base, name)
    return statSync(dir).isDirectory() && !name.startsWith('.')
  }).sort()
}

function expandBracePaths(ref) {
  // Expand a single brace group: `path/{a,b,c}.json` -> [path/a.json, ...].
  const m = ref.match(/^([^{}]*?)\{([^{}]+)\}([^{}]*)$/)
  if (!m) return [ref]
  return m[2].split(',').map((alt) => m[1] + alt.trim() + m[3])
}

function missingReferencedFiles(body) {
  const missing = []
  for (const m of body.matchAll(/`([^`\n]+)`/g)) {
    const ref = m[1].trim()
    if (!ref || ref.includes(' ')) continue
    if (!(/^(\.aes\/|scripts\/|docs\/|uaes\/|web\/)/.test(ref) || ref === 'AGENTS.md')) continue
    const clean = ref.replace(/[.,;:]+$/, '')
    if (!clean) continue
    // Brace groups expand into concrete files; a real runtime must resolve all
    // of them, so every expanded variant has to exist on disk.
    for (const variant of expandBracePaths(clean)) {
      if (!existsSync(resolve(ROOT, variant))) missing.push(variant)
    }
  }
  return [...new Set(missing)]
}

const canonicalSkills = listSkillDirs(AGENTS_DIR)
const adapterSkills = listSkillDirs(CLAUDE_DIR)

const problems = []
const skills = []

if (!canonicalSkills || canonicalSkills.length === 0) {
  problems.push('.agents/skills contains no loadable skills')
}
if (!adapterSkills) {
  problems.push('.claude/skills adapter directory missing')
}

const canonicalSet = (canonicalSkills || []).join(',')
const adapterSet = (adapterSkills || []).join(',')
if (canonicalSkills && adapterSkills && canonicalSet !== adapterSet) {
  problems.push(`adapter/canonical skill sets differ: canonical=[${canonicalSet}] adapters=[${adapterSet}]`)
}

for (const name of canonicalSkills || []) {
  const record = { name, loaded: false, checks: {} }
  const canonicalPath = resolve(AGENTS_DIR, name, 'SKILL.md')
  if (!existsSync(canonicalPath)) {
    problems.push(`${name}: canonical SKILL.md missing`)
    skills.push(record)
    continue
  }
  const canonicalBody = readFileSync(canonicalPath, 'utf8')
  const canonicalMeta = parseFrontmatter(canonicalBody)
  if (!canonicalMeta) {
    problems.push(`${name}: canonical frontmatter invalid`)
    skills.push(record)
    continue
  }
  if (canonicalMeta.name !== name) {
    problems.push(`${name}: canonical frontmatter name "${canonicalMeta.name}" disagrees with directory`)
    skills.push(record)
    continue
  }
  if (!canonicalMeta.description || canonicalMeta.description.length < 20) {
    problems.push(`${name}: canonical description missing or trivial`)
    skills.push(record)
    continue
  }
  record.checks.canonical_frontmatter = { ok: true, digest: sha(canonicalBody) }

  const adapterPath = resolve(CLAUDE_DIR, name, 'SKILL.md')
  if (!existsSync(adapterPath)) {
    problems.push(`${name}: runtime adapter SKILL.md missing`)
    skills.push(record)
    continue
  }
  const adapterBody = readFileSync(adapterPath, 'utf8')
  const adapterMeta = parseFrontmatter(adapterBody)
  if (!adapterMeta) {
    problems.push(`${name}: adapter frontmatter invalid`)
    skills.push(record)
    continue
  }
  if (adapterMeta.name !== name) {
    problems.push(`${name}: adapter frontmatter name "${adapterMeta.name}" disagrees with directory`)
    skills.push(record)
    continue
  }
  record.checks.adapter_frontmatter = { ok: true, digest: sha(adapterBody) }

  const canonicalRef = `.agents/skills/${name}/SKILL.md`
  if (!adapterBody.includes(canonicalRef)) {
    problems.push(`${name}: adapter does not delegate to canonical ${canonicalRef}`)
    skills.push(record)
    continue
  }
  record.checks.delegation = { ok: true, target: canonicalRef }

  const missingRefs = missingReferencedFiles(adapterBody)
  if (missingRefs.length > 0) {
    problems.push(`${name}: adapter references missing repository files: ${missingRefs.join(', ')}`)
    skills.push(record)
    continue
  }
  record.checks.referenced_files = { ok: true, resolved_via_real_disk_reads: true }

  record.loaded = true
  skills.push(record)
}

const loaded = skills.filter((s) => s.loaded).length
const report = {
  schema_version: '1.0.0',
  report_id: 'UTER-AGENT-SKILLS-RUNTIME-VERIFICATION',
  generated_at: new Date().toISOString(),
  generated_by: 'tools/aes/agent-skills-runtime-verify.mjs',
  written_by_hand: false,
  uter_root: ROOT,
  runtime_load_semantics: 'frontmatter parse + canonical delegation + referenced-file resolution (real disk reads)',
  canonical_skill_count: (canonicalSkills || []).length,
  loaded_skill_count: loaded,
  verdict: problems.length === 0 && loaded > 0 && loaded === skills.length ? 'PASS' : 'NOT_VERIFIED',
  problems: problems.length > 0 ? problems : null,
  skills,
  honesty_note: 'Runtime loading here means the loader performed the same reads a real agent runtime performs (frontmatter, delegation target, referenced files). Autonomous behaviour of external agent runtimes remains external_unverified by design.',
}
mkdirSync(resolve(OUTPUT, '..'), { recursive: true })
writeFileSync(OUTPUT, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ verdict: report.verdict, canonical: report.canonical_skill_count, loaded, problems }, null, 2))
if (report.verdict !== 'PASS') process.exit(1)
