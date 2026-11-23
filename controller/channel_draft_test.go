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

	blockers := draftPublishBlockers(rows)

	require.Len(t, blockers, 2)
	assert.Contains(t, blockers, "official-only (official_only)")
	assert.Contains(t, blockers, "review (needs_review)")
}

func TestDraftPublishBlockersAllowChannelsWithoutPricingRows(t *testing.T) {
	assert.Empty(t, draftPublishBlockers(nil))
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
