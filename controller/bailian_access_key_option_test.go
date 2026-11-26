package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/service"
)

func withBailianCryptoSecret(t *testing.T) {
	t.Helper()
	original := common.CryptoSecret
	common.CryptoSecret = "controller-bailian-access-key-test-secret"
	t.Cleanup(func() { common.CryptoSecret = original })
}

func TestPrepareBailianAccessKeySecretForStorage(t *testing.T) {
	withBailianCryptoSecret(t)
	const plain = "UTERFAKESECRET0001"
	key := service.ChannelProviderBailianAccessKeySecretOption

	stored, err := prepareOptionValueForStorage(key, plain)
	require.NoError(t, err)
	assert.True(t, common.IsSecretEnvelope(stored))
	assert.NotContains(t, stored, plain)
	assert.Equal(t, plain, service.DecryptStoredChannelProviderSecret(stored))

	unchanged, err := prepareOptionValueForStorage(key, stored)
	require.NoError(t, err)
	assert.Equal(t, stored, unchanged, "resaving an envelope must not double-encrypt it")

	other, err := prepareOptionValueForStorage("channel_provider.bailian.username", plain)
	require.NoError(t, err)
	assert.Equal(t, plain, other)
}

func TestGetOptionsBailianAccessKeyMaskNeverLeaksCiphertext(t *testing.T) {
	withBailianCryptoSecret(t)
	const plain = "UTERFAKESECRET0001"
	key := service.ChannelProviderBailianAccessKeySecretOption
	encrypted, err := common.EncryptSecret(plain)
	require.NoError(t, err)
	withOptionMap(t, map[string]string{key: encrypted})

	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/option/", nil)
	GetOptions(context)

	require.Equal(t, http.StatusOK, response.Code)
	options := decodedOptions(t, response.Body.Bytes())
	maskView := options["ChannelProviderCredentialMasks"]
	assert.NotContains(t, maskView, plain)
	assert.NotContains(t, maskView, encrypted)
	assert.Contains(t, maskView, "access_key_secret")
}

func TestBailianAccessKeysAreRevealableSecretOptions(t *testing.T) {
	for _, key := range []string{
		service.ChannelProviderBailianAccessKeyIDOption,
		service.ChannelProviderBailianAccessKeySecretOption,
	} {
		assert.True(t, common.IsSecretOptionKey(key), key)
		assert.True(t, common.IsSystemSecretReadKey(key), key)
		assert.True(t, service.IsChannelProviderSecretOptionKey(key), key)
	}
}

func TestFetchBailianAKModelIDsFailsClosedWithoutCredentials(t *testing.T) {
	withOptionMap(t, map[string]string{
		service.ChannelProviderBailianAccessKeyIDOption:     "",
		service.ChannelProviderBailianAccessKeySecretOption: "",
	})
	_, err := fetchBailianAKModelIDs(nil)
	require.Error(t, err)
}
