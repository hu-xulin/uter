package service

import (
	"sync"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/uter-ai/uter/model"
	relaycommon "github.com/uter-ai/uter/relay/common"
)

func TestRecordBillingPriceSnapshotCapturesIdentityAndVersion(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.BillingPriceSnapshot{}, &model.BillingCostBreakdown{}, &model.BillingFinancialLedger{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })

	info := &relaycommon.RelayInfo{
		RequestId: "req-live-1", OriginModelName: "gpt-a",
		ChannelPricingApplied:          true,
		ChannelPricingProvider:         "uterapi",
		ChannelPricingRegion:           "us",
		ChannelPricingDeployment:       "dep-1",
		ChannelPricingVersion:          "sale-v1",
		ChannelPricingPurchaseVersion:  "cost-v1",
		ChannelPricingMode:             model.ChannelPricingModePerMillionTokens,
		ChannelPricingCurrency:         "USD",
		ChannelPricingFXRate:           1,
		ChannelPricingContractJSON:     `{"mode":"per_million_tokens","input_per_million_usd":1.2,"tiers":[{"range_name":"base","input_per_million_usd":1.2}],"source":"operator"}`,
		ChannelPricingPurchaseUSD:      snapshotFloatPtr(0.9),
		ChannelPricingPurchaseVerified: true,
		ChannelPricingPurchaseSource:   "contract-2026",
		ChannelPricingPurchaseContract: `{"pricing":{"mode":"per_1m_token","input_per_million_usd":0.9},"verified":true,"source":"contract-2026"}`,
		FinalPreConsumedQuota:          2000,
		SettledQuota:                   1500,
		SettlementRecorded:             true,
		BillingUsageBreakdown:          map[string]any{"prompt_tokens": 100, "completion_tokens": 50},
	}
	info.ChannelMeta = &relaycommon.ChannelMeta{ChannelId: 9}
	info.PriceData.GroupRatioInfo.GroupRatio = 0.8
	RecordBillingPriceSnapshot(info, nil)

	got, err := model.GetBillingPriceSnapshot("req-live-1", "", "gpt-a")
	require.NoError(t, err)
	assert.Equal(t, 9, got.ChannelId)
	assert.Equal(t, "uterapi", got.Provider)
	assert.Equal(t, "dep-1", got.DeploymentId)
	assert.Equal(t, "sale-v1", got.PricingVersion)
	assert.Equal(t, "cost-v1", got.PurchaseVersion)
	assert.InDelta(t, 0.8, got.GroupRatio, 1e-9)
	assert.Contains(t, got.PriceContract, `"input_per_million_usd":1.2`)
	assert.NotEmpty(t, got.PriceContractHash)
	assert.Equal(t, "operator", got.PriceSource)
	require.NotNil(t, got.PurchaseUSD)
	assert.InDelta(t, 0.9, got.PurchaseUSD.Float64(), 1e-9)
	assert.True(t, got.PurchaseVerified)
	assert.Contains(t, got.PurchaseContract, `"input_per_million_usd":0.9`)
	assert.NotEmpty(t, got.PurchaseContractHash)
	assert.Equal(t, int64(2000), got.PreConsumedQuota)
	assert.Equal(t, int64(1500), got.SettledQuota)
	assert.Equal(t, int64(500), got.RefundQuota)
	assert.Equal(t, "settled", got.SettleStatus)
	assert.Contains(t, got.UsageBreakdown, `"prompt_tokens":100`)

	// A request without channel pricing and without an expression writes nothing.
	RecordBillingPriceSnapshot(&relaycommon.RelayInfo{RequestId: "plain", OriginModelName: "gpt-a"}, nil)
	_, err = model.GetBillingPriceSnapshot("plain", "", "gpt-a")
	require.Error(t, err)
}

func snapshotFloatPtr(v float64) *float64 { return &v }

