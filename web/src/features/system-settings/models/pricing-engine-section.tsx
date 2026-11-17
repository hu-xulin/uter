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
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormLabel,
} from '@/components/ui/form'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const schema = z.object({
  PricingEngine: z.enum(['uter', 'upstream']),
})

type FormValues = z.infer<typeof schema>

export function PricingEngineSection(props: { defaultValue: string }) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const defaultEngine = props.defaultValue === 'upstream' ? 'upstream' : 'uter'
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { PricingEngine: defaultEngine },
  })

  useEffect(() => {
    form.reset({ PricingEngine: defaultEngine })
  }, [defaultEngine, form])

  const onSubmit = async (values: FormValues) => {
    await updateOption.mutateAsync({
      key: 'PricingEngine',
      value: values.PricingEngine,
    })
    form.reset(values)
  }

  return (
    <SettingsSection title={t('Pricing Engine')}>
      <p className='text-muted-foreground text-sm'>
        {t(
          'The instance default. A channel can override it in its own settings without changing every other channel.'
        )}
      </p>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />
          <FormField
            control={form.control}
            name='PricingEngine'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Pricing stack')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Uter keeps its expression, plugin and cost-optimization behavior. Upstream applies the newer upstream new-api pricing rules to the same configured prices.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <NativeSelect
                    aria-label={t('Pricing stack')}
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                  >
                    <NativeSelectOption value='uter'>
                      {t('Uter (default)')}
                    </NativeSelectOption>
                    <NativeSelectOption value='upstream'>
                      {t('Upstream new-api')}
                    </NativeSelectOption>
                  </NativeSelect>
                </FormControl>
              </SettingsSwitchItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
