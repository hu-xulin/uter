package service

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/setting/system_setting"
)

func TestNormalizeUpstreamConsoleBaseURL(t *testing.T) {
	tests := []struct {
		name    string
		raw     string
		want    string
		wantErr bool
	}{
		{"https origin with path", "https://console.example.com/admin/login", "https://console.example.com", false},
		{"http origin", "http://127.0.0.1:3000/", "http://127.0.0.1:3000", false},
		{"empty", "   ", "", true},
		{"relative", "/api/user/login", "", true},
		{"unsupported scheme", "ftp://example.com", "", true},
		{"embedded credentials", "https://user:pass@example.com", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := normalizeUpstreamConsoleBaseURL(tt.raw)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.want, got.String())
		})
	}
}

func TestFetchUpstreamConsoleCatalogNotConfiguredFallsBack(t *testing.T) {
	// No credentials: must return a clean not_configured result with NO error,
	// so the caller keeps the primary API Key + base_url result.
	for _, creds := range []struct {
		url, user, pass string
	}{
		{"", "user", "pass"},
		{"https://console.example.com", "", "pass"},
		{"https://console.example.com", "user", ""},
	} {
		result, err := FetchUpstreamConsoleCatalog(context.Background(), creds.url, creds.user, creds.pass)
		require.NoError(t, err)
		require.Equal(t, ConsoleStatusNotConfigured, result.Status)
		require.False(t, result.LoginSucceeded)
		require.Empty(t, result.Models)
		require.Empty(t, result.Prices)
	}
}

func TestFetchUpstreamConsoleCatalogRejectsBailianConsoleProtocol(t *testing.T) {
	// 阿里云百炼官网使用阿里云账号/SSO，不支持 New API 的 /api/user/login
	// 协议。不能继续发注定失败的请求，更不能把失败笼统报成"密码错误"。
	result, err := FetchUpstreamConsoleCatalog(
		context.Background(),
		"https://bailian.console.aliyun.com/cn-beijing/model/market",
		"operator",
		"password",
	)
	require.NoError(t, err)
	require.Equal(t, ConsoleStatusUnsupported, result.Status)
	require.False(t, result.LoginSucceeded)
	require.NotEmpty(t, result.Warnings)
	require.Contains(t, result.Warnings[0], "workspace endpoint")
}

func TestFetchUpstreamConsoleCatalogBlocksSSRF(t *testing.T) {
	// A private/loopback target must be rejected before any login request.
	result, err := FetchUpstreamConsoleCatalog(
		context.Background(), "http://127.0.0.1:8080", "user", "pass")
	require.Error(t, err)
	require.Equal(t, ConsoleStatusLoginFailed, result.Status)
}

func TestParseConsoleModels(t *testing.T) {
	body := []byte(`{"success":true,"data":[
		"gpt-4o",
		{"model":"claude-3"},
		{"id":"gemini-pro"},
		"gpt-4o",
		"",
		{"name":"llama-3"}
	]}`)
	models := parseConsoleModels(body)
	require.Equal(t, []string{"gpt-4o", "claude-3", "gemini-pro", "llama-3"}, models)
}

func TestParseConsoleModelsBareArrayAndInvalid(t *testing.T) {
	require.Equal(t, []string{"a", "b"}, parseConsoleModels([]byte(`["a","b"]`)))
	require.Empty(t, parseConsoleModels([]byte(`not json`)))
	require.Empty(t, parseConsoleModels([]byte(`{"data":{}}`)))
}

func TestParseConsolePrices(t *testing.T) {
	body := []byte(`{"data":[
		{"model":"gpt-4o","input_price":2.5,"output_price":10,"currency":"USD"},
		{"model_name":"claude-3","prompt_price":"3","completion_price":"15"}
	]}`)
	prices := parseConsolePrices(body)
	require.Len(t, prices, 2)
	require.Equal(t, "gpt-4o", prices[0].Model)
	require.InDelta(t, 2.5, prices[0].InputPrice, 0.0001)
	require.InDelta(t, 10, prices[0].OutputPrice, 0.0001)
	require.Equal(t, "USD", prices[0].Currency)
	require.Equal(t, "claude-3", prices[1].Model)
	require.InDelta(t, 3, prices[1].InputPrice, 0.0001)
}

func TestExtractToken(t *testing.T) {
	require.Equal(t, "abc", extractToken("abc"))
	require.Equal(t, "bearer", extractToken(map[string]any{"token": "bearer"}))
	require.Equal(t, "", extractToken(map[string]any{"other": 1}))
}

