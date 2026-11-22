package service

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMatchesUpstreamHost(t *testing.T) {
	testCases := []struct {
		name string
		url  string
		want bool
	}{
		{"exact host", "https://dreamrouter.ai", true},
		{"subdomain", "https://api.dreamrouter.ai/v1", true},
		{"uppercase and trailing dot", "https://API.DreamRouter.AI./v1", true},
		{"bare host", "dreamrouter.ai", true},
		{"lookalike suffix", "https://dreamrouter.ai.evil.example", false},
		{"lookalike prefix", "https://evil-dreamrouter.ai", false},
		{"other host", "https://api.example.com", false},
		{"empty", "", false},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			assert.Equal(t, testCase.want, MatchesUpstreamHost(testCase.url, "dreamrouter.ai"))
			assert.Equal(t, testCase.want, IsDreamRouterHost(testCase.url))
		})
	}
}

func TestBailianHostMatching(t *testing.T) {
	assert.True(t, IsBailianHost("https://dashscope.aliyuncs.com"))
	assert.True(t, IsBailianHost("https://dashscope-intl.aliyuncs.com/compatible-mode/v1"))
	assert.True(t, IsBailianHost("https://ws-1.cn-beijing.maas.aliyuncs.com"))
	assert.False(t, IsBailianHost("https://aliyuncs.com"))
	assert.False(t, IsBailianHost("https://dashscope.aliyuncs.com.evil.example"))
}

func TestManualUpstreamProviderForHost(t *testing.T) {
	testCases := map[string]string{
		"https://api.openai.com/v1":                              "openai",
		"https://api.anthropic.com":                              "anthropic",
		"https://generativelanguage.googleapis.com":              "google-gemini",
		"https://my-resource.openai.azure.com":                   "microsoft-azure",
		"https://bedrock-runtime.us-east-1.amazonaws.com":        "aws-bedrock",
		"https://hunyuan.tencentcloudapi.com":                    "tencent-hunyuan",
		"https://ark.cn-beijing.volces.com/api/v3":               "volcengine",
		"https://api.example.com":                                "",
		"https://api.openai.com.evil.example":                    "",
		"https://generativelanguage.googleapis.com.evil.example": "",
	}
	for raw, want := range testCases {
		assert.Equal(t, want, manualUpstreamProviderForHost(raw), raw)
	}
}

func TestValidateUpstreamEndpoint(t *testing.T) {
	valid := []string{
		"https://dashscope.aliyuncs.com/api/v1/models",
		"http://127.0.0.1:8080/api/pricing",
		"http://192.168.1.10/api/pricing",
	}
	for _, raw := range valid {
		_, err := validateUpstreamEndpoint(raw)
		assert.NoError(t, err, raw)
	}

	invalid := []string{
		"ftp://example.com/pricing",
		"file:///etc/passwd",
		"https://user:secret@example.com/pricing",
		"http://169.254.169.254/latest/meta-data/",
		"http://metadata.google.internal/computeMetadata/v1/",
		"http://100.100.100.200/latest/meta-data/",
		"http://[fe80::1]/pricing",
		"http://0.0.0.0/pricing",
	}
	for _, raw := range invalid {
		_, err := validateUpstreamEndpoint(raw)
		assert.Error(t, err, raw)
	}
}

func TestUpstreamHTTPClientAllowsSameHostRedirect(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/start" {
			http.Redirect(w, r, "/target", http.StatusFound)
			return
		}
		_, _ = io.WriteString(w, "ok")
	}))
	defer server.Close()

	client := newUpstreamHTTPClient(5 * time.Second)
	resp, err := client.Get(server.URL + "/start")
	require.NoError(t, err)
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	assert.Equal(t, "ok", string(body))
}

func TestUpstreamHTTPClientRejectsCrossHostRedirect(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "internal")
	}))
	defer target.Close()
	redirector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, strings.Replace(target.URL, "127.0.0.1", "localhost", 1), http.StatusFound)
	}))
	defer redirector.Close()

	client := newUpstreamHTTPClient(5 * time.Second)
	resp, err := client.Get(redirector.URL)
	if resp != nil {
		resp.Body.Close()
	}
	require.Error(t, err)
	assert.Contains(t, err.Error(), "redirect changed host")
}

func TestUpstreamHTTPClientBlocksMetadataAddress(t *testing.T) {
	client := newUpstreamHTTPClient(3 * time.Second)
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "http://169.254.169.254/latest/meta-data/", nil)
	require.NoError(t, err)
	resp, err := client.Do(req)
	if resp != nil {
		resp.Body.Close()
	}
	require.Error(t, err)
	assert.Contains(t, err.Error(), "blocked address")
}

// 请求级拦截不依赖代理/拨号环境：元数据地址在 RoundTrip 之前就必须被拒绝。
func TestUpstreamGuardTransportRejectsMetadataBeforeDial(t *testing.T) {
	called := false
	transport := upstreamGuardTransport{next: roundTripFunc(func(*http.Request) (*http.Response, error) {
		called = true
		return nil, nil
	})}
	req, err := http.NewRequest(http.MethodGet, "http://169.254.169.254/latest/meta-data/", nil)
	require.NoError(t, err)
	_, err = transport.RoundTrip(req)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "blocked address")
	assert.False(t, called, "the guarded transport must not reach the proxy/dialer")
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) { return f(req) }
