package service

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strings"

	"github.com/uter-ai/uter/common"

	"github.com/uter-ai/uter/logger"

	"github.com/gin-gonic/gin"
)

func CloseResponseBodyGracefully(httpResponse *http.Response) {
	if httpResponse == nil || httpResponse.Body == nil {
		return
	}
	err := httpResponse.Body.Close()
	if err != nil {
		common.SysError("failed to close response body: " + err.Error())
	}
}

// upstreamHeadersNeverCopied are response headers that must never reach the
// client. They are either hop-by-hop/transport headers owned by the gateway's
// own connection, or credentials minted for the *upstream* host. The upstream
// address is chosen by a channel admin, so copying them verbatim would let an
// upstream plant cookies on the gateway domain (session fixation / credential
// confusion) or make the client treat an upstream 401 as the gateway's own.
var upstreamHeadersNeverCopied = []string{
	// hop-by-hop / transport, owned by the gateway connection
	"connection",
	"keep-alive",
	"transfer-encoding",
	"te",
	"trailer",
	"upgrade",
	// credentials scoped to the upstream origin
	"set-cookie",
	"set-cookie2",
	"authorization",
	"proxy-authenticate",
	"proxy-authorization",
	"www-authenticate",
	// the body we forward is already decoded and re-measured by the gateway
	"content-encoding",
	"content-length",
}

// ShouldCopyUpstreamHeader checks whether a given upstream response header
// should be copied to the client response. It returns false for the blocked
// list above and for X-Oneapi-Request-Id (to preserve the local instance ID).
// When the upstream header is X-Oneapi-Request-Id, the value is captured into
// the Gin context for later logging.
func ShouldCopyUpstreamHeader(c *gin.Context, k string, v []string) bool {
	if strings.EqualFold(k, common.RequestIdKey) {
		if c != nil && len(v) > 0 {
			c.Set(common.UpstreamRequestIdKey, v[0])
		}
		return false
	}
	return !slices.ContainsFunc(upstreamHeadersNeverCopied, func(blocked string) bool {
		return strings.EqualFold(k, blocked)
	})
}

func IOCopyBytesGracefully(c *gin.Context, src *http.Response, data []byte) {
	if c.Writer == nil {
		return
	}

	body := io.NopCloser(bytes.NewBuffer(data))

	// We shouldn't set the header before we parse the response body, because the parse part may fail.
	// And then we will have to send an error response, but in this case, the header has already been set.
	// So the httpClient will be confused by the response.
	// For example, Postman will report error, and we cannot check the response at all.
	if src != nil {
		for k, v := range src.Header {
			if !ShouldCopyUpstreamHeader(c, k, v) {
				continue
			}
			c.Writer.Header().Set(k, v[0])
		}
	}

	// set Content-Length header manually BEFORE calling WriteHeader
	c.Writer.Header().Set("Content-Length", fmt.Sprintf("%d", len(data)))

	// Write header with status code (this sends the headers)
	if src != nil {
		c.Writer.WriteHeader(src.StatusCode)
	} else {
		c.Writer.WriteHeader(http.StatusOK)
	}

	_, err := io.Copy(c.Writer, body)
	if err != nil {
		logger.LogError(c, fmt.Sprintf("failed to copy response body: %s", err.Error()))
	}
	c.Writer.Flush()
}
