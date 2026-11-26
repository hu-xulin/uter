package common

import (
	"testing"
)

// TestSecretOptionKeySuffixFallbackExhaustive 是审查报告
// 「建议补充的回归测试 #5」的守卫实现：遍历全部已知 option 键，凡名以
// secret/password/private/api_key/token 结尾、且不在 publicOptionKeys 的，
// 必须被判为密钥。
//
// 为什么用手工清单而不在运行时遍历 model.OptionMap：common 不能import model
// （会被 import cycle 卡住），而 model 又依赖 common。两边若漂移，下面的
// TestSecretOptionKeysStayInSyncWithOptionMap 会在 model 包侧失败。
func TestSecretOptionKeySuffixFallbackExhaustive(t *testing.T) {
	// 这些是 model/option.go 里真实存在、且键名带密钥语义的键。漏掉任何一个
	// 都会让 GET /api/option/ 明文下发该凭据。
	mustBeMasked := []string{
		// 支付 / 签名（影响最大：StripeWebhookSecret 泄漏可伪造回调入账）
		"EpayKey",
		"AlipayPrivateKey",
		// 对端公钥 / 证书：与私钥同等待遇，读取时掩码。
		// 键名不以密钥后缀结尾（如 WaffoPublicCert 以 "cert" 结尾），
		// 只能靠显式登记，漏掉就会明文下发。
		"AlipayPublicKey",
		"WaffoPublicCert",
		"WaffoSandboxPublicCert",
		"StripeApiSecret",
		"StripeWebhookSecret",
		"StripeSecretKey",
		"CreemApiKey",
		"CreemWebhookSecret",
		"WaffoApiKey",
		"WaffoPrivateKey",
		"WaffoPancakeApiKey",
		"WaffoPancakePrivateKey",
		"WaffoSandboxApiKey",
		"WaffoSandboxPrivateKey",
		"WechatPayApiV3Key",
		"WechatPayPrivateKey",
		"WechatPayPublicKey",
		"WorkerValidKey",

		// 认证 / OAuth
		"GitHubClientSecret",
		"LinuxDOClientSecret",
		"GoogleClientSecret",
		"AppleClientSecret",
		"FacebookClientSecret",
		"SlackClientSecret",
		"discord.client_secret",
		"oidc.client_secret",
		"telegram.client_secret",
		"CustomOAuthSecret",

		// 其他凭据
		"AccessToken",
		"SystemAccessToken",
		"CustomerServiceAdminToken",
		"TelegramBotToken",
		"SMTPToken",
		"EmailSecret",
		"EmailPassword",
		"TurnstileSecretKey",
		"IonetApiKey",
		"ModelDescriptionTranslateApiKey",

		// 降本配置
		"costopt_setting.semantic_cache_embed_api_key",
		"costopt_setting.rag_api_key",
		"costopt_setting.batch_api_key",
		"costopt_setting.batch_embed_api_key",
		"costopt_setting.cdn_signing_secret",
		"costopt_setting.value_tier_vendor_api_key",
	}
	for _, key := range mustBeMasked {
		if !IsSecretOptionKey(key) {
			t.Errorf("IsSecretOptionKey(%q) = false，该凭据会在 GET /api/option/ 明文下发", key)
		}
	}

	// 公开值：设计上就要原样下发给浏览器，掩码会让管理员无法核对。
	mustStayPublic := []string{
		"TurnstileSiteKey",
		"StripePublishableKey",
	}
	for _, key := range mustStayPublic {
		if IsSecretOptionKey(key) {
			t.Errorf("IsSecretOptionKey(%q) = true，公开值被误掩码", key)
		}
	}

	// 完全无关的配置项不得被后缀规则误伤。
	mustNotMatch := []string{
		"QuotaPerUnit",
		"GroupRatio",
		"ModelRatio",
		"DisplayInCurrencyEnabled",
		"GitHubOAuthEnabled",
		"GitHubClientId",
	}
	for _, key := range mustNotMatch {
		if IsSecretOptionKey(key) {
			t.Errorf("IsSecretOptionKey(%q) = true，与密钥无关的项被误判", key)
		}
	}
}

// TestDeploymentRegistrySecretKey 守卫部署镜像仓库凭据的键约定：
// 必须以 secret 后缀被掩码、必须从 option 列表剔除、只能解析出合法部署 ID。
func TestDeploymentRegistrySecretKey(t *testing.T) {
	validID := "dep-abc123"
	key := DeploymentRegistrySecretOptionKey(validID)

	if !IsSecretOptionKey(key) {
		t.Errorf("IsSecretOptionKey(%q) = false，部署凭据会在 GET /api/option/ 明文下发", key)
	}
	if !IsExcludedOptionKey(key) {
		t.Errorf("IsExcludedOptionKey(%q) = false，部署凭据会出现在系统设置选项列表", key)
	}
	if !IsSystemSecretReadKey(key) {
		t.Errorf("IsSystemSecretReadKey(%q) = false，部署凭据无法验证后揭示", key)
	}

	gotID, ok := ParseDeploymentRegistrySecretKey(key)
	if !ok || gotID != validID {
		t.Errorf("ParseDeploymentRegistrySecretKey(%q) = (%q, %v), want (%q, true)", key, gotID, ok, validID)
	}

	// 非法 ID：空、含路径分隔符、含点，都不能伪装成凭据键。
	for _, bad := range []string{
		DeploymentRegistrySecretOptionKey(""),
		DeploymentRegistrySecretOptionKey("a/b"),
		DeploymentRegistrySecretOptionKey("a.b"),
		"deployment.dep.other_secret",
	} {
		if _, ok := ParseDeploymentRegistrySecretKey(bad); ok {
			t.Errorf("ParseDeploymentRegistrySecretKey(%q) = true, want false", bad)
		}
		if IsSystemSecretReadKey(bad) {
			t.Errorf("IsSystemSecretReadKey(%q) = true, 非法键不应可揭示", bad)
		}
	}

	if DeploymentRegistrySecretOptionKey(validID) != "deployment."+validID+".registry_secret" {
		t.Errorf("DeploymentRegistrySecretOptionKey 格式不符合约定")
	}
}
