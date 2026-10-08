package channel_weight

import (
	"strings"
	"sync"

	"github.com/uter-ai/uter/common"
)

// ChannelModelWeightOptionKey is the option key holding the per-(channel, model)
// routing overrides. The value is a JSON string of ChannelModelWeightSetting.
const ChannelModelWeightOptionKey = "ChannelModelWeight"

// optionValue reads an option under the option-map lock. Returns "" when unset.
func optionValue(key string) string {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	return common.OptionMap[key]
}

// parsedSetting caches a decoded option value keyed by its raw JSON string so
// re-parsing only happens after an admin edits the setting.
type parsedSetting[T any] struct {
	mu      sync.RWMutex
	raw     string
	decoded *T
}

func (p *parsedSetting[T]) get(key string) *T {
	raw := strings.TrimSpace(optionValue(key))
	p.mu.RLock()
	if p.raw == raw {
		cached := p.decoded
		p.mu.RUnlock()
		return cached
	}
	p.mu.RUnlock()

	p.mu.Lock()
	defer p.mu.Unlock()
	if p.raw != raw {
		p.raw = raw
		p.decoded = nil
		if raw != "" {
			decoded := new(T)
			if err := common.UnmarshalJsonStr(raw, decoded); err != nil {
				common.SysError("failed to parse option " + key + ": " + err.Error())
			} else {
				p.decoded = decoded
			}
		}
	}
	return p.decoded
}
