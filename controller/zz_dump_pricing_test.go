package controller

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// TestDumpPricingSnapshot is a temporary diagnostic helper (not part of the
// suite). It dumps the real /api/pricing payload for a local database so the
// plaza rendering can be reproduced without logging in.
func TestDumpPricingSnapshot(t *testing.T) {
	if os.Getenv("DUMP_PRICING") == "" {
		t.Skip("diagnostic only")
	}
	common.SQLitePath = "/tmp/pdump/one-api.db"
	if err := model.InitDB(); err != nil {
		t.Fatalf("init db: %v", err)
	}
	model.InitOptionMap()

	// Warm both presets synchronously so the payload is not cold.
	GetPresetModelRatios(officialRatioPresetID)
	GetPresetModelRatios(modelsDevPresetID)

	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest("GET", "/api/pricing", nil)
	GetPricing(c)

	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	blob, _ := json.Marshal(payload)
	if err := os.WriteFile("/tmp/pdump/pricing_api.json", blob, 0o644); err != nil {
		t.Fatalf("write payload: %v", err)
	}
	data, _ := payload["data"].([]any)
	fmt.Printf("models=%d source=%v official=%d\n", len(data), payload["pricing_source"], len(payload["official_prices"].(map[string]any)))
}
