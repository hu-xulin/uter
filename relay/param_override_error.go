package relay

import (
	relaycommon "github.com/QuantumNous/u-routers/relay/common"
	"github.com/QuantumNous/u-routers/relaykit/types"
)

func newAPIErrorFromParamOverride(err error) *types.URouterError {
	if fixedErr, ok := relaycommon.AsParamOverrideReturnError(err); ok {
		return relaycommon.URouterErrorFromParamOverride(fixedErr)
	}
	return types.NewError(err, types.ErrorCodeChannelParamOverrideInvalid, types.ErrOptionWithSkipRetry())
}
