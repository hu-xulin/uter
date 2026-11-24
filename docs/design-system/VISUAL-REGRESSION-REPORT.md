# UDS 8.0.0 视觉与无障碍验证报告

> 生成时间 2026-11-24T07:32:38.718Z · 设计系统 UTER DESIGN SYSTEM 8.0.0

## 1. 自动检查器

| 项 | 值 |
|---|---|
| 命令 | `node web/scripts/check-design-system-8.0.0.mjs --json` |
| 退出码 | 0 |
| 判定 | PASS |
| 通过项 | 22/22 |

## 2. Showcase 视觉与无障碍

| 项 | 状态 |
|---|---|
| Showcase 视觉回归 | PASS |
| axe 无障碍 | PASS |
| 真实产品页面回归 | PASS |

## 3. 差距与边界

- 视觉基线更新须人工审核并单独批准，不得由脚本批量覆盖。
- 未执行（NOT_EXECUTED）与失败（FAIL）均如实登记，不转换为 PASS。
- ACCEPTANCE_READY 不等于 ACCEPTED；最终人工接受仍需用户确认。
