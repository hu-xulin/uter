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

// UterAPIEffectiveBaseURL is the single resolution of the Uter.api discovery
// endpoint. System Settings → Channels stores the API address per provider;
// the legacy option remains a fallback for deployments that have not migrated.
// Group listing, model discovery and the creation wizard must all use this
// function or a settings-only deployment ends up with an empty group list.
func UterAPIEffectiveBaseURL() string {
	if value := strings.TrimSpace(SubscriptionChannelProviderCredentials().APIURL); value != "" {
		return value
	}
	return UterAPIUpstreamBaseURL()
}

func uterapiPricingURL() string {
	base := UterAPIEffectiveBaseURL()
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
	payload, err := fetchCachedUterAPIPricingPayload(ctx, pricingURL, "")
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
		base = UterAPIEffectiveBaseURL()
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

// AuthorizedUterAPIModels intersects the models every enabled key can call
// with the models the selected upstream billing group is allowed to use. Group
// membership comes from each pricing entry's enable_groups — never from model
// name prefixes. A model whose group membership cannot be confirmed is excluded
// so it cannot silently inherit another group's multiplier.
func AuthorizedUterAPIModels(ctx context.Context, baseURL, group string, keys []string, discovered []string) ([]string, error) {
	keys = normalizeUterAPIKeys(keys)
	if len(keys) == 0 {
		return nil, errors.New("Uter.api channel has no usable API key")
	}
	_, _, allowed, err := fetchUterAPIAuthorizedCatalog(ctx, baseURL, group, keys)
	if err != nil {
		return nil, err
	}
	wanted := make(map[string]bool, len(discovered))
	for _, name := range discovered {
		if name = strings.TrimSpace(name); name != "" {
			wanted[name] = true
		}
	}
	out := make([]string, 0, len(wanted))
	for name := range wanted {
		if allowed[name] {
			out = append(out, name)
		}
	}
	sort.Strings(out)
	return out, nil
}

// SyncUterAPIChannelPricing is the creation-time path: it derives the default
// sale price after the group discount and credit-dollar conversion.
func SyncUterAPIChannelPricing(ctx context.Context, channel *model.Channel, group string) (int, float64, string, error) {
	written, _, ratio, groupName, err := syncUterAPIChannelPricing(ctx, channel, group, true, true)
	return written, ratio, groupName, err
}

// RefreshUterAPIChannelPricing is the recurring/manual refresh path. It keeps
// the official and channel quotes current without re-deriving a sale price on
// every poll; a configured pricing schedule remains the only automatic writer.
func RefreshUterAPIChannelPricing(ctx context.Context, channel *model.Channel, group string) (int, []string, float64, string, error) {
	return syncUterAPIChannelPricing(ctx, channel, group, false, false)
}

func syncUterAPIChannelPricing(
	ctx context.Context,
	channel *model.Channel,
	group string,
	deriveSalePrice bool,
	verify bool,
) (int, []string, float64, string, error) {
	if channel == nil {
		return 0, nil, 0, "", errors.New("channel is required")
	}
	release, acquired, lockErr := acquireChannelPricingSyncLock(channel.Id)
	if lockErr != nil {
		return 0, nil, 0, "", lockErr
	}
	if !acquired {
		return 0, nil, 0, "", ErrPricingSyncInProgress
	}
	defer release()

	now := time.Now().UTC()
	keys := enabledUterAPIKeys(channel)
	var payloads []*GenericPricingPayload
	var ratio float64
	var allowed map[string]bool
	var visible []string
	var err error
	if deriveSalePrice {
		// Creation and automatic model adoption must prove every enabled key
		// can serve the model before a billable price is derived.
		payloads, ratio, allowed, err = fetchUterAPIAuthorizedCatalog(ctx, channel.GetBaseURL(), group, keys)
		if err == nil {
			visible, err = discoverUterAPIModelIDsWithKeys(ctx, channel.GetBaseURL(), keys)
		}
	} else {
		// An established channel may refresh from a recorded healthy subset,
		// but only when that subset still agrees on authorization and models.
		payloads, ratio, allowed, visible, err = fetchUterAPIRefreshCatalogWithKeyHealth(
			ctx, channel.Id, channel.GetBaseURL(), group, keys, now,
		)
	}
	if err != nil {
		return 0, nil, 0, "", err
	}
	payload := payloads[0]
	groupName := strings.TrimSpace(group)
	if display, ok := payload.GroupDisplay[group]; ok && strings.TrimSpace(display.Name) != "" {
		groupName = strings.TrimSpace(display.Name)
	}

	var mapping map[string]string
	if raw := strings.TrimSpace(channel.GetModelMapping()); raw != "" {
		_ = common.UnmarshalJsonStr(raw, &mapping)
	}
	upstreamName := func(requestName string) string {
		if resolved, cyclic := followUterRouteModelMapping(mapping, requestName); !cyclic && resolved != "" {
			return resolved
		}
		return requestName
	}

	// Re-check group authorization on every refresh. A model that lost its
	// enable_groups declaration must not keep a discounted, auto-derived price.
	servedModels := channel.GetModels()
	authorizedServed := make([]string, 0, len(servedModels))
	unauthorized := make([]string, 0)
	servedUpstream := make(map[string]bool, len(servedModels))
	for _, requestName := range servedModels {
		upstream := upstreamName(requestName)
		servedUpstream[upstream] = true
		if allowed[upstream] {
			authorizedServed = append(authorizedServed, requestName)
		} else {
			unauthorized = append(unauthorized, requestName)
		}
	}
	if len(unauthorized) > 0 {
		if _, markErr := model.MarkChannelPricingNeedsReviewForModels(
			channel.Id, unauthorized, "Uter.api group authorization removed",
		); markErr != nil {
			common.SysError(common.LogText("mark Uter.api unauthorized pricing failed: channel_id=%d, error=%v", channel.Id, markErr))
		}
		AppendUterAPIObservabilityEvent(
			UterAPIEventAuthorizationRemoved, "warn", channel.Id,
			strings.Join(unauthorized, ","),
			fmt.Sprintf("%d served model(s) lost Uter.api group authorization; auto prices parked for review", len(unauthorized)),
			now,
		)
	}
	if len(authorizedServed) == 0 {
		return 0, nil, ratio, groupName, errors.New("no channel model is authorized for the selected Uter.api group")
	}

	discovered := make([]string, 0)
	for _, name := range visible {
		if allowed[name] && !servedUpstream[name] {
			discovered = append(discovered, name)
		}
	}
	sort.Strings(discovered)
	if len(discovered) > 0 {
		AppendUterAPIObservabilityEvent(
			UterAPIEventModelDiscovered, "info", channel.Id,
			strings.Join(discovered, ","),
			fmt.Sprintf("%d authorized Uter.api model(s) discovered upstream", len(discovered)),
			now,
		)
	}

	// Uter.api is an independent provider and must never write a generic
	// newapi-compatible row. Resolve aliases through model_mapping so a
	// redirected channel still prices the request name the relay bills against.
	quota := genericQuotaPerUnit(GenericPricingEntry{}, payload)
	records := GenericChannelPricingRecordsWithMapping(
		channel.Id, authorizedServed, payload.Data, now,
		quota, deriveSalePrice, "uterapi", channel.GetModelMapping(),
	)
	if len(records) == 0 {
		return 0, discovered, ratio, groupName, errors.New("no pricing entries matched the channel models")
	}
	// Persist the billing group before any billable price is written. A failed
	// option update used to be logged and swallowed, leaving an enabled channel
	// whose later catalog refresh, parity audit and scheduled sync all silently
	// skipped because the group was never recorded.
	if err := SetGenericUpstreamBillingGroup(channel.Id, group); err != nil {
		return 0, discovered, ratio, groupName, fmt.Errorf("persist Uter.api billing group %q: %w", group, err)
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
		return 0, discovered, ratio, groupName, err
	}
	written, err := model.UpsertChannelOfficialPricing(records)
	if err != nil {
		return written, discovered, ratio, groupName, err
	}
	seen := make([]string, 0, len(records))
	for _, record := range records {
		seen = append(seen, record.ModelName)
	}
	if len(seen) > 0 {
		_, _, _, _ = model.ApplyChannelLifecycleSnapshot(channel.Id, seen, time.Now().Unix(), model.ChannelModelMissingDisableThreshold)
	}
	// The purchase contract must use the same real-USD basis as the converted
	// channel price; otherwise profit would be measured against credit dollars.
	applyGenericGroupPurchaseCost(channel.Id, payload, records, channel.GetModelMapping(), 1/operation_setting.USDExchangeRate)
	// Verification belongs to the operation boundary, not the sync kernel.
	// A scheduled refresh still has to apply its pricing schedule afterwards,
	// so it verifies once at the end of that cycle instead.
	if verify {
		AutoVerifyChannelPricingWithContext(ctx, channel.Id)
	}
	return written, discovered, ratio, groupName, nil
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
				source := strings.TrimSpace(record.Source)
				if source == "" {
					source = "newapi:/api/pricing"
				}
				internal.Source = fmt.Sprintf("%s#group=%s", source, group)
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
