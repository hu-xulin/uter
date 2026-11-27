package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestUpstreamMonitorCoversDocumentDimensions verifies that a standard-depth
// run reports all eleven document dimensions plus the three monitor-only ones,
// with weights summing to 100 and skipped dimensions excluded from scoring.
func TestUpstreamMonitorCoversDocumentDimensions(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/models"):
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"data":[{"id":"test-model"}]}`))
		case strings.HasSuffix(r.URL.Path, "/chat/completions"):
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"391"},"finish_reason":"stop"}],"usage":{"prompt_tokens":8,"completion_tokens":2,"total_tokens":10}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	result := RunUpstreamMonitor(context.Background(), UpstreamProbeConfig{
		BaseURL: server.URL + "/v1", APIKey: "sk-test", Model: "test-model",
		Protocol: UpstreamProtocolOpenAI, Depth: UpstreamDepthStandard, Timeout: 5 * time.Second,
	})

	want := []string{
		DimensionConnectivity, DimensionAvailability, DimensionBasicChat,
		DimensionCapabilities, DimensionStreaming, DimensionLatency,
		DimensionStability, DimensionBilling, DimensionErrors,
		DimensionAsyncTask, DimensionObservability, DimensionIdentity,
		DimensionSecurity, DimensionConsistency,
	}
	got := make(map[string]bool, len(result.Dimensions))
	weightSum := 0
	for _, dim := range result.Dimensions {
		got[dim.Key] = true
		weightSum += dim.Weight
	}
	for _, key := range want {
		assert.True(t, got[key], "missing dimension %s", key)
	}
	assert.Len(t, result.Dimensions, len(want))
	assert.Equal(t, 100, weightSum, "dimension weights must sum to 100")
}

// TestReconcileBillingStaticFallback verifies the fail-closed static mode when
// no probe token is configured: no Uter deduction is claimed.
func TestReconcileBillingStaticFallback(t *testing.T) {
	recon := reconcileBilling(context.Background(), UpstreamProbeConfig{
		Model: "test-model",
	}, 8, 2, 2)
	assert.Equal(t, "static", recon.Mode)
	assert.Empty(t, recon.UterRequestID)
	assert.False(t, recon.Match)
	assert.Contains(t, recon.Notes, "not verified")
}

func TestWithinTolerance(t *testing.T) {
	assert.True(t, withinTolerance(100, 100))
	assert.True(t, withinTolerance(102, 100), "5% tolerance allows small variance")
	assert.False(t, withinTolerance(130, 100), "30% drift must fail")
	assert.True(t, withinTolerance(0, 0))
}

// TestStreamingDoneMarked verifies the SSE [DONE] terminator is detected.
func TestStreamingDoneMarked(t *testing.T) {
	chat := &upstreamChatResponse{}
	body := "data: {\"choices\":[{\"delta\":{\"content\":\"你\"},\"finish_reason\":null}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"好\"},\"finish_reason\":null}]}\n\ndata: [DONE]\n\n"
	err := parseUpstreamSSE(strings.NewReader(body), UpstreamProtocolOpenAI, time.Now(), chat)
	require.NoError(t, err)
	assert.Equal(t, 2, chat.Chunks)
	assert.True(t, chat.SSEEnded)
}

// TestNonChatModelFullDepthRunsTaskProbe verifies the async-task dimension is
// actively probed (not skipped wholesale) at full depth for a task model.
func TestNonChatModelFullDepthRunsTaskProbe(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/models"):
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"data":[{"id":"wan-video"}]}`))
		case strings.HasSuffix(r.URL.Path, "/chat/completions"):
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"error":{"message":"not found"}}`))
		case strings.HasSuffix(r.URL.Path, "/videos"):
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"id":"task-123"}`))
		case strings.Contains(r.URL.Path, "/videos/task-123"):
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"status":"succeeded"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	result := RunUpstreamMonitor(context.Background(), UpstreamProbeConfig{
		BaseURL: server.URL + "/v1", APIKey: "sk-test", Model: "wan-video",
		Protocol: UpstreamProtocolOpenAI, Depth: UpstreamDepthFull, Timeout: 10 * time.Second,
	})
	require.NotNil(t, result.AsyncTask)
	assert.True(t, result.AsyncTask.Applicable, "task model must be recognized")
	assert.True(t, result.AsyncTask.Submitted, "full depth must submit the task")
	var asyncDim *UpstreamDimension
	for i := range result.Dimensions {
		if result.Dimensions[i].Key == DimensionAsyncTask {
			asyncDim = &result.Dimensions[i]
		}
	}
	require.NotNil(t, asyncDim)
	assert.False(t, asyncDim.Skipped, "async task dimension must be active at full depth")
}
