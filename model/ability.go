package model

import (
	"fmt"
	"slices"
	"sort"
	"strings"
	"sync"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/dto"
	"github.com/uter-ai/uter/setting/ratio_setting"

	"github.com/samber/lo"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Ability struct {
	Group     string  `json:"group" gorm:"type:varchar(64);primaryKey;autoIncrement:false"`
	Model     string  `json:"model" gorm:"type:varchar(255);primaryKey;autoIncrement:false"`
	ChannelId int     `json:"channel_id" gorm:"primaryKey;autoIncrement:false;index"`
	Enabled   bool    `json:"enabled"`
	Priority  *int64  `json:"priority" gorm:"bigint;default:0;index"`
	Weight    uint    `json:"weight" gorm:"default:0;index"`
	Tag       *string `json:"tag" gorm:"index"`
}

type AbilityWithChannel struct {
	Ability
	ChannelType int `json:"channel_type"`
	// ChannelName 是渠道的展示名（管理-渠道里的 name），定价页按渠道筛选用。
	// 空名渠道不参与筛选，调用方据此跳过。
	ChannelName string `json:"channel_name"`
	// ChannelStatus 是渠道当前状态；能力行可能短暂残留于已禁用渠道，
	// 定价页的渠道列表只认启用渠道。
	ChannelStatus int `json:"channel_status"`
}

func GetAllEnableAbilityWithChannels() ([]AbilityWithChannel, error) {
	var abilities []AbilityWithChannel
	// The join is intentionally inner: an ability whose channel row no longer
	// exists is orphaned data and must not make that deleted channel's models
	// appear in the pricing or model metadata.
	err := DB.Table("abilities").
		Select("abilities.*, channels.type as channel_type, channels.name as channel_name, channels.status as channel_status").
		Joins("join channels on abilities.channel_id = channels.id").
		Where("abilities.enabled = ?", true).
		Scan(&abilities).Error
	return abilities, err
}

// GetEnabledChannelNamesForGroups 返回在给定分组内可用、且处于启用状态的
// 渠道展示名（去重后按名称排序）。空名渠道不会出现在结果里。
func GetEnabledChannelNamesForGroups(groups []string) []string {
	if len(groups) == 0 {
		return []string{}
	}
	names := make([]string, 0)
	err := DB.Table("abilities").
		Distinct("channels.name").
		Joins("join channels on abilities.channel_id = channels.id").
		Where("abilities.enabled = ?", true).
		Where("channels.status = ?", common.ChannelStatusEnabled).
		Where("channels.name <> ''").
		Where("abilities."+commonGroupCol+" IN ?", groups).
		Pluck("channels.name", &names).Error
	if err != nil {
		common.SysError(common.LogText("list user channels error: %v", err))
		return []string{}
	}
	slices.Sort(names)
	return names
}

// GetChannelEnabledModels 返回某个渠道在给定分组内提供的模型（去重排序）。
func GetChannelEnabledModels(channelName string, groups []string) []string {
	if channelName == "" || len(groups) == 0 {
		return []string{}
	}
	models := make([]string, 0)
	err := DB.Table("abilities").
		Distinct("abilities.model").
		Joins("join channels on abilities.channel_id = channels.id").
		Where("abilities.enabled = ?", true).
		Where("channels.status = ?", common.ChannelStatusEnabled).
		Where("channels.name = ?", channelName).
		Where("abilities."+commonGroupCol+" IN ?", groups).
		Pluck("abilities.model", &models).Error
	if err != nil {
		common.SysError(common.LogText("list channel models error: %v", err))
		return []string{}
	}
	slices.Sort(models)
	return models
}

func GetGroupEnabledModels(group string) []string {
	var models []string
	// Find distinct models
	DB.Table("abilities").Where(commonGroupCol+" = ? and enabled = ?", group, true).Distinct("model").Pluck("model", &models)
	return models
}

func GetEnabledModels() []string {
	var models []string
	// Find distinct models
	DB.Table("abilities").Where("enabled = ?", true).Distinct("model").Pluck("model", &models)
	return models
}

func GetChannel(
	group string,
	model string,
	retry int,
	filters []dto.ChannelFilter,
) (*Channel, error) {
	var abilities []Ability
	err := DB.Where(commonGroupCol+" = ? and model = ? and enabled = ?", group, model, true).Order("priority DESC, weight DESC").Find(&abilities).Error
	if err != nil {
		return nil, err
	}
	abilities = filterAbilitiesByConstraints(abilities, model, filters)
	// Like the memory cache, retry with the routing name (for example without
	// @ modifiers) when no channel serves the exact name.
	if normalized := ratio_setting.RoutingMatchModelName(model); len(abilities) == 0 && normalized != "" && normalized != model {
		err = DB.Where(commonGroupCol+" = ? and model = ? and enabled = ?", group, normalized, true).Order("priority DESC, weight DESC").Find(&abilities).Error
		if err != nil {
			return nil, err
		}
		abilities = filterAbilitiesByConstraints(abilities, model, filters)
	}
	if len(abilities) > 0 {
		priorities := make([]int64, 0)
		seen := make(map[int64]bool)
		for _, ability := range abilities {
			priority := int64(0)
			if ability.Priority != nil {
				priority = *ability.Priority
			}
			if !seen[priority] {
				seen[priority] = true
				priorities = append(priorities, priority)
			}
		}
		sort.Slice(priorities, func(i, j int) bool { return priorities[i] > priorities[j] })
		if retry >= len(priorities) {
			retry = len(priorities) - 1
		}
		targetPriority := priorities[retry]
		abilities = lo.Filter(abilities, func(ability Ability, _ int) bool {
			return ability.Priority == nil && targetPriority == 0 || ability.Priority != nil && *ability.Priority == targetPriority
		})
	}
	channel := Channel{}
	if len(abilities) > 0 {
		// Randomly choose one
		weightSum := uint(0)
		for _, ability_ := range abilities {
			weightSum += ability_.Weight + 10
		}
		// Randomly choose one
		weight := common.GetRandomInt(int(weightSum))
		for _, ability_ := range abilities {
			weight -= int(ability_.Weight) + 10
			//log.Printf("weight: %d, ability weight: %d", weight, *ability_.Weight)
			if weight <= 0 {
				channel.Id = ability_.ChannelId
				break
			}
		}
	} else {
		return nil, nil
	}
	err = DB.First(&channel, "id = ?", channel.Id).Error
	return &channel, err
}

// filterAbilitiesByConstraints applies the same ChannelSatisfiesFilters
// predicate used by the memory-cache path. A failed channel lookup fails
// closed when a task-plugin identity is required and fails open otherwise.
func filterAbilitiesByConstraints(abilities []Ability, modelName string, filters []dto.ChannelFilter) []Ability {
	if len(abilities) == 0 {
		return nil
	}

	channelIds := make([]int, 0, len(abilities))
	seen := make(map[int]struct{}, len(abilities))
	for _, ability := range abilities {
		if _, ok := seen[ability.ChannelId]; ok {
			continue
		}
		seen[ability.ChannelId] = struct{}{}
		channelIds = append(channelIds, ability.ChannelId)
	}

	var channels []*Channel
	if err := DB.Where("id IN ?", channelIds).Find(&channels).Error; err != nil {
		if identityFilterRequiresKey(filters) {
			return nil
		}
		return abilities
	}

	channelsByID := make(map[int]*Channel, len(channels))
	for _, channel := range channels {
		channelsByID[channel.Id] = channel
	}

	filtered := make([]Ability, 0, len(abilities))
	for _, ability := range abilities {
		channel := channelsByID[ability.ChannelId]
		if ok, _ := ChannelSatisfiesFilters(channel, modelName, filters); ok {
			filtered = append(filtered, ability)
		}
	}
	return filtered
}

func identityFilterRequiresKey(filters []dto.ChannelFilter) bool {
	for _, filter := range filters {
		if filter.Kind == dto.FilterTaskPluginIdentity && filter.TaskPluginKey != "" {
			return true
		}
	}
	return false
}

func (channel *Channel) AddAbilities(tx *gorm.DB) error {
	models_ := strings.Split(channel.Models, ",")
	groups_ := strings.Split(channel.Group, ",")
	abilitySet := make(map[string]struct{})
	abilities := make([]Ability, 0, len(models_))
	for _, model := range models_ {
		for _, group := range groups_ {
			key := group + "|" + model
			if _, exists := abilitySet[key]; exists {
				continue
			}
			abilitySet[key] = struct{}{}
			ability := Ability{
				Group:     group,
				Model:     model,
				ChannelId: channel.Id,
				Enabled:   channel.Status == common.ChannelStatusEnabled,
				Priority:  channel.Priority,
				Weight:    uint(channel.GetWeight()),
				Tag:       channel.Tag,
			}
			abilities = append(abilities, ability)
		}
	}
	if len(abilities) == 0 {
		return nil
	}
	// choose DB or provided tx
	useDB := DB
	if tx != nil {
		useDB = tx
	}
	for _, chunk := range lo.Chunk(abilities, 50) {
		err := useDB.Clauses(clause.OnConflict{DoNothing: true}).Create(&chunk).Error
		if err != nil {
			return err
		}
	}
	return nil
}

func (channel *Channel) DeleteAbilities() error {
	return DB.Where("channel_id = ?", channel.Id).Delete(&Ability{}).Error
}

// UpdateAbilities updates abilities of this channel.
// Make sure the channel is completed before calling this function.
func (channel *Channel) UpdateAbilities(tx *gorm.DB) error {
	isNewTx := false
	// 如果没有传入事务，创建新的事务
	if tx == nil {
		tx = DB.Begin()
		if tx.Error != nil {
			return tx.Error
		}
		isNewTx = true
		defer func() {
			if r := recover(); r != nil {
				tx.Rollback()
			}
		}()
	}

	// First delete all abilities of this channel
	err := tx.Where("channel_id = ?", channel.Id).Delete(&Ability{}).Error
	if err != nil {
		if isNewTx {
			tx.Rollback()
		}
		return err
	}

	// Then add new abilities
	models_ := channel.GetModels()
	groups_ := strings.Split(channel.Group, ",")
	abilitySet := make(map[string]struct{})
	abilities := make([]Ability, 0, len(models_))
	for _, model := range models_ {
		for _, group := range groups_ {
			key := group + "|" + model
			if _, exists := abilitySet[key]; exists {
				continue
			}
			abilitySet[key] = struct{}{}
			ability := Ability{
				Group:     group,
				Model:     model,
				ChannelId: channel.Id,
				Enabled:   channel.Status == common.ChannelStatusEnabled,
				Priority:  channel.Priority,
				Weight:    uint(channel.GetWeight()),
				Tag:       channel.Tag,
			}
			abilities = append(abilities, ability)
		}
	}

	if len(abilities) > 0 {
		for _, chunk := range lo.Chunk(abilities, 50) {
			err = tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&chunk).Error
			if err != nil {
				if isNewTx {
					tx.Rollback()
				}
				return err
			}
		}
	}

	// 如果是新创建的事务，需要提交
	if isNewTx {
		return tx.Commit().Error
	}

	return nil
}

