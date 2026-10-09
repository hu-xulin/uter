package service

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
)

// The upstream address is chosen by a channel admin, so response headers are
// untrusted input: cookie and auth headers belong to the upstream origin and
// must never be replayed under the gateway's own domain.
func TestShouldCopyUpstreamHeaderBlocksCredentialAndHopHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	blocked := []string{
		"Set-Cookie",
		"set-cookie2",
		"Authorization",
		"WWW-Authenticate",
		"Proxy-Authenticate",
		"Proxy-Authorization",
		"Connection",
		"Keep-Alive",
		"Transfer-Encoding",
		"TE",
		"Trailer",
		"Upgrade",
		"Content-Encoding",
		"Content-Length",
	}
	for _, header := range blocked {
		if ShouldCopyUpstreamHeader(nil, header, []string{"v"}) {
			t.Errorf("upstream header %q must not reach the client", header)
		}
	}
}

func TestShouldCopyUpstreamHeaderKeepsPayloadHeaders(t *testing.T) {
	for _, header := range []string{"Content-Type", "X-Request-Id", "Openai-Organization"} {
		if !ShouldCopyUpstreamHeader(nil, header, []string{"v"}) {
			t.Errorf("upstream header %q should reach the client", header)
		}
	}
}

// The instance's own request id must survive; the upstream one is captured
// separately for logging instead of overwriting it.
func TestShouldCopyUpstreamHeaderCapturesUpstreamRequestId(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	if ShouldCopyUpstreamHeader(c, common.RequestIdKey, []string{"req-42"}) {
		t.Fatal("upstream must not overwrite the local request id header")
	}
	if got := c.GetString(common.UpstreamRequestIdKey); got != "req-42" {
		t.Fatalf("upstream request id = %q, want %q", got, "req-42")
	}
}
