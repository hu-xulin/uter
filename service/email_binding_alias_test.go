package service

import (
	"testing"

	"github.com/Uter-AI/Uter/common"
)

// TestValidateAccountEmailAliasRestriction 验证别名限制拦截 + - _ . 四种字符。
func TestValidateAccountEmailAliasRestriction(t *testing.T) {
	origAlias := common.EmailAliasRestrictionEnabled
	origDomain := common.EmailDomainRestrictionEnabled
	origWhitelist := common.EmailDomainWhitelist
	common.EmailAliasRestrictionEnabled = true
	common.EmailDomainRestrictionEnabled = false
	common.EmailDomainWhitelist = nil
	defer func() {
		common.EmailAliasRestrictionEnabled = origAlias
		common.EmailDomainRestrictionEnabled = origDomain
		common.EmailDomainWhitelist = origWhitelist
	}()

	allowed := []string{
		"alice@gmail.com",
		"bob123@outlook.com",
		"carol@corp.example.com",
	}
	for _, e := range allowed {
		if _, err := ValidateAccountEmail(e); err != nil {
			t.Errorf("expected %q allowed, got error: %v", e, err)
		}
	}

	// 四种别名字符：+ - _ . 都应被拦截
	blocked := []string{
		"a+b@gmail.com", // +
		"a-b@gmail.com", // -
		"a_b@gmail.com", // _
		"a.b@gmail.com", // .
	}
	for _, e := range blocked {
		if _, err := ValidateAccountEmail(e); err == nil {
			t.Errorf("expected %q blocked by alias restriction, got nil", e)
		}
	}
}