// rebuildChannelAbilitiesTx rewrites one channel's abilities from the row as
// it exists inside tx. Enabled follows the persisted channel status, and the
// model/group list follows the final saved selection. The caller owns the
// transaction so a channel status promotion and its abilities commit together.
func rebuildChannelAbilitiesTx(tx *gorm.DB, channelID int) error {
	var current Channel
	if err := tx.First(&current, channelID).Error; err != nil {
		return err
	}
	return current.UpdateAbilities(tx)
}

// RebuildChannelAbilities repairs status or model/group drift for one channel.
// Draft creation writes abilities while the channel is disabled; if the draft
// is later enabled by a direct status write, those abilities stay disabled and
// the channel disappears from pricing and routing. Rebuilding from the row is
// idempotent for a healthy channel.
func RebuildChannelAbilities(channelID int) error {
	if channelID <= 0 {
		return fmt.Errorf("channel id is required")
	}
	if err := DB.Transaction(func(tx *gorm.DB) error {
		return rebuildChannelAbilitiesTx(tx, channelID)
	}); err != nil {
		return err
	}
	InvalidatePricingCache()
	BumpSyncTopic(SyncTopicChannels)
	return nil
}

// HasAbilityStatusDrift reports whether any channel/ability pair disagrees,
// or an enabled channel with a model list has no abilities at all. A direct
// channels.status write (the old draft publish path) is the common cause.
func HasAbilityStatusDrift() (bool, error) {
	var mismatched int64
	if err := DB.Raw(
		`SELECT COUNT(*) FROM abilities a
		 JOIN channels c ON c.id = a.channel_id
		 WHERE a.enabled <> (c.status = ?)`,
		common.ChannelStatusEnabled,
	).Scan(&mismatched).Error; err != nil {
		return false, err
	}
	if mismatched > 0 {
		return true, nil
	}
	var missing int64
	if err := DB.Raw(
		`SELECT COUNT(*) FROM channels c
		 WHERE c.status = ? AND COALESCE(c.models, '') <> ''
		   AND NOT EXISTS (SELECT 1 FROM abilities a WHERE a.channel_id = c.id)`,
		common.ChannelStatusEnabled,
	).Scan(&missing).Error; err != nil {
		return false, err
	}
	return missing > 0, nil
}

