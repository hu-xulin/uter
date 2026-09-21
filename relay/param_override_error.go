package relay

import (
	relaycommon "github.com/QuantumNous/uter/relay/common"
	"github.com/QuantumNous/uter/relaykit/types"
)

func newAPIErrorFromParamOverride(err error) *types.UterError {
	if fixedErr, ok := relaycommon.AsParamOverrideReturnError(err); ok {
		return relaycommon.UterErrorFromParamOverride(fixedErr)
	}
	return types.NewError(err, types.ErrorCodeChannelParamOverrideInvalid, types.ErrOptionWithSkipRetry())
}
