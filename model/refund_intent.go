package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/uter-ai/uter/common"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// RefundIntent — 预扣退款的持久化凭证
// ---------------------------------------------------------------------------
//
// BillingSession.Refund 的退款在 goroutine 中异步执行：钱包退回（quota += N）与
// 令牌退回都是非幂等原语，且执行前没有任何持久化痕迹。若进程在「预扣已落库、
// 退款未执行」的窗口内崩溃（或 goroutine 执行中途崩溃），用户预扣的额度就永久
// 滞留，没有任何对账入口。
//
// 解决方案是把退款本身做成可安全重放的事务：
//  1. Refund 前先落一条 status=pending 的意图凭证（含全部退款快照）。
//  2. 执行时把所有退款原语与「status: pending → done」的条件更新放在同一个
//     事务里提交——崩溃在提交前，事务整体回滚，凭证回到 pending，可安全重放；
//     崩溃在提交后，凭证已是 done，重放是空操作。条件更新影响行数为 0（已被
//     其他实例执行完）时整体回滚，杜绝并发双退。
//  3. 订阅预扣退回（RefundSubscriptionPreConsume）本身按 requestId 幂等，
//     放在意图事务之外先执行；失败时凭证保持 pending，重放安全。
//  4. SweepPendingRefundIntents 周期扫描滞留的 pending 凭证并重放。
//
// 注意：凭证不是「先退款后补记录」的日志，而是「同事务提交」的门——这是唯一
// 能让非幂等原语（quota += N）获得崩溃安全重放语义的提交方式。

const (
	RefundIntentPending = "pending"
	RefundIntentDone    = "done"

	RefundSourceWallet       = "wallet"
	RefundSourceSubscription = "subscription"
)

// errRefundIntentAlreadyDone 表示意图已被执行（并发或重放），应整体回滚本次事务。
var errRefundIntentAlreadyDone = errors.New("refund intent already done")

type RefundIntent struct {
	Id             int    `gorm:"primaryKey"`
	IdempotencyKey string `gorm:"size:128;not null;uniqueIndex"`
	UserId        int    `gorm:"index"`
	FundingSource string `gorm:"size:16"` // wallet | subscription
	// 钱包出资：OrgResolved=false 表示出资归属尚未解析，不可执行（防止把组织
	// 预扣退成个人余额）；OrgId>0 表示组织共享预算出资。
	OrgResolved  bool
	OrgId        int
	WalletAmount int
	// 订阅出资：预扣退回按 SubRequestId 幂等重放；SubExtra 是发送前补充预扣，
	// 非幂等，必须与完成标记同事务回滚。
	SubRequestId string
	SubId        int
	SubExtra     int64
	// 令牌侧：TokenKey 不落凭证（避免扩大密钥面），执行时按 TokenId 从
	// tokens 表读取用于缓存同步。
	TokenId       int
	TokenConsumed int
	Status        string `gorm:"index;size:16"`
	CreateTime    int64
	UpdateTime    int64
}

func (RefundIntent) TableName() string { return "refund_intents" }

// CreateRefundIntent 落一条 pending 凭证，返回后即可安全地把退款交给后台执行。
func validateRefundIntent(intent *RefundIntent) error {
	if intent == nil || intent.UserId <= 0 {
		return errors.New("refund intent requires a positive user id")
	}
	if strings.TrimSpace(intent.IdempotencyKey) == "" || len(intent.IdempotencyKey) > 128 {
		return errors.New("refund intent requires an idempotency key of at most 128 characters")
	}
	if intent.WalletAmount < 0 || intent.SubExtra < 0 || intent.TokenConsumed < 0 {
		return errors.New("refund intent amounts cannot be negative")
	}
	if intent.TokenConsumed > 0 && intent.TokenId <= 0 {
		return errors.New("refund intent token amount requires a positive token id")
	}
	switch intent.FundingSource {
	case RefundSourceWallet:
		if intent.SubRequestId != "" || intent.SubId != 0 || intent.SubExtra != 0 {
			return errors.New("wallet refund intent cannot contain subscription fields")
		}
		if intent.WalletAmount > 0 && (!intent.OrgResolved || intent.OrgId < 0) {
			return errors.New("wallet refund intent requires a resolved, non-negative funding organization")
		}
	case RefundSourceSubscription:
		if intent.WalletAmount != 0 || intent.OrgResolved || intent.OrgId != 0 {
			return errors.New("subscription refund intent cannot contain wallet fields")
		}
		if intent.SubRequestId == "" {
			return errors.New("subscription refund intent requires an idempotency request id")
		}
		if intent.SubExtra > 0 && intent.SubId <= 0 {
			return errors.New("subscription extra refund requires a positive subscription id")
		}
	default:
		return fmt.Errorf("unknown refund funding source %q", intent.FundingSource)
	}
	return nil
}