func allowLoopbackConsoleTest(t *testing.T) {
	t.Helper()
	fetchSetting := system_setting.GetFetchSetting()
	original := *fetchSetting
	t.Cleanup(func() { *fetchSetting = original })
	fetchSetting.EnableSSRFProtection = false
	InitHttpClient()
}

func newConsoleTestRSAKey(t *testing.T) (*rsa.PrivateKey, string) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	der, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	require.NoError(t, err)
	return key, string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: der}))
}

func TestFetchUpstreamConsoleCatalogUsesEncryptedPassword(t *testing.T) {
	allowLoopbackConsoleTest(t)
	privateKey, publicKey := newConsoleTestRSAKey(t)
	const password = "console-password"
	loginSeen := false

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case upstreamEncryptionKeyPath:
			_ = json.NewEncoder(w).Encode(map[string]any{
				"success": true,
				"data": map[string]any{
					"enabled":    true,
					"kid":        "kid-1",
					"public_key": publicKey,
				},
			})
		case "/api/user/login":
			require.Equal(t, "turnstile=", r.URL.RawQuery)
			var body map[string]string
			require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
			require.Equal(t, "operator", body["username"])
			require.Empty(t, body["password"])
			require.Equal(t, "kid-1", body["encryption_key_id"])
			raw, err := base64.StdEncoding.DecodeString(body["password_encrypted"])
			require.NoError(t, err)
			plain, err := rsa.DecryptOAEP(sha256.New(), rand.Reader, privateKey, raw, nil)
			require.NoError(t, err)
			require.Equal(t, password, string(plain))
			loginSeen = true
			_ = json.NewEncoder(w).Encode(map[string]any{
				"success": true,
				"data":    map[string]any{"token": "token-1"},
			})
		case "/api/models":
			_, _ = w.Write([]byte(`{"data":["gpt-4o"]}`))
		case "/api/pricing":
			_, _ = w.Write([]byte(`{"data":[{"model":"gpt-4o","input_price":2.5}]}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	result, err := FetchUpstreamConsoleCatalog(context.Background(), server.URL, "operator", password)
	require.NoError(t, err)
	require.Equal(t, ConsoleStatusSuccess, result.Status)
	require.True(t, loginSeen)
	require.Equal(t, []string{"gpt-4o"}, result.Models)
	require.Len(t, result.Prices, 1)
}

func TestFetchUpstreamConsoleCatalogFallsBackToPlaintextPassword(t *testing.T) {
	allowLoopbackConsoleTest(t)
	loginSeen := false

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case upstreamEncryptionKeyPath:
			w.WriteHeader(http.StatusNotFound)
		case "/api/user/login":
			var body map[string]string
			require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
			require.Equal(t, "plain-password", body["password"])
			require.Empty(t, body["password_encrypted"])
			loginSeen = true
			_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "data": "token"})
		default:
			_, _ = w.Write([]byte(`{"data":[]}`))
		}
	}))
	defer server.Close()

	result, err := FetchUpstreamConsoleCatalog(context.Background(), server.URL, "operator", "plain-password")
	require.NoError(t, err)
	require.Equal(t, ConsoleStatusSuccess, result.Status)
	require.True(t, loginSeen)
}

func TestEncryptUpstreamPasswordHybridEnvelope(t *testing.T) {
	privateKey, publicKey := newConsoleTestRSAKey(t)
	password := strings.Repeat("long-password-", 40)

	envelope, err := encryptUpstreamPassword(password, publicKey, "kid-2")
	require.NoError(t, err)
	parts := strings.Split(envelope, ".")
	require.Len(t, parts, 4)
	require.Equal(t, upstreamPasswordV2Label, parts[0])

	wrappedKey, err := base64.StdEncoding.DecodeString(parts[1])
	require.NoError(t, err)
	iv, err := base64.StdEncoding.DecodeString(parts[2])
	require.NoError(t, err)
	sealed, err := base64.StdEncoding.DecodeString(parts[3])
	require.NoError(t, err)

	aesKey, err := rsa.DecryptOAEP(sha256.New(), rand.Reader, privateKey, wrappedKey, []byte(upstreamPasswordV2Label))
	require.NoError(t, err)
	block, err := aes.NewCipher(aesKey)
	require.NoError(t, err)
	gcm, err := cipher.NewGCM(block)
	require.NoError(t, err)
	plain, err := gcm.Open(nil, iv, sealed, []byte(upstreamPasswordV2Label+":kid-2"))
	require.NoError(t, err)
	require.Equal(t, password, string(plain))
}
