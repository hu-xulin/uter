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

You should have received a copy of the GNU Affero General License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

package service

import (
	"crypto"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// 通用 PEM / 密钥解析
// ---------------------------------------------------------------------------

// normalizePEM 把"单行 base64 密钥"包裹成 PEM；已经是 PEM 则原样返回。
func normalizePEM(content, defaultType string) []byte {
	s := strings.TrimSpace(content)
	if strings.Contains(s, "BEGIN") {
		return []byte(s)
	}
	var b strings.Builder
	b.WriteString("-----BEGIN ")
	b.WriteString(defaultType)
	b.WriteString("-----\n")
	for len(s) > 0 {
		n := 64
		if len(s) < n {
			n = len(s)
		}
		b.WriteString(s[:n])
		b.WriteString("\n")
		s = s[n:]
	}
	b.WriteString("-----END ")
	b.WriteString(defaultType)
	b.WriteString("-----\n")
	return []byte(b.String())
}

func parseRSAPrivateKey(content string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode(normalizePEM(content, "PRIVATE KEY"))
	if block == nil {
		return nil, errors.New("invalid private key pem")
	}
	if k, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		if rk, ok := k.(*rsa.PrivateKey); ok {
			return rk, nil
		}
	}
	if k, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return k, nil
	}
	return nil, errors.New("unsupported private key format")
}

func parseRSAPublicKey(content string) (*rsa.PublicKey, error) {
	block, _ := pem.Decode(normalizePEM(content, "RSA PUBLIC KEY"))
	if block == nil {
		return nil, errors.New("invalid public key pem")
	}
	if k, err := x509.ParsePKCS1PublicKey(block.Bytes); err == nil {
		return k, nil
	}
	if k, err := x509.ParsePKIXPublicKey(block.Bytes); err == nil {
		if rk, ok := k.(*rsa.PublicKey); ok {
			return rk, nil
		}
	}
	return nil, errors.New("unsupported public key format")
}

func parseWechatPlatformCert(pemContent string) (*rsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(pemContent))
	if block == nil {
		return nil, errors.New("invalid platform cert")
	}
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil, err
	}
	pub, ok := cert.PublicKey.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("cert public key is not RSA")
	}
	return pub, nil
}

func cnRandomString(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	s := base64.StdEncoding.EncodeToString(b)
	if len(s) > n {
		s = s[:n]
	}
	return s
}

// ---------------------------------------------------------------------------
// 支付宝：RSA2（SHA256withRSA）签名与验签
// ---------------------------------------------------------------------------

// AlipayBuildSign 对参数按 key 字典序拼接后做 RSA2 签名。
// 规则遵循支付宝规范：跳过 sign / sign_type，空值不参与签名。
func AlipayBuildSign(params map[string]string, privateKey string) (string, error) {
	message, err := alipaySignContent(params)
	if err != nil {
		return "", err
	}
	priv, err := parseRSAPrivateKey(privateKey)
	if err != nil {
		return "", err
	}
	hashed := sha256.Sum256([]byte(message))
	sig, err := rsa.SignPKCS1v15(rand.Reader, priv, crypto.SHA256, hashed[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(sig), nil
}

func alipaySignContent(params map[string]string) (string, error) {
	keys := make([]string, 0, len(params))
	for k := range params {
		if k == "sign" || k == "sign_type" {
			continue
		}
		if params[k] == "" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var sb strings.Builder
	for i, k := range keys {
		if i > 0 {
			sb.WriteString("&")
		}
		sb.WriteString(k)
		sb.WriteString("=")
		sb.WriteString(params[k])
	}
	return sb.String(), nil
}

// AlipayVerifySign 使用支付宝公钥验签回调参数。
func AlipayVerifySign(params map[string]string, publicKey, sign string) bool {
	sign = strings.TrimSpace(sign)
	if sign == "" {
		return false
	}
	message, err := alipaySignContent(params)
	if err != nil {
		return false
	}
	pub, err := parseRSAPublicKey(publicKey)
	if err != nil {
		return false
	}
	raw, err := base64.StdEncoding.DecodeString(sign)
	if err != nil {
		return false
	}
	hashed := sha256.Sum256([]byte(message))
	return rsa.VerifyPKCS1v15(pub, crypto.SHA256, hashed[:], raw) == nil
}

// ---------------------------------------------------------------------------
// 微信支付 APIv3：请求签名 / 回调验签 / 回调解密
// ---------------------------------------------------------------------------

// WechatPayBuildAuthHeader 生成 APIv3 请求所需的 Authorization 头。
func WechatPayBuildAuthHeader(method, urlPath, body, mchId, serialNo, privateKey string) (string, error) {
	priv, err := parseRSAPrivateKey(privateKey)
	if err != nil {
		return "", err
	}
	nonce := cnRandomString(32)
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	message := method + "\n" + urlPath + "\n" + timestamp + "\n" + nonce + "\n" + body + "\n"
	hashed := sha256.Sum256([]byte(message))
	sig, err := rsa.SignPKCS1v15(rand.Reader, priv, crypto.SHA256, hashed[:])
	if err != nil {
		return "", err
	}
	b64 := base64.StdEncoding.EncodeToString(sig)
	return fmt.Sprintf(
		`WECHATPAY2-SHA256-RSA2048 mchid="%s",nonce_str="%s",signature="%s",timestamp="%s",serial_no="%s"`,
		mchId, nonce, b64, timestamp, serialNo,
	), nil
}

// WechatPayVerifyNotify 校验微信支付回调签名。
func WechatPayVerifyNotify(timestamp, nonce, body, signature, platformCert string) bool {
	raw, err := base64.StdEncoding.DecodeString(strings.TrimSpace(signature))
	if err != nil {
		return false
	}
	pub, err := parseWechatPlatformCert(platformCert)
	if err != nil {
		return false
	}
	message := timestamp + "\n" + nonce + "\n" + body + "\n"
	hashed := sha256.Sum256([]byte(message))
	return rsa.VerifyPKCS1v15(pub, crypto.SHA256, hashed[:], raw) == nil
}

// WechatPayBuildJsapiPaySign 生成微信支付 JSAPI（小程序）调起支付所需的 paySign。
// 签名串格式（与微信支付规范一致，末尾带换行）：
//
//	appId\n
//	timeStamp\n
//	nonceStr\n
//	package\n
//
// 其中 package 形如 "prepay_id=xxx"。使用商户 API 私钥以 SHA256withRSA 签名。
func WechatPayBuildJsapiPaySign(appId, timeStamp, nonceStr, prepayId, privateKey string) (string, error) {
	priv, err := parseRSAPrivateKey(privateKey)
	if err != nil {
		return "", err
	}
	message := appId + "\n" +
		timeStamp + "\n" +
		nonceStr + "\n" +
		"prepay_id=" + prepayId + "\n"
	hashed := sha256.Sum256([]byte(message))
	sig, err := rsa.SignPKCS1v15(rand.Reader, priv, crypto.SHA256, hashed[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(sig), nil
}

// WechatPayDecryptResource 用 APIv3 密钥对回调解密（AES-256-GCM）。
func WechatPayDecryptResource(ciphertext, nonce, associatedData, apiV3Key string) (string, error) {
	key := []byte(apiV3Key)
	if len(key) != 32 {
		return "", errors.New("APIv3 key must be 32 bytes")
	}
	ct, err := base64.StdEncoding.DecodeString(ciphertext)
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
	if len(nonce) != gcm.NonceSize() {
		return "", errors.New("invalid nonce size")
	}
	plaintext, err := gcm.Open(nil, []byte(nonce), ct, []byte(associatedData))
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}
