package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
)

func TestFetchUpstreamRatiosUsesApikoPublicCatalogue(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/public/models" {
			http.NotFound(writer, request)
			return
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"code":0,"message":"ok","data":{"total":2,"models":[
			{"id":"apiko-chat-test","provider":"openai","capabilities":["chat"],
			 "pricing":{"inputPer1M":1.25,"outputPer1M":5,"cachePer1M":0.125,"perCall":null,"tiers":[],"contextTiers":[],"currency":"USD"}},
			{"id":"apiko-video-test","provider":"google","capabilities":["video"],
			 "pricing":{"inputPer1M":null,"outputPer1M":null,"cachePer1M":null,"perCall":null,"tiers":[],"contextTiers":[],"perSecondTiers":[{"name":"720p 4s","perSecond":0.07}],"currency":"USD"}}
		]}}`))
	}))
	t.Cleanup(server.Close)

	previous := apikoControlPlaneBase
	apikoControlPlaneBase = server.URL
	t.Cleanup(func() { apikoControlPlaneBase = previous })

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/ratio_sync/fetch",
		strings.NewReader(`{"upstreams":[{"name":"apiko","base_url":"https://api.apiko.app"}],"timeout":10}`),
	)
	context.Request.Header.Set("Content-Type", "application/json")

	FetchUpstreamRatios(context)

	var response struct {
		Success bool `json:"success"`
		Data    struct {
			TestResults []struct {
				Name   string `json:"name"`
				Status string `json:"status"`
				Error  string `json:"error"`
			} `json:"test_results"`
			Prices map[string]struct {
				Upstreams map[string]map[string]any `json:"upstreams"`
			} `json:"prices"`
			SkippedModels []struct {
				Upstream string `json:"upstream"`
				Model    string `json:"model"`
				Reason   string `json:"reason"`
			} `json:"skipped_models"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Len(t, response.Data.TestResults, 1)
	assert.Equal(t, "error", response.Data.TestResults[0].Status)
	assert.Contains(t, response.Data.TestResults[0].Error, "channel-scoped")
	assert.Empty(t, response.Data.Prices, "Apiko must not write global model prices")
}
