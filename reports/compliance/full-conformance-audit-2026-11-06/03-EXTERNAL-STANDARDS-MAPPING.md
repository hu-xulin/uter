# 外部标准适用性及映射清单

- **Document:** `3/14` of §11 (14 mandated deliverables)
- **Generated:** 2026-11-06T17:41:59Z
- **Uter commit SHA:** `ec6501adceb008d46140a7e5ab6508eb78006731`
- **UAES commit SHA:** `0c9386b192090e901ccc5de6df1f2aebe3f5c618`
- **Execution environment:** macOS-26.7.2-x86_64-i386-64bit-Mach-O
- **Collector:** WorkBuddy (Tencent Hunyuan Hy)
- **Evidence root:** `reports/compliance/full-conformance-audit-2026-11-06/evidence/`

> 本文件由真实仓库状态与真实命令退出码生成。未执行的验证一律记为 `NOT_RUN` / `BLOCKED`，
> 绝不以文档、代码改动或 Agent 自述代替工程验证（§12 / §13）。

---


来源：权威规范 `docs/ai-specs/UTER-UAES-GOVERNANCE-ARCHITECTURE-WORKBUDDY-EXECUTION-SPECIFICATION.md`
`UTER-UAES-GOV-001` §2.1，共 **25** 项；§2.2 要求逐项记录标识、
官方名称、发布者、版本、发布日期、现行状态、修订、适用范围、相关要求、适用性决定、
裁剪决定、责任人、验证方法、证据位置。

**重要限制（如实披露）**：本次为本地仓库审计，未从权威发布者获取正式文本与版本元数据。
下表 `official_title / publisher / edition / publication_date / current_status /
amendments` 一律记为 `NOT_VERIFIED`，**不虚构**；`applicability` 为基于内部域映射的
初步判定，**不构成外部认证**（§16.5）。

| 标准/框架 | §2.1 治理用途 | 内部域映射 | 官方版本/发布日期 | 状态 | 适用性初判 | 验证证据 |
|---|---|---|---|---|---|---|
| ISO/IEC/IEEE 12207 | Software lifecycle processes | P11 / P12 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| ISO/IEC/IEEE 15288 | System lifecycle processes, where applicable | P04 / P12 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| ISO/IEC 25010 | Product quality model | P09 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| ISO/IEC 25040 | Product quality evaluation | P09 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| ISO/IEC 9001 | Quality management system, where adopted | P09 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| ISO/IEC 27001 | Information security management system | P10 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| ISO/IEC 27002 | Information security controls guidance | P10 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| ISO/IEC 27005 | Information security risk management | P10 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| ISO/IEC 27701 | Privacy information management, where applicable | P10 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| ISO/IEC 42001 | Artificial intelligence management system | P01 / P08 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| ISO/IEC 23894 | AI risk management guidance | P01 / P08 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| ISO/IEC/IEEE 29119 | Software testing | P09 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| ISO/IEC/IEEE 20246 | Software review | P06 / P09 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| ISO/IEC/IEEE 25023 | Software product quality measurement | P09 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| ISO/IEC/IEEE 16085 | Risk management in lifecycle processes | P10 / P12 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| NIST CSF 2.0 | Cybersecurity risk management | P10 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| NIST SP 800-218 | Secure Software Development Framework | P10 / P11 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| NIST AI RMF 1.0 | AI risk management | P01 / P08 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| OWASP ASVS | Application security verification | P10 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| OWASP SAMM | Software assurance maturity | P10 / P09 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| OWASP Top 10 | Application security risk awareness | P10 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| SLSA | Software supply chain security | P11 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| OpenSSF | Open-source software security practices | P10 / P11 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| WCAG 2.2 | Web accessibility | P05 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |
| W3C WAI-ARIA | Accessible interface semantics | P05 | NOT_VERIFIED | NOT_VERIFIED | APPLICABLE (初步) | INDIRECT: 见 evidence/04-engineering-verification.json |


### 未能完成 §2.2 全字段的原因与所需授权

- 需从 ISO/IEC、NIST、OWASP、W3C、OpenSSF 等官方发布者取得现行版本与修订记录。
- 需为每项标准指定 Responsible owner 与 tailoring decision，并形成正式适用性评审记录。
- 相关环境探针：`probe.get('dast_tool')=False`、`probe.get('axe_toolchain')=True`、
  `probe.get('playwright_installed')=True`；完整探针结果见 `evidence/raw/EV-00-PROBE.log`。
- 内部完成度：安全相关验证见 `07-SECURITY-RELIABILITY-AUDIT-REPORT.md`，
  其中 DAST / 渗透 / API 安全 / 三库 / DR / 备份恢复均为 `NOT_RUN`。

**结论：外部标准映射清单为 `PARTIAL / NOT_VERIFIED`，不能作为完全符合的证据。**
