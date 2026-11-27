package model

import (
	"errors"
	"strings"

	"github.com/uter-ai/uter/common"

	"gorm.io/gorm"
)

// UpstreamMonitorTask is one operator-registered upstream endpoint under continuous
// quality/speed/authenticity monitoring. The API key is stored as an encrypted
// secret envelope (common.EncryptSecret) and is never returned by list/detail APIs.
type UpstreamMonitorTask struct {
	Id   int    `json:"id" gorm:"primaryKey"`
	Name string `json:"name" gorm:"type:varchar(128);not null"`
	// ChannelId references a channel managed in channel management. When set,
	// the probe resolves base_url/key/models from the live channel; BaseURL and
	// APIKeyEncrypted are kept as a snapshot fallback for deleted channels.
	// ChannelId == 0 marks a legacy task with its own embedded credentials.
	ChannelId           int    `json:"channel_id" gorm:"column:channel_id;not null;default:0;index"`
	ChannelName         string `json:"channel_name" gorm:"column:channel_name;type:varchar(128);not null;default:''"`
	ChannelGroup        string `json:"channel_group" gorm:"column:channel_group;type:varchar(64);not null;default:''"`
	ChannelKeyIndex     int    `json:"channel_key_index" gorm:"column:channel_key_index;not null;default:0"`
	BaseURL             string `json:"base_url" gorm:"type:varchar(512);not null"`
	APIKeyEncrypted     string `json:"-" gorm:"column:api_key_encrypted;type:text;not null"`
	APIKeyFingerprint   string `json:"api_key_fingerprint" gorm:"type:varchar(32)"`
	Model               string `json:"model" gorm:"type:varchar(256);not null"`
	Models              string `json:"models" gorm:"type:text"`
	Protocol            string `json:"protocol" gorm:"type:varchar(32);not null"`
	CheckIntervalMinute int    `json:"check_interval_minute" gorm:"not null;default:30"`
	ProbeDepth          string `json:"probe_depth" gorm:"type:varchar(32);not null;default:standard"`
	Enabled             bool   `json:"enabled" gorm:"not null"`
	Status              string `json:"status" gorm:"type:varchar(32);not null;default:unknown"`
	LastScore           int    `json:"last_score" gorm:"not null;default:0"`
	LastVerdict         string `json:"last_verdict" gorm:"type:varchar(32);not null;default:unknown"`
	LastRunAt           int64  `json:"last_run_at" gorm:"bigint;not null;default:0"`
	CreatedAt           int64  `json:"created_at" gorm:"bigint;not null;index"`
	UpdatedAt           int64  `json:"updated_at" gorm:"bigint;not null;index"`
}

// MonitorModels returns the model list for a task. Older rows only have the
// single-model column, so they keep working without a data migration.
func (task *UpstreamMonitorTask) MonitorModels() []string {
	if task == nil {
		return nil
	}
	models := make([]string, 0)
	seen := make(map[string]struct{})
	appendModel := func(raw string) {
		model := strings.TrimSpace(raw)
		if model == "" {
			return
		}
		if _, exists := seen[model]; exists {
			return
		}
		seen[model] = struct{}{}
		models = append(models, model)
	}
	if strings.TrimSpace(task.Models) != "" {
		var decoded []string
		if err := common.UnmarshalJsonStr(task.Models, &decoded); err == nil {
			for _, model := range decoded {
				appendModel(model)
			}
		}
	}
	if len(models) == 0 {
		appendModel(task.Model)
	}
	return models
}

func (task *UpstreamMonitorTask) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if task.CreatedAt == 0 {
		task.CreatedAt = now
	}
	if task.UpdatedAt == 0 {
		task.UpdatedAt = now
	}
	return nil
}

func (task *UpstreamMonitorTask) BeforeSave(_ *gorm.DB) error {
	if task.UpdatedAt == 0 {
		task.UpdatedAt = common.GetTimestamp()
	}
	return nil
}

// UpstreamMonitorReport is one immutable probe run result for a task.
type UpstreamMonitorReport struct {
	Id         int    `json:"id" gorm:"primaryKey"`
	TaskId     int    `json:"task_id" gorm:"not null;index"`
	Model      string `json:"model" gorm:"type:varchar(256);not null;default:'';index"`
	RunId      string `json:"run_id" gorm:"type:varchar(64);not null;uniqueIndex"`
	Score      int    `json:"score" gorm:"not null"`
	Verdict    string `json:"verdict" gorm:"type:varchar(32);not null"`
	Dimensions string `json:"dimensions" gorm:"type:text;not null"`
	Metrics    string `json:"metrics" gorm:"type:text;not null"`
	Probes     string `json:"probes" gorm:"type:text;not null"`
	Error      string `json:"error" gorm:"type:text"`
	CreatedAt  int64  `json:"created_at" gorm:"bigint;not null;index"`
}