func TestBillingSnapshotSettlementPatchFillsAmountsOnce(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.BillingPriceSnapshot{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })

	require.NoError(t, model.SaveBillingPriceSnapshot(model.BillingPriceSnapshot{
		RequestId: "task-req", TaskId: "task-1", ModelName: "video-a",
		PriceContract: `{"mode":"per_second"}`, SettleStatus: "pending",
	}))
	require.NoError(t, model.UpdateBillingPriceSnapshotSettlement("task-req", "task-1", "video-a", model.SettlementPatch{
		UsageBreakdown: `{"seconds":5}`, PreConsumed: 5000, Settled: 4500, Refund: 500, Status: "settled",
	}))
	got, err := model.GetBillingPriceSnapshot("task-req", "task-1", "video-a")
	require.NoError(t, err)
	assert.Equal(t, int64(5000), got.PreConsumedQuota)
	assert.Equal(t, int64(4500), got.SettledQuota)
	assert.Equal(t, int64(500), got.RefundQuota)
	assert.Equal(t, "settled", got.SettleStatus)
	assert.Equal(t, `{"mode":"per_second"}`, got.PriceContract, "settlement must not rewrite the contract")

	// A duplicate callback cannot move an already settled voucher.
	err = model.UpdateBillingPriceSnapshotSettlement("task-req", "task-1", "video-a", model.SettlementPatch{
		Settled: 1, Status: "settled",
	})
	require.ErrorIs(t, err, model.ErrBillingSnapshotSettlementConflict)
	got, err = model.GetBillingPriceSnapshot("task-req", "task-1", "video-a")
	require.NoError(t, err)
	assert.Equal(t, int64(4500), got.SettledQuota)

	// An identical retry is an idempotent no-op, not a conflict.
	require.NoError(t, model.UpdateBillingPriceSnapshotSettlement("task-req", "task-1", "video-a", model.SettlementPatch{
		UsageBreakdown: `{"seconds":5}`, PreConsumed: 5000, Settled: 4500, Refund: 500, Status: "settled",
	}))
}

