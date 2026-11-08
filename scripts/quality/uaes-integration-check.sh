#!/usr/bin/env bash
# Validate static UAES integration wiring and preservation of Uter-owned rules.
# This does not claim remote UAES availability, runtime skill discovery, or full compliance.
set -euo pipefail

DEFAULT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ROOT="${UAES_INTEGRATION_ROOT:-$DEFAULT_ROOT}"
ROOT="$(cd "$ROOT" && pwd)"
cd "$ROOT"

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
pass() { printf 'PASS: %s\n' "$*"; }
require_file() { test -s "$1" || fail "missing or empty $1"; }
require_text() {
  local file="$1"
  local expected="$2"
  grep -Fq -- "$expected" "$file" || fail "$file is missing required invariant: $expected"
}

INTEGRATION="$ROOT/.uaes/INTEGRATION.md"
TRACEABILITY="$ROOT/.uaes/TRACEABILITY.md"
AGENTS="$ROOT/AGENTS.md"
CLAUDE="$ROOT/CLAUDE.md"
AGENTS_SKILL="$ROOT/.agents/skills/uaes-integration/SKILL.md"
CLAUDE_SKILL="$ROOT/.claude/skills/uaes-integration/SKILL.md"
GOVERNANCE_POLICY="$ROOT/.uaes/agent-governance.yaml"
PIN_FILE="$ROOT/.uaes/uaes-pin.json"
ENTRY="$ROOT/.uaes/AI-GOVERNANCE-ENTRY.md"
GOV_SPEC="$ROOT/docs/ai-specs/UTER-UAES-GOVERNANCE-ARCHITECTURE-WORKBUDDY-EXECUTION-SPECIFICATION.md"
GOV_REGISTRY="$ROOT/.uaes/uter-governance-registry.yaml"
P13_SPEC="$ROOT/.uaes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md"

for file in "$INTEGRATION" "$TRACEABILITY" "$ENTRY" "$AGENTS" "$CLAUDE" "$AGENTS_SKILL" "$CLAUDE_SKILL" "$GOVERNANCE_POLICY" "$PIN_FILE" "$ROOT/.ai/task-schema.json" "$GOV_SPEC" "$GOV_REGISTRY" "$P13_SPEC"; do
  require_file "$file"
done

# Integration lifecycle and immutable audit-baseline identity.
# The commit/blob/version/status are read from the machine-readable pin instead
# of being hard-coded, so a reviewed pin refresh cannot silently desynchronise
# the contract from the checker (P00 spec-version drift).
pin_field() {
  ruby -rjson -e 'print JSON.parse(File.read(ARGV[0]))[ARGV[1]].to_s' "$PIN_FILE" "$1"
}
PINNED_COMMIT="$(pin_field source_commit)" || fail "cannot read source_commit from $PIN_FILE"
PINNED_BLOB="$(pin_field registry_blob_sha)" || fail "cannot read registry_blob_sha from $PIN_FILE"
PINNED_VERSION="$(pin_field registry_version)" || fail "cannot read registry_version from $PIN_FILE"
PINNED_STATUS="$(pin_field registry_status)" || fail "cannot read registry_status from $PIN_FILE"
PINNED_APPROVAL="$(pin_field approval_state)" || fail "cannot read approval_state from $PIN_FILE"

# An approved normative baseline must carry its approval state and be traceable
# to the formal approval record; approval never auto-promotes Uter integration.
if [[ "$PINNED_STATUS" == "APPROVED" ]]; then
  [[ "$PINNED_APPROVAL" == "APPROVED" ]] || fail "APPROVED registry pin must carry approval_state=APPROVED"
  require_text "$INTEGRATION" "UAES-APPROVAL-2026-11-06-001"
fi

# The governance entry point must stay a thin pointer, not a second copy of
# UAES generic text or a second source of truth for the pin.
require_text "$ENTRY" ".uaes/uaes-pin.json"
require_text "$ENTRY" ".uaes/STANDARD-REGISTRY.yaml"
require_text "$ENTRY" "$PINNED_COMMIT"
require_text "$ENTRY" "docs/ai-specs/"
require_text "$ENTRY" "UTER-DESIGN-SYSTEM-3.0.md"
require_text "$ENTRY" "UTER-UAES-GOV-001"
require_text "$ENTRY" "uter-governance-registry.yaml"
require_text "$ENTRY" "UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md"

