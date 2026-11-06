package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

func makeFundingTask(userID int, source string, subscriptionID int, organizationID *int) *model.Task {
	return &model.Task{
		UserId: userID,
		PrivateData: model.TaskPrivateData{
			BillingSource:  source,
			SubscriptionId: subscriptionID,
			OrganizationId: organizationID,
		},
	}
}

func loadOrganization(t *testing.T, id int) model.Organization {
	t.Helper()
	var org model.Organization
	require.NoError(t, model.DB.First(&org, "id = ?", id).Error)
	return org
}

func loadUser(t *testing.T, id int) model.User {
	t.Helper()
	var user model.User
	require.NoError(t, model.DB.First(&user, "id = ?", id).Error)
	return user
}

func loadSubscription(t *testing.T, id int) model.UserSubscription {
	t.Helper()
	var sub model.UserSubscription
	require.NoError(t, model.DB.First(&sub, "id = ?", id).Error)
	return sub
}

func seedOrganizationTaskFunding(t *testing.T, userID, orgID int, orgUsed, memberUsed int64) *model.Task {
	t.Helper()
	seedUser(t, userID, 10000)
	org := &model.Organization{
		Id: orgID, Name: "billing-test-org", OwnerUserId: userID,
		Quota: 100000, UsedQuota: orgUsed, Status: model.OrgStatusEnabled,
	}
	require.NoError(t, model.DB.Create(org).Error)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", userID).Updates(map[string]any{
		"organization_id": orgID, "used_quota": memberUsed,
	}).Error)
	return makeFundingTask(userID, BillingSourceWallet, 0, &orgID)
}

func TestTaskAdjustFundingOrganizationUpdatesBothLedgers(t *testing.T) {
	truncate(t)
	task := seedOrganizationTaskFunding(t, 801, 801, 100, 40)

	require.NoError(t, taskAdjustFunding(task, 25))

	assert.Equal(t, int64(125), loadOrganization(t, 801).UsedQuota)
	assert.Equal(t, 65, loadUser(t, 801).UsedQuota)
}

func TestTaskAdjustFundingOrganizationRefundUpdatesBothLedgers(t *testing.T) {
	truncate(t)
	task := seedOrganizationTaskFunding(t, 802, 802, 100, 40)

	require.NoError(t, taskAdjustFunding(task, -25))

	assert.Equal(t, int64(75), loadOrganization(t, 802).UsedQuota)
	assert.Equal(t, 15, loadUser(t, 802).UsedQuota)
}

func TestTaskAdjustFundingOrganizationMemberUnderflowRollsBackOrganization(t *testing.T) {
	truncate(t)
	task := seedOrganizationTaskFunding(t, 803, 803, 100, 5)

	err := taskAdjustFunding(task, -10)
	require.Error(t, err)
	assert.Equal(t, int64(100), loadOrganization(t, 803).UsedQuota)
	assert.Equal(t, 5, loadUser(t, 803).UsedQuota)
}

func TestTaskAdjustFundingOrganizationMissingMemberRollsBackOrganization(t *testing.T) {
	truncate(t)
	org := &model.Organization{Id: 804, Name: "orphan-org", Quota: 1000, UsedQuota: 100, Status: model.OrgStatusEnabled}
	require.NoError(t, model.DB.Create(org).Error)
	task := makeFundingTask(8999, BillingSourceWallet, 0, &org.Id)

	require.Error(t, taskAdjustFunding(task, 10))
	assert.Equal(t, int64(100), loadOrganization(t, 804).UsedQuota)
}

func TestTaskAdjustFundingOrganizationMissingSnapshotFailsClosed(t *testing.T) {
	truncate(t)
	seedUser(t, 805, 1000)
	task := makeFundingTask(805, BillingSourceWallet, 0, nil)

	require.ErrorIs(t, taskAdjustFunding(task, 10), ErrTaskFundingSourceUnresolved)
	assert.Equal(t, 1000, getUserQuota(t, 805))
}

func TestTaskAdjustFundingSubscriptionOverflowChargesWalletAtomically(t *testing.T) {
	truncate(t)
	seedUser(t, 806, 1000)
	seedSubscription(t, 806, 806, 100, 90)
	task := makeFundingTask(806, BillingSourceSubscription, 806, nil)

	require.NoError(t, taskAdjustFunding(task, 30))

	assert.Equal(t, int64(100), loadSubscription(t, 806).AmountUsed)
	assert.Equal(t, 990, getUserQuota(t, 806), "only the 20-unit overflow should debit the wallet")
}

