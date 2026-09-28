package model

import (
	"strconv"
	"sync"
	"time"

	"github.com/Uter-AI/Uter/common"
)

// The month-to-date spend powers 用户定价 (per-tier multipliers), so it is read
// on the billing path. A per-request SUM over the log table would be far too
// expensive, therefore the value is cached for a short window: a user's tier is
// allowed to settle a minute late, which is fine because tiers are thresholds
// over a whole month.
const monthlyQuotaCacheTTL = 60 * time.Second

type monthlyQuotaEntry struct {
	quota     int64
	expiresAt time.Time
}

var (
	monthlyQuotaMu    sync.Mutex
	monthlyQuotaCache = make(map[int]*monthlyQuotaEntry)
)

// GetUserMonthConsumedQuota returns how much quota the user has consumed since
// the first day of the current calendar month. A failure (or a missing log
// store such as in tests) yields 0, i.e. "no tier applied".
func GetUserMonthConsumedQuota(userId int) int64 {
	if userId <= 0 {
		return 0
	}
	now := time.Now()

	monthlyQuotaMu.Lock()
	if entry, ok := monthlyQuotaCache[userId]; ok && now.Before(entry.expiresAt) {
		quota := entry.quota
		monthlyQuotaMu.Unlock()
		return quota
	}
	monthlyQuotaMu.Unlock()

	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Unix()
	quota := sumConsumedQuotaSince(userId, monthStart)

	monthlyQuotaMu.Lock()
	monthlyQuotaCache[userId] = &monthlyQuotaEntry{
		quota:     quota,
		expiresAt: now.Add(monthlyQuotaCacheTTL),
	}
	if len(monthlyQuotaCache) > 4096 {
		for id, entry := range monthlyQuotaCache {
			if now.Before(entry.expiresAt) {
				delete(monthlyQuotaCache, id)
			}
		}
	}
	monthlyQuotaMu.Unlock()
	return quota
}

// GetUserMonthConsumedUSD converts GetUserMonthConsumedQuota into platform
// USD (amount = quota / QuotaPerUnit).
func GetUserMonthConsumedUSD(userId int) float64 {
	return float64(GetUserMonthConsumedQuota(userId)) / common.QuotaPerUnit
}

// ResetUserMonthQuotaCache drops cached month-to-date values. Only needed after
// a manual quota/log correction where the tier must re-settle immediately.
func ResetUserMonthQuotaCache() {
	monthlyQuotaMu.Lock()
	monthlyQuotaCache = make(map[int]*monthlyQuotaEntry)
	monthlyQuotaMu.Unlock()
}

// sumConsumedQuotaSince returns the user's net spend since startTimestamp.
//
// Refund logs (LogTypeRefund) carry the refunded amount as a positive quota —
// see `RefundTaskQuota` and `RecalculateTaskQuota` — so they have to be
// subtracted here. Counting only consume logs left the month-to-date figure
// inflated by every refund, which pushed users into a higher 用户定价 tier and
// made every later request that month more expensive.
func sumConsumedQuotaSince(userId int, startTimestamp int64) int64 {
	if LOG_DB == nil {
		return 0
	}
	var total int64
	// The refund branch is inlined rather than bound with a placeholder: GORM
	// orders bound arguments by clause, not by their position in the final SQL,
	// so a placeholder inside the SELECT expression is matched against the
	// WHERE arguments and silently shifts every binding. LogTypeRefund is a
	// compile-time integer constant, so inlining it carries no injection risk.
	selectExpr := "COALESCE(sum(CASE WHEN type = " + strconv.Itoa(LogTypeRefund) +
		" THEN -quota ELSE quota END), 0) as total"
	err := LOG_DB.Table("logs").
		Select(selectExpr).
		Where("user_id = ? AND type IN ? AND created_at >= ?",
			userId, []int{LogTypeConsume, LogTypeRefund}, startTimestamp).
		Scan(&total).Error
	if err != nil {
		common.SysError("failed to sum consumed quota for user " + strconv.Itoa(userId) + ": " + err.Error())
		return 0
	}
	return total
}
