# 最终证据索引

- **Document:** `12/14` of §11 (14 mandated deliverables)
- **Generated:** 2026-11-06T17:41:59Z
- **Uter commit SHA:** `ec6501adceb008d46140a7e5ab6508eb78006731`
- **UAES commit SHA:** `0c9386b192090e901ccc5de6df1f2aebe3f5c618`
- **Execution environment:** macOS-26.7.2-x86_64-i386-64bit-Mach-O
- **Collector:** WorkBuddy (Tencent Hunyuan Hy)
- **Evidence root:** `reports/compliance/full-conformance-audit-2026-11-06/evidence/`

> 本文件由真实仓库状态与真实命令退出码生成。未执行的验证一律记为 `NOT_RUN` / `BLOCKED`，
> 绝不以文档、代码改动或 Agent 自述代替工程验证（§12 / §13）。

---


本索引列出 143 个证据文件与 13 份交付物的
SHA-256、字节数、Commit SHA、执行环境、工具版本、命令、原始结果位置、
Finding ID 与复测记录。机器可读版本：`evidence/09-evidence-index.json`；
完整性清单：`evidence/10-evidence-closure.json`。

## 自指边界

索引与完整性清单不能哈希自身，以下文件从清单中排除并显式声明：
`12-FINAL-EVIDENCE-INDEX.md, evidence/09-evidence-index.json, evidence/10-evidence-closure.json`。最终 evidence index 报告本身也排除。

## 证据文件（前 200 条，全量见 JSON）

