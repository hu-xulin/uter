package service

import (
	"errors"
	"fmt"

	"github.com/uter-ai/uter/logger"
)

// 额度不足类错误。这些错误会直接透出到 API 响应与界面提示，因此必须能被上层
// 本地化并给出「怎么办」的下一步，而不是把英文技术串丢给用户。
var (
	ErrUserQuotaNotEnough  = errors.New("user quota is not enough")
	ErrTokenQuotaNotEnough = errors.New("token quota is not enough")
)

// QuotaError 携带「已有 / 需要」两个数值，供上层渲染可读文案。
// Is 保证 errors.Is(err, ErrUserQuotaNotEnough) 等既有判定继续成立。
type QuotaError struct {
	Kind error
	Have int64
	Need int64
}

func (e *QuotaError) Error() string {
	return fmt.Sprintf("%s: have %s, need %s", e.Kind.Error(),
		logger.FormatQuota(int(e.Have)), logger.FormatQuota(int(e.Need)))
}

func (e *QuotaError) Is(target error) bool { return errors.Is(e.Kind, target) }
