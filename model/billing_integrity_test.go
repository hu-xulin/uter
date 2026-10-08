package model

import (
	"bytes"
	"errors"
	"testing"

	"github.com/uter-ai/uter/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// F3 — month-to-date spend must net refund logs
// ---------------------------------------------------------------------------

// Refund logs carry the refunded amount as a positive quota, so counting only
// consume logs left the month-to-date figure inflated by every refund. Because
// that figure drives 用户定价 (per-tier multipliers), an inflated value moved
// the user into a higher tier and made every later request that month cost
// more.
func TestGetUserMonthConsumedQuotaNetsRefundLogs(t *testing.T) {
	truncateTables(t)
	ResetUserMonthQuotaCache()
	t.Cleanup(ResetUserMonthQuotaCache)

	const userId = 8801
	now := common.GetTimestamp()
	require.NoError(t, LOG_DB.Create(&Log{
		UserId: userId, CreatedAt: now, Type: LogTypeConsume, Quota: 1000,
	}).Error)
	require.NoError(t, LOG_DB.Create(&Log{
		UserId: userId, CreatedAt: now, Type: LogTypeRefund, Quota: 400,
	}).Error)
	// A different user's logs must not leak into the sum.
	require.NoError(t, LOG_DB.Create(&Log{
		UserId: userId + 1, CreatedAt: now, Type: LogTypeConsume, Quota: 777,
	}).Error)

	assert.EqualValues(t, 600, GetUserMonthConsumedQuota(userId))
	assert.EqualValues(t, 777, GetUserMonthConsumedQuota(userId+1))
}

// A refund larger than the month's remaining spend must floor the tier input at
// the signed sum, not be clamped: the log table is the only place the refund is
// recorded, so dropping it here would silently re-inflate the tier.
func TestGetUserMonthConsumedQuotaKeepsSignedSum(t *testing.T) {
	truncateTables(t)
	ResetUserMonthQuotaCache()
	t.Cleanup(ResetUserMonthQuotaCache)

	const userId = 8802
	now := common.GetTimestamp()
	require.NoError(t, LOG_DB.Create(&Log{
		UserId: userId, CreatedAt: now, Type: LogTypeConsume, Quota: 100,
	}).Error)
	require.NoError(t, LOG_DB.Create(&Log{
		UserId: userId, CreatedAt: now, Type: LogTypeRefund, Quota: 250,
	}).Error)

	assert.EqualValues(t, -150, GetUserMonthConsumedQuota(userId))
}

// ---------------------------------------------------------------------------
// F4 — a refund that outruns a period reset must not be clamped away
// ---------------------------------------------------------------------------

// A request that pre-consumes P and settles with a smaller actual amount sends
// a negative delta. If a periodic reset zeroed AmountUsed in between, clamping
// the result to zero used to discard the refund entirely.
func TestSubscriptionRefundSurvivesPeriodReset(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	sub := &UserSubscription{
		Id: 9401, UserId: 9401, PlanId: 9401,
		AmountTotal: 100, AmountUsed: 0,
		StartTime: now - 60, EndTime: now + 3600, Status: "active",
	}
	seedSubscriptionResetSub(t, sub)

	// Simulates the post-reset settle of the in-flight request: AmountUsed is
	// already 0, so the whole refund has to be parked.
	require.NoError(t, PostConsumeUserSubscriptionDelta(sub.Id, -30))
	parked := getSubscriptionResetSub(t, sub.Id)
	assert.EqualValues(t, 0, parked.AmountUsed)
	assert.EqualValues(t, 30, parked.RefundCarryOver)

	// The next consume spends the parked refund first.
	require.NoError(t, PostConsumeUserSubscriptionDelta(sub.Id, 50))
	spent := getSubscriptionResetSub(t, sub.Id)
	assert.EqualValues(t, 20, spent.AmountUsed)
	assert.EqualValues(t, 0, spent.RefundCarryOver)
}

// The settlement that carries a refund is not the only entry point — a request
// whose actual equals its pre-charge settles with delta 0 and never calls
// PostConsumeUserSubscriptionDelta, so the pre-consume itself has to spend any
// parked refund.
func TestPreConsumeSpendsParkedSubscriptionRefund(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Id: 9402, Title: "Carry",
		PriceAmount: 1, DurationUnit: SubscriptionDurationMonth, DurationValue: 1,
		TotalAmount: 100, QuotaResetPeriod: SubscriptionResetNever,
	}
	seedSubscriptionResetPlan(t, plan)

	sub := &UserSubscription{
		Id: 9402, UserId: 9402, PlanId: plan.Id,
		AmountTotal: 100, AmountUsed: 0, RefundCarryOver: 30,
		StartTime: now - 60, EndTime: now + 3600, Status: "active",
	}
	seedSubscriptionResetSub(t, sub)

	result, err := PreConsumeUserSubscription("parked-refund-request", 9402, "some-model", 0, 50)
	require.NoError(t, err)
	// PreConsumed stays the full amount: that is what the settlement delta is
	// computed against.
	assert.EqualValues(t, 50, result.PreConsumed)
	assert.EqualValues(t, 20, result.AmountUsedAfter)

	stored := getSubscriptionResetSub(t, sub.Id)
	assert.EqualValues(t, 20, stored.AmountUsed)
	assert.EqualValues(t, 0, stored.RefundCarryOver)
}

