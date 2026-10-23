package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	relaycommon "github.com/uter-ai/uter/relay/common"
	relayconstant "github.com/uter-ai/uter/relay/constant"
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/uter-ai/uter/relaykit/types"

	"github.com/gin-gonic/gin"
)

// mustChunk 把 SSE 原文解析成 observeStreamChoices 需要的 chunk 结构。
func mustChunk(t *testing.T, data string) *dto.ChatCompletionsStreamResponse {
	t.Helper()
	var chunk dto.ChatCompletionsStreamResponse
	require.NoError(t, common.UnmarshalJsonStr(data, &chunk))
	return &chunk
}

func TestObserveStreamChoicesDedupesFunctionCallNames(t *testing.T) {
	info := &relaycommon.RelayInfo{StreamStatus: relaycommon.NewStreamStatus()}
	seen := make(map[string]struct{})
	var names []string

	chunks := []string{
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"c1","type":"function","function":{"name":"get_weather","arguments":""}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"q\":"}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"x\"}"}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":1,"id":"c2","type":"function","function":{"name":"get_time","arguments":""}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":1,"function":{"arguments":"{}"}}]}}]}`,
	}
	for _, chunk := range chunks {
		observeStreamChoices(info, mustChunk(t, chunk), seen, &names)
	}

	require.Len(t, names, 2)
	assert.Equal(t, []string{"get_weather", "get_time"}, names)
	assert.Empty(t, info.StreamStatus.ResponseOutcome(), "tool call deltas carry no finish reason")

	observeStreamChoices(info, mustChunk(t, `{"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`), seen, &names)
	assert.Equal(t, "completed", info.StreamStatus.ResponseOutcome())
	assert.False(t, info.PerformanceBusinessRejection)

	filtered := &relaycommon.RelayInfo{StreamStatus: relaycommon.NewStreamStatus()}
	observeStreamChoices(filtered, mustChunk(t, `{"choices":[{"index":0,"delta":{},"finish_reason":"content_filter"}]}`), map[string]struct{}{}, &names)
	assert.True(t, filtered.PerformanceBusinessRejection)
}

// TestOaiStreamHandlerAccumulatesTextFromSingleParse 守住「一个 chunk 只解析一次」的
// 重构：文本增量仍要累加进 responseTextBuilder（否则上游不给 usage 时估算用量为 0），
// 响应模型仍要被观察。
func TestOaiStreamHandlerAccumulatesTextFromSingleParse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = previousTimeout })

	body := "data: " + `{"id":"c1","model":"returned","choices":[{"index":0,"delta":{"role":"assistant","content":"hello world"}}]}` + "\n\n" +
		"data: " + `{"id":"c1","model":"returned","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}` + "\n\n" +
		"data: [DONE]\n\n"

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{
		OriginModelName: "requested", RelayFormat: types.RelayFormatOpenAI, RelayMode: relayconstant.RelayModeChatCompletions,
		IsStream: true, DisablePing: true, StartTime: time.Now(),
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "mapped"},
	}
	usage, apiErr := OaiStreamHandler(c, info, &http.Response{
		StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body)),
	})
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Greater(t, usage.CompletionTokens, 0, "流式文本增量应被累加，估算用量不能为 0")
	require.NotNil(t, info.ResponseModel)
	assert.Equal(t, "returned", info.ResponseModel.ReturnedModel)
}
