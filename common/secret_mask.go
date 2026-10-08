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

package common

import "strings"

// 敏感选项键的判定与掩码。
//
// 背景：管理后台需要「保存后仍能核对密钥填对了没有」，但绝不能把明文密钥
// 下发给浏览器。因此：
//   - 读取（GET /api/option/）时，敏感键**保留在列表里**（原先是整条continue
//     剔除，导致前端拿不到任何密钥、只能显示空），但值替换为掩码串；
//   - 写入（PUT /api/option/）时，掩码串不被当作新值落库，保留库中原密钥，
//     从而实现「不改就不动、不会把掩码写回去」。
//
// 掩码规则（与前端 web/src/lib/secret.ts 的 maskSecret 保持一致）：
//   - 空串 → 空串；
//   - 长度 <= 4 → 全部星号（短密钥不暴露任何字符）；
//   - 4 < 长度 <= 8 → 前 4 位 + 其余星号（长度不足以同时给前后各 4 位，优先前缀）；
//   - 长度 > 8 → 前 4 位 + 中间星号（最多 12 个）+ 后 4 位。
const (
	secretMaskChar = '*'
	// secretMaskKeepHead/Tail 为掩码时保留的前后字符数。
	secretMaskKeepHead = 4
	secretMaskKeepTail = 4
	// secretMaskMaxMiddle 限制中间星号最多几个，避免超长密钥把响应体撑大。
	secretMaskMaxMiddle = 12
)

// MaskSecretValue 按上述规则掩码密钥明文。仅用于「展示」，绝不返回原文。
func MaskSecretValue(value string) string {
	if value == "" {
		return ""
	}
	length := len(value)
	if length <= secretMaskKeepHead {
		return strings.Repeat(string(secretMaskChar), length)
	}
	if length <= secretMaskKeepHead+secretMaskKeepTail {
		return value[:secretMaskKeepHead] +
			strings.Repeat(string(secretMaskChar), length-secretMaskKeepHead)
	}
	middle := length - secretMaskKeepHead - secretMaskKeepTail
	if middle > secretMaskMaxMiddle {
		middle = secretMaskMaxMiddle
	}
	return value[:secretMaskKeepHead] +
		strings.Repeat(string(secretMaskChar), middle) +
		value[length-secretMaskKeepTail:]
}

// IsMaskedSecret 判断 value 是否形如本包生成的掩码串（含 '*'）。
//
// 用途：写入时识别「前端把掩码串回传」的情况——此时应视为「未修改」，
// 保留库里原密钥，而不是用掩码覆盖真实密钥。
func IsMaskedSecret(value string) bool {
	return strings.Contains(value, string(secretMaskChar))
}
