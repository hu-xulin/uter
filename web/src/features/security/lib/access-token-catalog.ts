/*
Copyright (C) 2023-2026 QuantumNous

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

For commercial licensing, please contact support@quantumnous.com
*/
import type { PermissionMatrixGroup } from '@/components/permission-matrix'

import type { AccessTokenCatalog, AccessTokenGroup } from '../api'

// Group names are i18n **keys**, not display strings: `PermissionMatrix`
// renders them through `t()`. They must therefore exist verbatim in every
// `i18n/locales/*.json`; a missing entry falls back to the English key and
// makes the Access tokens card look untranslated. Guarded by
// `__tests__/access-token-i18n.test.ts`.
const GROUP_LABELS: Record<AccessTokenGroup, string> = {
  personal: 'Personal',
  admin: 'Administration',
  system: 'System',
}

// accessTokenPermissionGroups lists the catalog groups that offer at least one
// resource, labelled for the permission picker.
export function accessTokenPermissionGroups(
  catalog: AccessTokenCatalog
): PermissionMatrixGroup[] {
  return catalog.groups
    .filter((group) => group.resources.length > 0)
    .map((group) => ({
      key: group.group,
      labelKey: GROUP_LABELS[group.group],
      resources: group.resources,
    }))
}
