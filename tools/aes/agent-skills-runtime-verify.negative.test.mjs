#!/usr/bin/env node
/**
 * Negative tests for the agent/skill runtime loader verification.
 * Prove fail-closed behaviour: a broken frontmatter, a missing delegation
 * target, a missing referenced file, or an adapter/canonical set mismatch
 * must keep the skill unloaded and exit non-zero.
 */
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const VERIFIER = resolve(import.meta.dirname, 'agent-skills-runtime-verify.mjs')
const UTER_ROOT = resolve(import.meta.dirname, '../..')

function runVerifier(env) {
  return spawnSync(process.execPath, [VERIFIER], {
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...process.env, ...env },
  })
}

function makeSandbox() {
  const root = mkdtempSync(join(tmpdir(), 'skills-negative-'))
  cpSync(join(UTER_ROOT, '.agents'), join(root, '.agents'), { recursive: true })
  cpSync(join(UTER_ROOT, '.claude'), join(root, '.claude'), { recursive: true })
  return root
}

let passed = 0

// --- Negative 1: broken frontmatter must keep the skill unloaded ------------
{
  const root = makeSandbox()
  const p = join(root, '.agents/skills/i18n-translate/SKILL.md')
  const body = readFileSync(p, 'utf8').replace('name: i18n-translate', 'name: "i18n\ntranslate')
  writeFileSync(p, body)
  const run = runVerifier({ P13_ROOT: root, UTER_SKILLS_REPORT: join(root, 'report.json') })
  assert.equal(run.status, 1)
  const report = JSON.parse(readFileSync(join(root, 'report.json'), 'utf8'))
  assert.equal(report.verdict, 'NOT_VERIFIED')
  assert.ok(report.problems.some((p) => p.includes('i18n-translate')))
  rmSync(root, { recursive: true, force: true })
  passed++
  console.log('ok 1 - broken frontmatter fails closed')
}

// --- Negative 2: adapter losing the canonical delegation must fail ----------
{
  const root = makeSandbox()
  const p = join(root, '.claude/skills/shadcn-ui/SKILL.md')
  const body = readFileSync(p, 'utf8').replace('.agents/skills/shadcn-ui/SKILL.md', 'nowhere/else.md')
  writeFileSync(p, body)
  const run = runVerifier({ P13_ROOT: root, UTER_SKILLS_REPORT: join(root, 'report.json') })
  assert.equal(run.status, 1)
  const report = JSON.parse(readFileSync(join(root, 'report.json'), 'utf8'))
  assert.equal(report.verdict, 'NOT_VERIFIED')
  assert.ok(report.problems.some((p) => p.includes('does not delegate to canonical')))
  rmSync(root, { recursive: true, force: true })
  passed++
  console.log('ok 2 - missing delegation fails closed')
}

// --- Negative 3: adapter referencing a missing repository file must fail ----
{
  const root = makeSandbox()
  const p = join(root, '.claude/skills/i18n-translate/SKILL.md')
  const body = readFileSync(p, 'utf8').replace(
    'web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json',
    'web/src/i18n/locales/{en,zz-GONE}.json',
  )
  writeFileSync(p, body)
  const run = runVerifier({ P13_ROOT: root, UTER_SKILLS_REPORT: join(root, 'report.json') })
  assert.equal(run.status, 1)
  const report = JSON.parse(readFileSync(join(root, 'report.json'), 'utf8'))
  assert.equal(report.verdict, 'NOT_VERIFIED')
  assert.ok(report.problems.some((p) => p.includes('missing repository files')))
  rmSync(root, { recursive: true, force: true })
  passed++
  console.log('ok 3 - missing referenced file fails closed')
}

// --- Negative 4: adapter set diverging from canonical set must fail ---------
{
  const root = makeSandbox()
  rmSync(join(root, '.claude/skills/vercel-react-best-practices'), { recursive: true, force: true })
  const run = runVerifier({ P13_ROOT: root, UTER_SKILLS_REPORT: join(root, 'report.json') })
  assert.equal(run.status, 1)
  const report = JSON.parse(readFileSync(join(root, 'report.json'), 'utf8'))
  assert.equal(report.verdict, 'NOT_VERIFIED')
  assert.ok(report.problems.some((p) => p.includes('skill sets differ')))
  rmSync(root, { recursive: true, force: true })
  passed++
  console.log('ok 4 - adapter/canonical set divergence fails closed')
}

console.log(`Agent/skills runtime verifier negative tests: ${passed}/4 PASS`)
