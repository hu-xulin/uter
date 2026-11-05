package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestDecreaseUserQuotaFailsWhenUserDoesNotExist(t *testing.T) {
	previousDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&User{}))
	DB = db
	t.Cleanup(func() {
		DB = previousDB
		_ = sqlDB.Close()
	})

	require.ErrorIs(t, DecreaseUserQuota(987654, 1, true), gorm.ErrRecordNotFound)
	require.NoError(t, DecreaseUserQuota(987654, 0, true))

	user := &User{Username: "quota-debit-existing", AffCode: "qdebit", Quota: 10}
	require.NoError(t, db.Create(user).Error)
	require.NoError(t, DecreaseUserQuota(user.Id, 3, true))
	var stored User
	require.NoError(t, db.First(&stored, user.Id).Error)
	require.Equal(t, 7, stored.Quota)
}
