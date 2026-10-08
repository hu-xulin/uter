package controller

import (
	"errors"

	"github.com/uter-ai/uter/i18n"
	"github.com/uter-ai/uter/logger"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"

	"github.com/gin-gonic/gin"
)

// localizeRelayError 把内部错误翻译成**用户能看懂、并知道下一步怎么做**的本地化文案。
//
// 为什么需要它：额度类错误此前是裸 fmt.Errorf 英文串（如
// "organization member sub-quota exceeded: used $0.000000 / limit $0.000200"），
// 经 Relay 的统一错误出口直接回给浏览器。用户在中文界面看到的也是这句英文，
// 既不本地化也没给出处置建议。
//
// 覆盖范围刻意保守：只翻译「已结构化、语义稳定、且带可展示数值」的额度类错误，
// 其余错误保持原样透出，避免把上游/内部的技术细节改写走样。
func localizeRelayError(c *gin.Context, err error) string {
	if err == nil {
		return ""
	}

	var orgErr *model.OrgQuotaError
	if errors.As(err, &orgErr) {
		args := map[string]any{
			"Used":     logger.FormatQuota(int(orgErr.Used)),
			"Limit":    logger.FormatQuota(int(orgErr.Limit)),
			"Required": logger.FormatQuota(int(orgErr.Required)),
		}
		switch {
		case errors.Is(orgErr.Kind, model.ErrOrgSubQuotaExceeded):
			return i18n.T(c, i18n.MsgQuotaOrgSubQuotaExceeded, args)
		case errors.Is(orgErr.Kind, model.ErrOrgBudgetExceeded):
			return i18n.T(c, i18n.MsgQuotaOrgBudgetExceeded, args)
		}
	}

	if errors.Is(err, model.ErrOrgSuspended) {
		return i18n.T(c, i18n.MsgQuotaOrgSuspended)
	}

	var quotaErr *service.QuotaError
	if errors.As(err, &quotaErr) {
		switch {
		case errors.Is(quotaErr.Kind, service.ErrUserQuotaNotEnough):
			return i18n.T(c, i18n.MsgQuotaUserNotEnough)
		case errors.Is(quotaErr.Kind, service.ErrTokenQuotaNotEnough):
			return i18n.T(c, i18n.MsgQuotaTokenNotEnough)
		}
	}

	return err.Error()
}
