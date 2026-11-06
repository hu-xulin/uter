# Midjourney Refund Transaction Design

**Status:** DRAFT — normative design contract; implementation is partial and not yet accepted or approved for production  
**Audit date:** 2026-11-05  
**Target project:** Uter  
**Related UAES controls:** financial integrity, idempotency, transaction boundaries, durable recovery, evidence-based quality gates

## 1. Purpose and non-goals

This document defines the required persistence and transaction contract for Midjourney task refunds. It addresses duplicate refunds, partial accounting success, process crashes, terminal-task recovery gaps, and the independent LOG_DB boundary.

It does **not** authorize:
- changing Midjourney prices, quota conversion, zero-charge action semantics, or the point at which a task is charged;
- changing whether organization members should fund Midjourney requests from an organization budget;
- automatic refunds for historical tasks whose actual charge cannot be proven;
- production data repair, migration execution, deployment, or PR merge.

The current implementation is a legacy path: `Midjourney.Quota` is used as the refund amount, `TokenId` and `BillingChannelId` are stored separately, and `RefundMidjourneyQuota` performs multiple effects that are not one atomic unit. A boolean return value is not sufficient evidence that all accounting legs completed.

## 2. Source-verified baseline

The following facts were verified against the Uter integration branch at the audit baseline:

1. `model.Midjourney` persists `user_id`, `quota`, `token_id`, and `billing_channel_id`, but does not persist an immutable per-leg billing snapshot or refund-operation identity.
2. `UpdateBillingState` updates the billing columns but checks only the GORM error; it does not check `RowsAffected`.
3. `RefundMidjourneyQuota` updates the user wallet, Token quota, user/channel usage counters, billing log, and task quota in separate operations. Some downstream failures are logged without making the overall result reliably fail.
4. `model.RecordTaskBillingLog` has no error return contract and writes to LOG_DB, which may be a separate database from the primary DB.
5. User/channel usage helpers may use in-memory batch updates; they are unsuitable as the authoritative write primitive inside a financial transaction.
6. Controller paths for missing `mj_id` and channel-cache lookup failure can mark tasks failed without invoking the refund function. The normal failure path ignores its boolean return.
7. `RelayInfo.OrganizationId` exists, but the current Midjourney wallet settlement path calls `DecreaseUserQuota` directly rather than the generic organization-aware `BillingSession/WalletFunding` path. Whether Midjourney should use organization funding is a product decision, not an assumption this design makes.

These observations are evidence of the inspected branch, not proof about uninspected deployed revisions or historical data.

## 3. Required persistence model

### 3.1 Midjourney billing snapshot

Add immutable billing snapshot fields to the task (or a normalized one-to-one billing record if migration review prefers that model). The snapshot must distinguish:

| Field | Meaning |
|---|---|
| `billing_version` | Snapshot schema/version |
| `billing_status` | `unbilled`, `prepared`, `settled`, `partial`, `reconciliation_required` |
| `price_quota` | Price-derived target amount captured at acceptance |
| `wallet_applied_quota` | Actual wallet/organization funding amount successfully applied |
| `token_applied_quota` | Actual Token quota amount successfully applied |
| `funding_source` | Explicit `personal_wallet`, `organization_wallet`, `subscription`, or `unknown_legacy` |
| `funding_user_id` | User whose funding account was changed |
| `funding_org_id` | Organization ID only when an approved organization funding route actually applied |
| `funding_org_resolved` | Whether the funding owner was resolved and snapshotted |
| `token_id_snapshot` | Token identity used for the charge |
| `channel_id_snapshot` | Channel identity used for usage accounting |
| `user_usage_applied` | Actual user used-quota delta |
| `channel_usage_applied` | Actual channel used-quota delta |
| `billing_request_id` | Stable local idempotency/request identity |

Never infer a successful wallet or Token charge from `price_quota` alone. Persist each applied leg only after its write is known to have succeeded. Partial success must remain explicit and must not be represented as fully settled.

