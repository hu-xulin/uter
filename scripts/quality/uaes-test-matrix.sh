#!/usr/bin/env bash
#
# UTER-UAES-GOV-001 §8.2 / §9 / §15 D19 — L1_CHANGE_GATE / L2_INTEGRATION_GATE
# test matrix runner.
#
# Executes real commands against the four Go modules, the frontend, Electron,
# the governance gates and the pinned UAES registry. Every command's raw output,
# exit code, duration, working directory and toolchain version is persisted.
# Nothing is skipped silently: commands that cannot run are recorded as SKIPPED
# with an explicit reason, never as PASS.
#
# Usage: ./scripts/quality/uaes-test-matrix.sh [--quick] [--uaes-repo <path>]
# Exit:  0 = every executed check passed and nothing was skipped;
#        1 = at least one FAIL or SKIP (honest aggregate, never masked).

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
UAES_REPO="${UAES_REPO:-$(cd "$ROOT/../uaes" 2>/dev/null && pwd || echo '')}"
QUICK=0
EVIDENCE_DIR="${UAES_EVIDENCE_DIR:-$ROOT/reports/compliance/uaes-full-migration-2026-11-06/evidence}"

while [ $# -gt 0 ]; do
  case "$1" in
    --quick) QUICK=1; shift ;;
    --uaes-repo) UAES_REPO="$2"; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 3 ;;
  esac
done

mkdir -p "$EVIDENCE_DIR/matrix"
TSV="$EVIDENCE_DIR/matrix/results.tsv"
: > "$TSV"

run() {
  local id="$1" layer="$2" cmd="$3" workdir="${4:-$ROOT}"
  local log="$EVIDENCE_DIR/matrix/$id.log"
  local t0 t1 rc duration
  t0=$(date +%s)
  {
    echo "# id: $id"
    echo "# layer: $layer"
    echo "# command: $cmd"
    echo "# workdir: $workdir"
    echo "# started_at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    echo "# go: $(go version 2>/dev/null || echo n/a)"
    echo "# node: $(node --version 2>/dev/null || echo n/a)"
    echo "# bun: $(bun --version 2>/dev/null || echo n/a)"
    echo "# ---------------------------------------------"
    ( cd "$workdir" && eval "$cmd" ) 2>&1
  } > "$log"
  rc=$?
  t1=$(date +%s)
  duration=$((t1 - t0))
  echo "# exit_code: $rc" >> "$log"
  echo "# duration_seconds: $duration" >> "$log"
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$id" "$layer" "$rc" "$duration" "$cmd" "$workdir" >> "$TSV"
  printf '%-6s %-5s exit=%-3s %4ss  %s\n' "$id" "$layer" "$rc" "$duration" "$cmd"
}

# ---------------- L1 Change Gate ----------------
run L1-01 L1 "bash scripts/quality/ai-specs-check.sh"
run L1-02 L1 "ruby scripts/quality/test-ai-governance-policy.rb"
run L1-03 L1 "ruby scripts/quality/uaes-agent-runtime-check.rb selftest"
run L1-04 L1 "bash scripts/quality/uaes-pin-check.sh"
run L1-05 L1 "bash scripts/quality/uaes-integration-check.sh"
run L1-06 L1 "ruby scripts/quality/test-uaes-pin-check.rb"
run L1-07 L1 "ruby scripts/quality/test-uaes-integration-check.rb"
run L1-08 L1 "bun run typecheck" "$ROOT/web"
run L1-09 L1 "bun run lint" "$ROOT/web"
run L1-10 L1 "bun run format:check" "$ROOT/web"
run L1-11 L1 "bun run copyright:check" "$ROOT/web"
run L1-12 L1 "bun run design:tokens:check" "$ROOT/web"
run L1-13 L1 "gofmt -l \$(find . -name '*.go' -not -path './.git/*' -not -path './node_modules/*' -not -path './.quality/*' | head -4000) | tee /tmp/uaes-gofmt-list.txt; test ! -s /tmp/uaes-gofmt-list.txt"
# §1.3 / §4.3 two-repository separation and §3 P09/P10 division are mandatory
# change-gate controls, not optional documentation checks.
run L1-14 L1 "ruby scripts/quality/uter-governance-separation-check.rb"
run L1-15 L1 "ruby scripts/quality/uter-p09-p10-boundary-check.rb"
run L1-16 L1 "ruby scripts/quality/uaes-agent-runtime-check.rb preflight --task reports/compliance/uaes-full-migration-2026-11-06/evidence/agent-runtime-task.json && ruby scripts/quality/uaes-agent-runtime-check.rb workspace --task reports/compliance/uaes-full-migration-2026-11-06/evidence/agent-runtime-task.json"
run L1-17 L1 "ruby scripts/quality/test-uter-governance-boundaries.rb"
# §14.3 / §16.4 negative fixtures: manual-acceptance evidence must never
# auto-promote an item and a broken integrity chain must fail closed.
run L1-18 L1 "ruby scripts/quality/test-uaes-manual-acceptance-boundary.rb"
# §14.3 / §16.1 evidence must not carry frozen facts: a hard-coded registry
# DRAFT total is wrong evidence that looks verified. Locks the live reader in.
run L1-19 L1 "ruby scripts/quality/test-registry-draft-state.rb"

