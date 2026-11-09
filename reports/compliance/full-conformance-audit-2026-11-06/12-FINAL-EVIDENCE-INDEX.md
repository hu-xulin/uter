# 最终证据索引

- **Document:** `12/14` of §11 (14 mandated deliverables)
- **Generated:** 2026-11-09T05:04:20Z
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
| evidence/00-baseline.json | `49669decf5c7178267e7…` | 31239 | — |
| evidence/01-conflict-register.json | `6bae049c597898cf3f94…` | 4425 | — |
| evidence/02-compliance-matrix.json | `a0f032b6428b4d54e36c…` | 5710652 | — |
| evidence/03-domain-audits.json | `891eb7a7a03c6264f4ce…` | 4060 | — |
| evidence/04-engineering-verification.json | `2f903f4ae29f8ad1efc5…` | 46933 | — |
| evidence/05-agent-verification.json | `a7d1b77abc9d24cc5162…` | 10315 | — |
| evidence/06-gates-verification.json | `644c00ef45cbc9895929…` | 13471 | — |
| evidence/07-findings-register.json | `78e6f8cf4c6366351484…` | 15326 | — |
| evidence/08-remediation-register.json | `08ffbac49736cde18041…` | 8536 | — |
| evidence/10-final-assessment.json | `0b0989ae7c27364bb018…` | 3605 | — |
| evidence/agent/00-branch-switch-wip-preserved.txt | `c3310de2af940c02a125…` | 7917 | — |
| evidence/agent/AG-04-denials.json | `437c805e0143e43e51e3…` | 2306 | — |
| evidence/agent/AG-05-delivery-denials.json | `46403f34d366cbfd7a03…` | 841 | — |
| evidence/agent/agent-runtime-preflight.json | `5afa533f1cdad6ba0307…` | 3375 | — |
| evidence/agent/agent-runtime-selftest.json | `e0dda343f9165d03dd8f…` | 6649 | — |
| evidence/agent/agent-runtime-test-execution.json | `3bf87e3be5cb98b91826…` | 1844 | — |
| evidence/agent/agent-runtime-workspace.json | `220b4598092825b0d5d2…` | 13880 | — |
| evidence/agent/fixtures/agent-verify-commands.txt | `50f086a184e1d5ad288a…` | 153 | — |
| evidence/agent/fixtures/task-bypass-attempt.json | `dabad36251c92aafe007…` | 15465 | — |
| evidence/agent/fixtures/task-missing-applicability.json | `ef9bf69ab9f3319fe4da…` | 4069 | — |
| evidence/agent/fixtures/uaes-registry-version-drift.yaml | `3e614e3d0f777b338489…` | 98446 | — |
| evidence/agent-runtime-task.json | `5b41ba236f5ff5c183cf…` | 7589 | — |
| evidence/bugfix/02-compliance-matrix.AFTER.json | `51d3d8d99604f55cfbff…` | 6292457 | — |
| evidence/bugfix/02-compliance-matrix.BEFORE.json | `7f949a39628c8fbd0333…` | 3176301 | — |
| evidence/bugfix/05-agent-verification.AFTER.json | `3e6b077488270375639f…` | 10272 | — |
| evidence/bugfix/05-agent-verification.BEFORE.json | `3df730313205fca6dbcf…` | 10242 | — |
| evidence/gates/fixtures/ARCHITECTURE_GATE-nonconforming-state.json | `747261e63932621df999…` | 225152 | — |
| evidence/gates/fixtures/BUSINESS_ACCEPTANCE_GATE-nonconforming-state.json | `29c885920a86ecc0b2a2…` | 225144 | — |
| evidence/gates/fixtures/CHANGE_GATE-nonconforming-state.json | `40dbcfc480a17348f09a…` | 225135 | — |
| evidence/gates/fixtures/CODE_REVIEW_GATE-nonconforming-state.json | `0fa8e67739f5717b8792…` | 225188 | — |
| evidence/gates/fixtures/GLOBAL_UAES_CONFORMANCE_GATE-nonconforming-state.json | `433dc4557d911fd6fa88…` | 225074 | — |
| evidence/gates/fixtures/RELEASE_GATE-nonconforming-state.json | `52b12f5d34cdebb6c760…` | 225132 | — |
| evidence/gates/fixtures/SECURITY_GATE-nonconforming-state.json | `117cbcfa3db52c02fd05…` | 225135 | — |
| evidence/gates/fixtures/TESTING_GATE-nonconforming-state.json | `117cbcfa3db52c02fd05…` | 225135 | — |
| evidence/matrix-export.csv | `b2a479bf1ba4758dec59…` | 3040448 | — |
| evidence/raw/AG-01-preflight.exit | `4355a46b19d348dc2f57…` | 2 | — |
| evidence/raw/AG-01-preflight.log | `7ee60b201cd6dd8f29e5…` | 7928 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb preflight --task /Users/lincolnhu/uter/reports/co |
| evidence/raw/AG-02-spec-drift.exit | `4355a46b19d348dc2f57…` | 2 | — |
| evidence/raw/AG-02-spec-drift.log | `93c6994a4b3647013557…` | 8032 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb preflight --task /Users/lincolnhu/uter/reports/co |
| evidence/raw/AG-03-empty-applicability.exit | `4355a46b19d348dc2f57…` | 2 | — |
| evidence/raw/AG-03-empty-applicability.log | `13dfe5ace90a26fb2b96…` | 3923 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb preflight --task /Users/lincolnhu/uter/reports/co |
| evidence/raw/AG-04-deny-01.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-04-deny-01.log | `cc01a106306a2b6c37de…` | 532 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action git.push.main --profile pull_r |
| evidence/raw/AG-04-deny-02.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-04-deny-02.log | `d0c2a142cfcdb16bd51b…` | 559 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action git.pull_request.merge --profi |
| evidence/raw/AG-04-deny-03.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-04-deny-03.log | `20b72564967cf24c6b9e…` | 520 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action git.merge --profile pull_reque |
| evidence/raw/AG-04-deny-04.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-04-deny-04.log | `1cfa16bda0a4c498118a…` | 568 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action production.database.write --pr |
| evidence/raw/AG-04-deny-05.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-04-deny-05.log | `481c378ef83f37abaca2…` | 574 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action payment.configuration.write -- |
| evidence/raw/AG-04-deny-06.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-04-deny-06.log | `c183e829c78b8bcb041c…` | 595 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action overwrite.user_uncommitted_cha |
| evidence/raw/AG-04-deny-07.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-04-deny-07.log | `aa6c57271009207eb9ee…` | 574 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action falsify.verification_result -- |
| evidence/raw/AG-04-deny-08.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-04-deny-08.log | `9a961fb7f7572ab883a0…` | 581 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action production.secrets.read --prof |
| evidence/raw/AG-04-deny-09.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-04-deny-09.log | `270913c968a0a20bf32a…` | 535 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action git.reset.hard --profile pull_ |
| evidence/raw/AG-04-deny-10.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-04-deny-10.log | `82dd32d24d9696e75d92…` | 559 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action git.restore.user_files --profi |
| evidence/raw/AG-05-gate-01.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-05-gate-01.log | `3143dfe940e7fa73fada…` | 597 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action git.commit --profile pull_requ |
| evidence/raw/AG-05-gate-02.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-05-gate-02.log | `34bad2b00493ef046c2c…` | 623 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action git.push.feature_branch --prof |
| evidence/raw/AG-05-gate-03.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-05-gate-03.log | `e15f2d4f6741dd24a1b0…` | 623 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action git.pull_request.create --prof |
| evidence/raw/AG-06-allow-read.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/AG-06-allow-read.log | `434596e774d533871eaa…` | 508 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action filesystem.read --profile read |
| evidence/raw/AG-07-alternate-path.exit | `4355a46b19d348dc2f57…` | 2 | — |
| evidence/raw/AG-07-alternate-path.log | `54c944e779ada20bf0ab…` | 832 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb workspace --task /Users/lincolnhu/uter/reports/co |
| evidence/raw/AG-07-prompt-bypass.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-07-prompt-bypass.log | `1e89e3384abbfa205ef4…` | 565 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action git.push.main --profile pull_r |
| evidence/raw/AG-07-task-switch.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/AG-07-task-switch.log | `f40a46dc8e14463510b2…` | 574 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb authorize --action git.pull_request.merge --profi |
| evidence/raw/AG-08-selftest.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/AG-08-selftest.log | `9d1946dd191d9a3ed50c…` | 1638 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb selftest  \|  exit_code=0 |
| evidence/raw/AG-09-real-task.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/AG-09-real-task.log | `955e6c5621f4f369de77…` | 748 | ruby /Users/lincolnhu/uter/scripts/quality/uaes-agent-runtime-check.rb verify --commands /Users/lincolnhu/uter/reports/c |
| evidence/raw/AG-10-ci-denial-loop.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/AG-10-ci-denial-loop.log | `e0bd460755a014d7a35c…` | 1480 |   \|  exit_code=0 |
| evidence/raw/EV-00-PROBE.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-00-PROBE.log | `2f9ec6df98fd5c7851a6…` | 1363 |   \|  exit_code=0 |
| evidence/raw/EV-01.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-01.log | `ef600323cbfefd682fa4…` | 359 | bash scripts/quality/ai-specs-check.sh  \|  exit_code=0 |
| evidence/raw/EV-02.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-02.log | `c00ad0d7e5ed7ee6de67…` | 955 | ruby scripts/quality/test-ai-governance-policy.rb  \|  exit_code=0 |
| evidence/raw/EV-03.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-03.log | `6434610518e080a5344b…` | 660 | bash scripts/quality/uaes-pin-check.sh  \|  exit_code=0 |
| evidence/raw/EV-04.exit | `4355a46b19d348dc2f57…` | 2 | — |
| evidence/raw/EV-04.log | `fb9caa4d4c11d8185ff3…` | 791 | ruby scripts/quality/test-uaes-pin-check.rb  \|  exit_code=1 |
| evidence/raw/EV-05.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-05.log | `9598eb44dfe6f4347890…` | 1196 | bash scripts/quality/uaes-integration-check.sh  \|  exit_code=0 |
| evidence/raw/EV-06.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-06.log | `6cbf2dabd1ea185a611f…` | 405 | ruby scripts/quality/test-uaes-integration-check.rb  \|  exit_code=0 |
| evidence/raw/EV-09.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-09.log | `7e22e647e192acb1555c…` | 405 | ruby scripts/quality/test-uter-governance-boundaries.rb  \|  exit_code=0 |
| evidence/raw/EV-10.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-10.log | `4d5ef372460a8dfc4f0e…` | 404 | ruby scripts/quality/test-uaes-manual-acceptance-boundary.rb  \|  exit_code=0 |
| evidence/raw/EV-11.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-11.log | `5c84db0c5d3ca2d99466…` | 453 | python3 scripts/quality/uaes-manual-acceptance.py --verify-only  \|  exit_code=0 |
| evidence/raw/EV-12.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-12.log | `678325bab2f774213520…` | 212 | bun run typecheck  \|  exit_code=0 |
| evidence/raw/EV-13.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-13.log | `f9b10bcd68ff07c82be6…` | 27995 | bun run lint  \|  exit_code=0 |
| evidence/raw/EV-14.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-14.log | `1c1c3ef2f4c803f3d231…` | 313 | bun run format:check  \|  exit_code=0 |
| evidence/raw/EV-15.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-15.log | `eda491cdb75240b0c4fc…` | 313 | bun run design:tokens:check  \|  exit_code=0 |
| evidence/raw/EV-16.exit | `4355a46b19d348dc2f57…` | 2 | — |
| evidence/raw/EV-16.log | `09a459973edcf843c7f9…` | 1352436 | bun run test  \|  exit_code=1 |
| evidence/raw/EV-17.exit | `4355a46b19d348dc2f57…` | 2 | — |
| evidence/raw/EV-17.log | `41685a35dd931574cbd8…` | 274 | GOWORK=off go build ./...  \|  exit_code=1 |
| evidence/raw/EV-18.exit | `4355a46b19d348dc2f57…` | 2 | — |
| evidence/raw/EV-18.log | `22793525493dc4720c9f…` | 5416 | GOWORK=off go test ./...  \|  exit_code=1 |
| evidence/raw/EV-19.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-19.log | `d836a3e5ea4d131de4e8…` | 1735 | GOWORK=off go test -race -count=1 ./model/ -run 'TestRechargeEpayConcurrentCallbacksCreditOnce\|TestRechargeOfficialCredi |
| evidence/raw/EV-20.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-20.log | `7b67ac8321683c41d2d4…` | 508 | GOWORK=off govulncheck ./...  \|  exit_code=0 |
| evidence/raw/EV-21.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-21.log | `e0d1b71bddf1e1daf827…` | 565 | tmp=$(mktemp -d /tmp/uaes-gitleaks-XXXXXX) && git archive HEAD \| tar -x -C "$tmp" && (cd "$tmp" && gitleaks dir . --no-b |
| evidence/raw/EV-22.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-22.log | `a863fecfcf39641cba6d…` | 204 | bun run knip  \|  exit_code=0 |
| evidence/raw/EV-23.exit | `9a271f2a916b0b6ee6ce…` | 2 | — |
| evidence/raw/EV-23.log | `3347c03e123a3861f745…` | 318 | bun run test:visual  \|  exit_code=0 |
| evidence/raw/EV-24.exit | `4355a46b19d348dc2f57…` | 2 | — |
| evidence/raw/EV-24.log | `1e2a5b609341f9c42f93…` | 7433 | GOWORK=off go test -count=1 -coverprofile='/Users/lincolnhu/uter/.quality/.state/fca-coverage.out' -timeout 600s ./... & |
| evidence/raw/GATE-NEG-ARCHITECTURE_GATE.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/GATE-NEG-ARCHITECTURE_GATE.log | `5f3bdf83a3a28747325f…` | 988 | python3 scripts/quality/full-conformance-execution.py gate-check --state '/Users/lincolnhu/uter/reports/compliance/full- |
| evidence/raw/GATE-NEG-BUSINESS_ACCEPTANCE_GATE.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/GATE-NEG-BUSINESS_ACCEPTANCE_GATE.log | `512ac7fda55d16a7d60f…` | 984 | python3 scripts/quality/full-conformance-execution.py gate-check --state '/Users/lincolnhu/uter/reports/compliance/full- |
| evidence/raw/GATE-NEG-CHANGE_GATE.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/GATE-NEG-CHANGE_GATE.log | `b2409036b934c6e80a4c…` | 1131 | python3 scripts/quality/full-conformance-execution.py gate-check --state '/Users/lincolnhu/uter/reports/compliance/full- |
| evidence/raw/GATE-NEG-CODE_REVIEW_GATE.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/GATE-NEG-CODE_REVIEW_GATE.log | `cbf457372a978f029b96…` | 995 | python3 scripts/quality/full-conformance-execution.py gate-check --state '/Users/lincolnhu/uter/reports/compliance/full- |
| evidence/raw/GATE-NEG-GLOBAL_UAES_CONFORMANCE_GATE.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/GATE-NEG-GLOBAL_UAES_CONFORMANCE_GATE.log | `3dba0fa10c36919d7666…` | 1249 | python3 scripts/quality/full-conformance-execution.py gate-check --state '/Users/lincolnhu/uter/reports/compliance/full- |
| evidence/raw/GATE-NEG-RELEASE_GATE.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/GATE-NEG-RELEASE_GATE.log | `c497783ba1cd3eb13691…` | 951 | python3 scripts/quality/full-conformance-execution.py gate-check --state '/Users/lincolnhu/uter/reports/compliance/full- |
| evidence/raw/GATE-NEG-SECURITY_GATE.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/GATE-NEG-SECURITY_GATE.log | `d0f1ef3848cd968e7df5…` | 1264 | python3 scripts/quality/full-conformance-execution.py gate-check --state '/Users/lincolnhu/uter/reports/compliance/full- |
| evidence/raw/GATE-NEG-TESTING_GATE.exit | `53c234e5e8472b6ac51c…` | 2 | — |
| evidence/raw/GATE-NEG-TESTING_GATE.log | `2f12f8cf0586e61c6868…` | 1068 | python3 scripts/quality/full-conformance-execution.py gate-check --state '/Users/lincolnhu/uter/reports/compliance/full- |


## 交付物

| 文件 | SHA-256 | bytes |
|---|---|---|
| 01-FULL-COMPLIANCE-MATRIX.md | `223764707b81adb99d79…` | 4255 |
| 02-P00-P13-DOMAIN-AUDITS.md | `8e1338b010f767fb564c…` | 2749 |
| 03-EXTERNAL-STANDARDS-MAPPING.md | `bd38b427c261ce1340fa…` | 6603 |
| 04-AI-AGENT-EXECUTION-REPORT.md | `b8ef0989584b28c1cf96…` | 4217 |
| 05-ARCHITECTURE-COMPLIANCE-REPORT.md | `84fc2fd54badda4cbb8e…` | 1990 |
| 06-SOFTWARE-QUALITY-AUDIT-REPORT.md | `fc729dc8b109abef7544…` | 6892 |
| 07-SECURITY-RELIABILITY-AUDIT-REPORT.md | `c52ff235779fc3c0814a…` | 5351 |
| 08-TEST-EXECUTION-REPORT.md | `418c3a11c438e7fc3019…` | 7787 |
| 09-CICD-GATE-VERIFICATION-REPORT.md | `ad61220a97830b2e1336…` | 4917 |
| 10-NONCONFORMITIES-AND-RISKS.md | `8085a353a2e20d7fde60…` | 16359 |
| 11-REMEDIATION-AND-REVALIDATION.md | `d24d1d1994a4cd54c2e8…` | 5263 |
| 13-FINAL-CONFORMANCE-ASSESSMENT.md | `95e655cc0b1095540b59…` | 3595 |
| 14-OPEN-ITEMS-AND-EXCEPTIONS.md | `c749a11725001c90d724…` | 3038 |


## 独立复核方法

```bash
python3 scripts/quality/full_conformance_deliver.py --verify-only
python3 scripts/quality/full-conformance-audit.py all
python3 scripts/quality/full-conformance-execution.py all
sha256sum reports/compliance/full-conformance-audit-2026-11-06/evidence/02-compliance-matrix.json
```

复核者可用 `evidence/matrix-export.csv` 的 `source_standard:source_line` 直接回查
UAES 仓库 `ff7cf878...` 的规范原文，逐条重放审计结论。
