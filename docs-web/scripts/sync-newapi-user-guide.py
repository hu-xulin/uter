#!/usr/bin/env python3
"""Mirror the New API user-guide pages into docs-web as Markdown chapters.

For each chapter it fetches the rendered HTML (for the real image files) and
the MDX source (for the prose), downloads the screenshots the page uses,
re-encodes them as WebP, and writes a Markdown file whose `<img>` tags point
at the local files by name.
"""
from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path
from urllib.parse import unquote

from PIL import Image

from blur_brand import blur_brand_image

DOCS = Path(__file__).resolve().parent.parent
CACHE = Path(os.environ.get('NEWAPI_CACHE', '/tmp/newapi-cache'))
SITE = 'https://docs.newapi.pro'
MDX_SITE = 'https://docs2.newapi.pro'

# our chapter slug -> the source page slug under guide/feature-guide/user/
MAPPING = [
    ('auth', 'auth'),
    ('dashboard', 'dashboard'),
    ('profile-and-security', 'personal-setting'),
    ('api-keys', 'token'),
    ('api-and-playground', 'api'),
    ('app-integration', 'chat-apps'),
    ('logs-and-tasks', 'log'),
    ('wallet-and-subscription', 'wallet'),
    ('pricing-and-ranking', 'pricing'),
]

# Screenshots are 1900px wide but the docs column is ~700px, so 2x is plenty.
MAX_WIDTH = 1600
WEBP_QUALITY = 84

# Sentences whose only anchor upstream was a page this site does not publish.
# Left alone they would end up telling the reader to consult something that
# does not exist, so they are reworded to stand on their own.
DEVIATIONS = [
    (
        '3) **目前已验证支持的AI应用列表及配置指南请参阅[AI应用](/zh/docs/apps)页面。**',
        '3) **主流 AI 应用大多可通过上述自定义 API 的方式接入，具体以各应用官方的配置说明为准。**',
    ),
    (
        '3) **For a list of currently verified supported AI applications and configuration guides, please refer to the [AI Applications](/en/docs/apps) page.**',
        '3) **Most mainstream AI applications can be connected through the custom API described above; follow each application\'s own configuration guide.**',
    ),
]


def fetch_text(url: str, name: str) -> str:
    CACHE.mkdir(parents=True, exist_ok=True)
    dst = CACHE / name
    if dst.exists() and dst.stat().st_size > 0:
        return dst.read_text(encoding='utf-8')
    proc = subprocess.run(['curl', '-s', '--noproxy', '*', url], capture_output=True, text=True)
    if proc.returncode != 0 or not proc.stdout:
        raise SystemExit(f'fetch failed: {url}')
    dst.write_text(proc.stdout, encoding='utf-8')
    return proc.stdout


def valid_image(path: Path) -> bool:
    try:
        with Image.open(path) as image:
            image.load()
        return True
    except Exception:
        return False


def fetch_bytes(url: str, name: str) -> Path:
    """Download a screenshot, retrying until the bytes decode.

    A truncated body is the one failure worth retrying: it saves a plausible
    file that only blows up later, inside the encoder.
    """
    dst = CACHE / 'media' / name
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists() and dst.stat().st_size > 0 and valid_image(dst):
        return dst

    for attempt in range(4):
        dst.unlink(missing_ok=True)
        subprocess.run(
            ['curl', '-s', '-f', '--noproxy', '*', '--max-time', '90', '--retry', '2', '-o', str(dst), url],
            check=False,
        )
        if dst.exists() and dst.stat().st_size > 0 and valid_image(dst):
            return dst
        print(f'  ! retry {attempt + 1} for {name}')
    raise SystemExit(f'fetch failed (truncated): {url}')


