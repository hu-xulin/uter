#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate the docs site's "features / apps / api / legal" content from the
upstream documentation repository.

Upstream publishes its documentation sources in a public Git repository
(Uter.ai/uter-docs-v1). That repository is a far better source than
the rendered site: the API reference's parameter tables are generated at
request time from OpenAPI documents that the site never serves as HTML, so
scraping the site yields endpoint pages with empty bodies. The repository
ships both the page sources and the `openapi/generated/**` documents the
tables come from.

    python3 scripts/sync-upstream-docs.py [--upstream DIR] [--skip-images]

Writes into this repository:

    content/features/<locale>.md           特性说明
    content/apps/<locale>/<slug>.md        AI 应用，附 _nav.json
    content/api/<locale>/<group>.md        API 参考（每组一页），附 _nav.json
    content/legal/<locale>/<doc>.md        用户协议 / 隐私政策 / 充值协议
    public/apps-assets/**                  AI 应用截图（转 WebP）

Re-running is safe: output is derived from the upstream sources alone.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DOCS = HERE.parent
UPSTREAM_DEFAULT = Path(os.environ.get('UPSTREAM_SRC', '/tmp/upstream'))
CACHE = Path(os.environ.get('UPSTREAM_CACHE', '/tmp/upstream-cache'))
RAW = 'https://raw.githubusercontent.com/Uter.ai/uter-docs-v1/main'
LOCALES = ('zh', 'en')

# Brand: the upstream product name never appears in our documentation.
# 中文品牌全称「优特智能」，英文品牌全称「Uter.ai」（2026-09-20 定）。
BRAND = {'zh': '优特智能', 'en': 'Uter.ai'}

# Legal documents are our own; they live with the rest of the brand material.
# ⚠️ 只有中文源。英文法务页（content/legal/en/**）是独立人工译稿，见 sync_legal()。
LEGAL_SOURCE = {
    'user-agreement': Path.home()
    / 'WorkBuddy/2026-09-18-11-15-09/legal/优特智能大模型服务平台用户协议.md',
    'privacy-policy': Path.home()
    / 'WorkBuddy/2026-09-18-11-15-09/legal/优特智能大模型服务平台隐私政策.md',
    'recharge-agreement': Path.home()
    / 'WorkBuddy/2026-09-18-11-15-09/legal/优特智能大模型服务平台充值协议.md',
}

# 法务中文源同时充当内部工作母本：正文之后挂有「待确认事项清单（内部用）」
# 附录与草案免责声明，绝不能出现在公开页面。发布前一律剥离，源文件保持完整。
INTERNAL_HEADING = re.compile(r'^##\s+附录\s*待确认事项清单（内部用', re.M)
INTERNAL_TOC = re.compile(r'^- 附录.*（内部用.*）[ \t]*$\n?', re.M)

MAX_WIDTH = 1600
WEBP_QUALITY = 84


# ── helpers ────────────────────────────────────────────────────────────


def fetch_bytes(url: str, dest: Path) -> Path:
    """Download with retries; a truncated image is worse than a failure."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(4):
        subprocess.run(
            ['curl', '-sL', '--noproxy', '*', '--max-time', '90', '-o', str(dest), url],
            check=False,
        )
        if dest.exists() and dest.stat().st_size > 0:
            return dest
    raise SystemExit(f'download failed: {url}')


def front_matter(text: str) -> tuple[dict, str]:
    """Split a `---` delimited YAML block. Only `title`/`description` are read."""
    match = re.match(r'^\ufeff?---\n(.*?)\n---\n?', text, re.S)
    if not match:
        return {}, text
    meta = {}
    for line in match.group(1).split('\n'):
        m = re.match(r'^([A-Za-z_]+):\s*(.*)$', line)
        if m:
            meta[m.group(1)] = m.group(2).strip().strip('"\'')
    return meta, text[match.end():]


def strip_mdx(text: str) -> str:
    """Reduce MDX to the Markdown subset this site renders.

    The upstream pages use exactly two components — `<Callout>` and
    `<Cards>` — so the conversion is small and total: a Callout becomes a
    blockquote (its title, when present, is the quote's first bold line)
    and a `<Cards>` grid becomes a bullet list of links.
    """
    # Generated-file banners and imports carry no prose. Imports span
    # several lines when they pull a list of icons, so the statement is
    # consumed up to its `from '…';` rather than dropped line by line.
    text = re.sub(r'\{/\*.*?\*/\}', '', text, flags=re.S)
    lines: list[str] = []
    skipping = False
    for line in text.split('\n'):
        if re.match(r'^\s*import\s', line):
            skipping = not bool(re.search(r"from\s+['\"]", line))
            continue
        if skipping:
            if re.search(r"from\s+['\"]", line) or line.rstrip().endswith(';'):
                skipping = False
            continue
        lines.append(line)
    text = '\n'.join(lines)

    # <Cards> … <Card title="…" description="…" href="…" /> … </Cards>
    def cards(match: re.Match) -> str:
        out = []
        for card in re.finditer(
            r'<Card\b[^>]*?title="([^"]*)"[^>]*?description="([^"]*)"[^>]*?href="([^"]*)"',
            match.group(0),
            re.S,
        ):
            title, desc, href = card.groups()
            out.append(f'- [{title}]({href}) — {desc}')
        return '\n'.join(out)

    text = re.sub(r'<Cards>.*?</Cards>', cards, text, flags=re.S)

    # <Callout title="…"> … </Callout>
    def callout(match: re.Match) -> str:
        attrs, body = match.group(1), match.group(2).strip()
        title = re.search(r'title="([^"]*)"', attrs)
        lines = []
        if title:
            lines.append(f'**{title.group(1)}**')
            lines.append('')
        lines.append(body)
        quoted = '\n'.join('> ' + l if l else '>' for l in '\n'.join(lines).split('\n'))
        return '\n\n' + quoted + '\n'

    text = re.sub(r'<Callout([^>]*)>(.*?)</Callout>', callout, text, flags=re.S)

    # Leftovers from components this conversion does not model.
    text = re.sub(r'</?(?:Card|Cards|Steps|Step|Tabs|Tab)\b[^>]*>', '', text)
    text = re.sub(r'<br\s*/?>', ' ', text)
    text = re.sub(r'^\s*<(?:img|span|div)\b[^>]*>\s*$', '', text, flags=re.M)
    return text


