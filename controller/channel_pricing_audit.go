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