def attr(tag: str, name: str) -> str | None:
    """A quoted attribute value, or the inside of a braced expression.

    The authoring tool emits `src={__img0}` rather than a string, so the value
    has to be read out of the braces too.
    """
    quoted = re.search(name + r'\s*=\s*"([^"]*)"', tag)
    if quoted:
        return quoted.group(1)
    braced = re.search(name + r'\s*=\s*\{\s*([^}]*?)\s*\}', tag)
    return braced.group(1) if braced else None


def content_images(html: str) -> list[dict]:
    """The page's own screenshots, in document order.

    Only the `<article>` is considered — the logo lives in the page chrome and
    is served from `/assets/`, not from the Next.js media directory.
    """
    article = re.search(r'<article\b.*?</article>', html, re.S)
    body = article.group(0) if article else html

    images = []
    for tag in re.findall(r'<img\b[^>]*>', body):
        src = attr(tag, 'src') or ''
        # `next/image` wraps the real file in `?url=<encoded>`
        encoded = re.search(r'[?&]url=([^&]+)', src)
        path = unquote(encoded.group(1)) if encoded else src
        if '/_next/static/media/' not in path:
            continue
        images.append({'alt': attr(tag, 'alt') or '', 'path': path})
    return images


def mdx_placeholders(mdx: str) -> list[dict]:
    """The `<img alt=... src={__imgN} />` tags, keyed by their placeholder index."""
    out = []
    for tag in re.findall(r'<img\b[^>]*>', mdx):
        src = attr(tag, 'src') or ''
        index = re.search(r'__img(\d+)', src)
        out.append({'index': int(index.group(1)) if index else None, 'alt': attr(tag, 'alt') or ''})
    return out


def media_stem(path: str) -> str:
    """`login.a539bc1d.png` -> `login` (the content hash is noise here)."""
    name = Path(path).name
    return re.sub(r'\.[0-9a-f]{6,}$', '', Path(name).stem)


def pair_images(placeholders: list[dict], images: list[dict], where: str) -> dict[int, dict]:
    """Match each `__imgN` to the screenshot with the same alt text.

    Alt text is the only thing both sides carry — the HTML has the real file
    but no placeholder name, and the MDX has the placeholder but no file. Order
    is the fallback when the alt texts are missing or repeated.
    """
    by_alt: dict[str, list[dict]] = {}
    for image in images:
        by_alt.setdefault(image['alt'], []).append(image)

    pairing: dict[int, dict] = {}
    leftovers = []
    for placeholder in placeholders:
        index = placeholder['index']
        if index is None:
            continue
        candidates = by_alt.get(placeholder['alt'], [])
        if candidates:
            pairing[index] = candidates.pop(0)
        else:
            leftovers.append(placeholder)

    if leftovers:
        # Alt text did not line up: fall back to document order for whatever
        # is left, and say so rather than silently dropping a screenshot.
        remaining = [i for i in images if i not in pairing.values()]
        print(f'  ! {where}: {len(leftovers)} placeholder(s) unmatched by alt, using order')
        for placeholder, image in zip(leftovers, remaining, strict=False):
            pairing[placeholder['index']] = image

    return pairing


def write_image(source: Path, target: Path) -> tuple[int, int]:
    with Image.open(source) as image:
        image = image.convert('RGB')
        if image.width > MAX_WIDTH:
            height = round(image.height * MAX_WIDTH / image.width)
            image = image.resize((MAX_WIDTH, height), Image.LANCZOS)
        # These are presented as this product's own documentation, so the
        # upstream brand in the capture's top-left corner never ships legible.
        image, _ = blur_brand_image(image)
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target, 'WEBP', quality=WEBP_QUALITY, method=6)
        return image.size


