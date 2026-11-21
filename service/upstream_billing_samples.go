package service

import (
	"errors"
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
	UpstreamSampleUnsupported = "UNSUPPORTED"
)

type UpstreamBillingSample struct {
	ModelName           string  `json:"model_name"`
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
		result := UpstreamBillingSampleResult{ModelName: name, UpstreamCostUSD: sample.UpstreamCostUSD}
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
