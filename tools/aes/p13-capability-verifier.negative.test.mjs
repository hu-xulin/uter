#!/usr/bin/env node
/**
 * Negative tests for the P13 capability verifier.
 *
 * These tests prove the verifier is fail-closed: a tampered or incomplete
 * mapping, a missing implementation path, or a failing verifier command must
 * never produce a PASS verdict, and the process must exit non-zero.
 */
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const VERIFIER = resolve(import.meta.dirname, 'p13-capability-verifier.mjs')

function runVerifier(env) {
  return spawnSync(process.execPath, [VERIFIER], {
    encoding: 'utf8',
    timeout: 10 * 60 * 1000,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, ...env },
  })
}

function makeSandbox(name) {
  const root = mkdtempSync(join(tmpdir(), `p13-negative-${name}-`))
  return root
}

// --- Negative 1: mapping missing one requirement row must fail closed -------
{
  const root = makeSandbox('missing-row')
  const fs = await import('node:fs')
  const mappingSrc = resolve(import.meta.dirname, '../../.aes/UTER-P13-CAPABILITY-MAPPING.md')
  const mapping = readFileSync(mappingSrc, 'utf8')
    .split('\n')
    .filter((l) => !l.startsWith('| P13-05-CAP-07 '))
    .join('\n')
  const mappingPath = join(root, 'mapping.md')
  fs.writeFileSync(mappingPath, mapping)
  const run = runVerifier({
    P13_ROOT: root,
    P13_MAPPING_PATH: mappingPath,
    P13_OUTPUT_PATH: join(root, 'report.json'),
    P13_EVIDENCE_DIR: join(root, 'evidence'),
  })
  assert.equal(run.status, 1, 'verifier must exit non-zero on an incomplete mapping')
  const report = JSON.parse(fs.readFileSync(join(root, 'report.json'), 'utf8'))
  assert.equal(report.verdict, 'NOT_VERIFIED')
  assert.equal(report.verified_count, 0)
  assert.match(report.structural_error, /missing P13-05-CAP-07/)
  rmSync(root, { recursive: true, force: true })
  console.log('ok 1 - incomplete mapping fails closed (exit 1, verified_count=0)')
}

// --- Negative 2: duplicate requirement rows must fail closed ----------------
{
  const root = makeSandbox('duplicate-row')
  const mappingSrc = resolve(import.meta.dirname, '../../.aes/UTER-P13-CAPABILITY-MAPPING.md')
  const lines = readFileSync(mappingSrc, 'utf8').split('\n')
  const dupeIndex = lines.findIndex((l) => l.startsWith('| P13-02-CAP-03 '))
  lines.splice(dupeIndex, 0, lines[dupeIndex])
  const fs = await import('node:fs')
  const mappingPath = join(root, 'mapping.md')
  fs.writeFileSync(mappingPath, lines.join('\n'))
  const run = runVerifier({
    P13_ROOT: root,
    P13_MAPPING_PATH: mappingPath,
    P13_OUTPUT_PATH: join(root, 'report.json'),
    P13_EVIDENCE_DIR: join(root, 'evidence'),
  })
  assert.equal(run.status, 1, 'verifier must exit non-zero on duplicate rows')
  const report = JSON.parse(fs.readFileSync(join(root, 'report.json'), 'utf8'))
  assert.equal(report.verdict, 'NOT_VERIFIED')
  assert.match(report.structural_error, /duplicate requirement row/)
  rmSync(root, { recursive: true, force: true })
  console.log('ok 2 - duplicate rows fail closed')
}

// --- Negative 3: truncated normative statement must fail closed -------------
{
  const root = makeSandbox('short-statement')
  const mappingSrc = resolve(import.meta.dirname, '../../.aes/UTER-P13-CAPABILITY-MAPPING.md')
  const mapping = readFileSync(mappingSrc, 'utf8').replace(
    '| P13-06-CAP-02 | authoritative requirement | 入账必须由订单状态机驱动并使用下单时金额快照；任何路径不得绕过金额校验直接修改余额。',
    '| P13-06-CAP-02 | authoritative requirement | 入账。',
  )
  const fs = await import('node:fs')
  const mappingPath = join(root, 'mapping.md')
  fs.writeFileSync(mappingPath, mapping)
  const run = runVerifier({
    P13_ROOT: root,
    P13_MAPPING_PATH: mappingPath,
    P13_OUTPUT_PATH: join(root, 'report.json'),
    P13_EVIDENCE_DIR: join(root, 'evidence'),
  })
  assert.equal(run.status, 1, 'verifier must exit non-zero on a trivial normative statement')
  const report = JSON.parse(fs.readFileSync(join(root, 'report.json'), 'utf8'))
  assert.equal(report.verdict, 'NOT_VERIFIED')
  assert.match(report.structural_error, /normative statement too short/)
  rmSync(root, { recursive: true, force: true })
  console.log('ok 3 - trivial normative statement fails closed')
}

// --- Negative 4: in an empty root every requirement stays NOT_VERIFIED ------
{
  const root = makeSandbox('empty-root')
  const fs = await import('node:fs')
  const run = runVerifier({
    P13_ROOT: root,
    P13_MAPPING_PATH: join(root, 'no-such-mapping.md'),
    P13_OUTPUT_PATH: join(root, 'report.json'),
    P13_EVIDENCE_DIR: join(root, 'evidence'),
  })
  assert.equal(run.status, 1, 'missing mapping file must fail closed')
  const report = JSON.parse(fs.readFileSync(join(root, 'report.json'), 'utf8'))
  assert.equal(report.verdict, 'NOT_VERIFIED')
  assert.match(report.structural_error, /mapping file missing/)
  rmSync(root, { recursive: true, force: true })
  console.log('ok 4 - missing mapping file fails closed')
}

console.log('P13 capability verifier negative tests: 4/4 PASS')