The current organization funding behavior is unresolved. Until the product owner decides, keep the legacy route's actual funding source explicit; do not silently route Midjourney charges to an organization. If organization funding is approved later, charge, usage accounting, refund, and audit snapshots must all use the same resolved organization identity.

### 3.2 MidjourneyRefundOperation

Create a durable refund operation table with at least:

- `id` primary key;
- `midjourney_task_id` foreign/business reference to local `midjourneys.id`;
- `operation_type` (initially full refund; future partial refund requires a separately approved contract);
- `idempotency_key`, unique and derived from the local task ID plus operation type;
- `reason_code` and bounded `reason_detail`;
- immutable copies of the billing snapshot and intended refund amounts for every accounting leg;
- `status`: `pending`, `completed`, `reconciliation_required`;
- `attempt_count`, `last_error_code`, bounded `last_error_detail`;
- `created_at`, `updated_at`, `completed_at`.

Required unique constraint: one full-refund operation per local task. Do not use upstream `mj_id` as the unique key: it is external, may be empty, and is not the local durable identity.

The operation snapshot must include the actual applied amounts, not merely the requested price. If the historical task cannot prove which legs were charged, create a reconciliation case; do not guess a refund amount.

### 3.3 Refund log outbox

Create a primary-DB outbox table with:

- unique `event_key` (derived from refund operation ID and event type);
- `refund_operation_id`;
- immutable log payload and schema version;
- `status` (`pending`, `delivering`, `delivered`, `dead_letter`);
- `attempt_count`, `next_attempt_at`, `lease_owner`, `lease_until`;
- `last_error`, timestamps.

The outbox is the durable handoff to LOG_DB. Do not claim a distributed transaction across the primary DB and LOG_DB.

## 4. Transaction and state contract

### 4.1 Main-DB transaction

The refund executor must perform the following in one primary-DB transaction:

1. Insert or load the unique refund operation using the local task ID idempotency key.
2. Lock/read the task and its immutable billing snapshot.
3. Verify the task belongs to the operation and the refund amount does not exceed each actually applied leg.
4. If already completed, return the recorded completed result without applying any accounting leg again.
5. Apply the funding refund to the exact source originally charged:
   - personal wallet: use a transaction-aware wallet primitive with existing balance-cap checks;
   - organization wallet: only if that funding route was actually used and approved; reverse the same organization ledger and member sub-quota ledger;
   - subscription: reject until a dedicated subscription refund contract is implemented; do not coerce it to wallet.
6. Restore the exact Token quota leg when `token_id_snapshot` is known. Missing Token is a reconciliation error, not a silent skip.
7. Reverse user and channel usage counters using new transaction-aware, error-returning helpers. Do not use process-local batch queues.
8. CAS the task's billing/refund fields using expected prior state and expected snapshot values. Check both SQL error and `RowsAffected`.
9. Insert the LOG_DB outbox event with a unique event key.
10. Mark the operation `completed` and commit.

Any failure before commit must roll back all primary-DB changes. A process crash before commit must leave no partial committed refund. A process crash after commit must leave a completed operation and a pending outbox event, which can be safely delivered later.

### 4.2 Transaction primitives

All financial writes must accept the caller's `*gorm.DB` transaction and return errors. The following existing patterns are not acceptable as authoritative refund primitives:

- helpers that call global `model.DB` instead of the supplied transaction;
- in-memory batch update queues;
- void-returning usage/log functions;
- success decisions based only on `Error == nil` when a row match is required.

Every conditional update must verify the expected row count. Zero affected rows must be interpreted according to an explicit idempotency/CAS outcome, not silently treated as success.

### 4.3 State machine

```text
pending
  ├── all primary-DB legs + task CAS + outbox insert commit ──> completed
  └── unverifiable snapshot / missing relation / invariant breach ──> reconciliation_required

completed
  └── outbox delivery retries independently; refund is never re-applied

reconciliation_required
  └── explicit audited operator resolution; no blind automatic credit
```

Do not persist a long-lived `applying` state in a separate transaction unless a lease/claim protocol and crash recovery semantics are implemented. The simplest safe design is to keep the primary refund operation and all primary accounting legs in one transaction.

## 5. LOG_DB delivery contract

