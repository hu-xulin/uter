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
import type { TFunction } from 'i18next'

import type { NodeSync, NodeSyncNode } from '../types'

export const NODE_SYNC_QUERY_KEY = ['system-info', 'node-sync'] as const

/** 服务端注册的同步主题的展示名；其它主题直接显示 id。 */
const SYNC_TOPIC_LABELS: Record<string, string> = {
  options: 'Settings',
  channels: 'Channels',
  authz: 'Permissions',
  plugins: 'Plugins',
  oauth_providers: 'Login providers',
  models: 'Models',
  subscription_plans: 'Subscription Plans',
}

export type NodeSyncState = 'synced' | 'updating' | 'failed'

export function syncTopicLabel(topic: string, t: TFunction) {
  const label = SYNC_TOPIC_LABELS[topic]
  return label ? t(label) : topic
}

/**
 * 本次要观察的主题，限制在服务端实际注册的主题内。未指定时观察全部已注册主题。
 * 服务端未运行的主题（例如关闭时的渠道缓存）在任何节点上都没有状态。
 */
export function registeredSyncTopics(sync: NodeSync, topics?: string[]) {
  const registered = sync.topics.map((item) => item.topic)
  if (!topics) return registered
  return topics.filter((topic) => registered.includes(topic))
}

/** 任一主题加载失败即视为失败，否则在全部主题同步前视为更新中。 */
export function nodeSyncState(
  node: NodeSyncNode,
  topics: string[]
): NodeSyncState {
  let state: NodeSyncState = 'synced'
  for (const topic of topics) {
    const entry = node.topics[topic]
    if (entry?.error || Object.keys(entry?.errors ?? {}).length > 0) {
      return 'failed'
    }
    if (!entry?.synced) state = 'updating'
  }
  return state
}
