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
import { ImageUp, Trash2 } from 'lucide-react'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { ADVANCED_CUSTOM_LOGO_MAX_BYTES } from '../lib/advanced-custom'

type ChannelBrandingEditorProps = {
  displayName: string
  logo: string
  logoDark: string
  fallbackLabel: string
  disabled?: boolean
  onDisplayNameChange: (value: string) => void
  onLogoChange: (value: string) => void
  onLogoDarkChange: (value: string) => void
}

export function ChannelBrandingEditor(props: ChannelBrandingEditorProps) {
  const { t } = useTranslation()
  const lightFileRef = useRef<HTMLInputElement>(null)
  const darkFileRef = useRef<HTMLInputElement>(null)
  const maxLogoKB = Math.round(ADVANCED_CUSTOM_LOGO_MAX_BYTES / 1024)
  const label = props.displayName.trim() || props.fallbackLabel

  const chooseLogoFile = (
    file: File | undefined | null,
    onChange: (value: string) => void
  ) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error(t('Please select an image file'))
      return
    }
    if (file.size > ADVANCED_CUSTOM_LOGO_MAX_BYTES) {
      toast.error(
        t('Image is too large. Maximum size is {{size}} KB.', {
          size: maxLogoKB,
        })
      )
      return
    }
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      const dataUrl = String(reader.result || '')
      if (dataUrl) onChange(dataUrl)
    })
    reader.readAsDataURL(file)
  }

  return (
    <div className='bg-muted/10 space-y-4 rounded-lg border p-4'>
      <div>
        <p className='font-medium'>{t('Channel display')}</p>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Customize the name and logo shown on channel cards. Leave empty to use the defaults.'
          )}
        </p>
      </div>

      <div className='space-y-1.5'>
        <div className='flex flex-wrap items-center gap-2'>
          <Label htmlFor='channel-branding-name'>
            {t('Channel display name')}
          </Label>
          <BrandingPreview
            logo={props.logo}
            logoDark={props.logoDark}
            label={label}
            fallbackLabel={props.fallbackLabel}
          />
        </div>
        <Input
          id='channel-branding-name'
          value={props.displayName}
          maxLength={50}
          disabled={props.disabled}
          placeholder={props.fallbackLabel}
          onChange={(event) => props.onDisplayNameChange(event.target.value)}
        />
      </div>

      <LogoField
        id='channel-branding-logo'
        label={t('Logo image')}
        value={props.logo}
        disabled={props.disabled}
        inputRef={lightFileRef}
        onChange={props.onLogoChange}
        onFile={chooseLogoFile}
      />

      <LogoField
        id='channel-branding-logo-dark'
        label={t('Dark logo image')}
        description={t(
          'Shown in dark theme. Leave empty to use the light logo.'
        )}
        value={props.logoDark}
        disabled={props.disabled}
        inputRef={darkFileRef}
        onChange={props.onLogoDarkChange}
        onFile={chooseLogoFile}
      />
    </div>
  )
}

function LogoField(props: {
  id: string
  label: string
  description?: string
  value: string
  disabled?: boolean
  inputRef: RefObject<HTMLInputElement | null>
  onChange: (value: string) => void
  onFile: (
    file: File | undefined | null,
    onChange: (value: string) => void
  ) => void
}) {
  const { t } = useTranslation()
  return (
    <div className='space-y-1.5'>
      <Label htmlFor={props.id}>{props.label}</Label>
      <div className='flex flex-wrap items-center gap-2'>
        <Input
          id={props.id}
          value={props.value}
          disabled={props.disabled}
          inputMode='url'
          placeholder='https://example.com/logo.png'
          className='min-w-0 flex-1 sm:min-w-64'
          onChange={(event) => props.onChange(event.target.value)}
        />
        <input
          ref={props.inputRef}
          type='file'
          accept='image/*'
          className='hidden'
          onChange={(event) => {
            props.onFile(event.target.files?.[0], props.onChange)
            event.target.value = ''
          }}
        />
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={props.disabled}
          onClick={() => props.inputRef.current?.click()}
        >
          <ImageUp data-icon='inline-start' />
          {t('Upload image')}
        </Button>
        {props.value.trim() ? (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            disabled={props.disabled}
            onClick={() => props.onChange('')}
          >
            <Trash2 data-icon='inline-start' />
            {t('Remove logo')}
          </Button>
        ) : null}
      </div>
      <p className='text-muted-foreground text-sm'>
        {props.description ||
          t(
            'Paste an image URL or upload a local image (up to {{size}} KB). Leave empty to use the default logo.',
            { size: Math.round(ADVANCED_CUSTOM_LOGO_MAX_BYTES / 1024) }
          )}
      </p>
    </div>
  )
}

function BrandingPreview(props: {
  logo: string
  logoDark: string
  label: string
  fallbackLabel: string
}) {
  const { t } = useTranslation()
  const [lightBroken, setLightBroken] = useState(false)
  const [darkBroken, setDarkBroken] = useState(false)
  const label = props.label || props.fallbackLabel
  const lightLogo = props.logo.trim()
  const darkLogo = props.logoDark.trim() || lightLogo
  const showLight = lightLogo !== '' && !lightBroken
  const showDark = darkLogo !== '' && !darkBroken

  useEffect(() => {
    setLightBroken(false)
  }, [props.logo])
  useEffect(() => {
    setDarkBroken(false)
  }, [props.logoDark])

  return (
    <span className='bg-muted text-muted-foreground inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs font-normal'>
      <span className='inline-flex items-center gap-1'>
        {showLight ? (
          <img
            src={lightLogo}
            alt=''
            aria-hidden='true'
            className='size-4 rounded-full object-cover'
            onError={() => setLightBroken(true)}
          />
        ) : (
          <span className='bg-background inline-flex size-4 items-center justify-center rounded-full text-xs font-medium'>
            {label.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span>{t('Light')}</span>
      </span>
      <span className='inline-flex items-center gap-1'>
        {showDark ? (
          <img
            src={darkLogo}
            alt=''
            aria-hidden='true'
            className='size-4 rounded-full object-cover'
            onError={() => setDarkBroken(true)}
          />
        ) : (
          <span className='bg-background inline-flex size-4 items-center justify-center rounded-full text-xs font-medium'>
            {label.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span>{t('Dark')}</span>
      </span>
      <span className='max-w-40 truncate'>{label}</span>
      <span className='sr-only'>{t('Preview')}</span>
    </span>
  )
}
