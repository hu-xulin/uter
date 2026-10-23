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
along with this program. Not found? See <https://www.gnu.org/licenses/>.
*/

package service

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/pem"
	"math/big"
	"strings"
	"testing"
	"time"
)

// genTestRSAKey 生成一段 PKCS8 PEM 私钥与对应的公钥，供签名/验签自测使用。
func genTestRSAKey(t *testing.T) (privPEM string, pub *rsa.PublicKey) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	der, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatalf("marshal pkcs8: %v", err)
	}
	privPEM = string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}))
	pub = &key.PublicKey
	return
}

// TestAlipaySignVerifyRoundTrip 验证支付宝 RSA2 签名可被同一公钥验签通过。
func TestAlipaySignVerifyRoundTrip(t *testing.T) {
	privPEM, pub := genTestRSAKey(t)

	params := map[string]string{
		"app_id":      "2021000000000000",
		"method":      "alipay.trade.create",
		"charset":     "utf-8",
		"sign_type":   "RSA2",
		"timestamp":   "2026-01-01 00:00:00",
		"version":     "1.0",
		"biz_content": `{"out_trade_no":"USR1NOtest","buyer_id":"2088000000000000"}`,
		"empty":       "",
	}
	sign, err := AlipayBuildSign(params, privPEM)
	if err != nil {
		t.Fatalf("AlipayBuildSign: %v", err)
	}
	if sign == "" {
		t.Fatal("expected non-empty sign")
	}

	// 验签时同样只包含 sign_type（不含 sign 本身），空值排除。
	verifyParams := map[string]string{
		"app_id":      params["app_id"],
		"method":      params["method"],
		"charset":     params["charset"],
		"timestamp":   params["timestamp"],
		"version":     params["version"],
		"biz_content": params["biz_content"],
		"sign":        sign,
		"sign_type":   "RSA2",
	}
	if !AlipayVerifySign(verifyParams, mustPKCS1PubPEM(t, pub), sign) {
		t.Fatal("AlipayVerifySign failed for a valid signature")
	}
	// 篡改参数后验签必须失败。
	bad := map[string]string{
		"app_id":      "9999999999999999",
		"method":      params["method"],
		"charset":     params["charset"],
		"timestamp":   params["timestamp"],
		"version":     params["version"],
		"biz_content": params["biz_content"],
		"sign":        sign,
		"sign_type":   "RSA2",
	}
	if AlipayVerifySign(bad, mustPKCS1PubPEM(t, pub), sign) {
		t.Fatal("AlipayVerifySign must fail after tampering")
	}
}

// TestAlipaySignContentIncludesSignType 锁定「sign_type 参与签名」这一硬约束。
//
// 支付宝开放平台「请求参数签名」的官方示例待签名串明确包含 sign_type：
//
//	app_id=...&biz_content=...&charset=...&method=...&sign_type=RSA&timestamp=...&version=1.0
//
// 网关验签时把 sign_type 计入待签串。若本地签名把它剔除，两边字符串不一致，
// 所有下单与回调都会报 invalid-signature（未配置参数时不会暴露，填参后才爆发）。
func TestAlipaySignContentIncludesSignType(t *testing.T) {
	params := map[string]string{
		"app_id":    "2021000000000000",
		"method":    "alipay.trade.precreate",
		"charset":   "utf-8",
		"sign_type": "RSA2",
		"timestamp": "2026-01-01 00:00:00",
		"version":   "1.0",
		"sign":      "SHOULD-BE-EXCLUDED",
		"empty":     "",
	}
	content, err := alipaySignContent(params)
	if err != nil {
		t.Fatalf("alipaySignContent: %v", err)
	}
	want := "app_id=2021000000000000&charset=utf-8&method=alipay.trade.precreate" +
		"&sign_type=RSA2&timestamp=2026-01-01 00:00:00&version=1.0"
	if content != want {
		t.Fatalf("unexpected sign content:\n got: %q\nwant: %q", content, want)
	}
	if strings.Contains(content, "SHOULD-BE-EXCLUDED") {
		t.Fatal("sign must be excluded from the sign content")
	}
}

