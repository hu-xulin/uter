package service

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/uter-ai/uter/setting/operation_setting"
)

// genTestRSAKeyPairPEM 返回可直接喂给 parseRSAPrivateKey / parseRSAPublicKey 的 PEM。
func genTestRSAKeyPairPEM(t *testing.T) (privPEM, pubPEM string) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	privDER, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatalf("marshal pkcs8: %v", err)
	}
	pubDER, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	if err != nil {
		t.Fatalf("marshal pkix: %v", err)
	}
	privPEM = string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: privDER}))
	pubPEM = string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubDER}))
	return privPEM, pubPEM
}

// TestInspectCnPayCredentialsSkipsDisabledProviders 验证「没开支付就不该报警」：
// 未启用的渠道即使密钥全空也不能产生噪音，否则日志会被无关告警淹没。
func TestInspectCnPayCredentialsSkipsDisabledProviders(t *testing.T) {
	restore := withCnPaySettings(t)
	defer restore()

	operation_setting.AlipayEnabled = false
	operation_setting.WechatPayEnabled = false
	assert.Empty(t, InspectCnPayCredentials())
}

// TestInspectCnPayCredentialsReportsUnparsableKeys 验证「填了但格式不对」能被抓到：
// 旧实现只判空，密钥贴错字段时配置页仍显示已启用，用户点充值才失败。
func TestInspectCnPayCredentialsReportsUnparsableKeys(t *testing.T) {
	restore := withCnPaySettings(t)
	defer restore()

	operation_setting.AlipayEnabled = true
	operation_setting.AlipayAppId = "2021000000000000"
	operation_setting.AlipayGateway = "https://openapi.alipay.com/gateway.do"
	// 把公钥贴进私钥字段：这是最常见的粘贴错误。
	_, pubPEM := genTestRSAKeyPairPEM(t)
	operation_setting.AlipayPrivateKey = pubPEM
	operation_setting.AlipayPublicKey = pubPEM

	problems := InspectCnPayCredentials()
	assert.Len(t, problems, 1, "only the private key should be rejected, got %v", problems)
	assert.Equal(t, "alipay", problems[0].Provider)
	assert.Equal(t, "PrivateKey", problems[0].Field)
}

// TestInspectCnPayCredentialsAcceptsValidConfig 验证配好之后没有告警。
func TestInspectCnPayCredentialsAcceptsValidConfig(t *testing.T) {
	restore := withCnPaySettings(t)
	defer restore()

	privPEM, pubPEM := genTestRSAKeyPairPEM(t)

	operation_setting.AlipayEnabled = true
	operation_setting.AlipayAppId = "2021000000000000"
	operation_setting.AlipayGateway = "https://openapi.alipay.com/gateway.do"
	operation_setting.AlipayPrivateKey = privPEM
	operation_setting.AlipayPublicKey = pubPEM

	operation_setting.WechatPayEnabled = true
	operation_setting.WechatPayMchId = "1752071965"
	operation_setting.WechatPayAppId = "wx0000000000000000"
	operation_setting.WechatPaySerialNo = "SERIALNO"
	operation_setting.WechatPayApiV3Key = strings.Repeat("k", 32)
	operation_setting.WechatPayPrivateKey = privPEM
	operation_setting.WechatPayPublicKey = pubPEM
	operation_setting.WechatPayGateway = "https://api.mch.weixin.qq.com"

	assert.Empty(t, InspectCnPayCredentials())
}

