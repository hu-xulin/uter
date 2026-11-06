#!/usr/bin/env bash
# Validate the machine-readable UAES pin against the human-readable contract.
#
# Purpose (P00 / P11): detect silent spec-version drift, and make it impossible
# to present a DRAFT registry as an approved compliance baseline. This is a
# static integrity check; it does not claim UAES availability, gate execution,
# or product compliance.
set -euo pipefail

DEFAULT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ROOT="${UAES_PIN_ROOT:-$DEFAULT_ROOT}"
ROOT="$(cd "$ROOT" && pwd)"
cd "$ROOT"

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
pass() { printf 'PASS: %s\n' "$*"; }

PIN="$ROOT/.uaes/uaes-pin.json"
CONTRACT="$ROOT/.uaes/INTEGRATION.md"
test -s "$PIN" || fail "missing or empty .uaes/uaes-pin.json"
test -s "$CONTRACT" || fail "missing or empty .uaes/INTEGRATION.md"

# Every required field must be present and non-empty in the pin document.
REQUIRED_FIELDS=(
  schema_version repository default_branch source_commit registry_path
  registry_blob_sha registry_version registry_status integration_status
  approval_state pinned_at
)
for field in "${REQUIRED_FIELDS[@]}"; do
  ruby -rjson -e '
    data = JSON.parse(File.read(ARGV[0]))
    value = data[ARGV[1]]
    exit 2 if value.nil? || value.to_s.empty?
  ' "$PIN" "$field" || fail "pin is missing required field: $field"
done
pass "pin contains all ${#REQUIRED_FIELDS[@]} required fields"

field() {
  ruby -rjson -e 'print JSON.parse(File.read(ARGV[0]))[ARGV[1]].to_s' "$PIN" "$1" 2>/dev/null ||
    fail "pin is not parseable JSON while reading $1"
}

SOURCE_COMMIT="$(field source_commit)"
REGISTRY_BLOB="$(field registry_blob_sha)"
REGISTRY_VERSION="$(field registry_version)"
REGISTRY_STATUS="$(field registry_status)"
INTEGRATION_STATUS="$(field integration_status)"
APPROVAL_STATE="$(field approval_state)"

for pair in "source_commit:$SOURCE_COMMIT" "registry_blob_sha:$REGISTRY_BLOB"; do
  name="${pair%%:*}"
  value="${pair#*:}"
  printf '%s' "$value" | grep -Eq '^[0-9a-f]{40}$' || fail "$name must be a 40-character lowercase git object id"
done
pass "source commit and registry blob are valid 40-character object ids"

case "$REGISTRY_STATUS" in
  DRAFT)
    [[ "$APPROVAL_STATE" == "NOT_APPROVED" ]] || fail "DRAFT registry must keep approval_state=NOT_APPROVED"
    [[ "$INTEGRATION_STATUS" == "MIGRATION_PENDING" ]] || fail "DRAFT registry must keep integration_status=MIGRATION_PENDING"
    ;;
  APPROVED)
    [[ "$APPROVAL_STATE" == "APPROVED" ]] || fail "APPROVED registry requires approval_state=APPROVED"
    ;;
  *) fail "unsupported registry_status: $REGISTRY_STATUS" ;;
esac
pass "registry lifecycle is consistent (status=$REGISTRY_STATUS, approval=$APPROVAL_STATE)"

require_text() { grep -Fq -- "$2" "$1" || fail "$1 is missing pinned value: $2"; }

# Check the no-false-closure invariant first so a contract that claims
# VERIFIED is always rejected with that explicit reason, even if other text
# has also drifted.
if grep -Eq '^\*\*Status:\*\* VERIFIED' "$CONTRACT"; then
  fail "contract claims VERIFIED while the registry is not approved"
fi
pass "contract does not claim unverified compliance"

require_text "$CONTRACT" "$SOURCE_COMMIT"
require_text "$CONTRACT" "$REGISTRY_BLOB"
require_text "$CONTRACT" "| Registry version | \`$REGISTRY_VERSION\` |"
require_text "$CONTRACT" "| Registry status | \`$REGISTRY_STATUS\` |"
require_text "$CONTRACT" "MIGRATION_PENDING"
require_text "$CONTRACT" "Do not change this status to VERIFIED"
pass "INTEGRATION.md agrees with the pinned commit, blob, version and lifecycle"

printf 'uaes-pin-check: PASS scope=static-integrity status=%s version=%s commit=%s\n' \
  "$REGISTRY_STATUS" "$REGISTRY_VERSION" "${SOURCE_COMMIT:0:12}"