// 结算凭证是财务终态：退款后迟到的成功回调不得改写，反之亦然。
func TestBillingSnapshotSettlementRejectsTerminalOverwrite(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	// 单连接让并发回调在 SQLite 上串行执行；互斥仍由条件 UPDATE 提供。
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&model.BillingPriceSnapshot{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })

	seed := func(requestID, taskID string) {
		require.NoError(t, model.SaveBillingPriceSnapshot(model.BillingPriceSnapshot{
			RequestId: requestID, TaskId: taskID, ModelName: "video-a",
			PreConsumedQuota: 100, SettleStatus: model.BillingSnapshotStatusPending,
		}))
	}
	load := func(requestID, taskID string) *model.BillingPriceSnapshot {
		got, err := model.GetBillingPriceSnapshot(requestID, taskID, "video-a")
		require.NoError(t, err)
		return got
	}

	t.Run("refunded refuses a late settled callback", func(t *testing.T) {
		seed("req-guard-1", "task-guard-1")
		require.NoError(t, model.UpdateBillingPriceSnapshotSettlement("req-guard-1", "task-guard-1", "video-a", model.SettlementPatch{
			PreConsumed: 100, Settled: 0, Refund: 100, Status: model.BillingSnapshotStatusRefunded,
		}))

		err := model.UpdateBillingPriceSnapshotSettlement("req-guard-1", "task-guard-1", "video-a", model.SettlementPatch{
			PreConsumed: 100, Settled: 90, Refund: 10, Status: model.BillingSnapshotStatusSettled,
		})
		require.ErrorIs(t, err, model.ErrBillingSnapshotSettlementConflict)

		got := load("req-guard-1", "task-guard-1")
		assert.Equal(t, model.BillingSnapshotStatusRefunded, got.SettleStatus)
		assert.Zero(t, got.SettledQuota)
		assert.Equal(t, int64(100), got.RefundQuota)
	})

	t.Run("settled refuses a later refund", func(t *testing.T) {
		seed("req-guard-2", "task-guard-2")
		require.NoError(t, model.UpdateBillingPriceSnapshotSettlement("req-guard-2", "task-guard-2", "video-a", model.SettlementPatch{
			PreConsumed: 100, Settled: 90, Refund: 10, Status: model.BillingSnapshotStatusSettled,
		}))

		err := model.UpdateBillingPriceSnapshotSettlement("req-guard-2", "task-guard-2", "video-a", model.SettlementPatch{
			PreConsumed: 100, Settled: 0, Refund: 100, Status: model.BillingSnapshotStatusRefunded,
		})
		require.ErrorIs(t, err, model.ErrBillingSnapshotSettlementConflict)

		got := load("req-guard-2", "task-guard-2")
		assert.Equal(t, model.BillingSnapshotStatusSettled, got.SettleStatus)
		assert.Equal(t, int64(90), got.SettledQuota)
	})

	t.Run("identity scope is preserved", func(t *testing.T) {
		seed("req-scope-a", "task-scope-a")
		seed("req-scope-b", "task-scope-b")
		require.NoError(t, model.UpdateBillingPriceSnapshotSettlement("req-scope-a", "task-scope-a", "video-a", model.SettlementPatch{
			PreConsumed: 100, Settled: 90, Refund: 10, Status: model.BillingSnapshotStatusSettled,
		}))

		assert.Equal(t, model.BillingSnapshotStatusSettled, load("req-scope-a", "task-scope-a").SettleStatus)
		assert.Equal(t, model.BillingSnapshotStatusPending, load("req-scope-b", "task-scope-b").SettleStatus)
	})

	t.Run("concurrent callbacks have exactly one winner", func(t *testing.T) {
		seed("req-guard-race", "task-guard-race")

		patches := []model.SettlementPatch{
			{PreConsumed: 100, Settled: 90, Refund: 10, Status: model.BillingSnapshotStatusSettled},
			{PreConsumed: 100, Settled: 0, Refund: 100, Status: model.BillingSnapshotStatusRefunded},
		}
		errs := make([]error, len(patches))
		var wg sync.WaitGroup
		for i := range patches {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				errs[i] = model.UpdateBillingPriceSnapshotSettlement("req-guard-race", "task-guard-race", "video-a", patches[i])
			}(i)
		}
		wg.Wait()

		succeeded := 0
		for _, callErr := range errs {
			if callErr == nil {
				succeeded++
			} else {
				require.ErrorIs(t, callErr, model.ErrBillingSnapshotSettlementConflict)
			}
		}
		require.Equal(t, 1, succeeded)

		got := load("req-guard-race", "task-guard-race")
		assert.Contains(t, []string{model.BillingSnapshotStatusSettled, model.BillingSnapshotStatusRefunded}, got.SettleStatus)
	})
}

func TestTaskRefundCompletesSnapshotVoucher(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.BillingPriceSnapshot{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })

	require.NoError(t, model.SaveBillingPriceSnapshot(model.BillingPriceSnapshot{
		RequestId: "req-task-refund", TaskId: "task-refund", ModelName: "video-a",
		PriceContract: `{"mode":"per_second"}`, PreConsumedQuota: 3000, SettleStatus: "pending",
	}))
	task := &model.Task{TaskID: "task-refund"}
	task.Properties.OriginModelName = "video-a"
	task.PrivateData.Execution = &model.TaskExecutionSnapshot{RequestID: "req-task-refund"}

	updateTaskPriceSnapshotSettlement(task, 3000, 0, `{"seconds":5}`, "refunded")

	got, err := model.GetBillingPriceSnapshot("req-task-refund", "task-refund", "video-a")
	require.NoError(t, err)
	assert.Equal(t, "refunded", got.SettleStatus)
	assert.Equal(t, int64(3000), got.RefundQuota)
	assert.Zero(t, got.SettledQuota)
	assert.Equal(t, `{"mode":"per_second"}`, got.PriceContract)
	assert.Contains(t, got.UsageBreakdown, `"seconds":5`)
}

