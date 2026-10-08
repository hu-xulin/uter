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
along with this program. If not, see <https://gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
import { Component, type ErrorInfo, type ReactNode } from 'react'

import { GeneralError } from '@/features/errors/general-error'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches render-time exceptions thrown by the routed application tree and
 * shows the standard error screen instead of unmounting the whole SPA to a
 * blank white page. Errors that occur in event handlers (not during render)
 * do not propagate here by design — they should be handled where they happen.
 *
 * The fallback reuses `GeneralError`, which already speaks i18n and offers
 * "Go Back" / "Report an issue" / "Back to Home", so no new translation keys
 * are introduced.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Surface the failure in the console for local debugging; the fallback UI
    // stays actionable for end users.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Uncaught render error:', error, errorInfo)
  }

  render() {
    const { error } = this.state
    if (error) {
      return <GeneralError error={error} />
    }
    return this.props.children
  }
}
