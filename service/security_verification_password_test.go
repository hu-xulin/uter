package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

func verificationMethodNames(methods []VerificationMethodOption) []string {
	names := make([]string, 0, len(methods))
	for _, method := range methods {
		names = append(names, method.Method)
	}
	return names
}

// 登录密码是 step-up 的常规因子：读密钥类 scope 必须在方法列表里给出
// password，否则未开通 2FA / Passkey 的账号无法完成揭示。
func TestStepUpPolicyIncludesPasswordMethod(t *testing.T) {
	previous := common.PasswordLoginEnabled
	common.PasswordLoginEnabled = true
	t.Cleanup(func() { common.PasswordLoginEnabled = previous })

	state := model.UserVerificationState{
		HasPassword: true,
		Status:      common.UserStatusEnabled,
		Role:        common.RoleRootUser,
	}
	scopes := []string{
		VerificationScopeChannelKeyRead,
		VerificationScopeChannelCredentialRead,
		VerificationScopeSystemSecretRead,
		VerificationScopeUserSecretRead,
		VerificationScopeTokenKeyRead,
		VerificationScopePasskeyDelete,
	}
	// 登录 scope 不在此列：登录密码不能充当登录后的额外验证因子。
	for _, scope := range scopes {
		methods, err := securityVerificationPolicy(scope, state)
		require.NoError(t, err, scope)
		assert.Contains(t, verificationMethodNames(methods), VerificationMethodPassword, scope)
		for _, method := range methods {
			assert.True(t, method.Available, "%s / %s", scope, method.Method)
		}
	}
}

// 密码与 2FA / Passkey 并列，而不是取代它们。
func TestStepUpPolicyKeepsOtherFactorsAlongsidePassword(t *testing.T) {
	previous := common.PasswordLoginEnabled
	common.PasswordLoginEnabled = true
	t.Cleanup(func() { common.PasswordLoginEnabled = previous })

	state := model.UserVerificationState{
		HasPassword: true,
		HasTwoFA:    true,
		HasPasskey:  true,
		Status:      common.UserStatusEnabled,
		Role:        common.RoleRootUser,
	}
	methods, err := securityVerificationPolicy(VerificationScopeSystemSecretRead, state)
	require.NoError(t, err)
	assert.Equal(t, []string{
		VerificationMethodTwoFA,
		VerificationMethodPasskey,
		VerificationMethodPassword,
	}, verificationMethodNames(methods))
}

// 账号没有密码、或部署禁用密码登录时，step-up 不提供密码选项。
func TestStepUpPolicyOmitsPasswordWhenUnusable(t *testing.T) {
	previous := common.PasswordLoginEnabled
	t.Cleanup(func() { common.PasswordLoginEnabled = previous })

	common.PasswordLoginEnabled = true
	methods, err := securityVerificationPolicy(VerificationScopeSystemSecretRead, model.UserVerificationState{
		Status: common.UserStatusEnabled,
		Role:   common.RoleRootUser,
	})
	require.NoError(t, err)
	assert.NotContains(t, verificationMethodNames(methods), VerificationMethodPassword)

	common.PasswordLoginEnabled = false
	methods, err = securityVerificationPolicy(VerificationScopeSystemSecretRead, model.UserVerificationState{
		HasPassword: true,
		Status:      common.UserStatusEnabled,
		Role:        common.RoleRootUser,
	})
	require.NoError(t, err)
	assert.NotContains(t, verificationMethodNames(methods), VerificationMethodPassword)
}

// 登录 scope 必须保持原策略：密码不能作为登录后的额外验证因子。
func TestLoginPolicyNeverOffersPasswordAsSecondFactor(t *testing.T) {
	previous := common.PasswordLoginEnabled
	common.PasswordLoginEnabled = true
	t.Cleanup(func() { common.PasswordLoginEnabled = previous })

	state := model.UserVerificationState{
		HasPassword: true,
		HasTwoFA:    true,
		HasPasskey:  true,
		Status:      common.UserStatusEnabled,
		Role:        common.RoleRootUser,
	}
	methods, err := securityVerificationPolicy(VerificationScopeLogin, state)
	require.NoError(t, err)
	assert.Equal(t, []string{
		VerificationMethodTwoFA,
		VerificationMethodPasskey,
	}, verificationMethodNames(methods))
}

// 账户管理类 scope 维持原策略，邮箱验证码兜底不被密码越位。
func TestAccountPolicyUnchangedByStepUpPassword(t *testing.T) {
	previous := common.PasswordLoginEnabled
	common.PasswordLoginEnabled = true
	t.Cleanup(func() { common.PasswordLoginEnabled = previous })

	state := model.UserVerificationState{
		HasPassword: true,
		HasTwoFA:    true,
		Status:      common.UserStatusEnabled,
		Role:        common.RoleRootUser,
	}
	methods, err := securityVerificationPolicy(VerificationScopeAccountBind, state)
	require.NoError(t, err)
	assert.Equal(t, []string{VerificationMethodTwoFA}, verificationMethodNames(methods))
}