func TestTaskSnapshotUsesDurableTaskIDForSettlement(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.BillingPriceSnapshot{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })

	info := &relaycommon.RelayInfo{
		RequestId: "req-task-9", OriginModelName: "video-a",
		ChannelPricingApplied: true, ChannelPricingVersion: "sale-v1",
		ChannelPricingContractJSON: `{"mode":"per_second"}`,
	}
	info.ChannelMeta = &relaycommon.ChannelMeta{ChannelId: 3}
	RecordBillingPriceSnapshotForTask(info, "task-9", nil)

	got, err := model.GetBillingPriceSnapshot("req-task-9", "task-9", "video-a")
	require.NoError(t, err)
	assert.Equal(t, "pending", got.SettleStatus)
	require.NotEmpty(t, got.PriceContractHash)

	require.NoError(t, model.UpdateBillingPriceSnapshotSettlement("req-task-9", "task-9", "video-a", model.SettlementPatch{
		PreConsumed: 100, Settled: 80, Refund: 20, Status: "settled",
	}))
	got, err = model.GetBillingPriceSnapshot("req-task-9", "task-9", "video-a")
	require.NoError(t, err)
	assert.Equal(t, "settled", got.SettleStatus)
	assert.Equal(t, int64(20), got.RefundQuota)
}

// 采购成本按维度记账：每个被计量的维度单独入账，缺失价格的维度不得显示成
// 已验证毛利，Quota 只作为额度变动随条目保留。
func TestBillingFinancialsBookCostByDimension(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.BillingPriceSnapshot{}, &model.BillingCostBreakdown{}, &model.BillingFinancialLedger{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })

	snapshot := &model.BillingPriceSnapshot{
		RequestId: "req-fin-1", ModelName: "gpt-a", ChannelId: 5, UserId: 7,
		PriceSource: "contract-a",
		PurchaseContract: `{"pricing":{"mode":"per_1m_token",` +
			`"input_per_million_usd":1,"output_per_million_usd":2,` +
			`"cache_per_million_usd":0.1,"create_cache_per_million_usd":1.25,` +
			`"audio_input_per_million_usd":3,"audio_output_per_million_usd":6},` +
			`"verified":true,"source":"contract-a"}`,
	}
	usage := `{"prompt_tokens":1000000,"completion_tokens":500000,` +
		`"cache_read_tokens":100000,"cache_creation_tokens":50000,` +
		`"audio_input_tokens":10000,"audio_output_tokens":5000}`

	recordRequestFinancials(snapshot, usage, 1_000_000, 0)

	rows, err := model.ListBillingCostBreakdowns("req-fin-1", "", "gpt-a")
	require.NoError(t, err)
	require.Len(t, rows, 6)
	byDimension := map[string]model.BillingCostBreakdown{}
	for _, row := range rows {
		byDimension[row.Dimension] = row
	}
	// prompt(1M) 扣掉 cache 读写后按纯 input 计价。
	assert.InDelta(t, 850_000, byDimension["input"].Quantity, 1e-6)
	assert.InDelta(t, 0.85, byDimension["input"].AmountUSD.Float64(), 1e-9)
	assert.InDelta(t, 1.0, byDimension["output"].AmountUSD.Float64(), 1e-9)
	assert.InDelta(t, 0.01, byDimension["cache_read"].AmountUSD.Float64(), 1e-9)
	assert.InDelta(t, 0.0625, byDimension["cache_write"].AmountUSD.Float64(), 1e-9)
	assert.InDelta(t, 0.03, byDimension["audio_input"].AmountUSD.Float64(), 1e-9)
	assert.InDelta(t, 0.03, byDimension["audio_output"].AmountUSD.Float64(), 1e-9)
	for _, row := range rows {
		assert.True(t, row.Verified, row.Dimension)
		assert.Empty(t, row.Issue, row.Dimension)
	}

	summary, err := model.SummarizeBillingFinancials("req-fin-1", "", "gpt-a")
	require.NoError(t, err)
	// 1,000,000 quota = $2.00 sale; cost 1.9825.
	assert.InDelta(t, 2.0, summary.SaleUSD.Float64(), 1e-9)
	assert.Zero(t, summary.RefundUSD)
	assert.InDelta(t, 1.9825, summary.CostUSD.Float64(), 1e-9)
	assert.InDelta(t, 0.0175, summary.GrossProfitUSD.Float64(), 1e-9)
	assert.True(t, summary.CostVerified)
	assert.Equal(t, model.BillingLedgerStatusVerified, summary.GrossProfitState)

	// 重复结算不得重复入账。
	recordRequestFinancials(snapshot, usage, 1_000_000, 0)
	entries, err := model.ListBillingLedgerEntries("req-fin-1", "", "gpt-a")
	require.NoError(t, err)
	assert.Len(t, entries, 2)

	// 退款单独入账，并保留额度变动。
	recordRequestFinancials(snapshot, "", 0, 1_000_000)
	summary, err = model.SummarizeBillingFinancials("req-fin-1", "", "gpt-a")
	require.NoError(t, err)
	assert.InDelta(t, 2.0, summary.RefundUSD.Float64(), 1e-9)
	assert.InDelta(t, -1.9825, summary.GrossProfitUSD.Float64(), 1e-9)
}

