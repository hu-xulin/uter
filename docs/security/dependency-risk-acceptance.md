# 依赖漏洞风险接受记录

本文件登记**无法通过升级修复**的依赖告警，以及判定其不可达的依据。任何新增条目
都必须写清：受影响包与版本、告警编号、为什么升不上去、为什么不可达、复查条件。

## node-forge · GHSA-86w9-cpqp-85rv（high，CWE-347）

- **受影响版本**：`node-forge <= 1.4.0`，而 `1.4.0` 就是 npm 上的 latest，
  **上游没有发布修复版本**，`bun audit` / Dependabot 因此会长期保留这条告警。
- **告警内容**：RSA PKCS#1 v1.5 **签名验证**接受多余的嵌套 `DigestAlgorithm`
  元素，属于签名校验绕过。
- **本项目用法**（`web/src/features/auth/lib/password-encryption.ts`）：
  只调用 `forge.pki.publicKeyFromPem` + `publicKey.encrypt(..., 'RSA-OAEP')`，
  以及 `forge.cipher` 的 AES-GCM 与 `forge.random`。**全仓没有任何签名验证调用**
  （无 `verify` / `pki.verify` / PKCS#1 v1.5 路径），该 CVE 的可达路径不存在。
- **为什么不直接删依赖**：这条路径是 **HTTP（非安全上下文）内网**下的密码加密兜底。
  安全上下文（HTTPS/localhost）走 WebCrypto，HTTP 场景 `crypto.subtle` 不可用，
  删掉 node-forge 等于让内网部署明文传密码。
- **复查条件**（任一满足即重开评估）：
  1. 上游发布 `> 1.4.0` 的版本 —— 直接升级并删除本条；
  2. 本项目出现任何签名/验签调用 —— 必须先替换实现；
  3. 放弃 HTTP 内网部署（强制 HTTPS）—— 可移除整个 forge 分支。

## 已修复，保留记录以便追溯

| 包 / 模块 | 告警 | 修复方式 |
| --- | --- | --- |
| `next` | 3 critical + 2 high + 5 moderate + 1 low（16.x） | 升到 `16.4.3`（`docs-web`） |
| `sharp` | high（`<0.35.5`） | 随 `next` 升级到 `0.35.5` |
| `source-map-js` | high（`<1.2.2`） | `docs-web` 加 `overrides` 到 `^1.2.2` |
| `electron` | 1 high + 3 moderate + 4 low（`<42.11.16`） | `41.10.6` → `42.11.18` |
| `fast-uri` / `http-cache-semantics` / `undici` | 4 moderate + 4 low + 2 high | `electron` 加 `overrides` |
| `go.opentelemetry.io/otel` | GO-2026-5158（baggage 解析不限制长度） | `v1.41.0` → `v1.42.0` |
| `tokenkit` / `tokenkit/tokenkit` 的 `go` 指令 | 标准库约 30 条（net/http、net/url、crypto/x509、archive/tar…） | `go 1.26` → `go 1.27.3`，与根模块 / relaykit 对齐 |
