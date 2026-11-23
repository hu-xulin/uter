//go:build pricing_audit_live

package service

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/joho/godotenv"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	billingexpr "github.com/uter-ai/uter/pkg/billingexpr"
	"github.com/uter-ai/uter/pkg/testdb"
)

func auditInit(t *testing.T) {
	t.Helper()
	_ = godotenv.Load("../.env")
	abs, _ := os.Getwd()
	require.NoError(t, os.Setenv("SQLITE_PATH", testdb.LiveDBForTest(t, abs+"/../one-api.db")))
	common.InitEnv()
	require.NoError(t, model.InitDB())
	model.InitOptionMap()
}

func auditInternal(t *testing.T, raw string) (string, bool) {
	if strings.TrimSpace(raw) == "" {
		return "", false
	}
	var internal model.ChannelInternalPricing
	if err := common.UnmarshalJsonStr(raw, &internal); err != nil {
		return "unparsable", false
	}
	pricing, err := model.NormalizeChannelInternalPricing(&internal)
	if err != nil {
		return "normalize:" + err.Error(), false
	}
	switch pricing.Mode {
	case model.ChannelPricingModeTieredExpr:
		two := 2
		facts := map[string]any{"duration": 5.0, "image_count": 2.0, "seconds": 5.0}
		for key := range billingexpr.UsedUsageKeys(pricing.BillingExpr) {
			if _, ok := facts[key]; ok {
				continue
			}
			switch {
			case key == "prompt_extend" || strings.HasPrefix(key, "is_") || strings.HasPrefix(key, "has_"):
				facts[key] = true
			case strings.Contains(key, "type") || strings.Contains(key, "resolution") ||
				strings.Contains(key, "size") || strings.Contains(key, "mode"):
				facts[key] = "standard"
			default:
				facts[key] = 2.0
			}
		}
		snapshot := &billingexpr.BillingSnapshot{
			BillingMode: "tiered_expr", ExprString: pricing.BillingExpr,
			ExprHash: billingexpr.ExprHashString(pricing.BillingExpr), GroupRatio: 1,
			QuotaPerUnit: 500000, TaskUsageBilling: true,
			UsageFacts: facts,
		}
		res, err := billingexpr.ComputeTieredQuotaWithRequest(snapshot,
			billingexpr.TokenParams{P: 1000, C: 500, Len: 1500, CR: 100, CC: 50},
			billingexpr.RequestInput{Duration: floatPtr(5), ImageCount: &two, Usage: facts},
		)
		if err != nil && strings.Contains(err.Error(), "fixed pricing is not supported for task usage") {
			// Synchronous image generations use a fixed per-request price, not
			// task usage billing. Validate the same expression on that path.
			snapshot.TaskUsageBilling = false
			res, err = billingexpr.ComputeTieredQuotaWithRequest(snapshot,
				billingexpr.TokenParams{P: 1000, C: 500, Len: 1500, CR: 100, CC: 50},
				billingexpr.RequestInput{Duration: floatPtr(5), ImageCount: &two, Usage: snapshot.UsageFacts},
			)
		}
		if err != nil {
			return "exec:" + err.Error(), false
		}
		if res.ActualQuotaAfterGroup <= 0 {
			return "zero-quota", false
		}
		return "ok", true
	case model.ChannelPricingModePerMillionTokens:
		if pricing.ModelRatio <= 0 {
			return "nonpositive-ratio", false
		}
		return "ok", true
	case model.ChannelPricingModePerCall, model.ChannelPricingModePerSecond, model.ChannelPricingModePerMinute:
		if !pricing.UsePrice && !pricing.UsePerSecond {
			return "no-price", false
		}
		return "ok", true
	}
	return "mode:" + pricing.Mode, false
}

func floatPtr(v float64) *float64 { return &v }

func TestAuditUterRouteLive(t *testing.T) {
	if os.Getenv("PRICING_AUDIT") == "" {
		t.Skip("set PRICING_AUDIT=1")
	}
	auditInit(t)
	channel, err := model.GetChannelById(32, true)
	require.NoError(t, err)
	snapshot, err := FetchUterRouteUpstream(context.Background(), "")
	require.NoError(t, err)
	records, err := UterRouteChannelPricingRecords(snapshot, channel.Id, channel.GetModels(), GetUterRouteDiscountGroup(channel.Id))
	require.NoError(t, err)

	counts := map[string]int{}
	reasons := map[string]int{}
	failures := []string{}
	withInternal, execOK := 0, 0
	for _, record := range records {
		if record.InternalPricing != "" {
			withInternal++
		}
		var view model.ChannelOfficialPricing
		if common.UnmarshalJsonStr(record.NormalizedPricing, &view) == nil {
			if view.NeedsReview {
				counts["needs_review"]++
			}
			counts["kind:"+view.PriceKind]++
			for _, reason := range view.ReviewReasons {
				reasons[reason]++
			}
		}
		mode, ok := auditInternal(t, record.InternalPricing)
		if ok {
			execOK++
		} else if mode != "" {
			failures = append(failures, record.ModelName+": "+mode)
		} else {
			counts["no_internal"]++
		}
	}
	t.Logf("uterroute: records=%d with_internal=%d exec_ok=%d counts=%v reasons=%v failures=%v",
		len(records), withInternal, execOK, counts, reasons, failures)
}

