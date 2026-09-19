import type { TOCItemType } from 'fumadocs-core/toc';

/**
 * Heading anchors and the page table of contents.
 *
 * Every content page renders its `h2`/`h3` from the structured section
 * data in `src/lib/content/*.ts`. The right-hand TOC has to point at
 * those exact headings, so the anchor ids are computed **once** per page
 * by `planHeadings()` and handed to both the TOC and the renderer. That
 * avoids the usual failure mode of this pattern — the TOC slugging
 * headings one way while the DOM slugs them another — and lets duplicate
 * headings be disambiguated in a single place.
 *
 * Ids stay human-readable (`#注册与登录`) rather than positional
 * (`#section-7`): `fumadocs-core`'s TOC resolves them with
 * `document.getElementById`, so any Unicode string works, and a copied
 * link stays meaningful.
 */

/**
 * Turn a heading into a URL fragment.
 *
 * Keeps letters (including CJK), digits, `_` and `-`; collapses every run
 * of anything else into a single `-`. The result is safe both as an HTML
 * `id` and inside the `a[href="…"]` attribute selector that
 * `fumadocs-ui`'s TOC uses to measure its SVG track, which is why
 * characters like `/`, `.` and `()` — all of which appear in the
 * headings of this site — cannot be left in place.
 */
export function headingAnchor(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

/** Section shape `planHeadings` accepts — matches `src/lib/content/*.ts`. */
export type HeadingSource = {
  heading: string;
  subSections?: { heading: string }[];
};

export type HeadingPlan = {
  /** Ready for `DocsPage`'s `toc` prop. */
  toc: TOCItemType[];
  /** Anchor id per top-level section, parallel to the input array. */
  sectionIds: string[];
  /** Anchor ids per sub-section, parallel to each section's `subSections`. */
  subSectionIds: string[][];
};

/**
 * Assign anchors to every heading of a page and build its TOC.
 *
 * `titles` optionally overrides the label used in the TOC — the rendered
 * heading keeps its own text. `features-introduction` relies on this: its
 * detail cards read `支持 Telegram 授权登录：` on the page, which is right
 * as a sentence and wrong as a TOC entry.
 */
export function planHeadings(
  sections: HeadingSource[],
  titles?: { section?: (string | undefined)[]; subSection?: (string | undefined)[][] }
): HeadingPlan {
  const used = new Set<string>();
  const unique = (text: string) => {
    const base = headingAnchor(text);
    let id = base;
    let n = 2;
    while (used.has(id)) {
      id = `${base}-${n++}`;
    }
    used.add(id);
    return id;
  };

  const toc: TOCItemType[] = [];
  const sectionIds: string[] = [];
  const subSectionIds: string[][] = [];

  sections.forEach((section, i) => {
    const id = unique(section.heading);
    sectionIds.push(id);
    toc.push({
      title: titles?.section?.[i] ?? section.heading,
      url: `#${id}`,
      depth: 2,
    });

    const subIds = (section.subSections ?? []).map((sub, j) => {
      const subId = unique(sub.heading);
      toc.push({
        title: titles?.subSection?.[i]?.[j] ?? sub.heading,
        url: `#${subId}`,
        depth: 3,
      });
      return subId;
    });
    subSectionIds.push(subIds);
  });

  return { toc, sectionIds, subSectionIds };
}
