package service

import (
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/pkg/billingexpr"
)

const (
	UpstreamSampleMatched     = "MATCHED"
	UpstreamSampleMismatched  = "MISMATCHED"
	UpstreamSampleNoPrice     = "NO_PRICE"
	UpstreamSampleNoRequest   = "NO_REQUEST"
	UpstreamSampleNoCost      = "NO_COST"
	UpstreamSampleUnsupported = "UNSUPPORTED"
)

type UpstreamBillingSample struct {
	ModelName string `json:"model_name"`
	// RequestId/BillingLineId tie one supplier invoice line to Uter's own
	// record. When RequestId is set the reconciliation compares the frozen
	// purchase cost of that request instead of re-pricing the catalogue row.
	RequestId           string  `json:"request_id,omitempty"`
	BillingLineId       string  `json:"billing_line_id,omitempty"`
	InputTokens         float64 `json:"input_tokens,omitempty"`
	OutputTokens        float64 `json:"output_tokens,omitempty"`
	CacheReadTokens     float64 `json:"cache_read_tokens,omitempty"`
	CacheCreationTokens float64 `json:"cache_creation_tokens,omitempty"`
	ImageCount          int     `json:"image_count,omitempty"`
	DurationSeconds     float64 `json:"duration_seconds,omitempty"`
	UpstreamCostUSD     float64 `json:"upstream_cost_usd"`
}

type UpstreamBillingSampleResult struct {
	ModelName       string  `json:"model_name"`
	RequestId       string  `json:"request_id,omitempty"`
	BillingLineId   string  `json:"billing_line_id,omitempty"`
	Status          string  `json:"status"`
	UterCostUSD     float64 `json:"uter_cost_usd"`
	UpstreamCostUSD float64 `json:"upstream_cost_usd"`
	DifferenceUSD   float64 `json:"difference_usd"`
	DifferencePct   float64 `json:"difference_pct"`
	Reason          string  `json:"reason,omitempty"`
}

type UpstreamBillingSampleReport struct {
	ChannelID int                           `json:"channel_id"`
	Summary   map[string]int                `json:"summary"`
	Results   []UpstreamBillingSampleResult `json:"results"`
}

// ReconcileUpstreamBillingSamples compares actual upstream charges supplied by
// the operator with Uter's configured channel price. It is intentionally
// read-only and never changes a price.
func ReconcileUpstreamBillingSamples(channel *model.Channel, samples []UpstreamBillingSample) (UpstreamBillingSampleReport, error) {
	if channel == nil {
		return UpstreamBillingSampleReport{}, errors.New("channel is required")
	}
	report := UpstreamBillingSampleReport{ChannelID: channel.Id, Summary: map[string]int{}, Results: make([]UpstreamBillingSampleResult, 0, len(samples))}
	baseURL := channel.GetBaseURL()
	deploymentID := channel.GetOtherSettings().DeploymentID
	for _, sample := range samples {
		name := strings.TrimSpace(sample.ModelName)
		result := UpstreamBillingSampleResult{
			ModelName: name, RequestId: strings.TrimSpace(sample.RequestId),
			BillingLineId:   strings.TrimSpace(sample.BillingLineId),
			UpstreamCostUSD: sample.UpstreamCostUSD,
		}
		if result.RequestId != "" {
			result = reconcileSampleByRequestId(channel, sample, result)
			report.Summary[result.Status]++
			report.Results = append(report.Results, result)
			continue
		}
		identity := ChannelPricingIdentityForRequest(channel.Type, baseURL, deploymentID, name)
		identity.ChannelId = channel.Id
		effective := model.ResolveEffectiveChannelPricingFor(identity)
		if !effective.Exists || effective.Reason != "" || !effective.Billable {
			result.Status = UpstreamSampleNoPrice
			result.Reason = effective.Reason
			if !effective.Exists {
				result.Reason = "channel price is not configured for this model"
			}
			report.Summary[result.Status]++
			report.Results = append(report.Results, result)
			continue
		}
		row, err := model.GetChannelModelPricingFor(identity)
		if err != nil {
			result.Status = UpstreamSampleNoPrice
			result.Reason = err.Error()
			report.Summary[result.Status]++
			report.Results = append(report.Results, result)
			continue
		}
		var internal model.ChannelInternalPricing
		if err := common.UnmarshalJsonStr(row.InternalPricing, &internal); err != nil {
			result.Status = UpstreamSampleUnsupported
			result.Reason = "internal pricing is not parseable"
			report.Summary[result.Status]++
			report.Results = append(report.Results, result)
			continue
		}
		cost, err := sampleUterCostUSD(internal, sample)
		if err != nil {
			result.Status = UpstreamSampleUnsupported
			result.Reason = err.Error()
			report.Summary[result.Status]++
			report.Results = append(report.Results, result)
			continue
		}
		result.UterCostUSD = cost
		result.DifferenceUSD = cost - sample.UpstreamCostUSD
		if sample.UpstreamCostUSD > 0 {
			result.DifferencePct = result.DifferenceUSD / sample.UpstreamCostUSD * 100
		}
		tolerance := math.Max(0.000001, math.Abs(sample.UpstreamCostUSD)*0.001)
		if math.Abs(result.DifferenceUSD) <= tolerance {
			result.Status = UpstreamSampleMatched
		} else {
			result.Status = UpstreamSampleMismatched
		}
		report.Summary[result.Status]++
		report.Results = append(report.Results, result)
	}
	return report, nil
}

