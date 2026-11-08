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
import type { LoginResult } from './secure-verification/types'

export type { AuthBundle } from '@/types/auth'
export type { SystemStatus, CustomOAuthProviderInfo } from '@/types/system'

// ============================================================================
// API Payloads
// ============================================================================

export interface LoginPayload {
  username: string
  password: string
  turnstile?: string
  passwordEncryptionEnabled?: boolean
}

export interface RegisterPayload {
  username: string
  password: string
  email?: string
  verification_code?: string
  aff_code?: string
  turnstile?: string
}

// ============================================================================
// API Responses
// ============================================================================

export interface LoginResponse {
  success: boolean
  message: string
  data?: LoginResult
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data?: T
}

// ============================================================================
// OAuth
// ============================================================================

// ============================================================================
// Form Props
// ============================================================================

export interface AuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}
