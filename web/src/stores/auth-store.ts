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

import type {
  AuthBootstrapState,
  AuthBundle,
  AuthUser,
  LoginSession,
  PendingLoginVerification,
} from '@/types/auth'
import type { AdminCapabilities } from '@/lib/admin-permissions'

// Compatibility exports: shared contracts are owned by @/types/auth.
export type {
  AuthBootstrapState,
  AuthBundle,
  AuthUser,
  LoginSession,
  PendingLoginVerification,
  UserPermissions,
} from '@/types/auth'

interface AuthState {
  auth: {
    user: AuthUser | null
    accessToken: string | null
    accessExpiresAt: number | null
    session: LoginSession | null
    pendingLoginVerification: PendingLoginVerification | null
    bootstrapState: AuthBootstrapState
    setBundle: (bundle: AuthBundle) => void
    setUser: (user: AuthUser | null) => void
    setPendingLoginVerification: (
      pending: PendingLoginVerification | null
    ) => void
    setBootstrapState: (bootstrapState: AuthBootstrapState) => void
    reset: (bootstrapState?: AuthBootstrapState) => void
  }
}

export const useAuthStore = create<AuthState>()((set) => ({
  auth: {
    user: null,
    accessToken: null,
    accessExpiresAt: null,
    session: null,
    pendingLoginVerification: null,
    bootstrapState: 'idle',
    setBundle: (bundle) =>
      set((state) => ({
        ...state,
        auth: {
          ...state.auth,
          user: bundle.user,
          accessToken: bundle.access_token,
          accessExpiresAt: bundle.access_expires_at,
          session: bundle.session,
          pendingLoginVerification: null,
          bootstrapState: 'complete',
        },
      })),
    setUser: (user) =>
      set((state) => ({
        ...state,
        auth: {
          ...state.auth,
          user,
          pendingLoginVerification:
            state.auth.user?.id === user?.id
              ? state.auth.pendingLoginVerification
              : null,
        },
      })),
    setPendingLoginVerification: (pendingLoginVerification) =>
      set((state) => ({
        ...state,
        auth: { ...state.auth, pendingLoginVerification },
      })),
    setBootstrapState: (bootstrapState) =>
      set((state) => ({
        ...state,
        auth: { ...state.auth, bootstrapState },
      })),
    reset: (bootstrapState = 'complete') =>
      set((state) => ({
        ...state,
        auth: {
          ...state.auth,
          user: null,
          accessToken: null,
          accessExpiresAt: null,
          session: null,
          pendingLoginVerification: null,
          bootstrapState,
        },
      })),
  },
}))