func TestBillingFinancialsFlagMissingPurchaseDimension(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.BillingPriceSnapshot{}, &model.BillingCostBreakdown{}, &model.BillingFinancialLedger{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })

	snapshot := &model.BillingPriceSnapshot{
		RequestId: "req-fin-missing", ModelName: "gpt-b",
		PurchaseContract: `{"pricing":{"mode":"per_1m_token","input_per_million_usd":1},"verified":true}`,
	}
	recordRequestFinancials(snapshot, `{"prompt_tokens":1000,"completion_tokens":1000}`, 2_000, 0)

	rows, err := model.ListBillingCostBreakdowns("req-fin-missing", "", "gpt-b")
	require.NoError(t, err)
	require.Len(t, rows, 2)
	for _, row := range rows {
		if row.Dimension == "output" {
			assert.False(t, row.Verified)
			assert.Equal(t, "purchase_missing", row.Issue)
			assert.True(t, row.AmountUSD.IsZero())
		}
	}

	summary, err := model.SummarizeBillingFinancials("req-fin-missing", "", "gpt-b")
	require.NoError(t, err)
	assert.False(t, summary.CostVerified)
	assert.Equal(t, model.BillingLedgerStatusPendingPurchase, summary.GrossProfitState)
}

// 纯倍率异步任务也必须有可审计凭证：冻结提交时的倍率组合，结算与退款记入
// 财务流水；同步请求保持原门槛，不额外增加写放大。
func TestTaskRatioModeSnapshotIsAuditable(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.BillingPriceSnapshot{}, &model.BillingCostBreakdown{}, &model.BillingFinancialLedger{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })

	info := &relaycommon.RelayInfo{
		RequestId: "req-ratio-plain", OriginModelName: "gpt-plain", UserId: 7,
		FinalPreConsumedQuota: 2000,
	}
	info.ChannelMeta = &relaycommon.ChannelMeta{ChannelId: 9}
	info.PriceData.ModelRatio = 1.5
	info.PriceData.CompletionRatio = 2
	info.PriceData.GroupRatioInfo.GroupRatio = 0.8

	RecordBillingPriceSnapshotForTask(info, "task-ratio-plain", nil)

	got, err := model.GetBillingPriceSnapshot("req-ratio-plain", "task-ratio-plain", "gpt-plain")
	require.NoError(t, err)
	assert.Equal(t, "ratio", got.BillingMode)
	assert.Contains(t, got.PriceContract, `"model_ratio":1.5`)
	assert.Contains(t, got.PriceContract, `"group_ratio":0.8`)
	assert.NotEmpty(t, got.PriceContractHash)
	assert.InDelta(t, 0.8, got.GroupRatio, 1e-9)
	assert.Equal(t, model.BillingSnapshotStatusPending, got.SettleStatus)

	require.NoError(t, model.UpdateBillingPriceSnapshotSettlement("req-ratio-plain", "task-ratio-plain", "gpt-plain", model.SettlementPatch{
		PreConsumed: 2000, Settled: 1500, Refund: 500, Status: model.BillingSnapshotStatusSettled,
	}))
	snapshot, err := model.GetBillingPriceSnapshot("req-ratio-plain", "task-ratio-plain", "gpt-plain")
	require.NoError(t, err)
	recordRequestFinancials(snapshot, `{"prompt_tokens":100}`, 1500, 500)

	summary, err := model.SummarizeBillingFinancials("req-ratio-plain", "task-ratio-plain", "gpt-plain")
	require.NoError(t, err)
	assert.InDelta(t, 1500.0/500_000, summary.SaleUSD.Float64(), 1e-9)
	assert.InDelta(t, 500.0/500_000, summary.RefundUSD.Float64(), 1e-9)
	assert.Zero(t, summary.CostUSD)
	assert.Equal(t, model.BillingLedgerStatusPendingPurchase, summary.GrossProfitState)

	// A synchronous ratio request still writes no voucher.
	syncInfo := &relaycommon.RelayInfo{RequestId: "req-ratio-sync", OriginModelName: "gpt-plain"}
	RecordBillingPriceSnapshotForTask(syncInfo, "", nil)
	_, err = model.GetBillingPriceSnapshot("req-ratio-sync", "", "gpt-plain")
	require.Error(t, err)
}

