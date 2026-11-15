# Blocked Items

> 由 `./uap report` 依据真实运行产物生成 · 2026-11-15T02:15:29.218Z · UAP 1.0.0
> 数据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与实时文件系统探测。

## 汇总

共 **9** 条。按来源分组：VALIDATOR=3, UAP-DEFECT-0005=1, UAP-DEFECT-0006=1, AUTH=4。

## 明细

| ID | 级别 | 原因 | 来源 |
| --- | --- | --- | --- |
| VALIDATOR:quality.test_integrity | BLOCKED | quality.test_integrity 实检: test_execution=FAIL(缺少 /Users/lincolnhu/uter/.uap/reports/TEST-RUNS.json); failure_propagation=FAIL(缺少 /Users/lincolnhu/uter/.uap/reports/TEST-RUNS.json); evidence=FAIL(缺少 /Users/lincolnhu/uter/.uap/reports/TEST-RUNS.json) \| registryIntegrity 37/37 checks / 0 findings \| evidence_refs 7315 个 \| 报告 /Users/lincolnhu/uter/.uap/reports/TEST-RUNS.json 不存在, 未自行创建 -> BLOCKED; 绝不因"未发现失败"而判 PASS | VALIDATION-RESULTS.json |
| VALIDATOR:cross_platform.h5_integrity | BLOCKER | cross_platform.h5_integrity 实检: h5_build=PASS(真实浏览器矩阵 verdict.h5_build=PASS (25 行(5 视口 x 5 路由), 全部真实渲染=true)); viewport=PASS(真实浏览器矩阵 verdict.viewport=PASS (meta viewport + 横向溢出 0: 0 行溢出)); touch=FAIL(真实浏览器矩阵 verdict.touch=FAIL (真实触屏 tap 派发 + WCAG 2.5.8 24x24 硬线违规 <24=12 个(含等效命中区/豁免判定); 44x44 推荐以下=164 个如实记录(设计系统 §15.3 非强制))); mobile_tests=PASS(真实浏览器矩阵 verdict.mobile_tests=PASS (matrix_rows=25, rendered=25, 控制台/页面错误行=0)) \| registryIntegrity 37/37 checks / 0 findings \| evidence_refs 7315 个 \| 真实 Playwright Chromium 矩阵(5 视口 x 5 路由), 产物 .uap/reports/H5-BROWSER-MATRIX.json 存在=true; verdict={"h5_build":"PASS","viewport":"PASS","touch":"FAIL","mobile_tests":"PASS"} | VALIDATION-RESULTS.json |
| VALIDATOR:delivery.deployment_integrity | BLOCKER | delivery.deployment_integrity 实检: deployment_plan=FAIL(授权在案(AUTH-DEPLOY-2026-11-12)但演练工具故障(exit=1, stderr=) — fail-closed FAIL) \| registryIntegrity 37/37 checks / 0 findings \| evidence_refs 7315 个 \| FAIL: 授权有效但演练未能执行, 按能力失败处理(不归为环境受限) | VALIDATION-RESULTS.json |
| UAP-DEFECT-0005 | P1 | cross_platform.h5_integrity: FAIL | DEFECT-REGISTRY.json |
| UAP-DEFECT-0006 | P1 | delivery.deployment_integrity: FAIL | DEFECT-REGISTRY.json |
| AUTH:production_deploy | BLOCKED_BY_DESIGN | requires explicit production authorization; UAP performs local simulation only | .uap/config/permission-policy.yaml |
| AUTH:production_database_write | BLOCKED_BY_DESIGN | requires explicit production authorization; UAP performs local simulation only | .uap/config/permission-policy.yaml |
| AUTH:real_payment | BLOCKED_BY_DESIGN | requires explicit production authorization; UAP performs local simulation only | .uap/config/permission-policy.yaml |
| AUTH:real_refund | BLOCKED_BY_DESIGN | requires explicit production authorization; UAP performs local simulation only | .uap/config/permission-policy.yaml |


## 生产授权事项

生产发布、生产数据库写入、真实支付、真实退款、密钥导出均因缺少显式生产授权而记录为 BLOCKED。UAP 已完成本地模拟与源码级验证，不擅自执行。
