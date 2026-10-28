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
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Loader2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { createServerError } from '@/lib/server-error-message'

import { modelsQueryKeys, vendorsQueryKeys } from '../../lib'
import {
  deleteVendorMergeRule,
  getVendorMergeRules,
  type VendorMergeRule,
} from '../../vendor-api'

export function VendorMergeRulesDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [pendingId, setPendingId] = useState<number | null>(null)

  const query = useQuery({
    queryKey: vendorsQueryKeys.mergeRules(),
    queryFn: async () => {
      const response = await getVendorMergeRules()
      if (!response.success || !response.data) {
        throw createServerError(response, t('Failed to load auto-merge rules'))
      }
      return response.data
    },
    enabled: props.open,
  })

  const removeMutation = useMutation({
    mutationFn: (id: number) => deleteVendorMergeRule(id),
    onSuccess: () => {
      setPendingId(null)
      void queryClient.invalidateQueries({ queryKey: vendorsQueryKeys.all })
      void queryClient.invalidateQueries({ queryKey: modelsQueryKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['pricing'] })
      void query.refetch()
    },
  })

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Auto-merge rules')}
      description={t(
        'These rules were created when you merged vendors. New vendors matching a rule are merged automatically. Revoke a rule to let its source appear as a separate vendor again.'
      )}
      contentClassName='sm:max-w-2xl'
      footer={
        <Button variant='outline' onClick={() => props.onOpenChange(false)}>
          {t('Close')}
        </Button>
      }
    >
      <div className='space-y-3'>
        {query.isPending && <LoadingState />}
        {query.isError && (
          <ErrorState
            description={query.error.message}
            onRetry={() => void query.refetch()}
          />
        )}
        {!query.isPending &&
        !query.isError &&
        query.data &&
        query.data.length === 0 ? (
          <p className='text-muted-foreground py-8 text-center text-sm'>
            {t('No auto-merge rules yet. Merge a vendor to create one.')}
          </p>
        ) : null}
        {!query.isPending &&
        !query.isError &&
        query.data &&
        query.data.length > 0 ? (
          <ul className='divide-y rounded-md border'>
            {query.data.map((rule: VendorMergeRule) => (
              <li
                key={rule.id}
                className='flex items-center justify-between gap-3 px-4 py-3'
              >
                <div className='min-w-0'>
                  <div className='flex items-center gap-2 text-sm'>
                    <span className='font-medium'>{rule.source_name}</span>
                    <ArrowRight className='text-muted-foreground size-4' />
                    <span className='font-medium'>
                      {rule.target_vendor_name || t('Unknown vendor')}
                    </span>
                  </div>
                  {rule.source_patterns.length > 0 && (
                    <p className='text-muted-foreground mt-0.5 truncate text-sm'>
                      {t('Matches')}: {rule.source_patterns.join(', ')}
                    </p>
                  )}
                </div>
                <div className='flex shrink-0 items-center gap-2'>
                  {pendingId === rule.id ? (
                    <>
                      <Button
                        variant='ghost'
                        size='sm'
                        disabled={removeMutation.isPending}
                        onClick={() => setPendingId(null)}
                      >
                        {t('Cancel')}
                      </Button>
                      <Button
                        variant='destructive'
                        size='sm'
                        disabled={removeMutation.isPending}
                        onClick={() => removeMutation.mutate(rule.id)}
                      >
                        {removeMutation.isPending ? (
                          <Loader2 className='size-4.5 animate-spin' />
                        ) : null}
                        {t('Confirm undo')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={removeMutation.isPending}
                      onClick={() => setPendingId(rule.id)}
                    >
                      <Undo2 className='size-4.5' />
                      {t('Undo')}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Dialog>
  )
}
