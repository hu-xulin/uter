/**
 * 完整必要测试：聚合契约断言（独立重跑，不依赖其他测试文件的副作用）。
 */
import assert from 'node:assert/strict';
import { add, mul } from '../src/calc.mjs';

const __uapDelay = Number(process.env.UAP_E2E_TEST_DELAY_MS || 0);
if (__uapDelay > 0) await new Promise((r) => setTimeout(r, __uapDelay));

const cases = [
  [2, 3, 5],
  [0, 0, 0],
  [1, -1, 0],
  [2.5, 2.5, 5],
  [10, 20, 30],
];
for (const [a, b, expected] of cases) {
  assert.equal(add(a, b), expected, `add(${a},${b})`);
}
assert.equal(mul(6, 7), 42, 'mul(6,7)');
console.log(`E2E_OK full.test.mjs (${cases.length} add cases + mul)`);
