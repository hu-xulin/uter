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
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/uter-ai/uter/service"
)

// uterapiKeySlot binds one upstream billing group to the keys that unlock it.
type uterapiKeySlot struct {
	Name  string   `json:"name"`
	Group string   `json:"group"`
	Keys  []string `json:"keys"`
}

// uterapiCreateRequest carries one entry per upstream billing group. Each group
// has its own key(s) because uterapi binds a key to exactly one group.
type uterapiCreateRequest struct {
	Slots        []uterapiKeySlot `json:"slots"`
	Group        string           `json:"group"`
	Status       int              `json:"status"`
	Models       string           `json:"models"`
	ModelMapping string           `json:"model_mapping"`
}

// resolvedUterapiSlot is a submission slot after system-settings fallback and
// Add Mode expansion. The create wizard already expands explicit rows; saved
// grouped credentials are expanded here because the browser only sees masks.
type resolvedUterapiSlot struct {
	Name     string
	Group    string
	Keys     []string
	Mode     string
	Strategy constant.MultiKeyMode
}

func resolveUterAPICreateSlots(
	submitted []uterapiKeySlot,
	credentials service.ChannelProviderCredentials,
) []resolvedUterapiSlot {
	resolved := make([]resolvedUterapiSlot, 0, len(submitted))
	for _, slot := range submitted {
		name := strings.TrimSpace(slot.Name)
		upstreamGroup := strings.TrimSpace(slot.Group)
		if name == "" {
			continue
		}
		keys := normalizeUterAPIKeys(slot.Keys)
		mode := "multi_to_single"
		strategy := constant.MultiKeyModePolling
		if len(keys) == 0 {
			if saved, ok := credentials.SlotForGroup(upstreamGroup); ok {
				keys = normalizeUterAPIKeys(saved.Keys)
				mode = saved.Mode
				strategy = constant.MultiKeyMode(saved.Strategy)
			} else {
				keys = normalizeUterAPIKeys(strings.Split(credentials.APIKey, "\n"))
			}
		}
		if len(keys) == 0 {
			continue
		}
		if mode == "batch" {
			for index, key := range keys {
				slotName := name
				if len(keys) > 1 {
					slotName = fmt.Sprintf("%s %d", name, index+1)
				}
				resolved = append(resolved, resolvedUterapiSlot{
					Name: slotName, Group: upstreamGroup, Keys: []string{key}, Mode: "single",
				})
			}
			continue
		}
		if mode == "single" {
			resolved = append(resolved, resolvedUterapiSlot{
				Name: name, Group: upstreamGroup, Keys: keys[:1], Mode: "single",
			})
			continue
		}
		if strategy != constant.MultiKeyModeRandom && strategy != constant.MultiKeyModePolling {
			strategy = constant.MultiKeyModePolling
		}
		resolved = append(resolved, resolvedUterapiSlot{
			Name: name, Group: upstreamGroup, Keys: keys,
			Mode: "multi_to_single", Strategy: strategy,
		})
	}
	return resolved
}

// uterapiBaseURLForTest lets tests point the single-group creation at a mock.
var uterapiBaseURLForTest string

func uterapiBaseURL() string {
	if value := strings.TrimSpace(uterapiBaseURLForTest); value != "" {
		return value
	}
	// System Settings → Channels stores the API address separately from the
	// console login URL. Prefer that explicit API address (the primary source
	// for model/price discovery), then fall back to the legacy operational
	// endpoint option for deployments that have not migrated yet. The console
	// login URL is never used here.
	if value := strings.TrimSpace(service.SubscriptionChannelProviderCredentials().APIURL); value != "" {
		return value
	}
	return service.UterAPIUpstreamBaseURL()
}

