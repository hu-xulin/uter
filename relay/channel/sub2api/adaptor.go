package sub2api

import (
	"github.com/QuantumNous/u-routers/relay/channel/URouters"
)

type Adaptor struct {
	URouters.Adaptor
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
