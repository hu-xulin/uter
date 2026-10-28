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
export const staticDataTableClassNames = {
  container: 'overflow-hidden rounded-md border',
  sectionContainer: 'border-border/60 rounded-lg',
  embeddedContainer: 'rounded-none border-0',
  compactTable: 'text-sm',
  compactHeaderRow: 'hover:bg-transparent',
  mutedHeaderRow:
    '[background-color:var(--table-header)] hover:[background-color:var(--table-header-hover)]',
  compactHeaderCell: 'text-muted-foreground py-2 text-xs font-medium uppercase',
  compactHeaderCellRight:
    'text-muted-foreground py-2 text-right text-xs font-medium uppercase',
  compactCell: 'py-2.5',
  compactTopCell: 'py-2.5 align-top',
  compactTopNumericCell: 'py-2.5 text-right align-top font-mono text-mono',
  compactMutedCell: 'text-muted-foreground py-2.5',
  compactMutedCodeCell: 'text-muted-foreground py-2.5 font-mono text-mono',
  compactNumericCell: 'py-2.5 text-right font-mono text-mono',
  compactMutedNumericCell:
    'text-muted-foreground py-2.5 text-right font-mono text-mono',
  topCell: 'py-2 align-top',
  topMutedCell: 'text-muted-foreground py-2 align-top',
  codeCell: 'font-mono text-mono',
  mutedCell: 'text-muted-foreground text-sm',
  mutedCodeCell: 'text-muted-foreground font-mono text-mono',
  topNumericCell: 'py-2 text-right font-mono text-mono',
  mediumCell: 'font-medium',
  actionHeaderCell: 'w-auto max-w-none text-right',
  actionCell: 'w-auto max-w-none text-right',
} as const
