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
//
// created_at 与其余七列共同构成聚合键（见 logQuotaDataCache 的 cache key）：
// 同一 (user, model, hour, group, token, channel, node) 组合在库中只应有一行，
// 刷盘时按增量累加。idx_qdt_agg_unique 是这条约束的落地点——没有它，
// 多实例部署时两个节点会为同一个 key 各插一行，统计直接翻倍。
//
// ⚠️ 改这个 struct 的索引 tag 时注意两点，都实测踩过：
//
//  1. GORM 的复合索引用「同一列上出现多次 index:NAME,priority:N」的写法，每个
//     priority 必须出现且连续。漏写某列的 priority 会让该列被【静默丢弃】（例如
//     username 曾被漏掉，生成的索引少一列，ON CONFLICT 随即失配报错）。
//  2. 必须写成 uniqueIndex 而非 index，否则生成的是普通 CREATE INDEX，
//     SaveQuotaDataCache 的 ON CONFLICT 找不到唯一约束而报
//     "ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint"。
//
// 改完务必跑 TestQuotaDataUniqueIndexColumnsAreComplete 与
// TestSaveQuotaDataCacheUpsertsAggregate 验证。
type QuotaData struct {
	Id        int    `json:"id"`
	UserID    int    `json:"user_id" gorm:"index;uniqueIndex:idx_qdt_agg_unique,priority:1"`
	Username  string `json:"username" gorm:"index:idx_qdt_model_user_name,priority:2;index:idx_qdt_username_created,priority:1;uniqueIndex:idx_qdt_agg_unique,priority:2;size:64;default:''"`
	ModelName string `json:"model_name" gorm:"index:idx_qdt_model_user_name,priority:1;uniqueIndex:idx_qdt_agg_unique,priority:3;size:64;default:''"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;index:idx_qdt_created_at,priority:2;uniqueIndex:idx_qdt_agg_unique,priority:4;index:idx_qdt_username_created,priority:2"`
	UseGroup  string `json:"use_group" gorm:"index;uniqueIndex:idx_qdt_agg_unique,priority:5;size:64;default:''"`
	TokenID   int    `json:"token_id" gorm:"index;uniqueIndex:idx_qdt_agg_unique,priority:6;default:0"`
	ChannelID int    `json:"channel_id" gorm:"index;uniqueIndex:idx_qdt_agg_unique,priority:7;default:0"`
	NodeName  string `json:"node_name" gorm:"index;uniqueIndex:idx_qdt_agg_unique,priority:8;size:64;default:''"`
	TokenUsed int    `json:"token_used" gorm:"default:0"`
	Count     int    `json:"count" gorm:"default:0"`
	Quota     int    `json:"quota" gorm:"default:0"`
}

type QuotaDataLogParams struct {
	UserID    int
	Username  string
	ModelName string
	Quota     int
	CreatedAt int64
	TokenUsed int
	UseGroup  string
	TokenID   int
	ChannelID int
	NodeName  string
}

func UpdateQuotaData() {
	for {
		if common.DataExportEnabled {
			common.SysLog("正在更新数据看板数据...")
			SaveQuotaDataCache()
		}
		time.Sleep(time.Duration(common.DataExportInterval) * time.Minute)
	}
}

var CacheQuotaData = make(map[string]*QuotaData)
var CacheQuotaDataLock = sync.Mutex{}

func LogQuotaData(params QuotaDataLogParams) {
	// 只精确到小时
	createdAt := params.CreatedAt - (params.CreatedAt % 3600)
	quotaData := &QuotaData{
		UserID:    params.UserID,
		Username:  params.Username,
		ModelName: params.ModelName,
		CreatedAt: createdAt,
		UseGroup:  params.UseGroup,
		TokenID:   params.TokenID,
		ChannelID: params.ChannelID,
		NodeName:  params.NodeName,
		Count:     1,
		Quota:     params.Quota,
		TokenUsed: params.TokenUsed,
	}

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	logQuotaDataCache(quotaData)
}

// SaveQuotaDataCache 把内存聚合写入数据库。
//
// 两个必须同时满足的性质：
//
//  1.临界区只做指针交换。CacheQuotaDataLock 是全局最热的锁 —— 每条消费日志
//     （LogQuotaData）都要拿它。若把整个写库循环放在锁内，万条缓存刷盘期间
//     全站消费日志的聚合全部阻塞，进而拖慢 relay 响应。所以锁内只摘走 map
//     并换一个新的，DB IO 全部在锁外做。
//
//  2. 批量 upsert 而不是「先查后写」。缓存 key 是八字段的完整组合，条目数等于
//     「活跃用户 × 活跃模型 × 小时」，大租户上万条；旧的逐条 First + Create/Update
//     是 2N 次 SQL。加上 idx_qdt_agg_unique 复合唯一索引后，冲突由数据库判定，
//     多实例并发刷同一个 key 也不会双写、统计翻倍。
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
			"count":      gorm.Expr("count + excluded.count"),
			"quota":      gorm.Expr("quota + excluded.quota"),
			"token_used": gorm.Expr("token_used + excluded.token_used"),
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
		quotaData = cachedQuotaData
	}
	CacheQuotaData[key] = quotaData
}

func GetQuotaDataByUsername(username string, startTime int64, endTime int64, userIds ...int) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	query := DB.Table("quota_data").
		Select("user_id, username, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used").
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
		Select("user_id, username, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used").
		Where("user_id = ? and created_at >= ? and created_at <= ?", userId, startTime, endTime).
		Group("user_id, username, model_name, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetQuotaDataGroupByUser(startTime int64, endTime int64, orgUsernames []string, userIds ...int) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	query := DB.Table("quota_data").
		Select("username, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used").
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
	query := DB.Table("quota_data").Select("model_name, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, created_at").Where("created_at >= ? and created_at <= ?", startTime, endTime)
	if len(orgUsernames) > 0 {
		query = query.Where("username IN ?", orgUsernames)
	}
	if len(userIds) > 0 {
		query = query.Where("user_id IN ?", userIds)
	}
	err = query.Group("model_name, created_at").Find(&quotaDatas).Error
	return quotaDatas, err
}
