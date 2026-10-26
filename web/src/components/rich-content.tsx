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
import { Suspense, lazy } from 'react'

import { HtmlContent, type HtmlContentVariant } from '@/components/html-content'

// Markdown pulls in katex (with its stylesheet), marked and DOMPurify. Most
// RichContent call sites — the homepage, the notification popover, legal docs —
// render an iframe URL or plain HTML and never need the markdown renderer on
// first paint. Lazy-load it so those paths don't ship katex/marked in the
// initial chunk; this mirrors the dynamic import() the dialogs already use.
const Markdown = lazy(() =>
  import('@/components/ui/markdown').then((m) => ({ default: m.Markdown }))
)

type RichContentMode = 'markdown' | 'html'

interface RichContentProps {
  content: string
  mode?: RichContentMode
  breaks?: boolean
  className?: string
  htmlVariant?: HtmlContentVariant
}

export function RichContent(props: RichContentProps) {
  if (props.mode === 'html') {
    return (
      <HtmlContent
        content={props.content}
        className={props.className}
        variant={props.htmlVariant}
      />
    )
  }

  return (
    <Suspense fallback={null}>
      <Markdown breaks={props.breaks} className={props.className}>
        {props.content}
      </Markdown>
    </Suspense>
  )
}