def rewrite_links(text: str, locale: str) -> str:
    """Point upstream doc links at this site's pages, or drop them.

    Only the apps and guide sections are published here. Anything else the
    upstream pages link to (their API reference, their admin guide) is not,
    so the link text is kept and the address is removed — a sentence that
    names a feature reads fine without a pointer to a page we do not have.
    """
    published = re.compile(rf'^/{locale}/docs/(apps|guide/wiki/basic-concepts)/?')

    def replace(match: re.Match) -> str:
        bang, label, url = match.group(1), match.group(2), match.group(3)
        # An image is not a link to a page; its address is rewritten later,
        # by `localise_assets`, not here.
        if bang:
            return match.group(0)
        # Anything served by upstream — their docs, their Apifox
        # playground — is not part of this site. Keeping the words and
        # dropping the address leaves a sentence that still reads, rather
        # than a link that leaves the reader on someone else's product.
        if 'uter' in url.lower():
            return label
        if not url.startswith('/'):
            return match.group(0)
        m = published.match(url)
        if not m:
            return label
        rest = url[m.end():]
        if m.group(1) == 'apps':
            target = f'/docs/{locale}/apps' + (f'/{rest}' if rest else '')
        else:
            # basic-concepts: only 特性说明 is published.
            target = f'/docs/{locale}/guide/wiki/basic-concepts/{rest}' if rest else f'/docs/{locale}'
        return f'[{label}]({target})'

    return re.sub(r'(!?)\[([^\]]*)\]\(([^)]+)\)', replace, text)


