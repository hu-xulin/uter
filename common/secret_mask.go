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

import (
	"strings"
	"unicode/utf8"
)

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
//
// 「位」按 Unicode 码点（rune）计，不按字节。密钥可能被误粘贴上多字节前缀
// （如中文「密钥sk-...」），按字节切片会在字符中间截断、产出无效 UTF-8，
// 在界面上显示为 U+FFFD 替换符（「密?****」）。按 rune 截取保证前后各 4 个
// 字符完整、掩码输出始终是合法 UTF-8。
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
	// 用 rune 长度而非字节长度：多字节字符按字节切片会破坏 UTF-8 序列。
	runes := []rune(value)
	length := len(runes)
	if length <= secretMaskKeepHead {
		return strings.Repeat(string(secretMaskChar), length)
	}
	if length <= secretMaskKeepHead+secretMaskKeepTail {
		return string(runes[:secretMaskKeepHead]) +
			strings.Repeat(string(secretMaskChar), length-secretMaskKeepHead)
	}
	middle := length - secretMaskKeepHead - secretMaskKeepTail
	if middle > secretMaskMaxMiddle {
		middle = secretMaskMaxMiddle
	}
	masked := string(runes[:secretMaskKeepHead]) +
		strings.Repeat(string(secretMaskChar), middle) +
		string(runes[length-secretMaskKeepTail:])
	// 按 rune 切片后输出必然合法；保留断言以防未来改动退化回字节切片。
	if !utf8.ValidString(masked) {
		return strings.Repeat(string(secretMaskChar), length)
	}
	return masked
}

// MaskMultilineSecret 按行掩码多行密钥。
//
// 渠道 API Key 支持一次保存多行凭据；整串掩码会把换行吞进星号里，管理员
// 只能核对最后一行，无法确认每一行是否填对。逐行复用同一掩码规则后，
// 展示形态与单行 API Key 完全一致，同时保留行结构。
func MaskMultilineSecret(value string) string {
	if !strings.Contains(value, "\n") {
		return MaskSecretValue(value)
	}
	lines := strings.Split(value, "\n")
	for index, line := range lines {
		lines[index] = MaskSecretValue(strings.TrimSuffix(line, "\r"))
	}
	return strings.Join(lines, "\n")
}

// IsMaskedSecret 判断 value 是否形如本包生成的掩码串。
//
// 用途：写入时识别「前端把掩码串回传」的情况——此时应视为「未修改」，
// 保留库里原密钥，而不是用掩码覆盖真实密钥。
//
// 只识别本包实际会生成的三种形态（全星号 / 前4+尾随星号 / 前4+中缀星号+后4）。
// 早前的「含任意星号即掩码」会把 p*ssw0rd 这类合法密码判为未修改，导致用户
// 保存后仍是旧密码。星号出现在保留前缀或后缀中时一律按真实密钥处理。
func IsMaskedSecret(value string) bool {
	runes := []rune(value)
	length := len(runes)
	if length == 0 {
		return false
	}
	allStars := true
	for _, r := range runes {
		if r != secretMaskChar {
			allStars = false
			break
		}
	}
	if allStars {
		return true
	}
	if length <= secretMaskKeepHead {
		return false
	}
	for _, r := range runes[:secretMaskKeepHead] {
		if r == secretMaskChar {
			return false
		}
	}
	if length <= secretMaskKeepHead+secretMaskKeepTail {
		stars := 0
		for _, r := range runes[secretMaskKeepHead:] {
			if r != secretMaskChar {
				return false
			}
			stars++
		}
		return stars > 0
	}
	for _, r := range runes[length-secretMaskKeepTail:] {
		if r == secretMaskChar {
			return false
		}
	}
	middle := runes[secretMaskKeepHead : length-secretMaskKeepTail]
	if len(middle) < 1 || len(middle) > secretMaskMaxMiddle {
		return false
	}
	for _, r := range middle {
		if r != secretMaskChar {
			return false
		}
	}
	return true
}
