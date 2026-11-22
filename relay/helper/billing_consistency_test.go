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
package helper

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/uter-ai/uter/model"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/types"
	"github.com/uter-ai/uter/setting/ratio_setting"
)

func setupBillingConsistencyDB(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	ratio_setting.InitRatioSettings()
	previousGroupRatio := ratio_setting.GroupRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":0.8}`))
	t.Cleanup(func() { _ = ratio_setting.UpdateGroupRatioByJSONString(previousGroupRatio) })

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.ChannelModelPricing{}))
	previousDB := model.DB
	model.DB = db
	model.InvalidateChannelPricingCache()
	t.Cleanup(func() {
		model.DB = previousDB
		model.InvalidateChannelPricingCache()
	})
	return db
}

func seedChannelModel(t *testing.T, channelID int, modelName string, pricing model.ChannelInternalPricing) {
	t.Helper()
	_, err := model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{{
		ChannelId: channelID, ModelName: modelName, Currency: "USD", Source: "test",
	}})
	require.NoError(t, err)
	require.NoError(t, model.SetChannelInternalPricing(channelID, modelName, pricing))
}

func consistencyContext() (*gin.Context, *relaycommon.RelayInfo) {
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Set("group", "default")
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-a", UserGroup: "default", UsingGroup: "default",
		ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 7},
	}
	return ctx, info
}

func TestTokenAndImageBillingUseChannelPrices(t *testing.T) {
	setupBillingConsistencyDB(t)
	seedChannelModel(t, 7, "gpt-a", model.ChannelInternalPricing{
		Mode:                     model.ChannelPricingModePerMillionTokens,
		InputUSDPerMillion:       floatPtr(2),
		OutputUSDPerMillion:      floatPtr(4),
		CacheUSDPerMillion:       floatPtr(1),
		CreateCacheUSDPerMillion: floatPtr(2.5),
	})
	seedChannelModel(t, 7, "image-a", model.ChannelInternalPricing{
		Mode: model.ChannelPricingModePerCall, PerCallUSD: floatPtr(0.04),
	})

	ctx, info := consistencyContext()
	tokenPrice, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.True(t, info.ChannelPricingApplied)
	assert.InDelta(t, 1.0, tokenPrice.ModelRatio, 1e-9)
	assert.InDelta(t, 2.0, tokenPrice.CompletionRatio, 1e-9)
	assert.InDelta(t, 0.5, tokenPrice.CacheRatio, 1e-9)
	assert.InDelta(t, 1.25, tokenPrice.CacheCreationRatio, 1e-9)
	assert.Positive(t, tokenPrice.QuotaToPreConsume)

	imageInfo := &relaycommon.RelayInfo{
		OriginModelName: "image-a", UserGroup: "default", UsingGroup: "default",
		ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 7},
	}
	imagePrice, err := ModelPriceHelperPerCall(ctx, imageInfo)
	require.NoError(t, err)
	assert.True(t, imageInfo.ChannelPricingApplied)
	assert.True(t, imagePrice.UsePrice)
	assert.InDelta(t, 0.04, imagePrice.ModelPrice, 1e-9)
}

func TestChannelTieredExpressionPricesTheRequest(t *testing.T) {
	setupBillingConsistencyDB(t)
	seedChannelModel(t, 7, "gpt-a", model.ChannelInternalPricing{
		Mode:        model.ChannelPricingModeTieredExpr,
		BillingExpr: `len <= 1000 ? tier("short", p * 2) : tier("long", p * 1)`,
	})

	ctx, info := consistencyContext()
	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.True(t, info.ChannelPricingApplied)
	assert.Positive(t, priceData.QuotaToPreConsume)
	require.NotNil(t, info.TieredBillingSnapshot)
	assert.Equal(t, "short", info.TieredBillingSnapshot.EstimatedTier)
	assert.Equal(t, `len <= 1000 ? tier("short", p * 2) : tier("long", p * 1)`, info.TieredBillingSnapshot.ExprString)
	assert.NotEmpty(t, info.ChannelPricingVersion)
}

func TestBCustomerGroupsPayDifferentFinalQuota(t *testing.T) {
	setupBillingConsistencyDB(t)
	seedChannelModel(t, 7, "gpt-a", model.ChannelInternalPricing{
		Mode:                model.ChannelPricingModePerMillionTokens,
		InputUSDPerMillion:  floatPtr(2),
		OutputUSDPerMillion: floatPtr(4),
	})

	ctx, cInfo := consistencyContext()
	cPrice, err := ModelPriceHelper(ctx, cInfo, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)

	ctxB, bInfo := consistencyContext()
	bInfo.UserGroup = "vip"
	bInfo.UsingGroup = "vip"
	bPrice, err := ModelPriceHelper(ctxB, bInfo, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)

	assert.InDelta(t, 0.8, bPrice.GroupRatioInfo.GroupRatio, 1e-9)
	assert.Less(t, bPrice.QuotaToPreConsume, cPrice.QuotaToPreConsume,
		"B-side group ratio must lower the final quota without changing channel price")
	assert.InDelta(t, 1.0, bPrice.ModelRatio, 1e-9)
}

func TestScopedChannelMissingModelDoesNotFallBackToGlobalPrice(t *testing.T) {
	setupBillingConsistencyDB(t)
	seedChannelModel(t, 7, "gpt-a", model.ChannelInternalPricing{
		Mode:                model.ChannelPricingModePerMillionTokens,
		InputUSDPerMillion:  floatPtr(2),
		OutputUSDPerMillion: floatPtr(4),
	})

	ctx, info := consistencyContext()
	info.OriginModelName = "gpt-3.5-turbo"
	info.ChannelMeta.ChannelId = 7
	_, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.Error(t, err, "a channel with scoped pricing must not borrow another channel's price")

	// A channel with no scoped rows keeps the legacy global pricing path.
	ctxLegacy, legacy := consistencyContext()
	legacy.OriginModelName = "gpt-3.5-turbo"
	legacy.ChannelMeta.ChannelId = 8
	_, err = ModelPriceHelper(ctxLegacy, legacy, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
}
