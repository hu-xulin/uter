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
*/

package service

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"math/big"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newWaffoTestKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	return key
}

func encodePEM(t *testing.T, blockType string, der []byte) string {
	t.Helper()
	return string(pem.EncodeToMemory(&pem.Block{Type: blockType, Bytes: der}))
}

// The SDK parses bare Base64 PKCS#8. A PKCS#8 PEM file must be accepted and
// converted, not rejected.
func TestNormalizeWaffoPrivateKeyAcceptsPKCS8PEM(t *testing.T) {
	key := newWaffoTestKey(t)
	der, err := x509.MarshalPKCS8PrivateKey(key)
	require.NoError(t, err)

	normalized, err := NormalizeWaffoPrivateKey(encodePEM(t, "PRIVATE KEY", der))
	require.NoError(t, err)

	decoded, err := base64.StdEncoding.DecodeString(normalized)
	require.NoError(t, err)
	parsed, err := x509.ParsePKCS8PrivateKey(decoded)
	require.NoError(t, err)
	assert.IsType(t, &rsa.PrivateKey{}, parsed)
}

// A PKCS#1 PEM file must be re-encoded to PKCS#8, because the SDK only parses
// PKCS#8.
func TestNormalizeWaffoPrivateKeyConvertsPKCS1PEM(t *testing.T) {
	key := newWaffoTestKey(t)
	der := x509.MarshalPKCS1PrivateKey(key)

	normalized, err := NormalizeWaffoPrivateKey(encodePEM(t, "RSA PRIVATE KEY", der))
	require.NoError(t, err)

	decoded, err := base64.StdEncoding.DecodeString(normalized)
	require.NoError(t, err)
	_, err = x509.ParsePKCS8PrivateKey(decoded)
	require.NoError(t, err, "PKCS#1 input must be re-encoded as PKCS#8")
}

// An existing Base64-only configuration must keep working unchanged.
func TestNormalizeWaffoPrivateKeyPassesThroughBase64(t *testing.T) {
	key := newWaffoTestKey(t)
	der, err := x509.MarshalPKCS8PrivateKey(key)
	require.NoError(t, err)
	encoded := base64.StdEncoding.EncodeToString(der)

	normalized, err := NormalizeWaffoPrivateKey(encoded)
	require.NoError(t, err)
	assert.Equal(t, encoded, normalized)
}

// PEM files often carry CRLF line endings; the Base64 body must be compacted.
func TestNormalizeWaffoPrivateKeyStripsWhitespace(t *testing.T) {
	key := newWaffoTestKey(t)
	der, err := x509.MarshalPKCS8PrivateKey(key)
	require.NoError(t, err)
	withCRLF := strings.ReplaceAll(encodePEM(t, "PRIVATE KEY", der), "\n", "\r\n")

	normalized, err := NormalizeWaffoPrivateKey(withCRLF)
	require.NoError(t, err)
	assert.NotContains(t, normalized, "\n")
	assert.NotContains(t, normalized, " ")
}

func TestNormalizeWaffoPrivateKeyRejectsInvalidInput(t *testing.T) {
	for name, input := range map[string]string{
		"empty":            "",
		"not base64":       "-----BEGIN PRIVATE KEY-----\nnot-base64!!\n-----END PRIVATE KEY-----",
		"missing pem body": "-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----",
		"unsupported type": "-----BEGIN EC PRIVATE KEY-----\nAAAA\n-----END EC PRIVATE KEY-----",
	} {
		t.Run(name, func(t *testing.T) {
			_, err := NormalizeWaffoPrivateKey(input)
			require.Error(t, err)
			assert.ErrorIs(t, err, ErrWaffoPrivateKeyInvalid)
		})
	}
}

// The Waffo public key may arrive as SPKI, as PKCS#1, or as the certificate
// Waffo issues; all three must end up as the X.509 form the SDK parses.
func TestNormalizeWaffoPublicKeyAcceptsEveryCommonShape(t *testing.T) {
	key := newWaffoTestKey(t)
	spki, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	require.NoError(t, err)
	pkcs1 := x509.MarshalPKCS1PublicKey(&key.PublicKey)

	t.Run("spki pem", func(t *testing.T) {
		normalized, err := NormalizeWaffoPublicKey(encodePEM(t, "PUBLIC KEY", spki))
		require.NoError(t, err)
		decoded, err := base64.StdEncoding.DecodeString(normalized)
		require.NoError(t, err)
		parsed, err := x509.ParsePKIXPublicKey(decoded)
		require.NoError(t, err)
		assert.IsType(t, &rsa.PublicKey{}, parsed)
	})

	t.Run("pkcs1 pem", func(t *testing.T) {
		normalized, err := NormalizeWaffoPublicKey(encodePEM(t, "RSA PUBLIC KEY", pkcs1))
		require.NoError(t, err)
		decoded, err := base64.StdEncoding.DecodeString(normalized)
		require.NoError(t, err)
		parsed, err := x509.ParsePKIXPublicKey(decoded)
		require.NoError(t, err)
		assert.IsType(t, &rsa.PublicKey{}, parsed)
	})

	t.Run("certificate pem", func(t *testing.T) {
		template := &x509.Certificate{
			SerialNumber: big.NewInt(1),
			NotBefore:    time.Now().Add(-time.Hour),
			NotAfter:     time.Now().Add(time.Hour),
		}
		certDER, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
		require.NoError(t, err)
		normalized, err := NormalizeWaffoPublicKey(encodePEM(t, "CERTIFICATE", certDER))
		require.NoError(t, err)
		decoded, err := base64.StdEncoding.DecodeString(normalized)
		require.NoError(t, err)
		parsed, err := x509.ParsePKIXPublicKey(decoded)
		require.NoError(t, err)
		assert.IsType(t, &rsa.PublicKey{}, parsed)
	})

	t.Run("bare base64", func(t *testing.T) {
		encoded := base64.StdEncoding.EncodeToString(spki)
		normalized, err := NormalizeWaffoPublicKey(encoded)
		require.NoError(t, err)
		assert.Equal(t, encoded, normalized)
	})
}

func TestNormalizeWaffoPublicKeyRejectsInvalidInput(t *testing.T) {
	for name, input := range map[string]string{
		"empty":            "",
		"not base64":       "-----BEGIN PUBLIC KEY-----\nnot-base64!!\n-----END PUBLIC KEY-----",
		"unsupported type": "-----BEGIN DH PARAMETERS-----\nAAAA\n-----END DH PARAMETERS-----",
	} {
		t.Run(name, func(t *testing.T) {
			_, err := NormalizeWaffoPublicKey(input)
			require.Error(t, err)
			assert.ErrorIs(t, err, ErrWaffoPublicKeyInvalid)
		})
	}
}
