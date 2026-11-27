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
	"strconv"
	"strings"
)

// 明确登记为「需要掩码」的选项键。
//
// 为什么用显式登记表而不是按名称后缀推断：后缀推断会把公开值误判成密钥
// （典型如 TurnstileSiteKey——Cloudflare 设计上就是发给前端的公开值，
// 必须原样展示，掩码会让管理员无法核对），也会漏掉命名不规则的字段。
// 显式登记后「哪些字段是密钥」只有这一处真源，前端字段定义与之对齐。

// 认证 / OAuth。键名取自前端实际使用的 option key（见
// web/src/features/system-settings/auth/oauth-section.tsx 等处的 name=）。
var secretOptionKeys = map[string]struct{}{
	"GitHubClientSecret":                        {},
	"LinuxDOClientSecret":                       {},
	"discord.client_secret":                     {},
	"oidc.client_secret":                        {},
	"telegram.client_secret":                    {},
	"TelegramBotToken":                          {},
	"TurnstileSecretKey":                        {},
	"AccessToken":                               {},
	"SystemAccessToken":                         {},
	"CustomOAuthSecret":                         {},
	"GoogleClientSecret":                        {},
	"AppleClientSecret":                         {},
	"FacebookClientSecret":                      {},
	"SlackClientSecret":                         {},
	"StripeSecretKey":                           {},
	"CreemApiKey":                               {},
	"WaffoApiKey":                               {},
	"WaffoPancakeApiKey":                        {},
	"IONetApiKey":                               {},
	"EmailSecret":                               {},
	"EmailPassword":                             {},
	"CustomerServiceAdminToken":                 {},
	"SMTPToken":                                 {},
	"payment_setting.epay_merchant_private_key": {},

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

	// 系统管理 → 渠道 → 优特精选/优特百炼/优特订阅的登录凭据。
	// 后缀兜底已经能掩码 password / api_key，这里显式登记使真源唯一，
	// 并保证以后修改后缀规则不会把这些上游凭据意外明文下发。
	"channel_provider.featured.password":         {},
	"channel_provider.featured.api_key":          {},
	"channel_provider.bailian.password":          {},
	"channel_provider.bailian.api_key":           {},
	"channel_provider.bailian.access_key_id":     {},
	"channel_provider.bailian.access_key_secret": {},
	"channel_provider.subscription.password":     {},
	"channel_provider.subscription.api_key":      {},

	// 上游监测的扣费对账探针令牌：经 Uter 链路产生真实小额扣费，
	// 明文绝不下发浏览器，读取时掩码、验证后才可揭示。
	"monitor_setting.billing_probe_token": {},
}

// 明确登记为「必须原样下发给浏览器」的公开值。这些键名以 key/token 结尾，
// 会被下面的兜底后缀规则命中，但按设计就是要展示给前端核对或使用的，
// 掩码会让管理员无法确认填对了没有。
var publicOptionKeys = map[string]struct{}{
	// Cloudflare 设计上就发给前端的 challenge 公钥。
	"TurnstileSiteKey": {},
	// Stripe 的可发布公钥（secret 侧的 StripeSecretKey 已另行登记）。
	"StripePublishableKey": {},
	// 易支付平台公钥用于校验回调，属于公开材料，管理员需要核对原文。
	"payment_setting.epay_platform_public_key": {},
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
	// SMTP 多账号配置整体 JSON 内含各邮箱的 SMTP 认证密码，掩码没有
	// 意义且会破坏 JSON 结构。读取时整条剔除，只暴露派生的
	// SMTPAccountsView（含掩码凭据与当日用量），由 GetOptions 附加。
	"SMTPAccounts": {},
	// Resend 的 API Key 由前端以「是否已配置」布尔位 + 仅新值输入框使用
	// （见 web/src/features/system-settings/integrations/email-settings-section.tsx），
	// 回传掩码串反而会被当成待保存值展示，因此读取时整条剔除，
	// 只暴露 GetOptions 附带的 ResendKeyConfigured。
	"ResendApiKey": {},
}

// IsExcludedOptionKey 判断某个 option key 是否应整条从选项列表中剔除。
func IsExcludedOptionKey(key string) bool {
	if _, ok := excludedOptionKeys[key]; ok {
		return true
	}
	// 部署的镜像仓库凭据只在部署详情接口按 ID 展示，不属于系统设置选项，
	// 不能出现在 GET /api/option/ 列表中（否则会连部署 ID 一起暴露）。
	// 整个 deployment. 前缀一律剔除，包括不合法的伪装键。
	if strings.HasPrefix(key, deploymentRegistrySecretKeyPrefix) {
		return true
	}
	return false
}

