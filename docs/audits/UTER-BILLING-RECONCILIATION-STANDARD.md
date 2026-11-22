# UTER Billing Reconciliation Standard

## Three evidence types

1. **Rule samples** — deterministic usage replayed through the stored expression.
2. **Operator samples** — real upstream cost supplied per request/model.
3. **Supplier invoices** — imported invoice rows reconciled against Uter cost
   and sale price.

## Statuses

- `MATCHED`: within tolerance.
- `MISMATCHED`: amount differs beyond tolerance.
- `NO_PRICE`: no Uter price row.
- `UNSUPPORTED`: expression/unit cannot be evaluated.
- `RULES_PASSED` / `RULE_FAILED`: deterministic rule check.
- `BLOCKED`: no authorized invoice export.

## Rules

1. Compare purchase cost against the actual upstream bill, not the public quote.
2. Compare sale price against the frozen request snapshot.
3. Historical bills are immutable; price updates must not rewrite them.
4. A mismatch is reported with model, time window, usage and both amounts.
5. Real invoice reconciliation is only verified when an authorized export is
   supplied; otherwise it stays BLOCKED.

## Current evidence

- DreamRouter: 46 upstream calls, 41 matched to consume logs; matched cost
  `$0.020268` exactly. Five upstream calls (`$0.002310`) have no local log.
- Apiko: one `$0` request with no local channel/log at audit time.
- Bailian: shared account; only the Uter API key subset is attributable.

These are historical samples, not a production-wide invoice verification.