// reconcileSampleByRequestId matches one invoice line to the immutable billing
// voucher of the request it claims to bill. Cost is taken from the frozen
// per-dimension purchase rows, never re-priced from the current catalogue.
func reconcileSampleByRequestId(channel *model.Channel, sample UpstreamBillingSample, result UpstreamBillingSampleResult) UpstreamBillingSampleResult {
	snapshot, err := model.GetBillingPriceSnapshotByRequest(result.RequestId, result.ModelName)
	if err != nil {
		result.Status = UpstreamSampleNoRequest
		result.Reason = "no Uter billing snapshot for this request id"
		return result
	}
	if snapshot.ChannelId != 0 && snapshot.ChannelId != channel.Id {
		result.Status = UpstreamSampleMismatched
		result.Reason = fmt.Sprintf("request belongs to channel %d, invoice is channel %d", snapshot.ChannelId, channel.Id)
		return result
	}
	if reason := billingUsageMismatchReason(snapshot.UsageBreakdown, sample); reason != "" {
		result.Status = UpstreamSampleMismatched
		result.Reason = reason
		return result
	}
	rows, err := model.ListBillingCostBreakdownsByRequest(result.RequestId, result.ModelName)
	if err != nil {
		result.Status = UpstreamSampleUnsupported
		result.Reason = err.Error()
		return result
	}
	if len(rows) == 0 {
		result.Status = UpstreamSampleNoCost
		result.Reason = "purchase cost snapshot is missing for this request"
		return result
	}
	cost := 0.0
	for _, row := range rows {
		cost += row.AmountUSD
	}
	result.UterCostUSD = cost
	result.DifferenceUSD = cost - sample.UpstreamCostUSD
	if sample.UpstreamCostUSD > 0 {
		result.DifferencePct = result.DifferenceUSD / sample.UpstreamCostUSD * 100
	}
	tolerance := math.Max(0.000001, math.Abs(sample.UpstreamCostUSD)*0.001)
	if math.Abs(result.DifferenceUSD) <= tolerance {
		result.Status = UpstreamSampleMatched
	} else {
		result.Status = UpstreamSampleMismatched
	}
	return result
}

