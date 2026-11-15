/**
 * 相关模块测试：校验 calc 模块导出完整性与类型，并复核 add / mul 行为。
 */
import assert from 'node:assert/strict';
import * as calc from '../src/calc.mjs';

const __uapDelay = Number(process.env.UAP_E2E_TEST_DELAY_MS || 0);
if (__uapDelay > 0) await new Promise((r) => setTimeout(r, __uapDelay));

assert.equal(typeof calc.add, 'function', 'add 必须是函数');
assert.equal(typeof calc.mul, 'function', 'mul 必须是函数');
assert.equal(calc.add(2, 3), 5, 'add(2,3)');
assert.equal(calc.add(-1, -1), -2, 'add(-1,-1)');
assert.equal(calc.mul(3, 3), 9, 'mul(3,3)');
console.log('E2E_OK module.test.mjs');
