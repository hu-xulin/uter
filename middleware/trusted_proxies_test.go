package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func requestClientIP(router http.Handler, remoteAddr string, forwardedFor string) string {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/client-ip", nil)
	request.RemoteAddr = remoteAddr
	if forwardedFor != "" {
		request.Header.Set("X-Forwarded-For", forwardedFor)
	}
	router.ServeHTTP(recorder, request)
	return recorder.Body.String()
}

func newClientIPRouter() *gin.Engine {
	router := gin.New()
	router.GET("/client-ip", func(c *gin.Context) {
		c.String(http.StatusOK, c.ClientIP())
	})
	return router
}

func TestConfigureTrustedProxiesDefaultsToLoopbackOnly(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("TRUSTED_PROXIES", "")
	router := newClientIPRouter()
	require.NoError(t, ConfigureTrustedProxies(router))

	trustedLoopback := []struct {
		name       string
		remoteAddr string
	}{
		{name: "IPv4 loopback", remoteAddr: "127.0.0.1:12345"},
		{name: "IPv6 loopback", remoteAddr: "[::1]:12345"},
	}
	for _, testCase := range trustedLoopback {
		t.Run(testCase.name+" trusts forwarded header", func(t *testing.T) {
			clientIP := requestClientIP(router, testCase.remoteAddr, "203.0.113.10")
			assert.Equal(t, "203.0.113.10", clientIP)
		})
	}

	// 容器 / K8s 部署下应用与客户端往往同处 10.x / 172.16.x / 192.168.x /
	// fd00::/8。若默认信任这些网段，同网段任意请求方构造一个 X-Forwarded-For
	// 就能让 ClientIP() 每次返回不同值，从而击穿三处安全控制：按 IP 计的
	// 登录/验证码限流、Token 的 allow_ips 白名单、审计日志记录的 ip。
	// 因此默认只信任回环；反代部署必须显式配置 TRUSTED_PROXIES。
	untrustedPrivateNetworks := []struct {
		name       string
		remoteAddr string
		want       string
	}{
		{name: "10 private network", remoteAddr: "10.20.30.40:12345", want: "10.20.30.40"},
		{name: "172 private network", remoteAddr: "172.20.0.2:12345", want: "172.20.0.2"},
		{name: "192 private network", remoteAddr: "192.168.10.2:12345", want: "192.168.10.2"},
		{name: "IPv6 unique local network", remoteAddr: "[fd12:3456::2]:12345", want: "fd12:3456::2"},
	}
	for _, testCase := range untrustedPrivateNetworks {
		t.Run(testCase.name+" must not trust forwarded header", func(t *testing.T) {
			clientIP := requestClientIP(router, testCase.remoteAddr, "203.0.113.10")
			assert.Equal(t, testCase.want, clientIP, "a private-network peer must not make a spoofed X-Forwarded-For authoritative")
		})
	}
}

func TestConfigureTrustedProxiesDefaultRejectsPublicPeerHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("TRUSTED_PROXIES", " \t ")
	router := newClientIPRouter()
	require.NoError(t, ConfigureTrustedProxies(router))

	clientIP := requestClientIP(router, "198.51.100.10:12345", "203.0.113.10")
	assert.Equal(t, "198.51.100.10", clientIP, "a public peer must not make a spoofed X-Forwarded-For authoritative")
}

func TestConfigureTrustedProxiesDefaultStopsAtPublicClientInForwardedChain(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("TRUSTED_PROXIES", "")
	router := newClientIPRouter()
	require.NoError(t, ConfigureTrustedProxies(router))

	// 直连方必须是可信代理（回环）才会解析 X-Forwarded-For；链上从右往左
	// 第一个非可信地址胜出，客户端伪造的前缀（192.0.2.99）被忽略。
	clientIP := requestClientIP(router, "127.0.0.1:12345", "192.0.2.99, 203.0.113.10")
	assert.Equal(t, "203.0.113.10", clientIP, "the first public hop from the trusted proxy must win over a client-supplied prefix")
}

func TestConfigureTrustedProxiesNoneDisablesForwardedHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("TRUSTED_PROXIES", " NoNe ")
	router := newClientIPRouter()
	require.NoError(t, ConfigureTrustedProxies(router))

	clientIP := requestClientIP(router, "127.0.0.1:12345", "203.0.113.10")
	assert.Equal(t, "127.0.0.1", clientIP)
}

func TestConfigureTrustedProxiesAcceptsTrimmedIPsAndCIDRs(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("TRUSTED_PROXIES", " 192.0.2.0/24, 198.51.100.30 ")
	router := newClientIPRouter()
	require.NoError(t, ConfigureTrustedProxies(router))

	trustedClientIP := requestClientIP(router, "192.0.2.10:12345", "203.0.113.20")
	assert.Equal(t, "203.0.113.20", trustedClientIP)

	trustedExactIP := requestClientIP(router, "198.51.100.30:12345", "203.0.113.21")
	assert.Equal(t, "203.0.113.21", trustedExactIP)

	untrustedClientIP := requestClientIP(router, "198.51.100.20:12345", "203.0.113.22")
	assert.Equal(t, "198.51.100.20", untrustedClientIP)

	defaultProxyIP := requestClientIP(router, "127.0.0.1:12345", "203.0.113.23")
	assert.Equal(t, "127.0.0.1", defaultProxyIP, "an explicit list must replace, not extend, the compatibility defaults")
}

func TestConfigureTrustedProxiesRejectsInvalidConfiguration(t *testing.T) {
	gin.SetMode(gin.TestMode)
	testCases := []struct {
		name  string
		value string
	}{
		{name: "no entries", value: ", ,"},
		{name: "invalid entry", value: "not-an-ip"},
		{name: "mixed valid and invalid entries", value: "127.0.0.1, not-an-ip"},
		{name: "none mixed with valid entry", value: "none,127.0.0.1"},
		{name: "valid entry mixed with none", value: "127.0.0.1,NONE"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Setenv("TRUSTED_PROXIES", testCase.value)
			router := newClientIPRouter()
			assert.Error(t, ConfigureTrustedProxies(router))
		})
	}
}
