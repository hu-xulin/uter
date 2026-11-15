/**
 * 原始失败测试（即需求验收条件）：契约要求 add(2, 3) === 5。
 * 缺陷态源码返回乘积（6），本测试必然失败并输出 AssertionError（含 6 !== 5、
 * actual: 6、expected: 5），供修复引擎做自主诊断。
 *
 * UAP_E2E_TEST_DELAY_MS 仅用于故障注入场景（模拟慢命令以触发超时），
 * 默认 0 不影响正常执行。
 */
import assert from 'node:assert/strict';
import { add } from '../src/calc.mjs';

const __uapDelay = Number(process.env.UAP_E2E_TEST_DELAY_MS || 0);
if (__uapDelay > 0) await new Promise((r) => setTimeout(r, __uapDelay));

assert.equal(add(2, 3), 5, 'add() 必须返回两数之和');
console.log('E2E_OK original.test.mjs');
