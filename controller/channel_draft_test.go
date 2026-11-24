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
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

func TestDraftPublishBlockersRequireBillablePrices(t *testing.T) {
	rows := []model.ChannelModelPricing{
		{ModelName: "configured", PricingStatus: model.ChannelPricingStatusConfigured},
		{ModelName: "official-only", PricingStatus: model.ChannelPricingStatusOfficialOnly},
		{ModelName: "review", PricingStatus: model.ChannelPricingStatusNeedsReview},
	}
	selected := []string{"configured", "official-only", "review"}

	blockers := draftPublishBlockers(rows, selected)

	require.Len(t, blockers, 2)
	assert.Contains(t, blockers, "official-only (official_only)")
	assert.Contains(t, blockers, "review (needs_review)")
}

func TestDraftPublishBlockersAllowChannelsWithoutPricingRows(t *testing.T) {
	assert.Empty(t, draftPublishBlockers(nil, nil))
}

// A draft catalogue sync writes review-only rows for the whole directory. Only
// the models the operator selected are routed to this channel, so unselected
// review rows must not block publishing.
func TestDraftPublishBlockersIgnoreUnselectedReviewRows(t *testing.T) {
	rows := []model.ChannelModelPricing{
		{ModelName: "billable-a", PricingStatus: model.ChannelPricingStatusConfigured},
		{ModelName: "review-only-a", PricingStatus: model.ChannelPricingStatusNeedsReview},
	}

	blockers := draftPublishBlockers(rows, []string{"billable-a"})

	assert.Empty(t, blockers)
}

// An empty model list produces no abilities: the channel serves nothing, so no
// pricing row can ever bill and nothing should block publishing.
func TestDraftPublishBlockersAllowChannelWithNoSelectedModels(t *testing.T) {
	rows := []model.ChannelModelPricing{
		{ModelName: "review-only-a", PricingStatus: model.ChannelPricingStatusNeedsReview},
	}
	assert.Empty(t, draftPublishBlockers(rows, nil))
}

func TestCreateChannelDraftEnablesAutomaticUpstreamUpdates(t *testing.T) {
	setupModelListControllerTestDB(t)
	body := []byte(`{"type":1,"name":"auto draft","base_url":"https://example.com","key":"sk-test","models":"m-a"}`)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/draft", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	CreateChannelDraft(ctx)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			ID int `json:"id"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Positive(t, response.Data.ID)

	channel, err := model.GetChannelById(response.Data.ID, true)
	require.NoError(t, err)
	require.NotNil(t, channel)
	settings := channel.GetOtherSettings()
	assert.True(t, settings.Draft)
	assert.True(t, settings.UpstreamModelUpdateCheckEnabled)
	assert.True(t, settings.UpstreamModelUpdateAutoSyncEnabled)
	assert.Equal(t, 0, channel.Status)
}

// The publish guard must return a translatable message plus structured
// blockers, so the web console can show the exact models that need a price.
func TestPublishChannelDraftReturnsTranslatablePricingBlocker(t *testing.T) {
	setupModelListControllerTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.ChannelModelPricing{}))
	createRecorder := httptest.NewRecorder()
	createCtx, _ := gin.CreateTestContext(createRecorder)
	createBody := []byte(`{"type":1,"name":"pricing blocker draft","base_url":"https://example.com","key":"sk-test","models":"review-a"}`)
	createCtx.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/channel/draft",
		bytes.NewReader(createBody),
	)
	createCtx.Request.Header.Set("Content-Type", "application/json")
	CreateChannelDraft(createCtx)
	require.Equal(t, http.StatusOK, createRecorder.Code, createRecorder.Body.String())

	var created struct {
		Data struct {
			ID int `json:"id"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(createRecorder.Body.Bytes(), &created))
	require.Positive(t, created.Data.ID)

	require.NoError(t, model.DB.Create(&model.ChannelModelPricing{
		ChannelId:     created.Data.ID,
		Provider:      "uterroute",
		ModelName:     "review-a",
		Currency:      "USD",
		PricingStatus: model.ChannelPricingStatusNeedsReview,
	}).Error)

	publishRecorder := httptest.NewRecorder()
	publishCtx, _ := gin.CreateTestContext(publishRecorder)
	publishCtx.Params = gin.Params{{
		Key:   "id",
		Value: strconv.Itoa(created.Data.ID),
	}}
	publishCtx.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/channel/draft/"+strconv.Itoa(created.Data.ID)+"/publish",
		bytes.NewReader([]byte(`{}`)),
	)
	PublishChannelDraft(publishCtx)

	require.Equal(t, http.StatusOK, publishRecorder.Code, publishRecorder.Body.String())
	var payload struct {
		Success    bool   `json:"success"`
		Message    string `json:"message"`
		MessageKey string `json:"message_key"`
		Code       string `json:"code"`
		Data       struct {
			Models []string `json:"models"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(publishRecorder.Body.Bytes(), &payload))
	assert.False(t, payload.Success)
	assert.Equal(
		t,
		"Set a billable sale price for {{models}} before publishing",
		payload.MessageKey,
	)
	assert.Equal(t, "CHANNEL_DRAFT_PRICING_NOT_BILLABLE", payload.Code)
	assert.Equal(t, []string{"review-a (needs_review)"}, payload.Data.Models)
	assert.Contains(t, payload.Message, "review-a (needs_review)")
}
