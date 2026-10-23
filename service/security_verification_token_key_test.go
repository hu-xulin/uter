package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// token.key.read binds no parameters, so one proof covers the single and batch
// reads a page performs. Sending a context must still be rejected: a proof whose
// hash silently ignored extra fields could be reused across actions.
func TestTokenKeyReadScopeBindsNoContext(t *testing.T) {
	binding, err := BindVerificationOperation(VerificationOperation{Scope: VerificationScopeTokenKeyRead})
	require.NoError(t, err)
	assert.Equal(t, VerificationScopeTokenKeyRead, binding.Scope)
	assert.NotEmpty(t, binding.ContextHash)

	_, err = BindVerificationOperation(VerificationOperation{
		Scope:   VerificationScopeTokenKeyRead,
		Context: []byte(`{"token_id":7}`),
	})
	assert.ErrorIs(t, err, ErrVerificationContextInvalid)
}

// A PAT must not be able to obtain this proof: it already is an API credential,
// so widening it into a key dump is the exact escalation the scope prevents.
func TestTokenKeyReadScopeDeniesAccessTokens(t *testing.T) {
	scope, listed := AccessTokenVerificationScope(VerificationScopeTokenKeyRead)
	assert.True(t, listed)
	assert.Empty(t, scope)
}
