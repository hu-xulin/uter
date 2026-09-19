#!/usr/bin/env python3
"""Locate upstream brand occurrences inside screenshots using macOS Vision OCR.

The brand appears in two places that have to be dealt with differently:

  - the capture's own top-left chrome (handled by `blur_brand.py`);
  - text inside a screenshot — a provider entry in a third-party app's list,
    a terminal command, a URL. Those are anywhere on the canvas, so they can
    only be found by reading the image.

Vision returns normalised boxes with the origin at the bottom-left; they are
converted to pixel boxes with the origin at the top-left to match Pillow.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import Vision
from Foundation import NSURL
from PIL import Image

# "New API" as a product name, in any case or spacing the renderer produced.
PATTERN = re.compile(r'new[\s\-_]*api', re.I)


def recognize(path: Path) -> list[tuple[str, tuple[float, float, float, float]]]:
    """(text, normalised box) for every recognised line in the image."""
    handler = Vision.VNImageRequestHandler.alloc().initWithURL_options_(
        NSURL.fileURLWithPath_(str(path)), None
    )
    request = Vision.VNRecognizeTextRequest.alloc().init()
    request.setRecognitionLevel_(0)  # VNRequestTextRecognitionLevelAccurate
    request.setRecognitionLanguages_(['en-US', 'zh-Hans'])
    request.setUsesLanguageCorrection_(False)
    request.setMinimumTextHeight_(0.0)
    handler.performRequests_error_([request], None)

    results = request.results() or []
    out = []
    for observation in results:
        candidates = observation.topCandidates_(1)
        if not candidates:
            continue
        box = observation.boundingBox()
        out.append(
            (candidates[0].string(), (box.origin.x, box.origin.y, box.size.width, box.size.height))
        )
    return out


def to_pixels(norm: tuple[float, float, float, float], width: int, height: int) -> tuple[int, int, int, int]:
    """Normalised (origin bottom-left) -> pixel (x0, y0, x1, y1, top-left)."""
    x, y, w, h = norm
    return (
        int(x * width),
        int((1 - y - h) * height),
        int((x + w) * width),
        int((1 - y) * height),
    )


def hits(path: Path) -> list[tuple[str, tuple[int, int, int, int]]]:
    """Brand text occurrences in this image, as pixel boxes."""
    with Image.open(path) as image:
        width, height = image.size
    found = []
    for text, norm in recognize(path):
        if PATTERN.search(text):
            found.append((text, to_pixels(norm, width, height)))
    return found


if __name__ == '__main__':
    for arg in sys.argv[1:]:
        for text, box in hits(Path(arg)):
            print(f'{arg}\t{box}\t{text}')
