#!/usr/bin/env python3
"""UTER-UAES-GOV-001 §14.3 / §16.1 — live registry state reader (Python side).

WHY THIS FILE EXISTS

The acceptance collector used to state a frozen "304 registry entries remain
DRAFT" string. That figure was accurate at UAES registry 1.9.0; by registry
1.12.1 the real count was 130. A frozen number inside an evidence generator
makes the evidence wrong, and wrong evidence is more dangerous than missing
evidence because it looks verified.

The count is therefore derived from the pinned UAES checkout on every run, and
fails closed (reports UNKNOWN) instead of falling back to a stale or invented
value when the registry cannot be read.

Counterpart: scripts/quality/lib/registry_draft_state.rb (must agree).
"""

from __future__ import annotations

from pathlib import Path


def read(uaes_repo: str | Path) -> dict:
    """Count DRAFT/ACTIVE entries in the pinned UAES registry, live.

    Fail-closed: an unreadable registry returns available=False with nil
    totals, never a stale number and never a silent zero.
    """
    path = Path(uaes_repo) / ".uaes/STANDARD-REGISTRY.yaml"

    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return {
            "available": False,
            "path": str(path),
            "draft_total": None,
            "active_total": None,
            "by_section": {},
            "active_by_section": {},
            "note": (
                f"UAES registry not readable at {path} "
                f"({exc.__class__.__name__}); DRAFT/ACTIVE counts are UNKNOWN, "
                "not assumed."
            ),
        }

    by_section: dict[str, int] = {}
    active_by_section: dict[str, int] = {}
    section = ""
    for line in text.splitlines():
        stripped = line.strip()
        if line and not line[0].isspace() and stripped.endswith(":"):
            section = stripped[:-1]
        elif stripped in ("status: DRAFT", 'status: "DRAFT"'):
            by_section[section] = by_section.get(section, 0) + 1
        elif stripped in ("status: ACTIVE", 'status: "ACTIVE"'):
            active_by_section[section] = active_by_section.get(section, 0) + 1

    draft_total = sum(by_section.values())
    active_total = sum(active_by_section.values())
    detail = ", ".join(
        f"{k}={v}" for k, v in sorted(by_section.items()) if v
    )
    return {
        "available": True,
        "path": str(path),
        "draft_total": draft_total,
        "active_total": active_total,
        "by_section": by_section,
        "active_by_section": active_by_section,
        "note": (
            f"{draft_total} UAES registry entries remain DRAFT ({detail}); "
            f"{active_total} entries are ACTIVE."
        ),
    }


def note(uaes_repo: str | Path) -> str:
    """One-line wording that is always current, for open_reason strings."""
    state = read(uaes_repo)
    if not state["available"]:
        return "UAES registry could not be read, so the DRAFT/ACTIVE split is UNKNOWN"
    return state["note"]