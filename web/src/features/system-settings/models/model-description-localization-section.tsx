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
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Form,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { SecretInput } from '@/components/ui/secret-input'
import { Switch } from '@/components/ui/switch'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

/**
 * 模型描述多语化（Model Description Localization）
 *
 * 上游 llm-metadata 只维护 zh/en/ja 三份目录文件，而定价页面向 7 种语言。
 * 开启本区块后，每次「同步上游渠道数据」都会额外拉取三语目录写入
 * models.descriptions；上游缺失的语种（繁中/法语/俄语/越南语）再由站内
 * LLM 从英文原文补译。
 *
 * 默认全部关闭：开启会产生真实的外部请求与额度消耗（补译每条描述一次
 * LLM 调用），必须由管理员显式确认。
 */

const schema = z.object({
  ModelDescriptionSyncEnabled: z.boolean(),
  ModelDescriptionTranslateEnabled: z.boolean(),
  ModelDescriptionTranslateBaseURL: z.string(),
  ModelDescriptionTranslateApiKey: z.string(),
  ModelDescriptionTranslateModel: z.string(),
  ModelDescriptionTranslateLocales: z.string(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  defaultValues: Partial<Record<keyof FormValues, string | number | boolean>>
}

const asBool = (v: unknown): boolean => v === true || v === 'true'
const asText = (v: unknown): string => (v === undefined || v === null ? '' : String(v))

export function ModelDescriptionLocalizationSection({ defaultValues }: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    // 关闭时也要能提交：z.boolean() 对 undefined 报错，而未配置过的 key
    // 在 Options 表里可能压根不存在，故用默认值兜底。
    values: useMemo<FormValues>(
      () => ({
        ModelDescriptionSyncEnabled: asBool(defaultValues.ModelDescriptionSyncEnabled),
        ModelDescriptionTranslateEnabled: asBool(
          defaultValues.ModelDescriptionTranslateEnabled
        ),
        ModelDescriptionTranslateBaseURL: asText(
          defaultValues.ModelDescriptionTranslateBaseURL
        ),
        ModelDescriptionTranslateApiKey: asText(
          defaultValues.ModelDescriptionTranslateApiKey
        ),
        ModelDescriptionTranslateModel: asText(
          defaultValues.ModelDescriptionTranslateModel
        ),
        ModelDescriptionTranslateLocales: asText(
          defaultValues.ModelDescriptionTranslateLocales
        ),
      }),
      [defaultValues]
    ),
  })

  const syncOn = form.watch('ModelDescriptionSyncEnabled')
  const translateOn = form.watch('ModelDescriptionTranslateEnabled')

  const onSubmit = (values: FormValues) => {
    // useUpdateOption 是单键更新，toast 与错误处理都由 hook 统一负责，
    // 这里只负责把表单值按后端 Options 表期望的字符串逐项提交。
    const entries: Array<[keyof FormValues, string]> = [
      [
        'ModelDescriptionSyncEnabled',
        values.ModelDescriptionSyncEnabled ? 'true' : 'false',
      ],
      [
        'ModelDescriptionTranslateEnabled',
        values.ModelDescriptionTranslateEnabled ? 'true' : 'false',
      ],
      [
        'ModelDescriptionTranslateBaseURL',
        values.ModelDescriptionTranslateBaseURL.trim(),
      ],
      [
        'ModelDescriptionTranslateApiKey',
        values.ModelDescriptionTranslateApiKey.trim(),
      ],
      [
        'ModelDescriptionTranslateModel',
        values.ModelDescriptionTranslateModel.trim(),
      ],
      [
        'ModelDescriptionTranslateLocales',
        values.ModelDescriptionTranslateLocales.trim(),
      ],
    ]
    for (const [key, value] of entries) {
      updateOption.mutate({ key, value })
    }
  }

  return (
    <SettingsSection
      title={t('Model Description Localization')}
    >
      <p className='text-muted-foreground text-sm'>
        {t(
          'After syncing upstream channel data, automatically fetch the official Chinese, English and Japanese descriptions, then use the site LLM to fill in the other six languages (zh, zh-TW, fr, ja, ru, vi). The upstream catalog does not cover every model, so Chinese and Japanese are included as a safety net. Only missing entries are filled in — existing text is never overwritten.'
        )}
      </p>
      <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
        <Form {...form}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />
          <SettingsSwitchItem>
            <SettingsSwitchContent>
              <FormLabel>{t('Localize model descriptions')}</FormLabel>
              <FormDescription>
                {t(
                  'Fetch multi-language descriptions after each upstream sync. Only fills in missing languages; existing text is never overwritten.'
                )}
              </FormDescription>
            </SettingsSwitchContent>
            <FormControl>
              <Switch
                checked={syncOn}
                onCheckedChange={(checked) =>
                  form.setValue('ModelDescriptionSyncEnabled', checked)
                }
                disabled={updateOption.isPending}
              />
            </FormControl>
          </SettingsSwitchItem>

          {syncOn && (
            <>
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Translate missing languages with LLM')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Requires the API base URL, API key and model below to be filled in. Each missing description costs one LLM call.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={translateOn}
                    onCheckedChange={(checked) =>
                      form.setValue('ModelDescriptionTranslateEnabled', checked)
                    }
                    disabled={updateOption.isPending}
                  />
                </FormControl>
              </SettingsSwitchItem>

              {translateOn && (
                <>
                  <FormField
                    control={form.control}
                    name='ModelDescriptionTranslateBaseURL'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Translation API Base URL')}</FormLabel>
                        <FormControl>
                          <Input autoComplete='off'
                            {...field}
                            value={asText(field.value)}
                            placeholder='https://api.example.com/v1'
                            disabled={updateOption.isPending}
                          />
                        </FormControl>
                        <FormDescription>
                          {t(
                            'OpenAI-compatible endpoint. A trailing /v1 is optional; it is normalized automatically.'
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='ModelDescriptionTranslateApiKey'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Translation API Key')}</FormLabel>
                        <FormControl>
                          <SecretInput
                            {...field}
                            value={asText(field.value)}
                            disabled={updateOption.isPending}
                          />
                        </FormControl>
                        <FormDescription>
                          {t('Stored masked; leaving it empty clears the saved key.')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='ModelDescriptionTranslateModel'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Translation Model')}</FormLabel>
                        <FormControl>
                          <Input autoComplete='off'
                            {...field}
                            value={asText(field.value)}
                            placeholder='gpt-4o-mini'
                            disabled={updateOption.isPending}
                          />
                        </FormControl>
                        <FormDescription>
                          {t(
                            'A small, inexpensive model is enough: model descriptions are one or two sentences.'
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='ModelDescriptionTranslateLocales'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Locales to translate')}</FormLabel>
                        <FormControl>
                          <Input autoComplete='off'
                            {...field}
                            value={asText(field.value)}
                            placeholder='zh, zh-TW, fr, ja, ru, vi'
                            disabled={updateOption.isPending}
                          />
                        </FormControl>
                        <FormDescription>
                          {t(
                            'Comma-separated. Leave empty to use the default: zh, zh-TW, fr, ja, ru, vi — every language this site supports except English. The upstream catalog ships only Chinese, English and Japanese and does not cover every model, so the rest are filled in by translation. A locale with no translation falls back to English rather than showing an empty description.'
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </>
          )}
        </Form>
      </SettingsForm>
    </SettingsSection>
  )
}
