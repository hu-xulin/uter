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
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

const xxapiPricingURL = "https://xxapi.ai/api/pricing"

// XXAPIGroup is one upstream billing group. A key belongs to exactly one group
// and the group multiplier decides the actual price and visible models.
type XXAPIGroup struct {
	Key   string  `json:"key"`
	Name  string  `json:"name"`
	Ratio float64 `json:"ratio"`
}

// FetchXXAPIPricingGroups reads the public xxapi pricing document and returns
// its billing groups with their multipliers.
func FetchXXAPIPricingGroups(ctx context.Context) ([]XXAPIGroup, error) {
	payload, err := fetchXXAPIPricingPayload(ctx, xxapiPricingURL, "")
	if err != nil {
		return nil, err
	}
	return xxapiGroupsFromPayload(payload), nil
}

func xxapiGroupsFromPayload(payload *GenericPricingPayload) []XXAPIGroup {
	if payload == nil {
		return nil
	}
	groups := make([]XXAPIGroup, 0, len(payload.GroupRatio))
	for key, ratio := range payload.GroupRatio {
		name := key
		if display, ok := payload.GroupDisplay[key]; ok && strings.TrimSpace(display.Name) != "" {
			name = strings.TrimSpace(display.Name)
		}
		groups = append(groups, XXAPIGroup{Key: key, Name: name, Ratio: ratio})
	}
	sort.Slice(groups, func(i, j int) bool {
		if groups[i].Ratio != groups[j].Ratio {
			return groups[i].Ratio < groups[j].Ratio
		}
		return groups[i].Key < groups[j].Key
	})
	return groups
}

func fetchXXAPIPricingPayload(ctx context.Context, baseURL, apiKey string) (*GenericPricingPayload, error) {
	endpoint, err := xxapiPricingEndpointFor(baseURL)
	if err != nil {
		return nil, err
	}
	if _, err := validateUpstreamEndpoint(endpoint); err != nil {
		return nil, err
	}
	requestCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(requestCtx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(apiKey) != "" {
		req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(apiKey))
	}
	req.Header.Set("Accept", "application/json")
	client := newUpstreamHTTPClient(20 * time.Second)
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 8<<20))
	if err != nil {
		return nil, err
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("xxapi pricing returned status %d", res.StatusCode)
	}
	var payload GenericPricingPayload
	if err := common.Unmarshal(body, &payload); err != nil {
		return nil, errors.New("xxapi pricing payload is not valid JSON")
	}
	if len(payload.Data) == 0 {
		return nil, errors.New("xxapi pricing returned no models")
	}
	return &payload, nil
}

// xxapiPricingEndpointFor resolves /api/pricing at the site root, stripping a
// pasted /v1 suffix.
func xxapiPricingEndpointFor(baseURL string) (string, error) {
	base := strings.TrimSpace(baseURL)
	if base == "" {
		base = "https://xxapi.ai"
	}
	if !strings.Contains(base, "://") {
		base = "https://" + base
	}
	parsed, err := url.Parse(strings.TrimRight(base, "/"))
	if err != nil || parsed.Host == "" {
		return "", errors.New("invalid xxapi base URL")
	}
	parsed.Path = strings.TrimSuffix(parsed.Path, "/v1")
	parsed.RawQuery = ""
	if strings.HasSuffix(strings.TrimRight(parsed.Path, "/"), "/api/pricing") {
		return strings.TrimRight(parsed.String(), "/"), nil
	}
	return parsed.String() + "/api/pricing", nil
}

