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
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/i18n"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/relaykit/types"
	"github.com/uter-ai/uter/service"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newRelayCtx(lang string) *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	// 与 middleware.I18n() 写入 context 的键保持一致，使 i18n.T 走指定语言。
	c.Set("language", lang)
	return c
}

// TestLocalizeRelayErrorQuota 额度类错误必须本地化、可读，且带真实数值。
func TestLocalizeRelayErrorQuota(t *testing.T) {
	require.NoError(t, i18n.Init())

	t.Run("org sub-quota in Chinese", func(t *testing.T) {
		c := newRelayCtx("zh-CN")
		err := &types.UterError{}
		_ = err
		inner := fmt.Errorf("wrapped: %w", &model.OrgQuotaError{
			Kind:     model.ErrOrgSubQuotaExceeded,
			Used:     0,
			Limit:    100,
			Required: 50000,
		})
		got := localizeRelayError(c, inner)
		assert.NotContains(t, got, "sub-quota exceeded", "must not leak the English technical string")
		assert.Contains(t, got, "额度", "Chinese UI must get a Chinese message")
		assert.Contains(t, got, "组织", "message should name the organization scope")
	})

	t.Run("org budget in Chinese", func(t *testing.T) {
		c := newRelayCtx("zh-CN")
		inner := &model.OrgQuotaError{Kind: model.ErrOrgBudgetExceeded, Used: 10, Limit: 20, Required: 5}
		got := localizeRelayError(c, inner)
		assert.NotContains(t, got, "budget exceeded")
		assert.Contains(t, got, "预算")
	})

	t.Run("user and token quota", func(t *testing.T) {
		c := newRelayCtx("zh-CN")
		userErr := fmt.Errorf("ctx: %w", &service.QuotaError{Kind: service.ErrUserQuotaNotEnough, Have: 1, Need: 2})
		assert.Contains(t, localizeRelayError(c, userErr), "余额")

		tokenErr := fmt.Errorf("ctx: %w", &service.QuotaError{Kind: service.ErrTokenQuotaNotEnough, Have: 1, Need: 2})
		assert.Contains(t, localizeRelayError(c, tokenErr), "密钥")
	})

	t.Run("org suspended", func(t *testing.T) {
		c := newRelayCtx("zh-CN")
		assert.Contains(t, localizeRelayError(c, model.ErrOrgSuspended), "停用")
	})

	t.Run("English locale still English", func(t *testing.T) {
		c := newRelayCtx("en")
		got := localizeRelayError(c, &model.OrgQuotaError{Kind: model.ErrOrgSubQuotaExceeded, Limit: 100, Required: 5})
		assert.Contains(t, got, "allowance", "en locale must not receive the Chinese string")
	})

	t.Run("unknown error passes through untouched", func(t *testing.T) {
		c := newRelayCtx("zh-CN")
		raw := fmt.Errorf("upstream said 502")
		assert.Equal(t, raw.Error(), localizeRelayError(c, raw))
		assert.Equal(t, "", localizeRelayError(c, nil))
	})
}

// TestLocalizeRelayErrorThroughUterError 真实链路上错误会被 UterError 包裹并
// 加上 request id，本地化必须发生在「加 request id 之前」且能穿过 Unwrap。
func TestLocalizeRelayErrorThroughUterError(t *testing.T) {
	require.NoError(t, i18n.Init())
	c := newRelayCtx("zh-CN")

	inner := &model.OrgQuotaError{Kind: model.ErrOrgSubQuotaExceeded, Used: 0, Limit: 100, Required: 36460}
	uterErr := types.NewErrorWithStatusCode(inner, types.ErrorCodePreConsumeTokenQuotaFailed,
		http.StatusForbidden, types.ErrOptionWithSkipRetry())

	localized := localizeRelayError(c, uterErr)
	assert.NotContains(t, localized, "sub-quota exceeded")
	assert.Contains(t, localized, "额度")

	// 加 request id 之后仍然是可读中文，且带上可追溯的请求号。
	final := common.MessageWithRequestId(localized, "req-abc123")
	assert.Contains(t, final, "额度")
	assert.True(t, strings.Contains(final, "req-abc123"))
}
