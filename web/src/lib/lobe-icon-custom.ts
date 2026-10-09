/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY, without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
import type { ComponentType } from 'react'

import { IconSub2api } from '@/assets/custom/icon-sub2api'

// Brand icons that ship as local components instead of via @lobehub/icons.
// Kept in its own module so both the sync metadata API (lobe-icon.tsx) and the
// async resolver (lobe-icon-resolver.tsx) can read it without creating a
// component/non-component import cycle that trips react-refresh's
// only-export-components rule.
export const CUSTOM_ICONS: Record<string, ComponentType<{ size?: number }>> = {
  Sub2API: IconSub2api,
}
