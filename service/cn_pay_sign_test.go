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
	"encoding/base64"
	"encoding/pem"
	"testing"
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
		"app_id":     "2021000000000000",
		"method":     "alipay.trade.create",
		"charset":    "utf-8",
		"sign_type":  "RSA2",
		"timestamp":  "2026-01-01 00:00:00",
		"version":    "1.0",
		"biz_content": `{"out_trade_no":"USR1NOtest","buyer_id":"2088000000000000"}`,
		"empty":      "",
	}
	sign, err := AlipayBuildSign(params, privPEM)
	if err != nil {
		t.Fatalf("AlipayBuildSign: %v", err)
	}
	if sign == "" {
		t.Fatal("expected non-empty sign")
	}

	// 验签时不应包含 sign / sign_type，且空值需排除。
	verifyParams := map[string]string{
		"app_id":     params["app_id"],
		"method":     params["method"],
		"charset":    params["charset"],
		"timestamp":  params["timestamp"],
		"version":    params["version"],
		"biz_content": params["biz_content"],
		"sign":       sign,
		"sign_type":  "RSA2",
	}
	if !AlipayVerifySign(verifyParams, mustPKCS1PubPEM(t, pub), sign) {
		t.Fatal("AlipayVerifySign failed for a valid signature")
	}
	// 篡改参数后验签必须失败。
	bad := map[string]string{
		"app_id":     "9999999999999999",
		"method":     params["method"],
		"charset":    params["charset"],
		"timestamp":  params["timestamp"],
		"version":    params["version"],
		"biz_content": params["biz_content"],
		"sign":       sign,
		"sign_type":  "RSA2",
	}
	if AlipayVerifySign(bad, mustPKCS1PubPEM(t, pub), sign) {
		t.Fatal("AlipayVerifySign must fail after tampering")
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
