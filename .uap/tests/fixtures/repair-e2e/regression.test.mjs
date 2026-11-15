/**
 * 新增回归测试：验证 add 的其他输入，以及既有正确行为 mul 未被修复破坏。
 */
import assert from 'node:assert/strict';
import { add, mul } from '../src/calc.mjs';

const __uapDelay = Number(process.env.UAP_E2E_TEST_DELAY_MS || 0);
if (__uapDelay > 0) await new Promise((r) => setTimeout(r, __uapDelay));

assert.equal(add(0, 5), 5, 'add(0,5)');
assert.equal(add(-2, 3), 1, 'add(-2,3)');
assert.equal(add(7, 8), 15, 'add(7,8)');
assert.equal(add(100, 200), 300, 'add(100,200)');
assert.equal(mul(2, 3), 6, 'mul(2,3) 既有行为不得被破坏');
assert.equal(mul(-4, 5), -20, 'mul(-4,5)');
console.log('E2E_OK regression.test.mjs');
