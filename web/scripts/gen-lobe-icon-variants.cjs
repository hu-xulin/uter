const fs = require('fs')
const toc = require('/Users/lincolnhu/uter/web/node_modules/@lobehub/icons/es/toc.json')

const entries = toc
  .filter((e) => e.param.hasColor || e.param.hasAvatar)
  .map(
    (e) =>
      '\t"' +
      e.id +
      '": {' +
      (e.param.hasColor ? 'true' : 'false') +
      ', ' +
      (e.param.hasAvatar ? 'true' : 'false') +
      '},'
  )

const header = `/*
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
// Code generated from @lobehub/icons/es/toc.json. DO NOT EDIT.
//
// 品牌彩色变体清单：键为 @lobehub/icons 的品牌 id（与前端 lobe-icon.tsx 的
// ICON_METADATA 同源），值为 {hasColor, hasAvatar}。NormalizeColorIconKey
// 据此把裸品牌名升级到彩色变体（优先 .Color，回落 .Avatar）。
//
// 重新生成：cd web && node scripts/gen-lobe-icon-variants.cjs（随
// @lobehub/icons 升级一并执行，前端 toc.json 与本表必须同版本）。
// 仅收录至少具备一种彩色变体（Color/Avatar）的品牌；两者皆无的品牌在
// 归一化时原样返回，无需登记。

package model

// lobeIconVariant 描述一个品牌的可用彩色变体。
type lobeIconVariant struct {
	hasColor  bool
	hasAvatar bool
}

// lobeIconVariants 是 @lobehub/icons 全部品牌的变体标记表。
var lobeIconVariants = map[string]lobeIconVariant{
`

const content = header + entries.join('\n') + '\n}\n'
fs.writeFileSync('/Users/lincolnhu/uter/model/lobe_icon_variants.go', content)
console.log('已生成，收录品牌数:', entries.length)
