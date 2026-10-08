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
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

import {
  SettingsForm,
  SettingsFormGrid,
  SettingsFormGridItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

export const PRICING_SOURCE_OPTION_KEY = 'PricingSource'

export const PRICING_SOURCE_VALUES = [
  'official',
  'models.dev',
  'channel',
] as const

export type PricingSourceValue = (typeof PRICING_SOURCE_VALUES)[number]

const schema = z.object({
  pricingSource: z.enum(PRICING_SOURCE_VALUES),
})

type Values = z.infer<typeof schema>

function normalizeSource(value: unknown): PricingSourceValue {
  return PRICING_SOURCE_VALUES.includes(value as PricingSourceValue)
    ? (value as PricingSourceValue)
    : 'official'
}

const SOURCE_OPTION_KEYS: Record<PricingSourceValue, string> = {
  official: 'Official pricing preset',
  'models.dev': 'models.dev pricing preset',
  channel: 'Custom channel pricing',
}

const SOURCE_HINT_KEYS: Record<PricingSourceValue, string> = {
  official: 'Official price',
  'models.dev': 'Official price',
  channel: 'Platform price',
}

/**
 * Chooses which pricing preset / source the public model plaza treats as the
 * authoritative price.
 *
 * - `official` / `models.dev`: prices come from a public pricing preset and are
 *   labelled "Official price" in the plaza.
 * - `channel`: prices come from the platform's own configured channel rates and
 *   are labelled "Platform price" (super admin) or "Price" (visitors).
 *
 * Whichever option is chosen here also decides the reference used for the
 * strike-through official price and the discount badge: when the platform price
 * is lower than the presets official price the official price is struck out and
 * a "-xx%" badge plus a green "xx折" tag are shown after the model name.
 */
export function PricingSourceSection({
  defaultSource,
}: {
  defaultSource: string
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const initialSource = normalizeSource(defaultSource)

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: { pricingSource: initialSource },
  })

  const { isDirty, isSubmitting } = form.formState

  async function onSubmit(values: Values) {
    if (values.pricingSource === initialSource) {
      toast.info(t('No changes to save'))
      return
    }
    await updateOption.mutateAsync({
      key: PRICING_SOURCE_OPTION_KEY,
      value: values.pricingSource,
    })
    form.reset(values)
  }

  return (
    <SettingsSection title={t('Pricing Source')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!isDirty}
            saveLabel='Save pricing source'
          />
          <SettingsFormGrid>
            <SettingsFormGridItem span='full'>
              <FormField
                control={form.control}
                name='pricingSource'
                render={({ field }) => (
                  <FormItem>
                    <FormDescription>
                      {t('Pricing source usage hint')}
                    </FormDescription>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={updateOption.isPending || isSubmitting}
                        className='gap-3'
                      >
                        {PRICING_SOURCE_VALUES.map((value) => (
                          <label
                            key={value}
                            htmlFor={`pricing-source-${value}`}
                            className='hover:bg-muted/40 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors'
                          >
                            <RadioGroupItem
                              id={`pricing-source-${value}`}
                              value={value}
                              className='mt-0.5'
                            />
                            <span className='flex flex-col gap-0.5'>
                              <FormLabel className='cursor-pointer'>
                                {t(SOURCE_OPTION_KEYS[value])}
                              </FormLabel>
                              <span className='text-muted-foreground text-xs'>
                                {t(SOURCE_HINT_KEYS[value])}
                              </span>
                            </span>
                          </label>
                        ))}
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />
            </SettingsFormGridItem>
          </SettingsFormGrid>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
