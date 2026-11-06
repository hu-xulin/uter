package service

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/setting/operation_setting"
)

func testPrivateKeyPEM(key *rsa.PrivateKey) string {
	return string(pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(key),
	}))
}

func testPublicKeyPEM(key *rsa.PublicKey) string {
	der, err := x509.MarshalPKIXPublicKey(key)
	if err != nil {
		panic(err)
	}
	return string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: der}))
}

func testSignContent(content string, key *rsa.PrivateKey) string {
	hashed := sha256.Sum256([]byte(content))
	sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, hashed[:])
	if err != nil {
		panic(err)
	}
	return base64.StdEncoding.EncodeToString(sig)
}

func TestAlipayQueryOrder(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	var captured url.Values
	node := `{"code":"10000","msg":"Success","trade_status":"TRADE_SUCCESS","total_amount":"0.06","out_trade_no":"T1"}`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		captured = r.PostForm
		fmt.Fprintf(w, `{"alipay_trade_query_response":%s,"sign":%q}`, node, testSignContent(node, key))
	}))
	defer server.Close()

	previousGateway := operation_setting.AlipayGateway
	previousAppId := operation_setting.AlipayAppId
	previousPrivate := operation_setting.AlipayPrivateKey
	previousPublic := operation_setting.AlipayPublicKey
	t.Cleanup(func() {
		operation_setting.AlipayGateway = previousGateway
		operation_setting.AlipayAppId = previousAppId
		operation_setting.AlipayPrivateKey = previousPrivate
		operation_setting.AlipayPublicKey = previousPublic
	})
	operation_setting.AlipayGateway = server.URL
	operation_setting.AlipayAppId = "2021000000000000"
	operation_setting.AlipayPrivateKey = testPrivateKeyPEM(key)
	operation_setting.AlipayPublicKey = testPublicKeyPEM(&key.PublicKey)

	result, err := AlipayQueryOrder(context.Background(), "T1")
	require.NoError(t, err)
	assert.Equal(t, "TRADE_SUCCESS", result.TradeStatus)
	assert.Equal(t, "0.06", result.TotalAmount)
	assert.Equal(t, "T1", result.OutTradeNo)

	assert.Equal(t, "alipay.trade.query", captured.Get("method"))
	assert.Equal(t, `{"out_trade_no":"T1"}`, captured.Get("biz_content"))
	assert.NotEmpty(t, captured.Get("sign"))
}

// 响应签名不合法时必须失败：否则中间人可伪造 TRADE_SUCCESS 触发入账。
func TestAlipayQueryOrderRejectsBadSignature(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	other, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	node := `{"code":"10000","msg":"Success","trade_status":"TRADE_SUCCESS","total_amount":"0.06","out_trade_no":"T1"}`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 用另一把私钥签名，AlipayPublicKey 验签必然失败。
		fmt.Fprintf(w, `{"alipay_trade_query_response":%s,"sign":%q}`, node, testSignContent(node, other))
	}))
	defer server.Close()

	previousGateway := operation_setting.AlipayGateway
	previousPrivate := operation_setting.AlipayPrivateKey
	previousPublic := operation_setting.AlipayPublicKey
	t.Cleanup(func() {
		operation_setting.AlipayGateway = previousGateway
		operation_setting.AlipayPrivateKey = previousPrivate
		operation_setting.AlipayPublicKey = previousPublic
	})
	operation_setting.AlipayGateway = server.URL
	operation_setting.AlipayPrivateKey = testPrivateKeyPEM(key)
	operation_setting.AlipayPublicKey = testPublicKeyPEM(&key.PublicKey)

	_, err = AlipayQueryOrder(context.Background(), "T1")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "signature invalid")
}

// 支付宝明确返回「交易不存在」时要按「未支付」处理（走 pending），
// 而不是报错——用户从收银台返回但没付款是最常见的路径。
func TestAlipayQueryOrderTreatsTradeNotExistAsUnpaid(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	node := `{"code":"40004","msg":"Business Failed","sub_code":"ACQ.TRADE_NOT_EXIST","sub_msg":"交易不存在"}`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, `{"alipay_trade_query_response":%s,"sign":%q}`, node, testSignContent(node, key))
	}))
	defer server.Close()

	previousGateway := operation_setting.AlipayGateway
	previousPrivate := operation_setting.AlipayPrivateKey
	previousPublic := operation_setting.AlipayPublicKey
	t.Cleanup(func() {
		operation_setting.AlipayGateway = previousGateway
		operation_setting.AlipayPrivateKey = previousPrivate
		operation_setting.AlipayPublicKey = previousPublic
	})
	operation_setting.AlipayGateway = server.URL
	operation_setting.AlipayPrivateKey = testPrivateKeyPEM(key)
	operation_setting.AlipayPublicKey = testPublicKeyPEM(&key.PublicKey)

	result, err := AlipayQueryOrder(context.Background(), "T1")
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, "TRADE_NOT_EXIST", result.TradeStatus)
	assert.Equal(t, "T1", result.OutTradeNo)
}

// 除「交易不存在」以外的业务失败仍必须是错误：否则会把网关故障误判成未支付。
func TestAlipayQueryOrderSurfacesOtherBusinessFailures(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	node := `{"code":"40004","msg":"Business Failed","sub_code":"ACQ.INVALID_PARAMETER","sub_msg":"参数无效"}`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, `{"alipay_trade_query_response":%s,"sign":%q}`, node, testSignContent(node, key))
	}))
	defer server.Close()

	previousGateway := operation_setting.AlipayGateway
	previousPrivate := operation_setting.AlipayPrivateKey
	previousPublic := operation_setting.AlipayPublicKey
	t.Cleanup(func() {
		operation_setting.AlipayGateway = previousGateway
		operation_setting.AlipayPrivateKey = previousPrivate
		operation_setting.AlipayPublicKey = previousPublic
	})
	operation_setting.AlipayGateway = server.URL
	operation_setting.AlipayPrivateKey = testPrivateKeyPEM(key)
	operation_setting.AlipayPublicKey = testPublicKeyPEM(&key.PublicKey)

	_, err = AlipayQueryOrder(context.Background(), "T1")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "ACQ.INVALID_PARAMETER")
}

func TestAlipayQueryOrderRejectsMismatchedTradeNumber(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	node := `{"code":"10000","msg":"Success","trade_status":"TRADE_SUCCESS","total_amount":"0.06","out_trade_no":"OTHER-ORDER"}`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, `{"alipay_trade_query_response":%s,"sign":%q}`, node, testSignContent(node, key))
	}))
	defer server.Close()

	previousGateway := operation_setting.AlipayGateway
	previousPrivate := operation_setting.AlipayPrivateKey
	previousPublic := operation_setting.AlipayPublicKey
	t.Cleanup(func() {
		operation_setting.AlipayGateway = previousGateway
		operation_setting.AlipayPrivateKey = previousPrivate
		operation_setting.AlipayPublicKey = previousPublic
	})
	operation_setting.AlipayGateway = server.URL
	operation_setting.AlipayPrivateKey = testPrivateKeyPEM(key)
	operation_setting.AlipayPublicKey = testPublicKeyPEM(&key.PublicKey)

	_, err = AlipayQueryOrder(context.Background(), "REQUESTED-ORDER")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "out_trade_no mismatch")
}
