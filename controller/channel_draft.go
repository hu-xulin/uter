package controller

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/uter-ai/uter/service"
)

type channelDraftRequest struct {
	Name         string                `json:"name"`
	Type         int                   `json:"type"`
	BaseURL      string                `json:"base_url"`
	Key          string                `json:"key"`
	Models       string                `json:"models"`
	Group        string                `json:"group"`
	Mode         string                `json:"mode"`
	MultiKeyMode constant.MultiKeyMode `json:"multi_key_mode"`
}

// normalizeDraftCredentialMode keeps a create-wizard draft's key shape and
// ChannelInfo in sync with the selected Add Mode. Catalog-backed drafts publish
// exactly one channel, so "batch" keys are rotated inside that channel instead
// of being sent as a single newline-joined Authorization header. "single" keeps
// only the first key, which also repairs a draft that was previously in a
// multi-key mode.
func normalizeDraftCredentialMode(
	info *model.ChannelInfo,
	key *string,
	mode string,
	strategy constant.MultiKeyMode,
) error {
	cleanKeys := make([]string, 0)
	for _, rawKey := range strings.Split(*key, "\n") {
		trimmed := strings.TrimSpace(rawKey)
		if trimmed == "" {
			continue
		}
		cleanKeys = append(cleanKeys, trimmed)
	}

	if mode == "single" || mode == "" {
		info.IsMultiKey = false
		info.MultiKeySize = 0
		info.MultiKeyStatusList = nil
		info.MultiKeyDisabledReason = nil
		info.MultiKeyDisabledTime = nil
		info.MultiKeyPollingIndex = 0
		if len(cleanKeys) > 0 {
			*key = cleanKeys[0]
		}
		return nil
	}

	if mode != "batch" && mode != "multi_to_single" {
		return nil
	}
	if len(cleanKeys) == 0 {
		return fmt.Errorf("Channel key cannot be empty")
	}

	info.IsMultiKey = true
	info.MultiKeySize = len(cleanKeys)
	info.MultiKeyStatusList = nil
	info.MultiKeyDisabledReason = nil
	info.MultiKeyDisabledTime = nil
	info.MultiKeyPollingIndex = 0
	if mode == "batch" {
		info.MultiKeyMode = constant.MultiKeyModePolling
	} else {
		info.MultiKeyMode = strategy
		if info.MultiKeyMode != constant.MultiKeyModeRandom &&
			info.MultiKeyMode != constant.MultiKeyModePolling {
			info.MultiKeyMode = constant.MultiKeyModeRandom
		}
	}
	*key = strings.Join(cleanKeys, "\n")
	return nil
}

