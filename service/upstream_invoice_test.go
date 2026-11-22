package service

import (
	"testing"
	"time"

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

// 非 USD 发票必须显式换算：缺少汇率时拒绝导入，有汇率时原始金额与
// 换算后的 USD 同时留痕，并写入供应商账单财务流水。
func TestImportUpstreamBillingInvoiceConvertsNonUSDWithFX(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.UpstreamBillingInvoice{}, &model.BillingFinancialLedger{}, &model.BillingExchangeRate{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })

	channel := model.Channel{Name: "invoice-cny", Type: 58}
	require.NoError(t, db.Create(&channel).Error)
	request := UpstreamInvoiceImportRequest{
		Period: "2026-11", Currency: "CNY", Source: "supplier.csv",
		Rows: []UpstreamBillingSample{{ModelName: "unknown-model", InputTokens: 100, UpstreamCostUSD: 0.014}},
	}

	_, err = ImportUpstreamBillingInvoice(&channel, request)
	require.Error(t, err, "non-USD invoice without a rate must be rejected")

	request.FXRate = 7.2
	result, err := ImportUpstreamBillingInvoice(&channel, request)
	require.NoError(t, err)
	assert.Equal(t, "CNY", result.Invoice.Currency)
	assert.InDelta(t, 0.014, result.Invoice.OriginalTotal, 1e-9)
	assert.InDelta(t, 0.014*7.2, result.Invoice.TotalUpstreamUSD, 1e-9)
	assert.InDelta(t, 7.2, result.Invoice.FXRate, 1e-9)

	var entries []model.BillingFinancialLedger
	require.NoError(t, db.Where("entry_type = ?", model.BillingLedgerEntrySupplierInvoice).Find(&entries).Error)
	require.Len(t, entries, 1)
	assert.InDelta(t, 0.014, entries[0].OriginalAmount, 1e-9)
	assert.InDelta(t, 0.014*7.2, entries[0].AmountUSD, 1e-9)
	assert.Equal(t, "CNY", entries[0].Currency)
	assert.Equal(t, model.BillingLedgerStatusRecorded, entries[0].Status)
}

// 非 USD 账单在没有显式汇率时可以使用已登记的历史汇率，并记录来源与版本。
func TestImportUpstreamBillingInvoiceUsesRecordedExchangeRate(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.UpstreamBillingInvoice{}, &model.BillingFinancialLedger{}, &model.BillingExchangeRate{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })

	channel := model.Channel{Name: "invoice-eur", Type: 58}
	require.NoError(t, db.Create(&channel).Error)
	require.NoError(t, model.SaveBillingExchangeRate(model.BillingExchangeRate{
		BaseCurrency: "EUR", QuoteCurrency: "USD",
		EffectiveAt: time.Now().Add(-time.Hour).Unix(), Rate: 1.1, Source: "ecb-daily",
	}))

	result, err := ImportUpstreamBillingInvoice(&channel, UpstreamInvoiceImportRequest{
		Period: "2026-11", Currency: "EUR",
		Rows: []UpstreamBillingSample{{ModelName: "unknown-model", UpstreamCostUSD: 2}},
	})
	require.NoError(t, err)
	assert.InDelta(t, 2.2, result.Invoice.TotalUpstreamUSD, 1e-9)
	assert.Equal(t, "ecb-daily", result.Invoice.FXSource)
	assert.NotEmpty(t, result.Invoice.FXVersion)

	rate, source, version, err := ResolveExchangeRateToUSD("EUR", 0, "")
	require.NoError(t, err)
	assert.InDelta(t, 1.1, rate, 1e-9)
	assert.Equal(t, "ecb-daily", source)
	assert.NotEmpty(t, version)

	_, _, _, err = ResolveExchangeRateToUSD("JPY", 0, "")
	require.Error(t, err, "a currency without any recorded rate must not be guessed")
}

