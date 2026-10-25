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
import { useTranslation } from 'react-i18next'

import { DocsExportFrame } from '@/components/docs-export-frame'
import { PublicLayout } from '@/components/layout'
import { RichContent } from '@/components/rich-content'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useStatus } from '@/hooks/use-status'
import { getSafeHttpUrl, isLikelyHtml } from '@/lib/content-format'
import {
  isBundledDocsHref,
  legalDocsPathFor,
  resolveDocsHref,
  resolveDocsLocaleCode,
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
      <DocsExportFrame
        src={legalDocsPathFor(resolveDocsLocaleCode(i18n.language), docsDocId)}
        title={title}
      />
    )
  }

  return <ConfiguredLegalDocument title={title} {...rest} />
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
                <FileWarning className='text-muted-foreground h-5 w-5' />
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
        <RichContent mode='html' htmlVariant='isolated' content={rawContent} />
      ) : (
        <div className='mx-auto max-w-4xl space-y-6 py-12'>
          <div className='space-y-2'>
            <h1 className='text-3xl font-semibold'>{title}</h1>
          </div>

          <RichContent
            mode='markdown'
            content={rawContent}
            className='prose-neutral dark:prose-invert max-w-none'
          />
        </div>
      )}
    </PublicLayout>
  )
}
