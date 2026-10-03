package service

import (
	"fmt"
	"html"

	"github.com/Uter-AI/Uter/common"

	"github.com/Uter-AI/Uter/model"
	"github.com/Uter-AI/Uter/oauth"
	"github.com/Uter-AI/Uter/setting/system_setting"
)

func UnbindAccountOAuth(identity AuthIdentity, providerID int) error {
	enabled := model.AccountLoginMethods{
		Password: common.PasswordLoginEnabled,
		Passkey:  system_setting.PasskeySettingsSnapshot().Enabled,
		WeChat:   common.WeChatAuthEnabled,
	}
	for _, provider := range oauth.GetAllProviders() {
		if !provider.IsEnabled() {
			continue
		}
		if custom, ok := provider.(*oauth.GenericOAuthProvider); ok {
			enabled.CustomProviderIDs = append(enabled.CustomProviderIDs, custom.GetProviderId())
		} else {
			enabled.OAuthColumns = append(enabled.OAuthColumns, provider.ProviderUserIDColumn())
		}
	}
	return model.UnbindUserOAuthForSession(identity, providerID, enabled)
}

// NotifyAccountSecurityChange never includes credentials or tokens. The caller
// records delivery failure independently from the already-committed change.
func NotifyAccountSecurityChange(email, event string) error {
	if email == "" {
		return nil
	}
	subject := common.BrandEmailSubject("安全提醒")
	content := common.BuildBrandEmailHTML(common.BrandEmail{
		Heading: "安全提醒",
		Paragraphs: []string{
			fmt.Sprintf("您的 Uter.ai 帐号发生了安全相关变更：%s。", html.EscapeString(event)),
			"如果这不是您本人的操作，请立即前往帐号安全设置，撤销其他登录会话并联系管理员。",
		},
	})
	return common.SendEmail(subject, email, content)
}
