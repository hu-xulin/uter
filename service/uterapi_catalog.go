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
	"github.com/uter-ai/uter/setting/operation_setting"
)

// UterAPIUpstreamURLOption stores the operational endpoint for Uter.api. It is
// deployment configuration rather than source code, so the white-labelled
// codebase never names the supplier. Existing Uter.api channels keep working
// when the option is unset because their base URL is reused.
const UterAPIUpstreamURLOption = "UterAPIUpstreamBaseURL"

// UterAPIUpstreamBaseURL returns the configured endpoint. An empty result
// means creation must stop until an administrator configures the option.
func UterAPIUpstreamBaseURL() string {
	value := strings.TrimSpace(common.GetOption(UterAPIUpstreamURLOption))
	if value == "" {
		return ""
	}
	if !strings.Contains(value, "://") {
		value = "https://" + value
	}
	return strings.TrimRight(value, "/")
}

// UterAPIUpstreamHost exposes only the host for provider detection.
func UterAPIUpstreamHost() string {
	base := UterAPIUpstreamBaseURL()
	if base == "" {
		return ""
	}
	parsed, err := url.Parse(base)
	if err != nil {
		return ""
	}
	return parsed.Hostname()
}

func uterapiPricingURL() string {
	base := UterAPIUpstreamBaseURL()
	if base == "" {
		return ""
	}
	return base + "/api/pricing"
}

// UterAPIGroup is one upstream billing group. A key belongs to exactly one group
// and the group multiplier decides the actual price and visible models.
type UterAPIGroup struct {
	Key   string  `json:"key"`
	Name  string  `json:"name"`
	Ratio float64 `json:"ratio"`
}

// FetchUterAPIPricingGroups reads the public uterapi pricing document and returns
// its billing groups with their multipliers.
func FetchUterAPIPricingGroups(ctx context.Context) ([]UterAPIGroup, error) {
	pricingURL := uterapiPricingURL()
	if pricingURL == "" {
		return nil, errors.New("Uter.api upstream endpoint is not configured")
	}
	payload, err := fetchUterAPIPricingPayload(ctx, pricingURL, "")
	if err != nil {
		return nil, err
	}
	return uterapiGroupsFromPayload(payload), nil
}

func uterapiGroupsFromPayload(payload *GenericPricingPayload) []UterAPIGroup {
	if payload == nil {
		return nil
	}
	groups := make([]UterAPIGroup, 0, len(payload.GroupRatio))
	for key, ratio := range payload.GroupRatio {
		name := key
		if display, ok := payload.GroupDisplay[key]; ok && strings.TrimSpace(display.Name) != "" {
			name = strings.TrimSpace(display.Name)
		}
		groups = append(groups, UterAPIGroup{Key: key, Name: name, Ratio: ratio})
	}
	sort.Slice(groups, func(i, j int) bool {
		if groups[i].Ratio != groups[j].Ratio {
			return groups[i].Ratio < groups[j].Ratio
		}
		return groups[i].Key < groups[j].Key
	})
	return groups
}

func fetchUterAPIPricingPayload(ctx context.Context, baseURL, apiKey string) (*GenericPricingPayload, error) {
	endpoint, err := uterapiPricingEndpointFor(baseURL)
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
		return nil, fmt.Errorf("Uter.api pricing returned status %d", res.StatusCode)
	}
	var payload GenericPricingPayload
	if err := common.Unmarshal(body, &payload); err != nil {
		return nil, errors.New("Uter.api pricing payload is not valid JSON")
	}
	if len(payload.Data) == 0 {
		return nil, errors.New("Uter.api pricing returned no models")
	}
	return &payload, nil
}

// uterapiPricingEndpointFor resolves /api/pricing at the site root, stripping a
// pasted /v1 suffix.
func uterapiPricingEndpointFor(baseURL string) (string, error) {
	base := strings.TrimSpace(baseURL)
	if base == "" {
		base = UterAPIUpstreamBaseURL()
	}
	if base == "" {
		return "", errors.New("Uter.api upstream endpoint is not configured")
	}
	if !strings.Contains(base, "://") {
		base = "https://" + base
	}
	parsed, err := url.Parse(strings.TrimRight(base, "/"))
	if err != nil || parsed.Host == "" {
		return "", errors.New("Invalid Uter.api base URL")
	}
	parsed.Path = strings.TrimSuffix(parsed.Path, "/v1")
	parsed.RawQuery = ""
	if strings.HasSuffix(strings.TrimRight(parsed.Path, "/"), "/api/pricing") {
		return strings.TrimRight(parsed.String(), "/"), nil
	}
	return parsed.String() + "/api/pricing", nil
}

