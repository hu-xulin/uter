import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { allOperationalCapabilitiesProven } from '../tools/final-acceptance-gate.mjs';

const REQUIRED = [
  'real_code_repair',
  'independent_regression',
  'recovery',
  'e2e',
  'database_integration',
  'financial_integrity',
];

describe('final acceptance operational capability contract', () => {
  test('requires all six canonical runtime capabilities', () => {
    assert.equal(allOperationalCapabilitiesProven(Object.fromEntries(REQUIRED.map((key) => [key, true]))), true);
    assert.equal(allOperationalCapabilitiesProven({ real_code_repair: true, independent_regression: true }), false);
  });

  test('a missing, false, null, or non-boolean capability fails closed', () => {
    for (const key of REQUIRED) {
      const capabilities = Object.fromEntries(REQUIRED.map((name) => [name, true]));
      capabilities[key] = false;
      assert.equal(allOperationalCapabilitiesProven(capabilities), false, key);
      capabilities[key] = null;
      assert.equal(allOperationalCapabilitiesProven(capabilities), false, key);
      capabilities[key] = 'true';
      assert.equal(allOperationalCapabilitiesProven(capabilities), false, key);
    }
  });

  test('extra capability fields cannot compensate for a missing required capability', () => {
    const capabilities = Object.fromEntries(REQUIRED.map((key) => [key, true]));
    delete capabilities.financial_integrity;
    capabilities.other_unrelated_capability = true;
    assert.equal(allOperationalCapabilitiesProven(capabilities), false);
  });
});
