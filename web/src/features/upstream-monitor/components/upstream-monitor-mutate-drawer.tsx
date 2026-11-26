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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
  SideDrawerSection,
  SideDrawerSectionHeader,
} from '@/components/drawer-layout'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { UpstreamModelSelection } from '@/features/channels/components/upstream-model-selection'
import { getServerErrorMessage } from '@/lib/server-error-message'

import {
  createUpstreamMonitorTask,
  fetchUpstreamMonitorModels,
  updateUpstreamMonitorTask,
} from '../api'
import { upstreamMonitorQueryKeys } from '../lib/upstream-monitor-actions'
import {
  createUpstreamMonitorFormSchema,
  transformUpstreamFormToPayload,
  type UpstreamMonitorFormInput,
  UPSTREAM_MONITOR_FORM_DEFAULTS,
  upstreamTaskToFormDefaults,
} from '../lib/upstream-monitor-form'
import type { UpstreamMonitorFormValues, UpstreamMonitorTask } from '../types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: UpstreamMonitorTask
}

export function UpstreamMonitorMutateDrawer(props: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isUpdate = Boolean(props.currentRow)
  const defaults = useMemo(
    () =>
      props.currentRow
        ? upstreamTaskToFormDefaults(props.currentRow)
        : UPSTREAM_MONITOR_FORM_DEFAULTS,
    [props.currentRow]
  )
  const [availableModels, setAvailableModels] = useState<string[]>(
    defaults.models
  )
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const schema = useMemo(
    () => createUpstreamMonitorFormSchema((key) => t(key)),
    [t]
  )
  const resolver = useMemo(() => zodResolver(schema), [schema])
  const form = useForm<
    UpstreamMonitorFormInput,
    unknown,
    UpstreamMonitorFormValues
  >({
    resolver,
    defaultValues: defaults,
  })

  const handleFetchModels = async () => {
    const values = form.getValues()
    if (values.base_url.trim() === '') {
      form.setError('base_url', {
        type: 'manual',
        message: t('Base URL is required'),
      })
      return
    }
    form.clearErrors('base_url')
    setIsFetchingModels(true)
    try {
      const models = await fetchUpstreamMonitorModels({
        base_url: values.base_url,
        protocol: values.protocol,
        api_key: values.api_key.trim() || undefined,
        task_id: isUpdate ? props.currentRow?.id : undefined,
      })
      setAvailableModels(models)
      toast.success(t('Fetched {{count}} models', { count: models.length }))
    } catch (error) {
      toast.error(getServerErrorMessage(error, t('Failed to fetch models')))
    } finally {
      setIsFetchingModels(false)
    }
  }

  const mutation = useMutation({
    mutationFn: (values: UpstreamMonitorFormValues) => {
      const payload = transformUpstreamFormToPayload(values, isUpdate)
      return isUpdate && props.currentRow
        ? updateUpstreamMonitorTask(props.currentRow.id, payload)
        : createUpstreamMonitorTask(payload)
    },
    onSuccess: () => {
      toast.success(
        isUpdate ? t('Monitor task updated') : t('Monitor task created')
      )
      void queryClient.invalidateQueries({
        queryKey: upstreamMonitorQueryKeys.tasks(),
      })
      props.onOpenChange(false)
    },
    onError: (error) => {
      toast.error(
        getServerErrorMessage(error, t('Failed to save monitor task'))
      )
    },
  })

  const onSubmit = (values: UpstreamMonitorFormValues) =>
    mutation.mutate(values)

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side='right'
        className={sideDrawerContentClassName('sm:max-w-[600px]')}
      >
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>
            {isUpdate ? t('Edit monitor') : t('Add upstream monitor')}
          </SheetTitle>
          <SheetDescription>
            {t(
              'Configure an upstream endpoint for continuous quality, speed and authenticity monitoring.'
            )}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            id='upstream-monitor-form'
            className={sideDrawerFormClassName()}
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <SideDrawerSection>
              <SideDrawerSectionHeader title={t('Endpoint')} />
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Name')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('e.g. Primary Claude relay')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='base_url'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Base URL')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder='https://api.example.com/v1'
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'OpenAI-compatible endpoints use /v1; Anthropic endpoints use the messages API.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='api_key'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('API key')}</FormLabel>
                    <FormControl>
                      <Input {...field} type='password' autoComplete='off' />
                    </FormControl>
                    <FormDescription>
                      {isUpdate
                        ? t('Leave blank to keep the current key.')
                        : t(
                            'Encrypted at rest; a short fingerprint is shown after saving.'
                          )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='models'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Models')}</FormLabel>
                    <div className='space-y-2'>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        disabled={isFetchingModels}
                        onClick={() => void handleFetchModels()}
                      >
                        {isFetchingModels
                          ? t('Fetching models...')
                          : t('Fetch models')}
                      </Button>
                      <FormControl>
                        <UpstreamModelSelection
                          models={availableModels}
                          selected={field.value}
                          onChange={field.onChange}
                          existingModels={[]}
                          showChanges={false}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Fetch the upstream model list, then select individually or use Select all models.'
                        )}
                      </FormDescription>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SideDrawerSection>

            <SideDrawerSection>
              <SideDrawerSectionHeader title={t('Monitoring')} />
              <FormField
                control={form.control}
                name='protocol'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Protocol')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='openai'>
                          OpenAI-compatible
                        </SelectItem>
                        <SelectItem value='anthropic'>
                          Anthropic messages
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='probe_depth'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Probe depth')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='quick'>{t('Quick')}</SelectItem>
                        <SelectItem value='standard'>
                          {t('Standard')}
                        </SelectItem>
                        <SelectItem value='full'>{t('Full')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='check_interval_minute'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Check interval (minutes)')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        onChange={(event) =>
                          field.onChange(event.target.valueAsNumber)
                        }
                        type='number'
                        min={1}
                        max={10080}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='enabled'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between'>
                    <FormLabel>{t('Enabled')}</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </SideDrawerSection>
          </form>
        </Form>
        <SheetFooter className={sideDrawerFooterClassName()}>
          <Button
            type='submit'
            form='upstream-monitor-form'
            disabled={mutation.isPending}
          >
            {mutation.isPending ? t('Saving...') : t('Save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
