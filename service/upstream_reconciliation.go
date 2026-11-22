package service

import (
	"errors"
	"math"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/pkg/billingexpr"
)

type UpstreamReconciliationScenario struct {
	Name        string  `json:"name"`
	Quota       int     `json:"quota,omitempty"`
	BeforeGroup float64 `json:"before_group,omitempty"`
	Tier        string  `json:"tier,omitempty"`
	Executed    bool    `json:"executed"`
	Error       string  `json:"error,omitempty"`
}

type UpstreamReconciliationModel struct {
	ModelName      string                           `json:"model_name"`
	PricingStatus  string                           `json:"pricing_status"`
	ExpressionHash string                           `json:"expression_hash,omitempty"`
	Status         string                           `json:"status"`
	Scenarios      []UpstreamReconciliationScenario `json:"scenarios,omitempty"`
	Error          string                           `json:"error,omitempty"`
}

type UpstreamReconciliationReport struct {
	ChannelID        int                           `json:"channel_id"`
	GeneratedAt      int64                         `json:"generated_at"`
	Status           string                        `json:"status"`
	Models           []UpstreamReconciliationModel `json:"models"`
	Summary          map[string]int                `json:"summary"`
	PriceChangeCount int                           `json:"price_change_count"`
	UpstreamInvoice  string                        `json:"upstream_invoice"`
	BlockedReason    string                        `json:"blocked_reason,omitempty"`
}

const (
	UpstreamReconcileRulesPassed = "RULES_PASSED"
	UpstreamReconcileRuleFailed  = "RULE_FAILED"
	UpstreamReconcileNoRule      = "NO_EXPRESSION_RULE"
	UpstreamReconcilePartial     = "PARTIALLY_VERIFIED"
)

// ReconcileChannelUpstreamBilling executes every configured expression with
// deterministic usage samples. It verifies that the rule can be executed and
// produces finite, non-negative charges. Provider invoice reconciliation is
// reported separately as BLOCKED because no authorized billing export exists.
func ReconcileChannelUpstreamBilling(channelID int) (UpstreamReconciliationReport, error) {
	if channelID <= 0 {
		return UpstreamReconciliationReport{}, errors.New("channel id is required")
	}
	rows, err := model.ListChannelModelPricing(channelID)
	if err != nil {
		return UpstreamReconciliationReport{}, err
	}
	report := UpstreamReconciliationReport{
		ChannelID: channelID, GeneratedAt: time.Now().UTC().Unix(),
		Status: UpstreamReconcileRulesPassed, Models: []UpstreamReconciliationModel{},
		Summary: map[string]int{}, PriceChangeCount: len(ListChannelPricingHistory(channelID)),
		UpstreamInvoice: "BLOCKED", BlockedReason: "no authorized upstream billing export is configured",
	}
	for _, row := range rows {
		item := UpstreamReconciliationModel{
			ModelName: row.ModelName, PricingStatus: row.PricingStatus,
			Status: UpstreamReconcileNoRule,
		}
		var internal model.ChannelInternalPricing
		if strings.TrimSpace(row.InternalPricing) == "" {
			report.Summary[item.Status]++
			report.Models = append(report.Models, item)
			continue
		}
		if err := common.UnmarshalJsonStr(row.InternalPricing, &internal); err != nil {
			item.Status = UpstreamReconcileRuleFailed
			item.Error = "internal pricing could not be parsed"
		} else if internal.Mode != model.ChannelPricingModeTieredExpr && internal.Mode != model.ChannelPricingModeTieredTable {
			report.Summary[item.Status]++
			report.Models = append(report.Models, item)
			continue
		} else {
			item.ExpressionHash = billingexpr.ExprHashString(internal.BillingExpr)
			item.Status, item.Scenarios, item.Error = reconcileExpression(internal.BillingExpr)
		}
		if item.Status == UpstreamReconcileRuleFailed {
			report.Status = UpstreamReconcilePartial
		}
		report.Summary[item.Status]++
		report.Models = append(report.Models, item)
	}
	if report.Summary[UpstreamReconcileRuleFailed] > 0 {
		report.Status = UpstreamReconcilePartial
	}
	return report, nil
}

func reconcileExpression(expr string) (string, []UpstreamReconciliationScenario, string) {
	hash := billingexpr.ExprHashString(expr)
	scenarios := []struct {
		name    string
		params  billingexpr.TokenParams
		request billingexpr.RequestInput
	}{
		{"short_context", billingexpr.TokenParams{P: 1000, C: 500, Len: 1500, CR: 100, CC: 50}, billingexpr.RequestInput{}},
		{"long_context", billingexpr.TokenParams{P: 150000, C: 1000, Len: 200000, CR: 1000, CC: 100}, billingexpr.RequestInput{}},
		{"media_task", billingexpr.TokenParams{}, billingexpr.RequestInput{Duration: floatPtrValue(5), ImageCount: intPtrValue(2), Usage: map[string]any{"duration": 5.0, "image_count": 2.0}}},
	}
	out := make([]UpstreamReconciliationScenario, 0, len(scenarios))
	for _, scenario := range scenarios {
		snapshot := &billingexpr.BillingSnapshot{
			BillingMode: "tiered_expr", ExprString: expr, ExprHash: hash,
			GroupRatio: 1, QuotaPerUnit: common.QuotaPerUnit, TaskUsageBilling: true,
			UsageFacts: scenario.request.Usage,
		}
		entry := UpstreamReconciliationScenario{Name: scenario.name}
		if billingexpr.UsesFixedPricingByHash(expr, hash) {
			// Task fixed pricing runs through the request path, not the tiered
			// token settle path; validating it with ComputeTieredQuota would
			// reject a rule the relay can actually execute.
			cost, trace, err := billingexpr.RunExprWithRequest(expr, scenario.params, scenario.request)
			if err != nil {
				entry.Error = err.Error()
			} else if math.IsNaN(cost) || math.IsInf(cost, 0) || cost < 0 {
				entry.Error = "expression produced an invalid charge"
			} else {
				entry.Executed = true
				entry.BeforeGroup = cost * common.QuotaPerUnit
				entry.Tier = trace.MatchedTier
				entry.Quota = common.QuotaRound(cost * common.QuotaPerUnit)
			}
		} else {
			result, err := billingexpr.ComputeTieredQuotaWithRequest(snapshot, scenario.params, scenario.request)
			if err != nil {
				entry.Error = err.Error()
			} else if math.IsNaN(result.ActualQuotaBeforeGroup) || math.IsInf(result.ActualQuotaBeforeGroup, 0) || result.ActualQuotaBeforeGroup < 0 {
				entry.Error = "expression produced an invalid charge"
			} else {
				entry.Executed = true
				entry.Quota = result.ActualQuotaAfterGroup
				entry.BeforeGroup = result.ActualQuotaBeforeGroup
				entry.Tier = result.MatchedTier
			}
		}
		out = append(out, entry)
	}
	for _, scenario := range out {
		if scenario.Error != "" {
			return UpstreamReconcileRuleFailed, out, scenario.Name + ": " + scenario.Error
		}
	}
	return UpstreamReconcileRulesPassed, out, ""
}

func floatPtrValue(value float64) *float64 { return &value }
func intPtrValue(value int) *int           { return &value }