A separate worker reads pending outbox rows using a multi-instance-safe lease/claim operation. It must:

- claim with a bounded lease and atomic conditional update;
- deliver an immutable event payload;
- use the same `event_key` as a unique idempotency key in LOG_DB;
- treat duplicate delivery as success only after verifying the existing event matches the expected payload identity;
- retry transient failures with bounded exponential backoff;
- dead-letter after the configured retry policy and expose an operational alert;
- mark the primary outbox row delivered only after LOG_DB confirms durable receipt.

A crash after LOG_DB insert but before primary outbox acknowledgement must be safe: the retry hits the LOG_DB unique key and confirms the same event rather than creating a duplicate.

## 6. Recovery and scheduling

Refund recovery must be an independent SystemTask, not coupled to Midjourney upstream polling or the existence of unfinished upstream tasks.

- Scan pending/refundable operations by indexed state and age.
- Use multi-instance-safe claims/leases.
- Re-run only idempotent operation transitions.
- Never automatically refund `unknown_legacy` snapshots.
- Surface stale operations, dead-letter outbox rows, missing user/token/channel records, and inconsistent task snapshots for operator review.
- Scheduler errors must be observable and returned; batch processing may continue, but must not swallow the first failure.

## 7. Controller contract

Every failure path that makes a task terminal must invoke or enqueue the same durable refund operation when the snapshot proves a charge was applied. This includes:

- upstream task failure;
- missing/empty upstream `mj_id`;
- channel lookup/cache failure;
- request/response processing failure after a charge;
- administrative failure transitions.

Task terminal status and refund completion are separate state dimensions. Do not use `progress == 100%` as evidence that billing is settled or refunded. Controller callers must preserve and surface refund-operation creation/execution errors; never discard a refund result.

## 8. Legacy and migration safety

Before backfilling old tasks:

1. Inventory all Midjourney rows and classify by age, action, status, quota, token ID, billing channel ID, and available logs.
2. Identify zero-charge actions and historical code paths where `quota` may not equal the amount actually charged.
3. Prove the relationship between each legacy task and its wallet/Token/usage ledger effects.
4. Backfill only records with deterministic evidence; classify all others as `unknown_legacy` and reconciliation-required.
5. Preserve original rows and export a checksum-verified backup.
6. Test migration interruption, rerun idempotency, rollback/restore, and post-restore reconciliation on supported DB dialects.
7. Do not execute a production migration or historical credit without explicit owner approval.

## 9. Required verification matrix

| Scenario | Required assertion |
|---|---|
| Duplicate concurrent refund | Exactly one operation and one credit per accounting leg |
| Retry after completed refund | No additional balance/token/usage change |
| Crash before main transaction commit | No refund leg remains committed |
| Crash after commit before LOG_DB delivery | Refund remains completed; outbox remains pending |
| Crash after LOG_DB insert before acknowledgement | Retry confirms same event; no duplicate log |
| Wallet update failure | Entire main transaction rolls back |
| Token update failure | Entire main transaction rolls back |
| User/channel usage update failure | Entire main transaction rolls back |
| Missing user/token/channel | Reconciliation required; no partial refund |
| Wallet cap exceeded | Transaction fails without partial accounting changes |
| CAS affects zero rows | Explicit idempotent/conflict result; never assumed success |
| Outbox worker multi-instance race | One active lease/one logical event |
| Expired worker lease | Another worker safely resumes |
| Unknown legacy billing snapshot | No automatic credit |
| All 18 Midjourney actions | Charge/refund/zero-charge semantics match approved action matrix |
| Zero-charge operations | No refund operation credits a non-existent charge |
| Controller terminal failure branches | Each charge-backed failure creates a durable refund operation |
| Cache rehydration | DB remains source of truth; cache repair after commit is retryable |

Tests must include deterministic fault injection at each transaction boundary, concurrent goroutines, process restart/recovery, and supported MySQL/PostgreSQL/SQLite dialect coverage. Test evidence must include command, commit SHA, environment, and result.

## 10. Decisions required before implementation

