> **DEPRECATED — 本文件不是权威资产**
>
> 本文件是 UAES 规范库早期版本的历史副本，保留仅作 Git 历史与审计参考。
> 依「冲突/重复以 UAES 规范库为准」，权威版本位于 UAES 规范库：
> `quality/acceptance/UAES-P05-ACCEPTANCE-BASELINE.md`、
> `quality/gates/UAES-05-GATE-001-DESIGN-QUALITY-GATE.md`，
> 唯一事实源 `.uaes/STANDARD-REGISTRY.yaml`。不得据此修改或覆盖权威资产。

---

# UAES-P4-ACCEPTANCE-BASELINE — P4 EXPERIENCE AND DESIGN ACCEPTANCE BASELINE

**Standard ID:** UAES-P4-ACCEPTANCE-BASELINE  
**Standard Name:** P4 Experience And Design Acceptance Baseline  
**Version:** 1.0.0  
**Status:** DRAFT  
**Domain:** UAES-05 Experience & Design  
**Phase:** P4  
**Priority:** MUST  
**Classification:** Enterprise Engineering Standard  
**Gate:** UAES-05-GATE-001  
**Acceptance Status:** NOT_ACCEPTED (DRAFT)  

---

## 1. Acceptance Objective

验证 Uter 是否建立了完整的体验与设计工程体系，以及 AI 是否能够在真实工程任务中遵循该体系。

## 2. Acceptance Dimensions

### A. Document Completeness

- UAES-05 总标准完成。
- UAES-05-001 至 UAES-05-013 全部完成。
- 标准 ID 唯一。
- 文件路径登记正确。
- 规范依赖关系有效。
- 规则之间没有未处理冲突。

### B. Design System Governance

- Design Owner 明确。
- Token 权威来源明确。
- 设计系统版本明确。
- 变更审批机制建立。
- 废弃与迁移机制建立。
- 设计决策可追踪。

### C. Design Tokens

- Token 数据源存在。
- Token Schema 校验通过。
- Primitive / Semantic / Component 分层完整。
- 命名规则统一。
- 引用无悬空。
- 无循环引用。
- Light / Dark 主题有效。
- 平台输出可复现。

### D. Visual Foundation

- 品牌色符合批准规范。
- 语义色完整。
- 文字对比度达标。
- 字体体系完整。
- 字号和行高符合规范。
- 最小字号规则已检查。
- 间距 Token 完整。
- 圆角和边框 Token 完整。
- 表面层级符合设计原则。

### E. Component Engineering

- 公共组件已登记。
- 公共组件有契约。
- 变体定义完整。
- 状态定义完整。
- TypeScript 类型检查通过。
- Token 引用正确。
- 组件单元测试通过。
- 关键组件交互测试通过。

### F. Responsive Design

- PC Web 关键页面验证。
- H5 关键页面验证。
- Electron 窗口缩放验证。
- 关键断点验证。
- 无严重横向溢出。
- 无关键内容遮挡。
- 触摸操作可用。
- 安全区域适配完成。

### G. Accessibility

- 关键页面完成自动化扫描。
- 关键组件可键盘操作。
- 焦点可见。
- 焦点顺序合理。
- 表单标签完整。
- 错误信息可识别。
- 动态内容通知合理。
- 关键流程完成辅助技术人工测试。

### H. Visual Regression

- 关键页面基线建立。
- 基线绑定 Commit SHA。
- 测试环境可重复。
- 差异报告可生成。
- 基线审批机制生效。
- 视觉回归可以阻断 CI。

I. AI Execution

- AI 能够读取设计系统。
- AI 能够识别 Token。
- AI 优先复用公共组件。
- AI 不擅自创建设计规则。
- AI 能够执行设计变更分析。
- AI 能够运行规定测试。
- AI 能够输出完整验证证据。

## 3. Acceptance Rules

每个检查项必须使用以下结果：

- PASS
- FAIL
- BLOCKED
- NOT_RUN
- NOT_APPLICABLE
- NOT_VERIFIED

NOT_VERIFIED 和 NOT_RUN 不得计入通过率。

## 4. Phase Acceptance

P4 只有同时满足以下条件才允许通过：

1. 必需标准文件完整。
2. Schema 已实际验证。
3. Token 工具链能够运行。
4. 组件契约和登记机制有效。
5. 关键组件测试通过。
6. 响应式验证通过。
7. 关键无障碍测试通过。
8. 视觉回归机制能够实际运行。
9. Quality Gate 已集成到 CI。
10. 至少完成一次 AI 真实任务验收。
11. 没有未处理的 P0 阻断问题。
12. 所有例外均有正式记录。

## 5. Required Deliverables

- P4 标准文档集合。
- P4 Schema 集合。
- Design System Manifest。
- Token Source。
- Token Build Pipeline。
- Component Registry。
- Component Contracts。
- Accessibility Test Report。
- Responsive Test Report。
- Visual Regression Report。
- Design Quality Gate Report。
- P4 Acceptance Report。

## 6. Acceptance Conclusion

最终结论必须是：

- ACCEPTED
- REJECTED
- CONDITIONALLY_ACCEPTED
- BLOCKED

只有 ACCEPTED 才代表 P4 正式验收通过。

## 7. Acceptance Record

必须记录：

- Acceptance ID。
- Commit SHA。
- Registry Version。
- Design System Version。
- Gate Result。
- Test Evidence。
- Open Risks。
- Exceptions。
- Reviewer。
- Approval Date。

本文件目前为 DRAFT，不代表 P4 已完成工程验收。