// IsRevealableSecretOptionKey 判断某个 option key 是否允许通过验证后揭示接口
// 返回明文。聚合体（如 CustomerServiceLLMConfig、SMTPAccounts）没有单一
// 可核对的字段，整条剔除后也不能绕过剔除规则重新取回。
func IsRevealableSecretOptionKey(key string) bool {
	return IsSecretOptionKey(key) && !IsExcludedOptionKey(key)
}

const smtpAccountTokenKeyPrefix = "SMTPAccounts."
const smtpAccountTokenKeySuffix = ".token"
const customerServiceConfigKeyPrefix = "CustomerServiceLLMConfig."
const deploymentRegistrySecretKeyPrefix = "deployment."
const deploymentRegistrySecretKeySuffix = ".registry_secret"

// DeploymentRegistrySecretOptionKey 返回某个部署的镜像仓库凭据在 options 表中的键。
// 部署详情由上游 ionet 托管，上游查询不回传该凭据；Uter 在创建/更新时
// 按部署 ID 单独保存明文，才能展示掩码并在验证后揭示。
func DeploymentRegistrySecretOptionKey(deploymentID string) string {
	return deploymentRegistrySecretKeyPrefix + deploymentID + deploymentRegistrySecretKeySuffix
}

// IsValidDeploymentID 校验部署 ID 能否安全用作凭据 option key 的一段。
// 部署 ID 来自上游，禁止包含路径分隔符与点，避免构造出伪装成其它凭据键的键。
func IsValidDeploymentID(id string) bool {
	return id != "" && !strings.ContainsAny(id, "/\\.")
}

// ParseDeploymentRegistrySecretKey 解析部署镜像仓库凭据键，返回部署 ID。
// 只接受非空、不含路径分隔符的部署 ID，避免把任意 option key 伪装成凭据键揭示。
func ParseDeploymentRegistrySecretKey(key string) (string, bool) {
	if !strings.HasPrefix(key, deploymentRegistrySecretKeyPrefix) || !strings.HasSuffix(key, deploymentRegistrySecretKeySuffix) {
		return "", false
	}
	id := strings.TrimSuffix(strings.TrimPrefix(key, deploymentRegistrySecretKeyPrefix), deploymentRegistrySecretKeySuffix)
	if !IsValidDeploymentID(id) {
		return "", false
	}
	return id, true
}

// ParseSMTPAccountTokenKey 解析聚合配置中的单个 SMTP 账号密码键。
// SMTPAccounts 本体整条剔除，但单个账号密码仍需要「验证后揭示」，否则
// 管理员只能看到掩码却无法核对已保存的凭据。
func ParseSMTPAccountTokenKey(key string) (int, bool) {
	if !strings.HasPrefix(key, smtpAccountTokenKeyPrefix) || !strings.HasSuffix(key, smtpAccountTokenKeySuffix) {
		return 0, false
	}
	middle := strings.TrimSuffix(strings.TrimPrefix(key, smtpAccountTokenKeyPrefix), smtpAccountTokenKeySuffix)
	index, err := strconv.Atoi(middle)
	if err != nil || index < 0 {
		return 0, false
	}
	return index, true
}

// ParseCustomerServiceConfigSecretKey 解析智能客服大模型配置中的单个敏感字段。
// 只有明确属于凭据语义的字段名才允许揭示，避免把普通配置项一并暴露。
func ParseCustomerServiceConfigSecretKey(key string) (string, bool) {
	if !strings.HasPrefix(key, customerServiceConfigKeyPrefix) {
		return "", false
	}
	field := strings.TrimPrefix(key, customerServiceConfigKeyPrefix)
	if field == "" || strings.ContainsAny(field, "/\\") {
		return "", false
	}
	lower := strings.ToLower(field)
	for _, suffix := range []string{"api_key", "secret", "token", "password"} {
		if strings.HasSuffix(lower, suffix) {
			return field, true
		}
	}
	return "", false
}

// IsSystemSecretReadKey 判断验证揭示接口的目标是否合法：单个 option 密钥、
// SMTPAccounts 聚合体中的一个账号密码项、智能客服配置中的一个敏感字段，
// 或某个部署的镜像仓库凭据。
func IsSystemSecretReadKey(key string) bool {
	// deployment. 前缀的键必须严格匹配单个部署的凭据键。通用后缀规则会把
	// deployment.x.y_secret 之类伪装键也判为密钥，揭示接口必须只放行合法键。
	if strings.HasPrefix(key, deploymentRegistrySecretKeyPrefix) {
		_, ok := ParseDeploymentRegistrySecretKey(key)
		return ok
	}
	if IsRevealableSecretOptionKey(key) {
		return true
	}
	if _, ok := ParseSMTPAccountTokenKey(key); ok {
		return true
	}
	if _, ok := ParseDeploymentRegistrySecretKey(key); ok {
		return true
	}
	_, ok := ParseCustomerServiceConfigSecretKey(key)
	return ok
}
