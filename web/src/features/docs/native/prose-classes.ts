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
 * Markdown prose scale — explicit descendant selectors for native docs and
 * bundled legal documents. UDS 8.0.0 §04 (type scale) and §24 (code and
 * developer UI) are the authority; §23 governs table typography.
 *
 *   h1 36/44 → `text-4xl`   h2 24/32 → `text-2xl`   h3 18/26 → `text-lg`
 *   h4 16/24 → `text-base`  body / list items 16/26 → `text-long`
 *   body copy takes `--ds-color-text-secondary` (§03 secondary text,
 *   ≥7:1 on the page surface); headings stay `--ds-color-text-primary`
 *   so the hierarchy reads heading-dark / body-soft as in Clerk docs.
 *   table header / cells 14/22 (`--ds-text-sm`, body default), horizontal
 *   dividers only (§23 rule 2)
 *   code 13/20 mono (§24 rule 2), inline + block surfaces take the
 *   `--ds-color-code-*` tokens so code is never styled by generic
 *   `--muted` / `--border` (the bridge is the only colour source).
 *   inline `strong` / `b` are flattened to body weight and inherit the
 *   body colour — the legal agreements and the docs pages keep one text
 *   voice instead of emphasis by weight or a darker colour.
 *
 * `max-w-[72ch]` is §1.12: 16/26 long-form copy must not stretch across a
 * 1280px content area. Card-like blocks (code blocks, images) use
 * `rounded-lg` per §5 (Card = 12px).
 *
 * Lives in its own module (not alongside the view components) so that
 * fast-refresh still works: files exporting components must not also
 * export plain constants.
 */
export const PROSE_CLASSES = [
  'uter-prose max-w-[72ch] text-long text-(--ds-color-text-secondary)',
  '[&_h1]:mt-6 [&_h1]:mb-4 [&_h1]:text-4xl [&_h1]:font-semibold [&_h1]:text-(--ds-color-text-primary) [&_h1]:scroll-mt-20',
  '[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-(--ds-color-text-primary) [&_h2]:scroll-mt-20',
  '[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-(--ds-color-text-primary) [&_h3]:scroll-mt-20',
  '[&_h4]:mt-5 [&_h4]:mb-2 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-(--ds-color-text-primary)',
  '[&_p]:my-2 [&_p]:text-long [&_strong]:font-normal [&_strong]:text-inherit [&_b]:font-normal [&_b]:text-inherit [&_em]:italic',
  '[&_a]:text-fg-link [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-fg-link',
  '[&_ol]:my-2 [&_ul]:my-2 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-5 [&_ul]:pl-5 [&_li]:my-1 [&_li]:pl-1 [&_li]:text-long',
  '[&_blockquote]:my-3 [&_blockquote]:text-sm [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:bg-(--ds-color-surface-sunken) [&_blockquote]:py-1 [&_blockquote]:pl-4 [&_blockquote_p]:text-sm',
  '[&_code]:rounded [&_code]:bg-(--ds-color-code-background) [&_code]:text-(--ds-color-code-foreground) [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-mono',
  '[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-(--ds-color-border-code) [&_pre]:bg-(--ds-color-code-codeblock-background) [&_pre]:p-3 [&_pre]:text-(--ds-color-code-foreground) [&_pre]:text-mono',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-mono',
  // 表格外框（圆角矩形）由 `DocsTable` 组件负责；这里只管单元格排版与分隔线。
  '[&_table]:w-full [&_thead]:bg-(--ds-color-surface-sunken) [&_th]:border-b [&_td]:border-b [&_th]:border-(--ds-color-border-table) [&_td]:border-(--ds-color-border-table) [&_th]:whitespace-nowrap [&_td]:break-words [&_th]:px-4 [&_td]:px-4 [&_th]:py-3 [&_td]:py-3 [&_th]:text-left [&_th]:text-(--ds-color-text-primary) [&_th]:text-sm [&_th]:font-medium [&_td]:text-sm [&_tbody_tr:last-child>*]:border-b-0',
  // 正文不做加粗 / 加黑强调：`strong` / `b` 保持常规字重并继承正文色，
  // 表格首列也不再用字重或主文本色突出——法务协议与文档页统一一种文字声量。
  '[&_figcaption]:text-xs',
  '[&_hr]:my-8 [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-lg',
  '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
  '[overflow-wrap:anywhere]',
].join(' ')