// A parked refund also has to count towards the spendable balance before the
// pre-consume runs, otherwise the request would be rejected even though the
// credit covers it.
func TestParkedRefundCountsTowardsSpendableBalance(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Id: 9403, Title: "CarryTight",
		PriceAmount: 1, DurationUnit: SubscriptionDurationMonth, DurationValue: 1,
		TotalAmount: 100, QuotaResetPeriod: SubscriptionResetNever,
	}
	seedSubscriptionResetPlan(t, plan)

	sub := &UserSubscription{
		Id: 9403, UserId: 9403, PlanId: plan.Id,
		AmountTotal: 100, AmountUsed: 95, RefundCarryOver: 10,
		StartTime: now - 60, EndTime: now + 3600, Status: "active",
	}
	seedSubscriptionResetSub(t, sub)

	// Only 5 of the allowance is left, but the parked 10 makes 15 spendable.
	result, err := PreConsumeUserSubscription("parked-refund-tight", 9403, "some-model", 0, 15)
	require.NoError(t, err)
	assert.EqualValues(t, 15, result.PreConsumed)

	stored := getSubscriptionResetSub(t, sub.Id)
	assert.EqualValues(t, 100, stored.AmountUsed, "used must stay within the allowance")
	assert.EqualValues(t, 0, stored.RefundCarryOver)
}

// ---------------------------------------------------------------------------
// F5 — a failed batch flush must not drop the delta
// ---------------------------------------------------------------------------

func TestBatchUpdateRequeuesFailedDeltasAndDropsAfterLimit(t *testing.T) {
	resetBatchUpdateTestState(t)

	const id = 4242
	requeueBatchUpdate(BatchUpdateTypeUserQuota, id, -100)
	assertBatchUpdateQueued(t, BatchUpdateTypeUserQuota, id, -100)
	assertBatchUpdateRetries(t, BatchUpdateTypeUserQuota, id, 1)

	// Further failures accumulate attempts but keep the delta queued.
	for range maxBatchUpdateRetries - 1 {
		requeueBatchUpdate(BatchUpdateTypeUserQuota, id, -100)
	}
	assertBatchUpdateRetries(t, BatchUpdateTypeUserQuota, id, maxBatchUpdateRetries)

	// Clear the accumulator so that dropping the delta is observable.
	setBatchUpdateStore(t, BatchUpdateTypeUserQuota, id, 0)
	requeueBatchUpdate(BatchUpdateTypeUserQuota, id, -100)
	assertBatchUpdateNotQueued(t, BatchUpdateTypeUserQuota, id)
	assertBatchUpdateRetriesAbsent(t, BatchUpdateTypeUserQuota, id)

	// A zero delta is never queued: it carries no information and would only
	// grow the map.
	requeueBatchUpdate(BatchUpdateTypeUserQuota, 7, 0)
	assertBatchUpdateNotQueued(t, BatchUpdateTypeUserQuota, 7)
}

