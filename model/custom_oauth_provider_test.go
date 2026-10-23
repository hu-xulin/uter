package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func validCustomOAuthProviderForEndpointValidation() *CustomOAuthProvider {
	return &CustomOAuthProvider{
		Name:                  "Example OIDC",
		Slug:                  "example-oidc",
		ClientId:              "example-client",
		ClientSecret:          "example-secret",
		AuthorizationEndpoint: "https://idp.example.test/oauth/authorize?tenant=public",
		TokenEndpoint:         "https://idp.example.test/oauth/token",
		UserInfoEndpoint:      "https://idp.example.test/oauth/userinfo",
	}
}

func TestValidateCustomOAuthProviderRejectsUnsafeEndpointURLs(t *testing.T) {
	tests := []struct {
		name  string
		set   func(*CustomOAuthProvider, string)
		field string
		value string
	}{
		{
			name:  "authorization endpoint rejects javascript scheme",
			set:   func(p *CustomOAuthProvider, value string) { p.AuthorizationEndpoint = value },
			field: "authorization_endpoint",
			value: "javascript:alert(1)",
		},
		{
			name:  "token endpoint rejects relative URL",
			set:   func(p *CustomOAuthProvider, value string) { p.TokenEndpoint = value },
			field: "token_endpoint",
			value: "//idp.example.test/token",
		},
		{
			name:  "token endpoint rejects userinfo",
			set:   func(p *CustomOAuthProvider, value string) { p.TokenEndpoint = value },
			field: "token_endpoint",
			value: "https://user@idp.example.test/token",
		},
		{
			name:  "userinfo endpoint rejects fragment",
			set:   func(p *CustomOAuthProvider, value string) { p.UserInfoEndpoint = value },
			field: "user_info_endpoint",
			value: "https://idp.example.test/userinfo#fragment",
		},
		{
			name:  "userinfo endpoint rejects non-http scheme",
			set:   func(p *CustomOAuthProvider, value string) { p.UserInfoEndpoint = value },
			field: "user_info_endpoint",
			value: "ftp://idp.example.test/userinfo",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			provider := validCustomOAuthProviderForEndpointValidation()
			tc.set(provider, tc.value)
			err := validateCustomOAuthProvider(provider)
			require.Error(t, err)
			require.Contains(t, err.Error(), tc.field)
		})
	}
}

func TestValidateCustomOAuthProviderAcceptsAbsoluteHTTPSEndpoints(t *testing.T) {
	provider := validCustomOAuthProviderForEndpointValidation()
	require.NoError(t, validateCustomOAuthProvider(provider))
}
