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
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { scopedStateStorage } from '@/lib/scoped-storage'

/**
 * The read list only ever grows, and every announcement row asks whether it was
 * read, so it is kept bounded — the oldest entries are the least useful.
 */
const MAX_TRACKED_READ_ANNOUNCEMENTS = 200

const initialState = {
  lastReadNotice: '',
  readAnnouncementKeys: [] as string[],
  closedUntilDate: null as string | null,
}

interface NotificationState {
  // Last read Notice content signature (full trimmed message)
  lastReadNotice: string
  // Array of read announcement keys (id or content hash)
  readAnnouncementKeys: string[]
  // Timestamp of last "Close Today" action
  closedUntilDate: string | null

  // Actions
  markNoticeRead: (noticeContent: string) => void
  markAnnouncementsRead: (keys: string[]) => void
  setClosedUntilDate: (date: string | null) => void
  isAnnouncementRead: (key: string) => boolean
  isNoticeClosed: () => boolean
  reset: () => void
}

/**
 * Notification store for tracking read status of Notice and Announcements
 * Persists to localStorage to maintain state across sessions
 */
export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      ...initialState,

      markNoticeRead: (noticeContent: string) => {
        // Persist the full trimmed content so edits beyond 100 chars register
        const normalizedContent = noticeContent.trim()
        set({ lastReadNotice: normalizedContent })
      },

      markAnnouncementsRead: (keys: string[]) => {
        if (keys.length === 0) return
        set((state) => {
          const merged = [...new Set([...state.readAnnouncementKeys, ...keys])]
          return {
            readAnnouncementKeys:
              merged.length > MAX_TRACKED_READ_ANNOUNCEMENTS
                ? merged.slice(merged.length - MAX_TRACKED_READ_ANNOUNCEMENTS)
                : merged,
          }
        })
      },

      setClosedUntilDate: (date: string | null) => {
        set({ closedUntilDate: date })
      },

      isAnnouncementRead: (key: string) => {
        return get().readAnnouncementKeys.includes(key)
      },

      isNoticeClosed: () => {
        const { closedUntilDate } = get()
        if (!closedUntilDate) return false

        const today = new Date().toDateString()
        return closedUntilDate === today
      },

      // Sign-out clears the in-memory state too, so the next account does not
      // start with this account's read marks.
      reset: () => set(initialState),
    }),
    {
      name: 'notification-storage',
      storage: createJSONStorage(() => scopedStateStorage),
      partialize: (state) => ({
        lastReadNotice: state.lastReadNotice,
        readAnnouncementKeys: state.readAnnouncementKeys,
        closedUntilDate: state.closedUntilDate,
      }),
    }
  )
)