// 采购合同为计费表达式时，成本必须按真实用量求值，而不是被当作缺价。
func TestBillingFinancialsPriceExpressionPurchaseContract(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.BillingPriceSnapshot{}, &model.BillingCostBreakdown{}, &model.BillingFinancialLedger{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })

	tokenContract := &model.BillingPriceSnapshot{
		RequestId: "req-cost-expr", ModelName: "gpt-a",
		PurchaseContract: `{"pricing":{"mode":"tiered_expr","billing_expr":"tier(\"base\", p * 1 + c * 2 + cr * 0.1)"},"verified":true,"source":"contract"}`,
	}
	recordRequestFinancials(tokenContract, `{"prompt_tokens":1000,"completion_tokens":500,"cache_read_tokens":200}`, 2_000, 0)
	rows, err := model.ListBillingCostBreakdowns("req-cost-expr", "", "gpt-a")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, "expression", rows[0].Dimension)
	assert.InDelta(t, 0.00182, rows[0].AmountUSD.Float64(), 1e-9)
	assert.True(t, rows[0].Verified)
	summary, err := model.SummarizeBillingFinancials("req-cost-expr", "", "gpt-a")
	require.NoError(t, err)
	assert.True(t, summary.CostVerified)

	imageContract := &model.BillingPriceSnapshot{
		RequestId: "req-cost-img", ModelName: "img-a",
		PurchaseContract: `{"pricing":{"mode":"tiered_expr","billing_expr":"tier(\"base\", fixed(0.05)) * image_count"},"verified":true,"source":"contract"}`,
	}
	recordRequestFinancials(imageContract, `{"image_count":3}`, 30_000, 0)
	rows, err = model.ListBillingCostBreakdowns("req-cost-img", "", "img-a")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.InDelta(t, 0.15, rows[0].AmountUSD.Float64(), 1e-9)

	unverified := &model.BillingPriceSnapshot{
		RequestId: "req-cost-unverified", ModelName: "gpt-b",
		PurchaseContract: `{"pricing":{"mode":"tiered_expr","billing_expr":"tier(\"base\", p * 1)"},"verified":false,"source":"quote"}`,
	}
	recordRequestFinancials(unverified, `{"prompt_tokens":1000}`, 1_000, 0)
	rows, err = model.ListBillingCostBreakdowns("req-cost-unverified", "", "gpt-b")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, "purchase_unverified", rows[0].Issue)
	summary, err = model.SummarizeBillingFinancials("req-cost-unverified", "", "gpt-b")
	require.NoError(t, err)
	assert.False(t, summary.CostVerified)
	assert.Equal(t, model.BillingLedgerStatusPendingPurchase, summary.GrossProfitState)
}