// CreateRefundIntent persists only a valid pending recovery credential.
func CreateRefundIntent(intent *RefundIntent) error {
	if err := validateRefundIntent(intent); err != nil {
		return err
	}
	if intent.Status != "" && intent.Status != RefundIntentPending {
		return fmt.Errorf("invalid initial refund intent status %q", intent.Status)
	}
	now := common.GetTimestamp()
	intent.CreateTime = now
	intent.UpdateTime = now
	intent.Status = RefundIntentPending
	if err := DB.Create(intent).Error; err != nil {
		// A concurrent request may have inserted the same logical refund first.
		// Reuse it only when its immutable accounting snapshot is byte-for-byte
		// equivalent; never treat an idempotency-key collision as a valid replay.
		var existing RefundIntent
		if lookupErr := DB.Where("idempotency_key = ?", intent.IdempotencyKey).First(&existing).Error; lookupErr != nil {
			return err
		}
		if existing.UserId != intent.UserId ||
			existing.FundingSource != intent.FundingSource ||
			existing.OrgResolved != intent.OrgResolved ||
			existing.OrgId != intent.OrgId ||
			existing.WalletAmount != intent.WalletAmount ||
			existing.SubRequestId != intent.SubRequestId ||
			existing.SubId != intent.SubId ||
			existing.SubExtra != intent.SubExtra ||
			existing.TokenId != intent.TokenId ||
			existing.TokenConsumed != intent.TokenConsumed {
			return fmt.Errorf("refund idempotency key %q collides with a different accounting snapshot", intent.IdempotencyKey)
		}
		intent.Id = existing.Id
	}
	return nil
}

// ExecuteRefundIntent 执行一笔退款意图：所有非幂等退款原语与完成标记在同一
// 事务内提交，崩溃/并发都安全。幂等：done 凭证直接返回 nil。
func ExecuteRefundIntent(id int) error {
	var intent RefundIntent
	if err := DB.Where("id = ?", id).First(&intent).Error; err != nil {
		return err
	}
	if intent.Status == RefundIntentDone {
		return nil
	}
	if intent.Status != RefundIntentPending {
		return fmt.Errorf("refund intent %d has invalid executable status %q", id, intent.Status)
	}
	if err := validateRefundIntent(&intent); err != nil {
		return fmt.Errorf("refund intent %d is invalid: %w", id, err)
	}
	// 订阅预扣退回：requestId 幂等，重复执行是空操作；放在事务外，失败时
	// 凭证保持 pending 等待重放。与旧路径（funding.Refund）同一原语。
	if intent.FundingSource == RefundSourceSubscription && intent.SubRequestId != "" {
		if err := RefundSubscriptionPreConsume(intent.SubRequestId); err != nil {
			return fmt.Errorf("refund subscription pre-consume (intent=%d, requestId=%s): %w", id, intent.SubRequestId, err)
		}
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		// 1) 钱包出资回退（组织账本与成员子额度必须成对回退，与 WalletFunding.Refund 一致）。
		if intent.FundingSource == RefundSourceWallet && intent.WalletAmount > 0 {
			if !intent.OrgResolved {
				return fmt.Errorf("refund intent %d: wallet funding org not resolved; refusing to guess refund target", id)
			}
			if intent.OrgId > 0 {
				if err := incrOrgUsedQuotaTx(tx, intent.OrgId, -int64(intent.WalletAmount)); err != nil {
					return fmt.Errorf("roll back organization %d reserve of %d: %w", intent.OrgId, intent.WalletAmount, err)
				}
				if err := adjustUserUsedQuotaTx(tx, intent.UserId, -intent.WalletAmount); err != nil {
					return fmt.Errorf("roll back member %d sub-quota reserve of %d: %w", intent.UserId, intent.WalletAmount, err)
				}
			} else if err := increaseUserQuotaTx(tx, intent.UserId, intent.WalletAmount); err != nil {
				return err
			}
		}
		// 2) 订阅补充预扣回退（非幂等原语，必须与完成标记同事务）。
		if intent.FundingSource == RefundSourceSubscription && intent.SubExtra > 0 && intent.SubId > 0 {
			if err := postConsumeUserSubscriptionDeltaTx(tx, intent.SubId, -intent.SubExtra); err != nil {
				return fmt.Errorf("roll back subscription %d extra reserved %d: %w", intent.SubId, intent.SubExtra, err)
			}
		}
		// 3) 令牌额度退回。
		if intent.TokenConsumed > 0 && intent.TokenId > 0 {
			if err := increaseTokenQuotaTx(tx, intent.TokenId, intent.TokenConsumed); err != nil {
				return fmt.Errorf("refund token %d quota %d: %w", intent.TokenId, intent.TokenConsumed, err)
			}
		}
		// 4) 完成标记是本事务的幂等门：抢不到（已被并发执行）就整体回滚。
		res := tx.Model(&RefundIntent{}).
			Where("id = ? AND status = ?", id, RefundIntentPending).
			Updates(map[string]any{"status": RefundIntentDone, "update_time": common.GetTimestamp()})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return errRefundIntentAlreadyDone
		}
		return nil
	})
	if errors.Is(err, errRefundIntentAlreadyDone) {
		// 另一个执行者（扫描任务/并发实例）已完成，本侧原语随事务回滚，无双退。
		return nil
	}
	if err != nil {
		return err
	}
	syncRefundIntentCaches(&intent)
	return nil
}

