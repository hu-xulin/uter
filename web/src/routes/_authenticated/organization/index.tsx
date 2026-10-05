/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without any warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
import { createFileRoute, redirect } from '@tanstack/react-router'

import { OrganizationPage } from '@/features/organization'
import { canManageOrganization } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/organization/')({
  // 直接使用 URL 访问时同样受权：判定与后端 middleware.OrgAdminAuth 一致，
  // 组织普通成员（member）与不属于组织的账号一律跳 403。
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()

    if (!canManageOrganization(auth.user)) {
      throw redirect({
        to: '/403',
      })
    }
  },
  component: OrganizationPage,
})
