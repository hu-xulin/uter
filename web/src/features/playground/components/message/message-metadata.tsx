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
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'

import { toIntlLocale } from '@/i18n/languages'
import { cn } from '@/lib/utils'

import type { MessageAlignment } from '../../lib'
import type { Message } from '../../types'

type MessageMetadataProps = {
  alignment: MessageAlignment
  message: Message
}

/**
 * 消息时间按**界面语言**格式化，不用浏览器语言。
 *
 * `Intl.DateTimeFormat(undefined, …)` 取的是 `navigator.language`：中文界面 +
 * 英文浏览器的用户会看到 `07:39:09 PM` 这种 12 小时制，和页面其余部分
 * （24 小时制）对不上。全站统一走 `toIntlLocale(i18n.language)`。
 */
function formatMessageTime(
  timestamp?: number,
  locale?: string
): string | undefined {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return undefined
  }

  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp))
}

function formatDuration(
  durationMs: number | undefined,
  t: TFunction
): string | undefined {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
    return undefined
  }

  if (durationMs < 1000) {
    return t('{{value}}ms', { value: Math.max(1, Math.round(durationMs)) })
  }

  return t('{{value}}s', { value: (durationMs / 1000).toFixed(2) })
}

export function MessageMetadata(props: MessageMetadataProps) {
  const { t, i18n } = useTranslation()
  const messageTime = formatMessageTime(
    props.message.createdAt,
    toIntlLocale(i18n.resolvedLanguage || i18n.language)
  )
  const duration = formatDuration(props.message.durationMs, t)

  if (!messageTime && !duration) {
    return null
  }

  return (
    <div
      className={cn(
        'text-muted-foreground mt-1 flex min-h-4 items-center gap-1.5 text-xs',
        props.alignment === 'right' && 'justify-end'
      )}
    >
      {messageTime && <time>{messageTime}</time>}
      {duration && (
        <>
          {messageTime && <span aria-hidden='true'>·</span>}
          <span>{t('Response time: {{duration}}', { duration })}</span>
        </>
      )}
    </div>
  )
}
