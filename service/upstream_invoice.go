package service

import (
	"errors"
	"math"
	"strings"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// UpstreamInvoiceImportRequest is one supplier invoice import. Costs must be in
// USD; a non-USD invoice converts its amounts before import.
type UpstreamInvoiceImportRequest struct {
	Period   string                  `json:"period"`
	Currency string                  `json:"currency"`
	Source   string                  `json:"source"`
	Note     string                  `json:"note"`
	Rows     []UpstreamBillingSample `json:"rows"`
}

// UpstreamInvoiceRow keeps the supplier usage next to Uter's computed charge so
// the imported invoice can be re-audited without re-running the request.
type UpstreamInvoiceRow struct {
	UpstreamBillingSample
	Status        string  `json:"status"`
	UterCostUSD   float64 `json:"uter_cost_usd"`
	DifferenceUSD float64 `json:"difference_usd"`
	DifferencePct float64 `json:"difference_pct"`
	Reason        string  `json:"reason,omitempty"`
}

// UpstreamInvoiceImportResult is the stored invoice plus the reconciliation
// detail returned to the operator.
type UpstreamInvoiceImportResult struct {
	Invoice model.UpstreamBillingInvoice `json:"invoice"`
	Rows    []UpstreamInvoiceRow         `json:"rows"`
	Summary map[string]int               `json:"summary"`
}

// ImportUpstreamBillingInvoice validates, reconciles and persists one supplier
// invoice. It never changes any sale or purchase price.
func ImportUpstreamBillingInvoice(channel *model.Channel, req UpstreamInvoiceImportRequest) (UpstreamInvoiceImportResult, error) {
	var result UpstreamInvoiceImportResult
	if channel == nil {
		return result, errors.New("channel is required")
	}
	if len(req.Rows) == 0 {
		return result, errors.New("invoice has no rows")
	}
	if len(req.Rows) > 5000 {
		return result, errors.New("invoice has too many rows (maximum 5000)")
	}
	for i := range req.Rows {
		row := &req.Rows[i]
		row.ModelName = strings.TrimSpace(row.ModelName)
		if row.ModelName == "" {
			return result, errors.New("invoice row model name is required")
		}
		if math.IsNaN(row.UpstreamCostUSD) || math.IsInf(row.UpstreamCostUSD, 0) || row.UpstreamCostUSD < 0 {
			return result, errors.New("invoice row cost must be a finite non-negative number")
		}
		for _, value := range []float64{
			row.InputTokens, row.OutputTokens, row.CacheReadTokens,
			row.CacheCreationTokens, row.DurationSeconds,
		} {
			if math.IsNaN(value) || math.IsInf(value, 0) || value < 0 {
				return result, errors.New("invoice usage must be finite and non-negative")
			}
		}
		if row.ImageCount < 0 {
			return result, errors.New("invoice image count must be non-negative")
		}
	}

	report, err := ReconcileUpstreamBillingSamples(channel, req.Rows)
	if err != nil {
		return result, err
	}
	rows := make([]UpstreamInvoiceRow, 0, len(report.Results))
	var totalUpstream, totalUter float64
	counts := map[string]int{}
	for i, item := range report.Results {
		sample := req.Rows[i]
		rows = append(rows, UpstreamInvoiceRow{
			UpstreamBillingSample: sample,
			Status:                item.Status,
			UterCostUSD:           item.UterCostUSD,
			DifferenceUSD:         item.DifferenceUSD,
			DifferencePct:         item.DifferencePct,
			Reason:                item.Reason,
		})
		totalUpstream += sample.UpstreamCostUSD
		totalUter += item.UterCostUSD
		counts[item.Status]++
	}
	encoded, err := common.Marshal(rows)
	if err != nil {
		return result, err
	}
	currency := strings.TrimSpace(req.Currency)
	if currency == "" {
		currency = "USD"
	}
	provider := UpstreamProviderForChannel(channel.Type, channel.GetBaseURL()).ID
	invoice := model.UpstreamBillingInvoice{
		ChannelId: channel.Id, Provider: provider,
		Period: strings.TrimSpace(req.Period), Currency: currency,
		Source: strings.TrimSpace(req.Source), Note: strings.TrimSpace(req.Note),
		TotalUpstreamUSD: totalUpstream, TotalUterUSD: totalUter,
		Matched: counts[UpstreamSampleMatched], Mismatched: counts[UpstreamSampleMismatched],
		Unmatched: counts[UpstreamSampleNoPrice], Unsupported: counts[UpstreamSampleUnsupported],
		Rows: string(encoded),
	}
	if err := model.SaveUpstreamBillingInvoice(&invoice); err != nil {
		return result, err
	}
	result.Invoice = invoice
	result.Rows = rows
	result.Summary = counts
	return result, nil
}
