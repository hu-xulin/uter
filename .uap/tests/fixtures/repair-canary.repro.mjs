/**
 * 金丝雀缺陷的复现探针：契约要求 add(2,3) === 5（加法）。
 * 金丝雀处于提交态缺陷（a*b）时本探针失败 → 修复引擎据此执行真实修复。
 */
import assert from 'node:assert/strict'
import { add } from './repair-canary.mjs'

assert.equal(add(2, 3), 5, 'add() 必须返回两数之和')
console.log('repair-canary repro PASS')
