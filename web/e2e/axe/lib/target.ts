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
 * axe 可访问性扫描（Playwright 轨）的公共常量。
 *
 * 直接复用 e2e/visual/lib/target.ts 的 BASE_URL / WEB_ROOT：
 * 两个轨扫的是同一个 Uter 目标（默认 Go 后端 :3000，dev 模式用
 * VISUAL_BASE_URL 覆盖），口径必须一致，避免两套地址漂移。
 */
export { BASE_URL, WEB_ROOT } from '../../visual/lib/target'