// syncRefundIntentCaches 在退款事务提交后同步缓存层，口径与对应公开函数一致：
// 用户余额缓存无条件增量；令牌配额缓存是守卫式增量（哈希不存在时跳过，由下次
// 读取从数据库水合）。令牌可能已被删除，此时跳过缓存同步即可。
func syncRefundIntentCaches(intent *RefundIntent) {
	if intent.FundingSource == RefundSourceWallet && intent.OrgResolved && intent.OrgId == 0 && intent.WalletAmount > 0 {
		runCacheSync(func() {
			if err := cacheIncrUserQuota(intent.UserId, int64(intent.WalletAmount)); err != nil {
				common.SysLog(common.LogText("failed to sync user quota cache after refund intent %d: %s", intent.Id, err.Error()))
			}
		})
	}
	if intent.TokenConsumed > 0 && intent.TokenId > 0 {
		var token Token
		if err := DB.Select("id", "key").Where("id = ?", intent.TokenId).First(&token).Error; err != nil {
			return
		}
		runCacheSync(func() {
			if _, err := cacheApplyTokenQuotaDelta(intent.TokenId, token.Key, int64(intent.TokenConsumed)); err != nil {
				common.SysLog(common.LogText("failed to sync token quota cache after refund intent %d: %s", intent.Id, err.Error()))
			}
		})
	}
}

// SweepPendingRefundIntents 重放滞留的 pending 退款凭证（崩溃窗口兜底）。
// staleAfterSeconds 避开仍在执行中的新鲜凭证；并发执行同一凭证是安全的
// （ExecuteRefundIntent 的事务门保证只有一个赢家）。返回本次成功收口的笔数。
func SweepPendingRefundIntents(staleAfterSeconds int64, limit int) (int, error) {
	if limit <= 0 {
		limit = 200
	}
	cutoff := common.GetTimestamp() - staleAfterSeconds
	var intents []RefundIntent
	if err := DB.Where("status = ? AND update_time < ?", RefundIntentPending, cutoff).
		Order("id asc").Limit(limit).Find(&intents).Error; err != nil {
		return 0, err
	}
	done := 0
	var firstErr error
	for i := range intents {
		if err := ExecuteRefundIntent(intents[i].Id); err != nil {
			common.SysError(fmt.Sprintf("refund intent %d sweep execution failed (userId=%d): %s",
				intents[i].Id, intents[i].UserId, err.Error()))
			if firstErr == nil {
				firstErr = fmt.Errorf("refund intent %d failed: %w", intents[i].Id, err)
			}
			continue
		}
		done++
	}
	return done, firstErr
}
