package model

import (
	"fmt"
	"math/rand"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/setting/operation_setting"
	"gorm.io/gorm"
)

// CheckinDateLayout 签到日期在数据库里的存储格式（varchar(10)）。
const CheckinDateLayout = "2006-01-02"

// Checkin 签到记录
type Checkin struct {
	Id           int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId       int    `json:"user_id" gorm:"not null;uniqueIndex:idx_user_checkin_date"`
	CheckinDate  string `json:"checkin_date" gorm:"type:varchar(10);not null;uniqueIndex:idx_user_checkin_date"` // 格式: YYYY-MM-DD
	QuotaAwarded int    `json:"quota_awarded" gorm:"not null"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint"`
}

// CheckinRecord 用于API返回的签到记录（不包含敏感字段）
type CheckinRecord struct {
	CheckinDate  string `json:"checkin_date"`
	QuotaAwarded int    `json:"quota_awarded"`
}

func (Checkin) TableName() string {
	return "checkins"
}

// checkinToday 返回「签到日」。
//
// 签到日的判定必须只有一处来源：后端写入 checkin_date、判断「今天是否已签到」、
// 前端在日历上点亮格子，三处若各自取本地时间，跨时区部署（容器 TZ=UTC、用户
// 在 UTC+8）时会出现「已签到但今天的格子是空的」。因此后端把 today 一并下发，
// 前端不再用浏览器本地日期推算。
func checkinToday() string {
	return time.Now().Format(CheckinDateLayout)
}

// checkinQuotaAward 在 [min, max] 闭区间内取随机额度。
//
// 单独抽出来是为了能被直接测到边界：旧实现内联在 UserCheckin 里，
// 只能靠「签到一次看结果」验证，区间端点永远测不到。
func checkinQuotaAward(minQuota, maxQuota int) int {
	if maxQuota <= minQuota {
		return minQuota
	}
	// maxQuota > minQuota 已保证 span >= 2，rand.Intn 不会收到非正数。
	return minQuota + rand.Intn(maxQuota-minQuota+1)
}

// GetUserCheckinRecords 获取用户在指定日期范围内的签到记录
func GetUserCheckinRecords(userId int, startDate, endDate string) ([]Checkin, error) {
	var records []Checkin
	err := DB.Where("user_id = ? AND checkin_date >= ? AND checkin_date <= ?",
		userId, startDate, endDate).
		Order("checkin_date DESC").
		Find(&records).Error
	return records, err
}

// HasCheckedInToday 检查用户今天是否已签到
func HasCheckedInToday(userId int) (bool, error) {
	var count int64
	err := DB.Model(&Checkin{}).
		Where("user_id = ? AND checkin_date = ?", userId, checkinToday()).
		Count(&count).Error
	return count > 0, err
}

// UserCheckin 执行用户签到
// MySQL 和 PostgreSQL 使用事务保证原子性
// SQLite 不支持嵌套事务，使用顺序操作 + 手动回滚
func UserCheckin(userId int) (*Checkin, error) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		return nil, common.NewMessage("Check-in feature is not enabled")
	}

	// 奖励区间非法时直接拒绝，而不是「按 min 发放」把配置错误变成资损。
	minQuota, maxQuota, err := operation_setting.CurrentCheckinQuotaRange()
	if err != nil {
		return nil, common.NewMessage("Check-in reward range is misconfigured: {{reason}}", map[string]any{"reason": err.Error()})
	}

	// 检查今天是否已签到
	hasChecked, err := HasCheckedInToday(userId)
	if err != nil {
		return nil, err
	}
	if hasChecked {
		return nil, common.NewMessage("Already checked in today")
	}

	quotaAwarded := checkinQuotaAward(minQuota, maxQuota)

	checkin := &Checkin{
		UserId:       userId,
		CheckinDate:  checkinToday(),
		QuotaAwarded: quotaAwarded,
		CreatedAt:    time.Now().Unix(),
	}

	// 根据数据库类型选择不同的策略
	if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
		// SQLite 不支持嵌套事务，使用顺序操作 + 手动回滚
		return userCheckinWithoutTransaction(checkin, userId, quotaAwarded)
	}

	// MySQL 和 PostgreSQL 支持事务，使用事务保证原子性
	return userCheckinWithTransaction(checkin, userId, quotaAwarded)
}

