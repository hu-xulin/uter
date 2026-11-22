/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
package controller

import (
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

// GetChannelPricingAudit reports which price source wins for one channel.
// GET /api/channel/:id/pricing_audit
func GetChannelPricingAudit(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	audit, err := service.AuditChannelPricing(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, audit)
}

// GetAllChannelPricingAudits reports both price systems for every channel.
// GET /api/channel/pricing_audit
func GetAllChannelPricingAudits(c *gin.Context) {
	audits, err := service.AuditAllChannelPricing()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	orphans, err := service.AuditOrphanChannelPricing()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"channels": audits, "orphans": orphans})
}

// GetChannelSyncCapabilities returns the provider capability matrix for one
// channel. It is read-only and never probes the upstream.
// GET /api/channel/:id/sync_capabilities
func GetChannelSyncCapabilities(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	channel, err := model.GetChannelById(id, false)
	if err != nil || channel == nil {
		common.ApiErrorT(c, "Channel not found")
		return
	}
	baseURL := ""
	if channel.BaseURL != nil {
		baseURL = strings.TrimSpace(*channel.BaseURL)
	}
	provider := service.UpstreamProviderForChannel(channel.Type, baseURL)
	common.ApiSuccess(c, gin.H{
		"channel_id": channel.Id,
		"provider":   provider,
		"base_url":   baseURL,
	})
}

// GetChannelUpstreamParity reports whether each model's upstream metadata,
// price layers, lifecycle and executable rule are consistent.
// GET /api/channel/:id/upstream_parity
func GetChannelUpstreamParity(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	channel, err := model.GetChannelById(id, false)
	if err != nil || channel == nil {
		common.ApiErrorT(c, "Channel not found")
		return
	}
	rows, err := model.ListChannelModelPricing(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	baseURL := ""
	if channel.BaseURL != nil {
		baseURL = strings.TrimSpace(*channel.BaseURL)
	}
	provider := service.UpstreamProviderForChannel(channel.Type, baseURL)
	apiKey := ""
	if key, _, keyErr := channel.GetNextEnabledKey(); keyErr == nil {
		apiKey = strings.TrimSpace(key)
	}
	report := service.BuildUpstreamParityReport(id, channel.Name, rows, time.Now().UTC())
	upstreamModels, catalogErr := service.FetchUpstreamModelNames(
		c.Request.Context(), provider.ID,
		service.UpstreamFetchConfig{BaseURL: baseURL, APIKey: apiKey, ChannelID: id},
	)
	if catalogErr != nil {
		// Keep the stored-row report usable, but never claim catalog parity.
		report.CatalogError = catalogErr.Error()
	} else {
		report = service.BuildUpstreamParityReportWithCatalog(id, channel.Name, rows, upstreamModels, time.Now().UTC())
	}
	common.ApiSuccess(c, report)
}

// GetChannelUpstreamReconciliation executes deterministic billing samples for
// every configured expression and returns the provider-invoice status.
// GET /api/channel/:id/upstream_reconciliation
func GetChannelUpstreamReconciliation(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	report, err := service.ReconcileChannelUpstreamBilling(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, report)
}

// ReconcileChannelBillingSamples compares operator-supplied upstream bill rows
// with Uter's configured charge. POST /api/channel/:id/upstream_reconciliation/samples
func ReconcileChannelBillingSamples(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	channel, err := model.GetChannelById(id, true)
	if err != nil || channel == nil {
		common.ApiErrorT(c, "Channel not found")
		return
	}
	var req struct {
		Samples []service.UpstreamBillingSample `json:"samples"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	report, err := service.ReconcileUpstreamBillingSamples(channel, req.Samples)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, report)
}

// ImportChannelUpstreamInvoice persists one supplier invoice and reconciles
// every row against the channel's configured sale prices.
// POST /api/channel/:id/upstream_invoices
func ImportChannelUpstreamInvoice(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	channel, err := model.GetChannelById(id, true)
	if err != nil || channel == nil {
		common.ApiErrorT(c, "Channel not found")
		return
	}
	var req service.UpstreamInvoiceImportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := service.ImportUpstreamBillingInvoice(channel, req)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, result)
}

// GetChannelUpstreamInvoices lists imported supplier invoices.
// GET /api/channel/:id/upstream_invoices
func GetChannelUpstreamInvoices(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	rows, err := model.ListUpstreamBillingInvoices(id, limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"channel_id": id, "items": rows})
}

// GetChannelUpstreamInvoice returns one imported invoice with its row detail.
// GET /api/channel/:id/upstream_invoices/:invoice_id
func GetChannelUpstreamInvoice(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	invoiceID, err := strconv.ParseInt(c.Param("invoice_id"), 10, 64)
	if err != nil || invoiceID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	invoice, err := model.GetUpstreamBillingInvoice(id, invoiceID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, invoice)
}
