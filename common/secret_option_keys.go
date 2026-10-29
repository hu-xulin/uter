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

	// 微信支付（站点与品牌 → 集成 → 微信支付）的敏感字段。键名取自
	// web/src/features/system-settings/integrations/wechat-pay-settings-section.tsx
	// 的 save key（WechatPayApiV3Key / WechatPayPrivateKey / WechatPayPublicKey）。
	// 此前未登记，GET /api/option/ 会明文下发这三值，与 uter 密钥掩码规则不符。
	"WechatPayApiV3Key":   {},
	"WechatPayPrivateKey": {},
	"WechatPayPublicKey":  {},

	// 支付 / 签名凭据。与微信支付同类：这些键都在 OptionMap 里，但此前
	// 没有登记，GET /api/option/ 会明文下发。影响最大的是
	// StripeWebhookSecret —— 泄漏后可直接伪造 checkout.session.completed
	// 配合伪造 client_reference_id 给任意 pending 订单入账。
	"EpayKey":                {},
	"AlipayPrivateKey":       {},
	"StripeApiSecret":        {},
	"StripeWebhookSecret":    {},
	"CreemWebhookSecret":     {},
	"WaffoPrivateKey":        {},
	"WaffoPancakePrivateKey": {},
	"WaffoSandboxApiKey":     {},
	"WaffoSandboxPrivateKey": {},
	"WorkerValidKey":         {},

	// 对端公钥 / 证书：与私钥同一套处理（读取时掩码、掩码串不落库、
	// 前端统一走 Secret 组件），与上面微信支付的 WechatPayPublicKey 同类。
	// 它们本身不是机密，但明文回显对排错没有帮助（核对时直接去商户平台
	// 看），反而多了一份容易与私钥混淆、被误粘贴或误覆盖的长 PEM 文本。
	"AlipayPublicKey":        {},
	"WaffoPublicCert":        {},
	"WaffoSandboxPublicCert": {},

	// 上游渠道凭据。创梦（DreamRouter）账号密码用于每日价格同步登录其
	// /api/pricing；密码键已随后缀兜底掩码，这里显式登记保持真源唯一。
	"DreamRouterSyncPassword": {},
}

// 明确登记为「必须原样下发给浏览器」的公开值。这些键名以 key/token 结尾，
// 会被下面的兜底后缀规则命中，但按设计就是要展示给前端核对或使用的，
// 掩码会让管理员无法确认填对了没有。
var publicOptionKeys = map[string]struct{}{
	// Cloudflare 设计上就发给前端的 challenge 公钥。
	"TurnstileSiteKey": {},
	// Stripe 的可发布公钥（secret 侧的 StripeSecretKey 已另行登记）。
	"StripePublishableKey": {},
}

// secretOptionKeySuffixes 是兜底规则：显式登记表之外的键名若命中任一后缀，
// 一律按密钥掩码。
//
// 为什么还需要这层兜底：纯白名单的固有失效模式是「新增 OptionMap 键时
// 再次遗漏」——微信支付三个键和上面这批支付密钥都是同一个原因漏掉的。
// 后缀规则把「漏登记」的代价从明文下发凭据降为「一个公开值被多掩码一次」，
// 而后者有 publicOptionKeys 显式豁免兜底。
//
// 注意单词边界：只匹配结尾，不匹配包含。避免 "Monkey"/"Turnstile" 这类
// 误伤，也避免 "key_prefix" 这类中途出现的键被误判。
var secretOptionKeySuffixes = []string{
	"secret",
	"password",
	"privatekey",
	"apikey",
	"token",
	"key",
}

// 降本优化（relay/costopt）里标记为 secret 的配置项。
// 与 web/src/features/system-settings/models/cost-optimization-fields.ts
// 中 `secret: true` 的字段一一对应。
var costOptSecretOptionKeys = map[string]struct{}{
	"costopt_setting.semantic_cache_embed_api_key": {},
	"costopt_setting.rag_api_key":                  {},
	"costopt_setting.batch_api_key":                {},
	"costopt_setting.batch_embed_api_key":          {},
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
	// 显式登记为公开值的优先豁免，兜底规则不得反过来把它掩码掉。
	if _, ok := publicOptionKeys[key]; ok {
		return false
	}
	lower := strings.ToLower(key)
	for _, suffix := range secretOptionKeySuffixes {
		if strings.HasSuffix(lower, suffix) {
			return true
		}
	}
	return false
}

// 不应下发的敏感键（大模型配置缓存等已通过专用管理员接口下发的整体 JSON）。
// 这些键不是单个可掩码字段，而是含密钥的聚合体，掩码没有意义，直接剔除。
var excludedOptionKeys = map[string]struct{}{
	"CustomerServiceLLMConfig": {},
	// Resend 的 API Key 由前端以「是否已配置」布尔位 + 仅新值输入框使用
	// （见 web/src/features/system-settings/integrations/email-settings-section.tsx），
	// 回传掩码串反而会被当成待保存值展示，因此读取时整条剔除，
	// 只暴露 GetOptions 附带的 ResendKeyConfigured。
	"ResendApiKey": {},
}

// IsExcludedOptionKey 判断某个 option key 是否应整条从选项列表中剔除。
func IsExcludedOptionKey(key string) bool {
	_, ok := excludedOptionKeys[key]
	return ok
}
