#!/usr/bin/env python3
"""UTER-UAES-GOV-001 §14.1-14.4 — authoritative evidence integrity closure.

D25 (Evidence Index) is a point-in-time snapshot written while the deliverables
are still being generated, so it cannot enumerate files written afterwards. This
script is the single implementation of the final integrity manifest. Run it LAST,
after every log and exit-code file has been written, with output redirected
outside the evidence directory:

    python3 scripts/quality/uaes-evidence-closure.py > /tmp/closure.log

The closure deliberately excludes only itself; claiming its own hash would be an
unresolvable self-reference. Integrity hashes support evidence integrity only —
they do not prove that the underlying activity was performed correctly (§14.4).
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPORTS = Path(os.environ.get("UAES_REPORTS_DIR", ROOT / "reports/compliance/uaes-full-migration-2026-11-06"))
EV = Path(os.environ.get("UAES_EVIDENCE_DIR", REPORTS / "evidence"))
CLOSURE = EV / "evidence-closure.json"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git_head(repo: Path) -> str:
    try:
        out = subprocess.run(
            ["git", "-C", str(repo), "rev-parse", "HEAD"],
            capture_output=True, text=True, check=True,
        )
        return out.stdout.strip()
    except (subprocess.CalledProcessError, OSError):
        return "UNKNOWN"


def main() -> int:
    if not EV.is_dir():
        print(f"BLOCKED: evidence directory missing: {EV}", file=sys.stderr)
        return 1

    files = sorted(p for p in EV.rglob("*") if p.is_file() and p != CLOSURE)
    payload = {
        "evidence_id": "EVIDENCE-CLOSURE",
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "governing_specification": "UTER-UAES-GOV-001",
        "repository_revision": {
            "uter_head": git_head(ROOT),
            "uaes_head": git_head(ROOT.parent / "uaes"),
        },
        "collector": "WorkBuddy (Tencent Hunyuan Hy)",
        "source_system": "scripts/quality/uaes-evidence-closure.py",
        "scope": "all regular files under the evidence directory except this closure file",
        "self_reference": "evidence-closure.json is intentionally excluded; its own hash is not claimed",
        "limitation": "hashes support integrity only, not proof of correct execution (§14.4)",
        "file_count": len(files),
        "files": [
            {
                "path": str(p.relative_to(REPORTS)),
                "bytes": p.stat().st_size,
                "sha256": sha256(p),
            }
            for p in files
        ],
    }
    EV.mkdir(parents=True, exist_ok=True)
    CLOSURE.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(f"closure files={len(files)} self_excluded=1 path={CLOSURE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
