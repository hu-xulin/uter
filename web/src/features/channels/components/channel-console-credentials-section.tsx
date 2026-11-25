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
import { useMutation } from '@tanstack/react-query'
import { Eye, Globe2, RefreshCw, Save } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { handleServerError } from '@/lib/handle-server-error'

import {
  fetchChannelUpstreamConsoleCatalog,
  type UpstreamConsoleCatalog,
} from '../api'
import type { ChannelFormValues } from '../lib'

type Props = {
  form: import('react-hook-form').UseFormReturn<ChannelFormValues>
  channelId: number | null
  sensitiveLocked: boolean
  // Models discovered by the PRIMARY API Key + base_url path, used to
  // cross-check the secondary console result.
  primaryModels: string[]
  // Create-wizard save step: persists console credentials on the draft row so
  // later steps can log into the upstream channel. Absent in read-only usage.
  onSaveCredentials?: () => Promise<void> | void
  savingCredentials?: boolean
}

/**
 * Secondary console-login credentials. This never replaces the primary
 * API Key + base_url discovery; it only CROSS-CHECKS model and price data.
 * When no credentials are configured or login fails, the API Key path stays
 * the single source of truth (backend returns fallback_primary=true).
 */
export function ChannelConsoleCredentialsSection(props: Props) {
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)
  const [showPrices, setShowPrices] = useState(false)
  const [catalog, setCatalog] = useState<UpstreamConsoleCatalog | null>(null)

  const crossCheck = useMutation({
    mutationFn: () => {
      if (!props.channelId) {
        throw new Error(t('Save the channel before cross-checking'))
      }
      return fetchChannelUpstreamConsoleCatalog(props.channelId)
    },
    onSuccess: (data) => setCatalog(data),
    onError: (error) => handleServerError(error, t('Cross-check failed')),
  })

  const configured = Boolean(
    props.form.watch('console_login_url')?.trim() &&
    props.form.watch('console_username')?.trim()
  )

  const normalize = (value: string) => value.trim().toLowerCase()
  const primarySet = new Set(props.primaryModels.map(normalize))
  const consoleSet = new Set((catalog?.models ?? []).map(normalize))
  const shared = [...consoleSet].filter((model) => primarySet.has(model)).length
  const consoleOnly = [...consoleSet].filter(
    (model) => !primarySet.has(model)
  ).length
  const primaryOnly = [...primarySet].filter(
    (model) => !consoleSet.has(model)
  ).length

  return (
    <div className='border-border/60 bg-muted/10 rounded-lg border p-4'>
      <fieldset
        disabled={props.sensitiveLocked}
        className='space-y-4 disabled:opacity-60'
      >
        <div className='flex items-start gap-3'>
          <Globe2
            className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0'
            aria-hidden='true'
          />
          <div className='min-w-0 flex-1'>
            <p className='text-sm font-medium'>
              {t('Upstream console login (optional)')}
            </p>
            <p className='text-muted-foreground text-sm'>
              {t(
                'Secondary source to cross-check models and prices. API Key + Base URL remain the primary source; when login is unavailable the primary result is used.'
              )}
            </p>
          </div>
        </div>

        <FormField
          control={props.form.control}
          name='console_login_url'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Console login URL')}</FormLabel>
              <FormControl>
                <Input
                  mono
                  type='url'
                  placeholder={t('e.g., https://console.example.com')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={props.form.control}
          name='console_username'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Console username')}</FormLabel>
              <FormControl>
                <Input autoComplete='off' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={props.form.control}
          name='console_password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Console password')}</FormLabel>
              <div className='relative'>
                <FormControl>
                  <Input
                    mono
                    type={showPassword ? 'text' : 'password'}
                    autoComplete='new-password'
                    className='pr-10'
                    {...field}
                  />
                </FormControl>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  aria-label={
                    showPassword ? t('Hide password') : t('Show password')
                  }
                  onClick={() => setShowPassword((value) => !value)}
                  className='absolute top-0 right-0 h-full px-3'
                >
                  <Eye className='h-4.5 w-4.5' aria-hidden='true' />
                </Button>
              </div>
              <FormDescription>
                {t('Leave empty to keep the stored password')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {configured && (
          <div className='flex flex-wrap items-center gap-2'>
            {props.onSaveCredentials && (
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={() => void props.onSaveCredentials?.()}
                disabled={props.savingCredentials === true}
                title={t('Save console credentials for later upstream login')}
              >
                {props.savingCredentials === true ? (
                  <RefreshCw className='mr-2 h-4.5 w-4.5 animate-spin' />
                ) : (
                  <Save className='mr-2 h-4.5 w-4.5' />
                )}
                {t('Save credentials')}
              </Button>
            )}
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => crossCheck.mutate()}
              disabled={crossCheck.isPending || !props.channelId}
              title={
                !props.channelId
                  ? t('Save the channel before cross-checking')
                  : undefined
              }
            >
              {crossCheck.isPending ? (
                <RefreshCw className='mr-2 h-4.5 w-4.5 animate-spin' />
              ) : (
                <RefreshCw className='mr-2 h-4.5 w-4.5' />
              )}
              {t('Fetch & cross-check')}
            </Button>
          </div>
        )}
      </fieldset>

      {catalog && (
        <CrossCheckResult
          catalog={catalog}
          shared={shared}
          consoleOnly={consoleOnly}
          primaryOnly={primaryOnly}
          showPrices={showPrices}
          onTogglePrices={() => setShowPrices((value) => !value)}
        />
      )}
    </div>
  )
}

