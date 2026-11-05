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

for file in "$INTEGRATION" "$TRACEABILITY" "$AGENTS" "$CLAUDE" "$AGENTS_SKILL" "$CLAUDE_SKILL"; do
  require_file "$file"
done

# Integration lifecycle and immutable audit-baseline identity.
require_text "$INTEGRATION" "UAES Integration Contract"
require_text "$INTEGRATION" "MIGRATION_PENDING"
require_text "$INTEGRATION" "84416f7f55c1166e3f5adfa0575c1ea713ff20d2"
require_text "$INTEGRATION" "1c74e918b84b8cc18d2806a936721852b823ca75"
require_text "$INTEGRATION" "payment, recharge, refund, balance"
require_text "$INTEGRATION" "Token usage, pricing, quota"
require_text "$INTEGRATION" "SQLite/MySQL/PostgreSQL"
require_text "$INTEGRATION" "UTER Design System 3.0"
require_text "$INTEGRATION" "Do not change this status to VERIFIED"

# The traceability matrix must cover every phase and must not overstate compliance.
require_text "$TRACEABILITY" "No phase in this matrix is currently marked VERIFIED"
for phase in P00 P01 P02 P03 P04 P05 P06 P07 P08 P09 P10 P11 P12; do
  grep -Fq "| ${phase} " "$TRACEABILITY" || fail "traceability matrix is missing ${phase}"
done

# Uter project instructions and overlays remain authoritative during migration.
require_text "$AGENTS" "UAES Integration Contract"
require_text "$AGENTS" "docs/design-system/UTER-DESIGN-SYSTEM-3.0.md"
require_text "$AGENTS" "docs/ai-specs/engineering-quality/"
require_text "$AGENTS" "Billing safety invariants"
require_text "$AGENTS" "Authentication Security (OWASP Mandatory)"
require_text "$CLAUDE" "Read AGENTS.md with the Read tool"
require_text "$CLAUDE" "web/AGENTS.md"
require_text "$CLAUDE" ".agents/rules/billing.md"

# Every Uter-owned canonical project skill must have a Claude runtime adapter
# that explicitly delegates to the canonical source instead of drifting in parallel.
for canonical_skill in "$ROOT"/.agents/skills/*/SKILL.md; do
  test -f "$canonical_skill" || continue
  skill_name="$(basename "$(dirname "$canonical_skill")")"
  [[ "$skill_name" == "uaes-integration" ]] && continue
  adapter="$ROOT/.claude/skills/$skill_name/SKILL.md"
  require_file "$adapter"
  require_text "$adapter" ".agents/skills/$skill_name/SKILL.md"
done

# Both supported runtime adapters must delegate to the canonical integration skill.
for adapter in "$AGENTS_SKILL" "$CLAUDE_SKILL"; do
  require_text "$adapter" "skills/uaes-uter-integration/SKILL.md"
  require_text "$adapter" "Never claim UAES integration is VERIFIED"
done

pass "UAES integration lifecycle and source pins are present"
pass "all Uter-owned canonical project skills have Claude adapters"
pass "P00-P12 traceability is complete and explicitly unverified"
pass "Uter payment, billing, auth, database, and Design System overlays remain protected"
pass "Agent entrypoints and both runtime skill adapters route to the canonical contract"
printf '%s\n' "NOTE: static wiring only; remote commit reachability, semantic parity, runtime skill discovery, CI policy enforcement, and full UAES compliance remain separate acceptance requirements."
