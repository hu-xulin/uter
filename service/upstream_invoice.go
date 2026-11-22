package service

import (
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// UpstreamInvoiceImportRequest is one supplier invoice import. Rows carry the
// supplier's own currency; FXRate converts them to USD. A non-USD invoice
// without a rate is rejected instead of being stored as if it were USD.
type UpstreamInvoiceImportRequest struct {
	Period   string                  `json:"period"`
	Currency string                  `json:"currency"`
	FXRate   float64                 `json:"fx_rate,omitempty"`
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

	currency := strings.ToUpper(strings.TrimSpace(req.Currency))
	if currency == "" {
		currency = "USD"
	}
	fxRate, fxSource, fxVersion, err := ResolveExchangeRateToUSD(currency, req.FXRate, "invoice_import")
	if err != nil {
		return result, err
	}
	if currency != "USD" && req.FXRate > 0 {
		// 导入方提供的汇率写入历史表，后续同币种账单可复用同一口径。
		if saveErr := model.SaveBillingExchangeRate(model.BillingExchangeRate{
			BaseCurrency: currency, QuoteCurrency: "USD",
			EffectiveAt: time.Now().Unix(), Rate: req.FXRate, Source: "invoice_import",
		}); saveErr != nil {
			common.SysError(common.LogText("save invoice exchange rate failed: %v", saveErr))
		}
	}
	var originalTotal float64
	for i := range req.Rows {
		originalTotal += req.Rows[i].UpstreamCostUSD
	}
	// 对账与 USD 字段只接受换算后的金额；原始币种总额另行留痕。
	if fxRate != 1 {
		for i := range req.Rows {
			req.Rows[i].UpstreamCostUSD *= fxRate
			if math.IsNaN(req.Rows[i].UpstreamCostUSD) || math.IsInf(req.Rows[i].UpstreamCostUSD, 0) {
				return result, errors.New("invoice row cost overflows after conversion")
			}
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
	provider := UpstreamProviderForChannel(channel.Type, channel.GetBaseURL()).ID
	invoice := model.UpstreamBillingInvoice{
		ChannelId: channel.Id, Provider: provider,
		Period: strings.TrimSpace(req.Period), Currency: currency, FXRate: fxRate,
		FXSource: fxSource, FXVersion: fxVersion,
		OriginalTotal: originalTotal, TotalUpstreamUSD: totalUpstream,
		TotalUterUSD: totalUter,
		Source:       strings.TrimSpace(req.Source), Note: strings.TrimSpace(req.Note),
		Matched: counts[UpstreamSampleMatched], Mismatched: counts[UpstreamSampleMismatched],
		Unmatched:   counts[UpstreamSampleNoPrice] + counts[UpstreamSampleNoRequest] + counts[UpstreamSampleNoCost],
		Unsupported: counts[UpstreamSampleUnsupported],
		Rows:        string(encoded),
	}
	if err := model.SaveUpstreamBillingInvoice(&invoice); err != nil {
		return result, err
	}
	if err := model.SaveBillingLedgerEntry(model.BillingFinancialLedger{
		EntryKey:       fmt.Sprintf("supplier_invoice|%d", invoice.Id),
		EntryType:      model.BillingLedgerEntrySupplierInvoice,
		ChannelId:      channel.Id,
		OriginalAmount: originalTotal, Currency: currency, FXRate: fxRate,
		AmountUSD: totalUpstream,
		Status:    model.BillingLedgerStatusRecorded,
		Source:    invoice.Source, Reference: fmt.Sprintf("%d", invoice.Id),
	}); err != nil {
		common.SysError(common.LogText("supplier invoice ledger entry failed: channel=%d invoice=%d: %s", channel.Id, invoice.Id, err.Error()))
	}
	result.Invoice = invoice
	result.Rows = rows
	result.Summary = counts
	return result, nil
}
