package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"gorm.io/gorm"
)

func TestPostConsumeSubscriptionOverflowChargesWalletAtomically(t *testing.T) {
	previousDB := DB
	previousRedis := common.RedisEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&User{}, &UserSubscription{}))
	DB = db
	common.RedisEnabled = false
	t.Cleanup(func() {
		WaitCacheSyncForTest()
		DB = previousDB
		common.RedisEnabled = previousRedis
		_ = sqlDB.Close()
	})

	user := User{Id: 1}
	require.NoError(t, db.Create(&user).Error)
	sub := UserSubscription{Id: 1, UserId: user.Id, AmountTotal: 100, AmountUsed: 80, Status: "active"}
	require.NoError(t, db.Create(&sub).Error)

	require.NoError(t, PostConsumeUserSubscriptionDeltaCappedWithWallet(sub.Id, user.Id, 50))
	var savedSub UserSubscription
	require.NoError(t, db.First(&savedSub, sub.Id).Error)
	require.EqualValues(t, 100, savedSub.AmountUsed)
	var savedUser User
	require.NoError(t, db.First(&savedUser, user.Id).Error)
	require.EqualValues(t, -30, savedUser.Quota, "overflow must be charged to the wallet in the same transaction")
}

func TestPostConsumeSubscriptionOverflowRollsBackWhenWalletMissing(t *testing.T) {
	previousDB := DB
	previousRedis := common.RedisEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&User{}, &UserSubscription{}))
	DB = db
	common.RedisEnabled = false
	t.Cleanup(func() {
		WaitCacheSyncForTest()
		DB = previousDB
		common.RedisEnabled = previousRedis
		_ = sqlDB.Close()
	})

	sub := UserSubscription{Id: 2, UserId: 2, AmountTotal: 100, AmountUsed: 80, Status: "active"}
	require.NoError(t, db.Create(&sub).Error)
	require.Error(t, PostConsumeUserSubscriptionDeltaCappedWithWallet(sub.Id, 999, 50))

	var savedSub UserSubscription
	require.NoError(t, db.First(&savedSub, sub.Id).Error)
	require.EqualValues(t, 80, savedSub.AmountUsed, "subscription update must roll back when wallet charge cannot be persisted")
}
