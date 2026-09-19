'use client';

import { useState } from 'react';

/**
 * The partner marks, served from `public/img/partners/`.
 *
 * Root-relative and outside `/about/`, so the URL cannot be confused with
 * the SPA's own routes when the page is framed.
 */
const PARTNER_LOGO_DIR = '/img/partners';

/**
 * One partner's mark, with the site's own monogram as the safety net.
 *
 * The files are named after the partner id and the shape of each tile is
 * fixed here rather than in the data: a mark is decoration next to the
 * model name and company that follow it, so the wall needs one slot, not
 * a per-brand layout.
 *
 * Loaded as `<img>` rather than inlined: the browser caches the artwork
 * and the bundle stays free of third-party paths. The cost is that an
 * `<img>` gets no cascade, so the marks — which are monochrome
 * `currentColor` files — would paint black in both themes; `.partner-mark`
 * in `global.css` fixes that under the dark root.
 *
 * A missing file falls back to the monogram, so an incomplete logo set
 * degrades to the previous tile instead of a broken-image icon.
 */
export function PartnerLogo({
  id,
  monogram,
}: {
  id: string;
  monogram: string;
}) {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return (
      <span
        aria-hidden='true'
        className='flex size-9 shrink-0 items-center justify-center rounded-md bg-fd-primary/10 text-sm font-semibold text-fd-primary'
      >
        {monogram}
      </span>
    );
  }

  return (
    <span
      aria-hidden='true'
      className='flex size-9 shrink-0 items-center justify-center'
    >
      <img
        className='partner-mark size-6 object-contain'
        src={`${PARTNER_LOGO_DIR}/${id}.svg`}
        alt=''
        loading='lazy'
        decoding='async'
        onError={() => setMissing(true)}
      />
    </span>
  );
}