// userCheckinWithTransaction 使用事务执行签到（适用于 MySQL 和 PostgreSQL）
func userCheckinWithTransaction(checkin *Checkin, userId int, quotaAwarded int) (*Checkin, error) {
	err := DB.Transaction(func(tx *gorm.DB) error {
		// 步骤1: 创建签到记录
		// 数据库有唯一约束 (user_id, checkin_date)，可以防止并发重复签到
		if err := tx.Create(checkin).Error; err != nil {
			return common.NewMessage("Check-in failed, please try again later")
		}

		// 步骤2: 在事务中增加用户额度。
		// 条件里带上钱包上限，与 IncreaseUserQuota 的口径一致：直接写
		// `quota = quota + ?` 会让余额越过 MaxWalletQuota，之后所有依赖
		// 该上限的换算都会饱和/报错，余额反而不可用。
		result := tx.Model(&User{}).
			Where("id = ? AND quota <= ?", userId, common.MaxWalletQuota-quotaAwarded).
			Update("quota", gorm.Expr("quota + ?", quotaAwarded))
		if result.Error != nil {
			return common.NewMessage("Check-in failed: quota update error")
		}
		if result.RowsAffected != 1 {
			// 用户不存在或余额触顶：整笔签到回滚，记录不会留在库里。
			return common.NewMessage("Check-in failed: wallet quota limit exceeded")
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	// 事务成功后，异步更新缓存
	go func() {
		_ = cacheIncrUserQuota(userId, int64(quotaAwarded))
	}()

	return checkin, nil
}

// userCheckinWithoutTransaction 不使用事务执行签到（适用于 SQLite）
func userCheckinWithoutTransaction(checkin *Checkin, userId int, quotaAwarded int) (*Checkin, error) {
	// 步骤1: 创建签到记录
	// 数据库有唯一约束 (user_id, checkin_date)，可以防止并发重复签到
	if err := DB.Create(checkin).Error; err != nil {
		return nil, common.NewMessage("Check-in failed, please try again later")
	}

	// 步骤2: 增加用户额度
	// 使用 db=true 强制直接写入数据库，不使用批量更新
	if err := IncreaseUserQuota(userId, quotaAwarded, true); err != nil {
		// 如果增加额度失败，需要回滚签到记录。
		// 回滚失败必须报出来：留着记录等于「今天已签到但没拿到额度」，
		// 静默吞掉会让用户彻底失去当天的奖励且无人可查。
		if delErr := DB.Delete(checkin).Error; delErr != nil {
			return nil, common.NewMessage("Check-in failed: quota update error, rollback also failed ({{rollback}})", map[string]any{"rollback": delErr.Error()})
		}
		return nil, common.NewMessage("Check-in failed: quota update error")
	}

	return checkin, nil
}

// checkinMonthRange 把 "YYYY-MM" 换成该月的首末日期（闭区间）。
//
// 旧实现用 `month + "-31"` 当上界：靠字符串字典序比较虽然也能覆盖 2 月，
// 但一旦改成日期类型或换库就会漏掉月末，而且和「本月最后一天」不是同一件事。
func checkinMonthRange(month string) (startDate, endDate string, err error) {
	first, err := time.Parse("2006-01", month)
	if err != nil {
		return "", "", fmt.Errorf("invalid month %q, expected YYYY-MM", month)
	}
	return first.Format(CheckinDateLayout), first.AddDate(0, 1, -1).Format(CheckinDateLayout), nil
}

// GetUserCheckinStats 获取用户签到统计信息
func GetUserCheckinStats(userId int, month string) (map[string]any, error) {
	startDate, endDate, err := checkinMonthRange(month)
	if err != nil {
		return nil, err
	}

	records, err := GetUserCheckinRecords(userId, startDate, endDate)
	if err != nil {
		return nil, err
	}

	// 转换为不包含敏感字段的记录
	checkinRecords := make([]CheckinRecord, len(records))
	for i, r := range records {
		checkinRecords[i] = CheckinRecord{
			CheckinDate:  r.CheckinDate,
			QuotaAwarded: r.QuotaAwarded,
		}
	}

	// 检查今天是否已签到
	hasCheckedToday, _ := HasCheckedInToday(userId)

	// 获取用户所有时间的签到统计
	var totalCheckins int64
	var totalQuota int64
	DB.Model(&Checkin{}).Where("user_id = ?", userId).Count(&totalCheckins)
	DB.Model(&Checkin{}).Where("user_id = ?", userId).Select("COALESCE(SUM(quota_awarded), 0)").Scan(&totalQuota)

	return map[string]any{
		"total_quota":      totalQuota,      // 所有时间累计获得的额度
		"total_checkins":   totalCheckins,   // 所有时间累计签到次数
		"checkin_count":    len(records),    // 本月签到次数
		"checked_in_today": hasCheckedToday, // 今天是否已签到
		"today":            checkinToday(),  // 服务端认定的「今天」，前端日历以此为准
		"records":          checkinRecords,  // 本月签到记录详情（不含id和user_id）
	}, nil
}