# Deliberately does not match a lowercase hyphenated `uter`: that is
# part of third-party project names (`uter-key-tool`) and of the
# upstream repository's own URL, none of which are the product.
BRAND_PATTERN = re.compile(r'New\s?-?API')
LINK_PATTERN = re.compile(r'(!?)\[([^\]]*)\]\(([^)]*)\)')
URL_PATTERN = re.compile(r'https?://\S+')


def apply_brand(text: str, brand: str) -> str:
    """Rename the upstream product.

    Applied to prose and to link *labels*, never to addresses: the upstream
    domain appears in screenshot filenames (`uter-manual-guidance.png`)
    and in third-party project URLs (`uter-key-tool`), both of which
    have to keep their real names to keep pointing at the same thing.
    """

    def rename(fragment: str) -> str:
        def swap(match: re.Match) -> str:
            whole = match.group(0)
            # A hyphenated run inside a path or a repository name.
            if '-' in whole and re.match(r'^[a-z-]+$', whole):
                return whole
            return brand

        out = []
        pos = 0
        for m in URL_PATTERN.finditer(fragment):
            out.append(BRAND_PATTERN.sub(swap, fragment[pos:m.start()]))
            out.append(m.group(0))
            pos = m.end()
        out.append(BRAND_PATTERN.sub(swap, fragment[pos:]))
        return ''.join(out)

    def sub(match: re.Match) -> str:
        bang, label, url = match.groups()
        return f'{bang}[{BRAND_PATTERN.sub(brand, label)}]({url})'

    out = LINK_PATTERN.sub(sub, rename(text))
    if brand.startswith('优特'):
        # "Uter 提供完整的…" becomes "优特智能 提供完整的…"; Chinese sets
        # the next word without a space, so the one the English name needed
        # is dropped when what follows is Chinese.
        out = re.sub(rf'{re.escape(brand)}\s+(?=[\u4e00-\u9fff（【])', brand, out)
    return out


def finalise(text: str, locale: str) -> str:
    text = strip_mdx(text)
    text = rewrite_links(text, locale)
    text = apply_brand(text, BRAND[locale])
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip() + '\n'


# ── images ─────────────────────────────────────────────────────────────


def collect_assets(texts: list[str]) -> set[str]:
    """`/assets/...` paths the generated pages actually reference."""
    found = set()
    for text in texts:
        for m in re.finditer(r'!\[[^\]]*\]\((/assets/[^)]+)\)', text):
            found.add(m.group(1))
        for m in re.finditer(r'url\((/assets/[^)]+)\)', text):
            found.add(m.group(1))
    return found


def safe_name(text: str) -> str:
    """A filename Go's `//go:embed` accepts.

    `web/dist` is embedded into the server binary, and `go:embed` rejects
    any path containing a character outside its safe set — which includes
    the em dash upstream uses in `aionui—logo.png`. Renaming at the point
    of import is the only fix that survives a re-sync.
    """
    return re.sub(r'[^A-Za-z0-9._/-]', '-', text)


def sync_assets(paths: set[str], skip: bool) -> int:
    """Mirror `/assets/**` into `public/apps-assets/**`, converting to WebP."""
    out_dir = DOCS / 'public/apps-assets'
    done = 0
    for rel in sorted(paths):
        src_rel = rel[len('/assets/'):]
        stem = Path(src_rel).with_suffix('')
        dest = out_dir / f'{safe_name(str(stem))}.webp'
        if dest.exists():
            done += 1
            continue
        if skip:
            continue
        raw = fetch_bytes(f'{RAW}/public/assets/{src_rel}', CACHE / 'assets' / src_rel)
        try:
            from PIL import Image

            from blur_brand_text import scrub_file

            with Image.open(raw) as img:
                img = img.convert('RGBA') if img.mode in ('P', 'LA') else img
                if img.width > MAX_WIDTH:
                    ratio = MAX_WIDTH / img.width
                    img = img.resize((MAX_WIDTH, int(img.height * ratio)), Image.LANCZOS)
                dest.parent.mkdir(parents=True, exist_ok=True)
                img.save(dest, 'WEBP', quality=WEBP_QUALITY, method=6)
            # Brand text inside the picture — provider entries, terminal
            # commands, example URLs — must never ship legible either.
            scrub_file(dest)
        except Exception:
            # SVG and other non-raster assets are copied verbatim.
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(raw, dest)
        done += 1
    return done


