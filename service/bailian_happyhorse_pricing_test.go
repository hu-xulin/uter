package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

func TestApplyHappyhorseOfficialPricing(t *testing.T) {
	makeCatalog := func() *BailianCatalog {
		return &BailianCatalog{
			Region: BailianRegionBeijing,
			Models: []BailianModel{
				{Model: "happyhorse-1.1-t2v"},
				{Model: "happyhorse-1.1-i2v"},
				{Model: "happyhorse-1.1-r2v"},
				{Model: "happyhorse-1.0-t2v"},        // unverified -> stays empty
				{Model: "happyhorse-1.0-video-edit"}, // unverified -> stays empty
			},
		}
	}

	t.Run("injects verified per-second rates", func(t *testing.T) {
		catalog := makeCatalog()
		applyHappyhorseOfficialPricing(catalog)
		for _, index := range []int{0, 1, 2} {
			prices := catalog.Models[index].Prices
			require.Len(t, prices, 1, catalog.Models[index].Model)
			require.Len(t, prices[0].Prices, 3)
			byType := map[string]BailianPrice{}
			for _, p := range prices[0].Prices {
				byType[p.Type] = p
			}
			assert.Equal(t, "0.123769", byType["video_ratio_720p"].Price)
			assert.Equal(t, "0.165026", byType["video_ratio_1080p"].Price)
			assert.Equal(t, "USD", byType["video_ratio_720p"].Currency)
			assert.Equal(t, happyhorseOfficialRateSource, byType["video_ratio_720p"].Source)
		}
	})

	t.Run("leaves unverified variants review-only", func(t *testing.T) {
		catalog := makeCatalog()
		applyHappyhorseOfficialPricing(catalog)
		assert.Empty(t, catalog.Models[3].Prices)
		assert.Empty(t, catalog.Models[4].Prices)
	})

	t.Run("never overwrites an existing catalog price", func(t *testing.T) {
		catalog := makeCatalog()
		catalog.Models[0].Prices = []BailianPriceRange{{RangeName: "Default", Prices: []BailianPrice{{
			Type: "video_ratio_720p", Price: "9.9", PriceUnit: "每秒", Currency: "CNY",
		}}}}
		applyHappyhorseOfficialPricing(catalog)
		require.Len(t, catalog.Models[0].Prices, 1)
		assert.Equal(t, "9.9", catalog.Models[0].Prices[0].Prices[0].Price, "catalog quote must win")
	})

	t.Run("offline region without rates is a no-op", func(t *testing.T) {
		catalog := makeCatalog()
		catalog.Region = BailianRegion("unknown-region")
		applyHappyhorseOfficialPricing(catalog)
		assert.Empty(t, catalog.Models[0].Prices)
	})

	t.Run("injected rates produce executable internal pricing", func(t *testing.T) {
		catalog := makeCatalog()
		applyHappyhorseOfficialPricing(catalog)
		view := bailianOfficialPricing(catalog.Models[0], BailianRegionBeijing, 7.2, 1700000000)
		require.Empty(t, view.ReviewReasons, view.ReviewReasons)
		assert.Equal(t, "USD", view.Currency)
		assert.False(t, view.CurrencyInferred, "injected price carries explicit USD")
		internal := bailianInternalPricing(view)
		require.NotEmpty(t, internal)
		var pricing model.ChannelInternalPricing
		require.NoError(t, common.UnmarshalJsonStr(internal, &pricing))
		assert.Equal(t, model.ChannelPricingModeTieredExpr, pricing.Mode)
	})
}
