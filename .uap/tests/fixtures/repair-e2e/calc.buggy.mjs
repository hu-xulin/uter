/**
 * 端到端修复沙箱的「真实源代码」（缺陷态）。
 *
 * 契约：add(a, b) 返回两数之和；mul(a, b) 返回两数之积（既有正确行为）。
 * add 当前实现存在缺陷，由修复引擎自行定位与修复。
 *
 * 本文件刻意不包含修复答案（不写 a + b 之类字面量）；修复只能由
 * 「失败测试输出诊断 + 本文件源码扫描 + 候选变换试跑」推导得出。
 */
export function add(a, b) {
  return a * b;
}

export function mul(a, b) {
  return a * b;
}
