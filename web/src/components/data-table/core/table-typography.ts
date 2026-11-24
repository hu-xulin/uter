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
 * 管理端表格的「可读档」字号覆盖（UDS 8.0.0 body 档 14px）。
 *
 * 背景：<Table> 组件默认走密集数据档 —— 单元格 text-dense(13px)、表头
 * text-xs(12px)。这套刻度适合渠道/模型这类列多、信息密度优先的表；但日志、
 * 密钥这类以「逐行阅读」为主的表，13/12px 在实际分辨率上偏小。
 *
 * 规范 §Typography：常规正文基准是 text-sm(14px)。本常量把表格本体、表头、
 * 单元格以及单元格内的后代统一提升到 body 档，使跨页面的数据阅读表观感一致。
 * 后代选择器（`_td_*` / `_th_*`）是必需的：<Table> 根元素给单元格后代设了
 * `[&_:is(th,td)_*]:[font-size:inherit]`，不覆盖后代就会让徽标/链接仍是 13px。
 *
 * 只用于「以阅读为主」的表；以密度为主的宽表（渠道、模型）保持默认 13/12px，
 * 不要套用本常量。
 */
export const READABLE_TABLE_CLASS =
  '[&_[data-slot=table]]:text-sm [&_[data-slot=table]_td]:text-sm [&_[data-slot=table]_td_*]:text-sm [&_[data-slot=table]_th]:text-sm [&_[data-slot=table]_th_*]:text-sm'
