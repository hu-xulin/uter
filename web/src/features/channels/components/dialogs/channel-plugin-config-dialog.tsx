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
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { JsonCodeEditor } from '@/components/json-code-editor'
import { PluginConfigFields } from '@/components/plugin-config-fields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resolveLocalizedText } from '@/lib/localized-text'

import {
  continuePluginLogin,
  getPluginCredentials,
  startPluginLogin,
  type PluginCredentialView,
  type PluginLoginStep,
} from '../../api'
import { parsePluginConfigObject } from '../../lib/channel-plugin-config'

type ChannelPluginConfigDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The channel whose credentials this dialog manages; absent before save. */
  channelId?: number
  pluginName: string
  keyHint?: Record<string, string> | null
  /** The plugin's channelConfig schema, when it declares one. */
  schema?: Record<string, unknown> | null
  config: string
  onConfigChange: (config: string) => void
}

export function ChannelPluginConfigDialog(
  props: ChannelPluginConfigDialogProps
) {
  const { t, i18n } = useTranslation()
  const [draft, setDraft] = useState(props.config)
  const [credentials, setCredentials] = useState<PluginCredentialView[]>([])
  const [loadingCredentials, setLoadingCredentials] = useState(false)
  const [flow, setFlow] = useState<string | null>(null)
  const [step, setStep] = useState<PluginLoginStep | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [callbackUrl, setCallbackUrl] = useState('')
  const [busy, setBusy] = useState(false)

  const channelId = props.channelId
  const hint = resolveLocalizedText(props.keyHint, i18n.language)
  const parsedConfig = useMemo(() => parsePluginConfigObject(draft), [draft])

  useEffect(() => {
    if (!props.open) return
    setDraft(props.config)
    setFlow(null)
    setStep(null)
    setFields({})
    setCallbackUrl('')
  }, [props.open, props.config])

  useEffect(() => {
    if (!props.open || !channelId) {
      setCredentials([])
      return
    }
    let cancelled = false
    const load = async () => {
      setLoadingCredentials(true)
      try {
        const items = await getPluginCredentials(channelId)
        if (!cancelled) setCredentials(items)
      } catch {
        if (!cancelled) setCredentials([])
      } finally {
        if (!cancelled) setLoadingCredentials(false)
      }
    }
    load().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [props.open, channelId])

  const saveConfig = () => {
    const trimmed = draft.trim()
    if (trimmed) {
      try {
        JSON.parse(trimmed)
      } catch {
        toast.error(t('Plugin config must be a JSON object'))
        return
      }
    }
    props.onConfigChange(trimmed)
    props.onOpenChange(false)
  }

  const applyStep = (responseStep: PluginLoginStep, nextFlow?: string) => {
    if (nextFlow) setFlow(nextFlow)
    if (responseStep.type === 'done') {
      setStep(null)
      setFlow(null)
      toast.success(t('Signed in'))
      if (channelId) {
        const reload = async () => {
          setLoadingCredentials(true)
          try {
            setCredentials(await getPluginCredentials(channelId))
          } catch {
            setCredentials([])
          } finally {
            setLoadingCredentials(false)
          }
        }
        reload().catch(() => undefined)
      }
      return
    }
    setStep(responseStep)
    setFields({})
  }

  const login = async () => {
    if (!channelId) return
    setBusy(true)
    try {
      const response = await startPluginLogin(channelId, {})
      if (response.data?.step) {
        applyStep(response.data.step, response.data.flow)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const submitFields = async () => {
    if (!channelId || !flow) return
    setBusy(true)
    try {
      const response = await continuePluginLogin(channelId, {
        flow,
        input: { fields },
      })
      if (response.data?.step) applyStep(response.data.step)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const pollLogin = async () => {
    if (!channelId || !flow) return
    setBusy(true)
    try {
      const response = await continuePluginLogin(channelId, {
        flow,
        input: { poll: true },
      })
      if (response.data?.step) applyStep(response.data.step)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const submitCallback = async () => {
    if (!channelId || !flow || !callbackUrl.trim()) return
    setBusy(true)
    try {
      const response = await continuePluginLogin(channelId, {
        flow,
        input: { callback_url: callbackUrl.trim() },
      })
      if (response.data?.step) applyStep(response.data.step)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  let credentialsBody = null
  if (loadingCredentials) {
    credentialsBody = (
      <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
    )
  } else if (credentials.length === 0) {
    credentialsBody = (
      <p className='text-muted-foreground text-sm'>{t('No credentials yet')}</p>
    )
  } else {
    credentialsBody = (
      <ul className='flex flex-col gap-1'>
        {credentials.map((credential) => (
          <li
            key={credential.index}
            className='flex items-center justify-between gap-2 text-sm'
          >
            <span className='truncate'>
              {credential.label || credential.account_id}
            </span>
            <span className='text-muted-foreground shrink-0'>
              {credential.needs_login ? t('Needs login') : t('Signed in')}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  let loginBody = null
  if (step?.type === 'fields') {
    loginBody = (
      <div className='flex flex-col gap-3'>
        {step.fields?.map((field) => (
          <div key={field.name} className='flex flex-col gap-1.5'>
            <Label htmlFor={`plugin-login-${field.name}`}>
              {resolveLocalizedText(field.label, i18n.language) || field.name}
            </Label>
            <Input
              id={`plugin-login-${field.name}`}
              type={field.type === 'password' ? 'password' : 'text'}
              required={field.required}
              placeholder={resolveLocalizedText(
                field.placeholder,
                i18n.language
              )}
              value={fields[field.name] ?? ''}
              onChange={(event) =>
                setFields((current) => ({
                  ...current,
                  [field.name]: event.target.value,
                }))
              }
            />
          </div>
        ))}
        <Button type='button' onClick={submitFields} disabled={busy}>
          {busy ? (
            <Loader2 className='animate-spin' aria-hidden='true' />
          ) : null}
          {t('Continue')}
        </Button>
      </div>
    )
  } else if (step?.type === 'paste') {
    loginBody = (
      <div className='flex flex-col gap-3'>
        {step.url ? (
          <a
            className='break-all text-(--ds-color-text-link) underline'
            href={step.url}
            target='_blank'
            rel='noreferrer'
          >
            {step.url}
          </a>
        ) : null}
        {resolveLocalizedText(step.hint, i18n.language) ? (
          <p className='text-muted-foreground text-sm'>
            {resolveLocalizedText(step.hint, i18n.language)}
          </p>
        ) : null}
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='plugin-login-callback'>
            {t('Address after sign-in')}
          </Label>
          <Input
            id='plugin-login-callback'
            autoComplete='off'
            value={callbackUrl}
            onChange={(event) => setCallbackUrl(event.target.value)}
          />
          <p className='text-muted-foreground text-sm'>
            {t('Paste the full address from the address bar after signing in.')}
          </p>
        </div>
        <Button type='button' onClick={submitCallback} disabled={busy}>
          {busy ? (
            <Loader2 className='animate-spin' aria-hidden='true' />
          ) : null}
          {t('Continue')}
        </Button>
      </div>
    )
  } else if (step) {
    loginBody = (
      <div className='flex flex-col gap-3'>
        {step.verification_uri_complete || step.url ? (
          <a
            className='break-all text-(--ds-color-text-link) underline'
            href={step.verification_uri_complete || step.url}
            target='_blank'
            rel='noreferrer'
          >
            {step.verification_uri_complete || step.url}
          </a>
        ) : null}
        {step.user_code ? (
          <p className='text-sm'>
            {t('Code')}: <span className='tabular-nums'>{step.user_code}</span>
          </p>
        ) : null}
        {resolveLocalizedText(step.hint, i18n.language) ? (
          <p className='text-muted-foreground text-sm'>
            {resolveLocalizedText(step.hint, i18n.language)}
          </p>
        ) : null}
        {step.type === 'device' ? (
          <Button type='button' onClick={pollLogin} disabled={busy}>
            {t('I have finished signing in')}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={`${props.pluginName}: ${t('Plugin settings')}`}
      description={hint || t('Configure this plugin for the channel.')}
      footer={
        <div className='flex justify-end gap-2'>
          <Button
            type='button'
            variant='outline'
            onClick={() => props.onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button type='button' onClick={saveConfig}>
            {t('Save')}
          </Button>
        </div>
      }
    >
      <div className='flex flex-col gap-4'>
        {parsedConfig ? (
          <PluginConfigFields
            idPrefix='channel-plugin-config'
            schema={props.schema}
            config={parsedConfig}
            onChange={(next) =>
              setDraft(
                Object.keys(next).length ? JSON.stringify(next, null, 2) : ''
              )
            }
          />
        ) : null}
        <div className='flex flex-col gap-1.5'>
          <Label>{t('Plugin config (JSON)')}</Label>
          <JsonCodeEditor
            value={draft}
            onChange={setDraft}
            ariaLabel={t('Plugin config (JSON)')}
          />
          <p className='text-muted-foreground text-sm'>
            {t(
              'Fields the plugin declares are checked when the channel is saved.'
            )}
          </p>
        </div>

        {channelId ? (
          <div className='flex flex-col gap-2 border-t pt-3'>
            <div className='flex items-center justify-between gap-2'>
              <span className='text-sm font-medium'>{t('Credentials')}</span>
              <Button
                type='button'
                variant='outline'
                onClick={login}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className='animate-spin' aria-hidden='true' />
                ) : null}
                {t('Sign in')}
              </Button>
            </div>
            {credentialsBody}
            {loginBody}
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}
