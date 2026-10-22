package model

import (
	"fmt"
	"sync"
	"time"

	"github.com/uter-ai/uter/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// QuotaData 柱状图数据
type QuotaData struct {
	Id                  int    `json:"id"`
	UserID              int    `json:"user_id" gorm:"index;uniqueIndex:idx_qdt_agg_unique,priority:1"`
	Username            string `json:"username" gorm:"index:idx_qdt_model_user_name,priority:2;size:64;default:'';uniqueIndex:idx_qdt_agg_unique,priority:2"`
	ModelName           string `json:"model_name" gorm:"index:idx_qdt_model_user_name,priority:1;size:64;default:'';uniqueIndex:idx_qdt_agg_unique,priority:3"`
	CreatedAt           int64  `json:"created_at" gorm:"bigint;autoCreateTime:false;index:idx_qdt_created_at,priority:2;uniqueIndex:idx_qdt_agg_unique,priority:4"`
	UseGroup            string `json:"use_group" gorm:"index;size:64;default:'';uniqueIndex:idx_qdt_agg_unique,priority:5"`
	TokenID             int    `json:"token_id" gorm:"index;default:0;uniqueIndex:idx_qdt_agg_unique,priority:6"`
	ChannelID           int    `json:"channel_id" gorm:"index;default:0;uniqueIndex:idx_qdt_agg_unique,priority:7"`
	NodeName            string `json:"node_name" gorm:"index;size:64;default:'';uniqueIndex:idx_qdt_agg_unique,priority:8"`
	TokenUsed           int    `json:"token_used" gorm:"default:0"`
	Count               int    `json:"count" gorm:"default:0"`
	Quota               int    `json:"quota" gorm:"default:0"`
	CacheReadTokens     int64  `json:"cache_read_tokens" gorm:"default:0"`
	CacheCreationTokens int64  `json:"cache_creation_tokens" gorm:"default:0"`
}

type QuotaDataLogParams struct {
	UserID              int
	Username            string
	ModelName           string
	Quota               int
	CreatedAt           int64
	TokenUsed           int
	CacheReadTokens     int64
	CacheCreationTokens int64
	UseGroup            string
	TokenID             int
	ChannelID           int
	NodeName            string
}

func UpdateQuotaData() {
	for {
		if common.DataExportEnabled {
			common.SysLog(common.LogText("updating dashboard data..."))
			SaveQuotaDataCache()
		}
		time.Sleep(time.Duration(common.DataExportInterval) * time.Minute)
	}
}

var CacheQuotaData = make(map[string]*QuotaData)
var CacheQuotaDataLock = sync.Mutex{}

func logQuotaDataCache(quotaData *QuotaData) {
	key := quotaDataCacheKey(quotaData)
	count := quotaData.Count
	quota := quotaData.Quota
	tokenUsed := quotaData.TokenUsed
	cachedQuotaData, ok := CacheQuotaData[key]
	if ok {
		cachedQuotaData.Count += count
		cachedQuotaData.Quota += quota
		cachedQuotaData.TokenUsed += tokenUsed
		cachedQuotaData.CacheReadTokens += quotaData.CacheReadTokens
		cachedQuotaData.CacheCreationTokens += quotaData.CacheCreationTokens
		quotaData = cachedQuotaData
	}
	CacheQuotaData[key] = quotaData
}

func LogQuotaData(params QuotaDataLogParams) {
	// 只精确到小时
	createdAt := params.CreatedAt - (params.CreatedAt % 3600)
	quotaData := &QuotaData{
		UserID:              params.UserID,
		Username:            params.Username,
		ModelName:           params.ModelName,
		CreatedAt:           createdAt,
		UseGroup:            params.UseGroup,
		TokenID:             params.TokenID,
		ChannelID:           params.ChannelID,
		NodeName:            params.NodeName,
		Count:               1,
		Quota:               params.Quota,
		TokenUsed:           params.TokenUsed,
		CacheReadTokens:     max(0, params.CacheReadTokens),
		CacheCreationTokens: max(0, params.CacheCreationTokens),
	}

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	logQuotaDataCache(quotaData)
}

func SaveQuotaDataCache() {
	// 锁内：摘走整张缓存并换上空的。摘走的是旧 map，后续写入落进新 map，互不影响。
	CacheQuotaDataLock.Lock()
	snapshot := CacheQuotaData
	CacheQuotaData = make(map[string]*QuotaData)
	size := len(snapshot)
	CacheQuotaDataLock.Unlock()

	if size == 0 {
		return
	}

	rows := make([]*QuotaData, 0, size)
	for _, quotaData := range snapshot {
		rows = append(rows, quotaData)
	}

	const upsertBatchSize = 500
	if err := DB.Table("quota_data").Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "user_id"},
			{Name: "username"},
			{Name: "model_name"},
			{Name: "created_at"},
			{Name: "use_group"},
			{Name: "token_id"},
			{Name: "channel_id"},
			{Name: "node_name"},
		},
		DoUpdates: clause.Assignments(map[string]any{
			"count":                 gorm.Expr("count + excluded.count"),
			"quota":                 gorm.Expr("quota + excluded.quota"),
			"token_used":            gorm.Expr("token_used + excluded.token_used"),
			"cache_read_tokens":     gorm.Expr("cache_read_tokens + excluded.cache_read_tokens"),
			"cache_creation_tokens": gorm.Expr("cache_creation_tokens + excluded.cache_creation_tokens"),
		}),
	}).CreateInBatches(rows, upsertBatchSize).Error; err != nil {
		// 写库失败必须把这批数据放回缓存，不能静默丢：否则看板数据凭空消失。
		CacheQuotaDataLock.Lock()
		for _, row := range rows {
			logQuotaDataCacheLocked(row)
		}
		CacheQuotaDataLock.Unlock()
		common.SysError(fmt.Sprintf("保存数据看板数据失败，已回滚缓存 %d 条: %s", size, err.Error()))
		return
	}
	common.SysLog(fmt.Sprintf("保存数据看板数据成功，共保存%d条数据", size))
}

