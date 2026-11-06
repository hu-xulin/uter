package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// setupMidjourneyRefundOperationTestDB 建一个独立的内存库供本组测试使用。
//
// MidjourneyRefundOperation 带固定名的唯一索引（idx_mj_refund_task_operation），
// 而 SQLite 的索引名是「整个库全局唯一」的：TestMain 已经把同名索引建在
// midjourney_refund_operations 表上，测试若在同一个库里再建一张自定义表就会
// 撞名，报 "index idx_mj_refund_task_operation already exists"。用独立库
// 即可避开，且各用例之间互不干扰。
func setupMidjourneyRefundOperationTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	DB = db
	t.Cleanup(func() {
		DB = previousDB
		_ = sqlDB.Close()
	})
	return db
}

func TestMidjourneyRefundOperationUniqueIdentity(t *testing.T) {
	table := "midjourney_refund_operations_contract_test"
	db := setupMidjourneyRefundOperationTestDB(t).Table(table)
	require.NoError(t, db.AutoMigrate(&MidjourneyRefundOperation{}))
	t.Cleanup(func() { _ = db.Migrator().DropTable(table) })

	first := MidjourneyRefundOperation{
		MidjourneyTaskID:    101,
		ReasonCode:          "upstream_failed",
		FundingSource:       "personal_wallet",
		BillingSnapshotJSON: `{"version":1,"wallet_applied_quota":25}`,
		WalletAppliedQuota:  25,
	}
	require.NoError(t, db.Create(&first).Error)
	assert.Error(t, db.Model(&first).Update("billing_snapshot_json", `{"version":2}`).Error)
	assert.Equal(t, "midjourney:101:full", first.IdempotencyKey)
	assert.Equal(t, MidjourneyRefundPending, first.Status)
	assert.Equal(t, 1, first.BillingVersion)
	assert.NotZero(t, first.CreatedAt)

	duplicateTask := MidjourneyRefundOperation{
		MidjourneyTaskID:    101,
		ReasonCode:          "duplicate",
		FundingSource:       "personal_wallet",
		BillingSnapshotJSON: `{"version":1,"wallet_applied_quota":25}`,
	}
	assert.Error(t, db.Create(&duplicateTask).Error)

	duplicateKey := MidjourneyRefundOperation{
		MidjourneyTaskID:    102,
		IdempotencyKey:      first.IdempotencyKey,
		ReasonCode:          "duplicate_key",
		FundingSource:       "personal_wallet",
		BillingSnapshotJSON: `{"version":1}`,
	}
	assert.Error(t, db.Create(&duplicateKey).Error)
}

func TestMidjourneyRefundOperationRejectsUnverifiableInput(t *testing.T) {
	table := "midjourney_refund_operations_validation_test"
	db := setupMidjourneyRefundOperationTestDB(t).Table(table)
	require.NoError(t, db.AutoMigrate(&MidjourneyRefundOperation{}))
	t.Cleanup(func() { _ = db.Migrator().DropTable(table) })

	for _, op := range []*MidjourneyRefundOperation{
		{MidjourneyTaskID: 0, ReasonCode: "failed", FundingSource: "personal_wallet", BillingSnapshotJSON: `{"version":1}`},
		{MidjourneyTaskID: 201, ReasonCode: "", FundingSource: "personal_wallet", BillingSnapshotJSON: `{"version":1}`},
		{MidjourneyTaskID: 202, ReasonCode: "failed", FundingSource: "", BillingSnapshotJSON: `{"version":1}`},
		{MidjourneyTaskID: 203, ReasonCode: "failed", FundingSource: "personal_wallet", BillingSnapshotJSON: ""},
		{MidjourneyTaskID: 204, OperationType: "partial", ReasonCode: "failed", FundingSource: "personal_wallet", BillingSnapshotJSON: `{"version":1}`},
		{MidjourneyTaskID: 205, Status: MidjourneyRefundCompleted, ReasonCode: "failed", FundingSource: "personal_wallet", BillingSnapshotJSON: `{"version":1}`},
		{MidjourneyTaskID: 206, ReasonCode: "failed", FundingSource: "personal_wallet", BillingSnapshotJSON: `not-json`},
		{MidjourneyTaskID: 207, ReasonCode: "failed", FundingSource: "unsupported", BillingSnapshotJSON: `{"version":1}`},
		{MidjourneyTaskID: 208, ReasonCode: "failed", FundingSource: "personal_wallet", BillingSnapshotJSON: `{"version":1}`, WalletAppliedQuota: -1},
		{MidjourneyTaskID: 209, ReasonCode: "failed", FundingSource: "personal_wallet", BillingVersion: -1, BillingSnapshotJSON: `{"version":1}`},
	} {
		assert.Error(t, db.Create(op).Error)
	}
}
