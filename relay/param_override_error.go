package relay

import (
	relaycommon "github.com/uter-ai/uter/relay/common"

	"github.com/uter-ai/uter/relaykit/types"
)

// newAPIErrorFromParamOverride 是上游对同一 helper 的命名（rc.38+ 的新调用点用它）。
// 保留两个名字，避免逐文件改名时漏改。
func newAPIErrorFromParamOverride(err error) *types.UterError {
	return uterErrorFromParamOverride(err)
}

func uterErrorFromParamOverride(err error) *types.UterError {
	if fixedErr, ok := relaycommon.AsParamOverrideReturnError(err); ok {
		return relaycommon.UterErrorFromParamOverride(fixedErr)
	}
	return types.NewError(err, types.ErrorCodeChannelParamOverrideInvalid, types.ErrOptionWithSkipRetry())
}
