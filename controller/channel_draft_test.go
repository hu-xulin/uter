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
	"github.com/uter-ai/uter/relaykit/dto"
)

func billableDraftPricingRow(t *testing.T, name string) model.ChannelModelPricing {
	t.Helper()
	perCall := 1.0
	encoded, err := common.Marshal(model.ChannelInternalPricing{
		Mode:       model.ChannelPricingModePerCall,
		PerCallUSD: model.MoneyFromFloatPtr(&perCall),
		Source:     "manual",
	})
	require.NoError(t, err)
	return model.ChannelModelPricing{
		ModelName:       name,
		PricingStatus:   model.ChannelPricingStatusConfigured,
		InternalPricing: string(encoded),
		PricingVersion:  "v1",
	}
}

func TestDraftPublishBlockersRequireBillablePrices(t *testing.T) {
	rows := []model.ChannelModelPricing{
		billableDraftPricingRow(t, "configured"),
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

// 所选模型必须有价格行：空价格表不能再被当作“没有需要检查的模型”。
func TestDraftPublishBlockersRejectMissingSelectedPrice(t *testing.T) {
	blockers := draftPublishBlockers(nil, []string{"unpriced-a", "unpriced-b"})
	assert.Equal(t, []string{"unpriced-a (PRICE_MISSING)", "unpriced-b (PRICE_MISSING)"}, blockers)
}

func TestDraftPublishBlockersRejectPartialPricing(t *testing.T) {
	blockers := draftPublishBlockers(
		[]model.ChannelModelPricing{billableDraftPricingRow(t, "priced")},
		[]string{"priced", "missing"},
	)
	assert.Equal(t, []string{"missing (PRICE_MISSING)"}, blockers)
}

func TestDraftPublishBlockersRejectDuplicateIdentity(t *testing.T) {
	rows := []model.ChannelModelPricing{
		billableDraftPricingRow(t, "duplicated"),
		billableDraftPricingRow(t, "duplicated"),
	}
	assert.Equal(t, []string{"duplicated (PRICE_IDENTITY_AMBIGUOUS)"}, draftPublishBlockers(rows, []string{"duplicated"}))
}

func TestDraftPublishBlockersRejectEmptySalePriceAndVersion(t *testing.T) {
	noSale := billableDraftPricingRow(t, "no-sale")
	noSale.InternalPricing = ""
	noVersion := billableDraftPricingRow(t, "no-version")
	noVersion.PricingVersion = ""
	blockers := draftPublishBlockers([]model.ChannelModelPricing{noSale, noVersion}, []string{"no-sale", "no-version"})
	assert.Equal(t, []string{
		"no-sale (SALE_PRICE_MISSING)",
		"no-version (PRICE_VERSION_MISSING)",
	}, blockers)
}

// 未选中的模型即使价格待审核也不能阻塞发布。
func TestDraftPublishBlockersIgnoreUnselectedReviewRows(t *testing.T) {
	rows := []model.ChannelModelPricing{
		billableDraftPricingRow(t, "billable-a"),
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
	assert.Equal(t, dto.ChannelPricingModeScopedPending, settings.PricingMode)
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

func TestPublishChannelDraftEnablesAbilitiesForPricingVisibility(t *testing.T) {
	setupModelListControllerTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.ChannelModelPricing{}))

	createRecorder := httptest.NewRecorder()
	createCtx, _ := gin.CreateTestContext(createRecorder)
	createBody := []byte(`{"type":65,"name":"published showcase","base_url":"https://dreamrouter.ai","key":"sk-test","models":"m-a,m-b","group":"default"}`)
	createCtx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/draft", bytes.NewReader(createBody))
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
	for _, name := range []string{"m-a", "m-b"} {
		row := billableDraftPricingRow(t, name)
		row.ChannelId = created.Data.ID
		require.NoError(t, model.DB.Create(&row).Error)
	}
	// Drafts start disabled: the abilities generated at creation must be off.
	var draftAbilities []model.Ability
	require.NoError(t, model.DB.Where("channel_id = ?", created.Data.ID).Find(&draftAbilities).Error)
	require.Len(t, draftAbilities, 2)
	for _, ability := range draftAbilities {
		assert.False(t, ability.Enabled)
	}

	publish := func() *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(created.Data.ID)}}
		ctx.Request = httptest.NewRequest(
			http.MethodPost,
			"/api/channel/draft/"+strconv.Itoa(created.Data.ID)+"/publish",
			bytes.NewReader([]byte(`{}`)),
		)
		PublishChannelDraft(ctx)
		return recorder
	}

	recorder := publish()
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	var payload struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success, recorder.Body.String())

	channel, err := model.GetChannelById(created.Data.ID, true)
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, common.ChannelStatusEnabled, channel.Status)
	settings := channel.GetOtherSettings()
	assert.False(t, settings.Draft)
	assert.Equal(t, dto.ChannelPricingModeScopedActive, settings.PricingMode)

	var abilities []model.Ability
	require.NoError(t, model.DB.Where("channel_id = ?", created.Data.ID).Find(&abilities).Error)
	require.Len(t, abilities, 2, "publish must rebuild abilities from the final model/group selection")
	for _, ability := range abilities {
		assert.True(t, ability.Enabled, "an enabled channel must not keep disabled abilities")
		assert.Equal(t, "default", ability.Group)
	}

	enabled, err := model.GetAllEnableAbilityWithChannels()
	require.NoError(t, err)
	visibleModels := make([]string, 0, 2)
	for _, ability := range enabled {
		if ability.ChannelId == created.Data.ID {
			require.Equal(t, "published showcase", ability.ChannelName)
			visibleModels = append(visibleModels, ability.Model)
		}
	}
	assert.ElementsMatch(t, []string{"m-a", "m-b"}, visibleModels)

	model.InvalidatePricingCache()
	channelNames := make([]string, 0)
	for _, item := range model.GetPricingChannels() {
		channelNames = append(channelNames, item.Name)
	}
	assert.Contains(t, channelNames, "published showcase")

	// A retried publish repairs an older channel whose status was flipped by
	// a direct DB write while its abilities stayed disabled.
	require.NoError(t, model.DB.Model(&model.Ability{}).
		Where("channel_id = ?", created.Data.ID).Update("enabled", false).Error)
	recorder = publish()
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success, recorder.Body.String())
	var healed []model.Ability
	require.NoError(t, model.DB.Where("channel_id = ?", created.Data.ID).Find(&healed).Error)
	require.Len(t, healed, 2)
	for _, ability := range healed {
		assert.True(t, ability.Enabled)
	}
}
