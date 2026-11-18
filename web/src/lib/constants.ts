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
 * Application-wide constants
 */

// System Configuration Defaults
export const DEFAULT_SYSTEM_NAME = 'Uter'

/**
 * Asset version for the bundled logo. Bump it whenever
 * `web/public/logo.png` is replaced.
 *
 * The logo is served from a stable URL, so a browser that already cached the
 * previous file keeps rendering it until that entry expires or the URL
 * changes. The `?v=` suffix makes the new file a different cache entry, which
 * is the only way to evict an already-stored copy — changing the response
 * headers cannot reach back into a browser's cache.
 *
 * Keep this in sync with the `link rel="icon"` href in `web/index.html`,
 * which is a static template and cannot import this constant.
 */
export const LOGO_ASSET_VERSION = '16'
export const DEFAULT_LOGO = `/logo.png?v=${LOGO_ASSET_VERSION}`

/**
 * Favicon (.ico) asset version. Bump whenever
 * `web/public/favicon-legacy.ico` is replaced.
 *
 * The browser tab icon uses the brand .ico, served from a stable URL with a
 * `?v=` cache-buster (mirrors DEFAULT_LOGO). It is intentionally decoupled from
 * the in-page logo: the tab icon is a fixed brand asset, while the page logo
 * is the dynamic `logo` (defaults to `/logo.png`). A custom admin-uploaded logo
 * must never leak into the tab icon.
 *
 * The file is deliberately NOT named `favicon.ico`: Rsbuild's dev server answers
 * `/favicon.ico` with 204 and otherwise auto-injects an unversioned link, both of
 * which defeat a controllable, cache-bustable tab icon. Keep this in sync with the
 * `link rel="icon"` href in `web/index.html`, which is a static template and
 * cannot import this constant.
 */
export const FAVICON_ICO_VERSION = '10'
export const FAVICON_URL = `/favicon-legacy.ico?v=${FAVICON_ICO_VERSION}`

// LocalStorage Keys
