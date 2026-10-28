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
import { Languages, Check } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { parseUserSettings } from '@/features/profile/lib/format'
import { ensureLocale } from '@/i18n/config'
import {
  INTERFACE_LANGUAGE_OPTIONS,
  normalizeInterfaceLanguage,
} from '@/i18n/languages'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  const currentLanguage = normalizeInterfaceLanguage(i18n.language)
  const handleChangeLanguage = useCallback(
    async (code: string) => {
      const next = normalizeInterfaceLanguage(code)
      // Capture what is on screen *right now* rather than deriving the previous
      // language from the saved setting: an account that never saved a language
      // has no `setting.language`, and normalizing that would roll back to
      // English instead of the language actually being displayed.
      const previousLanguage = normalizeInterfaceLanguage(i18n.language)
      // Load the locale bundle *before* switching so the chosen language's
      // strings render immediately. The old order set `i18n.language` first
      // while the bundle was still being fetched, the UI fell back to English,
      // and only a second click (with the chunk now cached) made the switch
      // stick — which read as "it snapped back to English".
      await ensureLocale(next)
      await i18n.changeLanguage(next)
      if (!user) return
      // Keep the in-memory auth store in sync with the choice so an auth-rotation
      // response or silent refresh re-applies this language instead of the stale
      // previously saved one (which would snap the UI back to English).
      const existing =
        typeof user.setting === 'string'
          ? parseUserSettings(user.setting)
          : (user.setting ?? {})
      useAuthStore.getState().auth.setUser({
        ...user,
        setting: JSON.stringify({ ...existing, language: next }),
      })
      try {
        await api.put('/api/user/self', { language: next })
      } catch {
        // Persistence failed: undo both the store and the UI so what is shown
        // still matches what the account has saved.
        useAuthStore.getState().auth.setUser(user)
        await i18n.changeLanguage(previousLanguage)
      }
    },
    [i18n, user]
  )

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger render={<Button variant='ghost' size='icon' />}>
        <Languages className='size-4.5' />
        <span className='sr-only'>{t('Change language')}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        {INTERFACE_LANGUAGE_OPTIONS.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleChangeLanguage(lang.code)}
          >
            {lang.label}
            <Check
              className={cn(
                'size-4 ms-auto',
                currentLanguage !== lang.code && 'hidden'
              )}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
