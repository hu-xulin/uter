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
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'

import { UpstreamMonitorMutateDrawer } from './components/upstream-monitor-mutate-drawer'
import { UpstreamMonitorTable } from './components/upstream-monitor-table'
import type { UpstreamMonitorTask } from './types'

export function UpstreamMonitor() {
  const { t } = useTranslation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [currentRow, setCurrentRow] = useState<
    UpstreamMonitorTask | undefined
  >()
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleCreate = () => {
    setCurrentRow(undefined)
    setDrawerOpen(true)
  }

  const handleEdit = (task: UpstreamMonitorTask) => {
    setCurrentRow(task)
    setDrawerOpen(true)
  }

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>
          {t('Upstream Monitor')}
          <p className='text-muted-foreground mt-1 text-sm font-normal'>
            {t(
              'Continuously probe upstream endpoints for availability, speed, authenticity and billing honesty.'
            )}
          </p>
        </SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <Button size='sm' onClick={handleCreate}>
            <Plus className='size-4' />
            {t('Add monitor')}
          </Button>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div key={refreshTrigger}>
            <UpstreamMonitorTable
              onEdit={handleEdit}
              refreshTrigger={refreshTrigger}
            />
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>
      <UpstreamMonitorMutateDrawer
        key={drawerOpen ? (currentRow?.id ?? 'new') : 'closed'}
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open)
          if (!open) setRefreshTrigger((value) => value + 1)
        }}
        currentRow={currentRow}
      />
    </>
  )
}
