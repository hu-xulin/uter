package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMidjourneyRefundOperationUniqueIdentity(t *testing.T) {
	table := "midjourney_refund_operations_contract_test"
	db := DB.Table(table)
	require.NoError(t, db.AutoMigrate(&MidjourneyRefundOperation{}))
	t.Cleanup(func() { _ = DB.Migrator().DropTable(table) })

	first := MidjourneyRefundOperation{
		MidjourneyTaskID: 101,
		ReasonCode: "upstream_failed",
		FundingSource: "personal_wallet",
		BillingSnapshotJSON: `{"version":1,"wallet_applied_quota":25}`,
		WalletAppliedQuota: 25,
	}
	require.NoError(t, db.Create(&first).Error)
	assert.Equal(t, "midjourney:101:full", first.IdempotencyKey)
	assert.Equal(t, MidjourneyRefundPending, first.Status)
	assert.Equal(t, 1, first.BillingVersion)
	assert.NotZero(t, first.CreatedAt)

	duplicateTask := MidjourneyRefundOperation{
		MidjourneyTaskID: 101,
		ReasonCode: "duplicate",
		FundingSource: "personal_wallet",
		BillingSnapshotJSON: `{"version":1,"wallet_applied_quota":25}`,
	}
	assert.Error(t, db.Create(&duplicateTask).Error)

	duplicateKey := MidjourneyRefundOperation{
		MidjourneyTaskID: 102,
		IdempotencyKey: first.IdempotencyKey,
		ReasonCode: "duplicate_key",
		FundingSource: "personal_wallet",
		BillingSnapshotJSON: `{"version":1}`,
	}
	assert.Error(t, db.Create(&duplicateKey).Error)
}

func TestMidjourneyRefundOperationRejectsUnverifiableInput(t *testing.T) {
	table := "midjourney_refund_operations_validation_test"
	db := DB.Table(table)
	require.NoError(t, db.AutoMigrate(&MidjourneyRefundOperation{}))
	t.Cleanup(func() { _ = DB.Migrator().DropTable(table) })

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