// 带 request_id 的账单行必须匹配 Uter 的不可变凭证：成本取冻结的逐维采购
// 成本，用量与渠道不一致时进入人工核对，而不是重新按当前价估算。
func TestReconcileUpstreamBillingMatchesRequestSnapshotCost(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.BillingPriceSnapshot{}, &model.BillingCostBreakdown{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })

	channel := model.Channel{Name: "invoice-line", Type: 58}
	require.NoError(t, db.Create(&channel).Error)

	require.NoError(t, model.SaveBillingPriceSnapshot(model.BillingPriceSnapshot{
		RequestId: "req-line-1", ModelName: "gpt-a", ChannelId: channel.Id, UserId: 7,
		UsageBreakdown: `{"prompt_tokens":1000,"completion_tokens":500,"cache_read_tokens":200}`,
	}))
	require.NoError(t, model.SaveBillingCostBreakdowns([]model.BillingCostBreakdown{
		{RequestId: "req-line-1", ModelName: "gpt-a", ChannelId: channel.Id, Dimension: "input", Quantity: 800, AmountUSD: 0.0008},
		{RequestId: "req-line-1", ModelName: "gpt-a", ChannelId: channel.Id, Dimension: "output", Quantity: 500, AmountUSD: 0.001},
		{RequestId: "req-line-1", ModelName: "gpt-a", ChannelId: channel.Id, Dimension: "cache_read", Quantity: 200, AmountUSD: 0.00002},
	}))

	report, err := ReconcileUpstreamBillingSamples(&channel, []UpstreamBillingSample{{
		ModelName: "gpt-a", RequestId: "req-line-1", BillingLineId: "line-1",
		InputTokens: 1000, OutputTokens: 500, CacheReadTokens: 200, UpstreamCostUSD: 0.00182,
	}})
	require.NoError(t, err)
	require.Len(t, report.Results, 1)
	assert.Equal(t, UpstreamSampleMatched, report.Results[0].Status)
	assert.InDelta(t, 0.00182, report.Results[0].UterCostUSD, 1e-9)
	assert.InDelta(t, 0, report.Results[0].DifferenceUSD, 1e-9)

	// A request id with no Uter voucher is a manual-matching case.
	report, err = ReconcileUpstreamBillingSamples(&channel, []UpstreamBillingSample{{
		ModelName: "gpt-a", RequestId: "req-missing", UpstreamCostUSD: 1,
	}})
	require.NoError(t, err)
	assert.Equal(t, UpstreamSampleNoRequest, report.Results[0].Status)

	// An amount of usage that the voucher does not support is not auto-approved.
	require.NoError(t, model.SaveBillingPriceSnapshot(model.BillingPriceSnapshot{
		RequestId: "req-line-2", ModelName: "gpt-b", ChannelId: channel.Id,
		UsageBreakdown: `{"prompt_tokens":1000,"completion_tokens":500}`,
	}))
	require.NoError(t, model.SaveBillingCostBreakdowns([]model.BillingCostBreakdown{
		{RequestId: "req-line-2", ModelName: "gpt-b", Dimension: "input", Quantity: 1000, AmountUSD: 0.001},
	}))
	report, err = ReconcileUpstreamBillingSamples(&channel, []UpstreamBillingSample{{
		ModelName: "gpt-b", RequestId: "req-line-2", InputTokens: 9999, UpstreamCostUSD: 0.001,
	}})
	require.NoError(t, err)
	assert.Equal(t, UpstreamSampleMismatched, report.Results[0].Status)
	assert.Contains(t, report.Results[0].Reason, "input tokens differs")

	// A voucher without frozen purchase cost cannot be marked matched.
	require.NoError(t, model.SaveBillingPriceSnapshot(model.BillingPriceSnapshot{
		RequestId: "req-line-3", ModelName: "gpt-c", ChannelId: channel.Id,
	}))
	report, err = ReconcileUpstreamBillingSamples(&channel, []UpstreamBillingSample{{
		ModelName: "gpt-c", RequestId: "req-line-3", UpstreamCostUSD: 0.001,
	}})
	require.NoError(t, err)
	assert.Equal(t, UpstreamSampleNoCost, report.Results[0].Status)
}
