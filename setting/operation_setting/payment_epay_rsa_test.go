package operation_setting

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateEpaySignOptionRequiresRSAKeys(t *testing.T) {
	setting := GetPaymentSetting()
	previousSignType := setting.EpaySignType
	previousPrivateKey := setting.EpayMerchantPrivateKey
	previousPublicKey := setting.EpayPlatformPublicKey
	t.Cleanup(func() {
		setting.EpaySignType = previousSignType
		setting.EpayMerchantPrivateKey = previousPrivateKey
		setting.EpayPlatformPublicKey = previousPublicKey
	})

	setting.EpaySignType = EpaySignTypeMD5
	setting.EpayMerchantPrivateKey = ""
	setting.EpayPlatformPublicKey = ""
	require.NoError(t, ValidateEpaySignOption(EpaySignTypeOptionKey, EpaySignTypeMD5))
	require.Error(t, ValidateEpaySignOption(EpaySignTypeOptionKey, "SHA1"))

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	privateDER, err := x509.MarshalPKCS8PrivateKey(key)
	require.NoError(t, err)
	privateKey := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: privateDER})
	publicDER, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	require.NoError(t, err)
	publicKey := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: publicDER})

	require.NoError(t, ValidateEpaySignOption(EpayMerchantPrivateKeyOptionKey, string(privateKey)))
	require.NoError(t, ValidateEpaySignOption(EpayPlatformPublicKeyOptionKey, string(publicKey)))
	require.Error(t, ValidateEpaySignOption(EpaySignTypeOptionKey, EpaySignTypeRSA))

	setting.EpaySignType = EpaySignTypeRSA
	setting.EpayMerchantPrivateKey = string(privateKey)
	setting.EpayPlatformPublicKey = string(publicKey)
	require.NoError(t, ValidateEpaySignOption(EpaySignTypeOptionKey, EpaySignTypeRSA))
}
