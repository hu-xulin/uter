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
import { SquareArrowOutUpRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { getPluginWebsite } from '../lib/plugin-website'

export function PluginWebsiteLink(props: { website?: string }) {
  const { t } = useTranslation()
  const website = getPluginWebsite(props.website)
  if (!website) return null

  return (
    <Button
      role='link'
      variant='link'
      size='inline'
      className='max-w-full justify-start text-sm whitespace-normal'
      render={<a href={website} target='_blank' rel='noopener noreferrer' />}
    >
      <SquareArrowOutUpRight aria-hidden='true' />
      {t('Plugin website')}
    </Button>
  )
}