// logQuotaDataCacheLocked 把一条数据并入缓存。调用方必须持有 CacheQuotaDataLock。
func logQuotaDataCacheLocked(quotaData *QuotaData) {
	key := quotaDataCacheKey(quotaData)
	cachedQuotaData, ok := CacheQuotaData[key]
	if ok {
		cachedQuotaData.Count += quotaData.Count
		cachedQuotaData.Quota += quotaData.Quota
		cachedQuotaData.TokenUsed += quotaData.TokenUsed
		cachedQuotaData.CacheReadTokens += quotaData.CacheReadTokens
		cachedQuotaData.CacheCreationTokens += quotaData.CacheCreationTokens
		return
	}
	CacheQuotaData[key] = quotaData
}

// quotaDataCacheKey 是聚合键，与 idx_qdt_agg_unique 的列集合一一对应。
func quotaDataCacheKey(quotaData *QuotaData) string {
	return fmt.Sprintf("%d\x00%s\x00%s\x00%d\x00%s\x00%d\x00%d\x00%s",
		quotaData.UserID,
		quotaData.Username,
		quotaData.ModelName,
		quotaData.CreatedAt,
		quotaData.UseGroup,
		quotaData.TokenID,
		quotaData.ChannelID,
		quotaData.NodeName,
	)
}

// GetQuotaDataByUsername 支持「用户维度」过滤：userIds 与组织范围取交集，
// 越权的 id 只会得到空集。
func GetQuotaDataByUsername(username string, startTime int64, endTime int64, userIds ...int) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	query := DB.Table("quota_data").
		Select("user_id, username, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(cache_creation_tokens) as cache_creation_tokens").
		Where("username = ? and created_at >= ? and created_at <= ?", username, startTime, endTime)
	if len(userIds) > 0 {
		query = query.Where("user_id IN ?", userIds)
	}
	err = query.
		Group("user_id, username, model_name, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetQuotaDataByUserId(userId int, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	err = DB.Table("quota_data").
		Select("user_id, username, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(cache_creation_tokens) as cache_creation_tokens").
		Where("user_id = ? and created_at >= ? and created_at <= ?", userId, startTime, endTime).
		Group("user_id, username, model_name, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetQuotaDataGroupByUser(startTime int64, endTime int64, orgUsernames []string, userIds ...int) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	query := DB.Table("quota_data").
		Select("username, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(cache_creation_tokens) as cache_creation_tokens").
		Where("created_at >= ? and created_at <= ?", startTime, endTime)
	if len(orgUsernames) > 0 {
		query = query.Where("username IN ?", orgUsernames)
	}
	if len(userIds) > 0 {
		query = query.Where("user_id IN ?", userIds)
	}
	err = query.
		Group("username, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

// GetAllQuotaDates 返回按模型/时间聚合的额度消耗。
//
// userIds 是「用户维度」过滤，与 orgUsernames 范围过滤取交集：越权的 id 只会得到空集。
// 当传入 username 时，同样必须落在 orgUsernames 组织范围内——组织管理员不能用 ?username=
// 越权查询组织外任意用户的消耗明细（原实现在此处短路、丢弃 orgUsernames，构成越权泄露）。
func GetAllQuotaDates(startTime int64, endTime int64, username string, orgUsernames []string, userIds ...int) (quotaData []*QuotaData, err error) {
	if username != "" {
		// 组织范围约束：username 必须属于 orgUsernames，否则返回空集（fail-closed）
		if len(orgUsernames) > 0 {
			inScope := false
			for _, u := range orgUsernames {
				if u == username {
					inScope = true
					break
				}
			}
			if !inScope {
				return []*QuotaData{}, nil
			}
		}
		return GetQuotaDataByUsername(username, startTime, endTime, userIds...)
	}
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	// only select model_name, sum(count) as count, sum(quota) as quota, model_name, created_at from quota_data group by model_name, created_at;
	//err = DB.Table("quota_data").Where("created_at >= ? and created_at <= ?", startTime, endTime).Find(&quotaDatas).Error
	query := DB.Table("quota_data").Select("model_name, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(cache_creation_tokens) as cache_creation_tokens, created_at").Where("created_at >= ? and created_at <= ?", startTime, endTime)
	if len(orgUsernames) > 0 {
		query = query.Where("username IN ?", orgUsernames)
	}
	if len(userIds) > 0 {
		query = query.Where("user_id IN ?", userIds)
	}
	err = query.Group("model_name, created_at").Find(&quotaDatas).Error
	return quotaDatas, err
}
