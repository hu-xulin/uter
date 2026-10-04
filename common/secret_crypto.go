package common

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"strings"
)

const secretEnvelopePrefix = "v1:"

// SecretEnvelopePrefix 返回密文信封前缀，供调用方判断是否已加密。
func SecretEnvelopePrefix() string {
	return secretEnvelopePrefix
}

// deriveSecretKey 从 SESSION_SECRET 派生 32 字节 AES 密钥。
// SESSION_SECRET 在进程启动时已初始化（缺失则 JWT 同样不可用，故此处直接报错）。
func deriveSecretKey() ([]byte, error) {
	if SessionSecret == "" {
		return nil, errors.New("session secret not initialized")
	}
	sum := sha256.Sum256([]byte(SessionSecret))
	return sum[:], nil
}

// EncryptSecret 使用 AES-GCM 加密敏感字段（如 TOTP 密钥）用于落库存储。
func EncryptSecret(plain string) (string, error) {
	key, err := deriveSecretKey()
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, 12)
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	ct := gcm.Seal(nil, nonce, []byte(plain), nil)
	return secretEnvelopePrefix + base64.StdEncoding.EncodeToString(append(nonce, ct...)), nil
}

// DecryptSecret 解密 EncryptSecret 的产物；若输入不是信封格式（历史明文），
// 则原样返回，保证存量数据向后兼容。
func DecryptSecret(cipherStr string) (string, error) {
	if !strings.HasPrefix(cipherStr, secretEnvelopePrefix) {
		return cipherStr, nil
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(cipherStr, secretEnvelopePrefix))
	if err != nil || len(raw) <= 12 {
		return "", errors.New("invalid secret envelope")
	}
	key, err := deriveSecretKey()
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce, ct := raw[:12], raw[12:]
	plain, err := gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}
