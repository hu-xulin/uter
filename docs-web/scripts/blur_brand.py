#!/usr/bin/env python3
"""Blur the upstream brand (logo + "New API" wordmark) in user-guide screenshots.

The screenshots mirrored from upstream carry the upstream product's brand in
the top-left corner of every full-page capture. This site presents them as
its own documentation, so the brand must not stay legible.

Detection is colour-based: the brand logo is the only strongly saturated
violet/pink/blue cluster in the top-left band. Once the logo is located, the
wordmark is the run of dark pixels to its right on the same baseline. The
combined box is destroyed beyond reconstruction (heavy downscale + blur) and
pasted back through a feathered mask so no hard seam is visible.

Images without the brand in the corner (cropped panels, pages whose capture
starts below the header) are left untouched — there is nothing to hide.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

# Top-left search band, as a fraction of the image size.
BAND_W = 0.30
BAND_H = 0.10

# The logo is a violet→pink→blue gradient circle. Hue window (PIL HSV maps
# 0-360° onto 0-255): cyan-blue ≈ 140, through violet/pink, up to rose ≈ 250.
# Deliberately excludes pure red (≈0/255) — the docs' own annotation boxes
# are red and must survive.
HUE_LO, HUE_HI = 140, 250
SAT_MIN = 45
VAL_MIN = 70
MIN_CLUSTER = 8  # pixels; stray anti-aliased coloured UI must not trigger

# The logo glyph is a compact blob ~16-20px across (up to ~28px on the mobile
# captures). Cluster points are kept only near the seed — the topmost-leftmost
# coloured pixel — so pink/red annotation graphics elsewhere in the band can
# never inflate the box.
LOGO_SPAN_X = 40
LOGO_SPAN_Y = 36

# The wordmark scan walks right over dark pixels and stops at the first gap
# wider than this, so far-away dark UI text is never pulled in.
WORDMARK_GAP = 12

PAD_X, PAD_Y = 8, 6

# Only full-page captures (and the wide mobile leaderboard) carry the brand
# chrome. Narrow panel crops from the personal-settings chapter are content
# from edge to edge; their coloured icons must never be touched.
MIN_BLUR_WIDTH = 1100

# Blue→violet half of the logo gradient. The mark always carries these hues;
# a coloured blob that has none is something else — a macOS close button is
# rose-red only, an emoji or status dot rarely reaches blue.
HUE_CORE_LO, HUE_CORE_HI = 140, 205
MIN_CORE = 6


def _brand_box(image: Image.Image) -> tuple[int, int, int, int] | None:
    """Locate logo + wordmark in the top-left band, or None if absent."""
    band = image.crop((0, 0, int(image.width * BAND_W), int(image.height * BAND_H)))
    hsv = band.convert('HSV')
    px = hsv.load()

    pts = [
        (x, y)
        for y in range(band.height)
        for x in range(band.width)
        if HUE_LO <= px[x, y][0] <= HUE_HI and px[x, y][1] >= SAT_MIN and px[x, y][2] >= VAL_MIN
    ]
    if len(pts) < MIN_CLUSTER:
        return None

    # Seed on the topmost-leftmost coloured pixel and keep only the compact
    # blob around it — that blob is the logo glyph.
    sx, sy = min(pts, key=lambda p: (p[1], p[0]))
    cluster = [
        (x, y)
        for x, y in pts
        if abs(x - sx) <= LOGO_SPAN_X and sy - 6 <= y <= sy + LOGO_SPAN_Y
    ]
    if len(cluster) < MIN_CLUSTER:
        return None

    # Guard 1 — the mark must carry its blue/violet half. Without this the
    # rose-red macOS close button qualifies (hue ≈250 sits inside the
    # rose end of the search window) and gets destroyed instead of the logo.
    core = sum(1 for x, y in cluster if HUE_CORE_LO <= px[x, y][0] <= HUE_CORE_HI)
    if core < MIN_CORE:
        return None

    # Guard 2 — traffic lights. A rose-red blob with yellow and green discs
    # beside it on the same row is window chrome, never the brand.
    yellow = green = 0
    for y in range(max(0, sy - 10), min(band.height, sy + LOGO_SPAN_Y + 10)):
        for x in range(sx, min(band.width, sx + 150)):
            hue, sat = px[x, y][0], px[x, y][1]
            if sat < SAT_MIN:
                continue
            if 30 <= hue <= 55:
                yellow += 1
            elif 70 <= hue <= 100:
                green += 1
    if yellow > 15 and green > 15:
        return None

    lx0 = min(x for x, _ in cluster)
    lx1 = max(x for x, _ in cluster)
    ly0 = min(y for _, y in cluster)
    ly1 = max(y for _, y in cluster)

    # The wordmark: a contiguous run of dark pixels to the right of the logo
    # on the same baseline, ending at the first wide gap.
    rgb = band.convert('RGB').load()
    tx1 = lx1
    gap = 0
    for x in range(lx1 + 3, band.width):
        hit = any(
            sum(rgb[x, y]) / 3 < 120
            for y in range(max(0, ly0 - 3), min(band.height, ly1 + 3))
        )
        if hit:
            tx1, gap = x, 0
        else:
            gap += 1
            if gap > WORDMARK_GAP:
                break

    box = (
        max(0, lx0 - PAD_X),
        max(0, ly0 - PAD_Y),
        min(image.width, tx1 + PAD_X + 2),
        min(image.height, ly1 + PAD_Y + 2),
    )
    return box if _looks_like_brand(box, image, rgb, lx1, tx1, ly0, ly1) else None


def _looks_like_brand(
    box: tuple[int, int, int, int],
    image: Image.Image,
    band_px,
    lx1: int,
    tx1: int,
    ly0: int,
    ly1: int,
) -> bool:
    """Two guards against blurring page content instead of the brand.

    1. The brand always starts within the left 18% of the capture — the only
       brand further right is on pages without a sidebar (定价, x≈0.18w).
       Content false positives (red annotation callouts, panel headers) start
       further in.
    2. The wordmark is printed in neutral dark grey. A candidate whose dark
       wordmark pixels are strongly chromatic is a coloured annotation, not
       the wordmark.
    """
    x0, _, _, _ = box
    if x0 >= 0.18 * image.width:
        return False

    dark = neutral = 0
    # `band_px` indexes the top-left band, not the whole image: the y bound
    # is the band's own height (BAND_H of the image), so a wordmark sitting
    # at the bottom of the band cannot walk off the end of the band.
    band_h = int(image.height * BAND_H)
    for x in range(lx1 + 3, tx1 + 1):
        for y in range(max(0, ly0 - 3), min(band_h, ly1 + 3)):
            r, g, b = band_px[x, y][:3]
            if (r + g + b) / 3 < 120:
                dark += 1
                if max(r, g, b) - min(r, g, b) < 40:
                    neutral += 1
    return dark == 0 or neutral / dark >= 0.5


def _destroy(region: Image.Image) -> Image.Image:
    """Make the region unrecoverable: heavy pixelation followed by blur."""
    w, h = region.size
    tiny = region.resize((max(1, w // 16), max(1, h // 16)), Image.LANCZOS)
    out = tiny.resize((w, h), Image.LANCZOS)
    return out.filter(ImageFilter.GaussianBlur(max(4, h / 5)))


def blur_brand_image(image: Image.Image) -> tuple[Image.Image, bool]:
    """Return the image with the brand destroyed, plus whether a blur happened."""
    if image.width < MIN_BLUR_WIDTH:
        return image, False
    box = _brand_box(image)
    if box is None:
        return image, False

    x0, y0, x1, y1 = box
    masked = Image.new('L', image.size, 0)
    ImageDraw.Draw(masked).rounded_rectangle(box, radius=6, fill=255)
    masked = masked.filter(ImageFilter.GaussianBlur(3))

    blurred = image.copy()
    blurred.paste(_destroy(image.crop(box)), (x0, y0))
    return Image.composite(blurred, image, masked), True


def blur_boxes(
    path: Path, boxes: list[tuple[int, int, int, int]], pad: int = 8, merge: bool = True
) -> int:
    """Destroy every box (pixel coords) in the image, in place.

    Overlapping boxes are merged first so nested hits don't get blurred
    twice — but merging is opt-out (`merge=False`): OCR word boxes sitting
    on the same toolbar row chain-merge through the padding into one strip
    that erases far more than the words, so text scrubbing blurs each hit
    on its own instead. Returns the number of regions destroyed.
    """
    with Image.open(path) as source:
        image = source.convert('RGB')

    merged: list[list[int]] = []
    for x0, y0, x1, y1 in boxes:
        x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
        x1, y1 = min(image.width, x1 + pad), min(image.height, y1 + pad)
        if not merge:
            merged.append([x0, y0, x1, y1])
            continue
        for region in merged:
            if x0 < region[2] and x1 > region[0] and y0 < region[3] and y1 > region[1]:
                region[0] = min(region[0], x0)
                region[1] = min(region[1], y0)
                region[2] = max(region[2], x1)
                region[3] = max(region[3], y1)
                break
        else:
            merged.append([x0, y0, x1, y1])
    if not merged:
        return 0

    masked = Image.new('L', image.size, 0)
    for region in merged:
        ImageDraw.Draw(masked).rounded_rectangle(region, radius=5, fill=255)
    masked = masked.filter(ImageFilter.GaussianBlur(2))

    blurred = image.copy()
    for region in merged:
        blurred.paste(_destroy(image.crop(tuple(region))), (region[0], region[1]))
    Image.composite(blurred, image, masked).save(path, 'WEBP', quality=84, method=6)
    return len(merged)


def blur_brand(path: Path) -> bool:
    """Blur the brand in place. Returns True when a blur was applied."""
    with Image.open(path) as source:
        image = source.convert('RGB')
    blurred, changed = blur_brand_image(image)
    if changed:
        blurred.save(path, 'WEBP', quality=84, method=6)
    return changed