// ActivateChannelWithAbilities enables a channel and rewrites its abilities in
// one transaction. Enabling only the channel row leaves draft abilities at
// enabled=false, which makes an otherwise active channel invisible on the
// pricing page (GetAllEnableAbilityWithChannels filters on abilities.enabled).
func ActivateChannelWithAbilities(channelID int, updates map[string]any) error {
	if channelID <= 0 {
		return fmt.Errorf("channel id is required")
	}
	values := make(map[string]any, len(updates)+1)
	for key, value := range updates {
		values[key] = value
	}
	values["status"] = common.ChannelStatusEnabled
	if err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&Channel{}).Where("id = ?", channelID).Updates(values).Error; err != nil {
			return err
		}
		return rebuildChannelAbilitiesTx(tx, channelID)
	}); err != nil {
		return err
	}
	InvalidatePricingCache()
	BumpSyncTopic(SyncTopicChannels)
	return nil
}

func UpdateAbilityStatus(channelId int, status bool) error {
	return DB.Model(&Ability{}).Where("channel_id = ?", channelId).Select("enabled").Update("enabled", status).Error
}

func UpdateAbilityStatusByTag(tag string, status bool) error {
	return DB.Model(&Ability{}).Where("tag = ?", tag).Select("enabled").Update("enabled", status).Error
}