| Decision | Current status | Safe default |
|---|---|---|
| Should organization members' Midjourney requests consume shared organization budget? | **OWNER DECISION REQUIRED** | Preserve current charging behavior; do not infer organization funding |
| Are subscription-funded Midjourney tasks supported? | **NOT VERIFIED** | Reject/refuse automatic refund if snapshot indicates subscription |
| Can any action be partially charged or retried upstream? | **CONTRACT REVIEW REQUIRED** | Refund only amounts proven applied; do not infer from `quota` |
| What is the approved historical backfill policy? | **OWNER APPROVAL REQUIRED** | Unknown legacy records go to reconciliation; no auto-credit |
| What retry/dead-letter thresholds and alert destination apply? | **OPS DECISION REQUIRED** | Use bounded retries and visible dead-letter state; do not silently discard |

## 11. Acceptance criteria

This design is not complete implementation evidence. It may be marked implemented only when:

- schema and migration are reviewed and tested on all supported dialects;
- all primary financial legs are transaction-aware and error-returning;
- refund operation idempotency and task CAS are verified under concurrency;
- LOG_DB outbox delivery is independently recoverable and idempotent;
- independent recovery scheduler works with multiple instances;
- every controller terminal failure path is covered;
- historical records are classified safely;
- the full verification matrix has reproducible passing evidence;
- UAES traceability links each normative requirement to code, tests, and CI evidence;
- an independent reviewer approves the implementation.

**Current disposition (updated 2026-11-05):** implementation is consolidated in the current Uter PR #15 integration branch. The branch contains a versioned refund operation/outbox model, a primary-database refund transaction, durable reconciliation cases for ambiguous/missing ledgers, synchronous usage persistence, and an independent Midjourney refund recovery SystemTask. These changes remain unaccepted and are not production-ready until the current PR #15 head passes the complete quality gates and the required transaction, concurrency, dialect, and controller-path evidence is recorded. SQL LOG_DB outbox delivery/receipt idempotency and bounded retry/dead-letter handling are now implemented in Draft PR #19/#20. ClickHouse delivery is deliberately fail-closed pending a dedicated adapter. Crash/concurrency and dialect verification, full controller failure-path coverage, and operational alerting beyond SystemTask failure visibility remain incomplete. No PR has been merged and no production data or deployment was changed.


## 5.1 Current implementation evidence and limitations (2026-11-05)

The PR #15 integration branch includes a scheduled outbox delivery worker with:
- atomic conditional claim and a bounded two-minute lease;
- SQL LOG_DB receipt rows keyed by `event_key`, with a SHA-256 hash of the immutable payload;
- receipt creation and refund-log insertion in one LOG_DB SQL transaction;
- duplicate delivery accepted only when the stored payload hash matches;
- bounded exponential retry and dead-letter after ten attempts;
- delivery of both completed-refund and reconciliation-required audit events.

**ClickHouse limitation:** ClickHouse does not provide the transactional unique-receipt semantics used by this SQL adapter. The worker explicitly fails closed for ClickHouse instead of performing an unsafe check-then-insert. Such events retry and eventually enter dead-letter. A ClickHouse-specific insert-deduplication adapter, exact retry semantics, and integration tests are still required before claiming support for ClickHouse LOG_DB.

The above code remains unaccepted until the current PR #15 head passes the complete quality gates and the verification matrix is independently reviewed. No production configuration is changed by this implementation.

The current PR #15 integration branch also routes the normal Midjourney terminal-failure path through `RefundMidjourneyTaskBilling`, replaces the legacy boolean refund helper with the durable transaction, and hands empty local upstream IDs to the same local-task-ID refund/reconciliation path. Empty-ID tasks are marked terminal only after the durable handoff is persisted; the task is reloaded before the terminal status CAS so stale billing fields cannot overwrite the refund result. Regression tests cover empty upstream IDs, zero-quota token-only partial charges, missing task-row persistence, and conflicting migration rows. These changes are implementation progress, not acceptance evidence; the full 18-action matrix, fault-injection/crash tests, SQL dialect integration, ClickHouse adapter, and independent controller-path verification remain open.
