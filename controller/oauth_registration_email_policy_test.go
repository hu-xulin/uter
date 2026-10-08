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
package controller

import (
	"context"
	"errors"
	"testing"

	"github.com/uter-ai/uter/common"

	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/oauth"
	"github.com/uter-ai/uter/service"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// stubOAuthProvider 是 oauth.Provider 的最小实现：只覆盖 OAuth 注册路径会走到的成员，
// 其余方法返回零值或 ErrRecordNotFound，保证 findOrCreateOAuthUser 总能落到「新建用户」分支。
type stubOAuthProvider struct{}

func (stubOAuthProvider) GetName() string { return "Stub" }
func (stubOAuthProvider) IsEnabled() bool { return true }
func (stubOAuthProvider) ExchangeToken(context.Context, string, *gin.Context) (*oauth.OAuthToken, error) {
	return nil, errors.New("stub provider cannot exchange tokens")
}
func (stubOAuthProvider) GetUserInfo(context.Context, *oauth.OAuthToken) (*oauth.OAuthUser, error) {
	return nil, errors.New("stub provider has no user info")
}
func (stubOAuthProvider) IsUserIDTaken(string) bool { return false }
func (stubOAuthProvider) FillUserByProviderID(*model.User, string) error {
	return gorm.ErrRecordNotFound
}
func (stubOAuthProvider) SetProviderUserID(*model.User, string) {}
func (stubOAuthProvider) GetProviderPrefix() string             { return "stub_" }
func (stubOAuthProvider) ProviderUserIDColumn() string          { return "github_id" }

// TestOAuthRegistrationHonoursAccountEmailPolicy 锁定一条安全不变量：
// 开启邮箱域名白名单/别名限制后，第三方 OAuth 注册必须与邮箱注册、邮箱绑定走同一套策略。
// 否则任何人都能用白名单之外的域名（或 + 别名）经 OAuth 建号，站点访问控制被整体绕过。
func TestOAuthRegistrationHonoursAccountEmailPolicy(t *testing.T) {
	previousDB := model.DB
	previousRedis := common.RedisEnabled
	previousRegister := common.RegisterEnabled
	previousDomainEnabled := common.EmailDomainRestrictionEnabled
	previousAliasEnabled := common.EmailAliasRestrictionEnabled
	previousWhitelist := common.EmailDomainWhitelist
	previousQuotaForNewUser := common.QuotaForNewUser

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.UserOAuthBinding{}))
	model.DB = db
	common.RedisEnabled = false
	common.RegisterEnabled = true
	common.QuotaForNewUser = 0
	t.Cleanup(func() {
		model.DB = previousDB
		common.RedisEnabled = previousRedis
		common.RegisterEnabled = previousRegister
		common.EmailDomainRestrictionEnabled = previousDomainEnabled
		common.EmailAliasRestrictionEnabled = previousAliasEnabled
		common.EmailDomainWhitelist = previousWhitelist
		common.QuotaForNewUser = previousQuotaForNewUser
	})

	register := func(t *testing.T, email string) error {
		t.Helper()
		_, err := findOrCreateOAuthUser(&gin.Context{}, stubOAuthProvider{}, &oauth.OAuthUser{
			ProviderUserID: "stub-" + email,
			Username:       "stub-user",
			Email:          email,
		}, "")
		return err
	}

	t.Run("whitelist_enabled_rejects_foreign_domain", func(t *testing.T) {
		common.EmailDomainRestrictionEnabled = true
		common.EmailAliasRestrictionEnabled = false
		common.EmailDomainWhitelist = []string{"allowed.example"}

		err := register(t, "intruder@blocked.example")
		require.Error(t, err)
		assert.True(t, errors.Is(err, service.ErrAccountEmailDomainRestricted),
			"OAuth registration must reject a domain outside the whitelist, got %v", err)
	})

	t.Run("alias_restriction_applies_to_oauth", func(t *testing.T) {
		common.EmailDomainRestrictionEnabled = true
		common.EmailAliasRestrictionEnabled = true
		common.EmailDomainWhitelist = []string{"allowed.example"}

		err := register(t, "user+alias@allowed.example")
		require.Error(t, err)
		assert.True(t, errors.Is(err, service.ErrAccountEmailAliasRestricted),
			"OAuth registration must reject an aliased address when alias restriction is on, got %v", err)
	})

	t.Run("whitelisted_domain_is_accepted", func(t *testing.T) {
		common.EmailDomainRestrictionEnabled = true
		common.EmailAliasRestrictionEnabled = false
		common.EmailDomainWhitelist = []string{"allowed.example"}

		err := register(t, "member@allowed.example")
		require.NoError(t, err, "a whitelisted domain must still be able to register through OAuth")
	})

	t.Run("restriction_off_allows_any_domain", func(t *testing.T) {
		common.EmailDomainRestrictionEnabled = false
		common.EmailAliasRestrictionEnabled = false
		common.EmailDomainWhitelist = nil

		require.NoError(t, register(t, "anyone@anywhere.example"))
	})
}
