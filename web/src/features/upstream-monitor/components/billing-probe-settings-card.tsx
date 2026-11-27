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
import { type FormEvent, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { TitledCard } from '@/components/ui/titled-card'
import { handleServerError } from '@/lib/handle-server-error'

import { useSystemOptions } from '../../system-settings/hooks/use-system-options'
import { useUpdateOption } from '../../system-settings/hooks/use-update-option'

const TOKEN_OPTION = 'monitor_setting.billing_probe_token'
const ENABLED_OPTION = 'monitor_setting.billing_probe_enabled'

/**
 * BillingProbeSettingsCard configures the optional "through Uter" leg of
 * billing reconciliation. The token is never displayed after save: the field
 * is a write-only replacement input, and an empty submit keeps the stored
 * credential. This avoids showing a masked value that could be mistaken for a
 * real key while still satisfying the "plaintext never leaves the server"
 * contract.
 */
export function BillingProbeSettingsCard() {
  const { t } = useTranslation()
  const optionsQuery = useSystemOptions()
  const updateOption = useUpdateOption()
  const [token, setToken] = useState('')
  const [pendingEnabled, setPendingEnabled] = useState<boolean | null>(null)

  const options = optionsQuery.data?.data ?? []
  const storedEnabled = options.find((o) => o.key === ENABLED_OPTION)?.value
  const serverEnabled = storedEnabled === 'true' || storedEnabled === '1'
  const effectiveEnabled = pendingEnabled ?? serverEnabled

  const onSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      try {
        if (token.trim() !== '') {
          await updateOption.mutateAsync({
            key: TOKEN_OPTION,
            value: token.trim(),
          })
        }
        if (pendingEnabled !== null && pendingEnabled !== serverEnabled) {
          await updateOption.mutateAsync({
            key: ENABLED_OPTION,
            value: pendingEnabled ? 'true' : 'false',
          })
        }
        setToken('')
        setPendingEnabled(null)
        toast.success(t('Billing probe settings saved'))
      } catch (error) {
        handleServerError(error, t('Failed to save billing probe settings'))
      }
    },
    [pendingEnabled, serverEnabled, t, token, updateOption]
  )

  return (
    <TitledCard title={t('Billing probe settings')} disableHoverEffect>
      <form onSubmit={onSubmit} className='space-y-4'>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Configure a dedicated, low-quota Uter API token to verify actual deductions against upstream usage. Each probe run makes one small real request. Leave the token empty to keep the currently stored one.'
          )}
        </p>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='grid gap-2'>
            <Label htmlFor='billing-probe-token'>{t('Probe token')}</Label>
            <Input
              id='billing-probe-token'
              type='password'
              autoComplete='off'
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder={t('Leave empty to keep stored token')}
            />
          </div>
          <div className='grid gap-2'>
            <Label>{t('Enable full-chain reconciliation')}</Label>
            <div className='flex items-center gap-2'>
              <Switch
                id='billing-probe-enabled'
                checked={effectiveEnabled}
                onCheckedChange={(checked) => setPendingEnabled(checked)}
              />
              <span className='text-sm'>
                {effectiveEnabled ? t('Enabled') : t('Disabled')}
              </span>
            </div>
          </div>
        </div>
        <Button type='submit' size='sm' disabled={updateOption.isPending}>
          {t('Save')}
        </Button>
      </form>
    </TitledCard>
  )
}
