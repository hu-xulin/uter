package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Uter-AI/Uter/common"
	"github.com/Uter-AI/Uter/setting"
	"github.com/gin-gonic/gin"
)

// TestFetchTaskPluginMarketplaceIndexProxiesConfiguredSource proves the
// browser no longer fetches the index cross-origin. The gateway follows only
// URLs that are already configured marketplace sources (SSRF guard) and returns
// the parsed index to the same-origin caller.
func TestFetchTaskPluginMarketplaceIndexProxiesConfiguredSource(t *testing.T) {
	gin.SetMode(gin.TestMode)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"indexVersion": 1,
			"name":         "Local",
			"plugins":      []any{},
		})
	}))
	defer upstream.Close()

	// Register the upstream as a configured marketplace source for the test.
	src := []setting.TaskPluginMarketplaceSource{
		{Name: "Local", IndexURL: upstream.URL},
	}
	raw, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshal sources: %v", err)
	}
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	prev, had := common.OptionMap[setting.TaskPluginMarketplaceSourcesKey]
	common.OptionMap[setting.TaskPluginMarketplaceSourcesKey] = string(raw)
	common.OptionMapRWMutex.Unlock()
	defer func() {
		common.OptionMapRWMutex.Lock()
		if had {
			common.OptionMap[setting.TaskPluginMarketplaceSourcesKey] = prev
		} else {
			delete(common.OptionMap, setting.TaskPluginMarketplaceSourcesKey)
		}
		common.OptionMapRWMutex.Unlock()
	}()

	// 1) Configured source is proxied and the parsed index is returned.
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(
		http.MethodGet,
		"/api/plugin/task/marketplace/fetch?url="+upstream.URL,
		nil,
	)
	FetchTaskPluginMarketplaceIndex(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for configured source, got %d body=%s", w.Code, w.Body.String())
	}
	var ok struct {
		Success bool `json:"success"`
		Data    struct {
			Name string `json:"name"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &ok); err != nil {
		t.Fatalf("invalid response json: %v body=%s", err, w.Body.String())
	}
	if !ok.Success || ok.Data.Name != "Local" {
		t.Fatalf("unexpected response: %s", w.Body.String())
	}

	// 2) Unconfigured URL must be rejected by the SSRF guard. new-api error
	// helpers respond with HTTP 200 + success:false, so assert on the body.
	w2 := httptest.NewRecorder()
	c2, _ := gin.CreateTestContext(w2)
	c2.Request = httptest.NewRequest(
		http.MethodGet,
		"/api/plugin/task/marketplace/fetch?url=https://evil.example.com/index.json",
		nil,
	)
	FetchTaskPluginMarketplaceIndex(c2)
	var rejected struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(w2.Body.Bytes(), &rejected); err != nil {
		t.Fatalf("invalid response json: %v body=%s", err, w2.Body.String())
	}
	if rejected.Success {
		t.Fatalf("expected success:false for unconfigured url, got %s", w2.Body.String())
	}
	if !contains(rejected.Message, "not a configured source") {
		t.Fatalf("expected SSRF-rejection message, got %q", rejected.Message)
	}
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || indexOf(s, sub) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