# UTER-UAES-GOV-001 three-layer / two-repository architecture invariants.
# UTER P13 must be registered in the Uter project registry only, never in UAES.
require_text "$GOV_SPEC" "UTER-UAES-GOV-001"
require_text "$GOV_SPEC" "CONFORMANT"
require_text "$GOV_SPEC" "D28"
require_text "$GOV_REGISTRY" 'registered_in: "UTER-PROJECT-GOVERNANCE-REGISTRY"'
require_text "$GOV_REGISTRY" "uaes/standards/"
require_text "$GOV_REGISTRY" 'role: "PROVE"'
require_text "$GOV_REGISTRY" 'role: "DEFINE"'
require_text "$GOV_REGISTRY" "independently_assessed_domains: 14"
require_text "$P13_SPEC" "UTER P13"
require_text "$INTEGRATION" "UTER-UAES-GOV-001"
require_text "$INTEGRATION" "UTER P13"
require_text "$INTEGRATION" "P09 / P10 division"
require_text "$AGENTS" "UTER-UAES-GOV-001"
require_text "$AGENTS" "uter-governance-registry.yaml"
require_text "$AGENTS" "P09 proves"
require_text "$AGENTS" "P10 defines"

require_text "$INTEGRATION" "UAES Integration Contract"
require_text "$INTEGRATION" "MIGRATION_PENDING"
require_text "$INTEGRATION" "$PINNED_COMMIT"
require_text "$INTEGRATION" "$PINNED_BLOB"
require_text "$INTEGRATION" "| Registry version | \`$PINNED_VERSION\` |"
require_text "$INTEGRATION" "| Registry status | \`$PINNED_STATUS\` |"
require_text "$INTEGRATION" "payment, recharge, refund, balance"
require_text "$INTEGRATION" "Token usage, pricing, quota"
require_text "$INTEGRATION" "SQLite/MySQL/PostgreSQL"
require_text "$INTEGRATION" "UTER Design System 3.0"
require_text "$INTEGRATION" "Do not change this status to VERIFIED"

# P01 fail-closed policy and task contract must be present.
require_text "$GOVERNANCE_POLICY" "max_non_main_branches: 1"
require_text "$GOVERNANCE_POLICY" "git.merge"
require_text "$GOVERNANCE_POLICY" "production.database.write"
require_text "$GOVERNANCE_POLICY" "payment.configuration.write"
require_text "$GOVERNANCE_POLICY" "overwrite.user_uncommitted_changes"

# The traceability matrix must cover every phase and must not overstate compliance.
require_text "$TRACEABILITY" "No phase in this matrix is currently marked VERIFIED"
for phase in P00 P01 P02 P03 P04 P05 P06 P07 P08 P09 P10 P11 P12; do
  grep -Fq "| ${phase} " "$TRACEABILITY" || fail "traceability matrix is missing ${phase}"
done
grep -Fq "UTER-P13" "$TRACEABILITY" || fail "traceability matrix is missing the independent UTER-P13 domain"

# Uter project instructions and overlays remain authoritative during migration.
require_text "$AGENTS" "docs/design-system/UTER-DESIGN-SYSTEM-3.0.md"
require_text "$AGENTS" "docs/ai-specs/engineering-quality/"
require_text "$AGENTS" "Billing safety invariants"
require_text "$AGENTS" "Authentication Security (OWASP Mandatory)"
require_text "$CLAUDE" "Read AGENTS.md with the Read tool"
require_text "$CLAUDE" "web/AGENTS.md"
require_text "$CLAUDE" ".agents/rules/billing.md"

