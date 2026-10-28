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

// signRawContentWithKey 用给定私钥对任意字符串做 SHA256withRSA 签名，
// 用来模拟「支付宝侧用支付宝私钥签出的回调」。
func signRawContentWithKey(t *testing.T, content, privPEM string) string {
	t.Helper()
	block, _ := pem.Decode([]byte(privPEM))
	if block == nil {
		t.Fatalf("decode private key pem")
	}
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		t.Fatalf("parse pkcs8: %v", err)
	}
	priv, ok := key.(*rsa.PrivateKey)
	if !ok {
		t.Fatalf("not an RSA private key")
	}
	hashed := sha256.Sum256([]byte(content))
	sig, err := rsa.SignPKCS1v15(rand.Reader, priv, crypto.SHA256, hashed[:])
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return base64.StdEncoding.EncodeToString(sig)
}

// alipayNotifyParams 构造一份贴近真实支付宝异步通知的参数集。
func alipayNotifyParams() map[string]string {
	return map[string]string{
		"app_id":       "2021000000000000",
		"out_trade_no": "USR1NOabcdef1699999999",
		"trade_no":     "2026102822001400000000000001",
		"trade_status": "TRADE_SUCCESS",
		"total_amount": "6.88",
		"notify_time":  "2026-10-28 10:00:00",
		"notify_type":  "trade_status_sync",
		"charset":      "utf-8",
		"version":      "1.0",
		"sign_type":    "RSA2",
	}
}

// TestAlipayNotifyVerifyAcceptsRealAlipaySignature 用「支付宝的签名口径」
// （排除 sign 与 sign_type）签出回调，验证本地验签能通过。
func TestAlipayNotifyVerifyAcceptsRealAlipaySignature(t *testing.T) {
	privPEM, pub := genTestRSAKey(t)
	params := alipayNotifyParams()

	content, err := alipayNotifyVerifyContent(params)
	if err != nil {
		t.Fatalf("alipayNotifyVerifyContent: %v", err)
	}
	sign := signRawContentWithKey(t, content, privPEM)

	verifyParams := map[string]string{}
	for k, v := range params {
		verifyParams[k] = v
	}
	verifyParams["sign"] = sign

	if !AlipayVerifySign(verifyParams, mustPKCS1PubPEM(t, pub), sign) {
		t.Fatal("AlipayVerifySign failed for a signature produced with Alipay's own rule")
	}

	// 篡改金额后验签必须失败。
	tampered := map[string]string{}
	for k, v := range verifyParams {
		tampered[k] = v
	}
	tampered["total_amount"] = "0.01"
	if AlipayVerifySign(tampered, mustPKCS1PubPEM(t, pub), sign) {
		t.Fatal("AlipayVerifySign must fail after tampering the amount")
	}
}

// TestAlipayNotifyVerifyRejectsRequestStyleSignature 锁死「回调验签不能复用
// 请求签名的拼接口径」：把 sign_type 计入待验签串时，支付宝的真实签名必须被拒。
//
// 这正是旧实现的缺陷——验签沿用了请求签名的拼接函数（保留 sign_type），
// 与支付宝的待签串相差一个 &sign_type=RSA2 片段，导致所有真实回调验签失败。
func TestAlipayNotifyVerifyRejectsRequestStyleSignature(t *testing.T) {
	privPEM, pub := genTestRSAKey(t)
	params := alipayNotifyParams()

	requestStyleContent, err := alipaySignContent(params)
	if err != nil {
		t.Fatalf("alipaySignContent: %v", err)
	}
	if !strings.Contains(requestStyleContent, "sign_type=") {
		t.Fatal("request sign content must include sign_type")
	}
	sign := signRawContentWithKey(t, requestStyleContent, privPEM)

	verifyParams := map[string]string{}
	for k, v := range params {
		verifyParams[k] = v
	}
	verifyParams["sign"] = sign

	if AlipayVerifySign(verifyParams, mustPKCS1PubPEM(t, pub), sign) {
		t.Fatal("verify must reject a signature computed over the request-style content")
	}
}

// TestAlipayNotifyVerifyContentExcludesSignType 直接断言待验签串的构成。
func TestAlipayNotifyVerifyContentExcludesSignType(t *testing.T) {
	content, err := alipayNotifyVerifyContent(map[string]string{
		"app_id":    "2021000000000000",
		"trade_no":  "T1",
		"sign_type": "RSA2",
		"sign":      "SHOULD-BE-EXCLUDED",
		"empty":     "",
	})
	if err != nil {
		t.Fatalf("alipayNotifyVerifyContent: %v", err)
	}
	if content != "app_id=2021000000000000&trade_no=T1" {
		t.Fatalf("unexpected verify content: %q", content)
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
