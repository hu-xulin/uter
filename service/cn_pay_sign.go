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
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/uter-ai/uter/setting/operation_setting"
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
// 规则遵循支付宝规范：仅跳过 sign 本身，sign_type 必须参与签名，空值不参与签名。
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

// alipaySignContent 构造**请求签名**的待签名串：
// 只排除 sign 本身与空值参数。
//
// ⚠️ sign_type 必须参与请求签名：支付宝开放平台「请求参数签名」的官方示例
// 待签名串明确包含 sign_type（...&method=...&sign_type=RSA&timestamp=...）。
// 网关验签时把 sign_type 计入，若本地签名把它剔除，两边待签串不一致，
// 必然报 invalid-signature。
//
// 注意：**异步通知验签的口径不同**（要排除 sign 与 sign_type），
// 见 alipayNotifyVerifyContent。两个场景不能共用一个函数。
func alipaySignContent(params map[string]string) (string, error) {
	return alipaySortedContent(params, false)
}

// alipayNotifyVerifyContent 构造**异步通知验签**的待验签串：
// 排除 sign 与 sign_type 两个参数，其余非空参数按 key 字典序拼接。
//
// 依据支付宝官方文档《异步通知参数说明》：
// 「在通知返回参数列表中，除去 sign、sign_type 两个参数外，凡是通知返回回来的
// 参数皆是待验签的参数。」官方 SDK 的 AlipaySignature.getSignCheckContentV1
// 同样是 remove("sign") + remove("sign_type")。
//
// 旧实现让验签复用请求签名的拼接函数（保留 sign_type），与支付宝的实际待签串
// 相差一个 &sign_type=RSA2 片段，因此**所有真实回调都会验签失败**：用户付款成功、
// 站点返回 failure、支付宝持续重试直到放弃，订单永远停在 pending。
func alipayNotifyVerifyContent(params map[string]string) (string, error) {
	return alipaySortedContent(params, true)
}

// alipaySortedContent 按 key 字典序拼接非空参数，可选排除 sign_type。
func alipaySortedContent(params map[string]string, excludeSignType bool) (string, error) {
	keys := make([]string, 0, len(params))
	for k := range params {
		if k == "sign" {
			continue
		}
		if excludeSignType && k == "sign_type" {
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

// AlipayVerifySign 使用支付宝公钥验签异步通知参数。
//
// publicKey 必须是**支付宝公钥**（开放平台「接口加签方式」里下载的那把），
// 不是应用公钥。用应用公钥验签必然失败——应用公钥只用于「支付宝验证我们的请求」。
func AlipayVerifySign(params map[string]string, publicKey, sign string) bool {
	sign = strings.TrimSpace(sign)
	if sign == "" {
		return false
	}
	message, err := alipayNotifyVerifyContent(params)
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
// publicKey 为商户平台下载的「微信支付公钥」（pub_key.pem，PKCS#1 或 PKIX RSA 公钥 PEM，
// 也兼容只贴 base64 主体的单行形式）。注意这里不接受平台证书（CERTIFICATE PEM）：
// 新商户在商户平台只能拿到微信支付公钥，uter 只支持这一种载体。
func WechatPayVerifyNotify(timestamp, nonce, body, signature, publicKey string) bool {
	raw, err := base64.StdEncoding.DecodeString(strings.TrimSpace(signature))
	if err != nil {
		return false
	}
	pub, err := parseRSAPublicKey(publicKey)
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

// ---------------------------------------------------------------------------
// 启动期凭据体检
// ---------------------------------------------------------------------------

// CnPayCredentialProblem 描述一处境内支付凭据配置问题。
type CnPayCredentialProblem struct {
	Provider string
	Field    string
	Reason   string
}

func (p CnPayCredentialProblem) String() string {
	return fmt.Sprintf("%s.%s: %s", p.Provider, p.Field, p.Reason)
}

// InspectCnPayCredentials 在启动时检查境内支付凭据是否**真的可用**。
//
// 只判空是不够的：密钥填了但格式不对（缺 PEM 头、把公钥贴进私钥字段、
// 平台证书贴进公钥字段）时，配置页会显示「已启用」，用户点充值才在下单
// 那一刻失败，错误还只能看到「创建订单失败」。这里把可解析性提前到启动期，
// 让运维在日志里直接看到是哪一项、错在哪。
//
// 未启用的渠道不做检查——没开支付就不该因为没配密钥而报警。
func InspectCnPayCredentials() []CnPayCredentialProblem {
	var problems []CnPayCredentialProblem

	if operation_setting.AlipayEnabled {
		add := func(field, reason string) {
			problems = append(problems, CnPayCredentialProblem{Provider: "alipay", Field: field, Reason: reason})
		}
		if strings.TrimSpace(operation_setting.AlipayAppId) == "" {
			add("AppId", "empty")
		}
		if strings.TrimSpace(operation_setting.AlipayGateway) == "" {
			add("Gateway", "empty")
		} else if u, err := url.Parse(operation_setting.AlipayGateway); err != nil || u.Scheme != "https" || u.Host == "" {
			add("Gateway", "must be an absolute https URL")
		}
		if _, err := parseRSAPrivateKey(operation_setting.AlipayPrivateKey); err != nil {
			add("PrivateKey", err.Error())
		}
		if _, err := parseRSAPublicKey(operation_setting.AlipayPublicKey); err != nil {
			add("PublicKey", err.Error())
		}
	}

	if operation_setting.WechatPayEnabled {
		add := func(field, reason string) {
			problems = append(problems, CnPayCredentialProblem{Provider: "wechatpay", Field: field, Reason: reason})
		}
		if strings.TrimSpace(operation_setting.WechatPayMchId) == "" {
			add("MchId", "empty")
		}
		if strings.TrimSpace(operation_setting.WechatPayAppId) == "" {
			add("AppId", "empty")
		}
		if strings.TrimSpace(operation_setting.WechatPaySerialNo) == "" {
			add("SerialNo", "empty")
		}
		if len(operation_setting.WechatPayApiV3Key) != 32 {
			add("ApiV3Key", fmt.Sprintf("must be exactly 32 bytes, got %d", len(operation_setting.WechatPayApiV3Key)))
		}
		if _, err := parseRSAPrivateKey(operation_setting.WechatPayPrivateKey); err != nil {
			add("PrivateKey", err.Error())
		}
		if _, err := parseRSAPublicKey(operation_setting.WechatPayPublicKey); err != nil {
			add("PublicKey", err.Error())
		}
		if strings.TrimSpace(operation_setting.WechatPayGateway) == "" {
			add("Gateway", "empty")
		} else if u, err := url.Parse(operation_setting.WechatPayGateway); err != nil || u.Scheme != "https" || u.Host == "" {
			add("Gateway", "must be an absolute https URL")
		}
	}

	return problems
}