| 路径 | SHA-256 | bytes | 命令 / exit |
|---|---|---|---|
| evidence/00-baseline.json | `221e6ee3a81ca2042024…` | 30068 | — |
| evidence/01-conflict-register.json | `ac799e13243940f8eb13…` | 4425 | — |
| evidence/02-compliance-matrix.json | `7ceee8fe167ab218f4bc…` | 5703922 | — |
| evidence/03-domain-audits.json | `1c7cdf9a694c206d8dea…` | 4060 | — |
| evidence/04-engineering-verification.json | `3b920ab20ca7dbec581d…` | 47076 | — |
| evidence/05-agent-verification.json | `0764f9a0216cc2127bc6…` | 10278 | — |
| evidence/06-gates-verification.json | `9d94ce720ff416145f0d…` | 13117 | — |
| evidence/07-findings-register.json | `ca80b520eeb9503de75d…` | 15208 | — |
| evidence/08-remediation-register.json | `6b5a2a45c0da215ecd39…` | 8537 | — |
| evidence/10-final-assessment.json | `465c48b235978191b6f1…` | 3604 | — |
| evidence/agent/00-branch-switch-wip-preserved.txt | `c3310de2af940c02a125…` | 7917 | — |
| evidence/agent/AG-04-denials.json | `437c805e0143e43e51e3…` | 2306 | — |
| evidence/agent/AG-05-delivery-denials.json | `46403f34d366cbfd7a03…` | 841 | — |
| evidence/agent/agent-runtime-preflight.json | `d0a89c665304ba437d75…` | 3372 | — |
| evidence/agent/agent-runtime-selftest.json | `0b1e33e3623dcf28184e…` | 6649 | — |
| evidence/agent/agent-runtime-test-execution.json | `14bb39ac8c86a723292d…` | 1844 | — |
| evidence/agent/agent-runtime-workspace.json | `e48ac755e7b7cf50ae63…` | 1448 | — |
| evidence/agent/fixtures/agent-verify-commands.txt | `50f086a184e1d5ad288a…` | 153 | — |
| evidence/agent/fixtures/task-bypass-attempt.json | `b81533414527bd859d83…` | 15369 | — |
| evidence/agent/fixtures/task-missing-applicability.json | `ef9bf69ab9f3319fe4da…` | 4069 | — |
| evidence/agent/fixtures/uaes-registry-version-drift.yaml | `2cdf259fc8aece0874c8…` | 96421 | — |
| evidence/agent-runtime-task.json | `5b41ba236f5ff5c183cf…` | 7589 | — |
| evidence/bugfix/02-compliance-matrix.AFTER.json | `51d3d8d99604f55cfbff…` | 6292457 | — |
| evidence/bugfix/02-compliance-matrix.BEFORE.json | `7f949a39628c8fbd0333…` | 3176301 | — |
| evidence/bugfix/05-agent-verification.AFTER.json | `3e6b077488270375639f…` | 10272 | — |
| evidence/bugfix/05-agent-verification.BEFORE.json | `3df730313205fca6dbcf…` | 10242 | — |
| evidence/gates/fixtures/ARCHITECTURE_GATE-nonconforming-state.json | `772f816697017036804f…` | 206167 | — |
| evidence/gates/fixtures/BUSINESS_ACCEPTANCE_GATE-nonconforming-state.json | `cfb39f6d2b8b10290aaa…` | 206156 | — |
| evidence/gates/fixtures/CHANGE_GATE-nonconforming-state.json | `2204a91e0982f9440034…` | 206150 | — |
| evidence/gates/fixtures/CODE_REVIEW_GATE-nonconforming-state.json | `70a2bc3703843e137ff4…` | 206203 | — |
| evidence/gates/fixtures/GLOBAL_UAES_CONFORMANCE_GATE-nonconforming-state.json | `f080fac3a875031138e8…` | 206117 | — |
| evidence/gates/fixtures/RELEASE_GATE-nonconforming-state.json | `4d9da4400216f4cd5000…` | 206147 | — |
| evidence/gates/fixtures/SECURITY_GATE-nonconforming-state.json | `923c406d507a28449622…` | 206150 | — |
| evidence/gates/fixtures/TESTING_GATE-nonconforming-state.json | `8817b351bdd55f67b2e4…` | 206150 | — |
| evidence/matrix-export.csv | `590b4717230243843b18…` | 3037247 | — |
| evidence/raw/AG-01-preflight.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/AG-01-preflight.log | `c61cb2bc3511518b5dfc…` | 7923 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb preflight --task /Users/lincolnhu/uter/reports/co |
| evidence/raw/AG-02-spec-drift.exit | `4355a46b19d348dc2f57…` | 2 | — |
| evidence/raw/AG-02-spec-drift.log | `9f709dc286ecbe5d0f28…` | 8036 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb preflight --task /Users/lincolnhu/uter/reports/co |
| evidence/raw/AG-03-empty-applicability.exit | `4355a46b19d348dc2f57…` | 2 | — |
| evidence/raw/AG-03-empty-applicability.log | `62fa5e4de4b6b158cce7…` | 3920 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb preflight --task /Users/lincolnhu/uter/reports/co |
| evidence/raw/AG-04-deny-01.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-04-deny-01.log | `dc1fe56020e994fa2a02…` | 532 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action git.push.main --profile pull_r |
| evidence/raw/AG-04-deny-02.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-04-deny-02.log | `9ea09fc588a2e766bcf8…` | 559 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action git.pull_request.merge --profi |
| evidence/raw/AG-04-deny-03.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-04-deny-03.log | `dab087f0d3d823108027…` | 520 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action git.merge --profile pull_reque |
| evidence/raw/AG-04-deny-04.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-04-deny-04.log | `397c3f7b4e3a8b3487b9…` | 568 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action production.database.write --pr |
| evidence/raw/AG-04-deny-05.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-04-deny-05.log | `3e7a8119fbb0c4130a9d…` | 574 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action payment.configuration.write -- |
| evidence/raw/AG-04-deny-06.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-04-deny-06.log | `d6cceabb0aea15045e3a…` | 595 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action overwrite.user_uncommitted_cha |
| evidence/raw/AG-04-deny-07.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-04-deny-07.log | `7cf6657a41917577df4f…` | 574 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action falsify.verification_result -- |
| evidence/raw/AG-04-deny-08.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-04-deny-08.log | `345efe5b2ebad2e0248b…` | 581 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action production.secrets.read --prof |
| evidence/raw/AG-04-deny-09.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-04-deny-09.log | `349a0b2a01cbb316d236…` | 535 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action git.reset.hard --profile pull_ |
| evidence/raw/AG-04-deny-10.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-04-deny-10.log | `784bbdcceeecb2688cd8…` | 559 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action git.restore.user_files --profi |
| evidence/raw/AG-05-gate-01.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-05-gate-01.log | `d2bc22a209b9294a58d0…` | 597 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action git.commit --profile pull_requ |
| evidence/raw/AG-05-gate-02.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-05-gate-02.log | `a73910ad77412ac282a4…` | 623 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action git.push.feature_branch --prof |
| evidence/raw/AG-05-gate-03.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-05-gate-03.log | `fc1026f5339c251c0f4d…` | 623 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action git.pull_request.create --prof |
| evidence/raw/AG-06-allow-read.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/AG-06-allow-read.log | `717d21310934adfe5afd…` | 508 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action filesystem.read --profile read |
| evidence/raw/AG-07-alternate-path.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/AG-07-alternate-path.log | `f3e5fddac820364aad25…` | 832 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb workspace --task /Users/lincolnhu/uter/reports/co |
| evidence/raw/AG-07-prompt-bypass.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-07-prompt-bypass.log | `c4edd27e18072b3a50c4…` | 565 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action git.push.main --profile pull_r |
| evidence/raw/AG-07-task-switch.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-07-task-switch.log | `defcb733a7defbade26b…` | 574 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action git.pull_request.merge --profi |
| evidence/raw/AG-08-selftest.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/AG-08-selftest.log | `7208b7eaf587edd619b9…` | 1638 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb selftest  \|  exit_code=0 |
| evidence/raw/AG-09-real-task.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/AG-09-real-task.log | `eca218119c1161323742…` | 748 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb verify --commands /Users/lincolnhu/uter/reports/c |
| evidence/raw/AG-10-ci-denial-loop.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/AG-10-ci-denial-loop.log | `bc7937c67ca637314319…` | 1480 |   \|  exit_code=0 |
| evidence/raw/EV-00-PROBE.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-00-PROBE.log | `b714a6bf08faa3421b33…` | 1363 |   \|  exit_code=0 |
| evidence/raw/EV-01.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-01.log | `a05fbcc9fd52d5a4e833…` | 359 | bash scripts/quality/ai-specs-check.sh  \|  exit_code=0 |
| evidence/raw/EV-02.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-02.log | `8f216c3df42426d56f7e…` | 955 | ruby scripts/quality/test-ai-governance-policy.rb  \|  exit_code=0 |
| evidence/raw/EV-03.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-03.log | `094903adb4c7a4b2ebde…` | 666 | bash scripts/quality/uaes-pin-check.sh  \|  exit_code=0 |
| evidence/raw/EV-04.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-04.log | `01cf9933a92c9ba71cf1…` | 394 | ruby scripts/quality/test-uaes-pin-check.rb  \|  exit_code=0 |
| evidence/raw/EV-05.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-05.log | `ad5d1f7dc2cd63f33b66…` | 1196 | bash scripts/quality/uaes-integration-check.sh  \|  exit_code=0 |
| evidence/raw/EV-06.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-06.log | `e02e531f6e94fe5fce58…` | 404 | ruby scripts/quality/test-uaes-integration-check.rb  \|  exit_code=0 |
| evidence/raw/EV-09.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-09.log | `b14072adcb506af4d917…` | 404 | ruby scripts/quality/test-uter-governance-boundaries.rb  \|  exit_code=0 |
| evidence/raw/EV-10.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-10.log | `741cc8961d19902856b3…` | 405 | ruby scripts/quality/test-uaes-manual-acceptance-boundary.rb  \|  exit_code=0 |
| evidence/raw/EV-11.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-11.log | `634d38af0fdc94069bf2…` | 453 | python3 scripts/quality/uaes-manual-acceptance.py --verify-only  \|  exit_code=0 |
| evidence/raw/EV-12.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-12.log | `fc6c85e392704012892b…` | 212 | bun run typecheck  \|  exit_code=0 |
| evidence/raw/EV-13.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-13.log | `1fcd4d3d8097fe7ef8a2…` | 27995 | bun run lint  \|  exit_code=0 |
| evidence/raw/EV-14.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-14.log | `cb046503589ea68ed367…` | 313 | bun run format:check  \|  exit_code=0 |
| evidence/raw/EV-15.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-15.log | `cad1669f1e94d2a67166…` | 313 | bun run design:tokens:check  \|  exit_code=0 |
| evidence/raw/EV-16.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-16.log | `44738b8f208a5fefaae4…` | 1309224 | bun run test  \|  exit_code=0 |
| evidence/raw/EV-17.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-17.log | `d769ea1341043c3dbb9a…` | 206 | GOWORK=off go build ./...  \|  exit_code=0 |
| evidence/raw/EV-18.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-18.log | `dea6be02e61417412192…` | 5312 | GOWORK=off go test ./...  \|  exit_code=0 |
| evidence/raw/EV-19.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-19.log | `c93d3763a230ff385d13…` | 1735 | GOWORK=off go test -race -count=1 ./model/ -run 'TestRechargeEpayConcurrentCallbacksCreditOnce\|TestRechargeOfficialCredi |
| evidence/raw/EV-20.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-20.log | `a0a6be9a029574051340…` | 508 | GOWORK=off govulncheck ./...  \|  exit_code=0 |
| evidence/raw/EV-21.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-21.log | `e463d96c397b4004f2a7…` | 565 | tmp=$(mktemp -d /tmp/uaes-gitleaks-XXXXXX) && git archive HEAD \| tar -x -C "$tmp" && (cd "$tmp" && gitleaks dir . --no-b |
| evidence/raw/EV-22.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-22.log | `7c7d90339f2300e10f85…` | 204 | bun run knip  \|  exit_code=0 |
| evidence/raw/EV-23.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-23.log | `183dde1d0ed4a82c948f…` | 318 | bun run test:visual  \|  exit_code=0 |
| evidence/raw/EV-24.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-24.log | `791085aa3938d95bdcbf…` | 7524 | GOWORK=off go test -count=1 -coverprofile='/Users/lincolnhu/uter/.quality/.state/fca-coverage.out' -timeout 600s ./... & |
| evidence/raw/GATE-NEG-ARCHITECTURE_GATE.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/GATE-NEG-ARCHITECTURE_GATE.log | `b89f603afd0981865990…` | 988 | python3 scripts/quality/full-conformance-execution.py gate-check --state '/Users/lincolnhu/uter/reports/compliance/full- |
| evidence/raw/GATE-NEG-BUSINESS_ACCEPTANCE_GATE.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/GATE-NEG-BUSINESS_ACCEPTANCE_GATE.log | `f8b510618720c02cd80d…` | 1018 | python3 scripts/quality/full-conformance-execution.py gate-check --state '/Users/lincolnhu/uter/reports/compliance/full- |
| evidence/raw/GATE-NEG-CHANGE_GATE.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/GATE-NEG-CHANGE_GATE.log | `ba7236a224bd921b5cf2…` | 1025 | python3 scripts/quality/full-conformance-execution.py gate-check --state '/Users/lincolnhu/uter/reports/compliance/full- |
| evidence/raw/GATE-NEG-CODE_REVIEW_GATE.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/GATE-NEG-CODE_REVIEW_GATE.log | `1d441be451bce126bc0f…` | 961 | python3 scripts/quality/full-conformance-execution.py gate-check --state '/Users/lincolnhu/uter/reports/compliance/full- |
| evidence/raw/GATE-NEG-GLOBAL_UAES_CONFORMANCE_GATE.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/GATE-NEG-GLOBAL_UAES_CONFORMANCE_GATE.log | `e4e3f9ed08deb7235e22…` | 1249 | python3 scripts/quality/full-conformance-execution.py gate-check --state '/Users/lincolnhu/uter/reports/compliance/full- |
| evidence/raw/GATE-NEG-RELEASE_GATE.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/GATE-NEG-RELEASE_GATE.log | `5d722efcc4f47297609b…` | 898 | python3 scripts/quality/full-conformance-execution.py gate-check --state '/Users/lincolnhu/uter/reports/compliance/full- |
| evidence/raw/GATE-NEG-SECURITY_GATE.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/GATE-NEG-SECURITY_GATE.log | `f32c69007141ad1a63b5…` | 1264 | python3 scripts/quality/full-conformance-execution.py gate-check --state '/Users/lincolnhu/uter/reports/compliance/full- |
| evidence/raw/GATE-NEG-TESTING_GATE.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/GATE-NEG-TESTING_GATE.log | `2ca448f2c4750aea2ecc…` | 1027 | python3 scripts/quality/full-conformance-execution.py gate-check --state '/Users/lincolnhu/uter/reports/compliance/full- |


## 交付物

| 文件 | SHA-256 | bytes |
|---|---|---|
| 01-FULL-COMPLIANCE-MATRIX.md | `775e848b094d6a382fd0…` | 4255 |
| 02-P00-P13-DOMAIN-AUDITS.md | `a2732b817c86d120916b…` | 2749 |
| 03-EXTERNAL-STANDARDS-MAPPING.md | `ebb6b1a1abc61abef377…` | 6603 |
| 04-AI-AGENT-EXECUTION-REPORT.md | `726f9dd5881e3932b1ad…` | 4202 |
| 05-ARCHITECTURE-COMPLIANCE-REPORT.md | `ba41635c425d09d3bd7e…` | 1990 |
| 06-SOFTWARE-QUALITY-AUDIT-REPORT.md | `a89e95033b2719fe2a71…` | 5197 |
| 07-SECURITY-RELIABILITY-AUDIT-REPORT.md | `e544f1527234741e3472…` | 5951 |
| 08-TEST-EXECUTION-REPORT.md | `2342247f4aed37be0c57…` | 8214 |
| 09-CICD-GATE-VERIFICATION-REPORT.md | `22c76d308bafa18913c5…` | 4697 |
| 10-NONCONFORMITIES-AND-RISKS.md | `75c605f6e05d895d62c8…` | 16103 |
| 11-REMEDIATION-AND-REVALIDATION.md | `9e88d43d1afb466620e1…` | 5264 |
| 13-FINAL-CONFORMANCE-ASSESSMENT.md | `621e011ceaf3a23de6f0…` | 3594 |
| 14-OPEN-ITEMS-AND-EXCEPTIONS.md | `397d4498105f627d8763…` | 3455 |


## 独立复核方法

```bash
python3 scripts/quality/full_conformance_deliver.py --verify-only
python3 scripts/quality/full-conformance-audit.py all
python3 scripts/quality/full-conformance-execution.py all
sha256sum reports/compliance/full-conformance-audit-2026-11-06/evidence/02-compliance-matrix.json
```

复核者可用 `evidence/matrix-export.csv` 的 `source_standard:source_line` 直接回查
UAES 仓库 `ff7cf878...` 的规范原文，逐条重放审计结论。
