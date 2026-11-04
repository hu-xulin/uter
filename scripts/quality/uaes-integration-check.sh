#!/usr/bin/env bash
# Validate the static UAES integration contract in the Uter repository.
# This check does not claim remote UAES availability or runtime skill discovery.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
pass() { printf 'PASS: %s\n' "$*"; }

test -s "$ROOT/.uaes/INTEGRATION.md" || fail "missing or empty .uaes/INTEGRATION.md"
test -s "$ROOT/.uaes/TRACEABILITY.md" || fail "missing or empty .uaes/TRACEABILITY.md"
grep -q "No phase in this matrix is currently marked VERIFIED" "$ROOT/.uaes/TRACEABILITY.md" || fail "traceability matrix must disclose unverified phase status"
test -s "$ROOT/AGENTS.md" || fail "missing or empty AGENTS.md"
test -s "$ROOT/CLAUDE.md" || fail "missing or empty CLAUDE.md"
test -s "$ROOT/.agents/skills/uaes-integration/SKILL.md" || fail "missing Agents Runtime UAES skill adapter"
test -s "$ROOT/.claude/skills/uaes-integration/SKILL.md" || fail "missing Claude Code UAES skill adapter"
test -s "$ROOT/.claude/skills/i18n-translate/SKILL.md" || fail "missing Claude i18n skill adapter"
test -s "$ROOT/.claude/skills/shadcn-ui/SKILL.md" || fail "missing Claude shadcn-ui skill adapter"
test -s "$ROOT/.claude/skills/vercel-react-best-practices/SKILL.md" || fail "missing Claude React performance skill adapter"

grep -q 'UAES Integration Contract' "$ROOT/.uaes/INTEGRATION.md" || fail "integration contract title missing"
grep -q 'MIGRATION_PENDING' "$ROOT/.uaes/INTEGRATION.md" || fail "migration status missing"
grep -q 'UAES Integration Contract' "$ROOT/AGENTS.md" || fail "AGENTS.md does not route to UAES integration contract"
grep -q '84416f7f55c1166e3f5adfa0575c1ea713ff20d2' "$ROOT/.uaes/INTEGRATION.md" || fail "UAES source commit pin missing"
grep -q '1c74e918b84b8cc18d2806a936721852b823ca75' "$ROOT/.uaes/INTEGRATION.md" || fail "UAES registry blob pin missing"

pass "UAES integration manifest and agent-entrypoint references are present"
printf '%s\n' "NOTE: this static check does not validate remote commit reachability, UAES registry semantics, skill runtime discovery, or full UAES compliance."