func UpdateAbilityByTag(tag string, newTag *string, priority *int64, weight *uint) error {
	ability := Ability{}
	if newTag != nil {
		ability.Tag = newTag
	}
	if priority != nil {
		ability.Priority = priority
	}
	if weight != nil {
		ability.Weight = *weight
	}
	return DB.Model(&Ability{}).Where("tag = ?", tag).Updates(ability).Error
}

var fixLock = sync.Mutex{}

func FixAbility() (int, int, error) {
	// The repaired abilities bump the channel topic, so every node reloads
	// the channel cache within seconds.
	defer BumpSyncTopic(SyncTopicChannels)
	lock := fixLock.TryLock()
	if !lock {
		return 0, 0, common.NewMessage("A repair task is already running. Please try again later")
	}
	defer fixLock.Unlock()

	// Rebuild inside one transaction. A mid-rebuild failure used to leave the
	// abilities table truncated, which silently removed every channel from
	// routing until an operator ran the repair again.
	rebuilt := 0
	err := DB.Transaction(func(tx *gorm.DB) error {
		var channels []*Channel
		if err := tx.Model(&Channel{}).Find(&channels).Error; err != nil {
			return err
		}
		if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Ability{}).Error; err != nil {
			return err
		}
		for _, channel := range channels {
			if err := channel.AddAbilities(tx); err != nil {
				return fmt.Errorf("add abilities for channel %d: %w", channel.Id, err)
			}
			rebuilt++
		}
		return nil
	})
	if err != nil {
		common.SysLog(common.LogText("Fix abilities rolled back: %s", err.Error()))
		return 0, 1, err
	}
	InitChannelCache()
	return rebuilt, 0, nil
}
