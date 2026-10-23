package service

import (
	"html"

	"github.com/gin-gonic/gin"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/i18n"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/oauth"
	"github.com/uter-ai/uter/setting/system_setting"
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

// AccountMailLanguage is the language of mail about a user's account: the
// language the user saved, else the one the request stated.
func AccountMailLanguage(c *gin.Context, userId int) string {
	if lang := model.GetUserLanguage(userId); lang != "" {
		return lang
	}
	return i18n.StatedLang(c)
}

// NotifyAccountSecurityChange never includes credentials or tokens. The caller
// records delivery failure independently from the already-committed change.
// eventKey names the change; the notice is written in lang (see
// AccountMailLanguage).
func NotifyAccountSecurityChange(lang, email, eventKey string, eventArgs ...map[string]any) error {
	if email == "" {
		return nil
	}
	event := html.EscapeString(i18n.Translate(lang, eventKey, eventArgs...))
	subject := common.BrandEmailSubject(i18n.Translate(lang, i18n.MsgEmailSecurityNoticeSubject, map[string]any{"SystemName": common.SystemName}))
	content := common.BuildBrandEmailHTML(common.BrandEmail{
		Heading: i18n.Translate(lang, i18n.MsgEmailSecurityNoticeSubject, map[string]any{"SystemName": common.SystemName}),
		Paragraphs: []string{
			i18n.Translate(lang, i18n.MsgEmailSecurityNoticeChanged, map[string]any{"Event": event}),
			i18n.Translate(lang, i18n.MsgEmailSecurityNoticeAdvice),
		},
	})
	return common.SendEmail(subject, email, content)
}
