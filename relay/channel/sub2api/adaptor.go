package sub2api

import (
	"github.com/uter-ai/uter/relay/channel/Uter"
)

type Adaptor struct {
	Uter.Adaptor
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
