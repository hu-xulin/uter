# Blocked Items

> 由 `./uap report` 依据真实运行产物生成 · 2026-11-26T11:12:28.388Z · UAP 1.0.0
> 数据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与实时文件系统探测。

## 汇总

共 **6** 条。按来源分组：VALIDATOR=2, AUTH=4。

## 明细

| ID | 级别 | 原因 | 来源 |
| --- | --- | --- | --- |
| VALIDATOR:development.dependency_integrity | BLOCKER | development.dependency_integrity 实检: lockfile=PASS(go.sum=true; go.mod 声明 module=true; web/package.json 可解析=true); vulnerabilities=PASS(本地配置明文密钥命中=0; policy secret_export=deny=true; fail_closed=true; 未运行外部 CVE 库扫描(离线), 不声称无 CVE); unused_dependencies=FAIL(Knip 已执行=true; 零发现/干净退出=false (exit=1, timeout=false, spawn_error=none); 报告尾部=},{"name":"ModelDetails","line":27,"col":3,"pos":1070},{"name":"ModelDetailsContent","line":28,"col":3,"pos":1086}],"files":[],"namespaceMembers":[],"optionalPeerDependencies":[],"subpaths":[],"types":[],"unlisted":[],"unresolved":[]},{"file":"src/stores/auth-store.ts","binaries":[],"catalog":[],"catalogReferences":[],"dependencies":[],"devDependencies":[],"duplicates":[],"enumMembers":[],"exports":[],"files":[],"namespaceMembers":[],"optionalPeerDependencies":[],"subpaths":[],"types":[{"name":"PendingLoginVerification","line":35,"col":3,"pos":1042}],"unlisted":[],"unresolved":[]},{"file":"src/features/auth/types.ts","binaries":[],"catalog":[],"catalogReferences":[],"dependencies":[],"devDependencies":[],"duplicates":[],"enumMembers":[],"exports":[],"files":[],"namespaceMembers":[],"optionalPeerDependencies":[],"subpaths":[],"types":[{"name":"AuthBundle","line":21,"col":15,"pos":807},{"name":"CustomOAuthProviderInfo","line":22,"col":29,"pos":868}],"unlisted":[],"unresolved":[]},{"file":"src/features/usage-logs/components/dialogs/audio-preview-dialog.tsx","binaries":[],"catalog":[],"catalogReferences":[],"dependencies":[],"devDependencies":[],"duplicates":[],"enumMembers":[],"exports":[],"files":[],"namespaceMembers":[],"optionalPeerDependencies":[],"subpaths":[],"types":[{"name":"AudioClip","line":33,"col":15,"pos":1275}],"unlisted":[],"unresolved":[]},{"file":"src/features/organization/api.ts","binaries":[],"catalog":[],"catalogReferences":[],"dependencies":[],"devDependencies":[],"duplicates":[],"enumMembers":[],"exports":[],"files":[],"namespaceMembers":[],"optionalPeerDependencies":[],"subpaths":[],"types":[{"name":"OrgMember","line":127,"col":15,"pos":3250}],"unlisted":[],"unresolved":[]},{"file":"src/design-system/components/typography/index.ts","binaries":[],"catalog":[],"catalogReferences":[],"dependencies":[],"devDependencies":[],"duplicates":[],"enumMembers":[],"exports":[],"files":[],"namespaceMembers":[],"optionalPeerDependencies":[],"subpaths":[],"types":[{"name":"HeadingLevel","line":20,"col":15,"pos":779},{"name":"HeadingProps","line":20,"col":29,"pos":793},{"name":"HeadingVariant","line":20,"col":43,"pos":807},{"name":"TextColor","line":22,"col":15,"pos":885},{"name":"TextProps","line":22,"col":26,"pos":896},{"name":"TextVariant","line":22,"col":37,"pos":907},{"name":"TextWeight","line":22,"col":50,"pos":920}],"unlisted":[],"unresolved":[]}]}; BASELINE.new_dependencies_installed=0(零新增); 无退役 AES/UAES 治理引用=true; go.mod 含 require=true; web scripts 存在=true) \| registryIntegrity 37/37 checks / 0 findings \| evidence_refs 12204 个 \| 真实执行 web/package.json 的 Knip + 读取 Go/前端锁文件与 UAP baseline + 配置明文密钥正则扫描; 未自动删除任何依赖 | VALIDATION-RESULTS.json |
| VALIDATOR:cross_platform.h5_integrity | BLOCKER | cross_platform.h5_integrity 实检: h5_build=FAIL(矩阵工具自身故障(exit=1, stderr=) — fail-closed) \| registryIntegrity 37/37 checks / 0 findings \| evidence_refs 12213 个 \| FAIL: 工具故障视为能力失败( fail-closed ), 不归为环境受限 | VALIDATION-RESULTS.json |
| AUTH:production_deploy | BLOCKED_BY_DESIGN | requires explicit production authorization; UAP performs local simulation only | .uap/config/permission-policy.yaml |
| AUTH:production_database_write | BLOCKED_BY_DESIGN | requires explicit production authorization; UAP performs local simulation only | .uap/config/permission-policy.yaml |
| AUTH:real_payment | BLOCKED_BY_DESIGN | requires explicit production authorization; UAP performs local simulation only | .uap/config/permission-policy.yaml |
| AUTH:real_refund | BLOCKED_BY_DESIGN | requires explicit production authorization; UAP performs local simulation only | .uap/config/permission-policy.yaml |


## 生产授权事项

生产发布、生产数据库写入、真实支付、真实退款、密钥导出均因缺少显式生产授权而记录为 BLOCKED。UAP 已完成本地模拟与源码级验证，不擅自执行。
