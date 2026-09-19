#!/usr/bin/env python3
"""Scrub legible upstream-brand text anywhere inside a screenshot.

`blur_brand.py` destroys the capture's own top-left chrome. This module
handles the second surface: brand text *inside* the picture — a provider
entry in a third-party app's form, a terminal command, an example URL. It
reads the image with macOS Vision OCR, blurs every "New API" / "new-api"
occurrence (pixelated + blurred, feathered back), and re-scans until a full
pass finds nothing left — a single pass is not enough because OCR reads
different subsets of a region once it has been blurred.

Requires macOS (Vision). Run through the WorkBuddy-managed python so the
pyobjc bindings are present.
"""
from __future__ import annotations

import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from blur_brand import blur_boxes  # noqa: E402
from find_brand_text import hits  # noqa: E402


def scrub_file(path: Path, max_rounds: int = 4) -> int:
    """Blur all brand text in one image. Returns rounds of blurring applied."""
    for round_index in range(max_rounds):
        boxes = [box for _, box in hits(path)]
        if not boxes:
            return round_index
        blur_boxes(path, boxes)
    return max_rounds


def scrub_tree(root: Path, pattern: str = '*/*.webp') -> dict[str, int]:
    """Scrub every matching image under root; returns files -> rounds used."""
    report: dict[str, int] = {}
    for path in sorted(root.glob(pattern)):
        rounds = scrub_file(path)
        if rounds:
            report[str(path)] = rounds
    return report


if __name__ == '__main__':
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('public/apps-assets')
    report = scrub_tree(root)
    touched = sum(report.values())
    for path, rounds in report.items():
        print(f'{rounds} round(s): {path}')
    print(f'{len(report)} file(s) scrubbed, {touched} blur round(s) total')
