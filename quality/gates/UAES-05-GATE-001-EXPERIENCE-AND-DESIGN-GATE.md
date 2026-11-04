# UAES-05-GATE-001 — EXPERIENCE AND DESIGN QUALITY GATE

**Standard ID:** UAES-05-GATE-001  
**Standard Name:** Experience And Design Quality Gate  
**Version:** 1.0.0  
**Status:** DRAFT  
**Domain:** UAES-05 Experience & Design  
**Phase:** P4  
**Priority:** MUST  
**Classification:** Enterprise Engineering Standard  
**Gate Level:** G0-G6  
**Related Baseline:** UAES-P4-ACCEPTANCE-BASELINE  

---

## 1. Purpose

将 P4 设计工程规范转化为实际可执行的质量检查机制。

本 Gate 是设计系统、Token、组件、页面、无障碍和视觉回归的统一验收入口。

## 2. Gate Levels

### G0 — Registry and Governance

检查：

- P4 标准登记完整。
- 设计系统 Manifest 存在。
- Design Owner 已指定。
- Token 权威来源明确。
- 设计系统版本明确。
- 变更审批机制存在。

### G1 — Design Tokens

检查：

- Token Schema。
- Token 命名。
- Token 类型。
- Alias 引用。
- 循环引用。
- 未登记 Token。
- Light / Dark 主题。
- 平台生成结果。

### G2 — Visual Foundation

检查：

- 品牌色。
- 语义颜色。
- 对比度。
- 字体族。
- 字号和行高。
- 间距。
- 圆角。
- 边框。
- 表面层级。

### G3 — Component Engineering

检查：

- 组件登记。
- Component Contract。
- API 类型。
- 变体。
- 交互状态。
- Token 使用。
- 组件复用。
- 单元测试。
- 交互测试。

### G4 — Responsive and Accessibility

检查：

- 关键视口。
- 横向溢出。
- 内容遮挡。
- 触摸目标。
- 键盘操作。
- 焦点管理。
- Accessible Name。
- 错误提示。
- 自动无障碍扫描。
- 人工辅助技术测试。

### G5 — Visual Regression

检查：

- 基准截图。
- Commit SHA。
- 测试环境。
- 视觉差异。
- 差异审批。
- 动态区域屏蔽规则。
- 关键页面覆盖。

### G6 — AI Compliance

检查：

- AI 是否读取设计规范。
- 是否使用批准 Token。
- 是否优先复用公共组件。
- 是否遵守字号和布局约束。
- 是否保留无障碍能力。
- 是否提供测试证据。
- 是否存在未经批准的设计变更。

## 3. Severity

| Severity | Description | Gate Impact |
| --- | --- | --- |
| P0 | 核心品牌、严重无障碍、关键界面不可用、权威 Token 冲突 | BLOCK |
| P1 | 公共组件契约破坏、关键页面严重偏差、重要交互缺陷 | BLOCK |
| P2 | 一般视觉偏差、局部一致性问题 | 按范围评估 |
| P3 | 轻微视觉优化建议 | 不单独阻断 |

安全和无障碍相关缺陷不得因为视觉效果良好而降级。

## 4. Gate Result

结果只能是：

- PASS
- FAIL
- BLOCKED
- NOT_RUN
- NOT_APPLICABLE

不得把 NOT_RUN 当作 PASS。

## 5. Blocking Conditions

以下情况必须阻断：

1. Token 源数据不可验证。
2. Token 引用存在循环或悬空。
3. 未批准的品牌色修改进入正式实现。
4. 公共组件存在关键键盘操作缺陷。
5. 关键页面存在严重内容遮挡。
6. 关键交互缺少可访问名称。
7. 未经批准覆盖视觉基线。
8. P0 设计违规未处理。
9. 关键测试未运行却报告通过。
10. 未授权修改设计系统权威资产。

## 6. Required Evidence

每次 Gate 必须记录：

- Commit SHA。
- Design System Version。
- Token Validation Report。
- Component Contract Report。
- Accessibility Report。
- Responsive Test Report。
- Visual Regression Report。
- Findings。
- Exceptions。
- Final Result。

## 7. Gate Execution

建议 CI 顺序：

```text
Registry Validation
  ↓
JSON Schema Validation
  ↓
Token Reference Validation
  ↓
Design Token Build
  ↓
TypeScript / Lint
  ↓
Component Tests
  ↓
Accessibility Tests
  ↓
Responsive Tests
  ↓
Visual Regression
  ↓
Gate Aggregation
  ↓
PASS / FAIL / BLOCKED
```

## 8. Exceptions

任何例外必须关联 Exception ID、责任人、审批记录、风险、到期时间和修复计划。

P0 阻断条件不得通过普通例外绕过。

## 9. Acceptance Criteria

- Gate 能独立执行。
- 每项检查有明确结果。
- 失败能够阻断 CI。
- 报告关联 Commit SHA。
- 所有例外可追踪。
- 未执行的检查不能伪装成通过。
- 人工检查和自动化检查明确区分。

## 10. Related Standards

UAES-05 至 UAES-05-013。
