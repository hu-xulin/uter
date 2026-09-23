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

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

from blur_brand import blur_boxes  # noqa: E402
from find_brand_text import hits  # noqa: E402

# A brand wordmark often sits right of its logo glyph. When a text hit is
# found, the strip this far to its left is scanned for a coloured blob and
# blurred together with the text.
LOGO_LOOKBACK = 110


def _logo_left_box(path: Path, box: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    """Extend a text hit left over an adjacent logo blob, if one is there."""
    with Image.open(path) as source:
        image = source.convert('RGB')
    x0, y0, x1, y1 = box
    zone_x0 = max(0, x0 - LOGO_LOOKBACK)
    if zone_x0 == x0:
        return box
    zone = image.crop((zone_x0, y0, x0, y1)).convert('HSV')
    px = zone.load()
    pts = [
        (x, y)
        for y in range(zone.height)
        for x in range(zone.width)
        if px[x, y][1] >= 45 and px[x, y][2] >= 70
    ]
    if len(pts) < 8:
        return box
    return (zone_x0 + min(x for x, _ in pts), y0, x1, y1)


def scrub_file(path: Path, max_rounds: int = 4) -> int:
    """Blur all brand text in one image. Returns rounds of blurring applied."""
    for round_index in range(max_rounds):
        boxes = [box for _, box in hits(path)]
        # A hit far larger than the words it names is an OCR misread;
        # blurring it would erase a whole region of content for nothing.
        with Image.open(path) as image:
            limit_w, limit_h = image.width * 0.3, image.height * 0.2
        boxes = [
            box
            for box in boxes
            if box[2] - box[0] <= limit_w and box[3] - box[1] <= limit_h
        ]
        if not boxes:
            return round_index
        # Pull an adjacent logo into each text hit, then blur each region on
        # its own: merging chains every word along a toolbar row into one
        # strip and erases the row instead of the brand.
        regions = [_logo_left_box(path, box) for box in boxes]
        blur_boxes(path, regions, pad=6, merge=False)
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
