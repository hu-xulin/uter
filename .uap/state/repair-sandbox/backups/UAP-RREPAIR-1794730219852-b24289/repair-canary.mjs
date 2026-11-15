/**
 * 修复金丝雀（repair canary）—— 独立复核链路的真实性锚点。
 *
 * ⚠ 本文件的「缺陷版本」是刻意提交的：`add()` 按注释契约应返回两数之和，
 *   但实现写成 `a * b`。它存在的唯一目的，是让修复引擎（real-code-repair.mjs）
 *   在任意 git HEAD 上都能执行一次真实修复事件，从而产生绑定当前 HEAD 的
 *   修复账本（ledger），供 independent-review.mjs 的 fail-closed 校验
 *   （git_head_matches）通过。历史账本在任何新提交后都会过期，这是设计使然。
 *
 * 规则：
 *  - 严禁手工「修复」本文件 —— 那会让金丝雀失去缺陷态，复核链路 fail-closed。
 *  - 修复引擎每次运行会把修复后的内容写进工作区；测试结束前会用
 *    `git checkout -- 本文件` 恢复提交态缺陷（本文件是 UAP 专用 fixture，
 *    提交态即缺陷态，不可能包含任何用户 WIP，因此该恢复是确定性的）。
 */
export function add(a, b) {
  return a * b;
}