func TestClearBatchUpdateRetriesResetsTheFailureCount(t *testing.T) {
	resetBatchUpdateTestState(t)

	const id = 4243
	requeueBatchUpdate(BatchUpdateTypeUsedQuota, id, 5)
	assertBatchUpdateRetries(t, BatchUpdateTypeUsedQuota, id, 1)

	clearBatchUpdateRetries(BatchUpdateTypeUsedQuota, id)
	assertBatchUpdateRetriesAbsent(t, BatchUpdateTypeUsedQuota, id)

	// A later failure starts a fresh streak instead of dropping immediately.
	// The queue itself accumulates — it carries deltas, not a running total.
	requeueBatchUpdate(BatchUpdateTypeUsedQuota, id, 5)
	assertBatchUpdateRetries(t, BatchUpdateTypeUsedQuota, id, 1)
	assertBatchUpdateQueued(t, BatchUpdateTypeUsedQuota, id, 10)
}

// ---------------------------------------------------------------------------
// F2 — admission must not be decided on a stale cached balance
// ---------------------------------------------------------------------------

func TestGetUserQuotaForAdmissionRechecksDatabaseBelowLowWater(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	useUserCacheMiniRedis(t)

	user := createReserveTestUser(t, 5)
	require.NoError(t, populateUserCache(user))
	// Simulate what a settlement burst leaves behind: the hash still advertises
	// a balance the database no longer has.
	require.NoError(t, cacheIncrUserQuota(user.Id, 95))
	cachedQuota, err := getUserQuotaCache(user.Id)
	require.NoError(t, err)
	require.Equal(t, 100, cachedQuota)

	quota, err := GetUserQuotaForAdmission(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 5, quota, "the lower of cache and database must win inside the at-risk band")
}

// Above the low-water mark the cached value is used as-is: the extra database
// read is skipped because a stale value still leaves enough headroom for the
// request, and the reader sits in the trust bypass anyway. This asserts the
// intended boundary rather than an oversight.
func TestGetUserQuotaForAdmissionTrustsCacheAboveLowWater(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	useUserCacheMiniRedis(t)

	balance := common.GetTrustQuota() + 1000
	user := createReserveTestUser(t, balance)
	require.NoError(t, populateUserCache(user))
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Update("quota", 0).Error)

	quota, err := GetUserQuotaForAdmission(user.Id)
	require.NoError(t, err)
	assert.Equal(t, balance, quota)
}

func TestGetUserQuotaForAdmissionFallsBackToDatabaseWhenCacheIsEmpty(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	useUserCacheMiniRedis(t)

	user := createReserveTestUser(t, 321)
	quota, err := GetUserQuotaForAdmission(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 321, quota)
}

func TestGetWalletDebtFloorQuota(t *testing.T) {
	t.Setenv("WALLET_DEBT_FLOOR_QUOTA", "")
	assert.Zero(t, common.GetWalletDebtFloorQuota(), "the historical floor is a non-positive balance")

	// A negative floor would allow unbounded debt, so it is normalised away.
	t.Setenv("WALLET_DEBT_FLOOR_QUOTA", "-5")
	assert.Zero(t, common.GetWalletDebtFloorQuota())

	t.Setenv("WALLET_DEBT_FLOOR_QUOTA", "1234")
	assert.Equal(t, 1234, common.GetWalletDebtFloorQuota())
}

// ---------------------------------------------------------------------------
// F6 — a failed money-log write must be retried, and must not be duplicated
// ---------------------------------------------------------------------------

func TestMoneyLogTypesAreClassified(t *testing.T) {
	assert.True(t, isMoneyLogType(LogTypeConsume))
	assert.True(t, isMoneyLogType(LogTypeRefund))
	assert.True(t, isMoneyLogType(LogTypeTopup))
	assert.False(t, isMoneyLogType(LogTypeSystem))
	assert.False(t, isMoneyLogType(LogTypeError))
	assert.False(t, isMoneyLogType(LogTypeManage))
}