def localise_assets(text: str) -> str:
    """`/assets/foo/bar.png` → `/apps-assets/foo/bar.webp`."""
    def swap(match: re.Match) -> str:
        stem = Path(match.group(1)).with_suffix('')
        return f'(/apps-assets/{safe_name(str(stem))}.webp)'

    return re.sub(r'\(/assets/([^)]+)\)', swap, text)


# ── OpenAPI → Markdown ─────────────────────────────────────────────────

# Legacy operations confirmed obsolete by the Uter API contract owner.
# Filter by path (not method) because historical upstream docs disagree on
# the WeChat bind method; neither variant is a supported current contract.
REMOVED_API_PATHS = {
    '/api/oauth/wechat/bind',
    '/api/verify/status',
}


def should_skip_api_path(path: str) -> bool:
    """Return whether an upstream API operation is retired by this repository."""
    return path in REMOVED_API_PATHS


TYPE_LABELS = {
    'string': 'string', 'integer': 'integer', 'number': 'number',
    'boolean': 'boolean', 'array': 'array', 'object': 'object',
}


def type_of(schema: dict | None) -> str:
    if not isinstance(schema, dict):
        return '—'
    if 'enum' in schema:
        values = ', '.join(f'`{v}`' for v in schema['enum'][:6])
        extra = ' …' if len(schema['enum']) > 6 else ''
        return f'enum（{values}{extra}）'
    node = schema
    if 'type' not in node and isinstance(node.get('oneOf'), list) and node['oneOf']:
        node = node['oneOf'][0]
    kind = node.get('type')
    if isinstance(kind, list):
        kind = next((k for k in kind if k != 'null'), kind[0])
    if kind == 'array':
        return f'array&lt;{type_of(node.get("items"))}&gt;'
    if kind == 'object':
        return 'object'
    label = TYPE_LABELS.get(kind, kind or '—')
    if node.get('format'):
        label = f'{label}（{node["format"]}）'
    return str(label)


def flatten(schema: dict | None, prefix: str, required: set, rows: list, depth: int = 0):
    """One table row per leaf field; objects recurse into `a.b` names."""
    if not isinstance(schema, dict) or depth > 3:
        return
    node = schema
    if 'properties' not in node:
        if isinstance(node.get('oneOf'), list) and node['oneOf']:
            node = node['oneOf'][0]
        elif isinstance(node.get('allOf'), list):
            merged = {}
            for part in node['allOf']:
                if isinstance(part, dict):
                    merged.update(part.get('properties') or {})
            node = {**node, 'properties': merged}
    props = node.get('properties') or {}
    if not props:
        return
    order = node.get('x-apifox-orders') or list(props)
    names = [n for n in order if n in props] + [n for n in props if n not in order]
    for name in names:
        sub = props[name] or {}
        path = f'{prefix}.{name}' if prefix else name
        if isinstance(sub, dict) and (sub.get('properties') or sub.get('oneOf')):
            flatten(sub, path, required, rows, depth + 1)
            continue
        desc = str(sub.get('description') or '').replace('\n', ' ').replace('|', '/')
        rows.append([f'`{path}`', type_of(sub), '是' if path in required or name in required else '否', desc])


