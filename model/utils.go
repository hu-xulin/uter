package model

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/uter-ai/uter/common"

	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
)

const (
	BatchUpdateTypeUserQuota = iota
	BatchUpdateTypeTokenQuota
	BatchUpdateTypeUsedQuota
	BatchUpdateTypeChannelUsedQuota
	BatchUpdateTypeRequestCount
	BatchUpdateTypeCount // if you add a new type, you need to add a new map and a new lock
)

// maxBatchUpdateRetries bounds how many consecutive failures a single pending
// delta may accumulate before it is dropped. Without a bound a permanently
// failing row (deleted user, constraint violation) would be re-queued for ever
// and the queue would grow without limit.
const maxBatchUpdateRetries = 5

var batchUpdateStores []map[int]int
var batchUpdateLocks []sync.Mutex

// batchUpdateRetries counts consecutive persistence failures per (type, id) so
// a failed flush can be re-queued instead of silently dropping the delta.
var batchUpdateRetries []map[int]int

func init() {
	for range BatchUpdateTypeCount {
		batchUpdateStores = append(batchUpdateStores, make(map[int]int))
		batchUpdateLocks = append(batchUpdateLocks, sync.Mutex{})
		batchUpdateRetries = append(batchUpdateRetries, make(map[int]int))
	}
}

func InitBatchUpdater() {
	gopool.Go(func() {
		for {
			time.Sleep(time.Duration(common.BatchUpdateInterval) * time.Second)
			batchUpdate()
		}
	})
}

func addNewRecord(type_ int, id int, value int) {
	batchUpdateLocks[type_].Lock()
	defer batchUpdateLocks[type_].Unlock()
	old, ok := batchUpdateStores[type_][id]
	if !ok {
		batchUpdateStores[type_][id] = value
		return
	}

	sum := old + value
	if (value > 0 && sum < old) || (value < 0 && sum > old) {
		common.SysError(fmt.Sprintf("batch update overflow: type=%d id=%d old=%d value=%d", type_, id, old, value))
		// 与钱包域上界保持一致（common.MaxWalletQuota = 1<<53-1），
		// 避免累加器以 int64 上限饱和后与 DB 层 MaxWalletQuota 校验口径分裂。
		if value > 0 {
			sum = common.MaxWalletQuota
		} else {
			sum = -common.MaxWalletQuota
		}
	}
	batchUpdateStores[type_][id] = sum
}

func batchUpdate() {
	// check if there's any data to update
	hasData := false
	for i := range BatchUpdateTypeCount {
		batchUpdateLocks[i].Lock()
		if len(batchUpdateStores[i]) > 0 {
			hasData = true
			batchUpdateLocks[i].Unlock()
			break
		}
		batchUpdateLocks[i].Unlock()
	}

	if !hasData {
		return
	}

	common.SysLog("batch update started")
	stores := make([]map[int]int, BatchUpdateTypeCount)
	for i := range BatchUpdateTypeCount {
		batchUpdateLocks[i].Lock()
		stores[i] = batchUpdateStores[i]
		batchUpdateStores[i] = make(map[int]int)
		batchUpdateLocks[i].Unlock()
	}

	for i, store := range stores {
		if i == BatchUpdateTypeUserQuota || i == BatchUpdateTypeUsedQuota || i == BatchUpdateTypeRequestCount {
			continue
		}
		for key, value := range store {
			switch i {
			case BatchUpdateTypeTokenQuota:
				// The accumulator stores signed deltas: positive refunds increase
				// remain_quota; negative charges decrease it and increase used_quota.
				var err error
				if value > 0 {
					err = increaseTokenQuota(key, value)
				} else if value < 0 {
					err = decreaseTokenQuota(key, -value)
				}
				if err != nil {
					common.SysLog("failed to batch update token quota, requeueing: " + err.Error())
					requeueBatchUpdate(i, key, value)
					continue
				}
				clearBatchUpdateRetries(i, key)
			case BatchUpdateTypeChannelUsedQuota:
				if err := updateChannelUsedQuota(key, value); err != nil {
					common.SysLog("failed to batch update channel quota, requeueing: " + err.Error())
					requeueBatchUpdate(i, key, value)
					continue
				}
				clearBatchUpdateRetries(i, key)
			}
		}
	}

	userQuotaStore := stores[BatchUpdateTypeUserQuota]
	usedQuotaStore := stores[BatchUpdateTypeUsedQuota]
	requestCountStore := stores[BatchUpdateTypeRequestCount]

	userIDs := make(map[int]struct{}, len(userQuotaStore)+len(usedQuotaStore)+len(requestCountStore))
	for key := range userQuotaStore {
		userIDs[key] = struct{}{}
	}
	for key := range usedQuotaStore {
		userIDs[key] = struct{}{}
	}
	for key := range requestCountStore {
		userIDs[key] = struct{}{}
	}
	for key := range userIDs {
		quota := userQuotaStore[key]
		usedQuota := usedQuotaStore[key]
		requestCount := requestCountStore[key]
		if err := updateUserQuotaUsedQuotaAndRequestCount(key, quota, usedQuota, requestCount); err != nil {
			// The cache already moved for this user, so dropping the delta
			// would leave the database permanently behind: put the same three
			// deltas back on the queue and try again on the next tick.
			common.SysLog("failed to batch update user quota, used quota and request count, requeueing: " + err.Error())
			requeueBatchUpdate(BatchUpdateTypeUserQuota, key, quota)
			requeueBatchUpdate(BatchUpdateTypeUsedQuota, key, usedQuota)
			requeueBatchUpdate(BatchUpdateTypeRequestCount, key, requestCount)
			continue
		}
		clearBatchUpdateRetries(BatchUpdateTypeUserQuota, key)
		clearBatchUpdateRetries(BatchUpdateTypeUsedQuota, key)
		clearBatchUpdateRetries(BatchUpdateTypeRequestCount, key)
	}
	common.SysLog("batch update finished")
}

// requeueBatchUpdate puts a delta that failed to persist back on the queue so
// the next flush retries it. A delta is dropped only after
// maxBatchUpdateRetries consecutive failures, and that drop is reported as an
// error — a permanently unpersistable delta is an accounting divergence the
// operator has to know about, not a log line to bury.
func requeueBatchUpdate(type_ int, id int, value int) {
	if value == 0 {
		return
	}
	batchUpdateLocks[type_].Lock()
	attempts := batchUpdateRetries[type_][id] + 1
	if attempts > maxBatchUpdateRetries {
		delete(batchUpdateRetries[type_], id)
		batchUpdateLocks[type_].Unlock()
		common.SysError(fmt.Sprintf(
			"dropping batch update after %d failed attempts: type=%d id=%d value=%d",
			maxBatchUpdateRetries, type_, id, value))
		return
	}
	batchUpdateRetries[type_][id] = attempts
	batchUpdateLocks[type_].Unlock()
	addNewRecord(type_, id, value)
}

func clearBatchUpdateRetries(type_ int, id int) {
	batchUpdateLocks[type_].Lock()
	delete(batchUpdateRetries[type_], id)
	batchUpdateLocks[type_].Unlock()
}

func RecordExist(err error) (bool, error) {
	if err == nil {
		return true, nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	return false, err
}

func shouldUpdateRedis(fromDB bool, err error) bool {
	return common.RedisEnabled && fromDB && err == nil
}
