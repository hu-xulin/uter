/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

// setupUterRouteFlowTestDB builds an isolated in-memory database with every
// table the create/edit flow touches. It never touches an operator database.
func setupUterRouteFlowTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(
		&model.Channel{}, &model.Ability{}, &model.Model{}, &model.Vendor{},
		&model.Option{}, &model.ChannelModelPricing{}, &model.ChannelPricingHistory{},
		&model.SystemTaskLock{}, &model.ChannelSyncState{}, &model.User{},
		&model.AuditLog{}, &model.SystemTask{},
	))
	t.Cleanup(func() {
		if sqlDB, e := db.DB(); e == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

// mockUterRouteUpstream serves a pricing catalogue with one billable model and
// one review-only model, mirroring a real Uter Route directory.
const flowPricingFixture = `{
  "success": true,
  "pricing_version": "flow-v1",
  "data": [
    {
      "model_name": "billable-a", "vendor_id": 1, "quota_type": 0,
      "model_ratio": 2.5, "model_price": 0, "completion_ratio": 5,
      "enable_groups": ["default"],
      "supported_endpoint_types": ["openai"],
      "pricing_version": "flow-v1"
    },
    {
      "model_name": "review-only-a", "vendor_id": 2, "quota_type": 0,
      "model_ratio": 0, "model_price": 0, "completion_ratio": 1,
      "enable_groups": ["default"],
      "supported_endpoint_types": ["openai"]
    }
  ],
  "vendors": [{"id":1,"name":"A"},{"id":2,"name":"B"}],
  "group_ratio": {"default": 1},
  "auto_groups": ["default"],
  "usable_group": {"default": ""}
}`

func newFlowUpstream(t *testing.T) string {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/pricing" {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(flowPricingFixture))
			return
		}
		http.NotFound(w, r)
	}))
	t.Cleanup(server.Close)
	return server.URL
}

// setUterRouteFlowOption points UterRoute host detection at the mock
// catalogue and restores the exact prior value on cleanup. Restoring the map
// reference instead of the key would leak a 127.0.0.1 host into later tests
// (every httptest server shares that hostname), making unrelated localhost
// channels misdetect as UterRoute.
func setUterRouteFlowOption(t *testing.T, upstream string) {
	t.Helper()
	common.OptionMapRWMutex.Lock()
	previous, existed := common.OptionMap[service.UterRouteUpstreamURLOption]
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}
	common.OptionMap[service.UterRouteUpstreamURLOption] = upstream
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		if existed {
			common.OptionMap[service.UterRouteUpstreamURLOption] = previous
		} else {
			delete(common.OptionMap, service.UterRouteUpstreamURLOption)
		}
		common.OptionMapRWMutex.Unlock()
	})
}

func postJSON(t *testing.T, handler gin.HandlerFunc, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	return postJSONWithParams(t, handler, path, body, nil)
}

func postJSONWithParams(t *testing.T, handler gin.HandlerFunc, path, body string, params gin.Params) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, path, bytes.NewBufferString(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	if len(params) > 0 {
		ctx.Params = params
	}
	handler(ctx)
	return recorder
}

