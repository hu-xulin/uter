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

For commercial licensing, please contact support@uter.ai
*/

package controller

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/operation_setting"
)

// PAY-001: ConfirmPaymentCompliance must write all five compliance fields
// together and consistently. The previous per-field UpdateOption loop could
// leave compliance_confirmed=true with stale/empty metadata when a mid-loop
// write failed; UpdateOptionsBulk commits them in a single transaction.
func TestConfirmPaymentComplianceWritesAllFields(t *testing.T) {
	setupBillingTestDB(t)
	require.False(t, operation_setting.IsPaymentComplianceConfirmed(),
		"precondition: compliance must start unconfirmed")

	adminID := 7
	psBefore := *operation_setting.GetPaymentSetting()
	// Restore the in-memory compliance state via the test DB. This cleanup is
	// registered after setupBillingTestDB's, so it runs first (LIFO) while
	// model.DB is still the isolated in-memory instance.
	t.Cleanup(func() {
		_ = model.UpdateOptionsBulk(map[string]string{
			"payment_setting.compliance_confirmed":     strconv.FormatBool(psBefore.ComplianceConfirmed),
			"payment_setting.compliance_terms_version": psBefore.ComplianceTermsVersion,
			"payment_setting.compliance_confirmed_at":  strconv.FormatInt(psBefore.ComplianceConfirmedAt, 10),
			"payment_setting.compliance_confirmed_by":  strconv.Itoa(psBefore.ComplianceConfirmedBy),
			"payment_setting.compliance_confirmed_ip":  psBefore.ComplianceConfirmedIP,
		})
	})

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body := strings.NewReader(`{"confirmed": true}`)
	req := httptest.NewRequest(http.MethodPost, "/payment/compliance", body)
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = "192.0.2.8:4567"
	c.Request = req
	c.Set("id", adminID)
	c.Set("use_access_token", false)

	ConfirmPaymentCompliance(c)

	require.Equal(t, http.StatusOK, w.Code)
	require.True(t, operation_setting.IsPaymentComplianceConfirmed(),
		"compliance_confirmed must be true after a successful confirm")
	ps := operation_setting.GetPaymentSetting()
	assert.Equal(t, operation_setting.CurrentComplianceTermsVersion, ps.ComplianceTermsVersion)
	assert.Equal(t, adminID, ps.ComplianceConfirmedBy)
	assert.Greater(t, ps.ComplianceConfirmedAt, int64(0))
	assert.NotEmpty(t, ps.ComplianceConfirmedIP)
}
