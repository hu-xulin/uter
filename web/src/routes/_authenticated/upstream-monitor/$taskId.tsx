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
import { createFileRoute, redirect } from '@tanstack/react-router'
import z from 'zod'

import { UpstreamMonitorReportDetail } from '@/features/upstream-monitor/components/upstream-monitor-report-detail'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

const reportSearchSchema = z.object({
  reportId: z.number().optional().catch(undefined),
  model: z.string().optional().catch(undefined),
})

function ReportDetailRoute() {
  const { taskId } = Route.useParams()
  const { reportId, model } = Route.useSearch()
  const parsedTaskId = Number(taskId)
  if (!Number.isFinite(parsedTaskId) || parsedTaskId <= 0) return null
  return (
    <UpstreamMonitorReportDetail
      taskId={parsedTaskId}
      reportId={reportId}
      model={model}
    />
  )
}

export const Route = createFileRoute(
  '/_authenticated/upstream-monitor/$taskId'
)({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()
    if (!auth.user || auth.user.role < ROLE.ADMIN) {
      throw redirect({ to: '/403' })
    }
  },
  validateSearch: reportSearchSchema,
  component: ReportDetailRoute,
})
