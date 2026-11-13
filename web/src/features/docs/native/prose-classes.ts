/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/

/*
 * Markdown prose scale — explicit descendant selectors, aligned with
 * design-spec §1.2 / §1.3. Markdown headings are their own scale
 * (§1.3 E14 exception): one or two steps below the interface headings.
 *
 *   h1 24/32 / 600  → `text-3xl` (section-title)
 *   h2 18/26 / 600  → `text-xl`  (card-title)
 *   h3 16/24 / 600  → `text-base`(group-title)
 *   h4 14/22 / 600  → `text-sm`
 *   body / list items 16/26 → `text-long`
 *
 * The previous values (`text-2xl` / `text-lg` / `text-base`) rendered the
 * document title at 20/28 — smaller than an h2 card title should be —
 * and left table headers at 16/26 while cells were 14/22. Both are
 * corrected below; table cells now share one scale. Card-like blocks
 * (code blocks, images) use `rounded-lg` per §5 (Card = 12px).
 *
 * Lives in its own module (not alongside the view components) so that
 * fast-refresh still works: files exporting components must not also
 * export plain constants.
 */
export const PROSE_CLASSES = [
  'max-w-none text-long',
  '[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:scroll-mt-20',
  '[&_h2]:mt-5 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:scroll-mt-20',
  '[&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:scroll-mt-20',
  '[&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:text-sm [&_h4]:font-semibold',
  '[&_p]:my-2 [&_p]:text-long [&_strong]:font-semibold [&_em]:italic',
  '[&_a]:text-fg-link hover:[&_a]:text-fg-link',
  '[&_ol]:my-2 [&_ul]:my-2 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-5 [&_ul]:pl-5 [&_li]:my-1 [&_li]:pl-1 [&_li]:text-long',
  '[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:bg-muted/50 [&_blockquote]:py-1 [&_blockquote]:pl-4',
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-mono',
  '[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-mono',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-sm',
  '[&_table]:my-4 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_thead]:bg-muted [&_th]:border [&_td]:border [&_th]:px-3 [&_td]:px-3 [&_th]:py-2 [&_td]:py-2 [&_th]:text-left [&_th]:text-sm [&_th]:font-semibold [&_td]:text-sm',
  '[&_figcaption]:text-xs',
  '[&_hr]:my-6 [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-lg',
  '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
  '[overflow-wrap:anywhere]',
].join(' ')
