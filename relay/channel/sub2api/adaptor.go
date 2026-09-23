package sub2api

import (
	"https://github.com/Uter-AI/Uter/relay/channel/Uter"
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