// CreateUterAPIChannels creates one NewAPI-compatible channel per supplied key and
// syncs its catalogue prices. Errors are reported per key so one bad key does
// not discard a working channel.
func CreateUterAPIChannels(c *gin.Context) {
	var req uterapiCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	group := strings.TrimSpace(req.Group)
	if group == "" {
		group = "default"
	}
	// req.Status is accepted for backwards compatibility but never allows a
	// freshly created channel to skip price verification. The channel is always
	// created disabled and is enabled only after every selected model has a
	// billable channel-scoped price.
	_ = req.Status

	base := uterapiBaseURL()
	if base == "" {
		common.ApiErrorMsg(c, "Uter.api upstream endpoint is not configured")
		return
	}
	// One create request shares a single upstream snapshot across discovery,
	// authorization, price sync and auto verification. The cache lives only in
	// this request context, so the next operation still fetches fresh prices.
	ctx, _ := service.WithUterAPIUpstreamCache(c.Request.Context())
	// 优特订阅（Uter.api）也复用系统设置里的订阅密钥槽位：浏览器只拿到掩码，
	// 无法把明文填进输入框，因此由服务端在 slot 没带 key 时按分组补齐，并沿用
	// 该槽位保存的添加模式。与通用 AddChannel 使用同一真源（subscription 组），
	// 操作者显式填的 key 始终优先。
	credentials := service.SubscriptionChannelProviderCredentials()
	resolvedSlots := resolveUterAPICreateSlots(req.Slots, credentials)

	results := make([]gin.H, 0, len(resolvedSlots))
	created := 0
	lastErr := ""
	for _, slot := range resolvedSlots {
		name := slot.Name
		keys := slot.Keys
		upstreamGroup := slot.Group
		discovered, usableKeys, discoveryErr := discoverUterAPIModels(ctx, keys)
		if len(usableKeys) == 0 {
			results = append(results, gin.H{"name": name, "group": upstreamGroup, "error": common.LogText("model discovery failed: %s", discoveryErr)})
			lastErr = discoveryErr
			continue
		}
		// 分组归属只依据上游 /api/pricing 的 enable_groups 和该 Key 实际可见的
		// 模型目录，不再用模型名称中的 claude/gpt 关键字推断。
		models, authErr := service.AuthorizedUterAPIModels(
			ctx, base, upstreamGroup, usableKeys, discovered,
		)
		if authErr != nil || len(models) == 0 {
			reason := "no model is authorized for the selected group"
			if authErr != nil {
				reason = authErr.Error()
			}
			results = append(results, gin.H{"name": name, "group": upstreamGroup, "error": reason})
			lastErr = reason
			continue
		}
		mappingJSON := strings.TrimSpace(req.ModelMapping)
		servedModels, modelErr := requestedUterAPIModels(req.Models, mappingJSON, models)
		if modelErr != nil {
			results = append(results, gin.H{"name": name, "group": upstreamGroup, "error": modelErr.Error()})
			lastErr = modelErr.Error()
			continue
		}
		channel := model.Channel{
			Type: constant.ChannelTypeUterAPI, Name: name, BaseURL: &base, Key: strings.Join(usableKeys, "\n"),
			Models: strings.Join(servedModels, ","), Group: group, Status: 0,
			CreatedTime: common.GetTimestamp(),
		}
		if mappingJSON != "" {
			mappingValue := mappingJSON
			channel.ModelMapping = &mappingValue
		}
		if len(usableKeys) > 1 {
			channel.ChannelInfo.IsMultiKey = true
			channel.ChannelInfo.MultiKeySize = len(usableKeys)
			channel.ChannelInfo.MultiKeyMode = slot.Strategy
			if channel.ChannelInfo.MultiKeyMode != constant.MultiKeyModeRandom &&
				channel.ChannelInfo.MultiKeyMode != constant.MultiKeyModePolling {
				channel.ChannelInfo.MultiKeyMode = constant.MultiKeyModePolling
			}
		}
		channelSettings := dto.ChannelOtherSettings{
			// 新建渠道从落库第一刻起就声明为渠道独立定价待验证状态，
			// 即使价格表为空也绝不回退到旧版全局价格。
			PricingMode: dto.ChannelPricingModeScopedPending,
			// Group keys keep changing their catalogue upstream; follow additions
			// automatically. collectPendingUpstreamModelChanges filters the answer
			// to this group's family, so the whole-account catalogue cannot leak in.
			UpstreamModelUpdateCheckEnabled:    true,
			UpstreamModelUpdateAutoSyncEnabled: true,
		}
		channel.SetOtherSettings(channelSettings)
		// Uter.api 专用创建端点必须和通用 AddChannel 一样继承系统设置
		// 「优特订阅」里的控制台登录信息。这里只补 console 块：BaseURL 已由
		// 托管上游地址确定、Key 已由 slot 确定，凭据里的同名值不能覆盖它们。
		// 密码只在服务端以加密信封写入 OtherSettings，绝不回传浏览器。
		mergedSettings, credErr := mergeConsoleCredentialsIntoSettings(
			channel.OtherSettings, credentials.LoginURL, credentials.Username, credentials.Password,
		)
		if credErr != nil {
			results = append(results, gin.H{"name": name, "group": upstreamGroup, "error": credErr.Error()})
			lastErr = credErr.Error()
			continue
		}
		channel.OtherSettings = mergedSettings
		if err := validateChannel(&channel, true); err != nil {
			results = append(results, gin.H{"name": name, "group": upstreamGroup, "error": err.Error()})
			lastErr = err.Error()
			continue
		}
		batch := []model.Channel{channel}
		if err := model.BatchInsertChannels(batch); err != nil {
			results = append(results, gin.H{"name": name, "group": upstreamGroup, "error": err.Error()})
			lastErr = err.Error()
			continue
		}
		channel = batch[0]
		// Channel.Status 的 gorm 默认值是 1：零值插入会被数据库改回启用。
		// 必须显式写回 0，否则价格同步失败时渠道仍然处于可计费状态。
		if err := model.DB.Model(&model.Channel{}).Where("id = ?", channel.Id).
			Update("status", 0).Error; err != nil {
			results = append(results, gin.H{"name": name, "group": upstreamGroup, "error": err.Error()})
			lastErr = err.Error()
			continue
		}
		// AddAbilities ran with GORM's status=1 default. The channel is forced
		// disabled until prices are verified, so its abilities must be disabled
		// too or the draft leaks into the pricing page.
		if err := model.UpdateAbilityStatus(channel.Id, false); err != nil {
			results = append(results, gin.H{"name": name, "group": upstreamGroup, "error": err.Error()})
			lastErr = err.Error()
			continue
		}
		channel.Status = 0
		created++
		createdChannel, _ := model.GetChannelById(channel.Id, false)
		if createdChannel == nil || createdChannel.Key == "" {
			createdChannel = &channel
		}
		written := 0
		pricingErr := ""
		priceRatio := 1.0
		groupName := ""
		if count, ratio, resolvedGroup, syncErr := service.SyncUterAPIChannelPricing(ctx, createdChannel, upstreamGroup); syncErr != nil {
			pricingErr = syncErr.Error()
			common.SysError(common.LogText("Uter.api price sync failed after create: channel_id=%d, error=%v", channel.Id, syncErr))
		} else {
			written = count
			priceRatio = ratio
			groupName = resolvedGroup
		}
		entry := gin.H{
			"channel_id": channel.Id, "name": name, "type": channel.Type,
			"base_url": base, "models": servedModels, "pricing_written": written,
			"group": upstreamGroup, "group_name": groupName, "price_ratio": priceRatio,
			"keys": len(usableKeys), "status": 0, "pricing_verified": false,
		}
		// 价格同步成功也不等于可计费：逐个模型确认存在可计费的渠道级价格后，
		// 才允许把渠道从禁用切到启用，并把定价模式升级为 ACTIVE。
		if pricingErr == "" {
			if missing := unbillableChannelModels(channel.Id, servedModels); len(missing) > 0 {
				pricingErr = common.LogText("pricing verification failed for models: %s", strings.Join(missing, ","))
			}
		}
		if pricingErr != "" {
			entry["pricing_error"] = pricingErr
			lastErr = pricingErr
			common.SysError(common.LogText(
				"Uter.api channel stays disabled: channel_id=%d, reason=%s", channel.Id, pricingErr,
			))
		} else {
			model.UpdateChannelStatus(channel.Id, "", common.ChannelStatusEnabled, "pricing_verified")
			// 基于落库时的 settings 升级定价模式，而不是用最初的 channelSettings
			// 重新序列化，否则会抹掉上一步继承的 upstream_console 凭据块。
			updatedSettings := channel.GetOtherSettings()
			updatedSettings.PricingMode = dto.ChannelPricingModeScopedActive
			if raw, marshalErr := common.Marshal(updatedSettings); marshalErr == nil {
				if err := model.DB.Model(&model.Channel{}).Where("id = ?", channel.Id).
					Update("settings", string(raw)).Error; err != nil {
					common.SysError(common.LogText(
						"persist active pricing mode failed: channel_id=%d, error=%v", channel.Id, err,
					))
				}
			}
			model.InitChannelCache()
			entry["status"] = common.ChannelStatusEnabled
			entry["pricing_verified"] = true
		}
		results = append(results, entry)
	}
	recordManageAudit(c, "channel.create.uterapi", map[string]any{
		"group": group, "created": created,
	})
	if created == 0 {
		if lastErr == "" {
			lastErr = "no Uter.api channel could be created"
		}
		common.ApiError(c, errors.New(lastErr))
		return
	}
	common.ApiSuccess(c, gin.H{"channels": results, "created": created})
}

