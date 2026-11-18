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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { CodeBlock } from '@/components/ai-elements/code-block'
import { JsonCodeEditor } from '@/components/json-code-editor'
import { PluginConfigFields } from '@/components/plugin-config-fields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getTaskPluginOptions } from '@/features/channels/api'

import {
  dryRunRequestPlugins,
  listRequestPluginInstances,
  updateRequestPluginInstances,
  type RequestPluginInstance,
} from '../api'

const INSTANCES_QUERY_KEY = ['request-plugin-instances']
const DRY_RUN_BODY = `{
  "model": "gpt-4o",
  "messages": [{ "role": "user", "content": "hello" }]
}`

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Request processing instances: the saved list edited as JSON, and a dry run
 * that executes the instances on a sample body without sending or charging it.
 * The editor keeps the whole list so a new instance is one more array entry.
 */
export function RequestPluginManager() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const instancesQuery = useQuery({
    queryKey: INSTANCES_QUERY_KEY,
    queryFn: listRequestPluginInstances,
  })
  const [instancesText, setInstancesText] = useState('[]')
  const [synced, setSynced] = useState(false)
  const [selectedInstanceId, setSelectedInstanceId] = useState('')
  const pluginOptions = useQuery({
    queryKey: ['task-plugin-options'],
    queryFn: getTaskPluginOptions,
  })
  useEffect(() => {
    if (instancesQuery.data && !synced) {
      setInstancesText(
        JSON.stringify(instancesQuery.data as RequestPluginInstance[], null, 2)
      )
      setSynced(true)
    }
  }, [instancesQuery.data, synced])

  const instances = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(instancesText)
      if (Array.isArray(parsed)) return parsed as RequestPluginInstance[]
    } catch {
      // The JSON editor shows the invalid draft; fields stay hidden.
    }
    return []
  }, [instancesText])
  const selectedInstance =
    instances.find((instance) => instance.id === selectedInstanceId) ??
    instances[0]
  const selectedSchema = pluginOptions.data?.find(
    (option) => option.key === selectedInstance?.plugin
  )?.configSchema

  const updateSelectedConfig = (next: Record<string, unknown>) => {
    if (!selectedInstance) return
    const updated = instances.map((instance) =>
      instance.id === selectedInstance.id
        ? { ...instance, config: next }
        : instance
    )
    setInstancesText(JSON.stringify(updated, null, 2))
  }

  const save = useMutation({
    mutationFn: async () => {
      const parsed: unknown = JSON.parse(instancesText)
      if (!Array.isArray(parsed)) {
        throw new Error(t('Invalid JSON'))
      }
      return updateRequestPluginInstances(parsed as RequestPluginInstance[])
    },
    onSuccess: () => {
      toast.success(t('Saved'))
      void queryClient.invalidateQueries({ queryKey: INSTANCES_QUERY_KEY })
    },
    onError: (error) => toast.error(messageOf(error)),
  })

  const [format, setFormat] = useState('openai')
  const [model, setModel] = useState('gpt-4o')
  const [bodyText, setBodyText] = useState(DRY_RUN_BODY)
  const [result, setResult] = useState('')
  const run = useMutation({
    mutationFn: async () =>
      dryRunRequestPlugins({
        format,
        model,
        body: JSON.parse(bodyText),
      }),
    onSuccess: (data) => setResult(JSON.stringify(data, null, 2)),
    onError: (error) => toast.error(messageOf(error)),
  })

  return (
    <div className='flex flex-col gap-4'>
      <section className='bg-card rounded-lg border p-4'>
        <div className='mb-2 flex items-center justify-between gap-2'>
          <Label htmlFor='request-plugin-instances'>
            {t('Request plugin instances')}
          </Label>
          <Button
            type='button'
            onClick={() => save.mutate()}
            disabled={save.isPending || instancesQuery.isLoading}
          >
            {t('Save')}
          </Button>
        </div>
        {instances.length > 0 ? (
          <div className='mb-3 flex flex-col gap-3 rounded-md border p-3'>
            <Label htmlFor='request-plugin-instance-selector'>
              {t('Configuration fields')}
            </Label>
            <Select
              value={selectedInstance?.id ?? ''}
              onValueChange={(value) => setSelectedInstanceId(String(value))}
            >
              <SelectTrigger
                id='request-plugin-instance-selector'
                aria-label={t('Instance')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {instances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      {instance.name || instance.id}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {selectedInstance && selectedSchema ? (
              <PluginConfigFields
                idPrefix={`request-plugin-${selectedInstance.id}`}
                schema={selectedSchema}
                config={selectedInstance.config ?? {}}
                onChange={updateSelectedConfig}
              />
            ) : (
              <p className='text-muted-foreground text-sm'>
                {t(
                  'This plugin declares no configuration fields; edit its config in the JSON below.'
                )}
              </p>
            )}
          </div>
        ) : null}
        <JsonCodeEditor
          ariaLabel={t('Request plugin instances')}
          id='request-plugin-instances'
          value={instancesText}
          onChange={setInstancesText}
        />
      </section>

      <section className='bg-card rounded-lg border p-4'>
        <div className='mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2'>
          <div className='flex flex-col gap-2'>
            <Label htmlFor='request-plugin-format'>{t('Format')}</Label>
            <Input
              id='request-plugin-format'
              value={format}
              onChange={(event) => setFormat(event.target.value)}
            />
          </div>
          <div className='flex flex-col gap-2'>
            <Label htmlFor='request-plugin-model'>{t('Model')}</Label>
            <Input
              id='request-plugin-model'
              value={model}
              onChange={(event) => setModel(event.target.value)}
            />
          </div>
        </div>
        <div className='mb-2 flex items-center justify-between gap-2'>
          <Label htmlFor='request-plugin-body'>{t('Request body')}</Label>
          <Button
            type='button'
            onClick={() => run.mutate()}
            disabled={run.isPending}
          >
            {t('Dry run')}
          </Button>
        </div>
        <JsonCodeEditor
          ariaLabel={t('Request body')}
          id='request-plugin-body'
          value={bodyText}
          onChange={setBodyText}
        />
        {result ? (
          <div className='mt-4'>
            <Label>{t('Dry run result')}</Label>
            <CodeBlock className='mt-2' code={result} language='json' />
          </div>
        ) : null}
      </section>
    </div>
  )
}
