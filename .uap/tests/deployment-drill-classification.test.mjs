import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyDeploymentRehearsal } from '../validators/delivery/index.mjs';

const preflightBlock = {
  blocked: true,
  reason: 'preflight: real release artifacts incomplete',
  steps: [{ name: 'preflight_artifacts', ok: false }],
  verdict: { deployment_plan: 'FAIL', rollback_plan: 'FAIL', health_check: 'FAIL' },
};

test('only an explicit current-invocation preflight result is BLOCKED', () => {
  const result = classifyDeploymentRehearsal(
    { exit_code: 1, spawn_error: null, timed_out: false },
    preflightBlock,
  );
  assert.equal(result.status, 'BLOCKED');
});

test('spawn errors, timeouts, malformed output and stale report data are FAIL', () => {
  assert.equal(classifyDeploymentRehearsal(
    { exit_code: null, spawn_error: 'ENOENT', timed_out: false }, preflightBlock,
  ).status, 'FAIL');
  assert.equal(classifyDeploymentRehearsal(
    { exit_code: 1, spawn_error: null, timed_out: true }, preflightBlock,
  ).status, 'FAIL');
  assert.equal(classifyDeploymentRehearsal(
    { exit_code: 1, spawn_error: null, timed_out: false },
    { blocked: true, reason: 'preflight: real release artifacts incomplete', error: 'tool crashed' },
  ).status, 'FAIL');
  assert.equal(classifyDeploymentRehearsal(
    { exit_code: 1, spawn_error: null, timed_out: false }, null,
  ).status, 'FAIL');
  assert.equal(classifyDeploymentRehearsal(
    { exit_code: 1, spawn_error: null, timed_out: false },
    { blocked: true, reason: 'environment missing', steps: [] },
  ).status, 'FAIL');
});

test('a successful tool invocation requires a structured verdict', () => {
  assert.equal(classifyDeploymentRehearsal(
    { exit_code: 0, spawn_error: null, timed_out: false },
    { verdict: { deployment_plan: 'PASS', rollback_plan: 'PASS', health_check: 'PASS' } },
  ).status, 'EXECUTED');
  assert.equal(classifyDeploymentRehearsal(
    { exit_code: 0, spawn_error: null, timed_out: false }, { error: 'failed' },
  ).status, 'FAIL');
});