// CreateChannelDraft creates a disabled, hidden channel so the create wizard
// can configure channel-scoped prices before the operator presses Create.
// Pricing rows use this real channel ID; the final save updates the row and
// publishes it.
func CreateChannelDraft(c *gin.Context) {
	var req channelDraftRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Type <= 0 {
		common.ApiErrorMsg(c, "Channel type is required")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = fmt.Sprintf("Draft channel %d", time.Now().Unix())
	}
	group := strings.TrimSpace(req.Group)
	if group == "" {
		group = "default"
	}
	baseURL := strings.TrimSpace(req.BaseURL)

	// The create wizard creates its channel before the final AddChannel call,
	// so system-settings credentials must be filled here as well. Otherwise the
	// draft has no key and the final save cannot know the saved key's Add Mode.
	if strings.TrimSpace(req.Key) == "" || baseURL == "" {
		providerChannel := &model.Channel{
			Type:    req.Type,
			Key:     req.Key,
			Group:   group,
			BaseURL: &baseURL,
		}
		credentialFill, err := applyChannelProviderCredentialsDetailed(providerChannel)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		req.Key = providerChannel.Key
		if providerChannel.BaseURL != nil {
			baseURL = strings.TrimSpace(*providerChannel.BaseURL)
		}
		if credentialFill.UsedSavedKey && credentialFill.Mode != "" {
			req.Mode = credentialFill.Mode
			req.MultiKeyMode = credentialFill.MultiKeyMode
		}
	}

	// The create wizard persists the channel as a draft first, then finishes
	// configuration through UpdateChannel. The direct-create path (AddChannel)
	// derives multi-key state from mode; the draft path must do the same,
	// otherwise a wizard-created multi-key channel keeps IsMultiKey=false and
	// sends the newline-joined keys as one Authorization header, which net/http
	// rejects. Normalise the key here so the draft is correct from creation.
	channelInfo := model.ChannelInfo{}
	key := strings.TrimSpace(req.Key)
	if err := normalizeDraftCredentialMode(
		&channelInfo,
		&key,
		req.Mode,
		req.MultiKeyMode,
	); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	other := dto.ChannelOtherSettings{
		Draft: true,
		// A new channel is scoped-pending from the first write onward. It must
		// never reach the global legacy price path, even while its price rows
		// are empty.
		PricingMode: dto.ChannelPricingModeScopedPending,
		// The unified create flow keeps the channel in sync without a second
		// manual step: follow upstream model additions and apply them.
		UpstreamModelUpdateCheckEnabled:    true,
		UpstreamModelUpdateAutoSyncEnabled: true,
	}
	raw, err := common.Marshal(other)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	channel := model.Channel{
		Type:          req.Type,
		Name:          name,
		Key:           key,
		Status:        0,
		BaseURL:       &baseURL,
		Models:        strings.TrimSpace(req.Models),
		Group:         group,
		OtherSettings: string(raw),
		ChannelInfo:   channelInfo,
		CreatedTime:   common.GetTimestamp(),
	}
	channels := []model.Channel{channel}
	if err := model.BatchInsertChannels(channels); err != nil {
		common.ApiError(c, err)
		return
	}
	// BatchInsertChannels assigns IDs to the slice elements; the local struct
	// copy above keeps Id=0, which previously made the draft API return 0 and
	// left the pricing step without a real channel ID.
	channelID := channels[0].Id
	if channelID <= 0 {
		common.ApiErrorMsg(c, "Failed to create draft channel")
		return
	}
	// Channel.Status carries gorm:"default:1", so a zero value can be replaced
	// by the database default during insert. Force the draft back to disabled.
	if err := model.DB.Model(&model.Channel{}).Where("id = ?", channelID).Update("status", 0).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	// GORM applies the status=1 default before AddAbilities runs, so the
	// generated abilities can be enabled even though the draft is disabled.
	// Keep pricing/routing views consistent with the forced status=0.
	if err := model.UpdateAbilityStatus(channelID, false); err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	recordManageAudit(c, "channel.draft.create", map[string]any{
		"name": name,
		"type": req.Type,
	})
	common.ApiSuccess(c, gin.H{"id": channelID})
}