func (report *UpstreamMonitorReport) BeforeCreate(_ *gorm.DB) error {
	if report.CreatedAt == 0 {
		report.CreatedAt = common.GetTimestamp()
	}
	return nil
}

func CreateUpstreamMonitorTask(task *UpstreamMonitorTask) error {
	return DB.Create(task).Error
}

func GetUpstreamMonitorTask(id int) (*UpstreamMonitorTask, error) {
	var task UpstreamMonitorTask
	err := DB.Where("id = ?", id).First(&task).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &task, nil
}

func ListUpstreamMonitorTasks() ([]*UpstreamMonitorTask, error) {
	var tasks []*UpstreamMonitorTask
	err := DB.Order("id desc").Find(&tasks).Error
	return tasks, err
}

func ListEnabledUpstreamMonitorTasks() ([]*UpstreamMonitorTask, error) {
	var tasks []*UpstreamMonitorTask
	err := DB.Where("enabled = ?", true).Order("id asc").Find(&tasks).Error
	return tasks, err
}

func UpdateUpstreamMonitorTask(task *UpstreamMonitorTask, updates map[string]any) error {
	if len(updates) == 0 {
		return nil
	}
	updates["updated_at"] = common.GetTimestamp()
	return DB.Model(task).Updates(updates).Error
}

func DeleteUpstreamMonitorTask(id int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("task_id = ?", id).Delete(&UpstreamMonitorReport{}).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", id).Delete(&UpstreamMonitorTask{}).Error
	})
}

// GetUpstreamMonitorTaskByChannelID returns the single monitor task backed by
// a channel, or nil when the channel has no monitor. Manual tasks (channel_id
// = 0) are never returned by this lookup.
func GetUpstreamMonitorTaskByChannelID(channelID int) (*UpstreamMonitorTask, error) {
	if channelID <= 0 {
		return nil, nil
	}
	var task UpstreamMonitorTask
	err := DB.Where("channel_id = ?", channelID).First(&task).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &task, nil
}

// DeleteUpstreamMonitorTasksByChannelIDs removes every channel-backed monitor
// task and its reports in one transaction. Manual tasks (channel_id = 0) are
// never touched, so operator-created monitors survive channel deletion.
func DeleteUpstreamMonitorTasksByChannelIDs(channelIDs []int) error {
	valid := make([]int, 0, len(channelIDs))
	for _, id := range channelIDs {
		if id > 0 {
			valid = append(valid, id)
		}
	}
	if len(valid) == 0 {
		return nil
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var taskIDs []int
		if err := tx.Model(&UpstreamMonitorTask{}).
			Where("channel_id IN ?", valid).
			Pluck("id", &taskIDs).Error; err != nil {
			return err
		}
		if len(taskIDs) == 0 {
			return nil
		}
		if err := tx.Where("task_id IN ?", taskIDs).Delete(&UpstreamMonitorReport{}).Error; err != nil {
			return err
		}
		return tx.Where("id IN ?", taskIDs).Delete(&UpstreamMonitorTask{}).Error
	})
}

func CreateUpstreamMonitorReport(report *UpstreamMonitorReport) error {
	return DB.Create(report).Error
}

func GetUpstreamMonitorReport(id int) (*UpstreamMonitorReport, error) {
	var report UpstreamMonitorReport
	err := DB.Where("id = ?", id).First(&report).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &report, nil
}

func ListUpstreamMonitorReports(taskId int, model string, offset, limit int) ([]*UpstreamMonitorReport, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	limit = min(limit, 100)
	query := DB.Model(&UpstreamMonitorReport{})
	if taskId > 0 {
		query = query.Where("task_id = ?", taskId)
	}
	if strings.TrimSpace(model) != "" {
		query = query.Where("model = ?", strings.TrimSpace(model))
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var reports []*UpstreamMonitorReport
	err := query.Order("id desc").Offset(max(0, offset)).Limit(limit).Find(&reports).Error
	return reports, total, err
}

func DeleteOldUpstreamMonitorReports(beforeTimestamp int64) (int64, error) {
	result := DB.Where("created_at < ?", beforeTimestamp).Delete(&UpstreamMonitorReport{})
	return result.RowsAffected, result.Error
}
