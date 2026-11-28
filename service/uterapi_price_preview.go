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
	"sort"
	"strings"
	"time"

	"github.com/uter-ai/uter/model"
)

// UterAPIPricePreview is a read-only view of the official and channel prices a
// Uter.api billing group would receive at channel creation. It is derived from
// the public pricing catalogue; no channel is created and nothing is written.
type UterAPIPricePreview struct {
	Group     string  `json:"group"`
	GroupName string  `json:"group_name"`
	Ratio     float64 `json:"ratio"`
	Currency  string  `json:"currency"`
	FetchedAt int64   `json:"fetched_at"`
	// Authenticated is false when the preview had to fall back to the public
	// catalogue because no upstream credential was available. Such prices are
	// reference-only: model callability cannot be proven without a key.
	Authenticated bool                                 `json:"authenticated"`
	Records       []model.ChannelOfficialPricingRecord `json:"-"`
}

// PreviewUterAPIPriceCatalog computes the pricing rows the create path would
// write, using the same authorization, group-ratio and conversion helpers.
// When keys are supplied the authenticated per-key catalogue and key-visible
// model list are used, matching creation. Without keys the public catalogue is
// a clearly degraded fallback: it can price a group but cannot prove that a
// model is callable by a key.
func PreviewUterAPIPriceCatalog(ctx context.Context, group string, keys ...string) (*UterAPIPricePreview, error) {
	return PreviewUterAPIPriceCatalogWithBaseURL(ctx, UterAPIUpstreamBaseURL(), group, keys...)
}

// PreviewUterAPIPriceCatalogWithBaseURL pins the preview to the same endpoint
// the create wizard will use. System Settings can configure an API URL that
// differs from the legacy operational option, so passing it explicitly avoids
// a preview/落库 host mismatch.
func PreviewUterAPIPriceCatalogWithBaseURL(ctx context.Context, baseURL, group string, keys ...string) (*UterAPIPricePreview, error) {
	group = strings.TrimSpace(group)
	if group == "" {
		return nil, errors.New("billing group is required")
	}
	base := strings.TrimSpace(baseURL)
	if base == "" {
		return nil, errors.New("Uter.api upstream endpoint is not configured")
	}
	keys = normalizeUterAPIKeys(keys)

	var payload *GenericPricingPayload
	var ratio float64
	var allowed map[string]bool
	models := make([]string, 0)
	if len(keys) > 0 {
		payloads, resolvedRatio, resolvedAllowed, err := fetchUterAPIAuthorizedCatalog(ctx, base, group, keys)
		if err != nil {
			return nil, err
		}
		payload, ratio, allowed = payloads[0], resolvedRatio, resolvedAllowed
		visible, err := discoverUterAPIModelIDsWithKeys(ctx, base, keys)
		if err != nil {
			return nil, err
		}
		for _, name := range visible {
			if allowed[name] {
				models = append(models, name)
			}
		}
	} else {
		publicPayload, err := fetchUterAPIPricingPayload(ctx, base, "")
		if err != nil {
			return nil, err
		}
		published, ok := publicPayload.GroupRatio[group]
		if !ok || published <= 0 {
			return nil, fmt.Errorf("Uter.api group %q has no published ratio", group)
		}
		payload, ratio = publicPayload, published
		allowed = authorizedUterAPIModelSet([]*GenericPricingPayload{publicPayload}, group)
		for name := range allowed {
			models = append(models, name)
		}
		sort.Strings(models)
	}
	if len(models) == 0 {
		return nil, errors.New("no model is authorized for the selected Uter.api group")
	}

	groupName := group
	if display, ok := payload.GroupDisplay[group]; ok && strings.TrimSpace(display.Name) != "" {
		groupName = strings.TrimSpace(display.Name)
	}
	now := time.Now().UTC()
	records := GenericChannelPricingRecordsWithQuota(
		0, models, payload.Data, now,
		genericQuotaPerUnit(GenericPricingEntry{}, payload), "uterapi",
	)
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
		Currency: "USD", FetchedAt: now.Unix(), Authenticated: len(keys) > 0,
		Records: records,
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
	pricingStatus := model.IncomingChannelPricingStatus(record)
	internalPricing := record.InternalPricing
	if pricingStatus == model.ChannelPricingStatusNeedsReview {
		internalPricing = ""
	}
	return model.ChannelModelPricing{
		ChannelId: 0, Provider: "uterapi", ModelName: record.ModelName,
		Currency: "USD", OfficialPricing: record.OfficialPricing,
		NormalizedPricing: record.NormalizedPricing,
		InternalPricing:   internalPricing,
		PricingSource:     pricingSource, PricingStatus: pricingStatus,
		FetchedAt: record.FetchedAt,
	}
}
