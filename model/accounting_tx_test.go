package model

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"gorm.io/gorm"
)

func TestAccountingTransactionPrimitivesCommitTogether(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)

	user := createReserveTestUser(t, 100)
	token := createReserveTestToken(t, 80)
	token.UsedQuota = 20
	require.NoError(t, DB.Model(&Token{}).Where("id = ?", token.Id).Update("used_quota", 20).Error)

	channel := Channel{
		Name:      "accounting-tx-channel",
		Key:       "accounting-tx-key",
		Status:    1,
		UsedQuota: 60,
	}
	require.NoError(t, DB.Create(&channel).Error)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Update("used_quota", 50).Error)

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		if err := increaseUserQuotaTx(tx, user.Id, 25); err != nil {
			return err
		}
		if err := increaseTokenQuotaTx(tx, token.Id, 20); err != nil {
			return err
		}
		if err := adjustUserUsedQuotaTx(tx, user.Id, -25); err != nil {
			return err
		}
		return adjustChannelUsedQuotaTx(tx, channel.Id, -25)
	}))

	assert.Equal(t, 125, getUserQuotaFromDB(t, user.Id))
	storedToken := getTokenFromDB(t, token.Id)
	assert.Equal(t, 100, storedToken.RemainQuota)
	assert.Equal(t, 0, storedToken.UsedQuota)

	var storedUser User
	require.NoError(t, DB.Select("used_quota").First(&storedUser, user.Id).Error)
	assert.EqualValues(t, 25, storedUser.UsedQuota)
	var storedChannel Channel
	require.NoError(t, DB.Select("used_quota").First(&storedChannel, channel.Id).Error)
	assert.EqualValues(t, 35, storedChannel.UsedQuota)
}

func TestAccountingTransactionPrimitivesRollbackTogether(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)

	user := createReserveTestUser(t, 100)
	token := createReserveTestToken(t, 80)
	require.NoError(t, DB.Model(&Token{}).Where("id = ?", token.Id).Updates(map[string]any{
		"remain_quota": 70,
		"used_quota":   10,
	}).Error)
	channel := Channel{Name: "accounting-tx-rollback", Key: "accounting-tx-rollback-key", Status: 1, UsedQuota: 40}
	require.NoError(t, DB.Create(&channel).Error)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Update("used_quota", 10).Error)

	rollbackErr := errors.New("force rollback")
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := increaseUserQuotaTx(tx, user.Id, 10); err != nil {
			return err
		}
		if err := increaseTokenQuotaTx(tx, token.Id, 10); err != nil {
			return err
		}
		if err := adjustUserUsedQuotaTx(tx, user.Id, -10); err != nil {
			return err
		}
		if err := adjustChannelUsedQuotaTx(tx, channel.Id, -10); err != nil {
			return err
		}
		return rollbackErr
	})
	assert.ErrorIs(t, err, rollbackErr)
	assert.Equal(t, 100, getUserQuotaFromDB(t, user.Id))
	storedToken := getTokenFromDB(t, token.Id)
	assert.Equal(t, 70, storedToken.RemainQuota)
	assert.Equal(t, 10, storedToken.UsedQuota)

	var storedUser User
	require.NoError(t, DB.Select("used_quota").First(&storedUser, user.Id).Error)
	assert.EqualValues(t, 10, storedUser.UsedQuota)
	var storedChannel Channel
	require.NoError(t, DB.Select("used_quota").First(&storedChannel, channel.Id).Error)
	assert.EqualValues(t, 40, storedChannel.UsedQuota)
}

func TestAccountingTransactionPrimitivesRejectMissingRows(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)

	assert.ErrorIs(t, increaseTokenQuotaTx(DB, 999999, 1), gorm.ErrRecordNotFound)
	assert.ErrorIs(t, adjustUserUsedQuotaTx(DB, 999999, -1), gorm.ErrRecordNotFound)
	assert.ErrorIs(t, adjustChannelUsedQuotaTx(DB, 999999, -1), gorm.ErrRecordNotFound)
	assert.Error(t, increaseTokenQuotaTx(nil, 1, 1))
	assert.Error(t, adjustUserUsedQuotaTx(nil, 1, -1))
	assert.Error(t, adjustChannelUsedQuotaTx(nil, 1, -1))
	assert.Error(t, increaseTokenQuotaTx(DB, 1, -1))
}

func TestAccountingTransactionPrimitivesRejectUsageUnderflow(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)

	user := createReserveTestUser(t, 100)
	channel := Channel{Name: "accounting-tx-underflow", Key: "accounting-tx-underflow-key", Status: 1, UsedQuota: 5}
	require.NoError(t, DB.Create(&channel).Error)

	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := adjustUserUsedQuotaTx(tx, user.Id, -1); err == nil {
			return errors.New("expected user usage underflow to be rejected")
		}
		if err := adjustChannelUsedQuotaTx(tx, channel.Id, -6); err == nil {
			return errors.New("expected channel usage underflow to be rejected")
		}
		return nil
	})
	require.NoError(t, err)

	var storedUser User
	require.NoError(t, DB.Select("used_quota").First(&storedUser, user.Id).Error)
	assert.Zero(t, storedUser.UsedQuota)
	var storedChannel Channel
	require.NoError(t, DB.Select("used_quota").First(&storedChannel, channel.Id).Error)
	assert.EqualValues(t, 5, storedChannel.UsedQuota)
}

func TestRecordMidjourneyTaskUsageIsSynchronousAndAtomic(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)

	user := createReserveTestUser(t, 100)
	channel := Channel{Name: "mj-usage-atomic", Key: "mj-usage-atomic-key", Status: 1}
	require.NoError(t, DB.Create(&channel).Error)

	require.NoError(t, RecordMidjourneyTaskUsage(user.Id, channel.Id, 25))
	var storedUser User
	require.NoError(t, DB.Select("used_quota", "request_count").First(&storedUser, user.Id).Error)
	assert.EqualValues(t, 25, storedUser.UsedQuota)
	assert.EqualValues(t, 1, storedUser.RequestCount)
	var storedChannel Channel
	require.NoError(t, DB.Select("used_quota").First(&storedChannel, channel.Id).Error)
	assert.EqualValues(t, 25, storedChannel.UsedQuota)

	err := RecordMidjourneyTaskUsage(user.Id, 999999, 10)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	require.NoError(t, DB.Select("used_quota", "request_count").First(&storedUser, user.Id).Error)
	assert.EqualValues(t, 25, storedUser.UsedQuota)
	assert.EqualValues(t, 1, storedUser.RequestCount)
}