func TestTaskAdjustFundingSubscriptionWithinBalanceDoesNotDebitWallet(t *testing.T) {
	truncate(t)
	seedUser(t, 807, 1000)
	seedSubscription(t, 807, 807, 100, 50)
	task := makeFundingTask(807, BillingSourceSubscription, 807, nil)

	require.NoError(t, taskAdjustFunding(task, 30))

	assert.Equal(t, int64(80), loadSubscription(t, 807).AmountUsed)
	assert.Equal(t, 1000, getUserQuota(t, 807))
}

func TestTaskAdjustFundingSubscriptionRefundRestoresUsage(t *testing.T) {
	truncate(t)
	seedUser(t, 808, 1000)
	seedSubscription(t, 808, 808, 100, 80)
	task := makeFundingTask(808, BillingSourceSubscription, 808, nil)

	require.NoError(t, taskAdjustFunding(task, -30))

	assert.Equal(t, int64(50), loadSubscription(t, 808).AmountUsed)
	assert.Equal(t, 1000, getUserQuota(t, 808))
}

func TestTaskAdjustFundingSubscriptionMissingWalletRollsBackCap(t *testing.T) {
	truncate(t)
	seedSubscription(t, 809, 8099, 100, 90)
	task := makeFundingTask(8099, BillingSourceSubscription, 809, nil)

	require.Error(t, taskAdjustFunding(task, 30))
	assert.Equal(t, int64(90), loadSubscription(t, 809).AmountUsed)
}

func TestTaskAdjustFundingZeroDeltaIsNoop(t *testing.T) {
	truncate(t)
	task := seedOrganizationTaskFunding(t, 810, 810, 100, 40)

	require.NoError(t, taskAdjustFunding(task, 0))

	assert.Equal(t, int64(100), loadOrganization(t, 810).UsedQuota)
	assert.Equal(t, 40, loadUser(t, 810).UsedQuota)
}

func TestTaskAdjustFundingNilTaskFailsClosed(t *testing.T) {
	assert.Error(t, taskAdjustFunding(nil, 1))
}

func TestTaskAdjustFundingRejectsInvalidSubscriptionSnapshot(t *testing.T) {
	task := makeFundingTask(811, BillingSourceSubscription, 0, nil)
	assert.Error(t, taskAdjustFunding(task, 1))
}

func TestTaskAdjustFundingRejectsInvalidOrganizationID(t *testing.T) {
	seedUser(t, 812, 1000)
	invalidOrg := -1
	task := makeFundingTask(812, BillingSourceWallet, 0, &invalidOrg)
	assert.Error(t, taskAdjustFunding(task, 1))
	assert.Equal(t, common.UserStatusEnabled, loadUser(t, 812).Status)
}

func TestTaskFundingRejectsSubscriptionOwnedByAnotherUser(t *testing.T) {
	truncate(t)
	seedUser(t, 813, 1000)
	seedUser(t, 814, 1000)
	seedSubscription(t, 813, 814, 100, 90)
	task := makeFundingTask(813, BillingSourceSubscription, 813, nil)
	require.Error(t, taskAdjustFunding(task, 30))
	assert.Equal(t, int64(90), loadSubscription(t, 813).AmountUsed)
	assert.Equal(t, 1000, getUserQuota(t, 813))
	assert.Equal(t, 1000, getUserQuota(t, 814))
}

func TestTaskFundingSubscriptionRefundCarryOver(t *testing.T) {
	truncate(t)
	seedUser(t, 815, 1000)
	seedSubscription(t, 815, 815, 100, 10)
	task := makeFundingTask(815, BillingSourceSubscription, 815, nil)
	require.NoError(t, taskAdjustFunding(task, -25))
	sub := loadSubscription(t, 815)
	assert.Zero(t, sub.AmountUsed)
	assert.Equal(t, int64(15), sub.RefundCarryOver)
}

func TestTaskAdjustFundingPersonalWalletDebitPersists(t *testing.T) {
	truncate(t)
	seedUser(t, 816, 1000)
	orgID := 0
	task := makeFundingTask(816, BillingSourceWallet, 0, &orgID)

	require.NoError(t, taskAdjustFunding(task, 125))
	assert.Equal(t, 875, getUserQuota(t, 816))
}

func TestTaskAdjustFundingPersonalWalletRefundPersists(t *testing.T) {
	truncate(t)
	seedUser(t, 817, 1000)
	orgID := 0
	task := makeFundingTask(817, BillingSourceWallet, 0, &orgID)

	require.NoError(t, taskAdjustFunding(task, -125))
	assert.Equal(t, 1125, getUserQuota(t, 817))
}
