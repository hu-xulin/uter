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
export type ModelPricingIssue = {
  model_name: string
  plugin_key: string
  plugin_name: string
  reason: 'unconfigured' | 'incompatible' | 'stale'
}

export const PRICING_ISSUE_REASONS: Record<
  ModelPricingIssue['reason'],
  string
> = {
  unconfigured: 'No price set',
  incompatible: 'The price uses usage the plugin no longer provides',
  stale: 'The plugin no longer offers this model',
}