// TestWechatPayJsapiPaySign 校验 JSAPI paySign 的签名串格式与可验签性。
// 微信小程序 wx.requestPayment 的 paySign 必须对
//
//	appId\ntimeStamp\nnonceStr\npackage\n
//
// 以 SHA256withRSA 签名，格式错误会导致调起支付失败。
func TestWechatPayJsapiPaySign(t *testing.T) {
	privPEM, pub := genTestRSAKey(t)

	appID := "wx1234567890abcdef"
	timeStamp := "1700000000"
	nonceStr := "abcdef1234567890abcdef1234567890"
	prepayID := "wx202601010000001234567890"

	paySign, err := WechatPayBuildJsapiPaySign(appID, timeStamp, nonceStr, prepayID, privPEM)
	if err != nil {
		t.Fatalf("WechatPayBuildJsapiPaySign: %v", err)
	}
	if paySign == "" {
		t.Fatal("expected non-empty paySign")
	}

	// 复刻微信规范要求的签名串（末尾带换行）。
	message := appID + "\n" + timeStamp + "\n" + nonceStr + "\n" + "prepay_id=" + prepayID + "\n"
	hashed := sha256.Sum256([]byte(message))
	raw, err := base64.StdEncoding.DecodeString(paySign)
	if err != nil {
		t.Fatalf("paySign not base64: %v", err)
	}
	if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hashed[:], raw); err != nil {
		t.Fatalf("paySign verification failed: %v", err)
	}

	// 错误的签名串（缺少末尾换行 / 缺字段）不应验签通过。
	badMsg := appID + "\n" + timeStamp + "\n" + nonceStr + "\n" + "prepay_id=" + prepayID
	badHashed := sha256.Sum256([]byte(badMsg))
	if rsa.VerifyPKCS1v15(pub, crypto.SHA256, badHashed[:], raw) == nil {
		t.Fatal("paySign must NOT verify against a malformed message")
	}
}

func mustPKCS1PubPEM(t *testing.T, pub *rsa.PublicKey) string {
	t.Helper()
	der := x509.MarshalPKCS1PublicKey(pub)
	return string(pem.EncodeToMemory(&pem.Block{Type: "RSA PUBLIC KEY", Bytes: der}))
}

// TestWechatPayVerifyNotifyAcceptsWechatPayPublicKey 锁定回调验签只接受
// 「微信支付公钥」（PUBLIC KEY PEM）：新商户在商户平台只能下载该公钥，
// 验签必须成立，否则表现为「用户已扣款但额度不到账」。
// 同时反向锁定：平台证书（CERTIFICATE PEM，存量商户形态）不再被接受——
// uter 只支持微信支付公钥这一种载体，把两种形态的预期都钉住，
// 避免回退到"两种都认"的模糊状态。
func TestWechatPayVerifyNotifyAcceptsWechatPayPublicKey(t *testing.T) {
	privPEM, pub := genTestRSAKey(t)
	priv, err := parseRSAPrivateKey(privPEM)
	if err != nil {
		t.Fatalf("parse private key: %v", err)
	}

	timestamp := "1700000000"
	nonce := "abcdef1234567890"
	body := `{"id":"EV-2026010100000001","event_type":"TRANSACTION.SUCCESS"}`
	hashed := sha256.Sum256([]byte(timestamp + "\n" + nonce + "\n" + body + "\n"))
	raw, err := rsa.SignPKCS1v15(rand.Reader, priv, crypto.SHA256, hashed[:])
	if err != nil {
		t.Fatalf("sign notify: %v", err)
	}
	signature := base64.StdEncoding.EncodeToString(raw)

	// 微信支付公钥：PKIX PEM（pub_key.pem 的下载形态）。
	pubDER, err := x509.MarshalPKIXPublicKey(pub)
	if err != nil {
		t.Fatalf("marshal public key: %v", err)
	}
	pubPEM := string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubDER}))

	if !WechatPayVerifyNotify(timestamp, nonce, body, signature, pubPEM) {
		t.Fatal("valid notify signature must verify against the WeChat Pay public key")
	}
	// 篡改报文后必须验签失败。
	if WechatPayVerifyNotify(timestamp, nonce, body+" ", signature, pubPEM) {
		t.Fatal("tampered body must NOT verify")
	}

	// 平台证书（存量商户形态）不再被接受：uter 只支持微信支付公钥。
	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "Tenpay.com Root CA"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(24 * time.Hour),
	}
	certDER, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, pub, priv)
	if err != nil {
		t.Fatalf("create cert: %v", err)
	}
	certPEM := string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER}))
	if WechatPayVerifyNotify(timestamp, nonce, body, signature, certPEM) {
		t.Fatal("platform certificate must NOT verify: only the WeChat Pay public key is supported")
	}
}
