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
import { useQuery } from '@tanstack/react-query'
import { FileWarning } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { RichContent } from '@/components/rich-content'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Heading } from '@/design-system'
import { Callout } from '@/features/docs/native/callout'
import { DocsCodeBlock } from '@/features/docs/native/docs-code-block'
import { loadNativeDoc } from '@/features/docs/native/docs-loader'
import { DocsTable } from '@/features/docs/native/docs-table'
import { PROSE_CLASSES } from '@/features/docs/native/prose-classes'
import { useStatus } from '@/hooks/use-status'
import { getSafeHttpUrl, isLikelyHtml } from '@/lib/content-format'
import {
  isBundledDocsHref,
  resolveDocsHref,
  resolveDocsLocaleCode,
  type DocsLocaleCode,
} from '@/lib/docs-link'

import type { LegalDocumentResponse } from './types'

type LegalDocumentProps = {
  title: string
  queryKey: string
  /**
   * Id of the same document in the docs site — the `content/nav.json`
   * `legal` entry and the `content/legal/<lang>/<doc>.md` filename
   * (`user-agreement`, `privacy-policy`, `recharge-agreement`).
   *
   * Locale-neutral by design: it is what lets a language switch land
   * on the same document in the other language.
   */
  docsDocId: string
  fetchDocument: () => Promise<LegalDocumentResponse>
  emptyMessage: string
}

/**
 * Public page for one legal document.
 *
 * The document is rendered as a page of the bundled docs site, framed
 * under the SPA's own public shell: the same sidebar and table of
 * contents as the rest of the documentation, in whichever language the
 * reader has the app set to.
 *
 * The docs site is the only place these texts are authored per
 * language (`docs-web/content/legal/<lang>/<doc>.md`). The copy held in
 * System Settings — what `/api/<doc>` serves — is a single text with no
 * translation, so rendering that here showed the same language whatever
 * the reader picked, and switching language appeared to do nothing to
 * the document.
 *
 * The frame is only used while the bundled docs site is the target: an
 * admin who repoints `docs_link` at an external knowledge base leaves
 * the SPA with nothing to frame, so the configured text (or the link to
 * that knowledge base) is shown instead of a dead frame.
 */
export function LegalDocument({
  docsDocId,
  title,
  ...rest
}: LegalDocumentProps) {
  const { i18n } = useTranslation()
  const { status } = useStatus()

  if (isBundledDocsHref(resolveDocsHref(status?.docs_link))) {
    return (
      <BundledLegalDocument
        docsDocId={docsDocId}
        locale={resolveDocsLocaleCode(i18n.language)}
        title={title}
      />
    )
  }

  return <ConfiguredLegalDocument title={title} {...rest} />
}

/**
 * One legal document of the bundled docs, rendered natively.
 *
 * The document body is the migrated Markdown in
 * `web/src/docs-content/legal/<locale>/<doc>.mdx`, resolved through the
 * same lazy MDX loader the `/docs` pages use and drawn with the same
 * prose scale — no iframe, no static export. Switching the UI language
 * swaps the module, exactly as the framed version re-pointed its
 * `src`.
 */