def table(header: list[str], rows: list[list[str]]) -> str:
    if not rows:
        return ''
    out = ['| ' + ' | '.join(header) + ' |', '|' + '|'.join(['---'] * len(header)) + '|']
    for row in rows:
        cells = [(c or '—') for c in row]
        out.append('| ' + ' | '.join(cells) + ' |')
    return '\n'.join(out)


def endpoint_markdown(path: str, method: str, op: dict, title: str) -> str:
    """Render one operation as a `##` section: method, path, params, body, responses."""
    lines = [f'## {title}', '']
    desc = str(op.get('description') or op.get('summary') or '').strip()
    if desc and desc != title:
        lines += [desc, '']
    lines += [f'`{method.upper()}` `{path}`', '']

    params = op.get('parameters') or []
    if params:
        rows = []
        for p in params:
            if not isinstance(p, dict):
                continue
            rows.append([
                f'`{p.get("name", "")}`', str(p.get('in', '')),
                type_of(p.get('schema')), '是' if p.get('required') else '否',
                str(p.get('description') or '').replace('\n', ' ').replace('|', '/'),
            ])
        block = table(['参数名', '位置', '类型', '必填', '说明'], rows)
        if block:
            lines += ['### 请求参数', '', block, '']

    body = op.get('requestBody') or {}
    for media, payload in (body.get('content') or {}).items():
        schema = (payload or {}).get('schema') or {}
        rows = []
        flatten(schema, '', set(schema.get('required') or []), rows)
        block = table(['字段', '类型', '必填', '说明'], rows)
        if block:
            lines += [f'### 请求体（`{media}`）', '', block, '']
        example = (payload or {}).get('example')
        if example is not None:
            lines += ['```json', json.dumps(example, ensure_ascii=False, indent=2), '```', '']

    responses = op.get('responses') or {}
    if responses:
        lines += ['### 响应', '']
        rows = [[f'`{code}`', str((resp or {}).get('description') or '').replace('\n', ' ').replace('|', '/')]
                for code, resp in responses.items()]
        lines += [table(['状态码', '说明'], rows), '']
        for code, resp in responses.items():
            for media, payload in ((resp or {}).get('content') or {}).items():
                schema = (payload or {}).get('schema') or {}
                rows = []
                flatten(schema, '', set(), rows)
                if rows:
                    lines += [f'#### `{code}` 响应字段', '', table(['字段', '类型', '说明'],
                                                                 [[r[0], r[1], r[3]] for r in rows]), '']
    return '\n'.join(lines).rstrip() + '\n'


def operation_for(spec: dict, wanted: list) -> tuple[str, str, dict] | None:
    for path, ops in (spec.get('paths') or {}).items():
        for method, op in ops.items():
            if not isinstance(op, dict):
                continue
            if not wanted:
                return path, method, op
            for w in wanted:
                if w.get('path') == path and w.get('method', '').lower() == method.lower():
                    return path, method, op
    return None


# ── sections ───────────────────────────────────────────────────────────


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}


def sync_features(upstream: Path, texts: list) -> None:
    for locale in LOCALES:
        src = upstream / f'content/docs/{locale}/guide/wiki/basic-concepts/features-introduction.mdx'
        meta, body = front_matter(src.read_text(encoding='utf-8'))
        title = meta.get('title') or ('特性说明' if locale == 'zh' else 'Features')
        out = f'# {title}\n\n' + body
        out = finalise(out, locale)
        write(DOCS / f'content/features/{locale}.md', out)
        texts.append(out)


