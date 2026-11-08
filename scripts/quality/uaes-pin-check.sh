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
  APPROVED|ACTIVE)
    # APPROVED and ACTIVE are both post-approval lifecycle states in the registry
    # enum (.uaes/STANDARD-REGISTRY.yaml governance.lifecycle_status). The registry
    # moved to ACTIVE at v1.10.0 (UAES commit 0c9386b) when all 178 standards were
    # approved. The constraint is unchanged and is NOT relaxed: approval is a
    # normative baseline, never a compliance certificate.
    # approval_state tracks the registry's own lifecycle field, which advanced
    # APPROVED -> ACTIVE at v1.10.0 (UAES commit 0c9386b, 178/178 approved).
    # ACTIVE is a post-approval state, so it satisfies "was approved". This is a
    # vocabulary alignment, NOT a relaxation: NOT_APPROVED is still rejected.
    [[ "$APPROVAL_STATE" == "APPROVED" || "$APPROVAL_STATE" == "ACTIVE" ]] || fail "approved/active registry requires approval_state=APPROVED or ACTIVE"
    [[ "$INTEGRATION_STATUS" != "VERIFIED" ]] || fail "approved/active registry does not authorise integration_status=VERIFIED while domain gates are NOT_RUN"
    ;;
  *) fail "unsupported registry_status: $REGISTRY_STATUS" ;;
esac
pass "registry lifecycle is consistent (status=$REGISTRY_STATUS, approval=$APPROVAL_STATE, integration=$INTEGRATION_STATUS)"

require_text() { grep -Fq -- "$2" "$1" || fail "$1 is missing pinned value: $2"; }

# Check the no-false-closure invariant first so a contract that claims
# VERIFIED is always rejected with that explicit reason, even if other text
# has also drifted.
if grep -Eq '^\*\*Status:\*\* VERIFIED' "$CONTRACT"; then
  fail "contract claims VERIFIED without approved domain-gate evidence"
fi
pass "contract does not claim unverified compliance"

require_text "$CONTRACT" "$SOURCE_COMMIT"
require_text "$CONTRACT" "$REGISTRY_BLOB"
require_text "$CONTRACT" "| Registry version | \`$REGISTRY_VERSION\` |"
require_text "$CONTRACT" "| Registry status | \`$REGISTRY_STATUS\` |"
require_text "$CONTRACT" "MIGRATION_PENDING"
require_text "$CONTRACT" "Do not change this status to VERIFIED"
pass "INTEGRATION.md agrees with the pinned commit, blob, version and lifecycle"

