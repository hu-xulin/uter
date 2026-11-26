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
 * Real brand logos for the AI-app catalog cards.
 *
 * Keyed by the locale-neutral `_nav.json` slug, so translated card titles
 * never have to carry an asset name. Assets are local copies of each
 * product's official logo, fetched from the official site listed in that
 * app's doc (favicon / logo.svg / logo.png), stored at 128px to stay sharp
 * at the card's 32px glyph without a runtime fetch.
 *
 * Every raster logo carries an alpha channel. Logos whose official asset is
 * a hard-edged square (factory-droid-cli, luna-translator) were exported with
 * baked rounded corners so the card never shows a right-angled icon.
 */
export const APP_LOGO_PATHS: Readonly<Record<string, string>> = {
  aionui: '/apps-assets/logos/aionui.webp',
  aqbot: '/apps-assets/logos/aqbot.webp',
  'cc-switch': '/apps-assets/logos/cc-switch.webp',
  'cherry-studio': '/apps-assets/logos/cherry-studio.webp',
  deepchat: '/apps-assets/logos/deepchat.webp',
  memoh: '/apps-assets/logos/memoh.webp',
  'fluent-read': '/apps-assets/logos/fluent-read.webp',
  openclaw: '/apps-assets/logos/openclaw.webp',
  langbot: '/apps-assets/logos/langbot.webp',
  astrbot: '/apps-assets/logos/astrbot.svg',
  'luna-translator': '/apps-assets/logos/luna-translator.webp',
  'claude-code': '/apps-assets/logos/claude-code.webp',
  'codex-cli': '/apps-assets/logos/codex-cli.webp',
  'factory-droid-cli': '/apps-assets/logos/factory-droid-cli.webp',
}

/** Resolve an app slug to its official brand logo, or `undefined` if unknown. */
export function appLogoPath(slug: string): string | undefined {
  return APP_LOGO_PATHS[slug]
}