def sync_apps(upstream: Path, texts: list) -> None:
    for locale in LOCALES:
        root = upstream / f'content/docs/{locale}/apps'
        meta = load_json(root / 'meta.json')
        order = meta.get('pages') or sorted(p.stem for p in root.glob('*.mdx'))
        nav = []
        for slug in order:
            src = root / f'{slug}.mdx'
            if not src.exists():
                continue
            fm, body = front_matter(src.read_text(encoding='utf-8'))
            title = fm.get('title') or slug
            # Front matter is stripped before `finalise()` sees the body,
            # so the blurb has to be renamed here — it is read as often as
            # the page itself, as the card teaser on the landing page.
            description = apply_brand(fm.get('description') or '', BRAND[locale])
            out = f'# {title}\n\n' + body
            out = finalise(out, locale)
            write(DOCS / f'content/apps/{locale}/{slug}.md', out)
            texts.append(out)
            nav.append({'id': slug, 'title': title, 'description': description})
        write(DOCS / f'content/apps/{locale}/_nav.json',
              json.dumps(nav, ensure_ascii=False, indent=2) + '\n')
        print(f'  apps/{locale}: {len(nav)} 页')


# Groups kept out of the site. 文件（Files）is an upstream stub: the
# endpoint was never implemented, so the page only says so.
SKIP_GROUPS = {'ai-model/unimplemented/files'}

# Upstream keeps several protocol variants of one operation in a single
# directory — 补全 / 嵌入 / 列出模型 — unlike 音频 / 聊天 / 图像 / 视频,
# which it already splits one sub-directory per protocol. These are split
# the same way, so the sidebar can list 原生OpenAI格式 / 原生Gemini格式
# under the group instead of one page holding every variant.
FORMAT_SPLIT = {
    'ai-model/completions',
    'ai-model/embeddings',
    'ai-model/models/list',
}

# The protocol a format page is named after, in the order they are tried.
FORMAT_TOKENS = ('OpenAI', 'Gemini', 'Claude', 'Anthropic', 'Qwen')


def format_slug(title: str) -> str:
    """`原生OpenAI格式` → `openai`: the protocol to name the page after."""
    for token in FORMAT_TOKENS:
        if token.lower() in title.lower():
            return token.lower()
    return re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-') or 'format'


