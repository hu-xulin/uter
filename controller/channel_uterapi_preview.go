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
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/service"
)

// GetUterAPIPricePreview returns the official and channel prices a billing
// group would receive, derived from the public catalogue before a channel is
// created. It never writes pricing rows: the create flow performs its own
// authoritative sync and verification.
func GetUterAPIPricePreview(c *gin.Context) {
	group := strings.TrimSpace(c.Query("group"))
	// The create wizard must preview the authenticated catalogue the saved
	// channel will actually price against. Keys stay server-side; the browser
	// never receives them, only the resulting prices.
	keys := make([]string, 0)
	credentials := service.SubscriptionChannelProviderCredentials()
	if slot, ok := credentials.SlotForGroup(group); ok {
		keys = append(keys, slot.Keys...)
	}
	if len(keys) == 0 && strings.TrimSpace(credentials.APIKey) != "" {
		keys = append(keys, credentials.APIKey)
	}
	base := uterapiBaseURL()
	ctx, _ := service.WithUterAPIUpstreamCache(c.Request.Context())
	preview, err := service.PreviewUterAPIPriceCatalogWithBaseURL(ctx, base, group, keys...)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]channelModelPricingView, 0, len(preview.Records))
	for _, record := range preview.Records {
		items = append(items, channelModelPricingToView(service.PreviewRecordToPricingRow(record)))
	}
	common.ApiSuccess(c, gin.H{
		"group":         preview.Group,
		"group_name":    preview.GroupName,
		"ratio":         preview.Ratio,
		"currency":      preview.Currency,
		"fetched_at":    preview.FetchedAt,
		"authenticated": preview.Authenticated,
		"items":         items,
	})
}