// billingUsageMismatchReason compares the quantities the supplier billed with
// the quantities Uter recorded. Only quantities present in the invoice line are
// asserted; a missing field is not a mismatch.
func billingUsageMismatchReason(usageBreakdown string, sample UpstreamBillingSample) string {
	if strings.TrimSpace(usageBreakdown) == "" {
		return ""
	}
	usage := map[string]any{}
	if err := common.UnmarshalJsonStr(usageBreakdown, &usage); err != nil {
		return ""
	}
	check := func(label string, recordedKeys []string, invoiced float64) string {
		recorded, ok := usageAmount(usage, recordedKeys...)
		if !ok || math.Abs(recorded-invoiced) <= math.Max(1, invoiced*0.01) {
			return ""
		}
		return fmt.Sprintf("%s differs: Uter %.0f, invoice %.0f", label, recorded, invoiced)
	}
	if sample.InputTokens > 0 {
		if reason := check("input tokens", []string{"prompt_tokens", "input_tokens"}, sample.InputTokens); reason != "" {
			return reason
		}
	}
	if sample.OutputTokens > 0 {
		if reason := check("output tokens", []string{"completion_tokens", "output_tokens"}, sample.OutputTokens); reason != "" {
			return reason
		}
	}
	if sample.CacheReadTokens > 0 {
		if reason := check("cache read tokens", []string{"cache_read_tokens", "cached_tokens"}, sample.CacheReadTokens); reason != "" {
			return reason
		}
	}
	if sample.CacheCreationTokens > 0 {
		if reason := check("cache write tokens", []string{"cache_creation_tokens", "cache_write_tokens"}, sample.CacheCreationTokens); reason != "" {
			return reason
		}
	}
	if sample.ImageCount > 0 {
		if reason := check("image count", []string{"image_count"}, float64(sample.ImageCount)); reason != "" {
			return reason
		}
	}
	if sample.DurationSeconds > 0 {
		if reason := check("duration seconds", []string{"seconds", "duration_seconds", "duration"}, sample.DurationSeconds); reason != "" {
			return reason
		}
	}
	return ""
}

// usageAmount reads the first present key as a number.
func usageAmount(usage map[string]any, keys ...string) (float64, bool) {
	for _, key := range keys {
		value, ok := usage[key]
		if !ok {
			continue
		}
		switch typed := value.(type) {
		case float64:
			return typed, true
		case int:
			return float64(typed), true
		case int64:
			return float64(typed), true
		}
	}
	return 0, false
}

func sampleUterCostUSD(pricing model.ChannelInternalPricing, sample UpstreamBillingSample) (float64, error) {
	switch pricing.Mode {
	case model.ChannelPricingModePerMillionTokens:
		if pricing.InputUSDPerMillion == nil || pricing.OutputUSDPerMillion == nil {
			return 0, errors.New("token price is incomplete")
		}
		cost := sample.InputTokens / 1_000_000 * *pricing.InputUSDPerMillion
		cost += sample.OutputTokens / 1_000_000 * *pricing.OutputUSDPerMillion
		if pricing.CacheUSDPerMillion != nil {
			cost += sample.CacheReadTokens / 1_000_000 * *pricing.CacheUSDPerMillion
		}
		if pricing.CreateCacheUSDPerMillion != nil {
			cost += sample.CacheCreationTokens / 1_000_000 * *pricing.CreateCacheUSDPerMillion
		}
		return cost, nil
	case model.ChannelPricingModePerCall:
		if pricing.PerCallUSD == nil {
			return 0, errors.New("per-call price is missing")
		}
		count := math.Max(1, float64(sample.ImageCount))
		if sample.ImageCount == 0 {
			count = 1
		}
		return *pricing.PerCallUSD * count, nil
	case model.ChannelPricingModePerSecond:
		if pricing.PerSecondUSD == nil || sample.DurationSeconds <= 0 {
			return 0, errors.New("per-second price or duration is missing")
		}
		return *pricing.PerSecondUSD * sample.DurationSeconds, nil
	case model.ChannelPricingModePerMinute:
		if pricing.PerMinuteUSD == nil || sample.DurationSeconds <= 0 {
			return 0, errors.New("per-minute price or duration is missing")
		}
		return *pricing.PerMinuteUSD * sample.DurationSeconds / 60, nil
	case model.ChannelPricingModeTieredExpr, model.ChannelPricingModeTieredTable:
		expression := pricing.BillingExpr
		if strings.TrimSpace(expression) == "" {
			if billing, err := model.NormalizeChannelInternalPricing(&pricing); err == nil {
				expression = billing.BillingExpr
			}
		}
		if strings.TrimSpace(expression) == "" {
			return 0, errors.New("billing expression is missing")
		}
		cost, _, err := billingexpr.RunExprByHashWithRequest(
			expression, billingexpr.ExprHashString(expression),
			billingexpr.TokenParams{
				P: sample.InputTokens, C: sample.OutputTokens,
				Len: sample.InputTokens + sample.CacheReadTokens + sample.CacheCreationTokens,
				CR:  sample.CacheReadTokens, CC: sample.CacheCreationTokens,
			},
			billingexpr.RequestInput{Duration: &sample.DurationSeconds, ImageCount: &sample.ImageCount},
		)
		return cost, err
	default:
		return 0, errors.New("unsupported internal pricing mode")
	}
}