// unbillableChannelModels returns every selected model without a uniquely
// resolvable, configured channel-scoped price. An official-only row, a review
// row or a missing row all count as unbillable, so no request can fall back to
// the global price while any of these models remains selected.
func unbillableChannelModels(channelID int, models []string) []string {
	missing := make([]string, 0)
	for _, name := range models {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		effective := model.ResolveEffectiveChannelPricing(channelID, name)
		if !effective.Billable {
			missing = append(missing, name)
		}
	}
	sort.Strings(missing)
	return missing
}

func normalizeUterAPIKeys(list []string) []string {
	seen := make(map[string]bool)
	out := make([]string, 0, len(list))
	for _, raw := range list {
		key := strings.TrimSpace(raw)
		if key == "" || seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, key)
	}
	return out
}

// resolveUterAPIRequestTail walks a redirect mapping to the upstream model a
// request name actually calls. A cycle is rejected rather than guessed.
func resolveUterAPIRequestTail(mapping map[string]string, start string) (string, bool) {
	current := start
	visited := map[string]bool{current: true}
	for {
		mapped, exists := mapping[current]
		if !exists || strings.TrimSpace(mapped) == "" {
			return current, false
		}
		mapped = strings.TrimSpace(mapped)
		if visited[mapped] {
			if mapped == current {
				return current, false
			}
			return "", true
		}
		visited[mapped] = true
		current = mapped
	}
}

