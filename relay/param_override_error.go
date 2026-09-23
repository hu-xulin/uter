package relay

import (
	relaycommon "github.com/Uter-AI/Uter/relay/common"

	"github.com/Uter-AI/Uter/relaykit/types"
)

func uterErrorFromParamOverride(err error) *types.UterError {
	if fixedErr, ok := relaycommon.AsParamOverrideReturnError(err); ok {
		return relaycommon.UterErrorFromParamOverride(fixedErr)
	}
	return types.NewError(err, types.ErrorCodeChannelParamOverrideInvalid, types.ErrOptionWithSkipRetry())
}