// SyncXXAPIChannelPricing syncs one channel's prices and applies the key's
// group multiplier. The channel price is the upstream expression times the
// group ratio, and the same expression becomes the unverified purchase cost.
func SyncXXAPIChannelPricing(ctx context.Context, channel *model.Channel, group string) (int, float64, string, error) {
	if channel == nil {
		return 0, 0, "", errors.New("channel is required")
	}
	release, acquired, lockErr := acquireChannelPricingSyncLock(channel.Id)
	if lockErr != nil {
		return 0, 0, "", lockErr
	}
	if !acquired {
		return 0, 0, "", ErrPricingSyncInProgress
	}
	defer release()
	apiKey, _, keyErr := channel.GetNextEnabledKey()
	if keyErr != nil || strings.TrimSpace(apiKey) == "" {
		return 0, 0, "", errors.New("xxapi channel has no usable API key")
	}
	payload, err := fetchXXAPIPricingPayload(ctx, channel.GetBaseURL(), apiKey)
	if err != nil {
		return 0, 0, "", err
	}
	group = strings.TrimSpace(group)
	ratio := 1.0
	groupName := ""
	if group != "" {
		published, ok := payload.GroupRatio[group]
		if !ok || published <= 0 {
			return 0, 0, "", fmt.Errorf("xxapi group %q has no published ratio", group)
		}
		ratio = published
		groupName = group
		if display, ok := payload.GroupDisplay[group]; ok && strings.TrimSpace(display.Name) != "" {
			groupName = strings.TrimSpace(display.Name)
		}
	}
	records := GenericChannelPricingRecords(channel.Id, channel.GetModels(), payload.Data, time.Now().UTC())
	if len(records) == 0 {
		return 0, ratio, groupName, errors.New("no pricing entries matched the channel models")
	}
	if ratio != 1 {
		for i := range records {
			applyGroupRatioToRecord(&records[i], group, ratio)
		}
	}
	written, err := model.UpsertChannelOfficialPricing(records)
	if err != nil {
		return written, ratio, groupName, err
	}
	seen := make([]string, 0, len(records))
	for _, record := range records {
		seen = append(seen, record.ModelName)
	}
	if len(seen) > 0 {
		_, _, _, _ = model.ApplyChannelLifecycleSnapshot(channel.Id, seen, time.Now().Unix(), model.ChannelModelMissingDisableThreshold)
	}
	if group != "" {
		if err := SetGenericUpstreamBillingGroup(channel.Id, group); err != nil {
			common.SysError(common.LogText("persist xxapi group failed: channel_id=%d, error=%v", channel.Id, err))
		}
		applyGenericGroupPurchaseCost(channel.Id, payload, records)
	}
	AutoVerifyChannelPricing(channel.Id)
	return written, ratio, groupName, nil
}

// applyGroupRatioToRecord applies the group multiplier to the executable channel
// price and records the group/ratio on the normalized quote for audit.
func applyGroupRatioToRecord(record *model.ChannelOfficialPricingRecord, group string, ratio float64) {
	if record == nil || ratio <= 0 || ratio == 1 {
		return
	}
	originalExpr := ""
	if strings.TrimSpace(record.InternalPricing) != "" {
		var internal model.ChannelInternalPricing
		if common.UnmarshalJsonStr(record.InternalPricing, &internal) == nil &&
			strings.TrimSpace(internal.BillingExpr) != "" {
			originalExpr = internal.BillingExpr
			expr := fmt.Sprintf("(%s) * %s", strings.TrimSpace(internal.BillingExpr), strconv.FormatFloat(ratio, 'f', -1, 64))
			if NormalizeUpstreamExpression(expr).Executable {
				internal.BillingExpr = expr
				internal.Source = fmt.Sprintf("newapi:/api/pricing#group=%s", group)
				if encoded, err := common.Marshal(internal); err == nil {
					record.InternalPricing = string(encoded)
				}
			}
		}
	}
	var official model.ChannelOfficialPricing
	if common.UnmarshalJsonStr(record.NormalizedPricing, &official) == nil {
		if originalExpr != "" {
			setChannelPriceFromExpression(&official, originalExpr, ratio)
		}
		official.DiscountGroup = group
		official.DiscountRatio = &ratio
		if encoded, err := common.Marshal(official); err == nil {
			record.NormalizedPricing = string(encoded)
		}
	}
}