function BundledLegalDocument({
  docsDocId,
  locale,
  title,
}: {
  docsDocId: string
  locale: DocsLocaleCode
  title: string
}) {
  const loader = useMemo(
    () => loadNativeDoc(locale, { set: 'legal', slug: docsDocId }),
    [locale, docsDocId]
  )
  const [Doc, setDoc] = useState<ComponentType<Record<string, unknown>> | null>(
    null
  )

  useEffect(() => {
    setDoc(null)
    if (!loader) return
    let alive = true
    loader()
      .then((module) => {
        if (alive) setDoc(() => module.default)
      })
      .catch(() => {
        // A failed chunk load leaves the page blank below the shell —
        // the admin-configured fallback is the recovery path.
      })
    return () => {
      alive = false
    }
  }, [loader])

  const proseRef = useRef<HTMLDivElement>(null)

  // 法务协议的首个表格只做「版本/字段对照」，表头不参与内容分区，
  // 因此去掉 sunken 底色；后续表格仍沿用 PROSE_CLASSES 的表头底。
  useEffect(() => {
    const thead = proseRef.current?.querySelector('table thead')
    if (!(thead instanceof HTMLElement)) return
    thead.style.backgroundColor = 'transparent'
    return () => {
      thead.style.removeProperty('background-color')
    }
  }, [Doc, locale])

  return (
    <PublicLayout>
      <div className='mx-auto w-full max-w-3xl px-6 py-10'>
        {/* 每份法务 MDX 都以 `# 官方全称` 开头，它才是页面唯一 h1。
            曾经在外层再画一个 page-title，导致两个 36px 标题叠在一起。 */}
        <div className={PROSE_CLASSES} ref={proseRef}>
          {Doc ? (
            <Doc
              components={{
                Callout,
                pre: DocsCodeBlock,
                table: DocsTable,
              }}
              locale={locale}
            />
          ) : (
            <>
              <span className='sr-only'>{title}</span>
              <Skeleton className='h-9 w-2/3' />
            </>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}

/**
 * The document exactly as configured in System Settings → Site: a
 * Markdown/HTML body, or a full URL the reader is sent to.
 */
function ConfiguredLegalDocument({
  title,
  queryKey,
  fetchDocument,
  emptyMessage,
}: Omit<LegalDocumentProps, 'docsDocId'>) {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: fetchDocument,
    staleTime: 10 * 60 * 1000,
  })

  const rawContent = data?.data?.trim() ?? ''
  const hasContent = rawContent.length > 0
  const externalUrl = hasContent ? getSafeHttpUrl(rawContent) : undefined
  const isUrl = externalUrl !== undefined
  const contentIsHtml = hasContent && isLikelyHtml(rawContent)
  const success = data?.success ?? false

  if (isLoading) {
    return (
      <PublicLayout>
        <div className='mx-auto flex max-w-4xl flex-col gap-4 py-12'>
          <Skeleton className='h-8 w-[45%]' />
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-[90%]' />
          <Skeleton className='h-4 w-[80%]' />
        </div>
      </PublicLayout>
    )
  }

  if (!success || !hasContent) {
    return (
      <PublicLayout>
        <div className='mx-auto max-w-2xl py-12'>
          <Card className='border-dashed'>
            <CardHeader className='flex flex-row items-center gap-4'>
              <div className='bg-muted rounded-lg p-2'>
                <FileWarning className='text-muted-foreground h-4 w-4' />
              </div>
              <div className='space-y-1'>
                <CardTitle>{title}</CardTitle>
                <p className='text-muted-foreground text-sm'>
                  {data?.message || emptyMessage}
                </p>
              </div>
            </CardHeader>
          </Card>
        </div>
      </PublicLayout>
    )
  }

  if (isUrl) {
    return (
      <PublicLayout>
        <div className='mx-auto max-w-2xl py-12'>
          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'The administrator configured an external link for this document.'
                )}
              </p>
              <Button
                render={
                  <a
                    href={externalUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                  />
                }
              >
                {t('View document')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout showMainContainer={!contentIsHtml}>
      {contentIsHtml ? (
        <RichContent
          mode='html'
          htmlVariant='isolated'
          content={rawContent}
          className='[&_th]:whitespace-nowrap'
        />
      ) : (
        <div className='mx-auto max-w-4xl space-y-6 py-12'>
          <div className='space-y-2'>
            <Heading variant='page-title'>{title}</Heading>
          </div>

          <RichContent
            mode='markdown'
            content={rawContent}
            className='prose-neutral dark:prose-invert max-w-none [&_th]:whitespace-nowrap'
          />
        </div>
      )}
    </PublicLayout>
  )
}
