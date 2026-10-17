package controller

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/setting/system_setting"
)

func TestValidateTaskMediaProxyTargetPreventsProxyDNSBypass(t *testing.T) {
	fetchSetting := &system_setting.FetchSetting{
		EnableSSRFProtection:   true,
		ApplyIPFilterForDomain: true,
	}

	require.Error(t, validateTaskMediaProxyTarget("https://example.com/video.mp4", "http://proxy.example:8080", fetchSetting))
	require.NoError(t, validateTaskMediaProxyTarget("https://93.184.216.34/video.mp4", "http://proxy.example:8080", fetchSetting))
	require.NoError(t, validateTaskMediaProxyTarget("https://example.com/video.mp4", "", fetchSetting))
	require.NoError(t, validateTaskMediaProxyTarget("https://example.com/video.mp4", "http://proxy.example:8080", &system_setting.FetchSetting{EnableSSRFProtection: false, ApplyIPFilterForDomain: true}))
	require.Error(t, validateTaskMediaProxyTarget("https://example.com/video.mp4", "http://proxy.example:8080", &system_setting.FetchSetting{EnableSSRFProtection: true, ApplyIPFilterForDomain: false, AllowPrivateIp: false}))
	require.NoError(t, validateTaskMediaProxyTarget("https://example.com/video.mp4", "http://proxy.example:8080", &system_setting.FetchSetting{EnableSSRFProtection: true, ApplyIPFilterForDomain: false, AllowPrivateIp: true}))
}


func TestTaskMediaRedirectClientDoesNotForwardClientHeadersAcrossOrigins(t *testing.T) {
	fetchSetting := system_setting.GetFetchSetting()
	original := *fetchSetting
	t.Cleanup(func() { *fetchSetting = original })
	fetchSetting.EnableSSRFProtection = false

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "https://api.example.com/v1/videos/task-1/content", nil)

	sourceURL, err := url.Parse("https://api.example.com/original.mp4")
	require.NoError(t, err)
	crossOriginURL, err := url.Parse("https://cdn.example.net/redirected.mp4")
	require.NoError(t, err)
	sameOriginURL, err := url.Parse("https://api.example.com/redirected.mp4")
	require.NoError(t, err)

	clientHeaders := map[string]string{
		"Range":            "bytes=0-1023",
		"If-None-Match":    "\"client-etag\"",
	}
	client := taskMediaRedirectClient(&http.Client{}, "", c, clientHeaders, true)

	crossOriginRequest := &http.Request{URL: crossOriginURL, Header: make(http.Header)}
	require.NoError(t, client.CheckRedirect(crossOriginRequest, []*http.Request{{URL: sourceURL}}))
	require.Empty(t, crossOriginRequest.Header.Get("Range"))
	require.Empty(t, crossOriginRequest.Header.Get("If-None-Match"))

	sameOriginRequest := &http.Request{URL: sameOriginURL, Header: make(http.Header)}
	require.NoError(t, client.CheckRedirect(sameOriginRequest, []*http.Request{{URL: sourceURL}}))
	require.Equal(t, "bytes=0-1023", sameOriginRequest.Header.Get("Range"))
	require.Equal(t, "\"client-etag\"", sameOriginRequest.Header.Get("If-None-Match"))
}