# ---------------- L2 Integration Gate ----------------
# §8.3 build-order precondition: main.go embeds both `web/dist` and
# `all:web/dist/docs-content/_next`, so ANY Go compilation fails with
# "pattern all:web/dist/docs-content/_next: no matching files found" unless both
# targets resolve. That is a prerequisite defect, not a Go code defect — it made
# L2-01/L2-05 report FAIL for a reason unrelated to what they measure.
# verify-all.sh already runs this same idempotent, non-destructive script before
# its Go gates; the matrix was missing it. The script never truncates existing
# real output, so this cannot mask a genuinely broken frontend build.
if [ "$QUICK" -eq 0 ]; then
  run L2-00 L2 "bash scripts/quality/ensure-go-embed-artifacts.sh" "$ROOT"
  run L2-01 L2 "GOWORK=off go test ./..." "$ROOT"
  run L2-02 L2 "GOWORK=off go test ./..." "$ROOT/relaykit"
  run L2-03 L2 "GOWORK=off go test ./..." "$ROOT/tokenkit"
  run L2-04 L2 "GOWORK=off go test ./..." "$ROOT/tokenkit/tokenkit"
  run L2-05 L2 "GOWORK=off go vet ./..." "$ROOT"
  run L2-06 L2 "bun run test" "$ROOT/web"
  # Host build-environment preparation (§8.3: NO command, assertion or exit-code
  # semantics are changed). The WorkBuddy safe-delete shim intercepts fs.cp
  # overwrite-deletes: when web/dist already contains output, rsbuild's publicDir
  # copy reaches the 50-deletion bulk guard and fails with
  # SAFE_DELETE_BULK_CONFIRM_REQUIRED (or becomes extremely slow via trash).
  # L2-01..L2-05 already needed a valid dist for main.go's go:embed directives,
  # so move that output aside now — the project's documented `mv` convention from
  # rebuild-all.sh — and let L2-07 build into a genuinely empty directory.
  if [ -d "$ROOT/web/dist" ]; then
    DIST_PREBUILD="${TMPDIR:-/tmp}/uaes-dist-before-L2-07-$$"
    mv "$ROOT/web/dist" "$DIST_PREBUILD" || exit 4
    echo "# build hygiene before L2-07: moved web/dist to $DIST_PREBUILD" >&2
  fi
  run L2-07 L2 "bun run build:check" "$ROOT/web"
  # Host build-environment restoration (§8.3: still NO command, assertion or
  # exit-code semantics changed). build:check rebuilds web/dist from scratch, so
  # the docs static export produced by docs-web's postbuild is no longer present.
  # main_docs_test.go requires the COMPLETE export (all language landing pages,
  # about pages and _next assets), not just a placeholder directory. Restore it
  # with the project's own postbuild script — only when missing, so that no
  # deletion is issued and the host safe-delete guard is never engaged. This
  # leaves the workspace in a state where a subsequent `go test ./...` is valid.
  if [ ! -d "$ROOT/web/dist/docs-content" ]; then
    node "$ROOT/docs-web/scripts/copy-to-web.mjs" || exit 5
    bash "$ROOT/scripts/verify-docs-artifacts.sh" "$ROOT/web/dist" || exit 5
    echo "# build hygiene after L2-07: restored docs static export into web/dist" >&2
  fi
  # UTER P13 business-domain evidence (§4 / §16.3, 14th domain): real targeted
  # payment/billing/relay Go suites and wallet/pricing frontend suites.
  run L2-08 L2 "GOWORK=off go test ./controller/... ./service/... ./model/... -run 'Alipay|TopUp|Recharge|Billing|Gateway|DreamRouter'" "$ROOT"
  run L2-09 L2 "bun run test -- src/features/wallet src/features/pricing" "$ROOT/web"
else
  echo "SKIPPED L2 (--quick): full Go/vitest/build suite" >> "$TSV"
fi

# ---------------- UAES registry (read-only) ----------------
if [ -n "$UAES_REPO" ] && [ -f "$UAES_REPO/.uaes/STANDARD-REGISTRY.yaml" ]; then
  run U-01 UAES "node quality/scripts/uaes/validate-registry.mjs" "$UAES_REPO"
  run U-02 UAES "node quality/scripts/uaes/quality-gate-runner.mjs" "$UAES_REPO"
else
  echo "SKIPPED UAES registry validation: repository not found at $UAES_REPO" >> "$TSV"
fi

python3 - "$TSV" "$EVIDENCE_DIR" "$ROOT" <<'PY'
import json, os, sys, subprocess, datetime
tsv, evidence, root = sys.argv[1], sys.argv[2], sys.argv[3]
rows, skips = [], []
for line in open(tsv):
    parts = line.rstrip('\n').split('\t')
    if len(parts) != 6:
        skips.append(line.strip()); continue
    rid, layer, rc, dur, cmd, wd = parts
    rows.append({"id": rid, "layer": layer, "exit_code": int(rc),
                 "duration_seconds": int(dur), "command": cmd, "workdir": wd,
                 "status": "PASS" if rc == "0" else "FAIL",
                 "log": os.path.relpath(os.path.join(evidence, "matrix", rid + ".log"), root)})
failed = [r for r in rows if r["status"] == "FAIL"]
head = subprocess.run(["git", "-C", root, "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
payload = {
    "report_id": "D19-TEST-MATRIX",
    "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "uter_commit": head,
    "total": len(rows), "passed": len(rows) - len(failed), "failed": len(failed),
    "skipped": skips,
    "overall": "FAIL" if failed or skips else "PASS",
    "results": rows,
    "note": "Exit codes come from real command execution. Skips are explicit and never counted as PASS."
}
path = os.path.join(evidence, "test-matrix.json")
open(path, "w").write(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
print(f"test-matrix: total={len(rows)} passed={len(rows)-len(failed)} failed={len(failed)} skipped={len(skips)} overall={payload['overall']}")
print(f"evidence: {path}")
PY

# Honest aggregate: any FAIL or SKIP is a non-zero result.
python3 - "$EVIDENCE_DIR/test-matrix.json" <<'PY'
import json, sys
p = json.load(open(sys.argv[1]))
sys.exit(0 if p["overall"] == "PASS" else 1)
PY