def sync_api(upstream: Path, texts: list) -> None:
    """One page per upstream directory that holds endpoint sources.

    Upstream publishes one page per endpoint. Reproducing that would put
    ~200 entries in the sidebar, where a flat list stops being navigation
    and becomes a wall. Endpoints are therefore grouped by their
    directory — which is exactly how upstream's own sidebar groups them —
    and each endpoint is an `h2` of its group's page, so it still has a
    deep link and a table-of-contents entry.
    """
    for locale in LOCALES:
        root = upstream / f'content/docs/{locale}/api'
        groups: dict[str, list[Path]] = {}
        for mdx in sorted(root.rglob('*.mdx')):
            if mdx.name == 'index.mdx':
                continue
            rel = mdx.relative_to(root)
            groups.setdefault(str(rel.parent) if str(rel.parent) != '.' else 'index', []).append(mdx)

        nav = []
        for key in sorted(groups):
            if key in SKIP_GROUPS:
                continue
            sources = groups[key]
            group_id = key.replace('/', '-')
            meta = load_json(root / key / 'meta.json') if key != 'index' else {}
            dirname = (root / key).name
            title = meta.get('title') or ''
            if '/' not in key:
                # Endpoints sitting directly under a category (there is no
                # sub-directory to name them): the group is the endpoint, so
                # it is named after it rather than after the category.
                title = front_matter(sources[0].read_text(encoding='utf-8'))[0].get('title') or title
                if len(sources) == 1:
                    group_id = f'{key}-{sources[0].stem}'
            elif not title or title == dirname:
                # A `meta.json` that only restates the directory name is no
                # title at all; a lone endpoint's own title is better.
                if len(sources) == 1:
                    title = (
                        front_matter(sources[0].read_text(encoding='utf-8'))[0].get('title')
                        or dirname
                    )
                else:
                    title = dirname
            parts = [f'# {title}', '']
            # `(op_title, block)` per source. Kept as pairs rather than
            # appended straight to `parts` so a split group can re-emit
            # each source as a format page of its own.
            rendered: list[tuple[str, str]] = []
            for mdx in sources:
                fm, _ = front_matter(mdx.read_text(encoding='utf-8'))
                op_title = fm.get('title') or mdx.stem
                doc = re.search(r'document=\{"([^"]+)"\}', mdx.read_text(encoding='utf-8'))
                wanted = []
                ops = re.search(r'operations=(\[.*?\])\s*/>', mdx.read_text(encoding='utf-8'), re.S)
                if ops:
                    try:
                        wanted = json.loads(ops.group(1))
                    except json.JSONDecodeError:
                        wanted = []
                if not doc:
                    # Not an endpoint but a page of prose — the auth
                    # overview is written as ordinary Markdown. Upstream
                    # renders it like any other page, so its body is the
                    # content; dropping it left a heading with nothing
                    # under it.
                    prose = strip_mdx(front_matter(mdx.read_text(encoding='utf-8'))[1])
                    if prose.strip():
                        rendered.append(('', prose.strip()))
                    continue
                spec_path = upstream / doc.group(1)
                if not spec_path.exists():
                    rendered.append((op_title, f'## {op_title}\n'))
                    continue
                spec = json.loads(spec_path.read_text(encoding='utf-8'))
                found = operation_for(spec, wanted)
                if not found:
                    continue
                if should_skip_api_path(found[0]):
                    continue
                rendered.append((op_title, endpoint_markdown(found[0], found[1], found[2], op_title)))
            parts += [block for _, block in rendered]
            out = '\n'.join(parts).strip() + '\n'
            out = finalise(out, locale)
            write(DOCS / f'content/api/{locale}/{group_id}.md', out)
            texts.append(out)
            nav.append({'id': group_id, 'title': title, 'category': key.split('/')[0], 'group': key})

            # Each protocol variant also gets a page, so the sidebar can
            # nest 原生OpenAI格式 / 原生Gemini格式 under the group. The
            # variant's own `##` becomes the page's `#`: a page titled by
            # its format rather than by the group that holds it.
            if key in FORMAT_SPLIT:
                for op_title, block in rendered:
                    if not op_title:
                        continue
                    page_id = f'{group_id}-{format_slug(op_title)}'
                    split = finalise(re.sub(r'^## ', '# ', block, count=1).strip() + '\n', locale)
                    write(DOCS / f'content/api/{locale}/{page_id}.md', split)
                    texts.append(split)
                    nav.append({
                        'id': page_id,
                        'title': op_title,
                        'category': key.split('/')[0],
                        'group': key,
                    })

        # Several sub-directories are named after a protocol, so their
        # titles repeat ("原生OpenAI格式" three times over). A sidebar
        # with three identical rows is unusable, so a repeated title is
        # qualified by the group it sits under. The qualifier is the
        # nearest ancestor directory with a `meta.json` title — the
        # parent itself need not be a group (`ai-model/images` holds no
        # endpoints of its own, only sub-directories).
        ancestor_titles: dict[str, str] = {}

        def title_of(directory: str) -> str:
            if directory not in ancestor_titles:
                ancestor_titles[directory] = str(
                    load_json(root / directory / 'meta.json').get('title') or ''
                )
            return ancestor_titles[directory]

        counts: dict[str, int] = {}
        for item in nav:
            counts[item['title']] = counts.get(item['title'], 0) + 1
        for item in nav:
            if counts[item['title']] > 1:
                parts = item['group'].split('/')
                for depth in range(len(parts) - 1, 0, -1):
                    qualifier = title_of('/'.join(parts[:depth]))
                    if qualifier:
                        item['title'] = f'{qualifier} · {item["title"]}'
                        break
            del item['group']

        # The overview lists the groups; its intro is upstream's own.
        index_src = root / 'index.mdx'
        fm, body = front_matter(index_src.read_text(encoding='utf-8'))
        intro = strip_mdx(body)
        intro = re.sub(r'^- \[.*$', '', intro, flags=re.M).strip()
        overview = f'# {fm.get("title") or "API 参考"}\n\n{intro}\n'
        write(DOCS / f'content/api/{locale}/index.md', finalise(overview, locale))
        texts.append(overview)
        write(DOCS / f'content/api/{locale}/_nav.json',
              json.dumps(nav, ensure_ascii=False, indent=2) + '\n')
        print(f'  api/{locale}: {len(nav)} 组 + 概览')