// AuthorizedUterAPIModels intersects the models a key can actually call with
// the models the selected upstream billing group is allowed to use. Group
// membership comes from each pricing entry's enable_groups — never from model
// name prefixes. A model whose group membership cannot be confirmed is excluded
// so it cannot silently inherit another group's multiplier.
func AuthorizedUterAPIModels(ctx context.Context, baseURL, group string, keys []string, discovered []string) ([]string, error) {
	group = strings.TrimSpace(group)
	if group == "" {
		return nil, errors.New("billing group is required")
	}
	var payload *GenericPricingPayload
	var lastErr error
	for _, key := range keys {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		payload, lastErr = fetchUterAPIPricingPayload(ctx, baseURL, key)
		if lastErr == nil && payload != nil {
			break
		}
	}
	if payload == nil {
		if lastErr == nil {
			lastErr = errors.New("Uter.api pricing is unavailable")
		}
		return nil, lastErr
	}
	wanted := make(map[string]bool, len(discovered))
	for _, name := range discovered {
		if name = strings.TrimSpace(name); name != "" {
			wanted[name] = true
		}
	}
	allowed := make(map[string]bool)
	for _, entry := range payload.Data {
		name := strings.TrimSpace(entry.ModelName)
		if name == "" || !wanted[name] {
			continue
		}
		// No enable_groups means upstream did not publish group membership.
		// Fail closed: the model must not receive this group's ratio without
		// evidence that the group may call it.
		for _, enabled := range entry.EnableGroups {
			if strings.EqualFold(strings.TrimSpace(enabled), group) {
				allowed[name] = true
				break
			}
		}
	}
	out := make([]string, 0, len(allowed))
	for name := range allowed {
		out = append(out, name)
	}
	sort.Strings(out)
	return out, nil
}

// SyncUterAPIChannelPricing syncs one channel's prices and applies the key's
// group multiplier. The channel price is the upstream expression times the
// group ratio, and the same expression becomes the unverified purchase cost.
func SyncUterAPIChannelPricing(ctx context.Context, channel *model.Channel, group string) (int, float64, string, error) {
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
		return 0, 0, "", errors.New("Uter.api channel has no usable API key")
	}
	payload, err := fetchUterAPIPricingPayload(ctx, channel.GetBaseURL(), apiKey)
	if err != nil {
		return 0, 0, "", err
	}
	group = strings.TrimSpace(group)
	ratio := 1.0
	groupName := ""
	if group != "" {
		published, ok := payload.GroupRatio[group]
		if !ok || published <= 0 {
			return 0, 0, "", fmt.Errorf("Uter.api group %q has no published ratio", group)
		}
		ratio = published
		groupName = group
		if display, ok := payload.GroupDisplay[group]; ok && strings.TrimSpace(display.Name) != "" {
			groupName = strings.TrimSpace(display.Name)
		}
	}
	// Uter.api 是独立供应商，不能再写成通用的 newapi-compatible。
	// UpsertChannelOfficialPricing 会按渠道+模型身份接管旧 Provider 的行，
	// 避免同一模型出现两个身份；人工销售价不会被自动同步覆盖。
	// Uter.api supports batch redirects too: the channel model list then holds
	// request aliases while the catalogue publishes raw names. Resolve aliases
	// before matching so a redirected channel still gets a channel-scoped price
	// row under the request name relay bills against.
	records := GenericChannelPricingRecordsWithMapping(
		channel.Id, channel.GetModels(), payload.Data, time.Now().UTC(),
		0, true, "uterapi", channel.GetModelMapping(),
	)
	if len(records) == 0 {
		return 0, ratio, groupName, errors.New("no pricing entries matched the channel models")
	}
	if ratio != 1 {
		for i := range records {
			applyGroupRatioToRecord(&records[i], group, ratio)
		}
	}
	// The upstream quotes credit dollars (¥1 buys $1 of balance). Convert the
	// channel price into real USD before persisting it; official reference
	// tiers stay untouched. A bad rate aborts the sync instead of writing a
	// misleading price.
	if err := applyUterAPICreditExchangeRate(records); err != nil {
		return 0, ratio, groupName, err
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
			common.SysError(common.LogText("persist Uter.api group failed: channel_id=%d, error=%v", channel.Id, err))
		}
		// The purchase contract must use the same real-USD basis as the
		// converted channel price; otherwise profit would be measured against
		// un-converted credit dollars.
		applyGenericGroupPurchaseCost(channel.Id, payload, records, channel.GetModelMapping(), 1/operation_setting.USDExchangeRate)
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
		// The channel quote is the UPSTREAM price under this discount group,
		// never the operator sale price. Use the official upstream expression
		// as the base; the internal expression already carries Uter's markup
		// and would contaminate the quote (e.g. 10 -> 11 before the discount).
		quoteExpr := official.BillingExpr
		if strings.TrimSpace(quoteExpr) == "" {
			quoteExpr = originalExpr
		}
		if quoteExpr != "" {
			setChannelPriceFromExpression(&official, quoteExpr, ratio)
		}
		official.DiscountGroup = group
		official.DiscountRatio = &ratio
		if encoded, err := common.Marshal(official); err == nil {
			record.NormalizedPricing = string(encoded)
		}
	}
}
