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
	common.ApiSuccess(c, gin.H{"channels": audits})
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
	common.ApiSuccess(c, service.BuildUpstreamParityReport(id, channel.Name, rows, time.Now().UTC()))
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
