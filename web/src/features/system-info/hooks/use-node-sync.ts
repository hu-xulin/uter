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
import { useQuery } from '@tanstack/react-query'

import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { getNodeSync } from '../api'
import { NODE_SYNC_QUERY_KEY, registeredSyncTopics } from '../lib/node-sync'

const UPDATING_INTERVAL_MS = 3_000
const IDLE_INTERVAL_MS = 30_000

/**
 * 每个节点是否已加载各主题的最新版本。只要有在线节点尚未加载被观察的主题，
 * 每 3 秒刷新一次；否则每 30 秒以及窗口重新聚焦时刷新。仅 root 可读取。
 */
export function useNodeSync(topics?: string[]) {
  const isRoot = useAuthStore(
    (state) => state.auth.user?.role === ROLE.SUPER_ADMIN
  )
  return useQuery({
    queryKey: NODE_SYNC_QUERY_KEY,
    queryFn: getNodeSync,
    enabled: isRoot,
    retry: false,
    meta: { errorToast: false },
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const sync = query.state.data
      if (!sync) return IDLE_INTERVAL_MS
      const watched = registeredSyncTopics(sync, topics)
      const updating = sync.nodes.some(
        (node) =>
          node.online && watched.some((topic) => !node.topics[topic]?.synced)
      )
      return updating ? UPDATING_INTERVAL_MS : IDLE_INTERVAL_MS
    },
  })
}