// TestUterRouteCreateFlow_StepByStep walks the full creation pipeline against
// the current source: draft creation -> catalogue sync -> model catalogue ->
// publish gate. Each step asserts its observable contract.
func TestUterRouteCreateFlow_StepByStep(t *testing.T) {
	setupUterRouteFlowTestDB(t)
	upstream := newFlowUpstream(t)

	// Configure the Uter Route endpoint so host detection and sync both accept
	// the mock server as the authoritative directory.
	setUterRouteFlowOption(t, upstream)

	// Step 1: create the disabled draft channel (type 65 = Uter Route).
	baseURL := upstream
	createBody := fmt.Sprintf(`{"type":%d,"name":"uterroute flow","base_url":%q,"key":"sk-test","models":"","group":"default"}`,
		constant.ChannelTypeUterRoute, baseURL)
	rec := postJSON(t, CreateChannelDraft, "/api/channel/draft", createBody)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var created struct {
		Success bool `json:"success"`
		Data    struct {
			ID int `json:"id"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &created))
	require.True(t, created.Success, rec.Body.String())
	require.Positive(t, created.Data.ID)
	channelID := created.Data.ID

	channel, err := model.GetChannelById(channelID, true)
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, 0, channel.Status, "draft must start disabled")
	assert.True(t, channel.GetOtherSettings().Draft, "draft flag must be set")

	// Step 2: sync the catalogue into this channel. Note channelModels is empty
	// (models not chosen yet) so UterRouteChannelPricingRecords writes the full
	// directory -- this is the exact condition that can poison the publish gate.
	syncBody := fmt.Sprintf(`{"channel_id":%d,"base_url":%q}`, channelID, baseURL)
	syncRec := postJSON(t, SyncUterRouteUpstream, "/api/upstream/uterroute/sync", syncBody)
	require.Equal(t, http.StatusOK, syncRec.Code, syncRec.Body.String())
	var synced struct {
		Success bool `json:"success"`
		Data    struct {
			ChannelPricingWritten int `json:"channel_pricing_written"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(syncRec.Body.Bytes(), &synced))
	require.True(t, synced.Success, syncRec.Body.String())
	t.Logf("create step 2: wrote %d channel pricing rows for draft %d", synced.Data.ChannelPricingWritten, channelID)

	rows, err := model.ListChannelModelPricing(channelID)
	require.NoError(t, err)
	require.NotEmpty(t, rows, "catalogue sync must write channel pricing rows")
	statuses := map[string]int{}
	for _, row := range rows {
		statuses[row.PricingStatus]++
	}
	t.Logf("create step 2 statuses: %#v", statuses)

	// Step 3: fetch the model list -- must come from the pricing catalogue and
	// contain both models (hidden/vendor-less filtering aside).
	ch, err := model.GetChannelById(channelID, true)
	require.NoError(t, err)
	modelIDs, err := fetchChannelUpstreamModelIDs(ch)
	require.NoError(t, err)
	assert.Contains(t, modelIDs, "billable-a")
	assert.Contains(t, modelIDs, "review-only-a")

	// Step 4: the operator picks only the billable model and saves the draft,
	// then publishes. The publish gate currently inspects ALL pricing rows of
	// the channel, including the review-only row that was never selected.
	updateField := model.Channel{}
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", channelID).Update("models", "billable-a").Error)
	_ = updateField

	pubRec := postJSONWithParams(t, PublishChannelDraft,
		fmt.Sprintf("/api/channel/draft/%d/publish", channelID), `{}`,
		gin.Params{{Key: "id", Value: fmt.Sprintf("%d", channelID)}})
	require.Equal(t, http.StatusOK, pubRec.Code, pubRec.Body.String())
	var published struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(pubRec.Body.Bytes(), &published))
	t.Logf("create step 4 publish: success=%v message=%q", published.Success, published.Message)
	// This assertion documents the intended contract: a channel configured with
	// a billable model must be publishable.
	assert.True(t, published.Success, "publishing a channel whose selected model is billable must succeed; got: %s", pubRec.Body.String())
}

// TestUterRouteEditFlow_StepByStep walks the edit pipeline: load an existing
// channel, switch discount group, re-sync the catalogue and verify that a
// manually configured sale price survives the re-sync.
func TestUterRouteEditFlow_StepByStep(t *testing.T) {
	setupUterRouteFlowTestDB(t)
	upstream := newFlowUpstream(t)

	setUterRouteFlowOption(t, upstream)

	// Step 1: an already-published channel with a selected billable model.
	ch := model.Channel{
		Type: constant.ChannelTypeUterRoute, Name: "edit flow",
		Status: common.ChannelStatusEnabled, BaseURL: ptrStr(upstream),
		Key: "sk-test", Models: "billable-a", Group: "default",
	}
	require.NoError(t, model.DB.Create(&ch).Error)
	channelID := ch.Id

	// Step 2: switch the discount group through the sync endpoint.
	syncBody := fmt.Sprintf(`{"channel_id":%d,"base_url":%q,"discount_group":"vip"}`, channelID, upstream)
	syncRec := postJSON(t, SyncUterRouteUpstream, "/api/upstream/uterroute/sync", syncBody)
	require.Equal(t, http.StatusOK, syncRec.Code, syncRec.Body.String())
	var synced struct {
		Success bool `json:"success"`
		Data    struct {
			DiscountGroup string `json:"discount_group"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(syncRec.Body.Bytes(), &synced))
	require.True(t, synced.Success, syncRec.Body.String())
	assert.Equal(t, "vip", synced.Data.DiscountGroup, "edit discount-group switch must persist")
	assert.Equal(t, "vip", service.GetUterRouteDiscountGroup(channelID))

	// Step 3: set an operator (manual) sale price, then re-sync. The manual
	// price must survive because only auto-derived prices are replaceable.
	rows, err := model.ListChannelModelPricing(channelID)
	require.NoError(t, err)
	require.NotEmpty(t, rows)
	require.NoError(t, model.DB.Model(&model.ChannelModelPricing{}).
		Where("id = ?", rows[0].Id).
		Updates(map[string]any{
			"internal_pricing": `{"source":"manual","mode":"per_1m_token","input_usd_per_million":9,"updated_at":1}`,
			"pricing_status":   model.ChannelPricingStatusConfigured,
		}).Error)

	syncRec2 := postJSON(t, SyncUterRouteUpstream, "/api/upstream/uterroute/sync", syncBody)
	require.Equal(t, http.StatusOK, syncRec2.Code, syncRec2.Body.String())

	rowsAfter, err := model.ListChannelModelPricing(channelID)
	require.NoError(t, err)
	var preserved bool
	for _, row := range rowsAfter {
		if row.ModelName == rows[0].ModelName {
			preserved = strings.Contains(row.InternalPricing, `"source":"manual"`)
			t.Logf("edit step 3 %s internal pricing after re-sync: %s", row.ModelName, row.InternalPricing)
		}
	}
	assert.True(t, preserved, "operator sale price must survive a catalogue re-sync")
}

func ptrStr(s string) *string { return &s }
