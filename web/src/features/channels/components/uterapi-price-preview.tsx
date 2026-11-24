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
import { useTranslation } from 'react-i18next'

import { Label } from '@/components/ui/label'

import { getUterAPIPricePreview } from '../api'
import { PricePreviewTable } from './fetched-price-preview'

type UterApiPricePreviewProps = {
  /** Upstream billing group key; empty until the operator picks one. */
  group: string
  enabled?: boolean
}

/**
 * Creation-wizard preview of the official and channel prices a Uter.api group
 * publishes. The data is derived from the public catalogue and is read-only;
 * the create flow still performs its own authoritative sync and verification.
 */
export function UterApiPricePreview({
  group,
  enabled = true,
}: UterApiPricePreviewProps) {
  const { t } = useTranslation()
  const active = enabled && group.trim() !== ''
  const query = useQuery({
    queryKey: ['uterapi-price-preview', group],
    queryFn: () => getUterAPIPricePreview(group),
    enabled: active,
    retry: false,
    meta: { errorToast: false },
  })
  const items = query.data?.data?.items ?? []

  let body: React.ReactNode
  if (!active) {
    body = (
      <p className='text-muted-foreground text-sm'>
        {t('Choose a billing group to preview its prices.')}
      </p>
    )
  } else if (query.isFetching) {
    body = <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
  } else if (query.isError) {
    body = (
      <p className='text-muted-foreground rounded-lg border border-dashed p-4 text-sm'>
        {t('Could not preview prices for this group.')}
      </p>
    )
  } else if (items.length === 0) {
    body = (
      <p className='text-muted-foreground rounded-lg border border-dashed p-4 text-sm'>
        {t('No published prices for this group.')}
      </p>
    )
  } else {
    body = <PricePreviewTable items={items} />
  }

  const preview = query.data?.data
  return (
    <section className='space-y-2' aria-live='polite'>
      <div>
        <Label>{t('Fetched prices')}</Label>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Official and channel prices from the Uter.api catalog for the selected group.'
          )}
        </p>
        {preview ? (
          <p className='text-muted-foreground text-sm'>
            {t('Group')}: {preview.group_name || preview.group} · {t('Ratio')}:{' '}
            {preview.ratio}
          </p>
        ) : null}
      </div>
      {body}
    </section>
  )
}