func TestBillingFinancialSummaryUsesDecimalAccumulation(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.BillingCostBreakdown{}, &model.BillingFinancialLedger{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })

	entries := []model.BillingFinancialLedger{
		{EntryKey: "sale-a|req-decimal-sum|gpt-dec|", EntryType: model.BillingLedgerEntrySale,
			RequestId: "req-decimal-sum", ModelName: "gpt-dec", AmountUSD: model.MoneyFromFloat(0.1)},
		{EntryKey: "sale-b|req-decimal-sum|gpt-dec|", EntryType: model.BillingLedgerEntrySale,
			RequestId: "req-decimal-sum", ModelName: "gpt-dec", AmountUSD: model.MoneyFromFloat(0.2)},
		{EntryKey: "refund-a|req-decimal-sum|gpt-dec|", EntryType: model.BillingLedgerEntryRefund,
			RequestId: "req-decimal-sum", ModelName: "gpt-dec", AmountUSD: model.MoneyFromFloat(-0.05)},
		{EntryKey: "cost-a|req-decimal-sum|gpt-dec|", EntryType: model.BillingLedgerEntryPurchaseCost,
			RequestId: "req-decimal-sum", ModelName: "gpt-dec", AmountUSD: model.MoneyFromFloat(0.07),
			Status: model.BillingLedgerStatusVerified},
	}
	for _, entry := range entries {
		require.NoError(t, model.SaveBillingLedgerEntry(entry))
	}

	summary, err := model.SummarizeBillingFinancials("req-decimal-sum", "", "gpt-dec")
	require.NoError(t, err)
	assert.Equal(t, "0.3", summary.SaleUSD.String())
	assert.Equal(t, "0.05", summary.RefundUSD.String())
	assert.Equal(t, "0.07", summary.CostUSD.String())
	assert.Equal(t, "0.18", summary.GrossProfitUSD.String())
}

func TestBillingFinancialsCostUsesDecimalForTokenPrices(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.BillingPriceSnapshot{}, &model.BillingCostBreakdown{}, &model.BillingFinancialLedger{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })

	snapshot := &model.BillingPriceSnapshot{
		RequestId: "req-decimal-cost", ModelName: "gpt-dec-cost",
		PurchaseContract: `{"pricing":{"mode":"per_1m_token","input_per_million_usd":0.1,"output_per_million_usd":0.2},"verified":true,"source":"contract"}`,
	}
	recordRequestFinancials(snapshot,
		`{"prompt_tokens":1000000,"completion_tokens":1000000}`, 0, 0)

	rows, err := model.ListBillingCostBreakdowns("req-decimal-cost", "", "gpt-dec-cost")
	require.NoError(t, err)
	require.Len(t, rows, 2)
	byDimension := map[string]model.BillingCostBreakdown{}
	for _, row := range rows {
		byDimension[row.Dimension] = row
	}
	assert.Equal(t, 0.1, byDimension["input"].AmountUSD.Float64())
	assert.Equal(t, 0.2, byDimension["output"].AmountUSD.Float64())

	summary, err := model.SummarizeBillingFinancials("req-decimal-cost", "", "gpt-dec-cost")
	require.NoError(t, err)
	assert.Equal(t, "0.3", summary.CostUSD.String())
	assert.Equal(t, "-0.3", summary.GrossProfitUSD.String())
}