// TestInspectCnPayCredentialsChecksApiV3KeyLength 验证 APIv3 密钥长度被检查：
// 长度不是 32 时回调解密必然失败，属于「配置看着对、回调永远解不开」的坑。
func TestInspectCnPayCredentialsChecksApiV3KeyLength(t *testing.T) {
	restore := withCnPaySettings(t)
	defer restore()

	privPEM, pubPEM := genTestRSAKeyPairPEM(t)

	operation_setting.WechatPayEnabled = true
	operation_setting.WechatPayMchId = "1752071965"
	operation_setting.WechatPayAppId = "wx0000000000000000"
	operation_setting.WechatPaySerialNo = "SERIALNO"
	operation_setting.WechatPayApiV3Key = "too-short"
	operation_setting.WechatPayPrivateKey = privPEM
	operation_setting.WechatPayPublicKey = pubPEM
	operation_setting.WechatPayGateway = "https://api.mch.weixin.qq.com"

	problems := InspectCnPayCredentials()
	assert.Len(t, problems, 1, "got %v", problems)
	assert.Equal(t, "ApiV3Key", problems[0].Field)
}

// TestInspectCnPayCredentialsRejectsNonHTTPSGateway 验证网关地址必须是绝对 https：
// 明文 http 会以「回调验签通过但内容可被中间人替换」的形式破坏支付链路。
func TestInspectCnPayCredentialsRejectsNonHTTPSGateway(t *testing.T) {
	restore := withCnPaySettings(t)
	defer restore()

	privPEM, pubPEM := genTestRSAKeyPairPEM(t)

	operation_setting.AlipayEnabled = true
	operation_setting.AlipayAppId = "2021000000000000"
	operation_setting.AlipayGateway = "http://openapi.alipay.com/gateway.do"
	operation_setting.AlipayPrivateKey = privPEM
	operation_setting.AlipayPublicKey = pubPEM

	problems := InspectCnPayCredentials()
	assert.Len(t, problems, 1, "got %v", problems)
	assert.Equal(t, "Gateway", problems[0].Field)
}

// withCnPaySettings 快照并恢复境内支付配置，避免用例间互相污染。
func withCnPaySettings(t *testing.T) func() {
	t.Helper()
	saved := struct {
		alipayEnabled bool
		alipayAppId   string
		alipayPriv    string
		alipayPub     string
		alipayGateway string
		wxEnabled     bool
		wxMchId       string
		wxAppId       string
		wxApiV3Key    string
		wxSerialNo    string
		wxPriv        string
		wxPub         string
		wxGateway     string
	}{
		alipayEnabled: operation_setting.AlipayEnabled,
		alipayAppId:   operation_setting.AlipayAppId,
		alipayPriv:    operation_setting.AlipayPrivateKey,
		alipayPub:     operation_setting.AlipayPublicKey,
		alipayGateway: operation_setting.AlipayGateway,
		wxEnabled:     operation_setting.WechatPayEnabled,
		wxMchId:       operation_setting.WechatPayMchId,
		wxAppId:       operation_setting.WechatPayAppId,
		wxApiV3Key:    operation_setting.WechatPayApiV3Key,
		wxSerialNo:    operation_setting.WechatPaySerialNo,
		wxPriv:        operation_setting.WechatPayPrivateKey,
		wxPub:         operation_setting.WechatPayPublicKey,
		wxGateway:     operation_setting.WechatPayGateway,
	}
	return func() {
		operation_setting.AlipayEnabled = saved.alipayEnabled
		operation_setting.AlipayAppId = saved.alipayAppId
		operation_setting.AlipayPrivateKey = saved.alipayPriv
		operation_setting.AlipayPublicKey = saved.alipayPub
		operation_setting.AlipayGateway = saved.alipayGateway
		operation_setting.WechatPayEnabled = saved.wxEnabled
		operation_setting.WechatPayMchId = saved.wxMchId
		operation_setting.WechatPayAppId = saved.wxAppId
		operation_setting.WechatPayApiV3Key = saved.wxApiV3Key
		operation_setting.WechatPaySerialNo = saved.wxSerialNo
		operation_setting.WechatPayPrivateKey = saved.wxPriv
		operation_setting.WechatPayPublicKey = saved.wxPub
		operation_setting.WechatPayGateway = saved.wxGateway
	}
}
