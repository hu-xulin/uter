package relay

import (
	relaycommon "github.com/uter-ai/uter/relay/common"

	"github.com/uter-ai/uter/relaykit/types"
)

func uterErrorFromParamOverride(err error) *types.UterError {
	if fixedErr, ok := relaycommon.AsParamOverrideReturnError(err); ok {
		return relaycommon.UterErrorFromParamOverride(fixedErr)
	}
	return types.NewError(err, types.ErrorCodeChannelParamOverrideInvalid, types.ErrOptionWithSkipRetry())
}