function CrossCheckResult(props: {
  catalog: UpstreamConsoleCatalog
  shared: number
  consoleOnly: number
  primaryOnly: number
  showPrices: boolean
  onTogglePrices: () => void
}) {
  const { t } = useTranslation()
  const { catalog } = props

  if (catalog.status !== 'success') {
    return (
      <Alert className='mt-4'>
        <AlertDescription>
          {catalog.status === 'not_configured'
            ? t(
                'Console login not configured. Using API Key + Base URL as the source of truth.'
              )
            : t(
                'Console login failed. Using API Key + Base URL as the source of truth.'
              )}
        </AlertDescription>
      </Alert>
    )
  }

  const formatPrice = (value?: number) =>
    value === undefined || value === null ? '—' : String(value)

  return (
    <Alert variant='success' className='border-success-soft mt-4'>
      <AlertDescription className='flex flex-col gap-2'>
        <span className='flex items-center gap-2'>
          <Badge variant='default'>{t('Cross-check complete')}</Badge>
          <span>
            {t('{{count}} model(s) from console', {
              count: catalog.models.length,
            })}
            {' · '}
            {t('{{count}} price row(s)', { count: catalog.prices.length })}
          </span>
        </span>
        <span className='text-muted-foreground'>
          {t(
            '{{shared}} match, {{consoleOnly}} console-only, {{primaryOnly}} API-only',
            {
              shared: props.shared,
              consoleOnly: props.consoleOnly,
              primaryOnly: props.primaryOnly,
            }
          )}
        </span>
        {catalog.prices.length > 0 && (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='self-start'
            aria-expanded={props.showPrices}
            onClick={props.onTogglePrices}
          >
            {props.showPrices
              ? t('Hide console prices')
              : t('Show console prices')}
          </Button>
        )}
        {props.showPrices && (
          <div className='border-border/60 mt-1 space-y-1 rounded-md border p-2'>
            <p className='text-sm font-medium'>{t('Console price')}</p>
            {catalog.prices.length === 0 ? (
              <p className='text-muted-foreground text-sm'>
                {t('No price rows returned')}
              </p>
            ) : (
              catalog.prices.map((price) => (
                <div
                  key={`${price.model}:${price.currency ?? ''}:${price.input_price ?? ''}:${price.output_price ?? ''}`}
                  className='text-sm'
                >
                  <span className='font-medium'>{price.model}</span>
                  {' — '}
                  {t('Input price')}: {formatPrice(price.input_price)}
                  {' · '}
                  {t('Output price')}: {formatPrice(price.output_price)}
                  {price.currency ? ` (${price.currency})` : ''}
                </div>
              ))
            )}
          </div>
        )}
        <span className='text-muted-foreground'>
          {t(
            'Console data is read-only. Apply any change through the normal model and price steps.'
          )}
        </span>
      </AlertDescription>
    </Alert>
  )
}
