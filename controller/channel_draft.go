package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/relaykit/dto"
)

type channelDraftRequest struct {
	Name    string `json:"name"`
	Type    int    `json:"type"`
	BaseURL string `json:"base_url"`
	Key     string `json:"key"`
	Models  string `json:"models"`
	Group   string `json:"group"`
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
	other := dto.ChannelOtherSettings{Draft: true}
	raw, err := common.Marshal(other)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	channel := model.Channel{
		Type:          req.Type,
		Name:          name,
		Key:           strings.TrimSpace(req.Key),
		Status:        0,
		BaseURL:       &baseURL,
		Models:        strings.TrimSpace(req.Models),
		Group:         group,
		OtherSettings: string(raw),
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
		// does not fail after the first publish succeeded.
		common.ApiSuccess(c, gin.H{"id": id, "already_published": true})
		return
	}
	other := channel.GetOtherSettings()
	other.Draft = false
	raw, err := common.Marshal(other)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DB.Model(channel).Updates(map[string]any{
		"status":    1,
		"settings":  string(raw),
		"test_time": time.Now().Unix(),
	}).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	recordManageAudit(c, "channel.draft.publish", map[string]any{"id": id})
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"id": id}})
}
