package service

import (
	"context"
	"fmt"
	"math"
	"strings"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/billing_setting"
	"github.com/uter-ai/uter/pkg/billingexpr"
)

// reconcileBilling builds the full-chain charge audit for one probe.
//
// Static leg (always): compares upstream-reported usage tokens with a
// conservative text estimate and, when a billing expression is configured for
// the model, computes a theoretical quota from usage × rules with no ledger
// mutation at all.
//
// Full-chain leg (only when an operator configured a probe token): sends one
// minimal request through Uter itself, reads the platform request id from the
// response header, looks up the immutable BillingPriceSnapshot by that id and
// compares the real settled quota with the theoretical value. Without a token
// the mode is "static" and the note explicitly says the Uter leg is not
// verified, so the report can never be mistaken for a full-chain result.
func reconcileBilling(ctx context.Context, cfg UpstreamProbeConfig, upstreamPrompt, upstreamComplete, estimate int) BillingReconciliation {
	recon := BillingReconciliation{
		Mode:             "static",
		UpstreamPrompt:   upstreamPrompt,
		UpstreamComplete: upstreamComplete,
		Notes:            "Uter deduction not verified: no probe token configured (static upstream usage check only)",
	}
	if upstreamComplete > 0 && estimate > 0 {
		recon.InflationRatio = math.Round((float64(upstreamComplete)/float64(estimate))*100) / 100
	}

	// Theoretical quota from the configured billing expression, no动账.
	// group ratio 1 and no user multiplier keep this a neutral estimate; the
	// purpose is order-of-magnitude verification, not a replay of settlement.
	if expr, ok := billing_setting.GetBillingExpr(cfg.Model); ok && strings.TrimSpace(expr) != "" {
		hash := billingexpr.ExprHashString(expr)
		snapshot := &billingexpr.BillingSnapshot{
			BillingMode:  "tiered_expr",
			ExprString:   expr,
			ExprHash:     hash,
			GroupRatio:   1,
			QuotaPerUnit: common.QuotaPerUnit,
		}
		params := billingexpr.TokenParams{
			P:   float64(upstreamPrompt),
			C:   float64(upstreamComplete),
			Len: float64(upstreamPrompt + upstreamComplete),
		}
		if result, err := billingexpr.ComputeTieredQuotaWithRequest(snapshot, params, billingexpr.RequestInput{}); err == nil {
			recon.TheoreticalQuota = result.ActualQuotaAfterGroup
		} else {
			recon.Notes = fmt.Sprintf("theoretical quota unavailable: %v", err)
		}
	}

	// Full-chain leg requires an operator-provisioned probe token.
	if strings.TrimSpace(cfg.UterToken) == "" || strings.TrimSpace(cfg.UterBaseURL) == "" {
		return recon
	}

	status, body, requestID, err := throughUterChat(ctx, cfg, upstreamProbePromptMath)
	if err != nil || status < 200 || status >= 300 {
		recon.Notes = fmt.Sprintf("Uter leg failed: status=%d err=%v", status, err)
		return recon
	}
	recon.Mode = "full_chain"
	recon.UterRequestID = requestID
	prompt, completion := parseChatUsage(body)
	recon.UpstreamPrompt, recon.UpstreamComplete = prompt, completion

	// Look up the immutable price voucher written by the real settlement path.
	snapshot, err := model.GetBillingPriceSnapshotByRequest(requestID, cfg.Model)
	if err != nil || snapshot == nil {
		recon.Notes = fmt.Sprintf("no billing snapshot for request %s: %v", requestID, err)
		return recon
	}
	recon.UterActualQuota = int(snapshot.SettledQuota)
	recon.QuotaDelta = recon.UterActualQuota - recon.TheoreticalQuota
	recon.Match = withinTolerance(recon.UterActualQuota, recon.TheoreticalQuota)
	if recon.Match {
		recon.Notes = "Uter deduction matches theoretical quota (5% tolerance)"
	} else {
		recon.Notes = fmt.Sprintf("Uter deduction differs from theoretical quota by %d (investigate)", recon.QuotaDelta)
	}
	return recon
}

// withinTolerance allows a 5% rounding/buffer variance between the real
// settled quota and the neutral theoretical estimate.
func withinTolerance(actual, theoretical int) bool {
	if theoretical <= 0 {
		return actual >= 0
	}
	diff := actual - theoretical
	if diff < 0 {
		diff = -diff
	}
	return diff <= theoretical/20+1
}