// PublishChannelDraft enables a draft after the final save. It refuses ordinary
// channels so this endpoint cannot silently enable a channel an operator
// disabled.
func PublishChannelDraft(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	channel, err := model.GetChannelById(id, true)
	if err != nil || channel == nil {
		common.ApiErrorMsg(c, "Draft channel not found")
		return
	}
	if channel.Status != 0 {
		// Already enabled: publishing is idempotent so a retried final save
		// does not fail after the first publish succeeded. Rebuild abilities
		// anyway: an older publish only flipped channels.status and left the
		// draft's disabled abilities behind, hiding the channel from pricing.
		if err := model.RebuildChannelAbilities(id); err != nil {
			common.ApiError(c, err)
			return
		}
		model.InitChannelCache()
		common.ApiSuccess(c, gin.H{"id": id, "already_published": true})
		return
	}
	other := channel.GetOtherSettings()
	if !other.Draft {
		common.ApiErrorMsg(c, "Only draft channels can be published")
		return
	}
	// A batch redirect publishes request aliases into the model list while the
	// configured sale price still lives under the upstream name. Relay bills
	// against the alias, so materialize its channel-scoped price by inheriting
	// the already-approved upstream price before the publish gate runs. This
	// never rewrites an existing row and never enables a non-billable price.
	if _, _, aliasErr := service.EnsureRedirectAliasPricing(id); aliasErr != nil {
		common.ApiError(c, aliasErr)
		return
	}
	rows, err := model.ListChannelModelPricing(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// Only models this channel actually serves can be routed to it: abilities
	// are generated one-for-one from channel.Models. A draft catalogue sync
	// writes the whole upstream directory (including review-only rows for
	// models the operator never selected); those rows can never bill a request
	// on this channel, so they must not block publishing.
	if blockers := draftPublishBlockers(rows, channel.GetModels()); len(blockers) > 0 {
		common.ApiErrorStatus(
			c,
			http.StatusOK,
			common.NewMessage(
				"Set a billable sale price for {{models}} before publishing",
				map[string]any{"models": strings.Join(blockers, "; ")},
			),
			gin.H{
				"code": "CHANNEL_DRAFT_PRICING_NOT_BILLABLE",
				"data": gin.H{"models": blockers},
			},
		)
		return
	}
	other.Draft = false
	// Only a fully verified draft becomes a channel-scoped billable channel.
	// Leaving it pending would block every request; promoting it here keeps the
	// DRAFT -> ... -> ACTIVE transition atomic with status=1.
	other.PricingMode = dto.ChannelPricingModeScopedActive
	raw, err := common.Marshal(other)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// Draft abilities were created with enabled=false while the channel was
	// disabled. A bare channels.status update leaves them disabled: the pricing
	// page reads abilities.enabled, so the channel and all its models vanish.
	// Promote the channel and rewrite abilities from the final model/group
	// selection in one transaction.
	if err := model.ActivateChannelWithAbilities(id, map[string]any{
		"settings":  string(raw),
		"test_time": time.Now().Unix(),
	}); err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	recordManageAudit(c, "channel.draft.publish", map[string]any{"id": id})
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"id": id}})
}

// draftPublishBlockers validates every selected model against its channel price
// rows. The selected model list — not the price table — is the baseline: a
// failed upstream sync writes zero rows, and iterating an empty table would
// otherwise declare an unpriced draft publishable.
//
// A row counts as publishable only when it is uniquely identifiable, configured,
// has a normalized internal sale price with an executable expression, and
// carries a price version. Full identity (provider/region/deployment/model)
// will narrow the match further when the channel serves several identities;
// today multiple rows for one selected model are rejected rather than guessed.
func draftPublishBlockers(rows []model.ChannelModelPricing, selectedModels []string) []string {
	wanted := make(map[string]bool, len(selectedModels))
	for _, name := range selectedModels {
		if name = strings.TrimSpace(name); name != "" {
			wanted[name] = true
		}
	}
	if len(wanted) == 0 {
		return nil
	}
	byModel := make(map[string][]model.ChannelModelPricing, len(wanted))
	for _, row := range rows {
		name := strings.TrimSpace(row.ModelName)
		if wanted[name] {
			byModel[name] = append(byModel[name], row)
		}
	}
	names := make([]string, 0, len(wanted))
	for name := range wanted {
		names = append(names, name)
	}
	sort.Strings(names)

	blockers := make([]string, 0)
	for _, name := range names {
		matched := byModel[name]
		switch {
		case len(matched) == 0:
			blockers = append(blockers, name+" (PRICE_MISSING)")
			continue
		case len(matched) != 1:
			blockers = append(blockers, name+" (PRICE_IDENTITY_AMBIGUOUS)")
			continue
		}
		row := matched[0]
		if row.PricingStatus != model.ChannelPricingStatusConfigured {
			blockers = append(blockers, name+" ("+row.PricingStatus+")")
			continue
		}
		if strings.TrimSpace(row.InternalPricing) == "" {
			blockers = append(blockers, name+" (SALE_PRICE_MISSING)")
			continue
		}
		var internal model.ChannelInternalPricing
		if err := common.UnmarshalJsonStr(row.InternalPricing, &internal); err != nil {
			blockers = append(blockers, name+" (PRICE_EXPRESSION_INVALID)")
			continue
		}
		if _, err := model.NormalizeChannelInternalPricing(&internal); err != nil {
			blockers = append(blockers, name+" (PRICE_EXPRESSION_INVALID)")
			continue
		}
		if strings.TrimSpace(row.PricingVersion) == "" {
			blockers = append(blockers, name+" (PRICE_VERSION_MISSING)")
		}
	}
	return blockers
}
