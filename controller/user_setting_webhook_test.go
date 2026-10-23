package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/relaykit/dto"
)

// ---------------------------------------------------------------------------
// DEF-7：webhook HMAC 密钥不得被静默清空
//
// 复现缺陷时的现场：已存 webhook_secret=secret-keep-me，再次保存通知设置
// （表单以隐藏态展示密钥、不回传该字段）后密钥变空串，接收端 HMAC 校验
// 全部失效且没有任何提示。旧实现先在「只保留所选通知方式」的清空块里把
// secret 抹掉，再从请求整体回填，请求没带就永远是空。
// ---------------------------------------------------------------------------

func TestUpdateUserSettingKeepsStoredWebhookSecretWhenAbsent(t *testing.T) {
	db := setupManageUserTestDB(t)
	setting, err := common.Marshal(dto.UserSetting{
		NotifyType:            dto.NotifyTypeWebhook,
		WebhookUrl:            "https://example.com/hook",
		WebhookSecret:         "secret-keep-me",
		QuotaWarningThreshold: 500000,
	})
	require.NoError(t, err)
	user := model.User{Username: "webhook-owner", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, AffCode: "webhook-owner-aff", Setting: string(setting)}
	require.NoError(t, db.Create(&user).Error)

	// 保存设置但不回传 webhook_secret（隐藏/掩码字段的典型行为）。
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPut, "/api/user/setting",
		strings.NewReader(`{"notify_type":"webhook","quota_warning_threshold":2000,"webhook_url":"https://example.com/hook","accept_unset_model_ratio_model":true,"record_ip_log":true}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("id", user.Id)
	UpdateUserSetting(c)

	assert.Contains(t, recorder.Body.String(), `"success":true`)
	require.NoError(t, db.First(&user, user.Id).Error)
	assert.Equal(t, "secret-keep-me", user.GetSetting().WebhookSecret,
		"请求未回传密钥时必须保留原值，否则每次保存都会静默清空 HMAC 签名密钥")
	assert.Equal(t, "https://example.com/hook", user.GetSetting().WebhookUrl)
}

func TestUpdateUserSettingExplicitEmptyWebhookSecretClears(t *testing.T) {
	db := setupManageUserTestDB(t)
	setting, err := common.Marshal(dto.UserSetting{
		NotifyType:            dto.NotifyTypeWebhook,
		WebhookUrl:            "https://example.com/hook",
		WebhookSecret:         "secret-remove-me",
		QuotaWarningThreshold: 500000,
	})
	require.NoError(t, err)
	user := model.User{Username: "webhook-clearer", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, AffCode: "webhook-clearer-aff", Setting: string(setting)}
	require.NoError(t, db.Create(&user).Error)

	// 显式提交空串 = 用户主动移除密钥，必须真的清掉。
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPut, "/api/user/setting",
		strings.NewReader(`{"notify_type":"webhook","quota_warning_threshold":2000,"webhook_url":"https://example.com/hook","webhook_secret":"","accept_unset_model_ratio_model":true,"record_ip_log":true}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("id", user.Id)
	UpdateUserSetting(c)

	assert.Contains(t, recorder.Body.String(), `"success":true`)
	require.NoError(t, db.First(&user, user.Id).Error)
	assert.Equal(t, "", user.GetSetting().WebhookSecret, "显式提交空串必须清空密钥")
}

// ---------------------------------------------------------------------------
// DEF-8：webhook URL 必须限定 http(s)
//
// 复现缺陷时的现场：webhook_url=file:///etc/passwd 保存成功。Bark / Gotify
// 都有 http:// / https:// 前缀校验，唯独 webhook 没有——url.ParseRequestURI
// 接受任意 scheme。保存阶段就应拒绝，不能只依赖发送时的 SSRF 拦截。
// ---------------------------------------------------------------------------

func TestUpdateUserSettingRejectsNonHttpWebhookUrl(t *testing.T) {
	db := setupManageUserTestDB(t)
	setting, err := common.Marshal(dto.UserSetting{
		NotifyType:            dto.NotifyTypeWebhook,
		WebhookUrl:            "https://example.com/hook",
		WebhookSecret:         "secret-keep-me",
		QuotaWarningThreshold: 500000,
	})
	require.NoError(t, err)
	user := model.User{Username: "webhook-scheme", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, AffCode: "webhook-scheme-aff", Setting: string(setting)}
	require.NoError(t, db.Create(&user).Error)

	// scheme 非 http(s) 的三个值必须命中协议前缀校验；无 scheme 的值连
	// url.ParseRequestURI 都过不去，同样必须在保存阶段被拒。
	for _, tc := range []struct {
		url         string
		wantMessage string
	}{
		{"file:///etc/passwd", "URL must start with http:// or https://"},
		{"ftp://example.com/hook", "URL must start with http:// or https://"},
		{"gopher://example.com/hook", "URL must start with http:// or https://"},
		{"example.com/hook", "Invalid Webhook URL"},
	} {
		t.Run(tc.url, func(t *testing.T) {
			body := fmt.Sprintf(`{"notify_type":"webhook","quota_warning_threshold":2000,"webhook_url":%q,"accept_unset_model_ratio_model":true,"record_ip_log":true}`, tc.url)
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPut, "/api/user/setting", strings.NewReader(body))
			c.Request.Header.Set("Content-Type", "application/json")
			c.Set("id", user.Id)
			UpdateUserSetting(c)

			assert.Contains(t, recorder.Body.String(), `"success":false`)
			assert.Contains(t, recorder.Body.String(), tc.wantMessage)

			// 被拒绝的保存不得改动已存设置（尤其是密钥）。
			require.NoError(t, db.First(&user, user.Id).Error)
			assert.Equal(t, "https://example.com/hook", user.GetSetting().WebhookUrl)
			assert.Equal(t, "secret-keep-me", user.GetSetting().WebhookSecret)
		})
	}
}

func TestUpdateUserSettingAcceptsHttpWebhookUrls(t *testing.T) {
	db := setupManageUserTestDB(t)
	user := model.User{Username: "webhook-ok", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, AffCode: "webhook-ok-aff"}
	require.NoError(t, db.Create(&user).Error)

	for _, url := range []string{"http://example.com/hook", "https://example.com/hook", "HTTPS://example.com/hook"} {
		t.Run(url, func(t *testing.T) {
			body := fmt.Sprintf(`{"notify_type":"webhook","quota_warning_threshold":2000,"webhook_url":%q,"webhook_secret":"s3cret","accept_unset_model_ratio_model":true,"record_ip_log":true}`, url)
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPut, "/api/user/setting", strings.NewReader(body))
			c.Request.Header.Set("Content-Type", "application/json")
			c.Set("id", user.Id)
			UpdateUserSetting(c)

			assert.Contains(t, recorder.Body.String(), `"success":true`, recorder.Body.String())
			require.NoError(t, db.First(&user, user.Id).Error)
			assert.Equal(t, url, user.GetSetting().WebhookUrl)
			assert.Equal(t, "s3cret", user.GetSetting().WebhookSecret)
		})
	}
}