// requestedUterAPIModels validates wizard-selected request names against the
// models the key can actually call. Redirect aliases stay in the channel model
// list so price rows are keyed by the name relay bills against, but every
// alias must resolve to an authorized upstream model.
func requestedUterAPIModels(raw string, mappingJSON string, authorized []string) ([]string, error) {
	if strings.TrimSpace(raw) == "" {
		return authorized, nil
	}
	mapping := map[string]string{}
	if strings.TrimSpace(mappingJSON) != "" {
		if err := common.UnmarshalJsonStr(mappingJSON, &mapping); err != nil {
			return nil, fmt.Errorf("invalid model mapping: %w", err)
		}
		for source, target := range mapping {
			if strings.TrimSpace(target) == "" {
				return nil, fmt.Errorf("model mapping target for %q is empty", source)
			}
		}
	}
	authorizedSet := make(map[string]bool, len(authorized))
	for _, name := range authorized {
		authorizedSet[strings.TrimSpace(name)] = true
	}
	seen := make(map[string]bool)
	models := make([]string, 0)
	for _, name := range strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == '\n' || r == '\r' || r == '\t' || r == ' '
	}) {
		name = strings.TrimSpace(name)
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		tail, cyclic := resolveUterAPIRequestTail(mapping, name)
		if cyclic || tail == "" {
			return nil, fmt.Errorf("model mapping cycle for %q", name)
		}
		if !authorizedSet[tail] {
			return nil, fmt.Errorf("model %q is not authorized for this group", name)
		}
		models = append(models, name)
	}
	if len(models) == 0 {
		return nil, errors.New("no selected model is authorized for this group")
	}
	return models, nil
}

// discoverUterAPIModels returns the models every usable key can call. A failing
// key is dropped; a model visible to only one key is excluded so polling can
// never route a request to a key that cannot serve it. The box fails only when
// no key works.
func discoverUterAPIModels(ctx context.Context, keys []string) ([]string, []string, string) {
	usable := make([]string, 0, len(keys))
	lastErr := ""
	perKey := make([][]string, 0, len(keys))
	for _, key := range keys {
		found, err := service.OpenAIModelIDsWithUterAPICache(ctx, uterapiBaseURL(), key)
		if err != nil {
			lastErr = err.Error()
			continue
		}
		if len(found) == 0 {
			lastErr = "upstream returned an empty model catalogue"
			continue
		}
		usable = append(usable, key)
		perKey = append(perKey, found)
	}
	if len(perKey) == 0 {
		return []string{}, usable, lastErr
	}
	commonToAll := make(map[string]bool)
	for _, name := range perKey[0] {
		commonToAll[name] = true
	}
	for _, list := range perKey[1:] {
		current := make(map[string]bool, len(list))
		for _, name := range list {
			current[name] = true
		}
		for name := range commonToAll {
			if !current[name] {
				delete(commonToAll, name)
			}
		}
	}
	models := make([]string, 0, len(commonToAll))
	for name := range commonToAll {
		models = append(models, name)
	}
	sort.Strings(models)
	return models, usable, lastErr
}

// GetUterAPIPricingGroups lists the upstream billing groups and their price
// multipliers so the create flow can bind a key to the group it was issued for.
func GetUterAPIPricingGroups(c *gin.Context) {
	ctx, _ := service.WithUterAPIUpstreamCache(c.Request.Context())
	groups, err := service.FetchUterAPIPricingGroups(ctx)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, gin.H{"groups": groups})
}