// The retry in createLog is only safe because it can tell "the insert never
// reached the database" apart from "the insert committed but the acknowledgement
// was lost" — the second case must not be written a second time, because this
// table is summed for spend reports.
func TestLogWriteIdempotencyGuard(t *testing.T) {
	truncateTables(t)

	log := &Log{
		UserId:    1,
		Type:      LogTypeConsume,
		RequestId: "idempotency-guard-request",
		CreatedAt: common.GetTimestamp(),
		Quota:     10,
	}
	assert.False(t, logAlreadyPersisted(log), "nothing is stored yet")

	require.NoError(t, createLog(log))
	assert.True(t, logAlreadyPersisted(log), "the guard must find the committed row")

	var count int64
	require.NoError(t, LOG_DB.Model(&Log{}).
		Where("request_id = ? AND type = ?", log.RequestId, log.Type).
		Count(&count).Error)
	assert.EqualValues(t, 1, count)

	// A different log type for the same request is a different record.
	assert.False(t, logAlreadyPersisted(&Log{Type: LogTypeError, RequestId: log.RequestId}))
	// A record with no request id cannot be deduplicated.
	assert.False(t, logAlreadyPersisted(&Log{Type: LogTypeConsume, RequestId: ""}))
}

// The severity of a failed log write is decided by the record that failed, so a
// consume log cannot be downgraded to a plain line while an error log is
// escalated as money. This guards a regression where two call sites passed
// hardcoded constants belonging to each other.
func TestReportLogWriteFailureRoutesByRecordType(t *testing.T) {
	// SysLog/SysError write to gin's writers, which are plain io.Writer vars.
	capture := func(logType int) (stdout, stderr string) {
		outBuf := &bytes.Buffer{}
		errBuf := &bytes.Buffer{}
		origOut, origErr := gin.DefaultWriter, gin.DefaultErrorWriter
		gin.DefaultWriter, gin.DefaultErrorWriter = outBuf, errBuf
		defer func() {
			gin.DefaultWriter, gin.DefaultErrorWriter = origOut, origErr
		}()
		reportLogWriteFailure(&Log{Type: logType}, errors.New("simulated write failure"))
		return outBuf.String(), errBuf.String()
	}

	// Money records must reach the error stream — a lost consume/refund/topup
	// log is an accounting divergence, not a missing audit line.
	for _, logType := range []int{LogTypeConsume, LogTypeRefund, LogTypeTopup} {
		stdout, stderr := capture(logType)
		assert.Contains(t, stderr, "failed to persist quota log", "type %d must be escalated", logType)
		assert.Empty(t, stdout, "type %d must not be demoted to the plain log stream", logType)
	}

	for _, logType := range []int{LogTypeError, LogTypeSystem, LogTypeManage} {
		stdout, stderr := capture(logType)
		assert.Contains(t, stdout, "failed to record log", "type %d must stay a plain log line", logType)
		assert.Empty(t, stderr, "type %d must not be escalated as money", logType)
	}
}

// ---------------------------------------------------------------------------
// test helpers
// ---------------------------------------------------------------------------

func assertBatchUpdateQueued(t *testing.T, type_ int, id int, want int) {
	t.Helper()
	batchUpdateLocks[type_].Lock()
	defer batchUpdateLocks[type_].Unlock()
	assert.Equal(t, want, batchUpdateStores[type_][id])
}

func assertBatchUpdateNotQueued(t *testing.T, type_ int, id int) {
	t.Helper()
	batchUpdateLocks[type_].Lock()
	defer batchUpdateLocks[type_].Unlock()
	_, ok := batchUpdateStores[type_][id]
	assert.False(t, ok)
}

func setBatchUpdateStore(t *testing.T, type_ int, id int, value int) {
	t.Helper()
	batchUpdateLocks[type_].Lock()
	defer batchUpdateLocks[type_].Unlock()
	if value == 0 {
		delete(batchUpdateStores[type_], id)
		return
	}
	batchUpdateStores[type_][id] = value
}

func assertBatchUpdateRetries(t *testing.T, type_ int, id int, want int) {
	t.Helper()
	batchUpdateLocks[type_].Lock()
	defer batchUpdateLocks[type_].Unlock()
	assert.Equal(t, want, batchUpdateRetries[type_][id])
}

func assertBatchUpdateRetriesAbsent(t *testing.T, type_ int, id int) {
	t.Helper()
	batchUpdateLocks[type_].Lock()
	defer batchUpdateLocks[type_].Unlock()
	_, ok := batchUpdateRetries[type_][id]
	assert.False(t, ok)
}