def fix_links(text: str) -> str:
    """Resolve the upstream's internal links without ever leaving the domain.

    These pages are read as this product's own documentation, so a link that
    leaves for the upstream docs site is a defect. A chapter this site also
    publishes keeps a relative link; a `→` pointer loses its whole label (the
    sentence already states the fact, and a link with nowhere to go is worse
    than no link); any other reference keeps its words as plain text.
    """
    text = re.sub(r'\s*\[[^\]]*→\]\(/(?:zh|en)/docs/[^)]*\)', '', text)
    text = re.sub(
        r'\[([^\]]+)\]\(/(?:zh|en)/docs/guide/feature-guide/user/token\)',
        r'[\1](../api-keys/)',
        text,
    )
    return re.sub(r'\[([^\]]+)\]\(/(?:zh|en)/docs/[^)]*\)', r'\1', text)


def apply_brand(text: str, brand: str) -> str:
    """Rename the upstream product to ours.

    The upstream name appears only as a way of referring to the platform
    itself, so every occurrence is a rename. Deliberately case-sensitive:
    `new-api-key-tool` and similar third-party project names are not the
    product and keep their spelling.
    """
    return re.sub(r'New\s?API', brand, text)


def build_markdown(mdx: str, files: dict[int, str], brand: str) -> str:
    text = '\n'.join(line for line in mdx.split('\n') if not re.match(r'^\s*import\s', line))

    for upstream, replacement in DEVIATIONS:
        text = text.replace(upstream, replacement)

    # The upstream page shows a token-shaped literal in its authentication
    # examples. A product's own documentation should not display something a
    # reader could mistake for a working credential, so it becomes a
    # placeholder — the same shape the SDK sample on the same page already uses.
    text = text.replace('sk-your-api-key', 'YOUR_API_KEY')

    def replace_image(match: re.Match) -> str:
        tag = match.group(0)
        alt = attr(tag, 'alt') or ''
        src = attr(tag, 'src') or ''
        index = re.search(r'__img(\d+)', src)
        name = files.get(int(index.group(1))) if index else None
        if not name:
            # No file: the renderer draws a labelled placeholder frame.
            return f'\n<img alt="{alt}" />\n'
        # Surrounded by blank lines so a screenshot indented inside a list item
        # breaks out of it and renders as the figure it is.
        return f'\n<img alt="{alt}" src="{name}" />\n'

    text = re.sub(r'<img\b[^>]*>', replace_image, text)
    text = re.sub(r'<br\s*/?>', ' ', text)
    text = fix_links(text)
    text = apply_brand(text, brand)
    text = re.sub(r'[ \t]+\n', '\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip() + '\n'


BRAND = {'zh': '优特智能', 'en': 'Uter.ai'}


def main() -> None:
    for locale in ('zh', 'en'):
        print(f'===== {locale}')
        for slug, source in MAPPING:
            html = fetch_text(f'{SITE}/{locale}/docs/guide/feature-guide/user/{source}', f'{locale}-{source}.html')
            mdx = fetch_text(f'{MDX_SITE}/{locale}/llms.mdx/guide/feature-guide/user/{source}', f'{locale}-{source}.mdx')

            placeholders = mdx_placeholders(mdx)
            images = content_images(html)
            pairing = pair_images(placeholders, images, f'{locale}/{source}')

            files: dict[int, str] = {}
            for index in sorted(pairing):
                image = pairing[index]
                raw = fetch_bytes(f'{SITE}{image["path"]}', Path(image['path']).name)
                name = f'{index + 1:02d}-{media_stem(image["path"])}.webp'
                size = write_image(raw, DOCS / 'public/user-guide' / locale / slug / name)
                files[index] = name
                print(f'  {slug:22} {name:26} {size[0]}x{size[1]}')

            markdown = build_markdown(mdx, files, BRAND[locale])
            target = DOCS / 'content/user-guide' / locale / f'{slug}.md'
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(markdown, encoding='utf-8')

            missing = [p['index'] for p in placeholders if p['index'] is not None and p['index'] not in files]
            flag = f'  [unresolved {missing}]' if missing else ''
            print(f'  -> {target.relative_to(DOCS)}  images={len(files)}/{len(placeholders)}{flag}')


if __name__ == '__main__':
    main()
