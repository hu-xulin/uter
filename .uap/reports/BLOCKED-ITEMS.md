# Blocked Items

> 由 `./uap report` 依据真实运行产物生成 · 2026-11-27T12:03:01.546Z · UAP 1.0.0
> 数据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与实时文件系统探测。

## 汇总

共 **5** 条。按来源分组：VALIDATOR=1, AUTH=4。

## 明细

| ID | 级别 | 原因 | 来源 |
| --- | --- | --- | --- |
| VALIDATOR:development.dependency_integrity | BLOCKER | development.dependency_integrity 实检: lockfile=PASS(go.sum=true; go.mod 声明 module=true; web/package.json 可解析=true); vulnerabilities=PASS(本地配置明文密钥命中=0; policy secret_export=deny=true; fail_closed=true; 未运行外部 CVE 库扫描(离线), 不声称无 CVE); unused_dependencies=FAIL(Knip 已执行=true; 零发现/干净退出=false (exit=1, timeout=false, spawn_error=none); 报告尾部={"issues":[{"file":"src/features/pricing/constants.ts","binaries":[],"catalog":[],"catalogReferences":[],"dependencies":[],"devDependencies":[],"duplicates":[],"enumMembers":[],"exports":[{"name":"getSortLabels","line":49,"col":17,"pos":1816}],"files":[],"namespaceMembers":[],"optionalPeerDependencies":[],"subpaths":[],"types":[],"unlisted":[],"unresolved":[]}]}; BASELINE.new_dependencies_installed=0(零新增); 无退役 AES/UAES 治理引用=true; go.mod 含 require=true; web scripts 存在=true) \| registryIntegrity 37/37 checks / 0 findings \| evidence_refs 12799 个 \| 真实执行 web/package.json 的 Knip + 读取 Go/前端锁文件与 UAP baseline + 配置明文密钥正则扫描; 未自动删除任何依赖 | VALIDATION-RESULTS.json |
| AUTH:production_deploy | BLOCKED_BY_DESIGN | requires explicit production authorization; UAP performs local simulation only | .uap/config/permission-policy.yaml |
| AUTH:production_database_write | BLOCKED_BY_DESIGN | requires explicit production authorization; UAP performs local simulation only | .uap/config/permission-policy.yaml |
| AUTH:real_payment | BLOCKED_BY_DESIGN | requires explicit production authorization; UAP performs local simulation only | .uap/config/permission-policy.yaml |
| AUTH:real_refund | BLOCKED_BY_DESIGN | requires explicit production authorization; UAP performs local simulation only | .uap/config/permission-policy.yaml |


## 生产授权事项

生产发布、生产数据库写入、真实支付、真实退款、密钥导出均因缺少显式生产授权而记录为 BLOCKED。UAP 已完成本地模拟与源码级验证，不擅自执行。
