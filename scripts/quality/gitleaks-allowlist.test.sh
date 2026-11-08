#!/usr/bin/env bash
# Regression guard for .quality/gitleaks.toml allowlist (MA-06).
#
# Why this exists:
#   2026-11-08 gitleaks 8.30.1 reported 6 generic-api-key findings that were all
#   confirmed false positives (ED25519 public-key fingerprint, prose phrase
#   "application/API security", and a Git commit SHA quoted inside an evidence
#   file). We exempt them with *line-level exact regexes* instead of whole-file
#   path exemptions. This test proves two things:
#     1. the three documented false positives are suppressed;
#     2. a real-looking secret in the SAME file is still detected, i.e. the
#        exemption is narrow and cannot be used to hide an actual leak.
#   It also fails if new regexes are appended without updating this guard.
#
# Usage: bash scripts/quality/gitleaks-allowlist.test.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="$ROOT/.quality/gitleaks.toml"
WORK="$(mktemp -d /tmp/uter-gitleaks-allowlist-XXXXXX)"
trap 'rm -rf "$WORK"' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }

command -v gitleaks >/dev/null 2>&1 || fail "gitleaks not installed"
[ -f "$CONFIG" ] || fail "missing $CONFIG"

# Guard: the exact-regex allowlist must stay at the three reviewed patterns.
REGEX_COUNT="$(awk '/^regexes = \[/{in_regex=1; next} in_regex && /^\]/{exit} in_regex && /^  '\'\'\''/{n++} END{print n+0}' "$CONFIG")"
[ "$REGEX_COUNT" = "3" ] || fail "allowlist regex count changed ($REGEX_COUNT, expected 3); review and update this test"

CORPUS="$WORK/corpus.md"
cat > "$CORPUS" <<'EOF'
Signature verification detail:
  "detail": "Good \"uaes-spec-release\" signature for uaes-authority@uaes.local with ED25519 key SHA256:IvFuu+b99VjTrimJcjvw5r9KY3ZRdYnhUi1iq+qqI1I"

Security scope prose:
  threat modeling, identity/access, application/API security, data protection.

Historical finding quote:
  "match": "OpenAPI commit: `4aa9c0849049a640aaa27fae11870adc92367b62`"
EOF

POSITIVE="$WORK/positive.json"
if gitleaks dir "$CORPUS" --no-banner --config "$CONFIG" \
    --report-format json --report-path "$POSITIVE" >/dev/null 2>&1; then
  echo "PASS: documented false positives are suppressed"
else
  python3 - "$POSITIVE" <<'PY'
import json, sys
try:
    for f in json.load(open(sys.argv[1])):
        print("  unexpected finding:", f.get("RuleID"), repr(f.get("Secret"))[:80])
except Exception as e:
    print("  (could not read report:", e, ")")
PY
  fail "false-positive suppression regressed"
fi

# Negative probe: a real-looking secret in the very same file MUST still be
# caught. The token is assembled at RUNTIME so this script never contains a
# literal credential-shaped string: otherwise the next MA-06 scan of the
# committed HEAD tree would (correctly) flag this very test file.
PROBE_TOKEN="glpat-""1234567890abcdefghij"
printf '\nPROBE gitlab_token = "%s"\n' "$PROBE_TOKEN" >> "$CORPUS"
NEGATIVE="$WORK/negative.json"
NEGATIVE_EXIT=0
gitleaks dir "$CORPUS" --no-banner --config "$CONFIG" \
  --report-format json --report-path "$NEGATIVE" >/dev/null 2>&1 || NEGATIVE_EXIT=$?
[ "$NEGATIVE_EXIT" -ne 0 ] || fail "allowlist masked an injected secret (exit=0)"
python3 - "$NEGATIVE" <<'PY' || exit 1
import json, sys
try:
    findings = json.load(open(sys.argv[1]))
except Exception as e:
    print("FAIL: unreadable negative report:", e)
    sys.exit(1)
if not any(f.get("RuleID") == "gitlab-pat" for f in findings):
    print("FAIL: injected glpat secret was not detected; findings =",
          [f.get("RuleID") for f in findings])
    sys.exit(1)
print("PASS: injected real-form secret still detected (findings=%d)" % len(findings))
PY

echo "gitleaks-allowlist: 2 passed / 0 failed"
