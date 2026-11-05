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
/**
 * Shared authentication and session data contracts.
 * State ownership and actions remain in the auth store.
 */
export type AdminCapabilities = Record<string, Record<string, boolean>>

export type UserPermissions = {
  sidebar_settings?: boolean
  sidebar_modules?: Record<string, unknown>
  admin_permissions?: AdminCapabilities
}

export interface AuthUser {
  has_password?: boolean
  id: number
  username: string
  display_name?: string
  email?: string
  role: number
  status?: number
  group?: string
  organization_id?: number
  org_role?: string
  quota?: number
  used_quota?: number
  request_count?: number
  aff_code?: string
  aff_count?: number
  aff_quota?: number
  aff_history_quota?: number
  inviter_id?: number
  github_id?: string
  discord_id?: string
  oidc_id?: string
  telegram_id?: string
  linux_do_id?: string
  language?: string
  setting?: Record<string, unknown> | string
  stripe_customer?: string
  sidebar_modules?: string
  permissions?: UserPermissions
}

export interface LoginSession {
  sid: string
  current: boolean
  login_method: string
  ip: string
  user_agent: string
  created_at: number
  last_active_at: number
  expires_at: number
}

export interface AuthBundle {
  access_token: string
  token_type: 'Bearer' | string
  access_expires_at: number
  user: AuthUser
  session: LoginSession
}

export type AuthBootstrapState = 'idle' | 'checking' | 'complete'

export type LoginVerificationMethod = '2fa' | 'passkey'

export interface LoginChallengeMethod {
  method: LoginVerificationMethod
  available: boolean
  reason?: string
}

/** Minimal, login-specific challenge contract shared with the auth store. */
export interface LoginChallenge {
  require_verification: true
  flow_token: string
  expires_at: number
  methods: LoginChallengeMethod[]
}

export interface PendingLoginVerification {
  challenge: LoginChallenge
  redirectTo?: string
}