# ---------------------------------------------------------------------------
# Schema 3.0.0 — governed-content fingerprint.
#
# The pin now names the governed content by fingerprint instead of by commit
# SHA. `source_commit` is provenance only: it records which UAES tree the
# fingerprint was taken from, and it is deliberately NOT compared against UAES
# HEAD here or anywhere else. Comparing HEAD was the defect this schema fixes:
# a commit that governs nothing (a report, a verifier fix) moved HEAD, expired
# the pin, and forced a manual re-pin four times in this repository's history.
#
# This section is OFFLINE and stays offline. It proves the pin is internally
# consistent — that the recorded fingerprint is the hash of the recorded
# components — so a hand-edited component cannot pass. It does NOT prove the
# fingerprint is still current against UAES; that requires the UAES checkout
# and is done by uaes-integration-check.sh at the point where UAES is present.
# Splitting it this way is deliberate: CI runs this gate before checking out
# UAES, so an online requirement here would either fail the build or force a
# weaker check than either half deserves.
# ---------------------------------------------------------------------------
ruby -rjson -rdigest -e '
  pin = JSON.parse(File.read(ARGV[0]))
  ver = pin["schema_version"].to_s

  # A DOWNGRADE IS A BYPASS.
  #
  # The first version of this check skipped silently for anything below 3.0.0,
  # so that old test fixtures would still run. That made the whole fingerprint
  # section optional: editing schema_version from 3.0.0 to 2.0.0 disabled every
  # check below and the gate still printed PASS. The tolerance was a hole
  # shaped exactly like the thing it was meant to catch.
  #
  # The real pin is 3.0.0. A pin below that is not a legacy pin in a repository
  # that has already migrated -- it is either a rollback or a mistake, and both
  # need a human, not a silent pass. Set UAES_PIN_LEGACY_OK=1 only when running
  # the historical fixtures deliberately.
  if !ver.start_with?("3.")
    if ENV["UAES_PIN_LEGACY_OK"] == "1"
      warn "WARN: pin schema #{ver} predates governed fingerprints; fingerprint checks skipped because UAES_PIN_LEGACY_OK=1"
      exit 0
    end
    abort "FAIL: pin schema is #{ver.size.zero? ? "(missing)" : ver}, expected 3.x. " \
          "Dropping below 3.0.0 disables governed-fingerprint verification, so it is refused. " \
          "Re-run the UAES propagation; set UAES_PIN_LEGACY_OK=1 only for historical fixtures."
  end

  fp = pin["governed_fingerprint"].to_s
  unless fp.match?(/\A[0-9a-f]{64}\z/)
    abort "FAIL: governed_fingerprint must be a 64-character lowercase sha256 hex digest"
  end

  comps = pin["governed_components"]
  abort "FAIL: schema 3.0.0 pin is missing governed_components" unless comps.is_a?(Hash) && !comps.empty?

  # Canonical form must match the producer exactly: sorted keys, flat scalars.
  canonical = JSON.generate(comps.keys.sort.each_with_object({}) { |k, h| h[k] = comps[k] })
  actual = Digest::SHA256.hexdigest(canonical)
  unless actual == fp
    abort "FAIL: governed_fingerprint does not match its own governed_components " \
          "(recorded #{fp[0, 12]}, recomputed #{actual[0, 12]}); the pin was edited by hand"
  end

  # The duplicated top-level fields predate schema 3.0.0 and are still read by
  # other gates. They MUST agree with the components, otherwise two checks see
  # two different baselines and the disagreement is invisible.
  { "registry_blob_sha"       => "registry_blob_sha",
    "registry_version"        => "registry_version",
    "registry_status"         => "registry_status",
    "specification_id"        => "specification_id",
    "specification_version"   => "specification_version",
    "specification_integrity_digest" => "specification_integrity_digest",
    "requirement_count"       => "requirement_count" }.each do |top, comp_key|
    next unless pin.key?(top)
    unless pin[top].to_s == comps[comp_key].to_s
      abort "FAIL: pin field #{top} (#{pin[top]}) disagrees with governed_components.#{comp_key} (#{comps[comp_key]})"
    end
  end

  # A seal that does not verify means the covered bytes and the sealed digest
  # disagree — someone edited a standard, schema, gate or requirement file
  # without re-sealing. The pin must never assert a current baseline over that.
  declared = comps["specification_integrity_digest"].to_s
  computed = comps["specification_integrity_computed"].to_s
  unless declared == computed
    abort "FAIL: sealed digest and recomputed digest disagree at pin time " \
          "(declared #{declared}, computed #{computed}); the pinned baseline is not intact"
  end

  # requirement_count is duplicated as an integer in components; guard against
  # a pin that quietly records zero requirements and therefore hashes cheaply.
  if comps["requirement_count"].to_i <= 0
    abort "FAIL: governed_components.requirement_count must be a positive integer"
  end
' "$PIN" || exit 1
pass "governed fingerprint matches its own components and the seal is intact"

GOVERNED_FP="$(ruby -rjson -e 'print JSON.parse(File.read(ARGV[0])).fetch("governed_fingerprint", "")' "$PIN")"
if [ -n "$GOVERNED_FP" ]; then
  # The human-readable contract must name the same fingerprint, for the same
  # reason it names the same commit: two documents, one baseline.
  require_text "$CONTRACT" "$GOVERNED_FP"
  pass "INTEGRATION.md names the same governed fingerprint"
fi

printf 'uaes-pin-check: PASS scope=static-integrity status=%s version=%s fingerprint=%s commit=%s\n' \
  "$REGISTRY_STATUS" "$REGISTRY_VERSION" "${GOVERNED_FP:0:12}" "${SOURCE_COMMIT:0:12}"