func TestAuditBailianLive(t *testing.T) {
	if os.Getenv("PRICING_AUDIT") == "" {
		t.Skip("set PRICING_AUDIT=1")
	}
	auditInit(t)
	channels, err := model.GetAllChannels(0, 1000, true, true)
	require.NoError(t, err)
	var channel *model.Channel
	for _, candidate := range channels {
		if candidate.Type == constant.ChannelTypeAli && candidate.Status == 1 {
			channel = candidate
			break
		}
	}
	require.NotNil(t, channel)
	key, _, apiErr := channel.GetNextEnabledKey()
	require.Nil(t, apiErr)
	catalog, err := FetchBailianCatalog(context.Background(), channel.GetBaseURL(), key)
	require.NoError(t, err)
	catalog.Region = BailianRegionOf(channel.GetBaseURL())
	records := BailianPricingRecords(catalog, channel.GetModels())

	counts := map[string]int{}
	reasons := map[string]int{}
	failures := []string{}
	withInternal, execOK := 0, 0
	fresh := map[string]bool{}
	for _, record := range records {
		fresh[record.ModelName] = true
		var view model.ChannelOfficialPricing
		_ = common.UnmarshalJsonStr(record.NormalizedPricing, &view)
		internal := bailianInternalPricing(view)
		if internal != "" {
			withInternal++
		}
		counts["kind:"+view.PriceKind]++
		if view.NeedsReview {
			counts["needs_review"]++
		}
		for _, reason := range view.ReviewReasons {
			reasons[reason]++
		}
		mode, ok := auditInternal(t, internal)
		if ok {
			execOK++
		} else if mode != "" {
			failures = append(failures, record.ModelName+": "+mode)
		} else {
			counts["no_internal"]++
		}
	}
	rows, _ := model.ListChannelModelPricing(channel.Id)
	stale := 0
	for _, row := range rows {
		if row.InternalPricing != "" && !fresh[row.ModelName] {
			stale++
		}
	}
	t.Logf("bailian: catalog=%d records=%d with_internal=%d exec_ok=%d stale_rows=%d counts=%v reasons=%v failures=%v",
		len(catalog.Models), len(records), withInternal, execOK, stale, counts, reasons, failures)
}

func TestAuditUterAPILive(t *testing.T) {
	if os.Getenv("PRICING_AUDIT") == "" {
		t.Skip("set PRICING_AUDIT=1")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	payload, err := fetchUterAPIPricingPayload(ctx, uterapiPricingURL(), "")
	require.NoError(t, err)
	quota := genericQuotaPerUnit(GenericPricingEntry{}, payload)
	models := GenericModelNames(payload.Data)
	records := GenericChannelPricingRecordsWithQuota(0, models, payload.Data, time.Now().UTC(), quota)

	counts := map[string]int{}
	reasons := map[string]int{}
	failures := []string{}
	withInternal, execOK := 0, 0
	for _, record := range records {
		if record.InternalPricing != "" {
			withInternal++
		}
		var view model.ChannelOfficialPricing
		if common.UnmarshalJsonStr(record.NormalizedPricing, &view) == nil {
			counts["kind:"+view.PriceKind]++
			if view.NeedsReview {
				counts["needs_review"]++
			}
			for _, reason := range view.ReviewReasons {
				reasons[reason]++
			}
		}
		mode, ok := auditInternal(t, record.InternalPricing)
		if ok {
			execOK++
		} else if mode != "" {
			failures = append(failures, record.ModelName+": "+mode)
		} else {
			counts["no_internal"]++
		}
	}
	t.Logf("uterapi: models=%d quota_per_unit=%v groups=%d records=%d with_internal=%d exec_ok=%d counts=%v reasons=%v failures=%v",
		len(models), payload.QuotaPerUnit, len(payload.GroupRatio), len(records), withInternal, execOK, counts, reasons, failures)
}
