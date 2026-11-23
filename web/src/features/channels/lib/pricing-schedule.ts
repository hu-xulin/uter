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
export const PRICING_MODES = [
  { value: 'discount', label: 'Discount' },
  { value: 'markup', label: 'Markup' },
  { value: 'discount_plus', label: 'Discount plus' },
  { value: 'multiply', label: 'Fixed multiplier' },
  { value: 'add', label: 'Fixed amount' },
  { value: 'fixed', label: 'Fixed price' },
  { value: 'none', label: 'No change' },
] as const
