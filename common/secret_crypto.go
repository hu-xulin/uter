package common

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
)

// 密文信封格式：v2:<密钥来源>:<密钥指纹>:<base64(nonce|ciphertext)>
//
// 相比只有前缀的 v1，v2 在信封里记录了「这份密文是用哪个来源、哪一枚密钥
// 加密的」。没有这两段信息时，密钥一旦轮换，旧密文只会在验证时神秘失败，
// 无法区分「码输错了」和「密钥换了」；有了它们就能明确报出轮换，并支持
// 在轮换窗口期内批量重加密。
//
// 仓库中不存在 v1 密文——这套工具在此前没有任何调用方——因此直接升级格式，
// 不需要为 v1 保留兼容分支。
const (
	secretEnvelopePrefix = "v2:"

	// secretKeySourceSession 表示从 SESSION_SECRET 派生密钥。
	secretKeySourceSession = "session"
	// secretKeySourceCrypto 表示从 CRYPTO_SECRET 派生密钥。新数据一律使用它，
	// 这样数据加密与会话签名才是两个独立来源。
	secretKeySourceCrypto = "crypto"
)

// ErrSecretKeyRotated 表示密文所用的密钥与当前配置的密钥不是同一枚。
//
// 这不是验证失败：重试验证码、重新登录都不会有用，必须按密钥轮换流程处理。
var ErrSecretKeyRotated = errors.New("secret key has been rotated, the ciphertext cannot be decrypted with the current key")

// SecretEnvelopePrefix 返回密文信封前缀，供调用方判断是否已加密。
func SecretEnvelopePrefix() string {
	return secretEnvelopePrefix
}

// IsSecretEnvelope 报告一个值是否为密文信封。
//
// 调用方必须用这个函数区分「密文」与「历史明文」：DecryptSecret 对非信封
// 输入会原样返回，若调用方不判断就直接当成明文落库，就又回到了明文存储。
func IsSecretEnvelope(value string) bool {
	return strings.HasPrefix(value, secretEnvelopePrefix)
}

// ActiveSecretKeySource 返回加密新数据时使用的密钥来源。
func ActiveSecretKeySource() string {
	return secretKeySourceCrypto
}

// deriveSecretKey 从 SESSION_SECRET 派生 32 字节 AES 密钥。
func deriveSecretKey() ([]byte, error) {
	return deriveSecretKeyFromSource(secretKeySourceSession)
}

// deriveSecretKeyFromSource 按来源标识派生 32 字节 AES 密钥。
//
// 两个来源都是确定性的（只依赖对应的环境变量），因此同一枚密钥在不同进程、
// 不同机器上都能派生出相同结果——这是密文可跨重启、跨节点解密的前提。
func deriveSecretKeyFromSource(source string) ([]byte, error) {
	var material string
	switch source {
	case secretKeySourceSession:
		if SessionSecret == "" {
			return nil, errors.New("session secret not initialized")
		}
		material = "uter-secret-v2/" + secretKeySourceSession + "/" + SessionSecret
	case secretKeySourceCrypto:
		if CryptoSecret == "" {
			return nil, errors.New("crypto secret not initialized")
		}
		material = "uter-secret-v2/" + secretKeySourceCrypto + "/" + CryptoSecret
	default:
		return nil, fmt.Errorf("unknown secret key source %q", source)
	}
	sum := sha256.Sum256([]byte(material))
	return sum[:], nil
}

// fingerprintOf 返回密钥的短指纹，写入信封用于识别密钥轮换。
//
// 只取摘要前 4 字节（8 个十六进制字符）：它仅用于比对「是不是同一枚密钥」，
// 不是安全边界；攻击者拿到指纹也无法反推密钥。
func fingerprintOf(key []byte) string {
	sum := sha256.Sum256(key)
	return hex.EncodeToString(sum[:4])
}

// EncryptSecret 使用活动密钥来源加密敏感字段（如 TOTP 密钥）用于落库存储。
func EncryptSecret(plain string) (string, error) {
	return encryptSecretWithSource(plain, ActiveSecretKeySource())
}

// EncryptSecretWithSource 使用指定来源加密，仅在密钥轮换迁移时使用。
func EncryptSecretWithSource(plain string, source string) (string, error) {
	return encryptSecretWithSource(plain, source)
}

func encryptSecretWithSource(plain string, source string) (string, error) {
	key, err := deriveSecretKeyFromSource(source)
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
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	ct := gcm.Seal(nil, nonce, []byte(plain), nil)
	payload := base64.StdEncoding.EncodeToString(append(nonce, ct...))
	return secretEnvelopePrefix + source + ":" + fingerprintOf(key) + ":" + payload, nil
}

// DecryptSecret 解密 EncryptSecret 的产物。
//
//   - 信封格式：按信封内记录的来源派生密钥，并校验密钥指纹。指纹不符时返回
//     ErrSecretKeyRotated，调用方必须按轮换流程处理，不得把密文当明文使用。
//   - 非信封格式：这是迁移前的历史明文，原样返回。调用方有责任在取到明文后
//     立即升级为密文（见 model.TwoFA.PlainSecret），否则等于继续明文存储。
func DecryptSecret(cipherStr string) (string, error) {
	if !IsSecretEnvelope(cipherStr) {
		return cipherStr, nil
	}

	parts := strings.SplitN(strings.TrimPrefix(cipherStr, secretEnvelopePrefix), ":", 3)
	if len(parts) != 3 {
		return "", errors.New("invalid secret envelope")
	}
	source, fingerprint, payload := parts[0], parts[1], parts[2]

	key, err := deriveSecretKeyFromSource(source)
	if err != nil {
		return "", err
	}
	if current := fingerprintOf(key); current != fingerprint {
		return "", fmt.Errorf("%w（记录 %s，当前 %s）", ErrSecretKeyRotated, fingerprint, current)
	}

	raw, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return "", errors.New("invalid secret envelope payload")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", errors.New("invalid secret envelope payload")
	}
	nonce, ct := raw[:gcm.NonceSize()], raw[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return "", fmt.Errorf("secret envelope authentication failed: %w", err)
	}
	return string(plain), nil
}

// ReencryptSecret 把一份密文改用当前活动密钥来源重新加密。
//
// 用于密钥轮换窗口期：旧密钥仍可解密时，把存量密文迁到新来源上。第二个返回
// 值报告是否真的发生了重新加密（已经是活动来源时为 false），便于调用方统计。
func ReencryptSecret(envelope string) (string, bool, error) {
	if !IsSecretEnvelope(envelope) {
		return "", false, errors.New("value is not a secret envelope")
	}
	parts := strings.SplitN(strings.TrimPrefix(envelope, secretEnvelopePrefix), ":", 3)
	if len(parts) != 3 {
		return "", false, errors.New("invalid secret envelope")
	}
	if parts[0] == ActiveSecretKeySource() {
		return envelope, false, nil
	}
	plain, err := DecryptSecret(envelope)
	if err != nil {
		return "", false, err
	}
	updated, err := EncryptSecret(plain)
	if err != nil {
		return "", false, err
	}
	return updated, true, nil
}
