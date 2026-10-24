/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

package model

import (
	"strings"
	"testing"

	"github.com/uter-ai/uter/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// F-07: a locally created pending order must be closable with a persisted
// reason, so reconciliation can tell why the checkout never completed.
func TestMarkFailedRecordsReasonOnPendingOrder(t *testing.T) {
	truncateTables(t)

	pending := TopUp{
		UserId:          1,
		Amount:          2,
		Money:           10,
		TradeNo:         "F07-PENDING",
		PaymentProvider: PaymentProviderEpay,
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, DB.Create(&pending).Error)

	require.NoError(t, pending.MarkFailed("provider rejected the order"))

	reloaded := GetTopUpByTradeNo("F07-PENDING")
	require.NotNil(t, reloaded)
	assert.Equal(t, common.TopUpStatusFailed, reloaded.Status)
	assert.Equal(t, "provider rejected the order", reloaded.FailReason)
}

// F-07: the failure transition is conditional on the order still being
// pending. An order that a callback completed concurrently must never be
// downgraded to failed — that would hide real money from the user.
func TestMarkFailedDoesNotDowngradeCompletedOrder(t *testing.T) {
	truncateTables(t)

	done := TopUp{
		UserId:          1,
		Amount:          2,
		Money:           10,
		TradeNo:         "F07-DONE",
		PaymentProvider: PaymentProviderEpay,
		Status:          common.TopUpStatusSuccess,
	}
	require.NoError(t, DB.Create(&done).Error)

	require.NoError(t, done.MarkFailed("late failure"))

	reloaded := GetTopUpByTradeNo("F07-DONE")
	require.NotNil(t, reloaded)
	assert.Equal(t, common.TopUpStatusSuccess, reloaded.Status)
	assert.Empty(t, reloaded.FailReason, "a completed order must not gain a failure reason")
}

// The fail_reason column is bounded; an oversized provider error must not
// break the write.
func TestMarkFailedTruncatesOverlongReason(t *testing.T) {
	truncateTables(t)

	pending := TopUp{
		UserId:          1,
		Amount:          2,
		Money:           10,
		TradeNo:         "F07-LONG",
		PaymentProvider: PaymentProviderEpay,
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, DB.Create(&pending).Error)

	require.NoError(t, pending.MarkFailed(strings.Repeat("x", 400)))

	reloaded := GetTopUpByTradeNo("F07-LONG")
	require.NotNil(t, reloaded)
	assert.Equal(t, common.TopUpStatusFailed, reloaded.Status)
	assert.Len(t, reloaded.FailReason, 255)
}
