package service

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/uter-ai/uter/model"
)

func TestImportUpstreamBillingInvoicePersistsReconciliation(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.ChannelModelPricing{}, &model.ChannelPricingHistory{}, &model.UpstreamBillingInvoice{}, &model.Channel{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })

	channel := model.Channel{Name: "invoice-test", Type: 58}
	require.NoError(t, db.Create(&channel).Error)

	input, output := 2.0, 4.0
	identity := model.ChannelPricingIdentity{ChannelId: channel.Id, Provider: "test", ModelName: "gpt-a"}
	_, err = model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{{
		ChannelId: channel.Id, Provider: "test", ModelName: "gpt-a", Currency: "USD",
		OfficialPricing: `{}`, NormalizedPricing: `{"currency":"USD","unit":"per_1m_token","price_kind":"OFFICIAL_ABSOLUTE","tiers":[{"range_name":"base","input_per_million_usd":2,"output_per_million_usd":4,"unit":"per_1m_token"}]}`,
		Source: "test", FetchedAt: 1,
	}})
	require.NoError(t, err)
	require.NoError(t, model.SetChannelInternalPricingFor(identity, model.ChannelInternalPricing{
		Mode: model.ChannelPricingModePerMillionTokens, InputUSDPerMillion: &input,
		OutputUSDPerMillion: &output, Source: "manual", UpdatedAt: 2,
	}))

	result, err := ImportUpstreamBillingInvoice(&channel, UpstreamInvoiceImportRequest{
		Period: "2026-11", Source: "supplier.csv",
		Rows: []UpstreamBillingSample{
			{ModelName: "gpt-a", InputTokens: 1000, OutputTokens: 500, UpstreamCostUSD: 0.004},
			{ModelName: "unknown-model", InputTokens: 100, UpstreamCostUSD: 0.01},
		},
	})
	require.NoError(t, err)
	assert.Equal(t, 1, result.Invoice.Matched)
	assert.Equal(t, 1, result.Invoice.Unmatched)
	assert.InDelta(t, 0.014, result.Invoice.TotalUpstreamUSD, 1e-9)
	assert.InDelta(t, 0.004, result.Invoice.TotalUterUSD, 1e-9)

	stored, err := model.GetUpstreamBillingInvoice(channel.Id, result.Invoice.Id)
	require.NoError(t, err)
	assert.Contains(t, stored.Rows, `"status":"MATCHED"`)
	assert.Contains(t, stored.Rows, `"status":"NO_PRICE"`)

	list, err := model.ListUpstreamBillingInvoices(channel.Id, 10)
	require.NoError(t, err)
	assert.Len(t, list, 1)

	_, err = ImportUpstreamBillingInvoice(&channel, UpstreamInvoiceImportRequest{})
	require.Error(t, err)
	_, err = ImportUpstreamBillingInvoice(&channel, UpstreamInvoiceImportRequest{
		Rows: []UpstreamBillingSample{{ModelName: "gpt-a", UpstreamCostUSD: -1}},
	})
	require.Error(t, err)
}