def strip_internal(text: str) -> str:
    """Drop internal-only working notes before publishing.

    The Chinese legal sources carry a 「待确认事项清单（内部用）」 appendix and
    a draft disclaimer at the end. Cut from the `---` separator that introduces
    that heading to the end of the file, and drop the matching TOC bullet.
    """
    match = INTERNAL_HEADING.search(text)
    if match:
        cut = text.rfind('\n---\n', 0, match.start())
        text = text[: cut + 1] if cut != -1 else text[: match.start()]
    text = INTERNAL_TOC.sub('', text)
    return re.sub(r'\n{3,}', '\n\n', text).strip() + '\n'


def sync_legal() -> None:
    """法务页只有中文源。

    ⚠️ 英文（content/legal/en/**）是**独立人工译稿**，不是源文件的中文副本：
    早期版本曾把中文源同时写进 zh 与 en，等于用中文覆盖英文页。这里只写 zh，
    en 若已存在一律保持不动。
    """
    for doc, source in LEGAL_SOURCE.items():
        if not source.exists():
            print(f'  legal/{doc}: 源文件缺失，跳过 ({source})')
            continue
        text = strip_internal(source.read_text(encoding='utf-8'))
        write(DOCS / f'content/legal/zh/{doc}.md', text)
        en = DOCS / f'content/legal/en/{doc}.md'
        note = 'en 为独立译稿，保持不动' if en.exists() else 'en 缺失，需补译稿'
        print(f'  legal/{doc}: zh 已更新（{len(text)} 字符）；{note}')


# ── main ───────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--upstream', type=Path, default=UPSTREAM_DEFAULT)
    parser.add_argument('--skip-images', action='store_true')
    parser.add_argument(
        '--only',
        help='Run a single section ("features", "apps", "api" or "legal") '
        'instead of all four.',
    )
    args = parser.parse_args()

    upstream = args.upstream
    chosen = args.only.split(',') if args.only else ['features', 'apps', 'api', 'legal']
    # Only the features/apps/api sections read the upstream cache. The legal
    # sources are local files named in LEGAL_SOURCE, so `--only legal` must not
    # be refused just because no upstream cache happens to be checked out.
    needs_upstream = any(section in chosen for section in ('features', 'apps', 'api'))
    if needs_upstream and not (upstream / 'content/docs/zh/api').exists():
        raise SystemExit(f'上游缓存不存在: {upstream}')

    print('同步上游文档 →', DOCS)
    texts: list[str] = []
    if 'features' in chosen:
        sync_features(upstream, texts)
    if 'apps' in chosen:
        sync_apps(upstream, texts)
    if 'api' in chosen:
        sync_api(upstream, texts)
    if 'legal' in chosen:
        sync_legal()

    assets = collect_assets(texts)
    print(f'  引用图片 {len(assets)} 张 → public/apps-assets/')
    written = sync_assets(assets, args.skip_images)
    print(f'  图片就位 {written}/{len(assets)}')

    for locale in LOCALES:
        for section in ('features', 'apps', 'api', 'legal'):
            for path in sorted((DOCS / f'content/{section}/{locale}').rglob('*.md')):
                text = path.read_text(encoding='utf-8')
                localised = localise_assets(text)
                if localised != text:
                    path.write_text(localised, encoding='utf-8')
    print('完成')


if __name__ == '__main__':
    sys.exit(main())
