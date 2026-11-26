package service

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
)

func TestRunUpstreamMonitor_GoodEndpoint(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/models"):
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"data":[{"id":"test-model"}]}`))
		case strings.HasSuffix(r.URL.Path, "/chat/completions"):
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"391"},"finish_reason":"stop"}],"usage":{"prompt_tokens":12,"completion_tokens":2,"total_tokens":14}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	cfg := UpstreamProbeConfig{
		BaseURL: server.URL + "/v1", APIKey: "sk-test", Model: "test-model",
		Protocol: UpstreamProtocolOpenAI, Depth: UpstreamDepthStandard, Timeout: 5 * time.Second,
	}
	result := RunUpstreamMonitor(context.Background(), cfg)

	require.Len(t, result.Dimensions, 7)
	assert.True(t, result.Metrics.ModelsEndpointOK)
	assert.True(t, result.Metrics.ModelAdvertised)
	assert.Equal(t, http.StatusOK, result.Metrics.HTTPStatus)
	assert.Equal(t, 12, result.Metrics.ReportedPromptTokens)
	assert.Equal(t, "stop", result.Metrics.FinishReason)
	assert.NotEqual(t, UpstreamVerdictError, result.Verdict)
	assert.NotContains(t, result.HardGates, "upstream_unreachable")
}

func TestRunUpstreamMonitor_UnreachableEndpoint(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	}))
	defer server.Close()

	cfg := UpstreamProbeConfig{
		BaseURL: server.URL + "/v1", APIKey: "sk-test", Model: "test-model",
		Protocol: UpstreamProtocolOpenAI, Depth: UpstreamDepthQuick, Timeout: 5 * time.Second,
	}
	result := RunUpstreamMonitor(context.Background(), cfg)

	assert.Equal(t, UpstreamVerdictFail, result.Verdict)
	assert.Contains(t, result.HardGates, "upstream_unreachable")
	require.Len(t, result.Dimensions, 1)
	assert.Equal(t, "availability", result.Dimensions[0].Key)
	assert.Equal(t, 0, result.Dimensions[0].Score)
}

func TestUpstreamComputeThroughput(t *testing.T) {
	chat := &upstreamChatResponse{
		CompletionTokens: 20,
		TTFT:             100 * time.Millisecond,
		Duration:         1100 * time.Millisecond,
	}
	tpot, tps := upstreamComputeThroughput(chat)
	assert.Equal(t, 52.6, tpot) // (1100-100)/19
	assert.Equal(t, 18.2, tps)  // 20/1.1
}

func TestUpstreamEstimateTokensDetectsInflation(t *testing.T) {
	text := "这是一段用于估算 token 的中文文本，用于检测上游是否虚报用量。"
	estimate := upstreamEstimateTokens(text)
	assert.Greater(t, estimate, 0)
	assert.Less(t, estimate, 200, "估算应保守，不应接近虚报的上百倍")
}

func TestParseUpstreamSSEFrameOpenAI(t *testing.T) {
	delta, finish, usage, err := parseUpstreamSSEFrame(
		[]byte(`{"choices":[{"delta":{"content":"你好"},"finish_reason":null}]}`),
		UpstreamProtocolOpenAI,
	)
	require.NoError(t, err)
	assert.Equal(t, "你好", delta)
	assert.Empty(t, finish)
	assert.Nil(t, usage)

	_, finish, usage, err = parseUpstreamSSEFrame(
		[]byte(`{"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":3,"total_tokens":8}}`),
		UpstreamProtocolOpenAI,
	)
	require.NoError(t, err)
	assert.Equal(t, "stop", finish)
	require.Len(t, usage, 3)
	assert.Equal(t, []int{5, 3, 8}, usage)
}

func TestUpstreamModelAdvertised(t *testing.T) {
	ids := []string{"gpt-4o", "openrouter/anthropic/claude-sonnet"}
	assert.True(t, upstreamModelAdvertised(ids, "gpt-4o"))
	assert.True(t, upstreamModelAdvertised(ids, "claude-sonnet"))
	assert.False(t, upstreamModelAdvertised(ids, "nonexistent"))
	assert.False(t, upstreamModelAdvertised(nil, "gpt-4o"))
}

func TestFetchUpstreamModelsDeduplicatesAndSorts(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/v1/models", r.URL.Path)
		assert.Equal(t, "Bearer sk-test", r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"id":"zeta"},{"id":"alpha"},{"id":"zeta"},{"id":""}]}`))
	}))
	defer server.Close()

	models, err := FetchUpstreamModels(context.Background(), server.URL+"/v1", "sk-test", UpstreamProtocolOpenAI)
	require.NoError(t, err)
	assert.Equal(t, []string{"alpha", "zeta"}, models)
}

func TestUpstreamLatencyScore(t *testing.T) {
	cases := []struct {
		ttft int64
		want int
	}{
		{0, 0},
		{500, 100},
		{2000, 80},
		{5000, 55},
		{9000, 30},
		{20000, 10},
	}
	for _, tc := range cases {
		t.Run(fmt.Sprintf("ttft_%d", tc.ttft), func(t *testing.T) {
			assert.Equal(t, tc.want, upstreamLatencyScore(UpstreamMetrics{TTFTMs: tc.ttft}))
		})
	}
}

func TestFetchUpstreamModelsPrefersPricingCatalogueForUterRoute(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/pricing":
			// The public catalogue is authoritative and lists three models.
			_, _ = w.Write([]byte(`{"success":true,"pricing_version":"v1","data":[
				{"model_name":"zeta","vendor_id":1},
				{"model_name":"alpha","vendor_id":1},
				{"model_name":"middle","vendor_id":1}
			],"vendors":[]}`))
		case "/v1/models":
			// The key-scoped list only exposes a subset (two models).
			_, _ = w.Write([]byte(`{"data":[{"id":"alpha"},{"id":"zeta"}]}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	old := common.OptionMap
	common.OptionMap = map[string]string{UterRouteUpstreamURLOption: server.URL}
	t.Cleanup(func() { common.OptionMap = old })

	models, err := FetchUpstreamModels(context.Background(), server.URL, "sk-test", UpstreamProtocolOpenAI)
	require.NoError(t, err)
	assert.Equal(t, []string{"alpha", "middle", "zeta"}, models,
		"monitor discovery must match channel creation's full pricing catalogue")
}

func TestRunUpstreamMonitorNonChatModel404IsNotHardFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/models"):
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"data":[{"id":"wan-video"}]}`))
		case strings.HasSuffix(r.URL.Path, "/chat/completions"):
			// Video generators do not serve chat/completions.
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"error":{"message":"openai_error"}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	result := RunUpstreamMonitor(context.Background(), UpstreamProbeConfig{
		BaseURL:  server.URL + "/v1",
		APIKey:   "sk-test",
		Model:    "wan-video",
		Protocol: UpstreamProtocolOpenAI,
		Depth:    UpstreamDepthStandard,
		Timeout:  10 * time.Second,
	})
	assert.NotContains(t, result.HardGates, "upstream_unreachable",
		"a model without a chat endpoint must not be marked as an unreachable upstream")
	assert.NotEmpty(t, result.Dimensions)
	assert.Greater(t, result.Score, 0)
	skipped := false
	for _, probe := range result.Probes {
		if probe.Key == "availability.chat" && probe.Skipped {
			skipped = true
		}
	}
	assert.True(t, skipped, "chat probes should be explicitly skipped")
}
