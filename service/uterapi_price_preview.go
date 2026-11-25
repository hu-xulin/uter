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
package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/uter-ai/uter/model"
)

// UterAPIPricePreview is a read-only view of the official and channel prices a
// Uter.api billing group would receive at channel creation. It is derived from
// the public pricing catalogue; no channel is created and nothing is written.
type UterAPIPricePreview struct {
	Group     string                               `json:"group"`
	GroupName string                               `json:"group_name"`
	Ratio     float64                              `json:"ratio"`
	Currency  string                               `json:"currency"`
	FetchedAt int64                                `json:"fetched_at"`
	Records   []model.ChannelOfficialPricingRecord `json:"-"`
}

// PreviewUterAPIPriceCatalog computes the same pricing rows that
// SyncUterAPIChannelPricing writes at creation, using the exact same
// conversion and group-ratio helpers. The rows stay in memory so the create
// wizard can show official and channel prices before any channel exists.
func PreviewUterAPIPriceCatalog(ctx context.Context, group string) (*UterAPIPricePreview, error) {
	group = strings.TrimSpace(group)
	if group == "" {
		return nil, errors.New("billing group is required")
	}
	pricingURL := uterapiPricingURL()
	if pricingURL == "" {
		return nil, errors.New("Uter.api upstream endpoint is not configured")
	}
	payload, err := fetchUterAPIPricingPayload(ctx, pricingURL, "")
	if err != nil {
		return nil, err
	}
	ratio, ok := payload.GroupRatio[group]
	if !ok || ratio <= 0 {
		return nil, fmt.Errorf("Uter.api group %q has no published ratio", group)
	}
	groupName := group
	if display, ok := payload.GroupDisplay[group]; ok && strings.TrimSpace(display.Name) != "" {
		groupName = strings.TrimSpace(display.Name)
	}
	// Group membership comes only from each entry's enable_groups, matching
	// AuthorizedUterAPIModels. A model without an explicit group is excluded so
	// the preview can never advertise a price this group may not use.
	models := make([]string, 0, len(payload.Data))
	for _, entry := range payload.Data {
		name := strings.TrimSpace(entry.ModelName)
		if name == "" {
			continue
		}
		for _, enabled := range entry.EnableGroups {
			if strings.EqualFold(strings.TrimSpace(enabled), group) {
				models = append(models, name)
				break
			}
		}
	}
	now := time.Now().UTC()
	records := GenericChannelPricingRecords(0, models, payload.Data, now, "uterapi")
	if ratio != 1 {
		for i := range records {
			applyGroupRatioToRecord(&records[i], group, ratio)
		}
	}
	// Mirror the saved-channel path: credit-dollar quotes become real USD in
	// the preview too, so the wizard and the plaza show the same number.
	if err := applyUterAPICreditExchangeRate(records); err != nil {
		return nil, err
	}
	return &UterAPIPricePreview{
		Group: group, GroupName: groupName, Ratio: ratio,
		Currency: "USD", FetchedAt: now.Unix(), Records: records,
	}, nil
}

// PreviewRecordToPricingRow turns an in-memory preview record into the same
// row shape the saved-channel pricing view consumes, so both paths render
// with one formatter.
func PreviewRecordToPricingRow(record model.ChannelOfficialPricingRecord) model.ChannelModelPricing {
	pricingSource := record.Source
	if pricingSource == "" {
		pricingSource = "newapi:/api/pricing"
	}
	return model.ChannelModelPricing{
		ChannelId: 0, Provider: "uterapi", ModelName: record.ModelName,
		Currency: "USD", OfficialPricing: record.OfficialPricing,
		NormalizedPricing: record.NormalizedPricing,
		InternalPricing:   record.InternalPricing,
		PricingSource:     pricingSource, FetchedAt: record.FetchedAt,
	}
}
