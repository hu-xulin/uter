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

// 明确登记为「需要掩码」的选项键。
//
// 为什么用显式登记表而不是按名称后缀推断：后缀推断会把公开值误判成密钥
// （典型如 TurnstileSiteKey——Cloudflare 设计上就是发给前端的公开值，
// 必须原样展示，掩码会让管理员无法核对），也会漏掉命名不规则的字段。
// 显式登记后「哪些字段是密钥」只有这一处真源，前端字段定义与之对齐。

// 认证 / OAuth。键名取自前端实际使用的 option key（见
// web/src/features/system-settings/auth/oauth-section.tsx 等处的 name=）。
var secretOptionKeys = map[string]struct{}{
	"GitHubClientSecret":        {},
	"LinuxDOClientSecret":       {},
	"discord.client_secret":     {},
	"oidc.client_secret":        {},
	"telegram.client_secret":    {},
	"WeChatServerToken":         {},
	"TelegramBotToken":          {},
	"TurnstileSecretKey":        {},
	"AccessToken":               {},
	"SystemAccessToken":         {},
	"CustomOAuthSecret":         {},
	"GoogleClientSecret":        {},
	"AppleClientSecret":         {},
	"FacebookClientSecret":      {},
	"SlackClientSecret":         {},
	"StripeSecretKey":           {},
	"CreemApiKey":               {},
	"WaffoApiKey":               {},
	"WaffoPancakeApiKey":        {},
	"IONetApiKey":               {},
	"EmailSecret":               {},
	"EmailPassword":             {},
	"CustomerServiceAdminToken": {},
	"SMTPToken":                 {},
}

// 降本优化（relay/costopt）里标记为 secret 的配置项。
// 与 web/src/features/system-settings/models/cost-optimization-fields.ts
// 中 `secret: true` 的字段一一对应。
var costOptSecretOptionKeys = map[string]struct{}{
	"costopt_setting.semantic_cache_embed_api_key": {},
	"costopt_setting.rag_api_key":                  {},
	"costopt_setting.batch_api_key":                {},
	"costopt_setting.cdn_signing_secret":           {},
	"costopt_setting.value_tier_vendor_api_key":    {},
}

// 模型描述多语化（controller/model_desc_translate.go）的密钥项。
// 翻译端点的 API Key 同样是凭据，读取时必须掩码。
var modelDescriptionSecretOptionKeys = map[string]struct{}{
	"ModelDescriptionTranslateApiKey": {},
}

// IsSecretOptionKey 判断某个 option key 是否需要按密钥掩码处理。
//
// 注意：只影响「读取时的展示形态」。写入时由 IsMaskedSecret 兜底判断
// 前端是否回传了掩码串，从而避免掩码覆盖真实密钥。
func IsSecretOptionKey(key string) bool {
	if _, ok := secretOptionKeys[key]; ok {
		return true
	}
	if _, ok := costOptSecretOptionKeys[key]; ok {
		return true
	}
	if _, ok := modelDescriptionSecretOptionKeys[key]; ok {
		return true
	}
	return false
}

// 不应下发的敏感键（大模型配置缓存等已通过专用管理员接口下发的整体 JSON）。
// 这些键不是单个可掩码字段，而是含密钥的聚合体，掩码没有意义，直接剔除。
var excludedOptionKeys = map[string]struct{}{
	"CustomerServiceLLMConfig": {},
}

// IsExcludedOptionKey 判断某个 option key 是否应整条从选项列表中剔除。
func IsExcludedOptionKey(key string) bool {
	_, ok := excludedOptionKeys[key]
	return ok
}