# Every Uter-owned canonical project skill must have a Claude runtime adapter
# that explicitly delegates to the canonical source instead of drifting in parallel.
# uaes-integration is included: its adapter was previously a byte-for-byte copy,
# which let two Agent runtimes load divergent rule versions without detection.
for canonical_skill in "$ROOT"/.agents/skills/*/SKILL.md; do
  test -f "$canonical_skill" || continue
  skill_name="$(basename "$(dirname "$canonical_skill")")"
  adapter="$ROOT/.claude/skills/$skill_name/SKILL.md"
  require_text "$canonical_skill" "name: $skill_name"
  require_file "$adapter"
  require_text "$adapter" "name: $skill_name"
  require_text "$adapter" "description:"
  require_text "$adapter" ".agents/skills/$skill_name/SKILL.md"
done

# Both supported runtime adapters must delegate to the canonical integration skill.
for adapter in "$AGENTS_SKILL" "$CLAUDE_SKILL"; do
  require_text "$adapter" "skills/uaes-uter-integration/SKILL.md"
  require_text "$adapter" "Never claim UAES integration is VERIFIED"
done

# ---------------------------------------------------------------------------
# ONLINE governed-fingerprint comparison (pin schema 3.0.0).
#
# This is the only place that compares the pin against a live UAES checkout,
# and it runs only when one is available. The offline half — proving the
# recorded fingerprint is the hash of the recorded components — lives in
# uaes-pin-check.sh, because CI runs that gate before UAES is checked out.
#
# What is compared here is the governed CONTENT, not the commit. UAES HEAD is
# expected to move constantly: every governance report, every verifier fix
# writes a commit that governs nothing. Treating that as drift expired the pin
# four times in this run and produced no signal about the rules. So the
# comparison is fingerprint-to-fingerprint, and a differing source_commit on its
# own is reported as provenance, never as a failure.
# ---------------------------------------------------------------------------
UAES_CHECKOUT="${UAES_REPO:-$(cd "$ROOT/../uaes" 2>/dev/null && pwd || echo '')}"
PIN_FP="$(ruby -rjson -e 'print JSON.parse(File.read(ARGV[0])).fetch("governed_fingerprint", "")' "$PIN_FILE")"

if [ -z "$PIN_FP" ]; then
  # A schema 3.0.0 pin without a fingerprint is malformed; an older pin is a
  # deliberate downgrade and must be visible rather than silently accepted.
  PIN_SCHEMA="$(pin_field schema_version)"
  case "$PIN_SCHEMA" in
    3.*) fail "pin schema $PIN_SCHEMA declares a governed fingerprint but records none" ;;
    *)   printf 'WARN: pin schema %s predates governed fingerprints; online drift detection is NOT_RUN\n' "$PIN_SCHEMA" ;;
  esac
elif [ -z "$UAES_CHECKOUT" ] || [ ! -f "$UAES_CHECKOUT/.uaes/STANDARD-REGISTRY.yaml" ]; then
  printf 'WARN: no UAES checkout found (set UAES_REPO); online fingerprint comparison is NOT_RUN, not PASS\n'
else
  FP_SCRIPT="$UAES_CHECKOUT/quality/scripts/uaes/governed-fingerprint.mjs"
  if [ ! -f "$FP_SCRIPT" ]; then
    fail "UAES checkout at $UAES_CHECKOUT does not provide quality/scripts/uaes/governed-fingerprint.mjs; cannot verify the pinned rules"
  fi
  command -v node >/dev/null 2>&1 || fail "node is required to recompute the governed fingerprint"

  # Recompute from the UAES bytes. --require-intact exits 3 when the seal does
  # not verify, which is a different and more serious condition than drift:
  # it means a covered file was edited without re-sealing.
  set +e
  LIVE_FP="$(node "$FP_SCRIPT" --require-intact --fingerprint-only 2>&1)"
  FP_RC=$?
  set -e
  case "$FP_RC" in
    0) ;;
    3) fail "UAES seal does not verify: ${LIVE_FP}. A covered standard, schema, gate or requirements file was modified without re-sealing. Refusing to treat the pinned baseline as current." ;;
    *) fail "cannot recompute the governed fingerprint in $UAES_CHECKOUT (exit $FP_RC): ${LIVE_FP}" ;;
  esac

  [[ "$LIVE_FP" == "$PIN_FP" ]] ||
    fail "governed fingerprint drift: pin records ${PIN_FP:0:12}, UAES ${UAES_CHECKOUT} computes ${LIVE_FP:0:12}. The rules in force changed; re-run the UAES->Uter propagation and re-pin."

  # Provenance is reported, never enforced. A different HEAD with an identical
  # fingerprint means the UAES rules are byte-for-byte the same and only
  # non-governed files moved.
  UAES_HEAD="$(git -C "$UAES_CHECKOUT" rev-parse HEAD 2>/dev/null || echo unknown)"
  PASS_MSG="governed fingerprint matches the live UAES checkout (${LIVE_FP:0:12})"
  if [[ "$UAES_HEAD" != "$PINNED_COMMIT" ]]; then
    printf 'PASS: %s\n' "$PASS_MSG"
    printf 'NOTE: UAES HEAD %s differs from pinned source_commit %s, but the governed fingerprint is identical, so no rule changed. source_commit is provenance only and no gate may fail on it alone.\n' \
      "${UAES_HEAD:0:12}" "${PINNED_COMMIT:0:12}"
  else
    printf 'PASS: %s\n' "$PASS_MSG"
  fi
fi

pass "UAES integration lifecycle and source pins are present"
pass "governance entry point is a thin, pinned pointer (no duplicated UAES text)"
pass "all Uter-owned canonical project skills have delegating Claude adapters"
pass "P00-P12 traceability plus independent UTER-P13 domain are registered and explicitly unverified"
pass "UTER-UAES-GOV-001 three-layer / two-repository architecture and P09/P10 ownership are registered"
pass "Uter payment, billing, auth, database, and Design System overlays remain protected"
pass "Agent entrypoints and both runtime skill adapters route to the canonical contract"
pass "P01 fail-closed permission policy and task schema are registered"
printf '%s\n' "NOTE: static wiring only; remote commit reachability, semantic parity, runtime skill discovery, CI policy enforcement, 14 independent domain acceptances, independent assessment and L4_GLOBAL_CONFORMANCE_GATE remain separate acceptance requirements. This check makes no conformance claim (§16.5)."
